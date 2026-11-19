# Marconi AWS Observer Dashboard — ENEA / PNRA (AUSDA-CON 2026)

Dashboard web e architettura di simulazione IoT Edge per il monitoraggio meteorologico, diagnostico e strutturale delle 17 stazioni automatiche antartiche (**AWS**) gestite da **ENEA / PNRA / IAMCO**.

## Architettura & 5 Indicatori Diagnostici

Il sistema integra la telemetria meteorologica AWS con il monitoraggio dell'inclinazione strutturale basato su accelerometro MEMS triassiale a **25 Hz** (hardware target: **`STM32 NUCLEO-F401RE` + `X-NUCLEO-IKS02A1` / `IIS2DLPC`**):

1. **Battery Stress** (`V/h`): massima discesa oraria della tensione batteria in finestra di **12 ore** con `T < -20 °C`.
2. **Ice Locking** (`h`): ore consecutive con vento nullo, direzione invariata e `T < -20 °C` (possibile blocco anemometro).
3. **Thermal Shock Rate** (`°C/h`): massima variazione negativa oraria della temperatura.
4. **Data Gap Rate** (`%`): percentuale di slot orari mancanti nelle ultime 24 ore.
5. **Structural Tilt** (`°`): inclinazione strutturale rilevata a `25 Hz` (`25 campioni/s`, `1500 campioni/minuto`) tramite:
   - Calibrazione iniziale sui primi **5 secondi** (`125` campioni) per il vettore medio di riferimento;
   - Calcolo dell'angolo rispetto al riferimento;
   - **Mediana su finestra di 1 secondo** (`25` campioni);
   - **Media mobile su 10 valori mediani consecutivi** (`10` secondi);
   - Classificazione: `NORMAL` (`[0°, 2°[`), `WARNING` (`[2°, 5°[`), `CRITICAL` (`[5°, +∞[`).

### Simulatori Python (`simulators/`)

- **Simulatore AWS (`simulators/aws_simulator.py`)**: legge i dataset CSV di scenario e trasmette la telemetria via `HTTP POST/JSON` a `POST /api/telemetry`.
- **Simulatore IoT Edge (`simulators/iot_edge_simulator.py`)**: genera lo stream MEMS `(timestamp, ax, ay, az)` a `25 Hz` in CSV, simula l'elaborazione edge del microcontrollore `NUCLEO-F401RE` + `IIS2DLPC` e invia il pacchetto via `HTTP POST/JSON` a `POST /api/edge/tilt`.

---

## Prerequisiti – Installazione e configurazione di Python

Il backend di **Antarctic Observatory** è sviluppato in Python e utilizza FastAPI, Pydantic e SQLite.

Prima di installare le dipendenze del progetto, è necessario verificare che Python sia disponibile sul computer.

### 1. Verificare se Python è già installato

Aprire **PowerShell** oppure il terminale integrato di Visual Studio Code ed eseguire:

```powershell
py --version
```

In alternativa:

```powershell
python --version
```

Se compare una versione compatibile con il progetto, ad esempio `Python 3.12.x`, è possibile passare direttamente alla creazione dell'ambiente virtuale.

Il progetto richiede **Python 3.11 o superiore**, compatibilmente con le dipendenze dichiarate.

Se Python non è riconosciuto, procedere con l'installazione.

### 2. Installare Python su Windows

1. Aprire il sito ufficiale: https://www.python.org/downloads/windows/
2. Scaricare una versione stabile di Python compatibile con il progetto.
3. Avviare il programma di installazione.
4. Se presente, selezionare l'opzione **Add python.exe to PATH**.
5. Completare l'installazione, assicurandosi che siano disponibili Python e pip.
6. Chiudere e riaprire PowerShell o Visual Studio Code.

La procedura può variare leggermente a seconda della versione dell'installer.

### 3. Verificare l'installazione

Eseguire:

```powershell
py --version
py -m pip --version
```

Se entrambi i comandi restituiscono una versione, Python e pip sono disponibili.

Se il comando `py` non è riconosciuto ma `python` funziona, utilizzare `python` al posto di `py` nei comandi successivi.

### 4. Installare Visual Studio Code

Se non è già presente, scaricare VS Code da:

https://code.visualstudio.com/

Aprire VS Code e installare l'estensione ufficiale **Python**, pubblicata da Microsoft.

Aprire quindi la cartella del progetto Antarctic Observatory.

### 5. Creare un ambiente virtuale Python

Dal terminale di VS Code, posizionarsi nella cartella `backend`:

```powershell
cd backend
```

Creare un ambiente virtuale denominato `.venv`:

```powershell
py -m venv .venv
```

Attivarlo:

```powershell
.\.venv\Scripts\Activate.ps1
```

Se PowerShell blocca l'attivazione degli script, è possibile autorizzarla per la sola sessione corrente:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Ripetere quindi il comando di attivazione.

In alternativa, è possibile utilizzare direttamente l'interprete dell'ambiente virtuale senza attivarlo.

### 6. Installare le dipendenze del backend

Con l'ambiente virtuale attivo, aggiornare pip:

```powershell
python -m pip install --upgrade pip
```

Installare le librerie dichiarate nel progetto:

```powershell
python -m pip install -r requirements.txt
```

