# Bhoonaksha

Static web map for Indian cadastral plots. No bundler, no framework.

Live: https://bhunaksha.vercel.app

## Stack

| Piece | What |
|---|---|
| Map | [MapLibre GL JS](https://maplibre.org/) 4.7 (`hash: true`) |
| Street / satellite | Esri World Street Map, Esri World Imagery (`maxzoom` 17, overzoom above that) |
| Historical satellite | Esri Wayback, years 2014–2026 |
| DEM / terrain | [Mapterhorn](https://mapterhorn.com/) Terrarium WebP |
| Place labels | OpenFreeMap Liberty vector, attached over the raster |
| Survey plots | Vector tiles from [indianopenmaps](https://indianopenmaps.com/) (MVT) |
| Village search | Bundled LGD dump (`lgd/villages.json.gz`) in a Web Worker; Nominatim fallback |
| Reverse / OSM extras | Nominatim, Overpass |
| Plot IDs | DIGIPIN encoder/decoder (`js/digipin.js`) |
| Translation | Sarvam Translate via `api/translate.js` (Vercel serverless). Key is `SARVAM_API_KEY` on the host, never in the client |
| Hosting | Vercel static + one function |

## Pages

- `index.html` — citizen map
- `lekpal.html` — staff GIS desk (identify, shapefile, 3D, catalogue)

Scripts are plain IIFEs under `js/`. Shared CSS in `css/app.css`; desk extras in `css/lekpal.css`.

## Layout

```
index.html          lekpal.html
css/                js/
api/translate.js    Vercel function for Sarvam
lgd/villages.json.gz  LGD village index (gzip JSON)
data/DATA.md        notes on the optional SQLite village DB
scripts/build_db.py rebuilds `data/mera.sqlite` from LGD dumps (not required in prod)
server.py           local static server + `/api/search` against SQLite if present
vercel.json         cache headers
```

Cache-bust query is `?v=` on script and CSS links. Bump it when shipping.

## Cadastral tiles

Keyless MVT from indianopenmaps, drawn after closer zoom:

Andhra Pradesh, Tamil Nadu, Kerala, Telangana, Karnataka, Maharashtra, Odisha, Haryana, Madhya Pradesh, Goa, Assam, Jharkhand.

Plot numbers use the source attributes (`KIDE` in Jharkhand, `revenue_plot` in Odisha, etc.). There is no owner / khata / ULPIN feed in this repo.

## Run locally

```bash
python3 server.py
```

Serves `127.0.0.1:8765`. If `data/mera.sqlite` is missing, search still works from the gzip LGD index in the browser.

Any static server also works for the map itself (`python3 -m http.server`). Translation needs the Vercel function or an env `SARVAM_API_KEY` in front of `api/translate.js`.

## Deploy

Pushes land on https://bhoonaksha-plot-card.vercel.app.

Day to day (until the GitHub owner imports this repo in Vercel, or runs the setup script below):

```bash
git push origin main
./scripts/sync-fork.sh
```

The second command fast-forwards [shiwani42/bhoonaksha](https://github.com/shiwani42/bhoonaksha), which is what Vercel watches. Pushing that fork’s `main` directly also deploys.

**GitHub Actions** (templates in `ci/`). A repo admin runs this once (`gh` with the `workflow` scope + `vercel login`):

```bash
./scripts/enable-vercel-github-ci.sh
```

That copies the workflows into `.github/workflows/` and writes the `VERCEL_TOKEN` secret. After that, every push to `main` and every pull request deploys from Actions.

**Vercel Git (live now).** Vercel will not attach a *personal* GitHub repo unless the **owner** imports it. The plot-card project is linked to the collaborator fork [shiwani42/bhoonaksha](https://github.com/shiwani42/bhoonaksha). Pushing that fork’s `main` deploys production. After a push here, sync the fork (and the deploy) with:

```bash
./scripts/sync-fork.sh
```

The owner can skip the fork by importing `saurabh4269/bhoonaksha` in the Vercel dashboard.

Set `SARVAM_API_KEY` on the Vercel project if you want live translation. Do not commit `.vercel`, `bin-cloudflared`, or `data/*.sqlite`.

`bhunaksha.vercel.app` is a different Vercel account. Import this GitHub repo there (or re-alias after a prod deploy) if that hostname should follow `main`.
