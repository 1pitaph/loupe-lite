import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { ReferencePoint } from '@/analysis/types';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function buildPointsLayers(
  points: ReferencePoint[],
  activeId: string | null,
): Layer[] {
  if (points.length === 0) return [];
  return [
    new ScatterplotLayer<ReferencePoint>({
      id: 'reference-points',
      data: points,
      getPosition: (p) => [p.lng, p.lat],
      getRadius: (p) => (p.id === activeId ? 9 : 7),
      radiusUnits: 'pixels',
      getFillColor: (p) => {
        const [r, g, b] = hexToRgb(p.color);
        return [r, g, b, p.visible ? 255 : 120];
      },
      getLineColor: (p) =>
        p.id === activeId ? [17, 24, 39, 255] : [255, 255, 255, 255],
      getLineWidth: (p) => (p.id === activeId ? 2.5 : 1.5),
      lineWidthUnits: 'pixels',
      stroked: true,
      filled: true,
      pickable: false,
    }),
    new TextLayer<ReferencePoint>({
      id: 'reference-points-labels',
      data: points.filter((p) => p.label.length > 0),
      getPosition: (p) => [p.lng, p.lat],
      getText: (p) => p.label,
      getSize: 11,
      getColor: [31, 41, 55, 220],
      getPixelOffset: [12, 0],
      getTextAnchor: 'start',
      getAlignmentBaseline: 'center',
      fontWeight: 600,
      background: true,
      backgroundPadding: [3, 2, 3, 2],
      getBackgroundColor: [255, 255, 255, 210],
    }),
  ];
}
