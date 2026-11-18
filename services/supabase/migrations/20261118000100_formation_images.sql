-- ── Example images per formation ───────────────────────────────────────────
-- Shown in the map sheet when a user taps a formation. Curated rows only:
-- the app never writes here. Each image keeps its source and licence so the
-- credit can be shown next to it.
CREATE TABLE public.formation_images (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id uuid NOT NULL REFERENCES public.geologic_formations(id) ON DELETE CASCADE,
  url          text NOT NULL,
  caption      text,
  credit       text,
  license      text,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_formation_images_formation
  ON public.formation_images (formation_id, sort_order);

ALTER TABLE public.formation_images ENABLE ROW LEVEL SECURITY;

-- Public reference data, like geologic_formations: readable by anyone, with no
-- write policies, so only the service role can change it.
CREATE POLICY "Anyone can read formation images"
  ON public.formation_images FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.formation_images TO anon, authenticated;
