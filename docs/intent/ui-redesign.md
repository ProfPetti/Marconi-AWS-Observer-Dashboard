# Spec: UI Redesign "Demo Mode" stile Windy

> Intento confermato dall'utente il 2026-11-16 (sessione interview-me).
> Sostituisce il layout HUD a 5 pannelli introdotto nel refactoring precedente.

## 1. Obiettivo

Dashboard ottimizzata per la **presentazione dal vivo su schermo grande**. Il relatore parla, la UI racconta da sola la simulazione allarmi 0–120 s.

- **Utente primario:** pubblico di una demo (docenti, ENEA). Utente secondario: il relatore che guida con pochi clic.
- **Successo:** chi guarda capisce *quale stazione* va in allarme, *quando* e *perché*, senza che il relatore apra pannelli.

## 2. Principi

1. **Mappa protagonista.** Sempre visibili solo: mappa full-screen, timeline in basso, un pulsante menu.
2. **Colore = stato.** Verde/giallo/rosso/grigio solo per OK/WARNING/CRITICAL/NO_DATA. UI neutra (grigi).
3. **Niente emoji.** Icone SVG lineari inline (stile Lucide, stroke 1.75), nessuna nuova dipendenza.
4. **Sobrio.** Superfici scure opache (blur max 8px), bordo 1px sottile, radius 8px, ombre minime.
5. **Leggibile a distanza.** Testo base 15px, card spotlight con titolo ≥ 28px, contrasto WCAG AA.

## 3. Layout (desktop ≥ 1024px)

```
┌───────────────────────────────────────────────────────────┐
│ [StationCard]                                     [≡ Menu] │  ← card solo se stazione selezionata
│  (top-left, 320px)                                         │
│                                                            │
│                MAPPA POLARE EPSG:3031                      │
│                 (puntini colorati)                         │
│                                                            │
│              ┌──────── AlertSpotlight ────────┐            │  ← solo durante la regia
│              │ CRITICAL · t = 60 s            │            │
│              │ ENEIDE                         │            │
│              │ Battery Stress  −1.8 V/h       │            │
│              └────────────────────────────────┘            │
│                                                            │
│      ┌──── [▶]  0s ─●──────────── 120s   t=40s  [Esci] ──┐  │  ← TimelineBar (max 760px, centrata)
└───────────────────────────────────────────────────────────┘
```

| Elemento | Visibilità | Posizione |
|---|---|---|
| `PolarMap` | sempre | full-screen, z 1 |
| `TimelineBar` | sempre | bottom center, z 900 |
| Pulsante menu | sempre | top-right, 40×40, z 900 |
| `StationCard` | solo con `selected !== null` | top-left, z 900 |
| `AlertSpotlight` | solo durante un evento regia | centro-basso sopra timeline, z 950 |
| `ControlMenu` | su click menu | slide-over destro 340px, z 1000 |
| `StationDetailDrawer` | da StationCard "Dettagli e grafici" | slide-over sinistro 480px, z 1000 |
| `HealthOverviewModal` | da ControlMenu "Centro salute" | modal, z 1100 |

## 4. Comportamenti

### 4.1 Mappa e marker
- Marker AWS = **solo puntino** 12px colorato per stato del layer diagnostico attivo (`overall` di default). Bordo scuro 2px per contrasto su ghiaccio bianco.
- Etichetta nome: visibile su `:hover`, se selezionata, oppure se stato WARNING/CRITICAL.
- Stato CRITICAL: anello pulsante lento (2s). Disattivato con `prefers-reduced-motion`.
- Basi PNRA: piccolo rombo/stella grigio neutro, mai colorato.
- Selezionata: puntino 16px con anello bianco.
- Nessun popup Leaflet (le info stanno nella StationCard). Zoom control nascosto, scroll/pinch attivi, attribution piccola.
- Vista d'insieme: centro su Terra Vittoria/Mare di Ross come oggi, zoom 3.

### 4.2 Regia automatica (core della demo)
- Attiva di default (toggle "Regia automatica" nel ControlMenu), opera **solo durante la simulazione** (`scenarioStep !== null`).
- A ogni nuovo snapshot si confronta `overall` di ciascuna AWS con lo snapshot precedente. È un **evento** se:
  - OK/INSUFFICIENT/NO_DATA → WARNING o CRITICAL, oppure
  - WARNING → CRITICAL.
  - (Rientri a OK non generano spotlight.)
