import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceArea, ReferenceLine } from 'recharts';
import PolarMap, { bases } from './components/PolarMap.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const fmt = (v, unit='') => v == null ? '—' : `${Number(v).toFixed(1)}${unit}`;

export default function App() {
  const [stations, setStations] = useState([]);
  const [page, setPage] = useState('map');
  const [selected, setSelected] = useState('BASE_MZS');
  const [mode, setMode] = useState('SIMULATED');
  const [observations, setObservations] = useState([]);
  const [status, setStatus] = useState(null);
  const [health, setHealth] = useState([]);
  const [healthError, setHealthError] = useState('');
  const [scenarioStep, setScenarioStep] = useState(null);
  const [scenarioInfo, setScenarioInfo] = useState('');
  const [scenarioTimestamp, setScenarioTimestamp] = useState('');
  const [scenarioPlaying, setScenarioPlaying] = useState(false);
  const [scenarioStages, setScenarioStages] = useState([]);
  const [scenarioHistory, setScenarioHistory] = useState([]);
  const [timelineConfig, setTimelineConfig] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function loadStations() {
    const r = await fetch(`${API}/api/stations`); if (!r.ok) throw new Error('Backend non raggiungibile');
    const data = await r.json(); setStations(data);
  }
  async function loadObservations(code=selected, dataMode=mode) {
    if (!code || code.startsWith('BASE_')) { setObservations([]); return; }
    const r = await fetch(`${API}/api/observations?station=${encodeURIComponent(code)}&mode=${dataMode}&limit=72`);
    if (r.ok) setObservations(await r.json()); else setObservations([]);
  }
  useEffect(() => { loadStations().catch(e => setMessage(e.message)); fetch(`${API}/api/source-status`).then(r=>r.json()).then(setStatus).catch(()=>{}); fetch(`${API}/api/demo/timeline-config`).then(r=>r.ok?r.json():Promise.reject(new Error('Configurazione timeline non disponibile'))).then(d=>setTimelineConfig(d)).catch(()=>{}); }, []);
  useEffect(() => { loadObservations(); }, [selected, mode]);
  async function loadHealth(dataMode=mode) {
    if (scenarioStep !== null) return;
    try {
      const r = await fetch(`${API}/api/aws-health?mode=${dataMode}`);
      if (!r.ok) throw new Error('API diagnostica non disponibile');
      const d = await r.json(); setHealth(d.stations || []); setHealthError('');
    } catch(e) { setHealthError(e.message); }
  }
  useEffect(() => {
    if (scenarioStep !== null) return;
    loadHealth();
    const timer = setInterval(() => loadHealth(), 60000);
    return () => clearInterval(timer);
  }, [mode, scenarioStep]);
  async function runScenario(step) {
    try {
      const r = await fetch(`${API}/api/demo/timeline?step=${step}`);
      if (!r.ok) throw new Error('Scenario non disponibile');
      const d = await r.json();
      setScenarioStep(step); setTimelineData(d); setScenarioInfo(d.notes); setScenarioTimestamp(d.reference_utc);
      setScenarioHistory(prev => step === 0 ? [{step, stage:`${d.elapsed_seconds}s`, stations:d.stations}] : [...prev.filter(x=>x.step!==step), {step, stage:`${d.elapsed_seconds}s`, stations:d.stations}].sort((a,b)=>a.step-b.step));
      setHealth(d.stations); setHealthError(''); setMode('SIMULATED');
    } catch (e) { setHealthError(e.message); }
  }
  async function exitScenario() {
    setScenarioPlaying(false); setScenarioHistory([]); setScenarioStep(null); setScenarioInfo(''); setTimelineData(null);
    try { const r=await fetch(`${API}/api/aws-health?mode=${mode}`); const d=await r.json(); setHealth(d.stations||[]); setHealthError(''); }
    catch(e) { setHealthError(e.message); }
  }
  // Riproduzione automatica delle fasi: il backend ricalcola ogni snapshot dal CSV.
  useEffect(() => {
    if (!scenarioPlaying) return;
    if (scenarioStep === null || scenarioStep >= (timelineConfig?.duration_seconds ?? 120) / (timelineConfig?.interval_seconds ?? 10)) {
      setScenarioPlaying(false);
      return;
    }
    const timer = setTimeout(() => runScenario(scenarioStep + 1), 3500);
    return () => clearTimeout(timer);
  }, [scenarioPlaying, scenarioStep, timelineConfig]);
  async function startScenario() {
    setScenarioPlaying(false);
    setScenarioHistory([]);
    await runScenario(0);
    setScenarioPlaying(true);
  }
  const openStation = code => { setSelected(code); setPage('map'); };
  const station = [...stations, ...bases].find(s => s.code === selected);
  const isBase = selected.startsWith('BASE_');
  const latest = isBase ? undefined : observations[0];
  const chart = useMemo(() => [...observations].reverse().map(o => ({ time: new Date(o.timestamp).toLocaleString('it-IT', { day:'2-digit', hour:'2-digit', minute:'2-digit', timeZone:'UTC' })+' UTC', temperature: o.temperature_c })), [observations]);

  async function generateDemo() {
    setBusy(true); setMessage('');
    try { const r = await fetch(`${API}/api/demo/generate?hours=72`, { method:'POST' }); const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Errore'); setMode('SIMULATED'); setMessage(`${d.generated} valori simulati generati. Non sono misurazioni ENEA.`); await loadObservations(selected, 'SIMULATED'); await loadHealth('SIMULATED'); }
    catch(e) { setMessage(e.message); } finally { setBusy(false); }
  }
  async function importCSV(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setMessage('');
    try { const fd = new FormData(); fd.append('file', file); const r = await fetch(`${API}/api/import/historical`, { method:'POST', body:fd }); const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Importazione fallita'); setMode('HISTORICAL'); setMessage(`${d.imported} righe importate come dati storici. Qualità non validata.`); await loadObservations(selected, 'HISTORICAL'); await loadHealth('HISTORICAL'); }
    catch(e) { setMessage(e.message); } finally { setBusy(false); e.target.value=''; }
  }

  const healthSelected = health.find(x => x.station_code === selected);
  const riskNames = {battery_stress:'Battery Stress',ice_locking:'Ice Locking',thermal_shock:'Thermal Shock Rate',data_gap:'Data Gap Rate'};
  const riskNotes = {battery_stress:'Discesa massima della tensione nelle ore fredde',ice_locking:'Vento nullo e direzione invariata per 12 ore',thermal_shock:'Crollo massimo della temperatura in un’ora',data_gap:'Percentuale di letture orarie mancanti'};
  const statusLabels = {OK:'Regolare',WARNING:'Attenzione',CRITICAL:'Critico',INSUFFICIENT:'Dati insufficienti',NO_DATA:'Nessun dato'};
  const statusLabel3 = {OK:'OK', WARNING:'WARNING', CRITICAL:'CRITICAL', INSUFFICIENT:'DATI INSUFFICIENTI', NO_DATA:'NESSUN DATO'};
  const statusDescription = {OK:'Nessuna anomalia rilevata', WARNING:'Possibile capacità ridotta / anomalia da verificare', CRITICAL:'Rischio elevato: possibile blocco o guasto', INSUFFICIENT:'Telemetria insufficiente per valutare il rischio', NO_DATA:'Nessuna telemetria disponibile'};
  const riskKeys = ['battery_stress','ice_locking','thermal_shock','data_gap'];
  const counts = Object.fromEntries(['OK','WARNING','CRITICAL','INSUFFICIENT','NO_DATA'].map(s=>[s,health.filter(h=>h.overall===s).length]));
  const [sortStatuses] = [ ['CRITICAL','WARNING','INSUFFICIENT','NO_DATA','OK'] ];
  const sortedHealth = [...health].sort((a,b)=>sortStatuses.indexOf(a.overall)-sortStatuses.indexOf(b.overall));
  // Elenco dinamico: tutte e sole le AWS attualmente in WARNING/CRITICAL.
  // Non usare nomi fissi: anche un'interruzione di telemetria (RITA) deve comparire.
  const activeAlerts = sortedHealth.filter(h => h.overall === 'WARNING' || h.overall === 'CRITICAL');
  const alertHistory = code => scenarioHistory.map(item => ({
    step: item.step,
    seconds: item.step * (timelineConfig?.interval_seconds ?? 10),
    overall: item.stations.find(x => x.station_code === code)?.overall || 'NO_DATA'
  }));
  return <main className="shell">
    <header className="topbar"><div><div className="eyebrow">ENEA · PNRA · IAMCO</div><h1>Antarctic Weather Observatory</h1><p>Osservatorio Meteo-Climatologico Antartico</p></div><div className="top-status"><span className="status-dot"/> PROTOTIPO OPERATIVO</div></header>
    <nav className="page-nav" aria-label="Pagine dashboard"><button className={page==='map'?'current':''} onClick={()=>setPage('map')}>Mappa e dettaglio AWS</button><button className={page==='overview'?'current':''} onClick={()=>setPage('overview')}>Centro salute · tutte le AWS</button></nav>
    {page==='overview' ? <section className="overview-page">
      <div className="overview-heading"><div><h2>Centro di monitoraggio salute AWS</h2><p>Vista simultanea delle 17 stazioni · quattro indicatori per ciascuna AWS</p></div><div className="overview-controls"><label>Origine dati <select value={mode} disabled={scenarioStep!==null} onChange={e=>setMode(e.target.value)}><option value="SIMULATED">SIMULATED</option><option value="HISTORICAL">HISTORICAL</option></select></label><button disabled={scenarioStep!==null} onClick={()=>loadHealth()}>Aggiorna ora</button></div></div>
      <div className="scenario-panel">
        <div><strong>Simulazione evolutiva degli allarmi</strong><p>Telemetria sintetica ogni 10 secondi per 2 minuti. La simulazione include ENEIDE (batteria), JENNICA (anemometro) e RITA (interruzione trasmissioni). Le soglie sono accelerate e non equivalgono a quelle operative orarie. Nessun dato reale viene modificato.</p></div>
        <div className="scenario-actions"><button onClick={startScenario}>▶ Avvia evoluzione automatica</button><button disabled={!scenarioPlaying} onClick={()=>setScenarioPlaying(false)}>⏸ Pausa</button><button onClick={()=>{setScenarioPlaying(false);runScenario(0)}}>0 s</button><button onClick={()=>{setScenarioPlaying(false);runScenario(6)}}>60 s</button><button onClick={()=>{setScenarioPlaying(false);runScenario(12)}}>120 s</button><button onClick={exitScenario}>Torna ai dati</button></div>
        {scenarioStep!==null && <>
          <p className="scenario-alert">SIMULAZIONE ATTIVA · Tempo {scenarioStep*(timelineConfig?.interval_seconds ?? 10)}/{timelineConfig?.duration_seconds ?? 120} secondi · {scenarioInfo} · Snapshot UTC {scenarioTimestamp}</p>
          <section className="active-alerts" aria-label="AWS con allarmi attivi">
            <div className="active-alerts-heading"><strong>AWS in allarme · {activeAlerts.length}</strong><small>Compaiono al passaggio a WARNING o CRITICAL; scompaiono solo quando tornano OK. Dati insufficienti rimangono nella vista completa.</small></div>
            {activeAlerts.length === 0 ? <p className="active-alerts-empty">Nessuna AWS in WARNING o CRITICAL in questo istante.</p> :
              <div className="active-alerts-grid">{activeAlerts.map(h => {
                const name=stations.find(s=>s.code===h.station_code)?.name || h.station_code;
                const affected=riskKeys.filter(k=>['WARNING','CRITICAL'].includes(h.indicators?.[k]?.status));
                return <article key={h.station_code} className={'active-alert-card '+h.overall.toLowerCase()}>
                  <div className="active-alert-title"><b>{name}</b><span className={'risk-status '+h.overall.toLowerCase()}>{h.overall}</span></div>
                  <small>{affected.map(k=>riskNames[k]).join(' · ') || 'Anomalia rilevata'}</small>
                  <div className="scenario-history-row">{alertHistory(h.station_code).map(item=><span key={item.step} className={'risk-status '+item.overall.toLowerCase()}>{item.seconds}s: {item.overall}</span>)}</div>
                  <button onClick={()=>openStation(h.station_code)}>Apri nella mappa →</button>
                </article>;
              })}</div>}
          </section>
        </>}

      </div>
      <div className="traffic-legend"><span className="traffic ok">● Verde · OK — nessun problema rilevato</span><span className="traffic warning">● Giallo · WARNING — capacità potenzialmente ridotta</span><span className="traffic critical">● Rosso · CRITICAL — rischio elevato di blocco</span><span className="traffic unknown">● Grigio · dati insufficienti / assenti</span></div>
      <p className="health-disclaimer">Diagnostica sperimentale, non certificata. Il rosso indica un rischio o una forte anomalia, non la prova di congelamento. I dati SIMULATED non sono osservazioni ENEA. Aggiornamento ogni 60 secondi fuori dalla simulazione.</p>
      {healthError && <div className="data-warning">{healthError}</div>}
      <div className="overview-kpis">{['OK','WARNING','CRITICAL','INSUFFICIENT','NO_DATA'].map(st=><div key={st} className={'overview-kpi '+st.toLowerCase()}><strong>{counts[st]}</strong><span>{statusLabel3[st]}</span></div>)}</div>
      <div className="overview-grid">{sortedHealth.map(h=>{const s=stations.find(x=>x.code===h.station_code);return <article className={'overview-card '+h.overall.toLowerCase()} key={h.station_code}><div className="overview-card-top"><div><h3>{s?.name || h.station_code}</h3><small>{s?.location || h.station_code}</small></div><span className={'risk-status '+h.overall.toLowerCase()}>{statusLabel3[h.overall]}</span></div><p className="overview-status-detail">{statusDescription[h.overall]}</p><div className="overview-indicators">{riskKeys.map(k=>{const v=h.indicators?.[k];return <div className="overview-indicator" key={k}><span className={'indicator-dot '+(v?.status||'no_data').toLowerCase()}></span><div><b>{riskNames[k]}</b><small>{v?.value == null?'—':`${v.value} ${v.unit||''}`} · {statusLabel3[v?.status] || 'NESSUN DATO'}</small></div></div>})}</div><div className="overview-card-bottom"><small>{h.received_hours ?? '—'}/{timelineData ? scenarioStep+1 : 24} letture · {h.reference_utc ? new Date(h.reference_utc).toLocaleString('it-IT',{timeZone:'UTC'})+' UTC':'—'}</small><button onClick={()=>openStation(h.station_code)}>Apri nella mappa →</button></div></article>})}</div>
      {!health.length && <p className="health-disclaimer">Nessuna diagnosi caricata. Controlla il backend e l'origine dati selezionata.</p>}
    </section> : <>
    <section className="metrics">
      <div className="metric"><span>Stazioni censite</span><strong>{stations.length || '—'}</strong></div>
      <div className="metric"><span>POI selezionato</span><strong className="metric-name">{station?.name || '—'}</strong></div>
      <div className="metric"><span>Temperatura</span><strong>{fmt(latest?.temperature_c, ' °C')}</strong></div>
      <div className="metric"><span>Ultima misura</span><strong className="metric-time">{latest ? new Date(latest.timestamp).toLocaleString('it-IT') : 'Nessun dato'}</strong></div>
    </section>
    <section className="workspace">
      <div className="map-panel"><div className="panel-heading"><div><h2>Mappa polare antartica</h2><small>NASA GIBS · EPSG:3031 · stereografica polare</small></div><span className="layer-label">IMMAGINI SATELLITARI</span></div>
        {stations.length ? <PolarMap stations={stations} selected={selected} onSelect={setSelected}/> : <div className="map-loading">Caricamento stazioni…</div>}
      </div>
      <aside className="side-panel"><div className="panel-heading"><div><h2>Stazioni e basi</h2><small>Seleziona una AWS o una base dalla mappa o dall'elenco</small></div></div>
        <select value={selected} onChange={e=>setSelected(e.target.value)}><optgroup label="Basi principali">{bases.map(b=><option key={b.code} value={b.code}>★ {b.name} — {b.location}</option>)}</optgroup><optgroup label="Stazioni AWS">{stations.map(s=><option key={s.code} value={s.code}>{s.name} — {s.location}</option>)}</optgroup></select>
        {station && <div className="station-meta"><div><span>Località</span><b>{station.location}</b></div><div><span>Altitudine</span><b>{station.altitude_m} m</b></div><div><span>Coordinate</span><b>{station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}</b></div><a href={station.source_url} target="_blank" rel="noreferrer">{isBase ? 'Informazioni ufficiali sulla base ↗' : 'Apri pagina dati ufficiale ↗'}</a></div>}
        {isBase && <div className="base-notice">Base di ricerca PNRA: non è una stazione AWS. Le misure meteorologiche sono disponibili selezionando una AWS.</div>}
        {!isBase && <><div className="mode-row"><label htmlFor="mode">Modalità dati</label><select id="mode" value={mode} onChange={e=>setMode(e.target.value)}><option value="SIMULATED">SIMULATED · dimostrativi</option><option value="HISTORICAL">HISTORICAL · importati</option></select></div>
        <div className="data-warning">{mode === 'SIMULATED' ? 'DATI SIMULATI: valori sintetici per testare interfaccia e grafici. Non rappresentano osservazioni reali.' : 'DATI STORICI IMPORTATI: fonte e timestamp sono conservati; qualità scientifica non validata dal prototipo.'}</div>
        <div className="readings"><div><span>Temperatura</span><b>{fmt(latest?.temperature_c, ' °C')}</b></div><div><span>Pressione</span><b>{fmt(latest?.pressure_hpa, ' hPa')}</b></div><div><span>Umidità</span><b>{fmt(latest?.humidity_pct, ' %')}</b></div><div><span>Vento</span><b>{fmt(latest?.wind_speed_kt, ' kt')}</b></div><div><span>Direzione</span><b>{fmt(latest?.wind_direction_deg, '°')}</b></div></div>
        <div className="actions"><button disabled={busy} onClick={generateDemo}>Genera dati demo (72 h)</button><label className="upload-button">Importa CSV storico<input type="file" accept=".csv,text/csv" onChange={importCSV} disabled={busy}/></label></div>
        {message && <div className="message">{message}</div>}</>}
      </aside>
    </section>
    <section className="health-panel">
      <div className="panel-heading"><div><h2>Salute predittiva delle AWS</h2><small>4 indicatori sperimentali · finestra mobile di 24 ore UTC · {mode}</small></div><span className="layer-label">DIAGNOSTICA</span></div>
      <p className="health-disclaimer">Le soglie sono configurazioni dimostrative, non diagnostiche certificate. I dati SIMULATED non rappresentano misure reali. Un Data Gap non dimostra un guasto satellitare o energetico.</p>
      {healthError && <div className="data-warning">{healthError}</div>}
      <div className="health-summary">{['CRITICAL','WARNING','OK','INSUFFICIENT','NO_DATA'].map(s=><div key={s} className={'health-count '+s.toLowerCase()}><b>{health.filter(h=>h.overall===s).length}</b><span>{statusLabels[s]}</span></div>)}</div>
      {!isBase ? <><div className="health-selected"><strong>{station?.name}</strong><span> {healthSelected?.received_hours ?? '—'}/24 letture orarie · {healthSelected?.reference_utc ? new Date(healthSelected.reference_utc).toLocaleString('it-IT',{timeZone:'UTC'})+' UTC' : '—'}</span></div>
      <div className="risk-grid">{Object.entries(riskNames).map(([key,name])=>{const ind=healthSelected?.indicators?.[key];return <div className="risk-card" key={key}><div className="risk-card-head"><b>{name}</b><span className={'risk-status '+(ind?.status||'NO_DATA').toLowerCase()}>{statusLabels[ind?.status] || 'Nessun dato'}</span></div><strong>{ind?.value == null ? '—' : ind.value}{ind?.value == null ? '' : ' '+ind.unit}</strong><p>{riskNotes[key]}</p><small>{ind?.detail || 'Nessuna misura disponibile'}</small>{key==='data_gap' && <small>Ricezione: {ind?.delivery_pct ?? '—'}% ({ind?.received ?? 0}/24)</small>}</div>})}</div></> : <p className="health-disclaimer">Seleziona una AWS per consultare i quattro indicatori. Le basi non sono AWS.</p>}
      <div className="health-table-wrap"><table className="health-table"><thead><tr><th>AWS</th><th>Battery</th><th>Ice</th><th>Thermal</th><th>Gap</th></tr></thead><tbody>{health.map(h=><tr key={h.station_code} onClick={()=>setSelected(h.station_code)} className={selected===h.station_code?'active':''}><td>{stations.find(s=>s.code===h.station_code)?.name || h.station_code}</td>{Object.keys(riskNames).map(key=><td key={key}><span className={'risk-status '+h.indicators[key].status.toLowerCase()}>{h.indicators[key].value == null?'—':h.indicators[key].value+' '+h.indicators[key].unit}</span></td>)}</tr>)}</tbody></table></div>
    </section>
    {!isBase && timelineData && <section className="timeline-charts"><div className="panel-heading"><div><h2>Andamento predittivo · {selected}</h2><small>CSV esterno · campioni ogni 10 s · soglie sperimentali accelerate · {scenarioStep*10}/120 s</small></div><span className="layer-label">SIMULATED</span></div><div className="timeline-grid">{riskKeys.map(key=>{const record=timelineData.stations.find(x=>x.station_code===selected);const spec=timelineData.thresholds?.[key];const data=(record?.series||[]).map((p,i)=>({...p,label:`${i*10}s`}));const descending=key==='battery_stress'||key==='thermal_shock';const vals=data.map(x=>x[key]).filter(v=>v!==null&&Number.isFinite(v));const low=Math.min(0,spec?.critical??0,spec?.warning??0,...vals)-Math.max(0.1,Math.abs(spec?.critical||1)*.15);const high=Math.max(0,spec?.critical??0,spec?.warning??0,...vals)+Math.max(0.1,Math.abs(spec?.critical||1)*.15);const warning=spec?.warning;const critical=spec?.critical;const indicator=record?.indicators?.[key];return <article className="timeline-card" key={key}><div className="risk-card-head"><b>{riskNames[key]}</b><span className={'risk-status '+(indicator?.status||'NO_DATA').toLowerCase()}>{indicator?.status||'NO DATA'}</span></div><p>{indicator?.value==null?'—':indicator.value} {indicator?.unit||''}</p><div className="timeline-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{top:10,right:12,bottom:4,left:0}}><CartesianGrid stroke="#263c50" strokeDasharray="3 3"/><XAxis dataKey="label" stroke="#a8b8c8" interval="preserveStartEnd"/><YAxis stroke="#a8b8c8" domain={[low,high]} width={48}/><Tooltip contentStyle={{background:'#0d1c2b',color:'#fff',border:'1px solid #29445c'}}/><ReferenceArea y1={low} y2={high} fill="#15803d" fillOpacity={0.13}/>{descending?<><ReferenceArea y1={low} y2={critical} fill="#dc2626" fillOpacity={0.25}/><ReferenceArea y1={critical} y2={warning} fill="#facc15" fillOpacity={0.23}/></>:<><ReferenceArea y1={warning} y2={critical} fill="#facc15" fillOpacity={0.23}/><ReferenceArea y1={critical} y2={high} fill="#dc2626" fillOpacity={0.25}/></>}<ReferenceLine y={warning} stroke="#facc15" strokeDasharray="5 3"/><ReferenceLine y={critical} stroke="#ef4444" strokeDasharray="5 3"/><Area type="linear" dataKey={key} stroke="#67d5f2" strokeWidth={2} fill="none" connectNulls={false} dot={{r:2}}/></AreaChart></ResponsiveContainer></div><small>Giallo: {warning} {spec?.unit} · Rosso: {critical} {spec?.unit}</small></article>})}</div><p className="health-disclaimer">La simulazione comprime i tempi: 10 campioni di vento bloccato non rappresentano 12 ore di osservazioni reali. I grafici mostrano le misure e gli indici calcolati dal CSV, non dati ENEA.</p></section>}
    <section className="lower-grid"><div className="chart-panel"><div className="panel-heading"><div><h2>Andamento temperatura</h2><small>Ultime 72 osservazioni disponibili · {mode}</small></div></div>{chart.some(x=>x.temperature != null) ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><defs><linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#39c6d8" stopOpacity={0.35}/><stop offset="95%" stopColor="#39c6d8" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#263c50"/><XAxis dataKey="time" stroke="#8ba1b5" minTickGap={30}/><YAxis stroke="#8ba1b5"/><Tooltip contentStyle={{background:'#0d1c2b',border:'1px solid #29445c',color:'#e8f3fb'}}/><Area type="monotone" dataKey="temperature" name="Temperatura °C" stroke="#39c6d8" fill="url(#tempFill)" connectNulls={false}/></AreaChart></ResponsiveContainer></div> : <div className="empty-chart">Nessuna osservazione per questa stazione e modalità. Genera dati dimostrativi o importa un CSV.</div>}</div>
      <div className="source-panel"><h2>Stato delle fonti</h2><div className="source-item"><span className="source-tag pending">PORTALE</span><div><b>Dati in tempo reale</b><p>Consultazione sul portale ufficiale. Endpoint automatico JSON non ancora verificato.</p><a href="https://www.climantartide.it/realtime/graph/index.php" target="_blank" rel="noreferrer">Apri grafici realtime ↗</a></div></div><div className="source-item"><span className="source-tag ready">CSV</span><div><b>Serie storiche</b><p>Importazione locale di CSV ottenuti secondo le procedure di accesso ENEA-PNRA.</p><a href="https://www.climantartide.it/dataaccess/index.php" target="_blank" rel="noreferrer">Accesso ai dati ↗</a></div></div><p className="attribution">Meteorological dataset and information are achieved by the Italian Antarctic Meteo-Climatological Observatory (IAMCO) of the PNRA.</p></div>
    </section>
    </>}
    <footer>Prototipo dimostrativo · Cartografia satellitare NASA GIBS · Coordinate stazioni dal CSV fornito · I dati sintetici sono sempre etichettati SIMULATED.</footer>
  </main>;
}
