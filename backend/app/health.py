"""Experimental AWS early-warning heuristics. All timestamps are UTC."""
from datetime import datetime, timedelta, timezone
from math import isfinite


def _dt(s):
    try:
        d = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        return d.astimezone(timezone.utc) if d.tzinfo else None
    except (ValueError, TypeError):
        return None


def _value(v):
    try:
        return float(v) if v is not None and isfinite(float(v)) else None
    except (ValueError, TypeError):
        return None


def indicator(status, value=None, unit="", detail="", **extra):
    return {"status": status, "value": value, "unit": unit, "detail": detail, **extra}


def assess_station(code, observations, reference, mode):
    start = reference - timedelta(hours=24)
    by_hour = {}
    for o in observations:
        d = _dt(o.timestamp)
        if d is None or not start <= d < reference:
            continue
        # Hourly telemetry expected: accept only readings at the exact hour.
        if d.minute != 0 or d.second != 0:
            continue
        hour = d.replace(minute=0, second=0, microsecond=0)
        if hour not in by_hour:
            by_hour[hour] = o
    rows = sorted(by_hour.items())
    expected = [reference.replace(minute=0, second=0, microsecond=0) - timedelta(hours=i) for i in range(1, 25)]
    # When reference is not aligned to an hour, the most recent completed hour is included.
    if reference.minute or reference.second or reference.microsecond:
        expected = [reference.replace(minute=0, second=0, microsecond=0) - timedelta(hours=i) for i in range(24)]
    slots = {h: by_hour.get(h) for h in expected}
    received = sum(o is not None for o in slots.values())
    gap = indicator("OK" if received == 24 else "WARNING" if received >= 21 else "CRITICAL",
                    round(100 * (24 - received) / 24, 1), "%", f"{24-received} slot orari mancanti su 24", received=received,
                    expected=24, delivery_pct=round(received / 24 * 100, 1))
    if not rows:
        gap["status"] = "NO_DATA"  # no basis to diagnose the transmission channel
    # Battery: maximum negative dV/dt in cold hours, requires at least two adjacent hourly readings.
    slopes = []
    for (t1, a), (t2, b) in zip(rows, rows[1:]):
        v1, v2 = _value(a.battery_v), _value(b.battery_v)
        temp = _value(b.temperature_c)
        if v1 is not None and v2 is not None and temp is not None and temp < -20 and (t2-t1) == timedelta(hours=1):
            slopes.append((v2-v1, t2))
    if slopes:
        worst, when = min(slopes)
        battery = indicator("CRITICAL" if worst <= -0.5 else "WARNING" if worst <= -0.2 else "OK",
                            round(worst, 3), "V/h", "Massima discesa oraria con T < -20 °C", at=when.isoformat())
    else:
        battery = indicator("INSUFFICIENT", detail="Servono tensione e temperatura su due ore consecutive con T < -20 °C")
    # Ice lock: 12 *consecutive hourly* complete observations; do not bridge gaps.
    streak = 0
    longest = 0
    previous = None
    fixed_direction = None
    for ts, o in rows:
        v, d, temp, humidity = map(_value, (o.wind_speed_kt, o.wind_direction_deg, o.temperature_c, o.humidity_pct))
        valid = v is not None and d is not None and temp is not None and v == 0 and temp < -20
        if valid and previous is not None and ts - previous == timedelta(hours=1) and d == fixed_direction:
            streak += 1
        elif valid:
            streak = 1
        else:
            streak = 0
        previous = ts
        fixed_direction = d if valid else None
        longest = max(longest, streak)
    valid_wind = sum(_value(o.wind_speed_kt) is not None and _value(o.wind_direction_deg) is not None and _value(o.temperature_c) is not None for _, o in rows)
    ice = indicator("CRITICAL" if longest >= 12 else "WARNING" if longest >= 6 else "OK" if valid_wind >= 12 else "INSUFFICIENT",
                    longest if valid_wind else None, "h", "Ore consecutive con vento 0, direzione invariata e T < -20 °C; sospetto, non prova di ghiaccio", humidity_used=False)
    # Thermal: maximum one-hour cooling between strictly adjacent readings.
    drops = []
    for (t1, a), (t2, b) in zip(rows, rows[1:]):
        v1, v2 = _value(a.temperature_c), _value(b.temperature_c)
        if v1 is not None and v2 is not None and t2 - t1 == timedelta(hours=1):
            drops.append((v2-v1, t2))
    if drops:
        worst, when = min(drops)
        thermal = indicator("CRITICAL" if worst <= -10 else "WARNING" if worst <= -8 else "OK",
                            round(worst, 2), "°C/h", "Massima variazione negativa in un'ora", at=when.isoformat())
    else:
        thermal = indicator("INSUFFICIENT", detail="Servono almeno due temperature orarie consecutive")
    indicators = {"battery_stress": battery, "ice_locking": ice, "thermal_shock": thermal, "data_gap": gap}
    priority = ["CRITICAL", "WARNING", "INSUFFICIENT", "NO_DATA", "OK"]
    overall = next((s for s in priority if any(v["status"] == s for v in indicators.values())), "NO_DATA")
    return {"station_code": code, "mode": mode, "reference_utc": reference.isoformat(),
            "received_hours": received, "overall": overall, "indicators": indicators}
