-- ── Public formation lookup ────────────────────────────────────────────────
-- geologic_formations is public USGS SGMC data, so signed-out users can read
-- it and call get_formation_at. Writes remain blocked (no write policies).
DROP POLICY IF EXISTS "All authenticated users read formations" ON public.geologic_formations;

CREATE POLICY "Anyone can read formations"
  ON public.geologic_formations FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT EXECUTE ON FUNCTION public.get_formation_at(double precision, double precision) TO anon;
