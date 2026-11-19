# Implementation Plan: Allineamento Completo alla Scheda Tecnica ENEA / PNRA – AUSDA-CON 2026

## Overview
Allineamento al 100% del progetto **Marconi AWS Observer Dashboard** rispetto alla scheda tecnica presentata al Concorso Nazionale ENEA / PNRA – AUSDA-CON 2026. L'intervento introduce il modulo di **Monitoraggio Strutturale (`Structural Tilt`)** basato sul simulatore **IoT Edge MEMS a 25 Hz** (calibrazione 5s, mediana su 1s / 25 campioni, media mobile su 10 valori mediani / 10s), i due **simulatori Python (`Simulatore AWS` e `Simulatore IoT Edge`)** che comunicano con il backend via `HTTP POST/JSON`, l'aggiornamento del database SQLite, del motore diagnostico (`Health Engine`) e di tutta l'interfaccia React per visualizzare i 5 indicatori (`Battery Stress`, `Ice Locking`, `Thermal Shock Rate`, `Data Gap Rate`, `Structural Tilt`) con stati `NORMAL` (`OK`), `WARNING`, `CRITICAL`.

## Architecture Decisions
- **Pipeline Matematica MEMS 25 Hz (`backend/app/tilt.py`)**:
  - Frequenza di campionamento: `25 Hz` (`25 campioni/s`, `1500 campioni/minuto`) sui 3 assi `(ax, ay, az)`.
  - Calibrazione iniziale: primi `5 secondi` (`125 campioni`) usati per calcolare il vettore medio di riferimento `(ax_ref, ay_ref, az_ref)`.
  - Calcolo variazione angolare $\Delta\theta$ in gradi di ciascun campione rispetto al vettore di riferimento.
  - Filtro 1: **Mediana su finestra di 1 secondo** (`25 campioni` per ciascun secondo).
  - Filtro 2: **Media mobile su 10 valori mediani consecutivi** (`10 secondi consecutivi`).
  - Soglie `Structural Tilt`:
    - `NORMAL` (codice stato interno `OK` per compatibilità CSS, etichetta `NORMAL`): `[0°, 2°[`
    - `WARNING`: `[2°, 5°[`
    - `CRITICAL`: `[5°, +∞[`
- **Architettura Client-Server e Simulatori (`HTTP POST/JSON`)**:
  - Creazione degli endpoint `POST /api/telemetry` e `POST /api/edge/tilt` validati con Pydantic per ricevere telemetria meteo/batteria e dati strutturali MEMS dai simulatori.
  - Creazione degli script standalone in `simulators/aws_simulator.py` e `simulators/iot_edge_simulator.py` che leggono/generano CSV e trasmettono i payload JSON via HTTP POST al backend FastAPI.
- **Compatibilità UI e Stati**:
  - Internamente il codice mantiene la chiave `"OK"` per non rompere gli stili CSS (`.status-ok`, `.aws-dot-node.ok`) e i test esistenti, ma espone `"NORMAL"` nelle etichette tecniche (`STATUS_LABEL_3` e badge) come indicato nella scheda del concorso.

## Task List

### Phase 1: Motore MEMS 25 Hz, Database e Backend API
- [x] Task 1: Creare `backend/app/tilt.py` con il generatore MEMS a 25 Hz (calibrazione 5s, mediana 25 campioni/1s, media mobile 10s) e la classificazione `Structural Tilt` (`[0°, 2°[`, `[2°, 5°[`, `[5°, +∞[`).
- [x] Task 2: Aggiornare `backend/app/models.py`, `backend/app/schemas.py`, `backend/app/ingest.py` e `backend/app/main.py` per persistere `tilt_deg` su SQLite, esporre `POST /api/telemetry` e `POST /api/edge/tilt`, e popolare `battery_v` e `tilt_deg` in `POST /api/demo/generate`.
- [x] Task 3: Aggiornare `backend/app/health.py`, `backend/app/timeline.py`, `backend/app/scenarios.py`, `backend/data/scenario_120s.json`, `backend/data/scenario_120s.csv` e `backend/data/scenario_evolution.csv` con il 5° indicatore `structural_tilt` e le finestre/soglie della scheda.

### Checkpoint: Backend & Health Engine
- [x] Verifica import moduli Python e calcolo indicatori senza errori.

