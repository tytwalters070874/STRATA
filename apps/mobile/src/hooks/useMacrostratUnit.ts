import { useQuery } from '@tanstack/react-query';

import { PERSIST_MAX_AGE_MS } from '../lib/queryClient';

/**
 * Unit details from Macrostrat (CC BY 4.0, free, no key), which the PRD names
 * as a source. The imported formation table has names, map units and rock
 * types, but no ages, descriptions or source links, so those come from here.
 */
export interface MacrostratUnit {
  name: string;
  description: string | null;
  /** e.g. "Eocene", or "Miocene–Pliocene" when the unit spans periods. */
  period: string | null;
  /** Youngest and oldest age of the unit, in millions of years. */
  ageMa: { min: number; max: number } | null;
  lithology: string | null;
  /** Environments of deposition, e.g. "floodplain", "alluvial fan". */
  environments: string[];
  sourceUrl: string;
}

const API = 'https://macrostrat.org/api/v2';
const TIMEOUT_MS = 10_000;
// Larger-scale maps describe the ground in more detail.
const SCALE_ORDER = ['large', 'medium', 'small', 'tiny'];

interface MapUnit {
  name: string;
  descrip: string;
  lith: string;
  best_int_name: string | null;
  b_int_name: string;
  t_int_name: string;
  b_age: number;
  t_age: number;
  scale: string;
  macro_units: number[];
}

interface UnitRecord {
  environ?: { name: string }[];
}

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Macrostrat answered ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** "Major:{andesite,dacite}" → "andesite, dacite". */
function cleanLithology(lith: string): string | null {
  const text = lith
    .replace(/(Major|Minor):\{([^}]*)\}/g, '$2')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
  return text || null;
}

function pickUnit(units: MapUnit[]): MapUnit | null {
  const sorted = [...units].sort(
    (a, b) => SCALE_ORDER.indexOf(a.scale) - SCALE_ORDER.indexOf(b.scale),
  );
  return sorted.find((unit) => unit.descrip?.trim()) ?? sorted.find((unit) => unit.name?.trim()) ?? null;
}

async function fetchMacrostratUnit(lat: number, lng: number): Promise<MacrostratUnit | null> {
  const map = await getJson<{ success?: { data?: MapUnit[] } }>(
    `${API}/geologic_units/map?lat=${lat}&lng=${lng}&format=json`,
  );
  const unit = pickUnit(map.success?.data ?? []);
  if (!unit) return null;

  // Environments live on the stratigraphic units the map unit belongs to.
  // Optional: a failure here still leaves the description and age.
  let environments: string[] = [];
  const unitIds = unit.macro_units.slice(0, 5);
  if (unitIds.length > 0) {
    try {
      const units = await getJson<{ success?: { data?: UnitRecord[] } }>(
        `${API}/units?unit_id=${unitIds.join(',')}&response=long&format=json`,
      );
      const names = (units.success?.data ?? []).flatMap((u) => (u.environ ?? []).map((e) => e.name));
      environments = [...new Set(names.filter((n) => n && !n.endsWith('indet.')))].slice(0, 4);
    } catch {
      environments = [];
    }
  }

  const period =
    unit.best_int_name ??
    (unit.b_int_name === unit.t_int_name ? unit.b_int_name : `${unit.b_int_name}–${unit.t_int_name}`);

  return {
    name: unit.name,
    description: unit.descrip?.trim() || null,
    period: period || null,
    ageMa: Number.isFinite(unit.t_age) && Number.isFinite(unit.b_age) ? { min: unit.t_age, max: unit.b_age } : null,
    lithology: cleanLithology(unit.lith ?? ''),
    environments,
    sourceUrl: `https://macrostrat.org/map/loc/${lng}/${lat}`,
  };
}

/** Macrostrat details for a map point; null when Macrostrat has nothing there. */
export function useMacrostratUnit(point: { lat: number; lng: number } | null) {
  const lat = point == null ? null : Number(point.lat.toFixed(4));
  const lng = point == null ? null : Number(point.lng.toFixed(4));

  return useQuery({
    queryKey: ['macrostrat', lat, lng],
    queryFn: () => fetchMacrostratUnit(lat!, lng!),
    enabled: lat != null && lng != null,
    staleTime: Infinity,
    gcTime: PERSIST_MAX_AGE_MS,
    retry: 1,
  });
}
