-- ── catalog_view ───────────────────────────────────────────────────────────
-- Flattens a catalog entry with its identification result and mapped
-- formation for the catalog list. security_invoker makes the view run with the
-- caller's permissions, so the RLS policies on catalog_entries and
-- identifications still restrict rows to the signed-in user.
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
  i.photo_url                                        AS photo_path,
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

GRANT SELECT ON public.catalog_view TO authenticated;
