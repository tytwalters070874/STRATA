-- ── Faster row-level security ─────────────────────────────────────────────
-- A bare auth.uid() in a policy is re-evaluated for every row scanned.
-- Wrapped in a sub-select, Postgres evaluates it once per statement (an
-- "initplan"), as Supabase's performance advisor recommends. Same rules,
-- same results; only the evaluation changes.

-- users
ALTER POLICY "Users read own profile" ON public.users
  USING (id = (SELECT auth.uid()));
ALTER POLICY "Users update own profile" ON public.users
  USING (id = (SELECT auth.uid()));

-- identifications (read-only for clients since 20261116000000)
ALTER POLICY "Users read own identifications" ON public.identifications
  USING (user_id = (SELECT auth.uid()));

-- catalog_entries
ALTER POLICY "Users read own catalog" ON public.catalog_entries
  USING (user_id = (SELECT auth.uid()));
ALTER POLICY "Users insert own catalog" ON public.catalog_entries
  WITH CHECK (user_id = (SELECT auth.uid()));
ALTER POLICY "Users update own catalog" ON public.catalog_entries
  USING (user_id = (SELECT auth.uid()));

-- identification_flags
ALTER POLICY "Users read own flags" ON public.identification_flags
  USING (user_id = (SELECT auth.uid()));
ALTER POLICY "Users insert own flags" ON public.identification_flags
  WITH CHECK (user_id = (SELECT auth.uid()));

-- offline_regions
ALTER POLICY "Users read own regions" ON public.offline_regions
  USING (user_id = (SELECT auth.uid()));
ALTER POLICY "Users insert own regions" ON public.offline_regions
  WITH CHECK (user_id = (SELECT auth.uid()));
ALTER POLICY "Users delete own regions" ON public.offline_regions
  USING (user_id = (SELECT auth.uid()));

-- rock-photos bucket
ALTER POLICY "Users upload own rock photos" ON storage.objects
  WITH CHECK (bucket_id = 'rock-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
ALTER POLICY "Users read own rock photos" ON storage.objects
  USING (bucket_id = 'rock-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
ALTER POLICY "Users delete own rock photos" ON storage.objects
  USING (bucket_id = 'rock-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- ── Missing index ─────────────────────────────────────────────────────────
-- The app checks "is this identification already saved?" by
-- identification_id, and deleting identifications checks this foreign key.
CREATE INDEX IF NOT EXISTS idx_catalog_identification
  ON public.catalog_entries (identification_id);

-- Planner statistics for the large formation table (estimates read 0 rows).
ANALYZE public.geologic_formations;
