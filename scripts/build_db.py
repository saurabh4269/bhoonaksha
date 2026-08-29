#!/usr/bin/env python3
"""Build data/mera.sqlite from LGD CSVs + 5-state village coords.

Does not scrape Bhulekh / Bhu-Naksha. Does not invent coordinates or owners.
"""
from __future__ import annotations

import csv
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace/mera-plot")
DB_PATH = ROOT / "data" / "mera.sqlite"
LGD_DIR = Path("/tmp/mera-lgd/extracted")
ZIP_DIR = Path("/tmp/village_zip")

VILLAGES_CSV = LGD_DIR / "villages.31Mar2026.csv"
STATES_CSV = LGD_DIR / "states.28Aug2026.csv"
DISTRICTS_CSV = LGD_DIR / "districts.28Aug2026.csv"
SUBDISTRICTS_CSV = LGD_DIR / "subdistricts.28Aug2026.csv"
PINCODE_CSV = LGD_DIR / "pincode_villages.28Aug2026.csv"

SOURCES = {
    "lgd_villages": "https://github.com/ramSeraph/opendata/releases/download/lgd-latest/villages.31Mar2026.csv.7z",
    "lgd_states": "https://github.com/ramSeraph/opendata/releases/download/lgd-latest-extra1/states.28Aug2026.csv.7z",
    "lgd_districts": "https://github.com/ramSeraph/opendata/releases/download/lgd-latest-extra1/districts.28Aug2026.csv.7z",
    "lgd_subdistricts": "https://github.com/ramSeraph/opendata/releases/download/lgd-latest-extra1/subdistricts.28Aug2026.csv.7z",
    "lgd_pincode_villages": "https://github.com/ramSeraph/opendata/releases/download/lgd-latest-extra1/pincode_villages.28Aug2026.csv.7z",
    "lgd_blocks": "https://github.com/ramSeraph/opendata/releases/download/lgd-latest-extra1/blocks.28Aug2026.csv.7z",
}


def need(path: Path) -> Path:
    if not path.exists():
        raise SystemExit(f"missing {path}")
    return path


def to_int(v):
    v = (v or "").strip()
    if not v:
        return None
    try:
        return int(v)
    except ValueError:
        return None


def to_str(v):
    v = (v or "").strip()
    return v or None


