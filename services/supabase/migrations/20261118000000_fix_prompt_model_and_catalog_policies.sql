-- ── Fix the active prompt's model id ───────────────────────────────────────
-- The seed row named 'claude-sonnet-5', which is not the current Sonnet 5.5
-- model id. A wrong id makes every Anthropic call fail and silently routes all
-- identifications to the OpenAI fallback. Only the seeded value is changed.
UPDATE public.prompt_versions
SET model = 'claude-sonnet-5-5'
WHERE version = 'rock-id-v1' AND model = 'claude-sonnet-5';

-- ── Catalog entries must reference the caller's own identification ─────────
-- The insert/update policies only checked user_id, so a client could point an
-- entry at another user's identification UUID. The subquery runs under the
-- caller's RLS, so it finds only the caller's own identifications.
DROP POLICY IF EXISTS "Users insert own catalog" ON public.catalog_entries;
DROP POLICY IF EXISTS "Users update own catalog" ON public.catalog_entries;

CREATE POLICY "Users insert own catalog"
  ON public.catalog_entries FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      identification_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.identifications i
        WHERE i.id = identification_id AND i.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Users update own catalog"
  ON public.catalog_entries FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      identification_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.identifications i
        WHERE i.id = identification_id AND i.user_id = (SELECT auth.uid())
      )
    )
  );

-- ── Limit which profile columns clients can change ─────────────────────────
-- The row policy alone let a client rewrite email (a mirror of auth.users) and
-- auth_provider. Only fields the app owns stay writable.
REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (display_name, preferences, last_seen_at) ON public.users TO authenticated;
