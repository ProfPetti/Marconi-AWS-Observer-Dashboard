# Stack Tecnologico — Marconi AWS Observer Dashboard

Report strutturato delle tecnologie, librerie e servizi utilizzati nel progetto **Antarctic Weather Observatory (ENEA · PNRA · IAMCO)**.

---

## 1. Frontend (`frontend/`)

- **Linguaggio:** JavaScript (`ES Modules` / `.jsx`)
- **Framework UI:** **React** (`^18.3.1`) e **React DOM** (`^18.3.1`)
  - Architettura modulare basata su componenti presentazionali e container (`App.jsx`) con gestione esplicita tramite `props` e React Hooks (`useState`, `useEffect`, `useMemo`, `useRef`).
- **Build Tool & Dev Server:** **Vite** (`^6.3.5`) con `@vitejs/plugin-react` (`^4.4.1`)
  - Eseguito in sviluppo sulla porta `5173` con Hot Module Replacement (HMR).
- **Cartografia & GIS:**
  - **Leaflet** (`^1.9.4`) + **React-Leaflet** (`^4.2.1`): mappa interattiva a tutto schermo (`100vw x 100vh`), marker dinamici (`L.divIcon`) e popup informativi.
  - **Proj4** (`^2.19.10`) + **Proj4Leaflet** (`^1.0.2`): trasformazione di coordinate e gestione della proiezione stereografica polare antartica **`EPSG:3031`** (`+proj=stere +lat_0=-90 +lat_ts=-71`).
- **Grafici & Visualizzazione Dati:**
  - **Recharts** (`^2.15.3`): grafici vettoriali responsivi (`AreaChart`, `ReferenceArea`, `ReferenceLine`, `Tooltip`) per l'andamento della temperatura (72h) e per le curve predittive con soglie di allarme.
- **Styling & Design System:**
  - **CSS3 Nativo** (`frontend/src/styles.css`): layout full-screen map-first ispirato a *Windy.com*, pannelli flottanti in *glassmorphism* (`backdrop-filter: blur`), design semaforico ad alto contrasto (`OK`, `WARNING`, `CRITICAL`) e media query responsive.

---

## 2. Backend (`backend/`)

- **Linguaggio & Runtime:** **Python 3**
- **Ambiente di Esecuzione:** Ambiente virtuale Python isolato (`backend/.venv`)
- **Framework Web API:** **FastAPI** (`0.115.12`)
  - Espone le REST API JSON (`/api/stations`, `/api/observations`, `/api/aws-health`, `/api/telemetry`, `/api/edge/tilt`, `/api/edge/simulate`, `/api/demo/timeline`, `/api/demo/generate`, `/api/import/historical`)
  - Genera automaticamente la documentazione interattiva OpenAPI / Swagger UI su `http://localhost:8000/docs`
  - Gestisce il middleware CORS per la comunicazione con il frontend (`:5173`).
- **Server ASGI:** **Uvicorn** (`0.34.2` con extra `[standard]`)
  - Eseguito sulla porta `8000` con flag `--reload` in ambiente di sviluppo.
- **Validazione & Schemi Dati:** **Pydantic** (`2.14.0`)
  - Serializzazione e validazione tipizzata dei payload (`StationOut`, `ObservationOut`, `TelemetryIn`, `MemsSampleIn`, `EdgeTiltPayloadIn`).
- **Motore Diagnostico & Pipeline MEMS 25 Hz (`backend/app/health.py`, `backend/app/tilt.py`):**
  - Valuta i **5 indicatori diagnostici e strutturali** con classificazione `NORMAL` (`OK`), `WARNING`, `CRITICAL`:
    1. **Battery Stress** (`V/h`, finestra 12h con fallback 24h a `T < -20 °C`)
    2. **Ice Locking** (`h`, vento nullo e direzione invariata per 12h a `T < -20 °C`)
    3. **Thermal Shock Rate** (`°C/h`, raffreddamento rapido orario)
    4. **Data Gap Rate** (`%`, slot orari mancanti su 24h)
    5. **Structural Tilt** (`°`, inclinazione strutturale MEMS a `25 Hz`: calibrazione iniziale `5 s` / `125` campioni, mediana su `1 s` / `25` campioni, media mobile su `10` valori mediani consecutivi; soglie `NORMAL [0°, 2°[`, `WARNING [2°, 5°[`, `CRITICAL [5°, +∞[`).
