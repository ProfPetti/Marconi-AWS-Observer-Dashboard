# Centro salute AWS — pagina separata

Nella barra di navigazione scegliere **Centro salute · tutte le AWS** per visualizzare simultaneamente le 17 stazioni. La pagina include stato generale, quattro indicatori con valore e semaforo per ogni stazione, origine dati e pulsante per aprire il dettaglio nella mappa.

Tre soglie: verde OK, giallo WARNING, rosso CRITICAL. Grigio significa dati insufficienti/assenti: non è corretto indicare OK senza misure.

Soglie sperimentali (backend/app/health.py): Battery Stress WARNING <= -0.2 V/h, CRITICAL <= -0.5 V/h; Ice Locking WARNING da 6 ore consecutive, CRITICAL da 12 ore; Thermal Shock WARNING <= -8 °C/h, CRITICAL <= -10 °C/h; Data Gap WARNING 1-3 letture mancanti su 24, CRITICAL da 4. Questi segnali non dimostrano da soli guasti, ghiaccio o perdita satellitare. Per l'uso operativo è necessaria validazione sui dati ENEA e calibrazione per stazione.

Aggiornamento automatico ogni 60 secondi, oppure tramite il pulsante Aggiorna ora. La modalità SIMULATED mostra soltanto dati di prova; HISTORICAL usa i dati importati.

Avvio: backend `uvicorn app.main:app --reload --port 8000`; frontend `npm install && npm run dev`.
