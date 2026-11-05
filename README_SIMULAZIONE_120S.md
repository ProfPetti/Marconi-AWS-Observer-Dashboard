# Simulazione AWS accelerata (120 secondi)

- File esterno: `backend/data/scenario_120s.csv` (17 stazioni, 13 timestamp a intervalli di 10 secondi)
- Configurazione esterna: `backend/data/scenario_120s.json` (soglie, periodo, passo)
- Calcolo backend: `backend/app/timeline.py`
- Endpoint: `GET /api/demo/timeline?step=0` ... `step=12` e `GET /api/demo/timeline-config`
- Frontend: pagina **Centro salute**, pulsante **Avvia evoluzione automatica**. Attendere 120 secondi. In ogni scheda AWS, cliccare **Apri nella mappa** per vedere i quattro grafici di andamento, con bande verdi, gialle e rosse.

**Avvertenza:** è una simulazione sintetica accelerata. Le soglie in V/min, °C/min e numero di campioni da 10 s sono SOLO per la demo; non sostituiscono le regole operative basate su ore. Il Data Gap indica assenza di slot, non prova un guasto satellitare. Il rosso segnala rischio, non un congelamento accertato.

Esempio verifica:
```
cd backend
python -c "from app.timeline import snapshot; print([(s['station_code'],s['overall']) for s in snapshot(['ENEIDE','JENNICA'],12)['stations']])"
```

Backend: `uvicorn app.main:app --reload --port 8000`; frontend: `npm install` e `npm run dev`.