- **Data Processing & Ingestione CSV:**
  - **Pandas** (`2.2.3`): lettura, pulizia, normalizzazione delle colonne e validazione dei dataset storici importati via CSV e calcolo degli snapshot per la simulazione evolutiva.
  - **Python-Multipart** (`0.0.20`): supporto per l'upload di file `.csv` tramite form multipart.

---

## 3. Database (`DB`)

- **DBMS:** **SQLite 3**
  - Database relazionale embedded salvato su file locale (nessun server database esterno richiesto).
- **ORM (Object-Relational Mapper):** **SQLAlchemy** (`2.0.41`)
  - Utilizza `DeclarativeBase` (stile SQLAlchemy 2.0) e gestione delle sessioni tramite dependency injection di FastAPI (`get_db`).
  - Include migrazione automatica leggera all'avvio (`PRAGMA table_info` / `ALTER TABLE`).
- **Modelli Principali (`backend/app/models.py`):**
  - `Station`: anagrafica delle 17 stazioni AWS antartiche (codice, nome, località, latitudine, longitudine, quota, URL fonte).
  - `Observation`: rilevazioni meteorologiche orarie (temperatura, pressione, umidità, velocità e direzione del vento, tensione batteria `battery_v`, inclinazione strutturale `tilt_deg`, modalità `SIMULATED` o `HISTORICAL`).

---

## 3bis. Simulatori Client-Server (`simulators/`)

- **Simulatore AWS (`simulators/aws_simulator.py`):**
  - Legge i file CSV di telemetria meteorologica e diagnostica (es. `backend/data/scenario_120s.csv`) e trasmette i pacchetti JSON via `HTTP POST` verso `/api/telemetry` usando la libreria standard Python (`urllib.request`).
- **Simulatore IoT Edge MEMS 25 Hz (`simulators/iot_edge_simulator.py`):**
  - Emula il nodo hardware target **`STM32 NUCLEO-F401RE` + `X-NUCLEO-IKS02A1` (`IIS2DLPC`)**: genera accelerazioni triassiali `(timestamp, ax, ay, az)` a `25 Hz` (`25 campioni/s`, `1500 campioni/minuto`) in formato CSV, applica la calibrazione iniziale di `5 s` (`125 campioni`), la mediana su `1 s` (`25 campioni`) e la media mobile su `10 s`, e invia il risultato JSON via `HTTP POST` verso `/api/edge/tilt`.

---

## 4. Servizi Esterni & Fonti Dati

- **Cartografia Satellitare (WMS):** **NASA GIBS / NASA Earthdata**
  - Endpoint WMS in proiezione polare `EPSG:3031` (`https://gibs.earthdata.nasa.gov/wms/epsg3031/best/wms.cgi`)
  - Layer utilizzati:
    - `MODIS_Terra_CorrectedReflectance_TrueColor` (risoluzione `250 m`)
    - `VIIRS_SNPP_CorrectedReflectance_TrueColor` (risoluzione `500 m`)
- **Dati Meteo & Censimento Stazioni:** **ENEA · PNRA · IAMCO** (*Italian Antarctic Meteo-Climatological Observatory* — portale [ClimAntartide](https://www.climantartide.it)).

---

## 5. Automazione & Avvio (`start.sh`)

- **Script Bash (`./start.sh`):**
  - Rileva automaticamente l'installazione di Node.js/npm (incluso il supporto a `nvm`).
  - Crea e popola automaticamente il virtualenv Python (`backend/.venv`) installando `requirements.txt` se assente.
  - Installa automaticamente `node_modules` nel frontend se necessario.
  - Avvia in parallelo Backend (`http://localhost:8000`) e Frontend (`http://localhost:5173`) gestendo la chiusura sincronizzata dei processi con `CTRL+C` (`trap EXIT INT TERM`).
