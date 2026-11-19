# Funzionalità — Marconi AWS Observer Dashboard

Documentazione completa delle funzionalità implementate nella piattaforma **Marconi AWS Observer Dashboard — Antarctic Weather Observatory (ENEA · PNRA · IAMCO)**.

---

## 1. Panoramica Generale & Obiettivo del Sistema

La piattaforma è una dashboard web *full-screen map-first* (ispirata a *Windy.com*) progettata per il monitoraggio meteorologico, energetico, trasmissivo e strutturale delle stazioni automatiche antartiche del **Programma Nazionale di Ricerche in Antartide (PNRA)** gestite da **ENEA · IAMCO**:

- **17 Stazioni Meteorologiche Automatiche (AWS)**: `Alessandra`, `Arelis`, `Concordia`, `Eneide`, `Guilia`, `Irene`, `Jennica`, `Lola`, `Lucia`, `Maria`, `Modesta`, `Paola`, `Rita`, `Silvia`, `Sofia`, `Sofiab`, `Zoraida`.
- **2 Basi Antartiche di Riferimento**: *Base Concordia* (Dome C, 3233 m s.l.m.) e *Base Mario Zucchelli - MZS* (Baia Terra Nova, 15 m s.l.m.).
- **Obiettivo Operativo**: offrire un quadro situazionale immediato sulla mappa polare antartica, integrando telemetria oraria (temperatura, pressione, umidità, vento, tensione batteria), diagnostica predittiva multi-parametrica, rilevazione strutturale IoT Edge MEMS a `25 Hz`, simulazione evolutiva guidata degli allarmi e comandi remoti di ripristino (*Self-Healing*).

---

## 2. Cartografia Polare Interattiva (GIS & NASA GIBS)

Implementata in `frontend/src/components/PolarMap.jsx` e `frontend/src/components/polarMapConfig.js`:

- **Proiezione Stereografica Polare Antartica `EPSG:3031`**: configurata tramite **Proj4** e **Proj4Leaflet** (`+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs`) con livelli di zoom da `0` a `10` (risoluzioni da `16384 m/px` fino a `16 m/px`).
- **Cartografia Satellitare NASA GIBS / Earthdata (WMS)**: integrazione WMS (`https://gibs.earthdata.nasa.gov/wms/epsg3031/best/wms.cgi`) con switch dinamico tra:
  - **MODIS Terra** (`MODIS_Terra_CorrectedReflectance_TrueColor`, risoluzione `250 m`)
  - **VIIRS SNPP** (`VIIRS_SNPP_CorrectedReflectance_TrueColor`, risoluzione `500 m`)
- **Smart Station Zoom & De-clustering Radiale (`computeClusterOffsets` & `getSmartStationZoom`)**:
  - Calcolo dinamico di offset radiali in screen-space ai bassi livelli di zoom (`zoom < 9`, soglia distanza `22 px`) per separare visivamente i marker ravvicinati (es. cluster Baia Terra Nova: *Eneide*, *Jennica*, *Base Mario Zucchelli*) senza alterare le coordinate geografiche reali.
  - Calcolo automatico dello zoom ottimale alla selezione in base alla distanza dal vicino più prossimo (`z9` se `< 2 km`, `z7` se `< 25 km`, `z6` altrimenti).
- **Controlli & Marker sulla Mappa**:
  - Controlli di navigazione custom (`+`, indicatore livello zoom `z`, `−`, pulsante `⌖` *Vista panoramica Antartide z3* centrata su Baia Terra Nova / MZS).
  - Marker semaforici circolari per le **17 AWS** (con effetto pulsante sullo stato `CRITICAL` ed etichette sempre visibili per stazioni selezionate o in `WARNING`/`CRITICAL`) e marker a diamante per le **2 Basi**.
  - **Filtro Layer Metrico**: colorazione dei marker in base allo stato complessivo (`overall`) oppure a un singolo indicatore diagnostico (`battery_stress`, `ice_locking`, `thermal_shock`, `data_gap`, `structural_tilt`).

---

## 3. Motore Diagnostico Multi-Parametrico (5 Indicatori di Salute AWS)

Il motore backend (`backend/app/health.py` e `backend/app/tilt.py`) valuta ogni stazione su finestra mobile UTC di **24 ore** (allineata alle letture orarie esatte) e classifica ciascun indicatore e lo stato globale (`overall`, per priorità `CRITICAL > WARNING > INSUFFICIENT > NO_DATA > OK`) secondo i seguenti criteri:

