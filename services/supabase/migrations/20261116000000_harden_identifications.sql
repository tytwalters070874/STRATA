-- ── Harden identifications ─────────────────────────────────────────────────

-- Only the identify-rock Edge Function (service role) writes identifications.
-- The client-facing INSERT/UPDATE policies let a user rewrite created_at on
-- their own rows, which moved them out of the rolling window the daily
-- identification limit counts, and let them forge results. Reads stay allowed.
DROP POLICY IF EXISTS "Users insert own identifications" ON public.identifications;
DROP POLICY IF EXISTS "Users update own identifications" ON public.identifications;

-- photo_url has always held a Storage object path (`{user_id}/{ts}.jpg`), not
-- a URL. Name it for what it holds.
ALTER TABLE public.identifications RENAME COLUMN photo_url TO photo_path;

CREATE OR REPLACE VIEW public.catalog_view
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.user_id,
  c.identification_id,
  c.user_notes,
  c.custom_label,
  c.saved_at,
  ST_Y(c.location_snapshot)                          AS lat,
  ST_X(c.location_snapshot)                          AS lng,
  i.photo_path                                       AS photo_path,
  i.ai_response_raw -> 'result' ->> 'rock_type'      AS rock_type,
  i.ai_response_raw -> 'result' ->> 'formation_guess' AS formation_guess,
  i.confidence_score,
  i.confidence_tier,
  f.name                                             AS formation_name,
  f.map_unit_symbol,
  f.geologic_age
FROM public.catalog_entries c
LEFT JOIN public.identifications i ON i.id = c.identification_id
LEFT JOIN public.geologic_formations f ON f.id = c.formation_id
WHERE NOT c.is_deleted;

-- ── Fallback model versioned with the prompt ───────────────────────────────
-- The OpenAI fallback model was a constant in the Edge Function. Keep it on
-- the prompt row so both models change together, without a redeploy.
ALTER TABLE public.prompt_versions ADD COLUMN IF NOT EXISTS fallback_model text;

UPDATE public.prompt_versions
SET fallback_model = 'gpt-4o'
WHERE version = 'rock-id-v1' AND fallback_model IS NULL;

-- ── Keep public.users.email in sync ────────────────────────────────────────
-- Anonymous users can now attach an email to keep their catalog. The insert
-- trigger only copies email at sign-up, so mirror later changes too.
CREATE OR REPLACE FUNCTION public.handle_auth_user_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_auth_user_email_change();
