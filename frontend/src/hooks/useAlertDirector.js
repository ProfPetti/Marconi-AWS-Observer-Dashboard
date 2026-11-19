import { useState, useEffect, useRef, useCallback } from "react";
import { detectAlertTransitions } from "../utils/alerts";
import { getSmartStationZoom } from "../components/polarMapConfig";

/**
 * Hook per la Regia Automatica della Demo (Spec §4.2)
 *
 * - Rileva transizioni di allarme ad ogni snapshot della simulazione
 * - Step 0: solo registrazione baseline, nessun evento
 * - Step >= 1: eventi in coda FIFO (CRITICAL prima di WARNING)
 * - Per ciascun evento: seleziona la stazione, flyTo con zoom adattivo, AlertSpotlight per 3.5s
 * - A coda vuota: deseleziona e ritorna a flyTo "overview"
 * - isBusy sospende l'avanzamento automatico dello scenario in App.jsx
 * - reset() svuota coda e chiude spotlight su pausa/esci/click manuale
 */
export function useAlertDirector({
  enabled = true,
  snapshot = null,
  scenarioActive = false,
  scenarioStep = null,
  stepSeconds = 0,
  stations = [],
  onFocusStation = null,
}) {
  const [current, setCurrent] = useState(null);
  const [focusTarget, setFocusTarget] = useState(null);
  const [queueLength, setQueueLength] = useState(0);

  const queueRef = useRef([]);
  const timerRef = useRef(null);
  const prevSnapshotRef = useRef(null);
  const lastStepRef = useRef(null);
  const onFocusStationRef = useRef(onFocusStation);
  const focusSeqRef = useRef(0);

  useEffect(() => {
    onFocusStationRef.current = onFocusStation;
  }, [onFocusStation]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(
    (clearSelection = false) => {
      clearTimer();
      queueRef.current = [];
      setQueueLength(0);
      setCurrent(null);
      focusSeqRef.current += 1;
      setFocusTarget("overview");
      if (clearSelection) {
        onFocusStationRef.current?.(null);
      }
    },
    [clearTimer],
  );

  // Se la simulazione non è attiva o la regia è disabilitata, resetta
  useEffect(() => {
    if (!scenarioActive || !enabled) {
      clearTimer();
      queueRef.current = [];
      setQueueLength(0);
      setCurrent(null);
      prevSnapshotRef.current = null;
      lastStepRef.current = null;
    }
  }, [scenarioActive, enabled, clearTimer]);

  // Elaborazione evento successivo dalla coda
  const processNextEvent = useCallback(() => {
    if (queueRef.current.length === 0) {
      setCurrent(null);
      focusSeqRef.current += 1;
      setFocusTarget("overview");
      setQueueLength(0);
      onFocusStationRef.current?.(null);
      return;
    }

    const nextEvent = queueRef.current.shift();
    setQueueLength(queueRef.current.length);

    const st = stations.find((s) => s.code === nextEvent.station_code);
    const enrichedEvent = {
      ...nextEvent,
      stationName: st?.name || nextEvent.station_code,
      location: st?.location || "",
    };

    // Seleziona automaticamente la stazione in primo piano e aggiorna la camera
    onFocusStationRef.current?.(nextEvent.station_code);
    setCurrent(enrichedEvent);
    if (st?.latitude != null && st?.longitude != null) {
      focusSeqRef.current += 1;
      setFocusTarget({
        lat: st.latitude,
        lon: st.longitude,
        zoom: getSmartStationZoom(st.code, stations),
        seq: focusSeqRef.current,
      });
    }

    clearTimer();
    timerRef.current = setTimeout(() => {
      processNextEvent();
    }, 3500);
  }, [stations, clearTimer]);

  // Monitoraggio cambi snapshot e step dello scenario
  useEffect(() => {
    if (!scenarioActive || !enabled || !snapshot || scenarioStep === null) {
      return;
    }

    // Step 0: Registra baseline senza generare allarmi
    if (scenarioStep === 0) {
      prevSnapshotRef.current = snapshot;
      lastStepRef.current = 0;
      queueRef.current = [];
      setQueueLength(0);
      return;
    }

    // Step > 0: Controlla se è un nuovo step da processare
    if (scenarioStep !== lastStepRef.current) {
      const transitions = detectAlertTransitions(
        prevSnapshotRef.current,
        snapshot,
      );

      prevSnapshotRef.current = snapshot;
      lastStepRef.current = scenarioStep;

      if (transitions.length > 0) {
        const newItems = transitions.map((t) => ({
          ...t,
          seconds: stepSeconds,
        }));
        queueRef.current.push(...newItems);
        setQueueLength(queueRef.current.length);

        // Se non c'è già un evento in riproduzione, avvia la coda
        if (!current) {
          processNextEvent();
        }
      }
    }
  }, [
    snapshot,
    scenarioStep,
    scenarioActive,
    enabled,
    stepSeconds,
    current,
    processNextEvent,
  ]);

  // Cleanup all'unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const isBusy = Boolean(current || queueLength > 0);

  return {
    current,
    isBusy,
    reset,
    focusTarget,
  };
}
