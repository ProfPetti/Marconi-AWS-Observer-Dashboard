# Ricerca Tecnica: Sensori delle Centraline Antartiche (AWS), Criticità da Venti Catabatici e Attuatori IoT di Recupero Attivo

Documento tecnico di ricerca a supporto della presentazione **ENEA / PNRA – AUSDA-CON 2026** (*Marconi AWS Observer Dashboard*).

---

## 1. Come Funziona una Centrale AWS Antartica (ENEA / PNRA)

Le **Automatic Weather Stations (AWS)** installate dall'Osservatorio Meteo-Climatologico Antartico (**IAMCO — ENEA / PNRA**) operano in condizioni ambientali estreme lungo la fascia costiera della Baia Terra Nova (es. *Eneide*, *Paola*, *Rita*, *Jennica*) e sull'altopiano interno verso *Concordia* (Dome C), dove le temperature scendono regolarmente sotto i **-40 °C / -70 °C**.

L'architettura fisica ed elettronica di una stazione AWS comprende:
- **Struttura portante a traliccio in lega leggera (alluminio anodizzato)**: palo modulare alto 3–10 metri ancorato al ghiaccio o alla roccia tramite piastra di base e **stralli metallici in acciaio inox** tirantati a 120° su più livelli.
- **Sistema di alimentazione autonoma**: pannelli fotovoltaici ad alta efficienza montati verticalmente (per ridurre l'accumulo di neve e sfruttare il sole basso sull'orizzonte) abbinati a **batterie tampone al piombo-gel o LiFePO4** alloggiate in box termicamente coibentati (*insulated battery enclosures*) interrati nella neve o schermati dal vento.
- **Unità di acquisizione e controllo (Datalogger)**: centralina industriale a bassissimo consumo (tipicamente serie *Campbell Scientific CR1000 / CR3000* o sistemi equivalenti qualificati per temperature artiche/antartiche fino a -55 °C), dotata di memoria circolare locale e ADC a 24 bit per il campionamento dei sensori.
- **Sottosistema di telecomunicazione satellitare**: trasmettitore **Argos** o modem bidirezionale **Iridium SBD (*Short Burst Data*)** per l'invio periodico (orario o sub-orario) dei pacchetti telemetrici verso i centri di ricezione ENEA.

---

## 2. Sensori Meteorologici Standard Installati sulle AWS

| Parametro | Sensore Tipico / Classe | Principio di Misura | Criticità in Ambiente Antartico |
|---|---|---|---|
| **Temperatura & Umidità Relativa** | Termoigrometro (es. *Vaisala HMP155*) con schermo anti-radiazione ventilato | Termoresistenza al platino **Pt100** (temperatura) + sensore capacitivo polimerico (umidità) | Saturazione da brina sullo schermo, sbalzi termici violenti durante tempeste catabatiche (*Thermal Shock*) |
| **Pressione Atmosferica** | Barometro digitale di precisione (es. *Vaisala PTB110 / PTB210*) | Trasduttore capacitivo al silicio (*BAROCAP*) compensato in temperatura | Intasamento da neve polverizzata (*blowing snow*) del condotto di presa statica |
| **Velocità & Direzione Vento** | Anemometro ad elica + gonioanemometro (es. *R.M. Young 05103* o anemometri ultrasonici riscaldati) | Dinamo tachimetrica/ottica + potenziometro/encoder di direzione (o tempo di volo ultrasonico) | Formazione di ghiaccio vetrone (*riming / ice locking*) che blocca l'elica o la banderuola a `0 kt` con direzione congelata |
| **Radiazione & Manto Nevoso** | Albedometro / Radiometro netto + Nivometro ultrasonico | Termopila differenziale (SW/LW) + trasduttore ad ultrasuoni compensato in T | Depositi di ghiaccio sulle cupole ottiche e variazione dell'altezza utile degli stralli per accumulo nevoso |

---

## 3. Criticità dei Venti Catabatici, Cedimento degli Stralli e Modulo IoT Edge MEMS 25 Hz

### Fenomeno fisico: Venti Catabatici e Sollecitazione degli Stralli
I **venti catabatici** si originano dal rapido raffreddamento radiativo dell'aria sull'altopiano antartico interno: la massa d'aria fredda e densa scivola per gravità lungo i pendii costieri incanalandosi nei ghiacciai e raggiungendo raffiche superiori a **150–200 km/h**.

Queste raffiche producono due effetti critici sulla meccanica del traliccio:
1. **Vibrazioni armoniche e sbattimento (*galloping / vortex shedding*) degli stralli** di ancoraggio: le sollecitazioni cicliche ripetute allentano i morsetti o scalzano i picchetti ancorati nel firn/ghiaccio.
2. **Inclinazione progressiva della torre (`Structural Tilt`)**: lo spostamento dalla verticale compromette l'orizzontalità dei radiometri, altera l'asse dell'anemometro e nei casi più gravi (`>= 5°`) prelude al collasso strutturale della stazione.

