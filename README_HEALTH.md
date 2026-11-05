# Diagnostica predittiva AWS (prototipo)

API: `GET /api/aws-health?mode=SIMULATED` oppure `mode=HISTORICAL`; parametro facoltativo `station=ENEIDE` e `end=2026-10-31T00:00:00Z` (per analizzare finestre storiche).

La finestra è di 24 ore UTC e considera un solo record per slot orario. I record non allineati all’ora sono esclusi. Si assumono 24 letture orarie; modificare la logica se la cadenza di acquisizione varia.

- Battery Stress: minima variazione V/h tra due ore consecutive con temperatura finale < -20 °C. WARNING <= -0.2 V/h, CRITICAL <= -0.5 V/h. Queste soglie sono illustrative e richiedono calibrazione per il tipo di batteria. Non si calcola un indice di invecchiamento reale.
- Ice Locking: sequenza massima di ore consecutive con velocità esattamente zero, direzione esattamente costante, temperatura < -20 °C; CRITICAL da 12 ore. Umidità conservata ma non utilizzata dalla regola richiesta. Anche calma piatta o guasti sensore possono produrre la stessa sequenza.
- Thermal Shock: minima differenza T(t)-T(t-1h), WARNING <= -8 °C/h, CRITICAL <= -10 °C/h. La temperatura ambientale non è una misura diretta dello stress dei componenti.
- Data Gap: 100*(24 - letture ricevute)/24; percentuale di ricezione complementare. WARNING da 1 a 3 assenze, CRITICAL da 4 assenze. NO_DATA se nessuna lettura. Non è un indicatore esclusivo di qualità satellitare o energia.

`battery_v` è un campo nuovo nullable nel DB, aggiunto automaticamente su SQLite esistente. Per CSV storici importati utilizzare `battery_v` (oppure `battery_voltage`, `voltage_v`, `voltage`, `volt`, `vbatt`) in Volt. Il generatore demo originale non simula la tensione: Battery Stress resterà "Dati insufficienti" fino all'importazione di dati completi. Il prototipo non scarica automaticamente telemetria ENEA.

Esempio CSV:
```
station_code,timestamp,battery_v,temperature_c,humidity_pct,wind_speed_kt,wind_direction_deg
ENEIDE,2026-10-30T10:00:00Z,12.4,-25,80,0,180
ENEIDE,2026-10-30T11:00:00Z,12.1,-26,81,0,180
```

Versioni richieste in `backend/requirements.txt` conservate. I test del modulo `backend/tests/test_health.py` sono eseguibili con `python -m unittest discover -s tests` dalla cartella backend.
