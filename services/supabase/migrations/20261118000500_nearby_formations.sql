-- ── Rocks nearby ───────────────────────────────────────────────────────────
-- PRD 3.1 nearby formation discovery: formations within a radius (default
-- 5 km) of a point, nearest first, one row per formation name, excluding the
-- formation the point is on. Each row has the distance and compass bearing to
-- the nearest edge of that formation, and that edge point, so the app can say
-- "Sandstone · 1.2 km NE" and move the map there.
CREATE OR REPLACE FUNCTION public.get_nearby_formations(
  lat double precision,
  lng double precision,
  radius_m double precision DEFAULT 5000,
  max_results integer DEFAULT 8
)
RETURNS TABLE (
  name            text,
  map_unit_symbol text,
  rock_types      text[],
  distance_m      double precision,
  bearing_deg     double precision,
  edge_lat        double precision,
  edge_lng        double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  WITH here AS (
    SELECT ST_SetSRID(ST_MakePoint(lng, lat), 4326) AS g
  ),
  candidates AS (
    SELECT
      f.name,
      f.map_unit_symbol,
      f.rock_types,
      ST_ClosestPoint(f.geometry, here.g) AS edge,
      ST_Distance(f.geometry::geography, here.g::geography) AS distance_m
    FROM public.geologic_formations f, here
    -- Index-assisted box in degrees, a little larger than the radius
    -- (longitude degrees shrink with latitude), then exact distance below.
    WHERE f.geometry && ST_Expand(here.g, radius_m / (111320 * cos(radians(lat))) * 1.1)
  ),
  nearest AS (
    SELECT DISTINCT ON (c.name) c.*
    FROM candidates c
    WHERE c.distance_m > 0 AND c.distance_m <= radius_m
    ORDER BY c.name, c.distance_m
  )
  SELECT
    n.name,
    n.map_unit_symbol,
    n.rock_types,
    n.distance_m,
    degrees(ST_Azimuth((SELECT g FROM here), n.edge)) AS bearing_deg,
    ST_Y(n.edge) AS edge_lat,
    ST_X(n.edge) AS edge_lng
  FROM nearest n
  -- The formation under the point itself is shown separately.
  WHERE n.name NOT IN (
    SELECT f.name FROM public.geologic_formations f, here WHERE ST_Contains(f.geometry, here.g)
  )
  ORDER BY n.distance_m
  LIMIT max_results;
$$;

REVOKE EXECUTE ON FUNCTION public.get_nearby_formations(double precision, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearby_formations(double precision, double precision, double precision, integer) TO anon, authenticated;
