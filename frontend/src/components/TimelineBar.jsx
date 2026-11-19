import React, { useEffect } from "react";
import { IconPlay, IconPause, IconX } from "./icons";

function getWorstStatus(stations = []) {
  if (!stations || stations.length === 0) return null;
  const rank = { CRITICAL: 4, WARNING: 3, INSUFFICIENT: 2, NO_DATA: 1, OK: 0 };
  let worst = "OK";
  let worstRank = 0;
  for (const s of stations) {
    const st = s.overall || "NO_DATA";
    const r = rank[st] ?? 0;
    if (r > worstRank) {
      worstRank = r;
      worst = st;
    }
  }
  return worst;
}

export default function TimelineBar({
  scenarioStep = null,
  scenarioPlaying = false,
  timelineConfig = null,
  scenarioHistory = [],
  onStartScenario,
  onPauseScenario,
  onResumeScenario,
  onSelectStep,
  onExitScenario,
}) {
  const duration = timelineConfig?.duration_seconds ?? 120;
  const interval = timelineConfig?.interval_seconds ?? 10;
  const totalSteps = Math.floor(duration / interval);
  const steps = Array.from({ length: totalSteps + 1 }, (_, i) => i);

  const isScenarioActive = scenarioStep !== null;
  const currentSeconds = isScenarioActive ? scenarioStep * interval : 0;
  const progressPct = isScenarioActive && totalSteps > 0 ? (scenarioStep / totalSteps) * 100 : 0;

  // Scorciatoie da tastiera: Spazio (Play/Pausa), Freccia Sinistra/Destra (Step)
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (scenarioPlaying) {
          onPauseScenario?.();
        } else {
          if (scenarioStep !== null) {
            onResumeScenario ? onResumeScenario() : onStartScenario?.();
          } else {
            onStartScenario?.();
          }
        }
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (scenarioStep !== null && scenarioStep > 0) {
          onSelectStep?.(scenarioStep - 1);
        }
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        if (scenarioStep === null) {
          onSelectStep?.(0);
        } else if (scenarioStep < totalSteps) {
          onSelectStep?.(scenarioStep + 1);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    scenarioPlaying,
    scenarioStep,
    totalSteps,
    onPauseScenario,
    onResumeScenario,
    onStartScenario,
    onSelectStep,
  ]);

  return (
    <footer className="timeline-bar" aria-label="Controlli simulazione allarmi">
      <div className="timeline-bar-inner">
        <span className={`timeline-sim-badge ${isScenarioActive ? "is-active" : ""}`}>
          SIM 120s
        </span>

        {/* Pulsante Play / Pausa */}
        <button
          type="button"
          className={`timeline-play-btn ${scenarioPlaying ? "is-playing" : ""}`}
          onClick={() => {
            if (scenarioPlaying) {
              onPauseScenario?.();
            } else if (scenarioStep !== null) {
              onResumeScenario ? onResumeScenario() : onStartScenario?.();
            } else {
              onStartScenario?.();
            }
          }}
          title={
            scenarioPlaying
              ? "Pausa simulazione (Spazio)"
              : scenarioStep !== null
                ? "Riprendi simulazione (Spazio)"
                : "Avvia simulazione 120s (Spazio)"
          }
          aria-label={scenarioPlaying ? "Pausa" : "Riproduci"}
        >
          {scenarioPlaying ? <IconPause size={18} /> : <IconPlay size={18} />}
        </button>

        {/* Traccia con tacche temporali */}
        <div className="timeline-track-wrap">
          <div className="timeline-track" role="group" aria-label="Passi simulazione">
            <span
              className="timeline-progress-fill"
              style={{ width: `${progressPct}%` }}
              aria-hidden="true"
            />
            {steps.map((s) => {
              const sec = s * interval;
              const isActive = scenarioStep === s;
              const isPast = scenarioStep !== null && s < scenarioStep;
              const hist = scenarioHistory.find((h) => h.step === s);
              const worst = hist ? getWorstStatus(hist.stations) : null;
              const worstClass = worst ? `status-${worst.toLowerCase()}` : "";
              const showLabel = sec === 0 || sec === 60 || sec === duration;

              return (
                <button
                  key={s}
                  type="button"
                  className={`timeline-pip-btn ${isActive ? "active" : ""} ${isPast ? "past" : ""}`}
                  onClick={() => onSelectStep?.(s)}
                  title={`Vai a t = ${sec} s`}
                  aria-label={`Step ${sec} secondi`}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span className={`timeline-pip ${worstClass}`} />
                  {showLabel && (
                    <span className="timeline-pip-label tabular-nums">
                      {sec}s
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Indicatore tempo corrente */}
        <div className="timeline-time-info tabular-nums">
          {isScenarioActive ? (
            <span>
              t = <strong>{currentSeconds}</strong> s / {duration} s
            </span>
          ) : (
            <span className="timeline-idle-label">0–{duration} s</span>
          )}
        </div>

        {/* Pulsante Esci (solo se simulazione attiva) */}
        {isScenarioActive && (
          <button
            type="button"
            className="timeline-exit-btn"
            onClick={onExitScenario}
            title="Esci dalla simulazione"
            aria-label="Esci dalla simulazione"
          >
            <IconX size={16} />
            <span>Esci</span>
          </button>
        )}
      </div>
    </footer>
  );
}

