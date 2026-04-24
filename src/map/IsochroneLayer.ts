import { H3HexagonLayer } from '@deck.gl/geo-layers';
import type { Layer } from '@deck.gl/core';

import type { ReachableCell, ReferencePoint } from '@/analysis/types';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export type IsochroneColorMode = 'byPoint' | 'byTime';

// Time → color gradient (fast = saturated, slow = faded). Matches the
// single-tone blue blob in the reference image when viewed at a distance.
const TIME_STOPS: Array<{ t: number; rgb: [number, number, number] }> = [
  { t: 0.0, rgb: [30, 64, 175] }, // indigo-800
  { t: 0.5, rgb: [59, 130, 246] }, // blue-500
  { t: 1.0, rgb: [147, 197, 253] }, // blue-300
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function colorForTimeRatio(r: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, r));
  for (let i = 1; i < TIME_STOPS.length; i++) {
    const prev = TIME_STOPS[i - 1];
    const cur = TIME_STOPS[i];
    if (clamped <= cur.t) {
      const span = cur.t - prev.t;
      const local = span > 0 ? (clamped - prev.t) / span : 0;
      return [
        Math.round(lerp(prev.rgb[0], cur.rgb[0], local)),
        Math.round(lerp(prev.rgb[1], cur.rgb[1], local)),
        Math.round(lerp(prev.rgb[2], cur.rgb[2], local)),
      ];
    }
  }
  return TIME_STOPS[TIME_STOPS.length - 1].rgb;
}

export interface IsochroneLayerInput {
  cells: ReachableCell[];
  points: ReferencePoint[];
  colorMode: IsochroneColorMode;
  maxMinutes: number;
}

export function buildIsochroneLayers({
  cells,
  points,
  colorMode,
  maxMinutes,
}: IsochroneLayerInput): Layer[] {
  if (cells.length === 0) return [];

  const colorByPoint = new Map<string, [number, number, number]>();
  for (const p of points) colorByPoint.set(p.id, hexToRgb(p.color));

  const getFill = (c: ReachableCell): [number, number, number, number] => {
    if (colorMode === 'byPoint') {
      const rgb = colorByPoint.get(c.pointId) ?? [59, 130, 246];
      return [rgb[0], rgb[1], rgb[2], 120];
    }
    const r = maxMinutes > 0 ? c.minutes / maxMinutes : 0;
    const [rr, g, b] = colorForTimeRatio(r);
    return [rr, g, b, 160];
  };

  return [
    new H3HexagonLayer<ReachableCell>({
      id: 'isochrone-hexes',
      data: cells,
      getHexagon: (c) => c.h3,
      extruded: false,
      filled: true,
      stroked: true,
      coverage: 0.98,
      getFillColor: getFill,
      getLineColor: (c) => {
        const [r, g, b] = getFill(c);
        return [
          Math.max(0, r - 40),
          Math.max(0, g - 40),
          Math.max(0, b - 40),
          220,
        ];
      },
      lineWidthUnits: 'pixels',
      getLineWidth: 0.6,
      pickable: false,
      updateTriggers: {
        getFillColor: [colorMode, maxMinutes, points],
        getLineColor: [colorMode, maxMinutes, points],
      },
    }),
  ];
}
