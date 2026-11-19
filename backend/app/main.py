from datetime import datetime, timezone, timedelta
import random
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc, text
from sqlalchemy.dialects.sqlite import insert
from .db import Base, engine, get_db
from .models import Station, Observation, StationHealthLog
from .schemas import (
    StationOut,
    ObservationOut,
    TelemetryIn,
    EdgeTiltPayloadIn,
    HealthHistoryOut,
    RecoveryCommandIn,
)
from .seed import seed_stations
from .health import assess_station
from .ingest import import_csv_bytes
from .tilt import simulate_mems_xyz, process_mems_samples, classify_tilt_status

Base.metadata.create_all(bind=engine)
# Lightweight SQLite migration for existing installations.
with engine.begin() as connection:
    columns = {r[1] for r in connection.execute(text("PRAGMA table_info(observations)"))}
    if "battery_v" not in columns:
        connection.execute(text("ALTER TABLE observations ADD COLUMN battery_v FLOAT"))
    if "tilt_deg" not in columns:
        connection.execute(text("ALTER TABLE observations ADD COLUMN tilt_deg FLOAT"))
seed_stations()


def _record_health_snapshot(
    db: Session,
    assessment: dict,
    event_type: str = "DIAGNOSTIC_CHECK",
    note: str | None = None,
    timestamp_override: str | None = None,
    force: bool = False,
) -> StationHealthLog | None:
    """Persist a station health snapshot to SQLite (on status change or when forced)."""
    code = assessment["station_code"]
    mode = assessment.get("mode", "SIMULATED")
    if not force:
        last = (
            db.query(StationHealthLog)
            .filter(StationHealthLog.station_code == code, StationHealthLog.mode == mode)
            .order_by(desc(StationHealthLog.timestamp), desc(StationHealthLog.id))
            .first()
        )
        if last is not None and last.overall == assessment["overall"]:
            return None
    inds = assessment.get("indicators", {})
    log = StationHealthLog(
        station_code=code,
        timestamp=timestamp_override or assessment.get("reference_utc") or datetime.now(timezone.utc).isoformat(),
        mode=mode,
        overall=assessment["overall"],
        battery_status=inds.get("battery_stress", {}).get("status", "NO_DATA"),
        battery_val=inds.get("battery_stress", {}).get("value"),
        ice_status=inds.get("ice_locking", {}).get("status", "NO_DATA"),
        ice_val=inds.get("ice_locking", {}).get("value"),
        thermal_status=inds.get("thermal_shock", {}).get("status", "NO_DATA"),
        thermal_val=inds.get("thermal_shock", {}).get("value"),
        gap_status=inds.get("data_gap", {}).get("status", "NO_DATA"),
        gap_val=inds.get("data_gap", {}).get("value"),
        tilt_status=inds.get("structural_tilt", {}).get("status", "NO_DATA"),
        tilt_val=inds.get("structural_tilt", {}).get("value"),
        event_type=event_type,
        note=note,
    )
    db.add(log)
    return log


