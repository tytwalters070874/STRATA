import { useQuery } from '@tanstack/react-query';

import { PERSIST_MAX_AGE_MS } from '../lib/queryClient';

/**
 * Protected land at a point, from the agencies that own the boundaries:
 * - National Park Service units (parks, monuments, historic sites,
 *   battlefields): the NPS Land Resources Division boundary service.
 * - Tribal lands: the BIA American Indian and Alaska Native Land Area
 *   Representation (AIAN-LAR).
 * Both are public US government data. Wilderness and other federal lands are
 * not covered yet.
 *
 * The app shows only a generic notice, never specific rules.
 */
export interface ProtectedArea {
  name: string;
  /** e.g. "National Park", "National Monument", or "Tribal land". */
  kind: string;
}

const NPS =
  'https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer/2/query';
const BIA =
  'https://biamaps.geoplatform.gov/server/rest/services/DivLTR/BIA_AIAN_National_LAR/FeatureServer/0/query';
const TIMEOUT_MS = 10_000;

async function pointQuery<T>(url: string, lat: number, lng: number, fields: string): Promise<T[]> {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: fields,
    returnGeometry: 'false',
    f: 'json',
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${url}?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Boundary service answered ${response.status}`);
    const body = (await response.json()) as { features?: { attributes: T }[]; error?: { message?: string } };
    if (body.error) throw new Error(body.error.message ?? 'Boundary service error');
    return (body.features ?? []).map((f) => f.attributes);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchProtectedAreas(lat: number, lng: number): Promise<ProtectedArea[]> {
  const [nps, bia] = await Promise.allSettled([
    pointQuery<{ UNIT_NAME?: string; UNIT_TYPE?: string }>(NPS, lat, lng, 'UNIT_NAME,UNIT_TYPE'),
    pointQuery<{ LARNAME?: string }>(BIA, lat, lng, 'LARNAME'),
  ]);
  const areas: ProtectedArea[] = [];
  if (nps.status === 'fulfilled') {
    for (const unit of nps.value) {
      // The service names types in the plural ("National Parks"); show one unit's type.
      const kind = unit.UNIT_TYPE ? unit.UNIT_TYPE.replace(/s$/, '') : 'National Park Service land';
      if (unit.UNIT_NAME) areas.push({ name: unit.UNIT_NAME, kind });
    }
  }
  if (bia.status === 'fulfilled') {
    for (const land of bia.value) {
      if (land.LARNAME) areas.push({ name: land.LARNAME, kind: 'Tribal land' });
    }
  }
  // Both lookups failing is "unknown", not "unprotected": let the query error.
  if (nps.status === 'rejected' && bia.status === 'rejected') throw nps.reason;
  return areas;
}

/** Protected areas containing a point; an empty list when there are none. */
export function useProtectedArea(point: { lat: number; lng: number } | null) {
  // ~100 m: enough for boundaries, without sending a precise position.
  const lat = point == null ? null : Number(point.lat.toFixed(3));
  const lng = point == null ? null : Number(point.lng.toFixed(3));

  return useQuery({
    queryKey: ['protected-area', lat, lng],
    queryFn: () => fetchProtectedAreas(lat!, lng!),
    enabled: lat != null && lng != null,
    staleTime: Infinity,
    gcTime: PERSIST_MAX_AGE_MS,
    retry: 1,
  });
}
