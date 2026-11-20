# Todo List — Allineamento Scheda Concorso ENEA / PNRA 2026

## Task 1: Modulo MEMS 25 Hz e Calcolo Structural Tilt (`backend/app/tilt.py`)
**Description:** Implementare la simulazione fisica dell'accelerometro triassiale MEMS (`ax, ay, az`) a 25 Hz (25 campioni/s, 1500 campioni/min) con rumore e raffiche simulate, calibrazione iniziale sui primi 5 secondi (125 campioni), calcolo variazione angolare rispetto al riferimento di calibrazione, mediana su 1 secondo (25 campioni) e media mobile su 10 valori mediani consecutivi (10 secondi).
**Acceptance criteria:**
- [x] Funzione `simulate_mems_stream(target_tilt_deg, duration_sec, gust_deg, seed)` che genera campioni `(t, ax, ay, az)` a 25 Hz con primi 5s di calibrazione a riposo e successiva inclinazione/raffica.
- [x] Funzione `process_mems_samples(samples, fs=25, calib_sec=5)` che esegue calibrazione sui primi `5 * 25 = 125` campioni, calcola l'angolo in gradi per ogni campione, calcola la mediana ogni 25 campioni (1s) e la media mobile su finestra di 10 mediane (10s).
- [x] Funzione `assess_structural_tilt(tilt_deg)` che classifica in `[0°, 2°[` (`OK` / `NORMAL`), `[2°, 5°[` (`WARNING`), `[5°, +∞[` (`CRITICAL`).
**Dependencies:** None
**Files likely touched:** `backend/app/tilt.py`

## Task 2: Persistenza SQLite `tilt_deg` ed Endpoint `HTTP POST/JSON` (`models.py`, `schemas.py`, `ingest.py`, `main.py`)
**Description:** Aggiungere `tilt_deg` al modello `Observation`, la migrazione automatica SQLite all'avvio, gli schemi Pydantic per la validazione dei pacchetti inviati dai simulatori e gli endpoint `POST /api/telemetry` e `POST /api/edge/tilt`, oltre ad arricchire `POST /api/demo/generate` con `battery_v` e `tilt_deg`.
**Acceptance criteria:**
- [x] `Observation` in `backend/app/models.py` e `ObservationOut` in `backend/app/schemas.py` includono `tilt_deg: float | None = None`.
- [x] Migrazione automatica in `backend/app/main.py` aggiunge `tilt_deg FLOAT` alla tabella `observations` se non presente.
- [x] `POST /api/telemetry` accetta un payload singolo o lista JSON validata con Pydantic e salva su SQLite.
- [x] `POST /api/edge/tilt` accetta campioni MEMS 25 Hz (o angolo pre-elaborato dal microcontrollore simulato), calcola la mediana 1s + media mobile 10s, salva `tilt_deg` su SQLite e restituisce il risultato diagnostico.
- [x] `POST /api/demo/generate` genera valori realistici anche per `battery_v` e `tilt_deg` (usando il modulo MEMS).
**Dependencies:** Task 1
**Files likely touched:** `backend/app/models.py`, `backend/app/schemas.py`, `backend/app/ingest.py`, `backend/app/main.py`

## Task 3: Health Engine a 5 Indicatori e Scenari CSV (`health.py`, `timeline.py`, `scenarios.py`, `backend/data/*`)
**Description:** Integrare `structural_tilt` nel motore diagnostico (`health.py`), nella timeline accelerata (`timeline.py`) e negli scenari evolutivi (`scenarios.py`), aggiornando `scenario_120s.json`, `scenario_120s.csv` e `scenario_evolution.csv` per includere `tilt_deg` e mostrare un evento di inclinazione strutturale (`WARNING` -> `CRITICAL`).
**Acceptance criteria:**
- [x] `assess_station` in `backend/app/health.py` restituisce `structural_tilt` insieme a `battery_stress`, `ice_locking`, `thermal_shock`, `data_gap` e allinea la finestra di `battery_stress` alle 12 ore previste dalla scheda.
- [x] `backend/data/scenario_120s.json` include la soglia `"structural_tilt": {"warning": 2.0, "critical": 5.0, "unit": "°"}`.
- [x] `backend/data/scenario_120s.csv` e `backend/data/scenario_evolution.csv` includono la colonna `tilt_deg` con progressione da `NORMAL` (< 2°) a `WARNING` (2°–5°) fino a `CRITICAL` (>= 5°).
- [x] `backend/app/timeline.py` e `backend/app/scenarios.py` passano e calcolano `structural_tilt`.
**Dependencies:** Task 1, Task 2
**Files likely touched:** `backend/app/health.py`, `backend/app/timeline.py`, `backend/app/scenarios.py`, `backend/data/scenario_120s.json`, `backend/data/scenario_120s.csv`, `backend/data/scenario_evolution.csv`

