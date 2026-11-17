@echo off
echo Importing Montana geology...
ogr2ogr -f "PostgreSQL" "PG:host=db.qyehrmeegvqhimfpxcqm.supabase.co port=5432 dbname=postgres user=postgres password=YOUR_PASSWORD" mt_geology.shp -nln geologic_formations -nlt MULTIPOLYGON -t_srs EPSG:4326 -progress --config PG_USE_COPY YES

echo Importing Wyoming geology...
ogr2ogr -f "PostgreSQL" "PG:host=db.qyehrmeegvqhimfpxcqm.supabase.co port=5432 dbname=postgres user=postgres password=YOUR_PASSWORD" wy_geology.shp -nln geologic_formations -nlt MULTIPOLYGON -t_srs EPSG:4326 -append -progress --config PG_USE_COPY YES

echo Done.
pause