from datetime import datetime, timezone, timedelta
import random
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc, text
from .db import Base, engine, get_db
from .models import Station, Observation
from .schemas import StationOut, ObservationOut
from .seed import seed_stations
from .health import assess_station
from .ingest import import_csv_bytes

Base.metadata.create_all(bind=engine)
# Lightweight SQLite migration for existing installations.
with engine.begin() as connection:
    columns = {r[1] for r in connection.execute(text("PRAGMA table_info(observations)"))}
    if "battery_v" not in columns:
        connection.execute(text("ALTER TABLE observations ADD COLUMN battery_v FLOAT"))
seed_stations()
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
    stations = db.query(Station).all()
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    rng = random.Random(20261031)
    count = 0
    for s in stations:
        base_temp = -18 if s.altitude_m < 500 else -35
        for h in range(hours):
            ts = (now - timedelta(hours=h)).isoformat()
            row = Observation(
                station_code=s.code, timestamp=ts,
                temperature_c=round(base_temp + rng.uniform(-8, 8), 1),
                pressure_hpa=round(980 + rng.uniform(-25, 25), 1),
                humidity_pct=round(rng.uniform(35, 90), 1),
                wind_speed_kt=round(rng.uniform(0, 35), 1),
                wind_direction_deg=round(rng.uniform(0, 359), 1),
                source="SIMULATED", quality="SIMULATED", imported_at=datetime.now(timezone.utc).isoformat()
            )
            db.add(row); count += 1
    db.commit()
    return {"generated": count, "source": "SIMULATED", "warning": "Valori sintetici: non sono misurazioni ENEA-PNRA."}

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
