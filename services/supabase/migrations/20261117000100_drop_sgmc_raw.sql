-- ── Drop the raw SGMC import table ─────────────────────────────────────────
-- sgmc_raw is the staging table from the one-off USGS SGMC import. Its data
-- was transformed into geologic_formations, nothing reads it (zero scans),
-- and it takes 146 MB of the database's storage.
--
-- This permanently deletes it. To recreate it, rerun the import script in
-- scripts/import-geodata/. No CASCADE: if anything still depends on the
-- table, this fails instead of dropping that too.
DROP TABLE IF EXISTS public.sgmc_raw;
