# Mera Plot data

This is a **citizen place finder**, not a Record of Rights. Nothing in this folder is ownership, title, or a khasra register.

## What is in `mera.sqlite`

Built from the ramSeraph community mirror of the official Local Government Directory (same dataset data.gov.in publishes). GODL-ish / open government data. Dumps used:

| File | Date | Source |
|---|---|---|
| villages.31Mar2026.csv.7z | 31 Mar 2026 | https://github.com/ramSeraph/opendata/releases/download/lgd-latest/villages.31Mar2026.csv.7z |
| states.28Aug2026.csv.7z | 28 Aug 2026 | https://github.com/ramSeraph/opendata/releases/download/lgd-latest-extra1/states.28Aug2026.csv.7z |
| districts.28Aug2026.csv.7z | 28 Aug 2026 | (same extra1 release) |
| subdistricts.28Aug2026.csv.7z | 28 Aug 2026 | (same extra1 release) |
| pincode_villages.28Aug2026.csv.7z | 28 Aug 2026 | (same extra1 release) |
| blocks.28Aug2026.csv.7z | 28 Aug 2026 | Downloaded, **not imported** (not needed for village search) |

Tables:

- `states` — 36
- `districts` — 784
- `subdistricts` — 7,092
- `villages` — **676,552** all-India LGD villages (`lgd_code` PK, English name, `name_local` when the dump had one, hierarchy, PIN, lat/lon, `has_cadastral_index`)
- `villages_fts` — FTS5 on name, name_local, district_name, subdistrict_name, pincode, lgd_code
- `parcels` — **schema only, 0 rows**. Columns exist for `village_lgd`, `survey_no`, `khasra`, `ulpin`, `owner_name`, `source`, `note`.
- `meta` — source URLs, dump dates, counts, license notes

### Coordinates

`lat` / `lon` are joined **only** from the bundled five-state zip `village_data_all.zip`:

- `web/data/coords.json` for AP, Karnataka, Kerala, Tamil Nadu, Telangana
- `web/data/village_points.json` for Andhra Pradesh (more complete than coords.json)

Keys are LGD village codes; values are `[lat, lon]`. **17,362** villages have a point. Every other village has `NULL` coordinates. **No coordinates were invented.**

### Cadastral index flag

`has_cadastral_index = 1` for **11,982** Andhra Pradesh villages that appear in `andhra_pradesh/web/data/parcels_index.json` (bounding boxes of survey coverage, not owners).

## What is NOT in the database

- **No owner names.** `parcels.owner_name` is unused. Filling it needs a state Record of Rights adapter. There is no public Bhulekh dump, and this project does not scrape Bhulekh / Bhu-Naksha / any live land-record site.
- **No ULPIN registry.**
- **No national khasra / survey-number register.** A survey number on a map outline is geometry, not title.
- **No fake Sitapur plots.** The old prototype grid and invented owners were removed.
- **Not a Record of Rights.**

## Extra open layers (used on the map, not stuffed into sqlite)

These help a citizen **see a place**. They do not name an owner.

1. **indianopenmaps cadastral vector tiles** (CC0 1.0; attribute Datameet + the state GIS agency). Plot outlines only. CORS `Access-Control-Allow-Origin: *` confirmed on sample GETs. Streamed in MapLibre at zoom ≥ 14 as “Survey outlines”; attribution stays in the map attribution control.
   - Andhra Pradesh: `https://indianopenmaps.com/not-so-open/cadastrals/andhra-pradesh/apsac/{z}/{x}/{y}.pbf` (source-layer `APSAC_AP_Cadastrals`, maxzoom 13, overzoomed)
   - Tamil Nadu: `…/tamil-nadu/tngis/{z}/{x}/{y}.pbf` (`TNGIS_TN_Cadastrals`, maxzoom 14)
   - Kerala: `…/kerala/bhuvan/{z}/{x}/{y}.pbf` (`Bhuvan_Kerala_Cadastrals`, maxzoom 13)
   - Karnataka / Telangana tile.json paths on indianopenmaps.com were not found at the obvious slugs (`kgis`, `tracgis`, …). Their PMTiles exist upstream (KGIS / TRACGIS, CC0) but are not wired here. 100MB+ geojsonl dumps were **not** downloaded onto the static site.
2. **DIGIPIN** — India Post / Department of Posts 10-character grid, encoded in the browser from lat/lon. Search box accepts a DIGIPIN.
3. **OpenStreetMap** raster + Overpass farmland/building outlines at high zoom. ODbL. Attribution in the map control only.
4. **Esri World Imagery** satellite toggle. Attribution in the map control only.
5. **Nominatim** — fallback geocoder for cities, landmarks, and LGD villages that have no stored point. Not painted in the UI.

## Rebuild

```
sudo apt-get install -y p7zip-full sqlite3
# CSVs expected at /tmp/mera-lgd/extracted/
# 5-state zip extracted at /tmp/village_zip/
python3 /workspace/mera-plot/scripts/build_db.py
python3 /workspace/mera-plot/server.py
```

API (same origin):

- `GET /api/search?q=` → up to 8 villages (FTS)
- `GET /api/village/<lgd>`
- `GET /api/near?lat=&lon=` → nearest village **with coordinates**, within ~30 km

## Production rails (not in the citizen chrome)

What this map uses now: MapLibre, CARTO/OSM raster, Esri satellite, LGD village/district vector tiles, open cadastral PBF for several states, Google Open Buildings, DIGIPIN, Nominatim. Tiles come from India Open Maps (PMTiles behind a CDN).

What a state adapter should look like later:
- PostGIS as the spatial ledger (ST_IsValid / ST_Overlaps on split-merge)
- Martin or pg_tileserv for live vector tiles, Cloudflare/Vercel at the edge
- OGC API Features as the public land read API (not old WFS-T)
- GeoPackage / FlatGeobuf for a village extract
- COG + STAC for SVAMITVA drone imagery when a village publishes it
- ULPIN only via a signed state adapter; there is no public ULPIN API

Not for the phone map: Apache Sedona, GeoServer admin, LandXML pipelines. Those belong in the tehsil engine room.
