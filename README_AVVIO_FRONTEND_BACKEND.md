# Antarctic Weather Observatory — prototipo

Dashboard React + Leaflet con cartografia polare NASA GIBS EPSG:3031, 17 stazioni dal CSV fornito, backend FastAPI e archivio SQLite.

## Stato e limiti dei dati

- **Stazioni**: caricate dal CSV `backend/data/stazioni_meteo_antartide_enea.csv` fornito in chat.
- **NASA GIBS**: immagini MODIS Terra e VIIRS Suomi NPP in EPSG:3031. La data predefinita è `2025-01-15` per il prototipo; cambiarla in `frontend/.env` (`VITE_NASA_DATE`) dopo aver verificato che il layer abbia immagini disponibili per la data scelta.
- **SIMULATED**: generatore dimostrativo, valori sintetici e non scientifici.
- **HISTORICAL**: importazione di CSV ottenuti legittimamente dal portale ENEA-PNRA. Il prototipo non dichiara validati i dati importati.
- **REALTIME**: link al portale ClimAntartide. Non è stato individuato/verificato un endpoint pubblico machine-readable per un'integrazione automatica affidabile. Non viene effettuato scraping né si simula una connessione real-time.

Il portale ENEA segnala che la distribuzione di determinati dati storici è soggetta ad accettazione del protocollo di rilascio. Consultare sempre le condizioni e le indicazioni di attribuzione del portale prima di riutilizzare i dati.

## Avvio backend (Windows PowerShell)

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API docs: http://127.0.0.1:8000/docs

## Avvio frontend (secondo terminale)

```powershell
cd frontend
npm install
npm run dev
```

Aprire http://localhost:5173.

## Import CSV storico

L'endpoint `POST /api/import/historical` accetta un CSV con almeno `station_code,timestamp`. Colonne opzionali:

- `temperature_c`
- `pressure_hpa`
- `humidity_pct`
- `wind_speed_kt`
- `wind_direction_deg`

I codici stazione sono i nomi del CSV normalizzati in maiuscolo (es. `ENEIDE`, `CONCORDIA`, `SOFIAB`). Timestamp interpretati come UTC se non contengono un fuso orario. L'importazione conserva la provenienza `HISTORICAL`; `quality=NOT_ASSESSED`.

## API

- `GET /api/health`
- `GET /api/stations`
- `GET /api/observations?station=ENEIDE&mode=SIMULATED&limit=72`
- `GET /api/source-status`
- `POST /api/demo/generate?hours=72`
- `POST /api/import/historical` (multipart form field `file`)

## Nota tecnica NASA EPSG:3031

Il TileMatrixSet 250m di GIBS ha sei livelli (0–5) con risoluzioni 8192, 4096, 2048, 1024, 512, 256 m/pixel. Per VIIRS 500m la dashboard usa livelli 0–4. Se si cambia layer o risoluzione, aggiornare coerentemente CRS, livelli e URL. La documentazione NASA GIBS e gli esempi Leaflet sono indicati nei riferimenti in fondo.

## Riferimenti

- https://www.climantartide.it/dataonline/aws/index.php
- https://www.climantartide.it/realtime/graph/index.php
- https://www.climantartide.it/dataaccess/index.php
- https://nasa-gibs.github.io/gibs-api-docs/access-basics/
- https://nasa-gibs.github.io/gibs-api-docs/access-advanced-topics/
- https://github.com/nasa-gibs/gibs-web-examples/tree/main/examples/leaflet


## Correzione allineamento polare (2026-10-31)

La precedente mappa usava tile WMTS con una griglia non allineata alla trasformazione CRS di Leaflet. Ora usa NASA GIBS WMS EPSG:3031: Leaflet genera le richieste BBOX nella stessa proiezione usata dai marker. Centro iniziale Terra Nova Bay, zoom 3. Le 17 coordinate AWS restano in WGS84 e non vanno convertite manualmente.

**Verifica online richiesta:** l’ambiente di creazione non disponeva di connettività a NASA; controllare in DevTools > Network le risposte WMS (GetMap). Se il layer selezionato o la data non sono disponibili nel servizio WMS, consultare GetCapabilities all'indirizzo `https://gibs.earthdata.nasa.gov/wms/epsg3031/best/wms.cgi?SERVICE=WMS&REQUEST=GetCapabilities` e scegliere un layer/data supportato. I dati meteorologici simulati non sono osservazioni reali.

**Nota dipendenze:** `pydantic==2.14.0` è stata inserita come richiesto, ma la sua disponibilità e compatibilità devono essere verificate con `pip install -r requirements.txt`.

### Selezione AWS e basi principali
Selezionando una AWS nel pannello destro il marker diventa rosso, la mappa si centra sul punto e si apre il medesimo popup del clic sul marker. Le basi Concordia e Mario Zucchelli sono indicate separatamente con stelle gialle (coordinate pubblicate PNRA/COMNAP); non incrementano il numero delle 17 AWS né generano misure fittizie.
