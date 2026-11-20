import React, { useCallback, useEffect, useRef, useState } from "react";
import landingHtmlRaw from "../../Landing/index.html?raw";
import PolarMap from "./components/PolarMap.jsx";
import { getSmartStationZoom } from "./components/polarMapConfig";
import StationCard from "./components/StationCard.jsx";
import ControlMenu from "./components/ControlMenu.jsx";
import TimelineBar from "./components/TimelineBar.jsx";
import AlertSpotlight from "./components/AlertSpotlight.jsx";
import StationDetailDrawer from "./components/StationDetailDrawer.jsx";
import HealthOverviewModal from "./components/HealthOverviewModal.jsx";
import { IconMenu } from "./components/icons.jsx";
import { useAlertDirector } from "./hooks/useAlertDirector";
import { useDashboardData } from "./hooks/useDashboardData";
import { BASES } from "./constants/awsConfig";

const DEMO_BRIDGE_SCRIPT = `<script>
document.addEventListener("click", function (e) {
  var anchor = e.target.closest('a[href^="#"]');
  if (anchor) {
    var id = anchor.getAttribute("href").slice(1);
    var target = id ? document.getElementById(id) : null;
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }
  var link = e.target.closest('a[href="demo.html"]');
  if (link) {
    e.preventDefault();
    window.parent.postMessage("MARCONI_ENTER_DEMO", "*");
  }
});
</script>`;

const LANDING_SRCDOC = landingHtmlRaw.includes("</body>")
  ? landingHtmlRaw.replace("</body>", `${DEMO_BRIDGE_SCRIPT}</body>`)
  : `${landingHtmlRaw}${DEMO_BRIDGE_SCRIPT}`;