| Indicatore | Unità | Logica & Finestra di Analisi | Soglie Operazionali (`OK` / `WARNING` / `CRITICAL`) |
|---|---|---|---|
| **1. Battery Stress** (`battery_stress`) | `V/h` | Massima discesa oraria della tensione (`dV/dt`) in ore fredde (`T < -20 °C`) su finestra **12h** (fallback **24h**) | `OK`: `> -0.2` · `WARNING`: `<= -0.2` · `CRITICAL`: `<= -0.5` |
| **2. Ice Locking** (`ice_locking`) | `h` | Ore consecutive con vento nullo (`0 kt`), direzione invariata e `T < -20 °C` (senza pontare gap) | `OK`: `< 6h` (con `>= 12` ore valide) · `WARNING`: `>= 6h` · `CRITICAL`: `>= 12h` |
| **3. Thermal Shock Rate** (`thermal_shock`) | `°C/h` | Massima variazione negativa della temperatura tra due ore strettamente consecutive | `OK`: `> -8` · `WARNING`: `<= -8` · `CRITICAL`: `<= -10` |
| **4. Data Gap Rate** (`data_gap`) | `%` | Percentuale di slot orari mancanti sui 24 attesi nelle ultime 24h | `OK`: `24/24` (`0%`) · `WARNING`: `21–23/24` · `CRITICAL`: `< 21/24` |
| **5. Structural Tilt** (`structural_tilt`) | `°` | Pipeline IoT Edge MEMS `25 Hz` su accelerometro triassiale + calcolo vibrazione RMS | `NORMAL (OK)`: `[0°, 2°[` · `WARNING`: `[2°, 5°[` · `CRITICAL`: `>= 5°` |

### Dettaglio Pipeline IoT Edge MEMS a 25 Hz (`backend/app/tilt.py`)
Progettata per il nodo hardware target **`STM32 NUCLEO-F401RE` + `X-NUCLEO-IKS02A1` (`IIS2DLPC`)**:
1. **Calibrazione iniziale**: primi `5 s` (`125` campioni a `25 Hz`) per determinare il vettore gravità di riferimento `(ax_ref, ay_ref, az_ref)`.
2. **Angolo istantaneo**: variazione angolare in gradi rispetto al vettore di riferimento tramite prodotto scalare.
3. **Filtro mediano**: mediana su finestre di `1 s` (`25` campioni consecutivi).
4. **Media mobile**: media mobile su `10` valori mediani consecutivi (`10 s`).
5. **Vibrazione stralli**: deviazione standard angolare (`vibration_rms_deg`).

---

## 4. Regia Automatica degli Allarmi (`useAlertDirector` & `AlertSpotlight`)

Implementata in `frontend/src/hooks/useAlertDirector.js`, `frontend/src/utils/alerts.js` e `frontend/src/components/AlertSpotlight.jsx`:

- **Rilevamento Transizioni Peggiorative**: confronta gli snapshot consecutivi durante la simulazione (`step >= 1`, usando `step 0` come baseline) e accoda in ordine FIFO (dando priorità a `CRITICAL` rispetto a `WARNING`) le stazioni che peggiorano di stato.
- **Camera Fly-To & Focus**: per ciascun evento in coda, seleziona automaticamente la stazione, esegue il `flyTo` con zoom adattivo (`getSmartStationZoom`) e visualizza il banner ad alta visibilità **Alert Spotlight** per `3.5 s` con nome stazione, località, timestamp simulato (`t = ... s`) e dettagli degli indicatori coinvolti.
- **Ritorno Panoramico & Controllo**: al termine della coda deseleziona la stazione e riporta la camera alla vista panoramica (`overview`). La regia automatica è attivabile/disattivabile dal toggle dedicato nel pannello *Controllo Rete*.

---

## 5. Simulatore Scenari Evolutivi & Timeline Bar (`TimelineBar`)

Implementata in `frontend/src/components/TimelineBar.jsx`, `frontend/src/App.jsx` e `backend/app/timeline.py`:

- **Barra Temporale `SIM 120s`**: copre `120 s` suddivisi in `13` step da `10 s` (`t = 0 s` fino a `t = 120 s`) guidati dal dataset CSV/JSON `backend/data/scenario_120s.csv` e `backend/data/scenario_120s.json`.
- **Controlli Interattivi & Scorciatoie Tastiera**:
  - Pulsanti **Play / Pausa**, selezione diretta di ogni singolo step sulla barra (con indicatore semaforico dello stato peggiore di rete per ciascuno step) e pulsante **Esci** per tornare alla telemetria live del database.
  - Scorciatoie da tastiera: `Spazio` (Play/Pausa), `Freccia Sinistra` / `Freccia Destra` (navigazione tra gli step).
