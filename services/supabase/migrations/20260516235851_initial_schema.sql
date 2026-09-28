-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── users ──────────────────────────────────────────────────────────────────
-- Managed by Supabase Auth; this table extends auth.users
CREATE TABLE public.users (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text UNIQUE NOT NULL,
  display_name  text,
  auth_provider text,
  created_at    timestamptz DEFAULT now(),
  last_seen_at  timestamptz,
  preferences   jsonb DEFAULT '{}'::jsonb
);

-- ── geologic_formations ────────────────────────────────────────────────────
CREATE TABLE public.geologic_formations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  map_unit_symbol  text,
  geologic_age     text,
  age_ma_min       numeric,
  age_ma_max       numeric,
  rock_types       text[],
  description      text,
  source_url       text,
  state            text,   -- MT | WY | BOTH
  geometry         geometry(MultiPolygon, 4326),
  attributes       jsonb DEFAULT '{}'::jsonb
);

-- ── prompt_versions ────────────────────────────────────────────────────────
CREATE TABLE public.prompt_versions (
  version       text PRIMARY KEY,
  system_prompt text NOT NULL,
  model         text NOT NULL,
  ai_provider   text NOT NULL,  -- anthropic | openai
  is_active     boolean DEFAULT false,
  deployed_at   timestamptz DEFAULT now(),
  notes         text
);

-- ── identifications ────────────────────────────────────────────────────────
CREATE TABLE public.identifications (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  photo_url            text,
  photo_hash           text,
  location             geometry(Point, 4326),
  location_accuracy_m  numeric,
  formation_id         uuid REFERENCES public.geologic_formations(id),
  confidence_score     numeric(4,3) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  confidence_tier      text CHECK (confidence_tier IN ('high','moderate','low')),
  ai_response_raw      jsonb,
  prompt_version       text REFERENCES public.prompt_versions(version),
  ai_provider          text,
  alternate_formations jsonb DEFAULT '[]'::jsonb,
  offline_queued       boolean DEFAULT false,
  status               text DEFAULT 'pending' CHECK (status IN ('pending','complete','failed')),
  created_at           timestamptz DEFAULT now(),
  completed_at         timestamptz
);

-- ── catalog_entries ────────────────────────────────────────────────────────
CREATE TABLE public.catalog_entries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  identification_id     uuid REFERENCES public.identifications(id),
  formation_id          uuid REFERENCES public.geologic_formations(id),
  user_notes            text,
  voice_note_url        text,
  voice_note_transcript text,
  custom_label          text,
  is_deleted            boolean DEFAULT false,
  saved_at              timestamptz DEFAULT now(),
  location_snapshot     geometry(Point, 4326)
);

-- ── identification_flags ───────────────────────────────────────────────────
CREATE TABLE public.identification_flags (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identification_id uuid NOT NULL REFERENCES public.identifications(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason            text NOT NULL,
  note              text,
  created_at        timestamptz DEFAULT now(),
  reviewed_at       timestamptz
);

-- ── offline_regions ────────────────────────────────────────────────────────
CREATE TABLE public.offline_regions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  region_name text NOT NULL,
  bbox        geometry(Polygon, 4326),
  cached_at   timestamptz DEFAULT now(),
  size_bytes  bigint DEFAULT 0
);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX idx_formations_geom
  ON public.geologic_formations USING GIST (geometry);

CREATE INDEX idx_identifications_loc
  ON public.identifications USING GIST (location);

CREATE INDEX idx_catalog_user
  ON public.catalog_entries (user_id)
  WHERE NOT is_deleted;

CREATE INDEX idx_identifications_user
  ON public.identifications (user_id, created_at DESC);

CREATE INDEX idx_catalog_location
  ON public.catalog_entries USING GIST (location_snapshot);

CREATE INDEX idx_id_provider
  ON public.identifications (ai_provider, prompt_version);

CREATE INDEX idx_id_offline
  ON public.identifications (offline_queued)
  WHERE offline_queued = true;

-- ── Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identification_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_regions     ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "Users read own profile"
  ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users update own profile"
  ON public.users FOR UPDATE USING (id = auth.uid());

-- identifications
CREATE POLICY "Users read own identifications"
  ON public.identifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own identifications"
  ON public.identifications FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own identifications"
  ON public.identifications FOR UPDATE USING (user_id = auth.uid());

-- catalog_entries
CREATE POLICY "Users read own catalog"
  ON public.catalog_entries FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own catalog"
  ON public.catalog_entries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own catalog"
  ON public.catalog_entries FOR UPDATE USING (user_id = auth.uid());

-- identification_flags
CREATE POLICY "Users read own flags"
  ON public.identification_flags FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own flags"
  ON public.identification_flags FOR INSERT WITH CHECK (user_id = auth.uid());

-- offline_regions
CREATE POLICY "Users read own regions"
  ON public.offline_regions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own regions"
  ON public.offline_regions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own regions"
  ON public.offline_regions FOR DELETE USING (user_id = auth.uid());

-- geologic_formations — read only for all authenticated users
CREATE POLICY "All authenticated users read formations"
  ON public.geologic_formations FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE public.geologic_formations ENABLE ROW LEVEL SECURITY;
