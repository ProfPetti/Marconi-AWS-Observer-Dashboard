#!/usr/bin/env python3
"""Simulatore IoT Edge (Monitoraggio Inclinazione - Python - CSV).

Emula l'architettura hardware target ENEA/PNRA:
  - Sensore accelerometrico MEMS triassiale IIS2DLPC (X-NUCLEO-IKS02A1) a 25 Hz
    (25 campioni/s, 1500 campioni/minuto) su CSV (timestamp, ax, ay, az).
  - Microcontrollore STM32 NUCLEO-F401RE:
      1) Calibrazione iniziale sui primi 5 secondi (125 campioni)
      2) Calcolo deviazione angolare rispetto al vettore di calibrazione
      3) Mediana su finestra di 1 secondo (25 campioni)
      4) Media mobile su 10 valori mediani consecutivi (10 secondi)
      5) Classificazione Structural Tilt: NORMAL [0°,2°[, WARNING [2°,5°[, CRITICAL [5°,+∞[
      6) Trasmissione HTTP POST/JSON su /api/edge/tilt.

Zero dipendenze esterne: usa esclusivamente la libreria standard Python.
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
import random
import statistics
import urllib.error
import urllib.request

FS_HZ = 25
CALIB_SECONDS = 5
MOVING_AVG_WINDOW = 10
DEFAULT_URL = "http://localhost:8000/api/edge/tilt"


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def norm3(x: float, y: float, z: float) -> float:
    return math.sqrt(x * x + y * y + z * z)


def classify_structural_tilt(tilt_deg: float | None) -> str:
    if tilt_deg is None:
        return "INSUFFICIENT"
    if tilt_deg >= 5.0:
        return "CRITICAL"
    if tilt_deg >= 2.0:
        return "WARNING"
    return "NORMAL"


def generate_mems_csv(
    csv_path: Path,
    target_tilt_deg: float,
    duration_sec: int,
    gust_deg: float,
    seed: int,
) -> list[dict]:
    """Parte 1: genera stream accelerazioni XYZ a 25 Hz (1500 campioni/min) su CSV."""
    rng = random.Random(seed)
    t0 = datetime.now(timezone.utc)
    total_samples = duration_sec * FS_HZ
    calib_samples = CALIB_SECONDS * FS_HZ
    dt_step = timedelta(seconds=1.0 / FS_HZ)
    azimuth_rad = math.radians(30.0)

    samples: list[dict] = []
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["timestamp", "ax", "ay", "az"])
        writer.writeheader()
        for idx in range(total_samples):
            ts = (t0 + idx * dt_step).isoformat()
            if idx < calib_samples:
                angle_rad = 0.0
            else:
                t_post = (idx - calib_samples) / FS_HZ
                gust = gust_deg * math.sin(2.0 * math.pi * t_post / 3.5) + (
                    0.35 * gust_deg * math.sin(2.0 * math.pi * t_post / 1.1)
                )
                angle_rad = math.radians(target_tilt_deg + gust)

            ax = round(math.sin(angle_rad) * math.cos(azimuth_rad) + rng.gauss(0.0, 0.005), 5)
            ay = round(math.sin(angle_rad) * math.sin(azimuth_rad) + rng.gauss(0.0, 0.005), 5)
            az = round(math.cos(angle_rad) + rng.gauss(0.0, 0.005), 5)
            row = {"timestamp": ts, "ax": ax, "ay": ay, "az": az}
            writer.writerow(row)
            samples.append(row)
    return samples


def read_mems_csv(csv_path: Path) -> list[dict]:
    samples: list[dict] = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            samples.append(
                {
                    "timestamp": row["timestamp"].strip(),
                    "ax": float(row["ax"]),
                    "ay": float(row["ay"]),
                    "az": float(row["az"]),
                }
            )
    return samples


def run_mcu_edge_pipeline(samples: list[dict], fs: int = FS_HZ, calib_sec: int = CALIB_SECONDS) -> dict:
    """Parte 2: elaborazione simulata su microcontrollore NUCLEO-F401RE."""
    calib_count = fs * calib_sec
    if len(samples) <= calib_count:
        return {"tilt_deg": None, "status": "INSUFFICIENT", "sec_medians": [], "moving_avg_10s": []}

    calib = samples[:calib_count]
    ax_ref = sum(s["ax"] for s in calib) / calib_count
    ay_ref = sum(s["ay"] for s in calib) / calib_count
    az_ref = sum(s["az"] for s in calib) / calib_count
    ref_norm = norm3(ax_ref, ay_ref, az_ref)

    angles: list[float] = []
    for s in samples[calib_count:]:
        a_norm = norm3(s["ax"], s["ay"], s["az"])
        if a_norm <= 1e-9 or ref_norm <= 1e-9:
            continue
        dot = s["ax"] * ax_ref + s["ay"] * ay_ref + s["az"] * az_ref
        cos_theta = clamp(dot / (a_norm * ref_norm), -1.0, 1.0)
        angles.append(math.degrees(math.acos(cos_theta)))

    sec_medians = [
        round(statistics.median(angles[i : i + fs]), 4)
        for i in range(0, len(angles), fs)
    ]
    moving_avg_10s = [
        round(sum(sec_medians[max(0, idx - MOVING_AVG_WINDOW + 1) : idx + 1]) / len(sec_medians[max(0, idx - MOVING_AVG_WINDOW + 1) : idx + 1]), 4)
        for idx in range(len(sec_medians))
    ]
    final_tilt = round(moving_avg_10s[-1], 2) if moving_avg_10s else None
    return {
        "tilt_deg": final_tilt,
        "status": classify_structural_tilt(final_tilt),
        "calibration_vector": (round(ax_ref, 5), round(ay_ref, 5), round(az_ref, 5)),
        "sec_medians": sec_medians,
        "moving_avg_10s": moving_avg_10s,
    }


def post_json(url: str, payload: dict, timeout: float = 10.0) -> dict:
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


def main(args: argparse.Namespace) -> int:
    if args.csv_in:
        csv_path = Path(args.csv_in).resolve()
        if not csv_path.exists():
            print(f"[ERRORE] File CSV MEMS non trovato: {csv_path}")
            return 1
        samples = read_mems_csv(csv_path)
        print(f"[IoT Edge] Letti {len(samples)} campioni MEMS da {csv_path}")
    else:
        csv_path = Path(args.csv_out).resolve()
        samples = generate_mems_csv(
            csv_path=csv_path,
            target_tilt_deg=args.target_tilt,
            duration_sec=args.duration,
            gust_deg=args.gust,
            seed=args.seed,
        )
        print(
            f"[IoT Edge] Generati {len(samples)} campioni MEMS a {FS_HZ} Hz "
            f"({args.duration}s) -> {csv_path}"
        )

    mcu_out = run_mcu_edge_pipeline(samples)
    print(
        f"[NUCLEO-F401RE] Calib 5s ref={mcu_out.get('calibration_vector')} | "
        f"Mediane 1s={len(mcu_out['sec_medians'])} | "
        f"Media mobile 10s -> tilt={mcu_out['tilt_deg']}° ({mcu_out['status']})"
    )

    ts = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0).isoformat()
    payload: dict = {
        "station_code": args.station.strip().upper(),
        "timestamp": args.timestamp or ts,
        "source": "SIMULATED",
    }
    if args.send_raw:
        payload["samples"] = samples
    else:
        payload["tilt_deg"] = mcu_out["tilt_deg"]

    if args.dry_run:
        preview = {**payload, "samples": f"<{len(samples)} samples>"} if args.send_raw else payload
        print(f"[DRY-RUN] Payload pronto per {args.url}:\n{json.dumps(preview, indent=2)}")
        return 0

    try:
        resp = post_json(args.url, payload)
        print(f"[OK] Risposta backend /api/edge/tilt: {resp}")
    except urllib.error.URLError as exc:
        print(f"[ERRORE HTTP] Impossibile raggiungere {args.url}: {exc}")
        return 1
    return 0


def build_parser() -> argparse.ArgumentParser:
    default_out = Path(__file__).resolve().parent / "mems_stream_25hz.csv"
    parser = argparse.ArgumentParser(
        description="Simulatore IoT Edge MEMS 25 Hz (NUCLEO-F401RE + IIS2DLPC)."
    )
    parser.add_argument("--station", default="PAOLA", help="Codice stazione AWS (default: PAOLA)")
    parser.add_argument("--target-tilt", type=float, default=3.2, help="Inclinazione target in gradi")
    parser.add_argument("--duration", type=int, default=60, help="Durata simulazione in secondi (default: 60s = 1500 campioni)")
    parser.add_argument("--gust", type=float, default=0.8, help="Ampiezza raffiche di vento in gradi")
    parser.add_argument("--seed", type=int, default=42, help="Seed deterministico")
    parser.add_argument("--csv-out", default=str(default_out), help="Percorso CSV generato a 25 Hz")
    parser.add_argument("--csv-in", default=None, help="Leggi campioni MEMS da CSV esistente invece di generarli")
    parser.add_argument("--timestamp", default=None, help="Timestamp ISO-8601 UTC dell'osservazione")
    parser.add_argument("--url", default=DEFAULT_URL, help="Endpoint HTTP POST /api/edge/tilt")
    parser.add_argument("--send-raw", action="store_true", help="Invia tutti i campioni raw 25 Hz al backend")
    parser.add_argument("--dry-run", action="store_true", help="Elabora senza inviare HTTP POST")
    return parser


if __name__ == "__main__":
    raise SystemExit(main(build_parser().parse_args()))