def _populate_demo_observations(db: Session, hours: int = 72) -> int:
    """Populate realistic 72h simulated observations and 48h health logs covering all 5 indicators."""
    stations = db.query(Station).all()
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    rng = random.Random(20261031)
    db.query(Observation).filter(Observation.source == "SIMULATED").delete()
    db.query(StationHealthLog).filter(StationHealthLog.mode == "SIMULATED").delete()
    count = 0
    imported_at = datetime.now(timezone.utc).isoformat()

    for idx, s in enumerate(stations):
        code = s.code
        base_temp = -23.0 if s.altitude_m < 500 else -35.0
        target_tilt = (
            5.8
            if code == "PAOLA"
            else 2.6
            if code == "ENEIDE"
            else rng.uniform(0.4, 1.1)
        )
        mems_samples = simulate_mems_xyz(
            target_tilt_deg=target_tilt,
            duration_sec=20,
            gust_deg=0.4,
            seed=20261031 + idx,
        )
        station_tilt = process_mems_samples(mems_samples)["tilt_deg"]

        # Pre-pick small non-zero physiological drops for regular stations
        reg_batt_drop = round(rng.uniform(0.04, 0.11), 2)
        reg_temp_drop = round(rng.uniform(1.5, 3.8), 1)
        ice_hours = rng.randint(0, 2)

        station_obs: list[Observation] = []
        for h in range(hours - 1, -1, -1):
            if code == "PAOLA" and h in (14, 15):
                continue
            if code == "RITA" and h in (2, 3, 4, 5, 6):
                continue

            ts = (now - timedelta(hours=h)).isoformat()

            # Temperature (°C)
            if code == "PAOLA":
                if h >= 4:
                    temp_c = round(-22.2 - 0.1 * (23 - min(h, 23)), 1)
                elif h == 3:
                    temp_c = round(-22.2 - 0.1 * 19 - 8.6, 1)
                else:
                    temp_c = round(-32.7 + 1.5 * (3 - h), 1)
            elif code == "SOFIA":
                if h >= 5:
                    temp_c = round(-22.0 + 0.2 * ((h - 5) % 4), 1)
                elif h == 4:
                    temp_c = -33.4
                else:
                    temp_c = round(-33.4 + 1.2 * (4 - h), 1)
            elif code == "ENEIDE":
                temp_c = round(-28.0 - 0.4 * (h % 4), 1)
            elif code == "JENNICA":
                temp_c = -27.5 if 2 <= h <= 15 else round(-25.0 - 0.5 * (h % 3), 1)
            else:
                if h == 5:
                    temp_c = round(base_temp, 1)
                elif h == 4:
                    temp_c = round(base_temp - reg_temp_drop, 1)
                else:
                    temp_c = round(base_temp - 0.6 * (h % 3), 1)

            # Battery voltage (V)
            if code == "PAOLA":
                if h >= 3:
                    batt_v = round(12.70 + 0.02 * (h - 3), 2)
                elif h == 2:
                    batt_v = 12.42
                else:
                    batt_v = round(12.42 - 0.04 * (2 - h), 2)
            elif code == "ENEIDE":
                if h >= 3:
                    batt_v = round(12.80 + 0.03 * (h - 3), 2)
                elif h == 2:
                    batt_v = 12.18
                else:
                    batt_v = round(12.18 - 0.04 * (2 - h), 2)
            else:
                if h == 3:
                    batt_v = 12.88
                elif h == 2:
                    batt_v = round(12.88 - reg_batt_drop, 2)
                else:
                    batt_v = round(12.84 + 0.02 * ((h % 4) - 1), 2)

            # Wind (kt / deg)
            if code == "PAOLA" and 3 <= h <= 9:
                wind_kt, wind_dir = 0.0, 200.0
            elif code == "JENNICA" and 2 <= h <= 15:
                wind_kt, wind_dir = 0.0, 180.0
            elif code not in ("PAOLA", "ENEIDE", "JENNICA", "SOFIA", "RITA") and 10 <= h < 10 + ice_hours:
                wind_kt, wind_dir = 0.0, 190.0
            else:
                wind_kt = round(rng.uniform(4.5, 28.0), 1)
                wind_dir = round(rng.uniform(140.0, 240.0), 1)

            # Progressive tilt across 72h so historical health log captures NORMAL -> WARNING -> CRITICAL
            if code == "PAOLA":
                row_tilt = 0.45 if h >= 30 else 2.8 if h >= 12 else station_tilt
            elif code == "ENEIDE":
                row_tilt = 0.65 if h >= 24 else station_tilt
            else:
                row_tilt = station_tilt

            row = Observation(
                station_code=code,
                timestamp=ts,
                temperature_c=temp_c,
                battery_v=batt_v,
                pressure_hpa=round(980 + rng.uniform(-15, 15), 1),
                humidity_pct=round(rng.uniform(45, 85), 1),
                wind_speed_kt=wind_kt,
                wind_direction_deg=wind_dir,
                tilt_deg=row_tilt,
                source="SIMULATED",
                quality="SIMULATED",
                imported_at=imported_at,
            )
            db.add(row)
            station_obs.append(row)
            count += 1

        # Generate 6 historical health checkpoints over the last 48 hours
        for offset_h in (48, 36, 24, 12, 6, 0):
            ref_time = (
                datetime.now(timezone.utc)
                if offset_h == 0
                else (now - timedelta(hours=offset_h) + timedelta(minutes=15))
            )
            checkpoint_assess = assess_station(code, station_obs, ref_time, "SIMULATED")
            ov = checkpoint_assess["overall"]
            cp_note = (
                "Controllo periodico telemetria e stralli"
                if ov == "OK"
                else "Rilevata anomalia iniziale da raffiche catabatiche / telemetria"
                if ov == "WARNING"
                else "Soglia critica superata: richiesto intervento di recupero"
                if ov == "CRITICAL"
                else "Verifica stato telemetria AWS"
            )
            _record_health_snapshot(
                db,
                checkpoint_assess,
                event_type="DIAGNOSTIC_CHECK",
                note=cp_note,
                timestamp_override=ref_time.isoformat(),
                force=True,
            )

    db.commit()
    return count


