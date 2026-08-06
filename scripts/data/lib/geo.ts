/** Polygon centroid for ArcGIS rings (outer ring only). */
export function centroidOfRings(
  rings: number[][][] | undefined,
): { lat: number; lng: number } | null {
  if (!rings?.[0]?.length) return null;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const [x, y] of rings[0]) {
    if (typeof x !== "number" || typeof y !== "number") continue;
    sx += x;
    sy += y;
    n += 1;
  }
  if (!n) return null;
  // outSR=4326 → [lng, lat]
  return { lng: sx / n, lat: sy / n };
}

export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