Il file `requirements.txt` deve contenere le dipendenze effettivamente utilizzate dal backend, tra cui FastAPI, Uvicorn, Pydantic e gli eventuali moduli per SQLite e i test.

Non è necessario installare SQLite separatamente per utilizzare il modulo `sqlite3` incluso nella libreria standard di Python.

### 7. Avviare il backend FastAPI

Dalla cartella `backend`, con l'ambiente virtuale attivo, eseguire:

```powershell
python -m uvicorn app.main:app --reload
```

Il comando presuppone che l'applicazione FastAPI sia definita nella variabile `app` del file `backend/app/main.py`.

Se il progetto utilizza un percorso differente, modificare il comando di conseguenza.

Per impostazione predefinita, il backend sarà raggiungibile all'indirizzo:

http://127.0.0.1:8000

La documentazione interattiva delle API sarà disponibile all'indirizzo:

http://127.0.0.1:8000/docs

### 8. Verifica finale

Controllare che:

- Python sia installato e riconosciuto dal terminale.
- pip sia funzionante.
- L'ambiente virtuale `.venv` sia stato creato.
- Le dipendenze siano installate senza errori.
- FastAPI si avvii correttamente.
- La pagina `/docs` sia accessibile dal browser.

### 9. Risoluzione dei problemi comuni

**Errore: Python non riconosciuto**

Chiudere e riaprire il terminale. Verificare l'installazione di Python e la configurazione del PATH. Su Windows, controllare anche gli alias di esecuzione delle applicazioni.

**Errore: No module named pip**

Verificare di utilizzare l'interprete Python corretto. Per una normale installazione Python che include `ensurepip`, provare:

```powershell
py -m ensurepip --upgrade
```

**Errore: impossibile attivare l'ambiente virtuale**

È possibile utilizzare direttamente:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

e successivamente:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

**Errore: porta 8000 già occupata**

Avviare FastAPI su un'altra porta:

```powershell
python -m uvicorn app.main:app --reload --port 8001
```

Ricordarsi di aggiornare anche l'indirizzo del backend nella configurazione del frontend.

### Nota per gli studenti

L'ambiente virtuale `.venv` non deve essere caricato nel repository GitHub.

Verificare che il file `.gitignore` contenga:

```gitignore
.venv/
__pycache__/
*.pyc
.env
```

Ogni studente dovrà creare il proprio ambiente virtuale sul computer utilizzato per lo sviluppo.

---

## Installazione e Configurazione del Frontend (React + Vite)

L'interfaccia cartografica interattiva (`frontend/`) è sviluppata in **React 18**, **Vite 6**, **Leaflet / Proj4Leaflet** (`EPSG:3031`) e **Recharts**.

### 1. Verificare se Node.js e npm sono installati

Aprire un terminale (PowerShell su Windows, Terminale su Linux/macOS) ed eseguire:

```bash
node --version
npm --version
```

Il progetto richiede **Node.js 18 LTS o superiore** (consigliato **Node.js 20 LTS** o **22 LTS**) con `npm` incluso.

Se il comando non è riconosciuto:
- **Windows / macOS**: scaricare e installare la versione **LTS** dal sito ufficiale [https://nodejs.org/](https://nodejs.org/) (su Windows assicurarsi che l'opzione *Add to PATH* sia attiva, quindi riaprire il terminale).
- **Linux (Ubuntu / Debian)**: installare Node.js LTS tramite `nvm` o gestore pacchetti (`curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs`).

### 2. Installare le dipendenze del Frontend

Posizionarsi nella cartella `frontend` del progetto ed eseguire:

```bash
cd frontend
npm install
```

Questo comando scarica in `frontend/node_modules` tutte le librerie dichiarate in `package.json` (`react`, `react-dom`, `leaflet`, `react-leaflet`, `proj4`, `proj4leaflet`, `recharts`, `vite`).

### 3. Avviare il server di sviluppo Frontend

Sempre dalla cartella `frontend`:

```bash
npm run dev
```

Il frontend sarà accessibile dal browser all'indirizzo:

- **Dashboard Web:** `http://localhost:5173`

> **Nota:** Assicurarsi che anche il Backend FastAPI sia in esecuzione su `http://localhost:8000` (se il backend gira su un indirizzo o porta diversa, impostare `VITE_API_URL` in `frontend/.env`).

### 4. Avvio Rapido Unificato (Linux / macOS / WSL)

Dalla root del progetto è disponibile lo script automatico che prepara sia il virtualenv Python (`backend/.venv`) sia `frontend/node_modules` e avvia entrambi i server in parallelo:

```bash
./start.sh
```

### 5. Avvio dei Simulatori Esterni (`simulators/`)

Con il backend attivo su `http://localhost:8000`, è possibile lanciare da un nuovo terminale i due simulatori Python standalone (zero dipendenze esterne):

```bash
# Simulatore AWS (telemetria meteo e diagnostica da CSV -> POST /api/telemetry)
python3 simulators/aws_simulator.py --interval 0.2

# Simulatore IoT Edge MEMS 25 Hz (NUCLEO-F401RE + IIS2DLPC -> POST /api/edge/tilt)
python3 simulators/iot_edge_simulator.py --station PAOLA --target-tilt 3.2 --duration 60
```

### 6. Build di Produzione Frontend (opzionale)

Per generare i file statici ottimizzati in `frontend/dist/`:

```bash
cd frontend
npm run build
```
