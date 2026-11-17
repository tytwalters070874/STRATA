# STRATA

Geologic field companion for Montana and Wyoming. Shows the mapped formation under your GPS position and identifies rocks from photos.

## Layout

- `apps/mobile/` — Expo (SDK 56) React Native app
- `services/supabase/` — Supabase project: migrations and Edge Functions
- `scripts/import-geodata/` — one-off USGS SGMC import (source data not committed)

## Mobile app

```powershell
cd apps\mobile
npm install
npx expo run:android
```

`apps/mobile/.env` needs:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
GOOGLE_MAPS_API_KEY=...
```

Checks (also run in CI on every push and pull request):

```powershell
npm run typecheck
npm run lint
```

## Backend

```powershell
cd services
supabase db push
supabase secrets set ANTHROPIC_API_KEY=... OPENAI_API_KEY=...
supabase functions deploy identify-rock
supabase functions deploy delete-account
```

Optional secrets:

- `IDENTIFY_DAILY_LIMIT`: identifications per user per 24 h (default 20).
- `OPENAI_FALLBACK_MODEL`: fallback model when the active `prompt_versions` row has no `fallback_model` (default `gpt-4o`).

Both models are set on the active `prompt_versions` row (`model` for Anthropic, `fallback_model` for OpenAI). To change either, insert a new row with `is_active = true` and deactivate the old one. No redeploy is needed.

Deploy the function together with the latest migration. The function reads photos from the `rock-photos` bucket and writes `identifications.photo_path`, which the migration renames from `photo_url`.

### Auth

Every user starts as an anonymous guest. From **Catalog → Account**, a guest can attach an email to keep their catalog, or sign in to an existing account. Both flows confirm with a 6-digit code, so no deep links are needed. In the Supabase dashboard:

- Enable anonymous sign-ins and email sign-ins (Authentication → Sign In / Providers).
- In Authentication → Email Templates, include `{{ .Token }}` in the **Change Email Address** and **Magic Link** templates so the email contains the code.

**Account → Delete account** calls the `delete-account` Edge Function. It removes the user's photos from Storage, then deletes the auth user, which cascades to every table. Google Play also requires a web link where people can request deletion without the app. That link isn't built yet.
