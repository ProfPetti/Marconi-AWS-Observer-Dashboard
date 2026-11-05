# Simulazione Data Gap – RITA

Nel file `backend/data/scenario_120s.csv` sono presenti letture ogni 10 secondi per le AWS. Per RITA l'ultima riga è a 50 secondi; **non sono presenti righe per RITA a partire da 60 secondi**. Non inserire righe con valori nulli: il sistema deve riconoscere i timestamp mancanti.

Il backend `app/timeline.py` calcola il numero di slot attesi a ogni passo e il Data Gap Rate come `(attesi - ricevuti) / attesi * 100`. Le soglie demo sono definite in `backend/data/scenario_120s.json`: WARNING a 8%, CRITICAL a 25%. La simulazione non modifica la logica dei dati ENEA reali.

Verifica API: `/api/demo/timeline?step=5` -> RITA OK, `/api/demo/timeline?step=6` -> WARNING, `/api/demo/timeline?step=7` -> CRITICAL, `/api/demo/timeline?step=12` -> CRITICAL (53.85%).

Nel frontend, avvia l'evoluzione dalla pagina Centro salute. Apri RITA nella mappa per vedere il grafico Data Gap Rate attraversare le aree gialla e rossa. Gli altri grafici si interrompono quando i dati non arrivano più: non viene inventata telemetria successiva all'ultimo pacchetto.

Nota: questo indicatore misura la mancata ricezione di letture, non dimostra che la causa sia il collegamento satellitare. I valori e le soglie sono esclusivamente dimostrativi.
