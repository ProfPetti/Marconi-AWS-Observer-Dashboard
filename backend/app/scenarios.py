"""Read synthetic hourly telemetry from external CSV; diagnostic rules live in health.py."""
from pathlib import Path
from datetime import datetime, timezone
from types import SimpleNamespace
import csv
import json
from .health import assess_station

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

def scenario_snapshot(codes, step):
    config = json.loads((DATA_DIR / "scenario_evolution.json").read_text(encoding="utf-8"))
    stages = config["stages"]
    if not 0 <= step < len(stages):
        raise ValueError("Fase di simulazione non valida")
    stage = stages[step]
    reference = datetime.fromisoformat(config["reference_utc"].replace("Z", "+00:00"))
    if reference.tzinfo is None:
        raise ValueError("reference_utc deve includere il fuso orario")
    observations = {code: [] for code in codes}
    with (DATA_DIR / config["csv"]).open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            if row["stage"] != stage["id"] or row["station_code"] not in observations:
                continue
            def numeric(key):
                value = row.get(key, "").strip()
                return float(value) if value else None
            observations[row["station_code"]].append(SimpleNamespace(
                timestamp=row["timestamp"],
                battery_v=numeric("battery_v"),
                temperature_c=numeric("temperature_c"),
                wind_speed_kt=numeric("wind_speed_kt"),
                wind_direction_deg=numeric("wind_direction_deg"),
                humidity_pct=numeric("humidity_pct"),
                pressure_hpa=numeric("pressure_hpa"),
                tilt_deg=numeric("tilt_deg")))
    return {
        "scenario": config["scenario"], "step": step,
        "stage": stage["id"], "reference_utc": reference.isoformat(),
        "mode": "SIMULATED", "stations": [
            assess_station(code, observations[code], reference, "SIMULATED") for code in codes
        ],
        "warning": "ESERCITAZIONE: telemetria sintetica esterna, non dati ENEA e non allarmi reali.",
        "narrative": stage.get("narrative", "")
    }


def scenario_configuration():
    config = json.loads((DATA_DIR / "scenario_evolution.json").read_text(encoding="utf-8"))
    return {"scenario": config["scenario"], "stages": config["stages"], "reference_utc": config["reference_utc"]}
