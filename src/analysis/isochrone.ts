import { useEffect, useMemo, useState } from 'react';
import { gridDisk, latLngToCell } from 'h3-js';

import { NYC_GRAPH_URL } from '@/data/nyc';
import { usePointsStore } from '@/stores/points-store';
import { dijkstra, loadGraph, type HexGraph } from './hex-graph';
import type {
  IsochroneResult,
  IsochroneStats,
  ReachableCell,
  ReferencePoint,
} from './types';

// ---------------------------------------------------------------------------
// Origin-point → graph-node snap. We first try the exact containing cell; if
// that's outside the graph (e.g. user clicked water), we expand a small ring
// until we find a land cell. This gracefully handles clicks on piers and
// small harbor islands.
// ---------------------------------------------------------------------------
const MAX_SNAP_RING = 6;

function snapToGraph(graph: HexGraph, lng: number, lat: number): number | null {
  const exact = latLngToCell(lat, lng, graph.resolution);
  const direct = graph.idByCell.get(exact);
  if (direct !== undefined) return direct;
  for (let ring = 1; ring <= MAX_SNAP_RING; ring++) {
    const cells = gridDisk(exact, ring);
    for (const c of cells) {
      const id = graph.idByCell.get(c);
      if (id !== undefined) return id;
    }
  }
  return null;
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function computeCells(
  graph: HexGraph,
  points: ReferencePoint[],
): ReachableCell[] {
  // Union-by-shortest-time across visible reference points: each cell is
  // claimed by whichever origin reaches it fastest.
  const best = new Map<
    number,
    { minutes: number; pointId: string }
  >();

  for (const p of points) {
    if (!p.visible) continue;
    const origin = snapToGraph(graph, p.lng, p.lat);
    if (origin === null) continue;
    const { secondsTo } = dijkstra(
      graph,
      origin,
      p.transitMode,
      p.minutes * 60,
    );
    for (const [nodeId, seconds] of secondsTo) {
      const minutes = seconds / 60;
      const cur = best.get(nodeId);
      if (cur === undefined || minutes < cur.minutes) {
        best.set(nodeId, { minutes, pointId: p.id });
      }
    }
  }

  const out: ReachableCell[] = [];
  for (const [nodeId, { minutes, pointId }] of best) {
    out.push({ h3: graph.cellById[nodeId], minutes, pointId });
  }
  return out;
}

function statsFor(
  cells: ReachableCell[],
  graph: HexGraph | null,
  pointCount: number,
): IsochroneStats {
  if (cells.length === 0 || !graph) {
    return {
      pointCount,
      reachableCellCount: 0,
      reachableAreaKm2: 0,
      medianMinutes: 0,
      maxMinutes: 0,
    };
  }
  const minutes = cells.map((c) => c.minutes);
  return {
    pointCount,
    reachableCellCount: cells.length,
    reachableAreaKm2: cells.length * graph.cellAreaKm2,
    medianMinutes: medianOf(minutes),
    maxMinutes: minutes.reduce((a, b) => (b > a ? b : a), 0),
  };
}

// ---------------------------------------------------------------------------
// React hook: lazily loads the graph, recomputes on point changes.
// ---------------------------------------------------------------------------
export function useIsochrone(): IsochroneResult {
  const points = usePointsStore((s) => s.points);
  const [graph, setGraph] = useState<HexGraph | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGraph(NYC_GRAPH_URL)
      .then((g) => { if (!cancelled) setGraph(g); })
      .catch((err) => {
        if (!cancelled) setGraphError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, []);

  return useMemo(() => {
    if (!graph) {
      return {
        cells: [],
        stats: statsFor([], null, points.length),
        graphLoaded: false,
        loadError: graphError,
      };
    }
    const cells = computeCells(graph, points);
    return {
      cells,
      stats: statsFor(cells, graph, points.length),
      graphLoaded: true,
      loadError: null,
    };
  }, [graph, graphError, points]);
}
