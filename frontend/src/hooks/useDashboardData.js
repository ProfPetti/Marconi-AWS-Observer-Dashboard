import { useState, useEffect, useMemo, useCallback } from "react";
import { API, BASES, SORT_STATUSES } from "../constants/awsConfig";

const TILT_RECOVERY_COMMENT =
  'Il sistema cercherà di recuperare lo stato "CRITICAL" tramite un attuatore lineare a cui è collegato il filo di tiraggio in acciaio che servirà a raddrizzare il pilastro della centrale.';

export function useDashboardData() {
  const [stations, setStations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("SIMULATED");
  const [observations, setObservations] = useState([]);
  const [health, setHealth] = useState([]);
  const [healthError, setHealthError] = useState("");

  // Layer ed opzioni mappa / diagnostica
  const [activeLayerMetric, setActiveLayerMetric] = useState("overall");
  const [mapLayer, setMapLayer] = useState("MODIS");

  // Stati Overlay, Drawer e Menu
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Regia automatica (Spec §4.2)
  const [directorEnabled, setDirectorEnabled] = useState(true);

  // Stati Scenario & Simulazione
  const [scenarioStep, setScenarioStep] = useState(null);
  const [scenarioInfo, setScenarioInfo] = useState("");
  const [scenarioTimestamp, setScenarioTimestamp] = useState("");
  const [scenarioPlaying, setScenarioPlaying] = useState(false);
  const [scenarioHistory, setScenarioHistory] = useState([]);
  const [timelineConfig, setTimelineConfig] = useState(null);
  const [timelineData, setTimelineData] = useState(null);

  // Feedback & Caricamento
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [stationHistory, setStationHistory] = useState([]);
  const [recovering, setRecovering] = useState(false);
  const [recoveryComment, setRecoveryComment] = useState("");

  useEffect(() => {
    setRecoveryComment("");
  }, [selected]);

  const loadStations = useCallback(async () => {
    const r = await fetch(`${API}/api/stations`);
    if (!r.ok) throw new Error("Backend non raggiungibile");
    const data = await r.json();
    setStations(data);
  }, []);

  const loadObservations = useCallback(async (code = selected, dataMode = mode) => {
    if (!code || code.startsWith("BASE_")) {
      setObservations([]);
      return;
    }
    try {
      const r = await fetch(
        `${API}/api/observations?station=${encodeURIComponent(code)}&mode=${dataMode}&limit=72`,
      );
      if (r.ok) setObservations(await r.json());
      else setObservations([]);
    } catch {
      setObservations([]);
    }
  }, [selected, mode]);

  useEffect(() => {
    loadStations().catch((e) => setMessage(e.message));
    fetch(`${API}/api/demo/timeline-config`)
      .then((r) =>
        r.ok
          ? r.json()
          : Promise.reject(new Error("Configurazione timeline non disponibile")),
      )
      .then((d) => setTimelineConfig(d))
      .catch(() => {});
  }, [loadStations]);

  useEffect(() => {
    loadObservations();
  }, [loadObservations]);

  const loadStationHistory = useCallback(async (code = selected, dataMode = mode) => {
    if (!code || code.startsWith("BASE_")) {
      setStationHistory([]);
      return;
    }
    try {
      const r = await fetch(
        `${API}/api/aws-health/history?station=${encodeURIComponent(code)}&mode=${dataMode}&limit=30`,
      );
      if (r.ok) setStationHistory(await r.json());
      else setStationHistory([]);
    } catch {
      setStationHistory([]);
    }
  }, [selected, mode]);

  useEffect(() => {
    loadStationHistory();
  }, [loadStationHistory]);

  const loadHealth = useCallback(async (dataMode = mode) => {
    if (scenarioStep !== null) return;
    try {
      const r = await fetch(`${API}/api/aws-health?mode=${dataMode}`);
      if (!r.ok) throw new Error("API diagnostica non disponibile");
      const d = await r.json();
      setHealth(d.stations || []);
      setHealthError("");
    } catch (e) {
      setHealthError(e.message);
    }
  }, [mode, scenarioStep]);

  useEffect(() => {
    if (scenarioStep !== null) return;
    loadHealth();
    const timer = setInterval(() => loadHealth(), 60000);
    return () => clearInterval(timer);
  }, [loadHealth, scenarioStep]);

  const runScenario = useCallback(async (step) => {
    try {
      const r = await fetch(`${API}/api/demo/timeline?step=${step}`);
      if (!r.ok) throw new Error("Scenario non disponibile");
      const d = await r.json();
      setScenarioStep(step);
      setTimelineData(d);
      setScenarioInfo(d.notes);
      setScenarioTimestamp(d.reference_utc);
      setScenarioHistory((prev) =>
        step === 0
          ? [{ step, stage: `${d.elapsed_seconds}s`, stations: d.stations }]
          : [
              ...prev.filter((x) => x.step !== step),
              { step, stage: `${d.elapsed_seconds}s`, stations: d.stations },
            ].sort((a, b) => a.step - b.step),
      );
      setHealth(d.stations);
      setHealthError("");
      setMode("SIMULATED");
    } catch (e) {
      setHealthError(e.message);
    }
  }, []);

  const exitScenario = useCallback(async () => {
    setScenarioPlaying(false);
    setScenarioHistory([]);
    setScenarioStep(null);
    setScenarioInfo("");
    setTimelineData(null);
    try {
      const r = await fetch(`${API}/api/aws-health?mode=${mode}`);
      const d = await r.json();
      setHealth(d.stations || []);
      setHealthError("");
    } catch (e) {
      setHealthError(e.message);
    }
  }, [mode]);

  const startScenario = useCallback(async () => {
    setScenarioPlaying(false);
    setScenarioHistory([]);
    await runScenario(0);
    setScenarioPlaying(true);
  }, [runScenario]);

  const recoverStation = useCallback(
    async (indicator = "structural_tilt", code = selected) => {
      if (!code || code.startsWith("BASE_")) return;
      setRecovering(true);
      setMessage("");
      try {
        const r = await fetch(`${API}/api/aws-health/recover`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ station_code: code, indicator }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.detail || "Comando di recupero fallito");

        // Se siamo nella Simulazione 120s, aggiorna immediatamente anche lo stato in memoria
        if (scenarioStep !== null) {
          const nominalValues = {
            battery_stress: -0.04,
            ice_locking: 0,
            thermal_shock: -1.5,
            data_gap: 0,
            structural_tilt: 0.42,
          };
          const targets =
            indicator === "ALL" ? Object.keys(nominalValues) : [indicator];
          const patchStation = (st) => {
            if (st.station_code !== code) return st;
            const nextIndicators = { ...st.indicators };
            for (const key of targets) {
              if (!nextIndicators[key]) continue;
              const patched = {
                ...nextIndicators[key],
                status: "OK",
                value: nominalValues[key],
                detail: "Ripristinato via Telecomando IoT di Recupero Attivo",
              };
              if (key === "data_gap") {
                patched.received = st.expected_slots ?? patched.expected ?? 13;
                patched.delivery_pct = 100.0;
              }
              if (key === "structural_tilt") {
                patched.vibration_rms_deg = 0.17;
              }
              nextIndicators[key] = patched;
            }
            const nextOverall =
              SORT_STATUSES.find((s) =>
                Object.values(nextIndicators).some((ind) => ind?.status === s),
              ) || "OK";
            const nextLatest = st.latest
              ? {
                  ...st.latest,
                  ...(targets.includes("structural_tilt") ? { tilt_deg: 0.42 } : {}),
                  ...(targets.includes("battery_stress") ? { battery_v: 13.05 } : {}),
                  ...(targets.includes("ice_locking") ? { wind_speed_kt: 8.4 } : {}),
                }
              : st.latest;
            return {
              ...st,
              overall: nextOverall,
              indicators: nextIndicators,
              latest: nextLatest,
            };
          };

          setHealth((prev) => prev.map(patchStation));
          setTimelineData((prev) =>
            prev
              ? { ...prev, stations: (prev.stations || []).map(patchStation) }
              : prev,
          );
        } else {
          await loadHealth(mode);
          await loadObservations(code, mode);
        }

        await loadStationHistory(code, mode);
        setRecoveryComment(TILT_RECOVERY_COMMENT);
        setMessage(`Recupero IoT eseguito su ${code}: ${TILT_RECOVERY_COMMENT}`);
      } catch (e) {
        setMessage(e.message);
      } finally {
        setRecovering(false);
      }
    },
    [selected, scenarioStep, mode, loadHealth, loadObservations, loadStationHistory],
  );

  const generateDemo = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(`${API}/api/demo/generate?hours=72`, {
        method: "POST",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Errore");
      setMode("SIMULATED");
      setMessage(`${d.generated} valori simulati generati. Non sono misurazioni ENEA.`);
      await loadObservations(selected, "SIMULATED");
      await loadHealth("SIMULATED");
      await loadStationHistory(selected, "SIMULATED");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }, [selected, loadObservations, loadHealth, loadStationHistory]);

  const importCSV = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${API}/api/import/historical`, {
        method: "POST",
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Importazione fallita");
      setMode("HISTORICAL");
      setMessage(`${d.imported} righe importate come dati storici. Qualità non validata.`);
      await loadObservations(selected, "HISTORICAL");
      await loadHealth("HISTORICAL");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }, [selected, loadObservations, loadHealth]);

  const station = useMemo(
    () => (selected ? [...stations, ...BASES].find((s) => s.code === selected) : null),
    [stations, selected],
  );
  const isBase = Boolean(selected && selected.startsWith("BASE_"));
  const healthSelected = useMemo(
    () => health.find((x) => x.station_code === selected),
    [health, selected],
  );
  const latest =
    isBase || !selected
      ? undefined
      : scenarioStep !== null && healthSelected?.latest
        ? healthSelected.latest
        : observations[0];

  const chart = useMemo(
    () =>
      [...observations].reverse().map((o) => ({
        time:
          new Date(o.timestamp).toLocaleString("it-IT", {
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          }) + " UTC",
        temperature: o.temperature_c,
      })),
    [observations],
  );

  const counts = useMemo(
    () =>
      Object.fromEntries(
        ["OK", "WARNING", "CRITICAL", "INSUFFICIENT", "NO_DATA"].map((s) => [
          s,
          health.filter((h) => h.overall === s).length,
        ]),
      ),
    [health],
  );

  const sortedHealth = useMemo(
    () =>
      [...health].sort(
        (a, b) => SORT_STATUSES.indexOf(a.overall) - SORT_STATUSES.indexOf(b.overall),
      ),
    [health],
  );

  const activeAlerts = useMemo(
    () => sortedHealth.filter((h) => h.overall === "WARNING" || h.overall === "CRITICAL"),
    [sortedHealth],
  );

  const alertHistory = useCallback(
    (code) =>
      scenarioHistory.map((item) => ({
        step: item.step,
        seconds: item.step * (timelineConfig?.interval_seconds ?? 10),
        overall: item.stations.find((x) => x.station_code === code)?.overall || "NO_DATA",
      })),
    [scenarioHistory, timelineConfig],
  );

  return {
    stations,
    selected,
    setSelected,
    station,
    isBase,
    latest,
    mode,
    setMode,
    observations,
    health,
    healthSelected,
    healthError,
    activeLayerMetric,
    setActiveLayerMetric,
    mapLayer,
    setMapLayer,
    isDrawerOpen,
    setIsDrawerOpen,
    isOverviewOpen,
    setIsOverviewOpen,
    isMenuOpen,
    setIsMenuOpen,
    directorEnabled,
    setDirectorEnabled,
    scenarioStep,
    scenarioInfo,
    scenarioTimestamp,
    scenarioPlaying,
    setScenarioPlaying,
    scenarioHistory,
    timelineConfig,
    timelineData,
    busy,
    message,
    stationHistory,
    recovering,
    recoveryComment,
    chart,
    counts,
    sortedHealth,
    activeAlerts,
    loadHealth,
    loadStationHistory,
    recoverStation,
    runScenario,
    exitScenario,
    startScenario,
    generateDemo,
    importCSV,
    alertHistory,
  };
}

