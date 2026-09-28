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

## Backend

```powershell
cd services
supabase db push
supabase secrets set ANTHROPIC_API_KEY=... OPENAI_API_KEY=...
supabase functions deploy identify-rock
```

Optional secret: `IDENTIFY_DAILY_LIMIT` (identifications per user per 24 h, default 20).

Anonymous sign-ins must be enabled in the Supabase dashboard (Authentication → Sign In / Providers).
