"""CSV-driven, accelerated 10-second AWS demonstration. Not operational diagnostics."""
from pathlib import Path
from datetime import datetime, timedelta, timezone
import csv, json

DATA=Path(__file__).resolve().parents[1]/'data'

def load_config():
    return json.loads((DATA/'scenario_120s.json').read_text(encoding='utf-8'))

def parse_time(s):
    return datetime.fromisoformat(s.replace('Z','+00:00'))

def level(value, warning, critical, decreasing=False):
    if value is None: return 'INSUFFICIENT'
    if decreasing:
        return 'CRITICAL' if value <= critical else 'WARNING' if value <= warning else 'OK'
    return 'CRITICAL' if value >= critical else 'WARNING' if value >= warning else 'OK'

def calc_station(code, samples, current, cfg):
    interval=cfg['interval_seconds']; th=cfg['thresholds']; start=parse_time(cfg['start_utc'])
    samples=sorted((r for r in samples if r['time']<=current),key=lambda x:x['time'])
    by_time={r['time']:r for r in samples}
    expected=int((current-start).total_seconds()/interval)+1
    missing=max(0,expected-len(by_time))
    gap=100*missing/expected if expected else None
    battery_rates=[]; thermal_rates=[]; tilt_values=[]; streak=0; max_streak=0; prev=None
    points=[]
    for i in range(expected):
        ts=start+timedelta(seconds=i*interval); r=by_time.get(ts)
        if r is None:
            streak=0;prev=None
            points.append({'time':ts.isoformat(),'battery_stress':None,'ice_locking':0,'thermal_shock':None,'data_gap':round(100*(i+1-len([x for x in samples if x['time']<=ts]))/(i+1),2),'structural_tilt':None})
            continue
        br=0.0 if i==0 else None
        tr=0.0 if i==0 else None
        if prev and (r['time']-prev['time']).total_seconds()==interval:
            if r['battery_v'] is not None and prev['battery_v'] is not None and r['temperature_c'] is not None and r['temperature_c'] < -20:
                br=round((r['battery_v']-prev['battery_v'])*60/interval,3)
                battery_rates.append(br)
            if r['temperature_c'] is not None and prev['temperature_c'] is not None:
                tr=round((r['temperature_c']-prev['temperature_c'])*60/interval,3)
                thermal_rates.append(tr)
        st_tilt=r.get('tilt_deg')
        if st_tilt is not None:
            tilt_values.append(st_tilt)
        valid=r['wind_speed_kt']==0 and r['wind_direction_deg'] is not None and r['temperature_c'] is not None and r['temperature_c'] < -20
        if valid and prev and (r['time']-prev['time']).total_seconds()==interval and prev['wind_speed_kt']==0 and prev['wind_direction_deg']==r['wind_direction_deg']:
            streak+=1
        elif valid: streak=1
        else: streak=0
        max_streak=max(max_streak,streak)
        prev=r
        points.append({'time':ts.isoformat(),'battery_stress':br,'ice_locking':streak,'thermal_shock':tr,'data_gap':round(100*(i+1-len([x for x in samples if x['time']<=ts]))/(i+1),2),'structural_tilt':st_tilt})
    battery=min(battery_rates) if battery_rates else (0 if samples else None)
    thermal=min(thermal_rates) if thermal_rates else (0 if samples else None)
    latest_tilt=tilt_values[-1] if tilt_values else (0.4 if samples else None)
    values={'battery_stress':battery,'ice_locking':max_streak,'thermal_shock':thermal,'data_gap':round(gap,2),'structural_tilt':latest_tilt}
    received_count=len(by_time)
    delivery_pct=round(100*received_count/expected,1) if expected else 0.0
    indicators={}
    for key,value in values.items():
        spec=th[key]; decreasing=key in ('battery_stress','thermal_shock')
        item={'value':value,'unit':spec['unit'],'status':level(value,spec['warning'],spec['critical'],decreasing), 'detail':'Scenario sintetico accelerato (10 secondi per campione)'}
        if key=='data_gap':
            item.update({'received':received_count,'expected':expected,'delivery_pct':delivery_pct})
        if key=='structural_tilt' and value is not None:
            item['vibration_rms_deg']=round(0.08+0.22*float(value),2)
        indicators[key]=item
    priority=['CRITICAL','WARNING','INSUFFICIENT','OK']
    overall=next((s for s in priority if any(x['status']==s for x in indicators.values())),'INSUFFICIENT')
    last_sample=samples[-1] if samples else None
    latest={
        'timestamp':last_sample['time'].isoformat(),
        'temperature_c':last_sample['temperature_c'],
        'battery_v':last_sample['battery_v'],
        'pressure_hpa':last_sample['pressure_hpa'],
        'humidity_pct':last_sample['humidity_pct'],
        'wind_speed_kt':last_sample['wind_speed_kt'],
        'wind_direction_deg':last_sample['wind_direction_deg'],
        'tilt_deg':last_sample['tilt_deg'],
    } if last_sample else None
    return {'station_code':code,'overall':overall,'indicators':indicators,'received_hours':received_count,'expected_slots':expected,'latest':latest,'reference_utc':current.isoformat(),'mode':'SIMULATED','series':points}

def snapshot(codes,step):
    cfg=load_config(); max_step=cfg['duration_seconds']//cfg['interval_seconds']
    if step<0 or step>max_step: raise ValueError('step fuori intervallo')
    current=parse_time(cfg['start_utc'])+timedelta(seconds=step*cfg['interval_seconds'])
    samples={code:[] for code in codes}
    with (DATA/cfg['csv']).open(encoding='utf-8-sig',newline='') as f:
        for r in csv.DictReader(f):
            code=r['station_code'].upper()
            if code not in samples: continue
            t=parse_time(r['timestamp'])
            if t>current: continue
            item={'time':t}
            for key in ('battery_v','temperature_c','wind_speed_kt','wind_direction_deg','humidity_pct','pressure_hpa','tilt_deg'):
                item[key]=float(r[key]) if r.get(key,'').strip() else None
            samples[code].append(item)
    return {'scenario':cfg['scenario'],'step':step,'total_steps':max_step,'interval_seconds':cfg['interval_seconds'],'elapsed_seconds':step*cfg['interval_seconds'],'reference_utc':current.isoformat(),'mode':'SIMULATED','thresholds':cfg['thresholds'],'notes':cfg['notes'],'stations':[calc_station(code,samples[code],current,cfg) for code in codes]}
