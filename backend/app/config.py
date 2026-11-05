from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = Path(os.getenv("DB_PATH", str(DATA_DIR / "observatory.sqlite3")))
STATIONS_CSV = Path(os.getenv("STATIONS_CSV", str(DATA_DIR / "stazioni_meteo_antartide_enea.csv")))
