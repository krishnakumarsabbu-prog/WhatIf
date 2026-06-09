import { useFraudStore } from '@/store/fraudStore';
import { type WhatIfParams } from '@/types/fraud.types';
import { FRAUD_SCENARIOS } from '@/services/layerProcessors';

const MERCHANT_OPTS = ['Low', 'Medium', 'High', 'Critical'] as const;

function Slider({ label, paramKey, min, max, step, unit }: {
  label: string; paramKey: keyof WhatIfParams;
  min: number; max: number; step: number; unit?: string;
}) {
  const { whatIfParams, setWhatIfParam } = useFraudStore();
  const val = whatIfParams[paramKey] as number;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: 11, color: '#CBD5E1', fontWeight: 500 }}>{label}</label>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-primary)', fontWeight: 700 }}>
          {unit === '$' ? `$${val.toLocaleString()}` : `${typeof val === 'number' ? (max <= 1 ? val.toFixed(2) : val) : val}${unit && unit !== '$' ? ' ' + unit : ''}`}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={val}
        onChange={e => setWhatIfParam(paramKey, parseFloat(e.target.value) as WhatIfParams[keyof WhatIfParams])}
        style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer', height: 4 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--border-bright)', fontFamily: 'var(--font-mono)' }}>
        <span>{unit === '$' ? `$${min}` : min}</span>
        <span>{unit === '$' ? `$${max.toLocaleString()}` : max}</span>
      </div>
    </div>
  );
}

export function WhatIfControls({ onRun }: { onRun: () => void }) {
  const { whatIfParams, setWhatIfParam, runWhatIf } = useFraudStore();

  const handleRun = () => { runWhatIf(); onRun(); };

  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#E2E8F0', marginBottom: 2 }}>
            What-If Analysis — Adjust Parameters
          </h2>
          <p style={{ fontSize: 11, color: 'var(--status-neutral)' }}>
            Move sliders to simulate different scenarios. Results update through all 4 pipeline layers.
          </p>
        </div>
        <button onClick={handleRun} style={{
          padding: '10px 24px', borderRadius: 8, cursor: 'pointer',
          background: 'linear-gradient(90deg, #3B82F6 0%, #2563EB 100%)',
          border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
          fontFamily: 'var(--font-display)', letterSpacing: '0.04em',
          boxShadow: '0 0 16px rgba(59,130,246,0.4)',
        }}>
          Run What-If Analysis
        </button>
      </div>

      {/* Preset scenarios */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--border-bright)', marginBottom: 8 }}>
          Preset Scenarios
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FRAUD_SCENARIOS.map(sc => (
            <button
              key={sc.name}
              onClick={() => {
                const ov = sc.overrides;
                if (ov.amount != null)              setWhatIfParam('amount', ov.amount);
                if (ov.velocity != null)             setWhatIfParam('velocity', ov.velocity);
                if (ov.geo_risk_score != null)       setWhatIfParam('geo_risk_score', ov.geo_risk_score);
                if (ov.device_trust_score != null)   setWhatIfParam('device_trust_score', ov.device_trust_score);
                if (ov.time_anomaly_score != null)   setWhatIfParam('time_anomaly_score', ov.time_anomaly_score);
                if (ov.behavioral_deviation != null) setWhatIfParam('behavioral_deviation', ov.behavioral_deviation);
                if (ov.network_risk_score != null)   setWhatIfParam('network_risk_score', ov.network_risk_score);
                if (ov.merchant_category != null)    setWhatIfParam('merchant_risk_category', ov.merchant_category as WhatIfParams['merchant_risk_category']);
                handleRun();
              }}
              style={{
                padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                background: `${sc.color}15`, border: `1px solid ${sc.color}44`,
                color: sc.color, fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              {sc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
        <Slider label="Transaction Amount" paramKey="amount" min={1} max={50000} step={100} unit="$" />
        <Slider label="Velocity (txn/hr)" paramKey="velocity" min={1} max={50} step={1} unit="txn/hr" />
        <Slider label="Geographic Risk" paramKey="geo_risk_score" min={0} max={1} step={0.01} />
        <Slider label="Device Trust" paramKey="device_trust_score" min={0} max={1} step={0.01} />
        <Slider label="Time Anomaly" paramKey="time_anomaly_score" min={0} max={1} step={0.01} />
        <Slider label="Behavioral Deviation" paramKey="behavioral_deviation" min={0} max={1} step={0.01} />
        <Slider label="Network Risk" paramKey="network_risk_score" min={0} max={1} step={0.01} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#CBD5E1', fontWeight: 500 }}>Merchant Risk Category</label>
          <select
            value={whatIfParams.merchant_risk_category}
            onChange={e => setWhatIfParam('merchant_risk_category', e.target.value as WhatIfParams['merchant_risk_category'])}
            style={{
              padding: '8px 10px', borderRadius: 6, background: 'var(--bg-input)',
              border: '1px solid var(--border-default)', color: '#E2E8F0', fontSize: 12,
              fontFamily: 'var(--font-mono)', cursor: 'pointer', outline: 'none',
            }}
          >
            {MERCHANT_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