### Soluzione Architetturale Implementata (`STM32 NUCLEO-F401RE` + `X-NUCLEO-IKS02A1 / IIS2DLPC`)
Per rilevare sia l'**oscillazione rapida degli stralli** sia la **deriva statica dell'inclinazione**, il sistema affianca al datalogger meteo un nodo IoT Edge dedicato:
- **Sensore MEMS triassiale `IIS2DLPC`** (su expansion board **`X-NUCLEO-IKS02A1`**) campionato a **`FS = 25 Hz`** (`25 campioni/s`, `1500 campioni/minuto`) sui 3 assi `(ax, ay, az)` in unità `g`.
- **Calibrazione iniziale (`5 s` / `125 campioni`)**: acquisizione del vettore medio di riferimento verticale `(ax_ref, ay_ref, az_ref)` in condizione statica.
- **Variazione angolare istantanea**: calcolo dell'angolo $\Delta\theta$ rispetto al vettore di calibrazione tramite prodotto scalare normalizzato.
- **Indice di Vibrazione Stralli (`vibration_rms_deg`)**: deviazione standard angolare (`° RMS`) calcolata direttamente sul flusso a `25 Hz` per quantificare l'ampiezza delle oscillazioni da raffica e l'eventuale allentamento degli stralli.
- **Filtraggio Edge anti-raffica**:
  1. **Mediana su finestra di 1 secondo** (`25 campioni`) per eliminare i picchi impulsivi delle raffiche istantanee;
  2. **Media mobile su 10 valori mediani consecutivi** (`10 secondi`) per isolare la reale inclinazione permanente della struttura.
- **Soglie Diagnostiche `Structural Tilt`**:
  - `NORMAL`: `[0°, 2°[`
  - `WARNING`: `[2°, 5°[`
  - `CRITICAL`: `[5°, +∞[`

---

## 4. Tecnologie e Attuatori Innovativi di Recupero Remoto (*Self-Healing IoT da Dashboard*)

Tramite canale satellitare bidirezionale **Iridium SBD** (simulato nella dashboard attraverso l'endpoint `POST /api/aws-health/recover` e il pannello **"Telecomando IoT di Recupero Attivo"**), l'operatore può inviare comandi mirati di ripristino quando una AWS entra in `WARNING` o `CRITICAL`, registrando ogni intervento nella tabella persistente `StationHealthLog`:

| Indicatore / Anomalia | Tecnologia & Attuatore IoT di Recupero | Effetto Operativo sul Campo | Esito in Dashboard |
|---|---|---|---|
| **Ice Locking** (Anemometro bloccato) | **De-Icing Heater al Nichel-Cromo (15 W)** integrato nel mozzo e nel cuscinetto dell'anemometro, comandato via relè statico MOSFET | Ciclo termico impulsivo che fonde il ghiaccio vetrone liberando elica e banderuola | Ripresa misura vento (`> 0 kt`), streak azzerato -> **`NORMAL`** |
| **Battery Stress** (Crollo tensione al freddo) | **BMS Dual-Battery** con commutazione automatica su cella tampone **LiFePO4 coibentata** + **Film Riscaldatore Kapton** | Isola la batteria degradata, riscalda la cella di emergenza e stabilizza il bus a `13.0 V` | Variazione oraria stabilizzata (`>-0.1 V/h`) -> **`NORMAL`** |
| **Thermal Shock Rate** (Sbalzo termico box) | **Scudo Termico Attivo & Parzializzatore Ventole** (serranda motorizzata micro-step sull'involucro datalogger) | Riduce il gradiente di raffreddamento interno proteggendo l'elettronica | Gradiente termico rientrato entro soglia -> **`NORMAL`** |
| **Data Gap Rate** (Perdita pacchetti) | **Buffer Circolare non volatile su MicroSD** + comando **Burst Retransmission Iridium SBD** | Forza il rinvio compresso degli slot orari mancanti memorizzati localmente | Copertura `24/24` (`0%` gap) -> **`NORMAL`** |
| **Structural Tilt & Stralli** (Inclinazione / Vibrazioni) | **Tensionatore Elettromeccanico sugli Stralli** (attuatore lineare waterproof IP68) + **Ricalibrazione Zero MEMS 25 Hz** | Recupera il gioco meccanico dei cavi di ancoraggio riportando il traliccio in verticale ed esegue nuovo zero a 5s | Inclinazione `< 0.5°`, vibrazione RMS ridotta -> **`NORMAL`** |

