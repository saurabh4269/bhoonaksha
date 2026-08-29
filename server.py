#!/usr/bin/env python3
"""Mera Plot: static site + tiny village search API. Binds 127.0.0.1:8765."""
from __future__ import annotations

import json
import math
import mimetypes
import re
import sqlite3
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path("/workspace/mera-plot").resolve()
DB_PATH = ROOT / "data" / "mera.sqlite"
HOST = "127.0.0.1"
PORT = 8765

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")

_local = threading.local()
FTS_BAD = re.compile(r'["\'*:()^]+')


def db() -> sqlite3.Connection:
    con = getattr(_local, "con", None)
    if con is None:
        con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, check_same_thread=False)
        con.row_factory = sqlite3.Row
        _local.con = con
    return con


def village_json(row) -> dict:
    if row is None:
        return None
    lat = row["lat"]
    lon = row["lon"]
    return {
        "lgd": row["lgd_code"],
        "name": row["name"],
        "name_local": row["name_local"],
        "district": row["district_name"],
        "state": row["state_name"],
        "subdistrict": row["subdistrict_name"],
        "pincode": row["pincode"],
        "lat": lat,
        "lon": lon,
    }


def fts_query(q: str) -> str | None:
    tokens = [t for t in re.split(r"\s+", q.strip()) if t]
    clean = []
    for t in tokens:
        t = FTS_BAD.sub("", t)
        t = t.strip("-")
        if t:
            clean.append(t)
    if not clean:
        return None
    return " AND ".join(f"{t}*" for t in clean)


def search(q: str, limit: int = 8) -> list[dict]:
    q = (q or "").strip()
    if len(q) < 2:
        return []
    con = db()
    seen: set[int] = set()
    out: list[dict] = []

    def add_rows(rows):
        for row in rows:
            code = row["lgd_code"]
            if code in seen:
                continue
            seen.add(code)
            out.append(village_json(row))
            if len(out) >= limit:
                return True
        return False

    if q.isdigit():
        rows = con.execute(
            """
            SELECT lgd_code, name, name_local, district_name, state_name,
                   subdistrict_name, pincode, lat, lon
            FROM villages
            WHERE lgd_code = ? OR pincode = ?
            ORDER BY (lat IS NULL), name
            LIMIT ?
            """,
            (int(q), q, limit),
        ).fetchall()
        if add_rows(rows):
            return out

    match = fts_query(q)
    if match:
        try:
            rows = con.execute(
                """
                SELECT v.lgd_code, v.name, v.name_local, v.district_name, v.state_name,
                       v.subdistrict_name, v.pincode, v.lat, v.lon
                FROM villages_fts f
                JOIN villages v ON v.lgd_code = f.rowid
                WHERE villages_fts MATCH ?
                ORDER BY
                  CASE
                    WHEN v.name = ? THEN 0
                    WHEN v.name LIKE ? THEN 1
                    WHEN v.subdistrict_name = ? THEN 2
                    WHEN v.district_name = ? THEN 3
                    ELSE 4
                  END,
                  (v.lat IS NULL),
                  bm25(villages_fts),
                  v.name
                LIMIT ?
                """,
                (match, q, q + "%", q, q, limit),
            ).fetchall()
            if add_rows(rows):
                return out
        except sqlite3.OperationalError:
            pass

    if len(out) < limit:
        like = "%" + q + "%"
        rows = con.execute(
            """
            SELECT lgd_code, name, name_local, district_name, state_name,
                   subdistrict_name, pincode, lat, lon
            FROM villages
            WHERE name LIKE ? OR name_local LIKE ? OR district_name LIKE ?
               OR subdistrict_name LIKE ?
            ORDER BY (lat IS NULL), name
            LIMIT ?
            """,
            (like, like, like, like, limit),
        ).fetchall()
        add_rows(rows)
    return out


def get_village(lgd: int) -> dict | None:
    row = db().execute(
        """
        SELECT lgd_code, name, name_local, district_name, state_name,
               subdistrict_name, pincode, lat, lon
        FROM villages WHERE lgd_code = ?
        """,
        (lgd,),
    ).fetchone()
    return village_json(row)


def near(lat: float, lon: float) -> dict | None:
    # Only villages that actually have coordinates. Cap ~30 km so a Delhi
    # user is not sent to Andhra because that's where the points are.
    dlat = 0.28
    dlon = 0.28 / max(0.2, math.cos(math.radians(lat)))
    rows = db().execute(
        """
        SELECT lgd_code, name, name_local, district_name, state_name,
               subdistrict_name, pincode, lat, lon
        FROM villages
        WHERE lat IS NOT NULL
          AND lat BETWEEN ? AND ?
          AND lon BETWEEN ? AND ?
        """,
        (lat - dlat, lat + dlat, lon - dlon, lon + dlon),
    ).fetchall()
    best = None
    best_d = 30.0  # km
    for row in rows:
        km = haversine(lat, lon, row["lat"], row["lon"])
        if km < best_d:
            best_d = km
            best = row
    if best is None:
        return None
    out = village_json(best)
    out["km"] = round(best_d, 2)
    return out


def haversine(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


class Handler(BaseHTTPRequestHandler):
    server_version = "MeraPlot/1"

    def log_message(self, fmt, *args):
        sys_stderr = __import__("sys").stderr
        sys_stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, code: int, body: bytes, content_type: str, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store" if content_type.startswith("application/json") else "public, max-age=30")
        if extra:
            for k, v in extra.items():
                self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, code: int, obj):
        body = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self._send(code, body, "application/json; charset=utf-8")

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        qs = parse_qs(parsed.query)

        if path == "/api/search":
            q = (qs.get("q") or [""])[0]
            try:
                self._json(200, search(q))
            except Exception as exc:
                self._json(500, {"error": "search_failed", "detail": str(exc)})
            return

        if path.startswith("/api/village/"):
            rest = path[len("/api/village/") :].strip("/")
            if not rest.isdigit():
                self._json(400, {"error": "bad_lgd"})
                return
            row = get_village(int(rest))
            if row is None:
                self._json(404, {"error": "not_found"})
                return
            self._json(200, row)
            return

        if path == "/api/near":
            try:
                lat = float((qs.get("lat") or [""])[0])
                lon = float((qs.get("lon") or [""])[0])
            except (TypeError, ValueError):
                self._json(400, {"error": "bad_latlon"})
                return
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                self._json(400, {"error": "bad_latlon"})
                return
            row = near(lat, lon)
            self._json(200, row if row is not None else {})
            return

        if path == "/api/health":
            n = db().execute("SELECT COUNT(*) c FROM villages").fetchone()["c"]
            self._json(200, {"ok": True, "villages": n})
            return

        self._static(path)

    def _static(self, path: str):
        if path == "/":
            path = "/index.html"
        rel = path.lstrip("/")
        target = (ROOT / rel).resolve()
        if not str(target).startswith(str(ROOT) + "/") and target != ROOT:
            self._send(403, b"forbidden", "text/plain")
            return
        if not target.is_file():
            self._send(404, b"not found", "text/plain")
            return
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype = ctype + "; charset=utf-8"
        data = target.read_bytes()
        self._send(200, data, ctype)


def main():
    if not DB_PATH.exists():
        raise SystemExit(f"missing {DB_PATH} — run scripts/build_db.py")
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Mera Plot http://{HOST}:{PORT}/  (sqlite {DB_PATH})")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
