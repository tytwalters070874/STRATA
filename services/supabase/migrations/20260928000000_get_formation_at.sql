-- ── get_formation_at ───────────────────────────────────────────────────────
-- Returns the geologic formation containing a GPS point, or no rows if the
-- point is outside MT/WY coverage. SECURITY INVOKER so the existing RLS policy
-- on geologic_formations (authenticated users only) still applies.
CREATE OR REPLACE FUNCTION public.get_formation_at(lat double precision, lng double precision)
RETURNS TABLE (
  id              uuid,
  name            text,
  map_unit_symbol text,
  geologic_age    text,
  age_ma_min      numeric,
  age_ma_max      numeric,
  rock_types      text[],
  description     text,
  source_url      text,
  state           text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    f.id,
    f.name,
    f.map_unit_symbol,
    f.geologic_age,
    f.age_ma_min,
    f.age_ma_max,
    f.rock_types,
    f.description,
    f.source_url,
    f.state
  FROM public.geologic_formations f
  WHERE ST_Contains(f.geometry, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
  -- Polygons should not overlap, but if they do (e.g. along the MT/WY seam),
  -- prefer the most specific one.
  ORDER BY ST_Area(f.geometry) ASC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_formation_at(double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_formation_at(double precision, double precision) TO authenticated;
