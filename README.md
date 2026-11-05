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