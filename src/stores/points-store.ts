import { create } from 'zustand';
import type { ReferencePoint, TransitMode } from '@/analysis/types';

const POINT_COLORS = [
  '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

let colorIdx = 0;
function nextColor(): string {
  const c = POINT_COLORS[colorIdx % POINT_COLORS.length];
  colorIdx++;
  return c;
}

function generateId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_MINUTES = 20;
export const DEFAULT_TRANSIT_MODE: TransitMode = 'walk+subway';
export const MIN_MINUTES = 1;
export const MAX_MINUTES = 90;

interface PointsState {
  points: ReferencePoint[];
  activeId: string | null;
  add: (lng: number, lat: number) => string;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<ReferencePoint>) => void;
  setActive: (id: string | null) => void;
  setPosition: (id: string, lng: number, lat: number) => void;
  clear: () => void;
}

export const usePointsStore = create<PointsState>((set) => ({
  points: [],
  activeId: null,

  add: (lng, lat) => {
    const id = generateId();
    const newPoint: ReferencePoint = {
      id,
      lng,
      lat,
      label: '',
      minutes: DEFAULT_MINUTES,
      transitMode: DEFAULT_TRANSIT_MODE,
      visible: true,
      color: nextColor(),
    };
    set((s) => ({ points: [...s.points, newPoint], activeId: id }));
    return id;
  },

  remove: (id) =>
    set((s) => ({
      points: s.points.filter((p) => p.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
    })),

  update: (id, patch) =>
    set((s) => ({
      points: s.points.map((p) => {
        if (p.id !== id) return p;
        const merged = { ...p, ...patch };
        merged.minutes = Math.max(
          MIN_MINUTES,
          Math.min(MAX_MINUTES, merged.minutes),
        );
        return merged;
      }),
    })),

  setActive: (id) => set(() => ({ activeId: id })),

  setPosition: (id, lng, lat) =>
    set((s) => ({
      points: s.points.map((p) => (p.id === id ? { ...p, lng, lat } : p)),
    })),

  clear: () => set(() => ({ points: [], activeId: null })),
}));
