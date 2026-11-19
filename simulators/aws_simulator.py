#!/usr/bin/env python3
"""Simulatore AWS (Telemetria meteorologica e diagnostica - Python - CSV).

Legge un dataset CSV di scenario (es. backend/data/scenario_120s.csv) e invia i
pacchetti telemetrici al backend FastAPI via HTTP POST/JSON su /api/telemetry.
Zero dipendenze esterne: usa esclusivamente la libreria standard Python.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
import time
import urllib.error
import urllib.request

DEFAULT_CSV = (
    Path(__file__).resolve().parents[1] / "backend" / "data" / "scenario_120s.csv"
)
DEFAULT_URL = "http://localhost:8000/api/telemetry"
NUMERIC_FIELDS = (
    "temperature_c",
    "battery_v",
    "pressure_hpa",
    "humidity_pct",
    "wind_speed_kt",
    "wind_direction_deg",
    "tilt_deg",
)


def _optional_float(raw: str | None) -> float | None:
    if raw is None:
        return None
    stripped = raw.strip()
    return float(stripped) if stripped else None


def load_csv_records(
    csv_path: Path,
    station_filter: str | None = None,
    stage_filter: str | None = None,
    source: str = "SIMULATED",
) -> list[dict]:
    """Load telemetry rows from CSV and convert them to /api/telemetry payloads."""
    records: list[dict] = []
    target_station = station_filter.strip().upper() if station_filter else None
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            if stage_filter and row.get("stage", "").strip() != stage_filter:
                continue
            code = (row.get("station_code") or "").strip().upper()
            if not code:
                continue
            if target_station and code != target_station:
                continue
            payload: dict = {
                "station_code": code,
                "timestamp": (row.get("timestamp") or "").strip(),
                "source": source,
            }
            for field in NUMERIC_FIELDS:
                payload[field] = _optional_float(row.get(field))
            records.append(payload)
    return records


def post_json(url: str, payload: list[dict] | dict, timeout: float = 10.0) -> dict:
    """Send JSON payload via HTTP POST using urllib.request."""
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {"status": resp.status}


def run_simulator(args: argparse.Namespace) -> int:
    csv_path = Path(args.csv).resolve()
    if not csv_path.exists():
        print(f"[ERRORE] File CSV non trovato: {csv_path}")
        return 1

    records = load_csv_records(
        csv_path=csv_path,
        station_filter=args.station,
        stage_filter=args.stage,
        source=args.source,
    )
    if not records:
        print("[INFO] Nessun record da trasmettere dopo i filtri applicati.")
        return 0

    print(
        f"[AWS Simulator] Caricati {len(records)} record da {csv_path.name} "
        f"-> target {args.url}"
    )

    if args.once:
        batch = records[: args.batch_size]
        if args.dry_run:
            print(f"[DRY-RUN] Invio singolo batch da {len(batch)} record:")
            print(json.dumps(batch[0], indent=2))
            return 0
        res = post_json(args.url, batch)
        print(f"[OK] Risposta backend: {res}")
        return 0

    # Group by timestamp so each simulation step is transmitted in chronological waves
    by_ts: dict[str, list[dict]] = {}
    for rec in records:
        by_ts.setdefault(rec["timestamp"], []).append(rec)

    sent_total = 0
    for ts in sorted(by_ts.keys()):
        wave = by_ts[ts]
        if args.dry_run:
            print(f"[DRY-RUN] {ts}: {len(wave)} stazioni pronte all'invio")
        else:
            try:
                res = post_json(args.url, wave)
                sent_total += res.get("saved", len(wave))
                print(f"[POST] {ts}: salvati {res.get('saved', len(wave))} record")
            except urllib.error.URLError as exc:
                print(f"[ERRORE HTTP] {ts}: {exc}")
                return 1
        if args.interval > 0:
            time.sleep(args.interval)

    print(f"[AWS Simulator] Completato. Record trasmessi: {sent_total if not args.dry_run else len(records)}.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Simulatore AWS: legge CSV meteo/batteria e invia HTTP POST/JSON al backend."
    )
    parser.add_argument("--csv", default=str(DEFAULT_CSV), help="Percorso del file CSV sorgente")
    parser.add_argument("--url", default=DEFAULT_URL, help="Endpoint HTTP POST /api/telemetry")
    parser.add_argument("--station", default=None, help="Filtra per codice stazione (es. ENEIDE)")
    parser.add_argument("--stage", default=None, help="Filtra per colonna stage (se presente nel CSV)")
    parser.add_argument("--source", default="SIMULATED", choices=["SIMULATED", "HISTORICAL"])
    parser.add_argument("--interval", type=float, default=0.5, help="Pausa in secondi tra step temporali")
    parser.add_argument("--batch-size", type=int, default=20, help="Dimensione batch in modalità --once")
    parser.add_argument("--once", action="store_true", help="Invia un solo batch e termina")
    parser.add_argument("--dry-run", action="store_true", help="Simula senza effettuare chiamate HTTP")
    return parser


if __name__ == "__main__":
    raise SystemExit(run_simulator(build_parser().parse_args()))