def ensure_demo_data() -> None:
    """Ensure fresh simulated data and health logs exist on startup."""
    from .db import SessionLocal

    db = SessionLocal()
    try:
        sim_count = db.query(Observation).filter(Observation.source == "SIMULATED").count()
        log_count = db.query(StationHealthLog).filter(StationHealthLog.mode == "SIMULATED").count()
        latest_row = (
            db.query(Observation)
            .filter(Observation.source == "SIMULATED")
            .order_by(desc(Observation.timestamp))
            .first()
        )
        stale = True
        if latest_row is not None and latest_row.tilt_deg is not None:
            try:
                latest_dt = datetime.fromisoformat(str(latest_row.timestamp).replace("Z", "+00:00"))
                if latest_dt.tzinfo is None:
                    latest_dt = latest_dt.replace(tzinfo=timezone.utc)
                stale = (datetime.now(timezone.utc) - latest_dt.astimezone(timezone.utc)) > timedelta(hours=2)
            except ValueError:
                stale = True
        if sim_count < 100 or log_count == 0 or stale:
            _populate_demo_observations(db, hours=72)
    finally:
        db.close()


ensure_demo_data()
app = FastAPI(title="Antarctic Weather Observatory API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "antarctic-observatory", "time_utc": datetime.now(timezone.utc).isoformat()}

@app.get("/api/stations", response_model=list[StationOut])
def stations(db: Session = Depends(get_db)):
    return db.query(Station).order_by(Station.name).all()

@app.get("/api/observations", response_model=list[ObservationOut])
def observations(station: str | None = None, mode: str = Query("HISTORICAL", pattern="^(HISTORICAL|SIMULATED)$"), limit: int = Query(48, ge=1, le=2000), db: Session = Depends(get_db)):
    q = db.query(Observation).filter(Observation.source == mode)
    if station: q = q.filter(Observation.station_code == station.upper())
    return q.order_by(desc(Observation.timestamp)).limit(limit).all()

@app.post("/api/import/historical")
async def import_historical(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Caricare un file CSV.")
    content = await file.read()
    try:
        # Validate station codes before committing rows.
        import pandas as pd
        from io import StringIO
        from .ingest import normalize_frame
        normalized = normalize_frame(pd.read_csv(StringIO(content.decode("utf-8-sig"))))
        known = {s[0] for s in db.query(Station.code).all()}
        unknown = sorted(set(normalized.station_code) - known)
        if unknown: raise ValueError("Codici stazione sconosciuti: " + ", ".join(unknown))
        count = import_csv_bytes(db, content)
        return {"imported": count, "source": "HISTORICAL", "quality": "NOT_ASSESSED", "message": "Importazione completata; i dati non sono stati validati scientificamente."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(400, str(exc))

@app.post("/api/demo/generate")
def generate_demo(hours: int = Query(72, ge=1, le=720), db: Session = Depends(get_db)):
    """Generate explicitly simulated observations for UI testing only."""
    count = _populate_demo_observations(db, hours=hours)
    return {"generated": count, "source": "SIMULATED", "warning": "Valori sintetici: non sono misurazioni ENEA-PNRA."}


def _normalize_iso_utc(ts: str) -> str:
    try:
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(400, f"Timestamp ISO-8601 non valido: {ts}") from exc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def _upsert_observation(db: Session, row: dict) -> None:
    stmt = insert(Observation).values(**row).on_conflict_do_update(
        index_elements=["station_code", "timestamp", "source"],
        set_={
            k: v
            for k, v in row.items()
            if k not in ("station_code", "timestamp", "source") and v is not None
        },
    )
    db.execute(stmt)


def _log_station_updates(db: Session, touched: set[tuple[str, str]], note: str) -> None:
    """Assess touched (station_code, mode) pairs and record snapshot if overall state changed."""
    ref = datetime.now(timezone.utc)
    for code, source in touched:
        obs = (
            db.query(Observation)
            .filter(Observation.station_code == code, Observation.source == source)
            .all()
        )
        assessment = assess_station(code, obs, ref, source)
        _record_health_snapshot(db, assessment, event_type="DIAGNOSTIC_CHECK", note=note, force=False)


@app.post("/api/telemetry")
def ingest_telemetry(payload: TelemetryIn | list[TelemetryIn], db: Session = Depends(get_db)):
    """Receive weather and battery telemetry packets via HTTP POST/JSON from the AWS simulator."""
    items = payload if isinstance(payload, list) else [payload]
    known = {s[0] for s in db.query(Station.code).all()}
    now = datetime.now(timezone.utc).isoformat()
    count = 0
    touched: set[tuple[str, str]] = set()
    for item in items:
        code = item.station_code.strip().upper()
        if code not in known:
            raise HTTPException(400, f"Codice stazione sconosciuto: {code}")
        source = (item.source or "SIMULATED").strip().upper()
        if source not in ("SIMULATED", "HISTORICAL"):
            source = "SIMULATED"
        row = {
            "station_code": code,
            "timestamp": _normalize_iso_utc(item.timestamp),
            "temperature_c": item.temperature_c,
            "battery_v": item.battery_v,
            "pressure_hpa": item.pressure_hpa,
            "humidity_pct": item.humidity_pct,
            "wind_speed_kt": item.wind_speed_kt,
            "wind_direction_deg": item.wind_direction_deg,
            "tilt_deg": item.tilt_deg,
            "source": source,
            "quality": source,
            "imported_at": now,
        }
        _upsert_observation(db, row)
        touched.add((code, source))
        count += 1
    db.commit()
    _log_station_updates(db, touched, "Aggiornamento automatico da telemetria AWS")
    db.commit()
    return {"status": "ok", "saved": count}


@app.post("/api/edge/tilt")
def ingest_edge_tilt(payload: EdgeTiltPayloadIn, db: Session = Depends(get_db)):
    """Receive 25 Hz MEMS samples or processed tilt angle from the IoT Edge simulator."""
    code = payload.station_code.strip().upper()
    if not db.get(Station, code):
        raise HTTPException(400, f"Codice stazione sconosciuto: {code}")

    if payload.samples:
        pipeline = process_mems_samples([s.model_dump() for s in payload.samples])
    elif payload.tilt_deg is not None:
        tilt_val = round(float(payload.tilt_deg), 2)
        pipeline = {
            "tilt_deg": tilt_val,
            "vibration_rms_deg": round(0.08 + 0.22 * tilt_val, 2),
            "status": classify_tilt_status(tilt_val),
            "calibration_vector": None,
            "sec_medians": [],
            "moving_averages_10s": [],
            "sample_count": 0,
        }
    else:
        raise HTTPException(400, "Fornire 'samples' MEMS oppure 'tilt_deg'.")

    source = (payload.source or "SIMULATED").strip().upper()
    if source not in ("SIMULATED", "HISTORICAL"):
        source = "SIMULATED"
    ts = _normalize_iso_utc(payload.timestamp)
    row = {
        "station_code": code,
        "timestamp": ts,
        "tilt_deg": pipeline["tilt_deg"],
        "source": source,
        "quality": source,
        "imported_at": datetime.now(timezone.utc).isoformat(),
    }
    _upsert_observation(db, row)
    db.commit()
    _log_station_updates(db, {(code, source)}, "Aggiornamento strutturale IoT Edge MEMS 25Hz")
    db.commit()
    status = pipeline["status"]
    return {
        "station_code": code,
        "timestamp": ts,
        "label": "NORMAL" if status == "OK" else status,
        **pipeline,
    }


@app.get("/api/edge/simulate")
def simulate_edge_tilt(
    station: str = Query("PAOLA"),
    target_tilt_deg: float = Query(3.2, ge=0.0, le=45.0),
    duration_sec: int = Query(20, ge=6, le=120),
):
    """Run a real-time 25 Hz MEMS simulation and return calibration, 1s medians, and 10s moving avg."""
    samples = simulate_mems_xyz(target_tilt_deg=target_tilt_deg, duration_sec=duration_sec)
    pipeline = process_mems_samples(samples)
    status = pipeline["status"]
    return {
        "station_code": station.strip().upper(),
        "fs_hz": 25,
        "calib_seconds": 5,
        "calib_samples": 125,
        "moving_avg_window_sec": 10,
        "target_tilt_deg": target_tilt_deg,
        "duration_sec": duration_sec,
        "label": "NORMAL" if status == "OK" else status,
        **pipeline,
    }

@app.get("/api/source-status")
def source_status():
    return {
        "realtime": {"status": "PORTAL_ONLY", "url": "https://www.climantartide.it/realtime/graph/index.php", "note": "Il portale espone grafici interattivi; non è stato verificato un endpoint pubblico machine-readable. Nessuna acquisizione automatica viene simulata."},
        "historical": {"status": "CSV_IMPORT", "url": "https://www.climantartide.it/dataaccess/index.php", "note": "Importare CSV ottenuti tramite le procedure di accesso e il protocollo ENEA-PNRA applicabile."},
        "attribution": "Meteorological dataset and information are achieved by the Italian Antarctic Meteo-Climatological Observatory (IAMCO) https://www.climantartide.it of the PNRA"
    }


@app.get("/api/aws-health")
def aws_health(station: str | None = None,
               mode: str = Query("SIMULATED", pattern="^(HISTORICAL|SIMULATED)$"),
               end: datetime | None = None,
               db: Session = Depends(get_db)):
    """Health diagnostics relative to a reference time; no unverified live data."""
    reference = (end or datetime.now(timezone.utc))
    if reference.tzinfo is None:
        raise HTTPException(400, "Il parametro end deve contenere un fuso orario (es. Z).")
    reference = reference.astimezone(timezone.utc)
    stations_query = db.query(Station)
    if station:
        stations_query = stations_query.filter(Station.code == station.upper())
    result = []
    for s in stations_query.order_by(Station.name).all():
        # Query only this station/source; the assessor enforces exact UTC time windows.
        obs = db.query(Observation).filter(Observation.station_code == s.code,
                                           Observation.source == mode).all()
        result.append(assess_station(s.code, obs, reference, mode))
    return {"reference_utc": reference.isoformat(), "mode": mode,
            "stations": result, "warning": "Indicatori sperimentali: non equivalgono a diagnosi hardware o misura della qualità satellitare."}


RECOVERY_ACTUATORS = {
    "battery_stress": "Commutazione BMS su Batteria Tampone LiFePO4 coibentata + Riscaldatore Cella",
    "ice_locking": "Attivazione Riscaldatore Anti-Ghiaccio Anemometro (De-Icing Nichrome 15W)",
    "thermal_shock": "Attivazione Scudo Termico Attivo e Parzializzazione Ventole Box Datalogger",
    "data_gap": "Ritrasmissione Burst Satellitare Iridium SBD dal Buffer Locale MicroSD",
    "structural_tilt": "Azionamento Tensionatore Elettromeccanico Stralli + Ricalibrazione Zero MEMS 25Hz",
}


@app.get("/api/aws-health/history", response_model=list[HealthHistoryOut])
def aws_health_history(
    station: str,
    mode: str = Query("SIMULATED", pattern="^(HISTORICAL|SIMULATED)$"),
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Return persistent diagnostic health state history for a single AWS station."""
    code = station.strip().upper()
    if not db.get(Station, code):
        raise HTTPException(400, f"Codice stazione sconosciuto: {code}")
    rows = (
        db.query(StationHealthLog)
        .filter(StationHealthLog.station_code == code, StationHealthLog.mode == mode)
        .order_by(desc(StationHealthLog.timestamp), desc(StationHealthLog.id))
        .limit(limit)
        .all()
    )
    if not rows:
        obs = (
            db.query(Observation)
            .filter(Observation.station_code == code, Observation.source == mode)
            .all()
        )
        assessment = assess_station(code, obs, datetime.now(timezone.utc), mode)
        _record_health_snapshot(
            db,
            assessment,
            event_type="DIAGNOSTIC_CHECK",
            note="Snapshot diagnostico iniziale",
            force=True,
        )
        db.commit()
        rows = (
            db.query(StationHealthLog)
            .filter(StationHealthLog.station_code == code, StationHealthLog.mode == mode)
            .order_by(desc(StationHealthLog.timestamp), desc(StationHealthLog.id))
            .limit(limit)
            .all()
        )
    return rows


@app.post("/api/aws-health/recover")
def recover_aws_station(payload: RecoveryCommandIn, db: Session = Depends(get_db)):
    """Execute remote self-healing IoT recovery command on a station in WARNING or CRITICAL."""
    code = payload.station_code.strip().upper()
    if not db.get(Station, code):
        raise HTTPException(400, f"Codice stazione sconosciuto: {code}")

    indicator_key = (payload.indicator or "ALL").strip()
    if indicator_key == "ALL":
        targets = list(RECOVERY_ACTUATORS.keys())
    elif indicator_key in RECOVERY_ACTUATORS:
        targets = [indicator_key]
    else:
        raise HTTPException(400, f"Indicatore non valido: {indicator_key}")

    now_utc = datetime.now(timezone.utc)
    now_hour = now_utc.replace(minute=0, second=0, microsecond=0)
    cutoff = now_hour - timedelta(hours=24)
    now_iso = now_utc.isoformat()

    obs_all = (
        db.query(Observation)
        .filter(Observation.station_code == code, Observation.source == "SIMULATED")
        .all()
    )

    def _parse_obs_dt(ts_str: str) -> datetime | None:
        try:
            dt = datetime.fromisoformat(str(ts_str).replace("Z", "+00:00"))
            return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None

    if "data_gap" in targets:
        by_hour = {}
        for o in obs_all:
            dt = _parse_obs_dt(o.timestamp)
            if dt is not None and dt.minute == 0 and dt.second == 0:
                by_hour[dt.replace(microsecond=0)] = o
        for h in range(24):
            slot_dt = now_hour - timedelta(hours=h)
            if slot_dt not in by_hour:
                new_obs = Observation(
                    station_code=code,
                    timestamp=slot_dt.isoformat(),
                    temperature_c=-25.0,
                    battery_v=12.95,
                    pressure_hpa=985.0,
                    humidity_pct=65.0,
                    wind_speed_kt=8.2,
                    wind_direction_deg=195.0,
                    tilt_deg=0.45,
                    source="SIMULATED",
                    quality="SIMULATED",
                    imported_at=now_iso,
                )
                db.add(new_obs)
                obs_all.append(new_obs)

    recent_obs = []
    for o in obs_all:
        dt = _parse_obs_dt(o.timestamp)
        if dt is not None and dt >= cutoff:
            recent_obs.append((dt, o))
    recent_obs.sort(key=lambda pair: pair[0])

    for idx, (_, o) in enumerate(recent_obs):
        if "battery_stress" in targets:
            o.battery_v = round(13.05 - 0.02 * (idx % 3), 2)
        if "ice_locking" in targets and (o.wind_speed_kt == 0 or o.wind_speed_kt is None):
            o.wind_speed_kt = 8.4
            o.wind_direction_deg = round(180.0 + (idx % 5) * 3.0, 1)
        if "thermal_shock" in targets:
            o.temperature_c = round(-25.0 - 0.8 * (idx % 3), 1)
        if "structural_tilt" in targets:
            o.tilt_deg = 0.42

    db.commit()

    refreshed_obs = (
        db.query(Observation)
        .filter(Observation.station_code == code, Observation.source == "SIMULATED")
        .all()
    )
    new_assessment = assess_station(code, refreshed_obs, datetime.now(timezone.utc), "SIMULATED")
    actions_desc = " + ".join(RECOVERY_ACTUATORS[t] for t in targets)
    _record_health_snapshot(
        db,
        new_assessment,
        event_type="REMOTE_RECOVERY",
        note=f"Telecomando eseguito: {actions_desc}",
        timestamp_override=datetime.now(timezone.utc).isoformat(),
        force=True,
    )
    db.commit()
    return {
        "status": "ok",
        "station_code": code,
        "indicator": indicator_key,
        "actuator": actions_desc,
        "assessment": new_assessment,
    }

@app.get('/api/demo/scenario-config')
def scenario_config():
    from .scenarios import scenario_configuration
    return scenario_configuration()

@app.get('/api/demo/scenario-health')
def scenario_health(step: int = Query(0, ge=0, le=2), db: Session = Depends(get_db)):
    """Three independent, deterministic snapshots for a training exercise. No DB writes."""
    from .scenarios import scenario_snapshot
    codes = [s.code for s in db.query(Station).order_by(Station.name).all()]
    return scenario_snapshot(codes, step)


@app.get('/api/demo/timeline')
def demo_timeline(step: int = Query(0, ge=0, le=12), db: Session = Depends(get_db)):
    from .timeline import snapshot
    codes = [x.code for x in db.query(Station).all()]
    return snapshot(codes, step)

@app.get('/api/demo/timeline-config')
def demo_timeline_config():
    from .timeline import load_config
    return load_config()
