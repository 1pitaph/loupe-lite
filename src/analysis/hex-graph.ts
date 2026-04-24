import { cellToLatLng, getHexagonAreaAvg, gridDisk, UNITS } from 'h3-js';
import TinyQueue from 'tinyqueue';

import type { TransitMode } from './types';

// ---------------------------------------------------------------------------
// On-disk format (matches scripts/build-nyc-graph.ts output).
// ---------------------------------------------------------------------------
interface GraphFileV1 {
  version: 1;
  resolution: number;
  bounds: [number, number, number, number];
  cells: string[];
  subwayEdges: Array<[string, string, number]>;
  bridgeEdges: Array<[string, string, number]>;
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// In-memory CSR-ish graph.
// Walk adjacency is derived on-load from H3 ring-1 membership.
// ---------------------------------------------------------------------------
export interface HexGraph {
  resolution: number;
  bounds: [number, number, number, number];
  cellById: string[];
  idByCell: Map<string, number>;
  latLngById: Float64Array; // interleaved lat/lng for fast access
  walkCost: Int32Array[]; // per-node array of neighbor ids
  walkSec: Float32Array[]; // per-node array of seconds (aligned with walkCost)
  subwayBySrc: Map<number, Array<{ to: number; sec: number }>>;
  bridgeBySrc: Map<number, Array<{ to: number; sec: number }>>;
  cellAreaKm2: number;
}

const WALK_SPEED_MPS = 5000 / 3600; // 5 km/h
const BIKE_SPEED_MPS = 15000 / 3600; // 15 km/h

function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371008.8;
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLng = (bLng - aLng) * toRad;
  const la1 = aLat * toRad;
  const la2 = bLat * toRad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function buildGraph(file: GraphFileV1): HexGraph {
  const { cells, resolution } = file;
  const idByCell = new Map<string, number>();
  for (let i = 0; i < cells.length; i++) idByCell.set(cells[i], i);

  const latLngById = new Float64Array(cells.length * 2);
  for (let i = 0; i < cells.length; i++) {
    const [lat, lng] = cellToLatLng(cells[i]);
    latLngById[i * 2] = lat;
    latLngById[i * 2 + 1] = lng;
  }

  // Walk adjacency: H3 ring-1 neighbors that are also in our cell set.
  // Distance computed from cell-to-cell haversine — the two are effectively
  // equal at r9 (~260 m) but haversine keeps us honest if cells ever span
  // a resolution change.
  const walkCost: Int32Array[] = new Array(cells.length);
  const walkSec: Float32Array[] = new Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const ring = gridDisk(cells[i], 1);
    const neighborIds: number[] = [];
    const neighborSec: number[] = [];
    const aLat = latLngById[i * 2];
    const aLng = latLngById[i * 2 + 1];
    for (const n of ring) {
      if (n === cells[i]) continue;
      const nid = idByCell.get(n);
      if (nid === undefined) continue;
      const bLat = latLngById[nid * 2];
      const bLng = latLngById[nid * 2 + 1];
      const meters = haversineMeters(aLat, aLng, bLat, bLng);
      neighborIds.push(nid);
      neighborSec.push(meters / WALK_SPEED_MPS);
    }
    walkCost[i] = Int32Array.from(neighborIds);
    walkSec[i] = Float32Array.from(neighborSec);
  }

  const subwayBySrc = new Map<number, Array<{ to: number; sec: number }>>();
  for (const [from, to, sec] of file.subwayEdges) {
    const a = idByCell.get(from);
    const b = idByCell.get(to);
    if (a === undefined || b === undefined) continue;
    const list = subwayBySrc.get(a);
    if (list) list.push({ to: b, sec });
    else subwayBySrc.set(a, [{ to: b, sec }]);
  }

