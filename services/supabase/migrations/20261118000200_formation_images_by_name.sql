-- ── Formation images keyed by formation name ───────────────────────────────
-- geologic_formations stores one row per map polygon, so a formation has many
-- ids. Images keyed by row id would miss most polygons; keyed by name they
-- apply to every polygon of the formation. The table was created minutes
-- earlier and holds no rows, so it is rebuilt.
DROP TABLE IF EXISTS public.formation_images;

CREATE TABLE public.formation_images (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_name text NOT NULL,
  url            text NOT NULL,
  caption        text,
  credit         text,
  license        text,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_formation_images_name
  ON public.formation_images (formation_name, sort_order);

ALTER TABLE public.formation_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read formation images"
  ON public.formation_images FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.formation_images TO anon, authenticated;

-- ── Seed: USGS photo of Absaroka volcaniclastic units ─────────────────────
-- USGS page: marked Public Domain; credit Natali Kragh, Montana State
-- University, 9 July 2020. Applied to the Absaroka names in the MT and WY
-- data (the photo shows the volcanic units of the NE Yellowstone area).
INSERT INTO public.formation_images (formation_name, url, caption, credit, license, sort_order)
SELECT DISTINCT
  f.name,
  'https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/media/images/YNP200709-003-P3.jpg',
  'Volcaniclastic sandstone and conglomerate layers, Absaroka volcanic province, NE Yellowstone',
  'Natali Kragh, Montana State University / USGS',
  'Public Domain (USGS)',
  0
FROM public.geologic_formations f
WHERE f.name = 'Absaroka Volcanics Supergroup'
   OR f.name LIKE 'Absaroka Volcanic Supergroup%';