## Task 4: Simulatori Esterni Python (`simulators/aws_simulator.py`, `simulators/iot_edge_simulator.py`)
**Description:** Creare i due simulatori descritti nello schema architetturale della scheda: il **Simulatore AWS** (telemetria meteorologica e diagnostica da CSV inviata via `HTTP POST/JSON`) e il **Simulatore IoT Edge** (generazione accelerazioni XYZ a 25 Hz in CSV + simulatore microcontrollore `NUCLEO-F401RE` / `IIS2DLPC` che applica calibrazione 5s, mediana 1s su 25 campioni, media mobile 10s e invia via `HTTP POST/JSON` al backend).
**Acceptance criteria:**
- [x] `simulators/aws_simulator.py` eseguibile da CLI (anche in modalità `--dry-run` o `--once`) che legge CSV e invia `HTTP POST/JSON` a `/api/telemetry`.
- [x] `simulators/iot_edge_simulator.py` che simula sia la generazione raw MEMS 25 Hz `(timestamp, ax, ay, az)` su CSV sia l'elaborazione edge del microcontrollore (5s calibrazione, mediana 25 campioni, media mobile 10s) e invia a `/api/edge/tilt`.
**Dependencies:** Task 1, Task 2
**Files likely touched:** `simulators/aws_simulator.py`, `simulators/iot_edge_simulator.py`, `simulators/README.md`

