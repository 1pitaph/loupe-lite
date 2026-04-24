export function formatAreaKm2(m2: number): string {
  if (m2 <= 0) return '0 km²';
  const km2 = m2 / 1_000_000;
  if (km2 < 0.01) {
    const m = Math.round(m2);
    return `${m.toLocaleString()} m²`;
  }
  if (km2 < 10) return `${km2.toFixed(2)} km²`;
  if (km2 < 1000) return `${km2.toFixed(1)} km²`;
  return `${Math.round(km2).toLocaleString()} km²`;
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export function formatDistanceMeters(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return '0 m';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export function formatMinutes(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return '0 min';
  if (min < 1) return `${(min * 60).toFixed(0)} s`;
  if (min < 10) return `${min.toFixed(1)} min`;
  return `${Math.round(min)} min`;
}

export function formatLngLat(lng: number, lat: number): string {
  return `${lng.toFixed(4)}, ${lat.toFixed(4)}`;
}