- **Sincronizzazione con la Regia Automatica**: l'avanzamento automatico (ogni `3.5 s`) viene sospeso finché `director.isBusy` è attivo, impedendo che lo step successivo interrompa la presentazione *Alert Spotlight* di un allarme in corso.

---

## 6. Interfaccia Utente & Pannelli Flottanti Glassmorphism

- **Station Card (`frontend/src/components/StationCard.jsx`)**: scheda sintetica flottante alla selezione di una stazione AWS o base PNRA, con badge di stato, valori istantanei (Temperatura, Vento velocità/direzione, Pressione, Umidità, Batteria, Tilt MEMS) e accesso rapido al modale di dettaglio o al portale ClimAntartide.
- **Control Menu (`frontend/src/components/ControlMenu.jsx`, `ControlMenuLayers.jsx`, `ControlMenuDataSection.jsx`)**: pannello slide-over destro (*Controllo Rete*) con:
  - Pulsante di apertura sempre visibile con badge contatore anomalie attivo (`WARNING` / `CRITICAL`).
  - Riepilogo stato della rete delle 17 AWS (contatori `NORMAL`, `WARN`, `CRIT`, `N/D` e barra proporzionale).
  - Chip di accesso rapido agli allarmi attivi, selettore rapido di tutte le 17 stazioni e 2 basi, toggle *Regia allarmi automatica*.
  - Selettore layer diagnostico sulla mappa (griglia 2×3) e switch cartografia satellitare (`MODIS Terra 250m` / `VIIRS SNPP 500m`).
  - Switch sorgente dati (`SIMULATED` / `HISTORICAL`), rigenerazione dataset demo 72h e upload file `.csv`.
- **Modal Dettaglio Stazione a 2 Colonne (`frontend/src/components/StationDetailDrawer.jsx`, `DrawerRiskCards.jsx`, `DrawerRiskCharts.jsx`)**:
  - Colonna sinistra: striscia metriche istantanee, banner **Telecomando IoT di Recupero Attivo (Self-Healing AWS)** per ripristino globale (`ALL`) e schede dei 5 indicatori con pulsante di attivazione singolo attuatore per gli indicatori in `WARNING` o `CRITICAL`.
  - Colonna destra con switch tra 3 viste:
    1. *Temperatura 72h*: grafico `AreaChart` *Recharts* delle ultime 72 osservazioni.
    2. *Simulazione 120s*: 5 mini-grafici predittivi/evolutivi *Recharts* con bande colorate (`ReferenceArea`) e linee di soglia (`ReferenceLine`) per `WARNING` e `CRITICAL`.
    3. *Storico Salute*: registro cronologico persistente (`StationHealthLog`) da SQLite degli eventi `DIAGNOSTIC_CHECK` e `REMOTE_RECOVERY` (con badge dettagliati per ciascun indicatore e riepilogo degli step in simulazione).
- **Telecomando di Self-Healing / Recupero Remoto IoT (`POST /api/aws-health/recover`)**:
  - `battery_stress`: *Commutazione BMS su Batteria Tampone LiFePO4 coibentata + Riscaldatore Cella*.
  - `ice_locking`: *Attivazione Riscaldatore Anti-Ghiaccio Anemometro (De-Icing Nichrome 15W)*.
  - `thermal_shock`: *Attivazione Scudo Termico Attivo e Parzializzazione Ventole Box Datalogger*.
  - `data_gap`: *Ritrasmissione Burst Satellitare Iridium SBD dal Buffer Locale MicroSD*.
  - `structural_tilt`: *Azionamento Tensionatore Elettromeccanico Stralli + Ricalibrazione Zero MEMS 25Hz*.
- **Modal Centro Salute Rete (`frontend/src/components/HealthOverviewModal.jsx`, `ModalCardsGrid.jsx`, `ModalHealthTable.jsx`)**: vista comparativa delle 17 stazioni AWS ordinate per gravità, con switch vista *Griglia* / *Tabella*, filtri KPI (`Tutte`, `Critiche`, `Warning`, `Regolari`, `Senza dati`), ricerca testuale per nome/località/codice, switch `SIMULATED` / `HISTORICAL` e salto diretto sulla mappa alla selezione.

---

## 7. Modalità Dati (`SIMULATED` vs `HISTORICAL`) & Importazione CSV

- **Separazione Rigorosa dei Dataset**: ogni record in `observations` e `station_health_logs` è partizionato per `source`/`mode` (`SIMULATED` o `HISTORICAL`).
- **Dataset Simulato (`SIMULATED`)**: generatore deterministico all'avvio e su richiesta (`POST /api/demo/generate`) che popola 72h di telemetria oraria e 6 checkpoint di salute nelle ultime 48h con anomalie realistiche su stazioni campione (`PAOLA`, `ENEIDE`, `SOFIA`, `JENNICA`, `RITA`).
- **Importazione Dati Storici (`HISTORICAL` via `POST /api/import/historical`)**: upload multipart di file `.csv` conformi al formato IAMCO / ClimAntartide, con normalizzazione flessibile degli header (`backend/app/ingest.py`), parsing timestamp UTC, validazione dei codici stazione rispetto all'anagrafica `stations` e salvataggio con upsert idempotente.

