import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from app.health import assess_station

class HealthTests(unittest.TestCase):
    def test_all_four_indicators(self):
        end = datetime(2026, 10, 31, 0, tzinfo=timezone.utc)
        rows=[]
        for i in range(24):
            t=end-timedelta(hours=24-i)
            rows.append(SimpleNamespace(timestamp=t.isoformat(), battery_v=12.5-i*.04, temperature_c=-25.0, humidity_pct=80, wind_speed_kt=0, wind_direction_deg=120))
        rows[-1].battery_v=10.0
        rows[-1].temperature_c=-36
        rows.pop(2)
        r=assess_station('TEST', rows, end, 'HISTORICAL')
        self.assertEqual(r['indicators']['data_gap']['value'],4.2)
        self.assertEqual(r['indicators']['battery_stress']['status'],'CRITICAL')
        self.assertEqual(r['indicators']['ice_locking']['status'],'CRITICAL')
        self.assertEqual(r['indicators']['thermal_shock']['status'],'CRITICAL')
    def test_empty(self):
        r=assess_station('TEST',[],datetime(2026,10,31,tzinfo=timezone.utc),'HISTORICAL')
        self.assertEqual(r['indicators']['battery_stress']['status'],'INSUFFICIENT')
        self.assertEqual(r['indicators']['data_gap']['status'],'NO_DATA')
if __name__=='__main__': unittest.main()
