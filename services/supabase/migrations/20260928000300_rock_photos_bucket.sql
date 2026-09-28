-- ── rock-photos Storage bucket ─────────────────────────────────────────────
-- Private bucket for identification photos. Each user may only touch objects
-- under their own `{user_id}/` prefix. Photos are resized and EXIF-stripped
-- JPEGs from the app, so 5 MB is generous.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('rock-photos', 'rock-photos', false, 5242880, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own rock photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rock-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own rock photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'rock-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own rock photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'rock-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
