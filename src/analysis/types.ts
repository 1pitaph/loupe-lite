export type LngLat = [number, number];

export type TransitMode = 'walk' | 'bike' | 'walk+subway' | 'walk+subway+bus';

export interface ReferencePoint {
  id: string;
  lng: number;
  lat: number;
  label: string;
  minutes: number;
  transitMode: TransitMode;
  visible: boolean;
  color: string;
}

export interface ReachableCell {
  h3: string;
  minutes: number;
  pointId: string;
}

export interface IsochroneStats {
  pointCount: number;
  reachableCellCount: number;
  reachableAreaKm2: number;
  medianMinutes: number;
  maxMinutes: number;
}

export interface IsochroneResult {
  cells: ReachableCell[];
  stats: IsochroneStats;
  graphLoaded: boolean;
  loadError: string | null;
}
