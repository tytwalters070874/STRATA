@echo off
REM Loads the Montana and Wyoming polygons from the USGS State Geologic Map
REM Compilation (SGMC) into a staging table, public.sgmc_raw.
REM
REM Setup:
REM   1. Copy this file to import.bat (git-ignored) and replace YOUR_PASSWORD
REM      with the database password (Supabase: Project Settings > Database).
REM      If the password contains spaces or quotes, wrap it in single quotes:
REM      password='...'
REM   2. Unzip USGS_SGMC_Shapefiles.zip into SGMC\ next to this file.
REM   3. Requires GDAL's ogr2ogr on PATH.
REM
REM sgmc_raw is only a staging table. The app reads public.geologic_formations,
REM which was built from sgmc_raw by a transform step that isn't in this repo.
REM The staging table was dropped in migration 20261117000100 once loaded.

echo Importing Montana formations...
ogr2ogr -f "PostgreSQL" "PG:host=db.qyehrmeegvqhimfpxcqm.supabase.co port=5432 dbname=postgres user=postgres password=YOUR_PASSWORD" SGMC\USGS_SGMC_Shapefiles\SGMC_Geology.shp -nln sgmc_raw -nlt MULTIPOLYGON -t_srs EPSG:4326 -where "STATE='MT'" -makevalid -progress --config PG_USE_COPY YES

echo Importing Wyoming formations...
ogr2ogr -f "PostgreSQL" "PG:host=db.qyehrmeegvqhimfpxcqm.supabase.co port=5432 dbname=postgres user=postgres password=YOUR_PASSWORD" SGMC\USGS_SGMC_Shapefiles\SGMC_Geology.shp -nln sgmc_raw -nlt MULTIPOLYGON -t_srs EPSG:4326 -where "STATE='WY'" -append -makevalid -progress --config PG_USE_COPY YES

echo Import complete.
pause
