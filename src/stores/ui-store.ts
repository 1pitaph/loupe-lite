import { create } from 'zustand';

import type { IsochroneColorMode } from '@/map/IsochroneLayer';

interface UIState {
  isochroneEnabled: boolean;
  colorMode: IsochroneColorMode;

  setIsochroneEnabled: (enabled: boolean) => void;
  setColorMode: (mode: IsochroneColorMode) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isochroneEnabled: true,
  colorMode: 'byPoint',

  setIsochroneEnabled: (enabled) => set({ isochroneEnabled: enabled }),
  setColorMode: (mode) => set({ colorMode: mode }),
}));
