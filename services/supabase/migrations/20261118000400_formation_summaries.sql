-- ── Plain-language formation summaries ────────────────────────────────────
-- PRD 3.1: a 2–3 sentence plain-English summary for each formation, shown
-- before the geologist's details. Written by AI from the formation's rock
-- types and Macrostrat's description and age, stored per formation name so
-- they work offline and cost nothing per tap. The app labels them as
-- AI-written until reviewed.
CREATE TABLE public.formation_summaries (
  formation_name text PRIMARY KEY,
  summary        text NOT NULL,
  how_it_formed  text,
  -- 'ai' until replaced by text from a definitive source.
  source         text NOT NULL DEFAULT 'ai',
  model          text,
  prompt_version text,
  reviewed       boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.formation_summaries ENABLE ROW LEVEL SECURITY;

-- Public reference data like geologic_formations: readable by anyone, no
-- write policies, so only the service role (the generator) writes.
CREATE POLICY "Anyone can read formation summaries"
  ON public.formation_summaries FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.formation_summaries TO anon, authenticated;

-- ── Work list for the generator ───────────────────────────────────────────
-- Formation names without a summary, each with one point inside one of its
-- polygons (for the Macrostrat lookup) and its rock types and rock class.
CREATE OR REPLACE FUNCTION public.formations_needing_summary(batch integer DEFAULT 20)
RETURNS TABLE (
  name         text,
  rock_types   text[],
  rock_class   text,
  lat          double precision,
  lng          double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT DISTINCT ON (f.name)
    f.name,
    f.rock_types,
    f.geologic_age AS rock_class,
    ST_Y(ST_PointOnSurface(f.geometry)) AS lat,
    ST_X(ST_PointOnSurface(f.geometry)) AS lng
  FROM public.geologic_formations f
  WHERE NOT EXISTS (
    SELECT 1 FROM public.formation_summaries s WHERE s.formation_name = f.name
  )
  -- One representative polygon per name: the largest, where Macrostrat's
  -- description is most likely to be for this unit.
  ORDER BY f.name, ST_Area(f.geometry) DESC
  LIMIT batch;
$$;

REVOKE EXECUTE ON FUNCTION public.formations_needing_summary(integer) FROM PUBLIC, anon, authenticated;