  const bridgeBySrc = new Map<number, Array<{ to: number; sec: number }>>();
  for (const [from, to, sec] of file.bridgeEdges) {
    const a = idByCell.get(from);
    const b = idByCell.get(to);
    if (a === undefined || b === undefined) continue;
    // Bridges are bidirectional.
    const pushInto = (
      m: Map<number, Array<{ to: number; sec: number }>>,
      src: number,
      dst: number,
    ) => {
      const list = m.get(src);
      if (list) list.push({ to: dst, sec });
      else m.set(src, [{ to: dst, sec }]);
    };
    pushInto(bridgeBySrc, a, b);
    pushInto(bridgeBySrc, b, a);
  }

  return {
    resolution,
    bounds: file.bounds,
    cellById: cells,
    idByCell,
    latLngById,
    walkCost,
    walkSec,
    subwayBySrc,
    bridgeBySrc,
    cellAreaKm2: getHexagonAreaAvg(resolution, UNITS.km2),
  };
}

// ---------------------------------------------------------------------------
// Public loader.
// ---------------------------------------------------------------------------
let cached: Promise<HexGraph> | null = null;

export function loadGraph(url: string): Promise<HexGraph> {
  if (cached) return cached;
  cached = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`graph fetch failed: ${res.status} ${res.statusText}`);
    const file = (await res.json()) as GraphFileV1;
    if (file.version !== 1) throw new Error(`unknown graph version: ${file.version}`);
    return buildGraph(file);
  })();
  return cached;
}

// ---------------------------------------------------------------------------
// Dijkstra from a single origin cell. Stops when cheapest-unsettled exceeds
// the time budget, keeping the search bounded to the visible isochrone.
// ---------------------------------------------------------------------------
export interface DijkstraResult {
  secondsTo: Map<number, number>;
}

export function dijkstra(
  graph: HexGraph,
  startNode: number,
  mode: TransitMode,
  budgetSeconds: number,
): DijkstraResult {
  const secondsTo = new Map<number, number>();
  const queue = new TinyQueue<{ id: number; sec: number }>(
    [{ id: startNode, sec: 0 }],
    (a, b) => a.sec - b.sec,
  );
  secondsTo.set(startNode, 0);

  const edgeSpeedScale = mode === 'bike' ? WALK_SPEED_MPS / BIKE_SPEED_MPS : 1;
  const includeSubway = mode === 'walk+subway' || mode === 'walk+subway+bus';

  while (queue.length > 0) {
    const cur = queue.pop();
    if (!cur) break;
    if (cur.sec > budgetSeconds) break;
    // Skip stale entries (TinyQueue doesn't support decrease-key).
    const best = secondsTo.get(cur.id);
    if (best !== undefined && cur.sec > best) continue;

    // Walk / bike neighbor edges.
    const nbrs = graph.walkCost[cur.id];
    const secs = graph.walkSec[cur.id];
    for (let k = 0; k < nbrs.length; k++) {
      const next = nbrs[k];
      const cost = cur.sec + secs[k] * edgeSpeedScale;
      if (cost > budgetSeconds) continue;
      const prev = secondsTo.get(next);
      if (prev === undefined || cost < prev) {
        secondsTo.set(next, cost);
        queue.push({ id: next, sec: cost });
      }
    }

    // Pedestrian bridges — only valid for walk & transit modes (bikes
    // technically can cross but we keep the bike isochrone pure to streets
    // for now; this can be relaxed later).
    if (mode !== 'bike') {
      const bridges = graph.bridgeBySrc.get(cur.id);
      if (bridges) {
        for (const e of bridges) {
          const cost = cur.sec + e.sec;
          if (cost > budgetSeconds) continue;
          const prev = secondsTo.get(e.to);
          if (prev === undefined || cost < prev) {
            secondsTo.set(e.to, cost);
            queue.push({ id: e.to, sec: cost });
          }
        }
      }
    }

    // Subway (and eventually bus) edges.
    if (includeSubway) {
      const sub = graph.subwayBySrc.get(cur.id);
      if (sub) {
        for (const e of sub) {
          const cost = cur.sec + e.sec;
          if (cost > budgetSeconds) continue;
          const prev = secondsTo.get(e.to);
          if (prev === undefined || cost < prev) {
            secondsTo.set(e.to, cost);
            queue.push({ id: e.to, sec: cost });
          }
        }
      }
    }
  }

  return { secondsTo };
}
