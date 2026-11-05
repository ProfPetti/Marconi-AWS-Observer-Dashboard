from datetime import datetime, timezone
from io import StringIO
import pandas as pd
from sqlalchemy.dialects.sqlite import insert
from .models import Observation

# Supported import headers. Exported data should be normalized to these names.
ALIASES = {
    "station_code": ["station_code", "station", "aws", "stazione"],
    "timestamp": ["timestamp", "datetime", "date_time", "data_ora", "data"],
    "temperature_c": ["temperature_c", "temperature", "temp", "t"],
    "battery_v": ["battery_v", "battery_voltage", "voltage_v", "voltage", "volt", "vbatt"],
    "pressure_hpa": ["pressure_hpa", "pressure", "pres", "p"],
    "humidity_pct": ["humidity_pct", "humidity", "rh", "u"],
    "wind_speed_kt": ["wind_speed_kt", "wind_speed", "windspeed", "v"],
    "wind_direction_deg": ["wind_direction_deg", "wind_direction", "winddir", "d"],
}


def normalize_frame(raw: pd.DataFrame) -> pd.DataFrame:
    raw.columns = [str(c).strip().lower().replace(" ", "_") for c in raw.columns]
    rename = {}
    for target, names in ALIASES.items():
        for n in names:
            if n in raw.columns:
                rename[n] = target
                break
    df = raw.rename(columns=rename)
    required = {"station_code", "timestamp"}
    if not required.issubset(df.columns):
        raise ValueError("CSV non riconosciuto: servono almeno station_code e timestamp.")
    for col in ALIASES:
        if col not in df.columns:
            df[col] = None
    df["station_code"] = df["station_code"].astype(str).str.strip().str.upper().str.replace(" ", "_", regex=False)
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce", utc=True).dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    df = df.dropna(subset=["timestamp"])
    for c in ["battery_v", "temperature_c", "pressure_hpa", "humidity_pct", "wind_speed_kt", "wind_direction_deg"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df[list(ALIASES)].drop_duplicates(subset=["station_code", "timestamp"])


def import_csv_bytes(db, content: bytes):
    raw = pd.read_csv(StringIO(content.decode("utf-8-sig")))
    df = normalize_frame(raw)
    known = {r[0] for r in db.query(Observation.station_code).distinct().all()}
    # Station codes are validated against the station table by the API before this function.
    now = datetime.now(timezone.utc).isoformat()
    count = 0
    for _, r in df.iterrows():
        row = {
            "station_code": r.station_code,
            "timestamp": r.timestamp,
            "temperature_c": None if pd.isna(r.temperature_c) else float(r.temperature_c),
            "battery_v": None if pd.isna(r.battery_v) else float(r.battery_v),
            "pressure_hpa": None if pd.isna(r.pressure_hpa) else float(r.pressure_hpa),
            "humidity_pct": None if pd.isna(r.humidity_pct) else float(r.humidity_pct),
            "wind_speed_kt": None if pd.isna(r.wind_speed_kt) else float(r.wind_speed_kt),
            "wind_direction_deg": None if pd.isna(r.wind_direction_deg) else float(r.wind_direction_deg),
            "source": "HISTORICAL", "quality": "NOT_ASSESSED", "imported_at": now,
        }
        stmt = insert(Observation).values(**row).on_conflict_do_update(
            index_elements=["station_code", "timestamp", "source"],
            set_={k: v for k, v in row.items() if k not in ("station_code", "timestamp", "source")}
        )
        db.execute(stmt)
        count += 1
    db.commit()
    return count
