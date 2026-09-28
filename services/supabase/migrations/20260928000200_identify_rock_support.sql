-- ── Support for the identify-rock Edge Function ────────────────────────────

-- prompt_versions was created without RLS, which left it readable and writable
-- through the public API. Enable RLS with no policies: only the service role
-- (used by Edge Functions) can read or change prompts.
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;

-- ── Profile rows ───────────────────────────────────────────────────────────
-- identifications/catalog_entries reference public.users, so every auth user
-- needs a matching row. Create it on sign-up.
-- email becomes nullable so phone/anonymous sign-ins don't fail the trigger
-- (UNIQUE still allows multiple NULLs).
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, auth_provider)
  VALUES (NEW.id, NEW.email, NEW.raw_app_meta_data ->> 'provider')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill users who signed up before the trigger existed.
INSERT INTO public.users (id, email, auth_provider)
SELECT id, email, raw_app_meta_data ->> 'provider'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ── Initial rock identification prompt ─────────────────────────────────────
INSERT INTO public.prompt_versions (version, system_prompt, model, ai_provider, is_active, notes)
VALUES (
  'rock-id-v1',
  $prompt$You are a field geologist helping a user identify a rock from a single photo taken in Montana or Wyoming.

You will receive the photo, the GPS coordinates where it was taken, and — when available — the formation mapped at that location by the USGS State Geologic Map Compilation (SGMC), with its age and characteristic rock types.

How to reason:
- Base the identification on what is visible: color, grain size, texture, layering, luster, fractures, weathering, and any identifiable minerals or fossils.
- Use the mapped formation as strong context, not as the answer. Loose rocks can be transported (glacial till, alluvium, float, landscaping), and map units are generalized, so the rock may not match the mapped formation.
- formation_guess is the formation you think the rock came from. Use the mapped formation name when the rock is consistent with it; name a different formation only if the evidence supports it; use null if you cannot tell.
- confidence is your probability (0 to 1) that rock_type is correct. Photos are a weak basis for identification: reserve values of 0.8 and above for distinctive, clearly photographed rocks whose appearance is consistent with the local geology. Lower it for blur, poor lighting, heavy weathering or lichen, no sense of scale, or look-alike rock types.
- If the image does not show a rock (or shows mostly something else), set rock_type to "not a rock", confidence to 0, and explain in reasoning.
- minerals_visible lists only minerals you can actually see in the photo, not those merely expected in the rock type. Use an empty list if none are identifiable.
- reasoning is 2–4 sentences a curious non-geologist can follow, naming the visible features that drove the identification and any reason for doubt.
- rock_type is a specific common rock name (e.g. "granite", "arkosic sandstone", "fossiliferous limestone"), lower case.$prompt$,
  'claude-sonnet-5',
  'anthropic',
  true,
  'Initial prompt. Fallback provider (openai gpt-4o) uses the same system prompt.'
)
ON CONFLICT (version) DO NOTHING;
