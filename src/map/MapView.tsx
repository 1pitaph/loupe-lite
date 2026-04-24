import { useMemo } from 'react';
import {
  AttributionControl,
  Map as MapGL,
  NavigationControl,
  useControl,
} from 'react-map-gl/maplibre';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import type { Layer } from '@deck.gl/core';
import 'maplibre-gl/dist/maplibre-gl.css';

import { BASE_STYLE_URL, INITIAL_VIEW } from '@/data/tile-sources';
import { usePointsStore } from '@/stores/points-store';
import { useUIStore } from '@/stores/ui-store';
import { useIsochrone } from '@/analysis/isochrone';
import { useMapInteractions } from './interactions';
import { buildPointsLayers } from './PointsLayer';
import { buildIsochroneLayers } from './IsochroneLayer';

function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

function InteractionsBinder() {
  useMapInteractions();
  return null;
}

export function MapView() {
  const points = usePointsStore((s) => s.points);
  const activeId = usePointsStore((s) => s.activeId);
  const isochroneEnabled = useUIStore((s) => s.isochroneEnabled);
  const colorMode = useUIStore((s) => s.colorMode);
  const iso = useIsochrone();

  const layers = useMemo(() => {
    const list: Layer[] = [];
    if (isochroneEnabled) {
      list.push(
        ...buildIsochroneLayers({
          cells: iso.cells,
          points,
          colorMode,
          maxMinutes: Math.max(1, iso.stats.maxMinutes),
        }),
      );
    }
    list.push(...buildPointsLayers(points, activeId));
    return list;
  }, [isochroneEnabled, iso.cells, iso.stats.maxMinutes, points, activeId, colorMode]);

  return (
    <MapGL
      initialViewState={INITIAL_VIEW}
      mapStyle={BASE_STYLE_URL}
      style={{ width: '100%', height: '100%' }}
      attributionControl={false}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <AttributionControl position="bottom-left" compact />
      <DeckGLOverlay layers={layers} interleaved={false} />
      <InteractionsBinder />
    </MapGL>
  );
}