---

## 8. Simulatori Hardware & Telemetria Esterni (`simulators/`)

Due script standalone Python 3 (solo libreria standard, nessuna dipendenza esterna):

- **`simulators/aws_simulator.py`**: legge i file CSV di scenario (es. `backend/data/scenario_120s.csv`), supporta modalità `--dry-run` e `--interval`, e invia i pacchetti di telemetria meteo/batteria/tilt via `HTTP POST/JSON` a `POST /api/telemetry`.
- **`simulators/iot_edge_simulator.py`**: emula il nodo edge **`STM32 NUCLEO-F401RE` + `X-NUCLEO-IKS02A1` (`IIS2DLPC`)** generando accelerazioni triassiali `(timestamp, ax, ay, az)` a `25 Hz` in formato CSV, eseguendo calibrazione `5 s`, filtro mediano `1 s` e media mobile `10 s`, e trasmettendo i campioni raw (`--send-raw`) o il risultato elaborato a `POST /api/edge/tilt`.

---

## 9. Architettura API REST (FastAPI) & Persistenza (SQLite + SQLAlchemy)

### Modelli Database (`backend/app/models.py` — SQLite 3 + SQLAlchemy 2.0)
- **`Station`** (`stations`): anagrafica delle 17 AWS (`code`, `name`, `location`, `latitude`, `longitude`, `altitude_m`, `source_url`, `variables`).
- **`Observation`** (`observations`): rilevazioni orarie/telemetriche (`station_code`, `timestamp`, `temperature_c`, `battery_v`, `pressure_hpa`, `humidity_pct`, `wind_speed_kt`, `wind_direction_deg`, `tilt_deg`, `source`, `quality`, `imported_at`) con vincolo univoco `(station_code, timestamp, source)`.
- **`StationHealthLog`** (`station_health_logs`): storico persistente degli stati diagnostici e degli interventi di recupero remoto (`station_code`, `timestamp`, `mode`, `overall`, stati e valori dei 5 indicatori, `event_type`, `note`).

### Endpoint REST (`backend/app/main.py`)

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET` | `/api/health` | Verifica stato servizio e timestamp UTC corrente |
| `GET` | `/api/stations` | Elenco delle 17 stazioni AWS ordinate per nome |
| `GET` | `/api/observations` | Ultime osservazioni filtrate per `station`, `mode` (`SIMULATED`/`HISTORICAL`) e `limit` |
| `POST` | `/api/import/historical` | Upload CSV storico validato e importazione in modalità `HISTORICAL` |
| `POST` | `/api/demo/generate` | Rigenerazione dataset simulato `SIMULATED` (default `72` ore, max `720`) |
| `POST` | `/api/telemetry` | Ingestione pacchetti JSON singoli o batch dal simulatore AWS (con upsert e snapshot salute) |
| `POST` | `/api/edge/tilt` | Ricezione stream MEMS `25 Hz` raw o angolo elaborato dal simulatore IoT Edge |
| `GET` | `/api/edge/simulate` | Simulazione on-demand della pipeline MEMS `25 Hz` con calibrazione, mediane 1s e medie mobili 10s |
| `GET` | `/api/source-status` | Stato informativo e attribuzione delle sorgenti ufficiali ENEA / PNRA / IAMCO |
| `GET` | `/api/aws-health` | Valutazione diagnostica dei 5 indicatori per tutte le stazioni (o singola stazione) |
| `GET` | `/api/aws-health/history` | Cronologia persistente degli snapshot di salute e recuperi (`StationHealthLog`) |
| `POST` | `/api/aws-health/recover` | Esecuzione telecomando di Self-Healing per singolo indicatore o globale (`ALL`) |
| `GET` | `/api/demo/scenario-config` | Configurazione dello scenario evolutivo multi-fase (`scenario_evolution.json`) |
| `GET` | `/api/demo/scenario-health` | Snapshot deterministici a 3 fasi (`step` `0..2`) per esercitazione senza scrittura su DB |
| `GET` | `/api/demo/timeline` | Snapshot evolutivo step-by-step della timeline `0–120s` (`step` `0..12`) |
| `GET` | `/api/demo/timeline-config` | Configurazione e soglie della timeline `120s` (`scenario_120s.json`) |
