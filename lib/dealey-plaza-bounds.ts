import type { DealeyPlazaResponse } from "./api-types";

type DealeyPlazaPosition = {
  positionLat: number;
  positionLng: number;
};

const emptyDealeyPlazaBounds: DealeyPlazaResponse["bounds"] = {
  minLat: -0.0005,
  maxLat: 0.0005,
  minLng: -0.0005,
  maxLng: 0.0005,
};

export function computeDealeyPlazaBounds(
  positions: readonly DealeyPlazaPosition[],
): DealeyPlazaResponse["bounds"] {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let count = 0;

  for (const position of positions) {
    if (!Number.isFinite(position.positionLat) || !Number.isFinite(position.positionLng)) {
      continue;
    }
    count += 1;
    if (position.positionLat < minLat) minLat = position.positionLat;
    if (position.positionLat > maxLat) maxLat = position.positionLat;
    if (position.positionLng < minLng) minLng = position.positionLng;
    if (position.positionLng > maxLng) maxLng = position.positionLng;
  }

  if (count === 0) return emptyDealeyPlazaBounds;

  const padLat = (maxLat - minLat) * 0.08 || 0.0005;
  const padLng = (maxLng - minLng) * 0.08 || 0.0005;
  return {
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
    minLng: minLng - padLng,
    maxLng: maxLng + padLng,
  };
}