## Task 5: Aggiornamento Frontend React per Structural Tilt e 5 Indicatori
**Description:** Integrare `structural_tilt` nel frontend React: configurazione costanti (`awsConfig.js`), selettore Layer Diagnostico sulla mappa (`ControlMenuLayers.jsx`), card e grafici nel modale stazione (`DrawerRiskCards.jsx`, `DrawerRiskCharts.jsx`, `StationCard.jsx`), griglia e tabella nel Centro Salute (`ModalHealthTable.jsx`, `ModalCardsGrid.jsx`) ed etichette `NORMAL / WARNING / CRITICAL`.
**Acceptance criteria:**
- [x] `RISK_KEYS` in `frontend/src/constants/awsConfig.js` contiene i 5 indicatori (`battery_stress`, `ice_locking`, `thermal_shock`, `data_gap`, `structural_tilt`) e `STATUS_LABEL_3.OK` mostra `"NORMAL"`.
- [x] `ControlMenuLayers.jsx` permette di filtrare la mappa polare anche per `"structural_tilt"` (`Inclinazione`).
- [x] `DrawerRiskCards.jsx`, `DrawerRiskCharts.jsx`, `ModalHealthTable.jsx` e `ModalCardsGrid.jsx` mostrano tutti e 5 gli indicatori (inclusa l'inclinazione in `°`) con layout pulito e responsivo.
**Dependencies:** Task 3
**Files likely touched:** `frontend/src/constants/awsConfig.js`, `frontend/src/components/ControlMenuLayers.jsx`, `frontend/src/components/DrawerRiskCards.jsx`, `frontend/src/components/DrawerRiskCharts.jsx`, `frontend/src/components/StationCard.jsx`, `frontend/src/components/ModalHealthTable.jsx`, `frontend/src/components/ModalCardsGrid.jsx`, `frontend/src/styles.css`

## Task 6: Aggiornamento Documentazione (`TECH_STACK.md`, `README.md`)
**Description:** Aggiornare `TECH_STACK.md` e `README.md` per documentare fedelmente l'architettura completa della scheda (Simulatore AWS, Simulatore IoT Edge MEMS 25 Hz, 5 indicatori diagnostici e strutturali, hardware target `NUCLEO-F401RE` + `X-NUCLEO-IKS02A1` / `IIS2DLPC`).
**Acceptance criteria:**
- [x] `TECH_STACK.md` e `README.md` riflettono tutti i componenti della scheda ENEA/PNRA.
**Dependencies:** Task 4, Task 5
**Files likely touched:** `TECH_STACK.md`, `README.md`


---

## Task 7: Vibrazione Stralli MEMS e Tabella SQLite `StationHealthLog` (`tilt.py`, `models.py`, `schemas.py`, `main.py`)
**Description:** Calcolare l'oscillazione/vibrazione ad alta frequenza degli stralli (`vibration_rms_deg`) dal segnale MEMS a 25 Hz e salvare su SQLite lo storico di tutti gli stati di salute di ciascuna AWS (`StationHealthLog`), esponendo `GET /api/aws-health/history`.
**Acceptance criteria:**
- [x] `backend/app/tilt.py` calcola `vibration_rms_deg` (deviazione standard angolare da raffiche catabatiche) e lo include nel dettaglio di `structural_tilt`.
- [x] Modello `StationHealthLog` in `backend/app/models.py` e schema `HealthHistoryOut` in `backend/app/schemas.py`.
- [x] Popolamento automatico dello storico salute (ultime 72h con transizioni `NORMAL -> WARNING -> CRITICAL`) in `_populate_demo_observations` e registrazione automatica ad ogni variazione di stato.
- [x] Endpoint `GET /api/aws-health/history?station=CODE` funzionante.

## Task 8: Telecomando di Recupero Attivo AWS (`POST /api/aws-health/recover`)
**Description:** Implementare l'endpoint e la logica di recupero remoto dalla dashboard per consentire a una centrale AWS in `WARNING` o `CRITICAL` di eseguire una procedura di *Self-Healing* tramite attuatori dedicati e tornare in stato `NORMAL`.
**Acceptance criteria:**
- [x] Endpoint `POST /api/aws-health/recover` (`RecoveryCommandIn`: `station_code`, `indicator` opzionale o `"ALL"`).
- [x] Ripristino effettivo dei dati `SIMULATED` su SQLite per l'indicatore selezionato (o tutti e 5) e inserimento di un evento `REMOTE_RECOVERY` nella tabella `station_health_logs` con descrizione tecnica dell'attuatore attivato (De-Icing Heater, Backup Battery BMS, Active Thermal Shield, Iridium Buffer Retransmit, Guy-Wire Tensioner & MEMS Recalibration).

## Task 9: UI Frontend per "Storico Salute AWS", "Telecomando di Recupero" e "Vibrazione Stralli"
**Description:** Integrare nella modale di dettaglio della singola stazione (`StationDetailDrawer.jsx` e `DrawerRiskCards.jsx`) il tab "Storico Salute AWS" e i controlli per inviare il comando di recupero alla AWS quando è in `WARNING` o `CRITICAL` (sia in modalità 72h sia durante/dopo la Simulazione 120s).
**Acceptance criteria:**
- [x] Nuovo pulsante/tab `"Storico Salute"` in `StationDetailDrawer.jsx` che mostra la timeline cronologica degli stati di salute della singola AWS con badge `NORMAL / WARNING / CRITICAL`, valori dei 5 indicatori ed eventuali comandi di recupero eseguiti.
- [x] Pulsante di recupero remoto in `DrawerRiskCards.jsx` (per singola anomalia in `WARNING`/`CRITICAL` e pulsante generale `"Ripristina AWS (Telecomando IoT)"`) che riporta la stazione a `NORMAL` e aggiorna mappa, card e storico.
- [x] Visualizzazione del parametro `Vibrazione stralli: X.XX° RMS` nella card `Structural Tilt`.

## Task 10: Documento `RICERCA_SENSORI_AWS.md` e Guida Installazione Frontend in `README.md`
**Description:** Redigere il documento di ricerca sui sensori delle AWS antartiche e sulle tecnologie di recupero attivo/monitoraggio stralli per l'ENEA, e completare il file `README.md` con la guida di installazione del Frontend (Node.js, npm, Vite) come richiesto dal Prof. Petti.
**Acceptance criteria:**
- [x] Creato `RICERCA_SENSORI_AWS.md` completo e dettagliato.
- [x] Aggiornato `README.md` con la sezione completa di installazione e avvio del Frontend (`frontend/`) su Windows, Linux e macOS.


---

## Task 11: Redesign Completo del Menu Hamburger (`ControlMenu.jsx`, `ControlMenuLayers.jsx`, `ControlMenuDataSection.jsx`, `icons.jsx`, `App.jsx`)
**Description:** Trasformare il menu laterale che si apre cliccando sul bottone hamburger in un vero pannello di comando scientifico (*Antarctic Mission Control*) curato nei minimi dettagli visivi e funzionali.
**Acceptance criteria:**
- [x] **Bottone Hamburger (`App.jsx` + `styles.css`)**: pillola/bottone top-right più curato con indicatore luminoso di stato della rete (pallino rosso/ambra pulsante se ci sono stazioni `CRITICAL`/`WARNING`) e stato attivo quando il menu è aperto.
- [x] **Header Menu (`ControlMenu.jsx`)**: brand header con icona, titolo `"Marconi AWS Observer"`, sottotitolo `"ENEA · PNRA · Mission Control"` e badge live `"17 AWS"`.
- [x] **Sezione Stato Rete (`ControlMenu.jsx`)**:
  - 4 card KPI (`NORMAL`, `WARN`, `CRIT`, `N/D`) con barra di distribuzione proporzionale multicolore a 3 segmenti (verde/ambra/rosso) sotto i KPI;
  - Accesso rapido **"Allarmi Attivi"** direttamente nel menu: chip cliccabili per le stazioni attualmente in `CRITICAL` o `WARNING` (es. *Paola*, *Eneide*, *Jennica*, *Sofia*, *Rita*) per centrare subito la stazione con 1 click;
  - Bottone primario **"Apri Centro Salute (17 AWS)"** con icona scudo e freccia `→`.
- [x] **Selettore Stazione (`ControlMenu.jsx`)**: `<select>` customizzato con wrapper, icona lente/pin e chevron SVG personalizzato (`appearance: none`) più pulsante rapido `"Reset vista"` se una stazione è selezionata.
- [x] **Griglia 2x3 Simmetrica dei 6 Layer Diagnostici (`ControlMenuLayers.jsx` + `icons.jsx`)**:
  - Tutte le 6 opzioni (`Salute Globale`, `Batteria`, `Ghiaccio`, `Shock Termico`, `Data Gap`, `Inclinazione Tilt`) disposte in una griglia **2x3** simmetrica (6 celle uguali, rimuovendo `full-span` dalla prima voce) ciascuna con la propria **icona SVG dedicata** (`IconShield`, `IconBattery`, `IconSnowflake`, `IconThermometer`, `IconRadio`, `IconCompass`).

## Task 12: Rifinitura UI/UX Globale (`styles.css`, `StationCard.jsx`, `TimelineBar.jsx`, `StationDetailDrawer.jsx`)
**Description:** Elevare la qualità visiva complessiva della dashboard (card stazione in alto a sinistra, timeline bar in basso, modale di dettaglio a 2 colonne) mantenendo un design dark scientifico coerente e ad alto contrasto.
**Acceptance criteria:**
- [x] **Glassmorphism & Profondità (`styles.css`)**: superfici con `backdrop-filter: blur(20px) saturate(160%)`, bordi con highlight superiore sottile `rgba(255,255,255,0.10)`, ombre morbide multi-livello e scrollbar dark personalizzate.
- [x] **StationCard (`StationCard.jsx`)**: bordo superiore/laterale semantico in base allo stato (`NORMAL`, `WARNING`, `CRITICAL`), griglia metriche istantanee ben spaziata e bottone primario `"Analisi, Grafici & Telecomando"` con effetto hover luminoso.
- [x] **TimelineBar (`TimelineBar.jsx`)**: barra di avanzamento colorata continua dietro i pallini degli step, badge `"SIM 120s"` e migliore leggibilità del timer.
- [x] **StationDetailDrawer (`StationDetailDrawer.jsx`)**: card dei 5 indicatori con bordo sinistro colorato semanticamente (`status-ok`, `status-warning`, `status-critical`) per una scansione visiva immediata.

---

## Task 13: Soglia Percentuale Zoom e Visibilità POI AWS vs Basi MZS/Concordia (`PolarMap.jsx`, `polarMapConfig.js`, `styles.css`)
**Description:** Eliminare lo disallineamento fuori terraferma dei marker ai bassi livelli di zoom stabilendo una soglia percentuale di zoom (`50%` / `z5` su scala `0..10`): sotto tale soglia le 17 centrali AWS scompaiono lasciando visibili solo le Sedi Base Mario Zucchelli (MZ) e Base Concordia perfettamente allineate alle loro coordinate reali; incrementando lo zoom (`>= 50%` / `z5+`), le centrali AWS ricompaiono sulla terraferma.
**Acceptance criteria:**
- [x] Costante `AWS_MIN_ZOOM = 5` (`50%` del range `0..10`) esportata in `polarMapConfig.js`.
- [x] In `PolarMap.jsx`, `BASES` non subiscono mai offset da `computeClusterOffsets` (`offset = { dx: 0, dy: 0 }`) così da restare sempre perfettamente allineate alla terraferma a qualsiasi zoom.
- [x] Quando `zoom < AWS_MIN_ZOOM` (`< 50%`), i marker `stations` (AWS) sono nascosti e restano visibili solo `BASE_MZS` e `BASE_CONCORDIA` (con etichette visibili).
- [x] Quando `zoom >= AWS_MIN_ZOOM` (`>= 50%`), i marker delle 17 AWS ricompaiono; `computeClusterOffsets` opera solo sulle AWS a `zoom >= 5` con raggio ridotto per evitare spostamenti in mare.
- [x] `MapZoomControls` mostra la percentuale di zoom (`{zoom * 10}%`) e un indicatore informa l'utente quando `zoom < 50%` che aumentando lo zoom (`>= 50%`) ricompaiono le centrali AWS.
**Verification:**
- [x] Build frontend (`npm run build`) senza errori e verifica codice soglia `z3` (`30%`) vs `z5+` (`50%+`).
**Dependencies:** None
**Files likely touched:** `frontend/src/components/polarMapConfig.js`, `frontend/src/components/PolarMap.jsx`, `frontend/src/styles.css`
**Estimated scope:** Small (2-3 files)

## Task 14: Landing Page in `/Landing` a livello root come Pagina Iniziale con pulsante DEMO (`Landing/`, `vite.config.js`, `App.jsx`, `styles.css`)
**Description:** Integrare la Landing Page dalla cartella `/Landing` a livello root del progetto come schermata iniziale dell'applicazione, con pulsante `DEMO` in fondo alla pagina che porta alla piattaforma `Marconi AWS Observer`.
**Acceptance criteria:**
- [x] Verificare se `Landing/` è presente su remote (`git fetch` / `git status`) o crearla/aggiornarla in `/Landing` a livello root.
- [x] Configurare Vite (`frontend/vite.config.js`) e `frontend/src/App.jsx` affinché all'avvio venga mostrata come pagina iniziale la Landing Page.
- [x] In fondo alla Landing Page è presente il pulsante **DEMO** che, al click, apre la piattaforma interattiva **Marconi AWS Observer**.
**Verification:**
- [x] Build frontend (`npm run build`) eseguita con successo e verifica routing Landing -> click `DEMO` -> Dashboard.
**Dependencies:** None
**Files likely touched:** `Landing/*`, `frontend/vite.config.js`, `frontend/src/App.jsx`, `frontend/src/styles.css`
**Estimated scope:** Medium (3-4 files)

## Task 15: Recupero Attivo Esclusivo per TILT (`CRITICAL`) con Attuatore Lineare Filo di Tiraggio (`DrawerRiskCards.jsx`, `useDashboardData.js`, `backend/app/main.py`)
**Description:** Limitare l'azione del pulsante di recupero nel pannello specifico dell'AWS esclusivamente al caso in cui l'indicatore `Structural Tilt` (`structural_tilt`) sia nello stato `CRITICAL`, mostrando al click il commento tecnico sull'attuatore lineare collegato al filo di tiraggio in acciaio per raddrizzare il pilastro della centrale.
**Acceptance criteria:**
- [x] In `DrawerRiskCards.jsx`, rimuovere i pulsanti di recupero dagli altri 4 indicatori (`battery_stress`, `ice_locking`, `thermal_shock`, `data_gap`) e mostrare l'azione di recupero **solo** per `structural_tilt` quando il suo stato è `CRITICAL`.
- [x] Quando si clicca sul pulsante di recupero per il TILT, viene mostrato nel pannello dell'AWS (e salvato nella nota dello storico `StationHealthLog`) il commento: *"Il sistema cercherà di recuperare lo stato \"CRITICAL\" tramite un attuatore lineare a cui è collegato il filo di tiraggio in acciaio che servirà a raddrizzare il pilastro della centrale."*
- [x] `backend/app/main.py` (`RECOVERY_ACTUATORS["structural_tilt"]` e `/api/aws-health/recover`) e `useDashboardData.js` riportano il commento richiesto e ripristinano l'inclinazione a `NORMAL`.
**Verification:**
- [x] Test API `/api/aws-health/recover` su stazione con Tilt `CRITICAL` (`PAOLA`: `CRITICAL -> OK`, nota `REMOTE_RECOVERY` in `StationHealthLog`) e build frontend (`npm run build`).
**Dependencies:** None
**Files likely touched:** `frontend/src/components/DrawerRiskCards.jsx`, `frontend/src/components/StationDetailDrawer.jsx`, `frontend/src/hooks/useDashboardData.js`, `backend/app/main.py`
**Estimated scope:** Medium (3-4 files)

## Checkpoint: After Tasks 13-15
- [x] Build frontend (`npm run build`) e test backend completati senza errori.
- [x] Tutti e 3 i punti richiesti verificati.
