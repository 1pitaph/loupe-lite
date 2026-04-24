import { useEffect, useRef } from 'react';
import { useMap } from 'react-map-gl/maplibre';

import { usePointsStore } from '@/stores/points-store';

const HIT_PX = 14;

interface MouseEventLike {
  point: { x: number; y: number };
  lngLat: { lng: number; lat: number };
  originalEvent: MouseEvent;
  preventDefault?: () => void;
}

export function useMapInteractions() {
  const { current: mapWrapper } = useMap();
  const dragRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mapWrapper) return;
    const map = mapWrapper.getMap();
    if (!map) return;

    const canvas = map.getCanvas();
    let rafId: number | null = null;
    let pending: { lng: number; lat: number } | null = null;

    const hitTestPoint = (e: MouseEventLike): string | null => {
      const { points } = usePointsStore.getState();
      let best: { id: string; d: number } | null = null;
      for (const p of points) {
        const proj = map.project([p.lng, p.lat]);
        const d = Math.hypot(e.point.x - proj.x, e.point.y - proj.y);
        if (d < HIT_PX && (best === null || d < best.d)) {
          best = { id: p.id, d };
        }
      }
      return best?.id ?? null;
    };

    const flushDrag = () => {
      rafId = null;
      const pos = pending;
      pending = null;
      const id = dragRef.current;
      if (!pos || !id) return;
      usePointsStore.getState().setPosition(id, pos.lng, pos.lat);
    };

    const onMouseDown = (e: MouseEventLike) => {
      const hitId = hitTestPoint(e);
      if (!hitId) return;
      dragRef.current = hitId;
      usePointsStore.getState().setActive(hitId);
      map.dragPan.disable();
      canvas.style.cursor = 'grabbing';
      e.originalEvent.preventDefault();
      e.originalEvent.stopPropagation();
    };

    const onMouseMove = (e: MouseEventLike) => {
      if (!dragRef.current) {
        const hover = hitTestPoint(e);
        canvas.style.cursor = hover ? 'grab' : '';
        return;
      }
      pending = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      if (rafId == null) rafId = requestAnimationFrame(flushDrag);
    };

    const onMouseUp = () => {
      if (!dragRef.current) return;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (pending) {
        usePointsStore
          .getState()
          .setPosition(dragRef.current, pending.lng, pending.lat);
        pending = null;
      }
      dragRef.current = null;
      map.dragPan.enable();
      canvas.style.cursor = '';
    };

    const onClick = (e: MouseEventLike) => {
      const hitId = hitTestPoint(e);
      if (hitId) {
        usePointsStore.getState().setActive(hitId);
        return;
      }
      usePointsStore.getState().add(e.lngLat.lng, e.lngLat.lat);
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        const { activeId, setActive } = usePointsStore.getState();
        if (activeId) setActive(null);
      } else if (ev.key === 'Delete' || ev.key === 'Backspace') {
        const { activeId, remove } = usePointsStore.getState();
        if (!activeId) return;
        const target = ev.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) return;
        remove(activeId);
        ev.preventDefault();
      }
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);
    map.on('click', onClick);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      map.off('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
      pending = null;
      map.dragPan.enable();
      canvas.style.cursor = '';
    };
  }, [mapWrapper]);
}
