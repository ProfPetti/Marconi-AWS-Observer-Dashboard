# Simulazione evolutiva da file esterni

La telemetria sintetica è memorizzata in `backend/data/scenario_evolution.csv` (17 AWS × 24 ore × 3 fasi = 1224 righe). Le fasi, la data di riferimento e i testi sono in `backend/data/scenario_evolution.json`.

`backend/app/scenarios.py` legge questi file e converte le righe in osservazioni; **non** contiene valori di ENEIDE, JENNICA, tensione o vento precodificati. `backend/app/health.py` calcola i quattro indicatori e assegna gli stati con soglie sperimentali.

## Modificare la simulazione

- Cambia i valori del CSV per una o più AWS e per la fase desiderata, mantenendo timestamp orari ISO 8601 con fuso UTC.
- La finestra analizzata è `[reference_utc - 24 ore, reference_utc)`; l'ultima misura è un'ora prima del riferimento.
- `station_code` deve corrispondere al codice nel database (es. `ENEIDE`, `JENNICA`).
- `stage` deve corrispondere a un `id` in `scenario_evolution.json`.
- Per variare data, descrizioni o etichette, modifica il JSON. Per cambiare soglie, modifica `health.py` (in futuro possono essere esternalizzate).
- Il frontend visualizza lo snapshot ricevuto dall'API `/api/demo/scenario-health?step=0|1|2`.

I dati non sono ENEA; non vengono salvati nel database e non generano notifiche operative. La selezione di una fase non riproduce il trascorrere del tempo reale: mostra tre scenari indipendenti.

## Test

Dalla cartella `backend` esegui `python -m unittest discover -s tests -v`.
