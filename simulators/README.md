# Simulatori AWS e IoT Edge (ENEA / PNRA – AUSDA-CON 2026)

Questa cartella contiene i due simulatori standalone in **Python 3** (zero dipendenze esterne, solo libreria standard `urllib.request`, `csv`, `json`, `statistics`, `math`) che alimentano il backend FastAPI tramite **HTTP POST/JSON**:

1. **`aws_simulator.py` — Simulatore AWS (Telemetria Meteorologica e Diagnostica)**
   - Legge i file CSV di scenario (es. `backend/data/scenario_120s.csv`) e trasmette i record verso `POST /api/telemetry`.
   - Esempio (dry-run):
     ```bash
     python3 simulators/aws_simulator.py --dry-run
     ```
   - Esempio (invio completo al backend locale):
     ```bash
     python3 simulators/aws_simulator.py --interval 0.2
     ```

2. **`iot_edge_simulator.py` — Simulatore IoT Edge (Monitoraggio Inclinazione MEMS 25 Hz)**
   - Emula il nodo hardware target **`STM32 NUCLEO-F401RE` + `X-NUCLEO-IKS02A1` (`IIS2DLPC`)**:
     - **Sensore MEMS 25 Hz**: genera accelerazioni triassiali `(timestamp, ax, ay, az)` in unità `g` a `25 Hz` (`25 campioni/s`, `1500 campioni/minuto`) con rumore gaussiano e perturbazioni dovute alle raffiche di vento, salvandole su file CSV.
     - **Elaborazione Edge su Microcontrollore**:
       1. Calibrazione iniziale sui primi **5 secondi** (`125 campioni`) per determinare il vettore medio di riferimento `(ax_ref, ay_ref, az_ref)`.
       2. Calcolo della variazione angolare in gradi rispetto al riferimento tramite prodotto scalare.
       3. **Mediana su 1 secondo** (`25 campioni` per finestra).
       4. **Media mobile su 10 valori mediani consecutivi** (`10 secondi consecutivi`).
       5. Classificazione `Structural Tilt`:
          - `NORMAL`: `[0°, 2°[`
          - `WARNING`: `[2°, 5°[`
          - `CRITICAL`: `[5°, +∞[`
   - Esempio (simulazione 60s = 1500 campioni per PAOLA con inclinazione 3.2° -> `WARNING`):
     ```bash
     python3 simulators/iot_edge_simulator.py --station PAOLA --target-tilt 3.2 --duration 60
     ```
   - Esempio con invio diretto dei campioni raw a 25 Hz al backend:
     ```bash
     python3 simulators/iot_edge_simulator.py --station ENEIDE --target-tilt 5.8 --send-raw
     ```

