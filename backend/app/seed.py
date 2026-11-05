import pandas as pd
from .config import STATIONS_CSV
from .db import SessionLocal
from .models import Station


def seed_stations():
    df = pd.read_csv(STATIONS_CSV)
    db = SessionLocal()
    try:
        for _, r in df.iterrows():
            # Preserve the CSV spelling in name; code is a stable URL-friendly identifier.
            code = str(r["Nome_stazione"]).strip().upper().replace(" ", "_")
            obj = db.get(Station, code)
            values = dict(
                code=code,
                name=str(r["Nome_stazione"]).strip(),
                location=str(r["Localita"]).strip(),
                latitude=float(r["Latitude"]),
                longitude=float(r["Longitude"]),
                altitude_m=int(r["Altezza"]),
                source_url=str(r["URL"]).strip(),
                variables=str(r["Misure"]).replace(" ", ""),
            )
            if obj:
                for k, v in values.items(): setattr(obj, k, v)
            else:
                db.add(Station(**values))
        db.commit()
    finally:
        db.close()