def load_coords() -> dict[int, tuple[float, float]]:
    """LGD village code -> (lat, lon). Never invent; only files on disk."""
    coords: dict[int, tuple[float, float]] = {}
    states = ["andhra_pradesh", "karnataka", "kerala", "tamil_nadu", "telangana"]
    for st in states:
        for name in ("coords.json", "village_points.json"):
            p = ZIP_DIR / st / "web" / "data" / name
            if not p.exists():
                continue
            data = json.loads(p.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                continue
            n = 0
            for k, val in data.items():
                code = to_int(str(k))
                if code is None:
                    continue
                if not isinstance(val, (list, tuple)) or len(val) < 2:
                    continue
                try:
                    lat = float(val[0])
                    lon = float(val[1])
                except (TypeError, ValueError):
                    continue
                if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                    continue
                # Skip obvious zeros
                if lat == 0 and lon == 0:
                    continue
                coords[code] = (lat, lon)
                n += 1
            print(f"  coords {st}/{name}: {n} points (map now {len(coords)})")
    return coords


def load_cadastral_index() -> set[int]:
    """Villages with a local parcels_index (AP only in the zip). Not owners."""
    out: set[int] = set()
    p = ZIP_DIR / "andhra_pradesh" / "web" / "data" / "parcels_index.json"
    if not p.exists():
        return out
    data = json.loads(p.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        for k in data.keys():
            code = to_int(str(k))
            if code is not None:
                out.add(code)
    print(f"  cadastral index keys: {len(out)}")
    return out


def load_pincodes() -> dict[int, str]:
    pins: dict[int, str] = {}
    with need(PINCODE_CSV).open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            code = to_int(row.get("Village Code"))
            pin = to_str(row.get("Pincode"))
            if code is None or pin is None:
                continue
            if code not in pins:
                pins[code] = pin
    print(f"  pincodes: {len(pins)}")
    return pins


SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA synchronous = OFF;
PRAGMA temp_store = MEMORY;
PRAGMA page_size = 4096;

CREATE TABLE states (
  state_code INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  name_local TEXT,
  version INTEGER,
  census_2001 TEXT,
  census_2011 TEXT,
  state_or_ut TEXT
);

CREATE TABLE districts (
  district_code INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  state_code INTEGER,
  state_name TEXT,
  census_2001 TEXT,
  census_2011 TEXT
);

CREATE TABLE subdistricts (
  subdistrict_code INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  state_code INTEGER,
  state_name TEXT,
  district_code INTEGER,
  district_name TEXT,
  version INTEGER,
  census_2001 TEXT,
  census_2011 TEXT
);

CREATE TABLE villages (
  lgd_code INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  name_local TEXT,
  state_code INTEGER,
  state_name TEXT,
  district_code INTEGER,
  district_name TEXT,
  subdistrict_code INTEGER,
  subdistrict_name TEXT,
  pincode TEXT,
  lat REAL,
  lon REAL,
  has_cadastral_index INTEGER NOT NULL DEFAULT 0
);

-- SCHEMA ONLY. Do not fill owner_name.
-- Owners require a state Record of Rights adapter. There is no public Bhulekh dump.
CREATE TABLE parcels (
  id INTEGER PRIMARY KEY,
  village_lgd INTEGER,
  survey_no TEXT,
  khasra TEXT,
  ulpin TEXT,
  owner_name TEXT,
  source TEXT,
  note TEXT
);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX idx_villages_name ON villages(name);
CREATE INDEX idx_villages_district ON villages(district_name);
CREATE INDEX idx_villages_state ON villages(state_code);
CREATE INDEX idx_villages_pincode ON villages(pincode);
CREATE INDEX idx_villages_coords ON villages(lat, lon) WHERE lat IS NOT NULL;
"""


def insert_csv(con, table, csv_path, mapping_fn, batch=5000):
    rows = []
    n = 0
    with need(csv_path).open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        sample_keys = None
        for row in reader:
            if sample_keys is None:
                sample_keys = list(row.keys())
            tup = mapping_fn(row)
            if tup is None:
                continue
            rows.append(tup)
            if len(rows) >= batch:
                con.executemany(insert_sql[table], rows)
                n += len(rows)
                rows.clear()
        if rows:
            con.executemany(insert_sql[table], rows)
            n += len(rows)
    print(f"  inserted {table}: {n}")
    return n


insert_sql = {
    "states": "INSERT OR REPLACE INTO states(state_code,name,name_local,version,census_2001,census_2011,state_or_ut) VALUES (?,?,?,?,?,?,?)",
    "districts": "INSERT OR REPLACE INTO districts(district_code,name,state_code,state_name,census_2001,census_2011) VALUES (?,?,?,?,?,?)",
    "subdistricts": "INSERT OR REPLACE INTO subdistricts(subdistrict_code,name,state_code,state_name,district_code,district_name,version,census_2001,census_2011) VALUES (?,?,?,?,?,?,?,?,?)",
    "villages": "INSERT OR REPLACE INTO villages(lgd_code,name,name_local,state_code,state_name,district_code,district_name,subdistrict_code,subdistrict_name,pincode,lat,lon,has_cadastral_index) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
}


def map_state(row):
    code = to_int(row.get("State Code"))
    name = to_str(row.get("State Name (In English)"))
    if code is None or name is None:
        return None
    return (
        code,
        name,
        to_str(row.get("State Name (In Local)")),
        to_int(row.get("State Version")),
        to_str(row.get("Census 2001 Code")),
        to_str(row.get("Census 2011 Code")),
        to_str(row.get("State or UT")),
    )


def map_district(row):
    code = to_int(row.get("District Code"))
    name = to_str(row.get("District Name(In English)"))
    if code is None or name is None:
        return None
    return (
        code,
        name,
        to_int(row.get("State Code")),
        to_str(row.get("State Name (In English)")),
        to_str(row.get("Census 2001 Code")),
        to_str(row.get("Census 2011 Code")),
    )


def map_subdistrict(row):
    code = to_int(row.get("Sub-district Code"))
    name = to_str(row.get("Sub-district Name"))
    if code is None or name is None:
        return None
    return (
        code,
        name,
        to_int(row.get("State Code")),
        to_str(row.get("State Name")),
        to_int(row.get("District Code")),
        to_str(row.get("District Name")),
        to_int(row.get("Sub-district Version")),
        to_str(row.get("Census 2001 Code")),
        to_str(row.get("Census 2011 Code")),
    )


def main():
    for p in (VILLAGES_CSV, STATES_CSV, DISTRICTS_CSV, SUBDISTRICTS_CSV, PINCODE_CSV):
        need(p)

    print("Loading coords / pincodes / cadastral index…")
    coords = load_coords()
    cadastral = load_cadastral_index()
    pincodes = load_pincodes()

    if DB_PATH.exists():
        DB_PATH.unlink()
    wal = Path(str(DB_PATH) + "-wal")
    shm = Path(str(DB_PATH) + "-shm")
    if wal.exists():
        wal.unlink()
    if shm.exists():
        shm.unlink()

    con = sqlite3.connect(str(DB_PATH))
    con.executescript(SCHEMA)

    print("Importing states / districts / subdistricts…")
    n_states = insert_csv(con, "states", STATES_CSV, map_state)
    n_dist = insert_csv(con, "districts", DISTRICTS_CSV, map_district)
    n_sub = insert_csv(con, "subdistricts", SUBDISTRICTS_CSV, map_subdistrict)
    con.commit()

    print("Importing villages…")
    rows = []
    n = 0
    n_with_coords = 0
    n_cad = 0
    n_pin = 0
    n_local = 0
    sql = insert_sql["villages"]
    with need(VILLAGES_CSV).open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        print("  village headers:", reader.fieldnames)
        for row in reader:
            code = to_int(row.get("Village Code"))
            name = to_str(row.get("Village Name (In English)"))
            if code is None or name is None:
                continue
            loc = to_str(row.get("Village Name (In Local)"))
            pin = pincodes.get(code)
            latlon = coords.get(code)
            lat = latlon[0] if latlon else None
            lon = latlon[1] if latlon else None
            has_cad = 1 if code in cadastral else 0
            if lat is not None:
                n_with_coords += 1
            if has_cad:
                n_cad += 1
            if pin:
                n_pin += 1
            if loc:
                n_local += 1
            rows.append(
                (
                    code,
                    name,
                    loc,
                    to_int(row.get("State Code")),
                    to_str(row.get("State Name(In English)")),
                    to_int(row.get("District Code")),
                    to_str(row.get("District Name (In English)")),
                    to_int(row.get("Sub-District Code")),
                    to_str(row.get("Sub-District Name (In English)")),
                    pin,
                    lat,
                    lon,
                    has_cad,
                )
            )
            if len(rows) >= 8000:
                con.executemany(sql, rows)
                n += len(rows)
                rows.clear()
                if n % 80000 == 0:
                    print(f"    … {n}")
        if rows:
            con.executemany(sql, rows)
            n += len(rows)
    print(f"  inserted villages: {n}  with_coords={n_with_coords}  cadastral_index={n_cad}  pincode={n_pin}  name_local={n_local}")
    con.commit()

    print("Building FTS5…")
    con.execute(
        """
        CREATE VIRTUAL TABLE villages_fts USING fts5(
          name,
          name_local,
          district_name,
          subdistrict_name,
          pincode,
          lgd_code,
          content='villages',
          content_rowid='lgd_code',
          tokenize='unicode61'
        )
        """
    )
    con.execute(
        """
        INSERT INTO villages_fts(rowid, name, name_local, district_name, subdistrict_name, pincode, lgd_code)
        SELECT
          lgd_code,
          name,
          IFNULL(name_local, ''),
          IFNULL(district_name, ''),
          IFNULL(subdistrict_name, ''),
          IFNULL(pincode, ''),
          CAST(lgd_code AS TEXT)
        FROM villages
        """
    )
    con.commit()

    print("Writing meta…")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    meta = {
        "built_at_utc": now,
        "license_lgd": "Community mirror of the official Local Government Directory (Ministry of Panchayati Raj). Same data is published on data.gov.in under the Government Open Data License (GODL). Not a Record of Rights.",
        "license_coords": "Village points joined from the bundled 5-state village_data_all.zip (Andhra Pradesh, Karnataka, Kerala, Tamil Nadu, Telangana). Coordinates are only stored where that zip already had them. No coordinates were invented.",
        "license_cadastral_tiles": "indianopenmaps cadastral vector tiles (CC0 1.0, attribute Datameet + original state GIS agency). Plot geometry only — no owners. Not downloaded into this database.",
        "not_included": "No owner names. No ULPIN registry. No national khasra grid. No Bhulekh / Bhu-Naksha scrape. parcels table is empty by design.",
        "source_lgd_villages": SOURCES["lgd_villages"],
        "source_lgd_states": SOURCES["lgd_states"],
        "source_lgd_districts": SOURCES["lgd_districts"],
        "source_lgd_subdistricts": SOURCES["lgd_subdistricts"],
        "source_lgd_pincode_villages": SOURCES["lgd_pincode_villages"],
        "source_lgd_blocks": SOURCES["lgd_blocks"] + " (downloaded, not imported — not needed for citizen search)",
        "lgd_villages_dump_date": "31Mar2026",
        "lgd_hierarchy_dump_date": "28Aug2026",
        "count_states": str(n_states),
        "count_districts": str(n_dist),
        "count_subdistricts": str(n_sub),
        "count_villages": str(n),
        "count_villages_with_coords": str(n_with_coords),
        "count_villages_with_pincode": str(n_pin),
        "count_villages_with_name_local": str(n_local),
        "count_villages_with_cadastral_index": str(n_cad),
        "count_parcels": "0",
        "coords_states": "andhra_pradesh,karnataka,kerala,tamil_nadu,telangana",
        "note_owners": "owner_name on parcels is unused. Filling it requires a state RoR adapter. There is no public Bhulekh dump.",
    }
    con.executemany("INSERT INTO meta(key, value) VALUES (?, ?)", list(meta.items()))
    con.commit()

    print("ANALYZE…")
    con.execute("ANALYZE")
    con.execute("PRAGMA synchronous = NORMAL")
    con.commit()

    # sanity
    c = con.execute("SELECT COUNT(*) FROM villages").fetchone()[0]
    cc = con.execute("SELECT COUNT(*) FROM villages WHERE lat IS NOT NULL").fetchone()[0]
    fts = con.execute("SELECT COUNT(*) FROM villages_fts").fetchone()[0]
    tad = con.execute(
        "SELECT name, district_name, state_name FROM villages_fts f JOIN villages v ON v.lgd_code=f.rowid WHERE villages_fts MATCH 'Tadimarri*' LIMIT 5"
    ).fetchall()
    print("SANITY villages", c, "coords", cc, "fts", fts, "tadimarri", tad)
    con.close()
    size = DB_PATH.stat().st_size
    print(f"Wrote {DB_PATH} ({size} bytes, {size/1024/1024:.1f} MB)")


if __name__ == "__main__":
    sys.exit(main() or 0)
