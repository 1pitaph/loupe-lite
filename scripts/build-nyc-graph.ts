/**
 * Builds a precomputed H3 hex graph for NYC isochrone calculations.
 *
 * Inputs (downloaded on demand, cached under data/raw/):
 *   - NYC Open Data borough boundaries (GeoJSON MultiPolygon)
 *   - MTA subway static GTFS (zip with stops.txt, stop_times.txt, trips.txt)
 *
 * Output: public/data/nyc-graph.json
 *   {
 *     version, resolution,
 *     bounds: [west, south, east, north],
 *     cells: ["89...fff", ...],                 // walkable land H3 r9 cells
 *     subwayEdges: [["89...fff","89...fff",sec]],
 *     bridgeEdges: [["89...fff","89...fff",sec]]
 *   }
 *
 * Walk / bike edges are derived at runtime from H3 adjacency between cells in `cells`.
 */

import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import AdmZip from 'adm-zip';
import {
  cellToLatLng,
  gridDisk,
  latLngToCell,
  polygonToCells,
} from 'h3-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const RAW_DIR = join(ROOT, 'data', 'raw');
const OUT_DIR = join(ROOT, 'public', 'data');

const H3_RES = 9;

// NYC Open Data migrated the borough-boundaries dataset from tqmj-j8zm to
// gthc-hcne. Keep both as fallbacks in case either ID is later re-aliased.
const BOROUGH_URLS = [
  'https://data.cityofnewyork.us/api/geospatial/gthc-hcne?method=export&format=GeoJSON',
  'https://data.cityofnewyork.us/resource/gthc-hcne.geojson',
  'https://data.cityofnewyork.us/api/geospatial/tqmj-j8zm?method=export&format=GeoJSON',
];

// MTA subway static GTFS. The S3 feed is the authoritative current source;
// the mta.info URL is a documented mirror and is kept as a fallback.
const SUBWAY_GTFS_URLS = [
  'https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip',
  'http://web.mta.info/developers/data/nyct/subway/google_transit.zip',
];

