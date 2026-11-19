/**
 * Rileva transizioni di allarme tra due snapshot consecutivi di stazioni AWS.
 *
 * Regole (Spec §4.2):
 * - OK/INSUFFICIENT/NO_DATA → WARNING o CRITICAL
 * - WARNING → CRITICAL
 * - I rientri a OK non generano eventi.
 * - Ordinati con CRITICAL prima di WARNING.
 *
 * @param {Array} prevStations Snapshot precedente (può essere null/empty allo step 0)
 * @param {Array} nextStations Nuovo snapshot
 * @returns {Array<{ station_code: string, from: string, to: string, indicators: Array }>}
 */
export function detectAlertTransitions(prevStations, nextStations) {
  if (!prevStations || !nextStations || !Array.isArray(nextStations)) {
    return [];
  }

  const prevMap = new Map();
  for (const s of prevStations) {
    if (s?.station_code) {
      prevMap.set(s.station_code, s);
    }
  }

  const events = [];

  for (const next of nextStations) {
    if (!next?.station_code) continue;

    const prev = prevMap.get(next.station_code);
    const prevOverall = prev?.overall || "NO_DATA";
    const nextOverall = next?.overall || "NO_DATA";

    const isUpgradeToAlert =
      (prevOverall === "OK" ||
        prevOverall === "INSUFFICIENT" ||
        prevOverall === "NO_DATA") &&
      (nextOverall === "WARNING" || nextOverall === "CRITICAL");

    const isEscalationToCritical =
      prevOverall === "WARNING" && nextOverall === "CRITICAL";

    if (isUpgradeToAlert || isEscalationToCritical) {
      const indicators = Object.entries(next.indicators || {})
        .filter(
          ([, ind]) => ind?.status === "WARNING" || ind?.status === "CRITICAL",
        )
        .map(([key, ind]) => ({
          key,
          status: ind.status,
          value: ind.value,
          unit: ind.unit || "",
        }));

      events.push({
        station_code: next.station_code,
        from: prevOverall,
        to: nextOverall,
        indicators,
      });
    }
  }

  // Ordina CRITICAL prima di WARNING, poi alfabetico per station_code
  events.sort((a, b) => {
    if (a.to === "CRITICAL" && b.to !== "CRITICAL") return -1;
    if (b.to === "CRITICAL" && a.to !== "CRITICAL") return 1;
    return a.station_code.localeCompare(b.station_code);
  });

  return events;
}