- Eventi in coda FIFO. Per ciascuno:
  1. `flyTo` sulla stazione, zoom 5, durata 1.2s.
  2. Mostra `AlertSpotlight` per 3.5s.
  3. Passa al successivo; a coda vuota `flyTo` vista d'insieme.
- **Mentre la coda non è vuota l'avanzamento automatico della timeline è sospeso** (non perde eventi, la storia resta leggibile). Riprende a regia libera.
- Pausa / Esci / click manuale su step → svuota la coda e chiude lo spotlight.
- `prefers-reduced-motion`: `setView` senza animazione.

### 4.3 AlertSpotlight
Contenuto: badge stato (colore + testo, mai solo colore), `t = {secondi} s`, nome stazione (≥28px), località, elenco indicatori in WARNING/CRITICAL con nome (`RISK_NAMES`), valore + unità, nota (`RISK_NOTES`). `role="status"` `aria-live="polite"`.

### 4.4 TimelineBar
Play/Pausa (icona), traccia continua con tacche ogni `interval_seconds`, etichette solo 0 / 60 / 120 s, indicatore posizione, testo `t = 40 s / 120 s`, pulsante "Esci" solo con simulazione attiva. Tacche colorate in base al peggior stato della rete in quello step (da `scenarioHistory`) → la barra diventa la "storia" della demo. Tastiera: Spazio = play/pausa, ←/→ = step.

### 4.5 StationCard
Compare quando si seleziona una stazione (click marker o dal menu). Contiene: nome, località, quota, badge stato, temperatura grande, vento/pressione/umidità, pulsanti "Dettagli e grafici" e chiudi (X → `selected = null`). Per una base: nota "Base PNRA, non AWS". Niente selettore a tendina (spostato nel menu).

### 4.6 ControlMenu (tutto ciò che non serve sempre)
Sezioni nell'ordine:
1. **Stato rete:** conteggi OK/WARNING/CRITICAL/INSUFFICIENT/NO_DATA + pulsante "Centro salute 17 AWS".
2. **Cerca stazione:** select AWS + basi.
3. **Regia automatica:** toggle.
4. **Layer diagnostico:** Salute globale / Battery / Ice / Thermal / Data gap (radio group).
5. **Satellite:** MODIS / VIIRS.
6. **Origine dati:** SIMULATED / HISTORICAL (bloccato in simulazione), Genera demo 72h, Importa CSV, messaggi.
7. **Fonti e crediti:** link ClimAntartide, attribution IAMCO/NASA.

Esc chiude; focus intrappolato; ritorno focus al pulsante menu.

## 5. Design tokens (`styles.css` `:root`)

```css
--bg:#0b0f14; --surface:#11161d; --surface-2:#161c24; --border:rgba(255,255,255,.08);
--text:#e6edf3; --text-muted:#8b98a5; --focus:#58a6ff;
--ok:#3fb950; --warning:#d29922; --critical:#f85149; --nodata:#6e7681;
--radius:8px; --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px;
--font: Inter, ui-sans-serif, system-ui, sans-serif; --font-mono: ui-monospace, "JetBrains Mono", monospace;
```
Numeri (temperature, tempi, valori) in `font-variant-numeric: tabular-nums`.

## 6. Responsive
- ≥1024px: layout sopra.
- 768–1023px: StationCard 280px, ControlMenu 320px.
- <768px (secondario): StationCard a tutta larghezza in alto, ControlMenu e Drawer full-screen, timeline a tutta larghezza.

## 7. Comandi
```
Dev:   ./start.sh   (oppure: cd frontend && npm run dev)
Build: cd frontend && npm run build
```

## 8. Testing
- Nessun framework di test presente. La logica pura di rilevamento eventi va in `frontend/src/utils/alerts.js` (`detectAlertTransitions(prev, next)`) per essere testabile in futuro.
- Verifica: `npm run build` senza errori + check manuale in browser (scenario Play 0→120 s, regia, menu, card, tastiera, reduced motion).

## 9. Confini
- **Sempre:** props esplicite, componenti < 200 righe, nessuna emoji, colore mai unico veicolo d'informazione.
- **Chiedere prima:** nuove dipendenze npm (es. vitest, lucide-react), modifiche al backend/API.
- **Mai:** cambiare endpoint o logica dati del backend, tema chiaro, rimuovere funzioni esistenti (grafici, import CSV, Centro salute).

## 10. Fuori scope
Backend, nuove API, nuove metriche, tema chiaro, i18n, autenticazione.