### Phase 2: Simulatori AWS e IoT Edge (Python - CSV - HTTP POST/JSON)
- [x] Task 4: Creare `simulators/aws_simulator.py` e `simulators/iot_edge_simulator.py` (con generazione CSV MEMS a 25 Hz, elaborazione microcontrollore simulato `NUCLEO-F401RE` + `IIS2DLPC` e invio `HTTP POST/JSON` al backend).

### Phase 3: Frontend React (5 Indicatori + Structural Tilt) e Documentazione
- [x] Task 5: Aggiornare `frontend/src/constants/awsConfig.js`, `ControlMenuLayers.jsx`, `DrawerRiskCards.jsx`, `DrawerRiskCharts.jsx`, `ModalHealthTable.jsx` e `ModalCardsGrid.jsx` per mostrare `Structural Tilt`, il layer mappa dedicato e le diciture `NORMAL / WARNING / CRITICAL`.
- [x] Task 6: Aggiornare `TECH_STACK.md` e `README.md` con la descrizione dell'architettura completa (Simulatore AWS, Simulatore IoT Edge MEMS 25 Hz, 5 indicatori diagnostici e strutturali).

### Checkpoint: Complete
- [x] Tutti i criteri di accettazione soddisfatti e verificati.


---

### Phase 4: Storico Stato Salute Singola AWS, Telecomando di Recupero IoT (Self-Healing), Vibrazione Stralli e Ricerca Sensori (Richieste Prof. Petti)
- [x] Task 7: Aggiungere il calcolo della **Vibrazione / Oscillazione degli Stralli (`vibration_rms_deg`)** in `backend/app/tilt.py` e creare la tabella SQLite **`StationHealthLog`** (`backend/app/models.py`, `schemas.py`, `main.py`) con popolamento automatico dello storico salute per ogni singola AWS ed endpoint `GET /api/aws-health/history`.
- [x] Task 8: Implementare il sistema di **Telecomando e Recupero Attivo da Dashboard (`POST /api/aws-health/recover`)** per permettere a una AWS in `WARNING` o `CRITICAL` di recuperare a `NORMAL` tramite attuatori IoT simulati (Riscaldatore De-Icing Anemometro, Switch Batteria Tampone LiFePO4, Scudo Termico Attivo, Burst Buffer Iridium, Tensionatore Elettromeccanico Stralli + Ricalibrazione MEMS), registrando l'operazione nello storico salute.
- [x] Task 9: Aggiornare il Frontend React (`StationDetailDrawer.jsx`, `DrawerRiskCards.jsx`, `useDashboardData.js`, `styles.css`) aggiungendo:
  - Il tab **"Storico Salute AWS"** nella modale della singola stazione con la cronologia completa di tutti gli stati (`NORMAL`, `WARNING`, `CRITICAL` e interventi di recupero);
  - Il pannello interattivo **"Telecomando di Recupero Remoto (Self-Healing IoT)"** quando la stazione presenta anomalie;
  - La visualizzazione della **Vibrazione Stralli (`° RMS`)** insieme a `Structural Tilt`.
- [x] Task 10: Creare il documento tecnico **`RICERCA_SENSORI_AWS.md`** (funzionamento delle AWS antartiche ENEA/PNRA, sensori standard e tecnologie/attuatori innovativi di recupero e monitoraggio stralli per venti catabatici) e completare **`README.md`** con le istruzioni passo-passo di installazione per il **Frontend** (`Node.js / npm`) oltre al Backend.


---

### Phase 5: Redesign UI/UX Mission-Control & Menu Hamburger (`frontend-ui-engineering`)
- [x] Task 11: Riprogettare il **Menu Hamburger (`ControlMenu.jsx`, `ControlMenuLayers.jsx`, `ControlMenuDataSection.jsx`, `icons.jsx`, `App.jsx`)** con estetica *Antarctic Mission Control* (glassmorphism avanzato, barra proporzionale di salute della rete, accesso rapido con 1 click alle stazioni in allarme `CRITICAL`/`WARNING`, griglia 2x3 simmetrica con icone dedicate per i 6 Layer Diagnostici, selettore stazione customizzato e trigger hamburger arricchito con badge allarmi).
- [x] Task 12: Rifinire la UI/UX globale della dashboard (`styles.css`, `StationCard.jsx`, `TimelineBar.jsx`, `StationDetailDrawer.jsx`) migliorando profondità visiva, micro-interazioni, barra di progresso continua nella `TimelineBar`, accenti cromatici semantici sulle card in allarme e leggibilità tipografica.