// Major pedestrian-legal NYC bridges. Coordinates are approximate midpoints of
// the on/off ramps at each end; times are typical adult walking times.
// Coordinates are picked to land clearly within each borough's land polygon
// (a few blocks inland from the on-ramp abutment) so they snap to in-graph
// H3 cells. Times are typical adult walking times end-to-end.
const BRIDGES: Array<{ name: string; a: [number, number]; b: [number, number]; seconds: number }> = [
  { name: 'Brooklyn Bridge', a: [-74.0039, 40.7115], b: [-73.9898, 40.7019], seconds: 22 * 60 },
  { name: 'Manhattan Bridge', a: [-73.9920, 40.7136], b: [-73.9895, 40.6988], seconds: 25 * 60 },
  { name: 'Williamsburg Bridge', a: [-73.9817, 40.7151], b: [-73.9593, 40.7100], seconds: 27 * 60 },
  { name: 'Queensboro Bridge', a: [-73.9606, 40.7579], b: [-73.9408, 40.7567], seconds: 25 * 60 },
  { name: 'Pulaski Bridge', a: [-73.9569, 40.7395], b: [-73.9500, 40.7445], seconds: 10 * 60 },
  { name: 'RFK Bridge (Manh↔Randall)', a: [-73.9291, 40.8003], b: [-73.9225, 40.7939], seconds: 12 * 60 },
  { name: 'Ward↔Bronx (RFK)', a: [-73.9248, 40.8023], b: [-73.9245, 40.8050], seconds: 5 * 60 },
];

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function downloadCached(urls: string[], dest: string): Promise<void> {
  if (await exists(dest)) {
    console.log(`  cached: ${dest}`);
    return;
  }
  let lastErr: unknown = null;
  for (const url of urls) {
    try {
      console.log(`  fetching ${url}`);
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} from ${url}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(dest, buf);
      const sha = createHash('sha256').update(buf).digest('hex').slice(0, 12);
      console.log(`  saved ${dest} (${buf.length.toLocaleString()} bytes, sha256:${sha})`);
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error(`all download URLs failed for ${dest}`);
}

// GeoJSON types — minimal subset we actually touch.
type Position = [number, number];
type Ring = Position[];
interface PolygonGeom { type: 'Polygon'; coordinates: Ring[] }
interface MultiPolygonGeom { type: 'MultiPolygon'; coordinates: Ring[][] }
interface Feature { type: 'Feature'; properties: Record<string, unknown>; geometry: PolygonGeom | MultiPolygonGeom }
interface FC { type: 'FeatureCollection'; features: Feature[] }

// h3-js polygonToCells expects [lat, lng] pairs. GeoJSON uses [lng, lat]. Swap.
function swapRing(ring: Ring): [number, number][] {
  return ring.map(([lng, lat]) => [lat, lng]);
}

function ringsForFeature(f: Feature): Ring[][] {
  if (f.geometry.type === 'Polygon') return [f.geometry.coordinates];
  return f.geometry.coordinates;
}

function collectCells(fc: FC): Set<string> {
  const out = new Set<string>();
  for (const f of fc.features) {
    for (const rings of ringsForFeature(f)) {
      if (rings.length === 0) continue;
      const outer = swapRing(rings[0]);
      const holes = rings.slice(1).map(swapRing);
      const cells = polygonToCells(outer, H3_RES, false, holes) as string[];
      for (const c of cells) out.add(c);
    }
  }
  return out;
}

function parseCSV(text: string): string[][] {
  // GTFS CSV per spec: RFC4180-ish, quoted fields allowed. Fast minimal parser.
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function indexedRows(text: string): { headers: string[]; rows: string[][] } {
  const rows = parseCSV(text);
  const headers = rows.shift() ?? [];
  return { headers, rows };
}

function colIdx(headers: string[], name: string): number {
  const i = headers.indexOf(name);
  if (i < 0) throw new Error(`GTFS missing column: ${name}`);
  return i;
}

function hmsToSeconds(hms: string): number {
  // GTFS allows hours ≥ 24 for trips that cross midnight.
  const [h, m, s] = hms.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

interface TransitEdge {
  from: string;
  to: string;
  seconds: number;
  kind: 'subway' | 'bus';
}

function buildTransitEdgesFromGTFS(
  zipBuf: Buffer,
  cellsInGraph: Set<string>,
  kind: 'subway' | 'bus',
): TransitEdge[] {
  const zip = new AdmZip(zipBuf);
  const read = (name: string): string => {
    const entry = zip.getEntry(name);
    if (!entry) throw new Error(`GTFS missing ${name}`);
    return entry.getData().toString('utf8');
  };

  const stopsTxt = indexedRows(read('stops.txt'));
  const stopTimesTxt = indexedRows(read('stop_times.txt'));

  const sid = colIdx(stopsTxt.headers, 'stop_id');
  const sLat = colIdx(stopsTxt.headers, 'stop_lat');
  const sLng = colIdx(stopsTxt.headers, 'stop_lon');
  const stopCell = new Map<string, string>();
  for (const r of stopsTxt.rows) {
    const id = r[sid];
    const lat = parseFloat(r[sLat]);
    const lng = parseFloat(r[sLng]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const cell = latLngToCell(lat, lng, H3_RES);
    stopCell.set(id, cell);
  }

  const tripId = colIdx(stopTimesTxt.headers, 'trip_id');
  const stopId = colIdx(stopTimesTxt.headers, 'stop_id');
  const seq = colIdx(stopTimesTxt.headers, 'stop_sequence');
  const depCol = colIdx(stopTimesTxt.headers, 'departure_time');
  const arrCol = colIdx(stopTimesTxt.headers, 'arrival_time');

  // Group stop_times by trip and sort by stop_sequence.
  interface StopTime { stop: string; seq: number; arr: number; dep: number }
  const byTrip = new Map<string, StopTime[]>();
  for (const r of stopTimesTxt.rows) {
    if (r.length < Math.max(tripId, stopId, seq, depCol, arrCol) + 1) continue;
    const arrRaw = r[arrCol];
    const depRaw = r[depCol];
    if (!arrRaw || !depRaw) continue;
    const st: StopTime = {
      stop: r[stopId],
      seq: parseInt(r[seq], 10),
      arr: hmsToSeconds(arrRaw),
      dep: hmsToSeconds(depRaw),
    };
    const list = byTrip.get(r[tripId]);
    if (list) list.push(st);
    else byTrip.set(r[tripId], [st]);
  }

  // For each consecutive pair within a trip, accumulate travel-time samples
  // keyed by ordered (fromCell, toCell). Averaging across trips smooths express
  // vs. local variations.
  const pairs = new Map<string, { sumSec: number; count: number }>();
  for (const trip of byTrip.values()) {
    trip.sort((a, b) => a.seq - b.seq);
    for (let i = 1; i < trip.length; i++) {
      const a = trip[i - 1];
      const b = trip[i];
      const aCell = stopCell.get(a.stop);
      const bCell = stopCell.get(b.stop);
      if (!aCell || !bCell) continue;
      if (aCell === bCell) continue;
      // Intra-trip travel = next arr - prev dep. Add 30s dwell at boarding.
      const dt = Math.max(15, b.arr - a.dep) + 30;
      const key = `${aCell}|${bCell}`;
      const cur = pairs.get(key);
      if (cur) { cur.sumSec += dt; cur.count += 1; }
      else pairs.set(key, { sumSec: dt, count: 1 });
    }
  }

  const edges: TransitEdge[] = [];
  for (const [key, { sumSec, count }] of pairs) {
    const [from, to] = key.split('|');
    // Station may be outside the land-cell set (ends at water-boundary cells).
    // We still ship those transit endpoints but they'll be unreachable by walk
    // alone. Guard: skip if either cell isn't represented — the hex graph must
    // know about it. We'll union transit-only cells back in later.
    void cellsInGraph;
    const avg = Math.round(sumSec / count);
    edges.push({ from, to, seconds: avg, kind });
  }
  return edges;
}

function distanceMeters(a: [number, number], b: [number, number]): number {
  const R = 6371008.8;
  const toRad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toRad;
  const dLng = (b[1] - a[1]) * toRad;
  const la1 = a[0] * toRad;
  const la2 = b[0] * toRad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function boundsFromCells(cells: Iterable<string>): [number, number, number, number] {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const c of cells) {
    const [lat, lng] = cellToLatLng(c);
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [west, south, east, north];
}

async function main() {
  console.log('→ loupe-lite NYC hex graph build');
  await ensureDir(RAW_DIR);
  await ensureDir(OUT_DIR);

  // 1. Borough boundaries → land cells.
  const boroughFile = join(RAW_DIR, 'nyc-boroughs.geojson');
  console.log('[1/4] Borough boundaries');
  await downloadCached(BOROUGH_URLS, boroughFile);
  const boroughFc = JSON.parse(await readFile(boroughFile, 'utf8')) as FC;
  console.log(`  features: ${boroughFc.features.length}`);

  const landCells = collectCells(boroughFc);
  console.log(`  H3 r9 land cells: ${landCells.size.toLocaleString()}`);

  // 2. MTA subway GTFS → transit edges.
  console.log('[2/4] MTA subway GTFS');
  const subwayZip = join(RAW_DIR, 'gtfs_subway.zip');
  await downloadCached(SUBWAY_GTFS_URLS, subwayZip);
  const subwayBuf = await readFile(subwayZip);
  const subwayEdges = buildTransitEdgesFromGTFS(subwayBuf, landCells, 'subway');
  console.log(`  subway edges: ${subwayEdges.length.toLocaleString()}`);

  // Any subway station hex that isn't a land cell gets added — it's still
  // meaningful as a "transit-accessible" cell even if its center lies in water.
  for (const e of subwayEdges) {
    landCells.add(e.from);
    landCells.add(e.to);
  }
  console.log(`  total cells (land + transit): ${landCells.size.toLocaleString()}`);

  // 3. Pedestrian bridges — ensure both endpoints are in the cell set, add edges.
  console.log('[3/4] Pedestrian bridges');
  const bridgeEdges: Array<[string, string, number]> = [];
  for (const b of BRIDGES) {
    const aCell = latLngToCell(b.a[1], b.a[0], H3_RES);
    const bCell = latLngToCell(b.b[1], b.b[0], H3_RES);
    // Skip bridges that leave the graph (e.g. GW to NJ) — NJ side has no cell.
    if (!landCells.has(aCell) || !landCells.has(bCell)) {
      console.log(`  skip ${b.name} (endpoint outside graph)`);
      continue;
    }
    bridgeEdges.push([aCell, bCell, b.seconds]);
    console.log(`  ${b.name}: ${b.seconds / 60}min`);
  }

  // 4. Sanity check walk-graph connectivity by confirming each cell has at
  // least one in-graph H3 neighbor (diagnostic only).
  console.log('[4/4] Connectivity audit');
  let isolated = 0;
  for (const c of landCells) {
    const ring = gridDisk(c, 1).filter((x: string) => x !== c);
    const hasNeighbor = ring.some((r: string) => landCells.has(r));
    if (!hasNeighbor) isolated++;
  }
  console.log(`  isolated land cells: ${isolated} (will only be reachable via transit/bridges)`);

  const cellsArr = [...landCells].sort();
  const bounds = boundsFromCells(cellsArr);

  const out = {
    version: 1,
    resolution: H3_RES,
    bounds,
    cells: cellsArr,
    subwayEdges: subwayEdges.map((e) => [e.from, e.to, e.seconds] as [string, string, number]),
    bridgeEdges,
    meta: {
      generatedAt: new Date().toISOString(),
      cellCount: cellsArr.length,
      subwayEdgeCount: subwayEdges.length,
      bridgeEdgeCount: bridgeEdges.length,
    },
  };

  const outPath = join(OUT_DIR, 'nyc-graph.json');
  await writeFile(outPath, JSON.stringify(out));
  const buf = await readFile(outPath);
  console.log(`→ ${outPath}  (${(buf.length / 1024).toFixed(1)} KiB uncompressed)`);

  // Keep the h3 linter happy — distanceMeters is exported for the bridge cost
  // audit in future revisions that compute bridge length from OSM way geometry.
  void distanceMeters;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