export default function App() {
  const [showDashboard, setShowDashboard] = useState(
    () =>
      new URLSearchParams(window.location.search).get("demo") === "1" ||
      window.location.pathname.endsWith("/demo.html"),
  );
  const data = useDashboardData();
  const menuBtnRef = useRef(null);
  const manualSeqRef = useRef(0);
  const [manualFocus, setManualFocus] = useState(null);
  const alertCount = (data.counts?.CRITICAL ?? 0) + (data.counts?.WARNING ?? 0);
  const hasCritical = (data.counts?.CRITICAL ?? 0) > 0;

  const handleSelectStation = useCallback(
    (code, { zoom = true } = {}) => {
      data.setSelected(code);
      if (!code || !zoom) return;
      const target = [...data.stations, ...BASES].find((s) => s.code === code);
      if (target?.latitude != null && target?.longitude != null) {
        manualSeqRef.current += 1;
        setManualFocus({
          lat: target.latitude,
          lon: target.longitude,
          zoom: getSmartStationZoom(code, data.stations),
          seq: manualSeqRef.current,
        });
      }
    },
    [data.stations, data.setSelected],
  );

  const director = useAlertDirector({
    enabled: data.directorEnabled,
    snapshot: data.timelineData?.stations || data.health,
    scenarioActive: data.scenarioStep !== null,
    scenarioStep: data.scenarioStep,
    stepSeconds:
      data.scenarioStep != null
        ? data.scenarioStep * (data.timelineConfig?.interval_seconds ?? 10)
        : 0,
    stations: data.stations,
    onFocusStation: data.setSelected,
  });

  useEffect(() => {
    if (director.isBusy) {
      setManualFocus(null);
    }
  }, [director.isBusy]);

  // Auto-avanzamento scenario gated da director.isBusy (Spec §4.2)
  useEffect(() => {
    if (!data.scenarioPlaying || director.isBusy) return;
    const maxSteps =
      (data.timelineConfig?.duration_seconds ?? 120) /
      (data.timelineConfig?.interval_seconds ?? 10);
    if (data.scenarioStep === null || data.scenarioStep >= maxSteps) {
      data.setScenarioPlaying(false);
      return;
    }
    const timer = setTimeout(() => data.runScenario(data.scenarioStep + 1), 3500);
    return () => clearTimeout(timer);
  }, [
    data.scenarioPlaying,
    data.scenarioStep,
    data.timelineConfig,
    data.runScenario,
    data.setScenarioPlaying,
    director.isBusy,
  ]);

  useEffect(() => {
    if (showDashboard) return undefined;
    const handleMessage = (event) => {
      if (event.data === "MARCONI_ENTER_DEMO") {
        window.history.replaceState(null, "", "?demo=1");
        setShowDashboard(true);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [showDashboard]);

  if (!showDashboard) {
    return (
      <iframe
        title="MARCONI AWS Observer Dashboard"
        srcDoc={LANDING_SRCDOC}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          border: "none",
          display: "block",
          background: "#ffffff",
        }}
      />
    );
  }

  return (
    <main className="windy-shell">
      {/* 1. Mappa polare full-viewport (100vw x 100vh) */}
      <PolarMap
        stations={data.stations}
        selected={data.selected}
        onSelect={(code) => handleSelectStation(code, { zoom: Boolean(code) })}
        health={data.health}
        activeLayerMetric={data.activeLayerMetric}
        mapLayer={data.mapLayer}
        focusTarget={
          director.isBusy
            ? director.focusTarget
            : manualFocus || director.focusTarget
        }
        onResetOverview={() => setManualFocus(null)}
      />

      {/* 2. StationCard (solo se selected !== null, Spec §4.5) */}
      {data.selected && data.station && (
        <StationCard
          station={data.station}
          isBase={data.isBase}
          latest={data.latest}
          healthSelected={data.healthSelected}
          onClose={() => data.setSelected(null)}
          onOpenDrawer={() => data.setIsDrawerOpen(true)}
        />
      )}

      {/* 3. Pulsante Menu top-right (sempre visibile, Spec §3) */}
      <button
        ref={menuBtnRef}
        type="button"
        className={`windy-menu-btn ${data.isMenuOpen ? "is-open" : ""}`}
        onClick={() => data.setIsMenuOpen((v) => !v)}
        title="Apri menu controlli e opzioni"
        aria-label="Menu opzioni"
        aria-expanded={data.isMenuOpen}
      >
        <IconMenu size={18} />
        <span className="menu-btn-label">Controllo Rete</span>
        {alertCount > 0 && (
          <span
            className={`menu-btn-badge tabular-nums ${hasCritical ? "is-critical" : "is-warning"}`}
            title={`${alertCount} stazioni con anomalie attive`}
          >
            <span className="badge-pulse-dot" />
            {alertCount}
          </span>
        )}
      </button>

      {/* 3b. ControlMenu (slide-over destro, Spec §4.6) */}
      <ControlMenu
        isOpen={data.isMenuOpen}
        onClose={() => data.setIsMenuOpen(false)}
        triggerRef={menuBtnRef}
        counts={data.counts}
        activeAlerts={data.activeAlerts}
        onOpenOverview={() => data.setIsOverviewOpen(true)}
        stations={data.stations}
        bases={BASES}
        selected={data.selected}
        onSelectStation={(code) =>
          handleSelectStation(code, { zoom: Boolean(code) })
        }
        directorEnabled={data.directorEnabled}
        onToggleDirector={data.setDirectorEnabled}
        activeLayerMetric={data.activeLayerMetric}
        onChangeLayerMetric={data.setActiveLayerMetric}
        mapLayer={data.mapLayer}
        onChangeMapLayer={data.setMapLayer}
        mode={data.mode}
        onChangeMode={data.setMode}
        scenarioActive={data.scenarioStep !== null}
        busy={data.busy}
        message={data.message}
        onGenerateDemo={data.generateDemo}
        onImportCSV={data.importCSV}
        onBackToLanding={() => {
          data.setIsMenuOpen(false);
          window.history.replaceState(null, "", "/");
          setShowDashboard(false);
        }}
      />

      {/* Alert Spotlight durante la regia automatica (Spec §4.3) */}
      <AlertSpotlight event={director.current} />

      {/* 4. TimelineBar (Spec §4.4) */}
      <TimelineBar
        scenarioStep={data.scenarioStep}
        scenarioPlaying={data.scenarioPlaying}
        timelineConfig={data.timelineConfig}
        scenarioHistory={data.scenarioHistory}
        onStartScenario={() => {
          setManualFocus(null);
          data.startScenario();
        }}
        onPauseScenario={() => {
          director.reset(false);
          data.setScenarioPlaying(false);
        }}
        onResumeScenario={() => data.setScenarioPlaying(true)}
        onSelectStep={(step) => {
          setManualFocus(null);
          director.reset(false);
          data.setScenarioPlaying(false);
          data.runScenario(step);
        }}
        onExitScenario={() => {
          setManualFocus(null);
          director.reset(true);
          data.exitScenario();
        }}
      />

      {/* 5. Modal Dettaglio Stazione Centrale (2 Colonne) */}
      <StationDetailDrawer
        isOpen={data.isDrawerOpen}
        onClose={() => data.setIsDrawerOpen(false)}
        station={data.station}
        selected={data.selected}
        isBase={data.isBase}
        mode={data.mode}
        latest={data.latest}
        chart={data.chart}
        healthSelected={data.healthSelected}
        timelineData={data.timelineData}
        scenarioStep={data.scenarioStep}
        scenarioHistory={data.scenarioHistory}
        stationHistory={data.stationHistory}
        onRecover={data.recoverStation}
        recovering={data.recovering}
        recoveryComment={data.recoveryComment}
      />

      {/* 6. Modal Centro Salute (17 AWS) */}
      <HealthOverviewModal
        isOpen={data.isOverviewOpen}
        onClose={() => data.setIsOverviewOpen(false)}
        stations={data.stations}
        sortedHealth={data.sortedHealth}
        counts={data.counts}
        mode={data.mode}
        onChangeMode={data.setMode}
        scenarioStep={data.scenarioStep}
        timelineData={data.timelineData}
        healthError={data.healthError}
        onRefreshHealth={() => data.loadHealth(data.mode)}
        onSelectStation={(code) =>
          handleSelectStation(code, { zoom: Boolean(code) })
        }
      />
    </main>
  );
}
