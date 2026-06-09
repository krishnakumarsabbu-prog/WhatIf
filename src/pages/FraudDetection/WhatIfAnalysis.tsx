import { useState, useEffect, useRef } from 'react';
import { useFraudStore } from '@/store/fraudStore';
import { WhatIfControls } from './components/WhatIfControls';
import { Layer1RulesEngine } from './components/Layer1RulesEngine';
import { Layer2FeatureEngineering } from './components/Layer2FeatureEngineering';
import { Layer3MLAlgorithms } from './components/Layer3MLAlgorithms';
import { Layer4Explainability } from './components/Layer4Explainability';
import { HarnessCard } from '@/design-system/components';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, ReferenceLine,
} from 'recharts';
import { type AlertLevel } from '@/types/fraud.types';

const ALERT_COLORS: Record<AlertLevel, string> = {
  CRITICAL: '#EF4444', HIGH: '#F97316', MEDIUM: '#FBBF24', LOW: '#4ADE80',
};

const LAYER_COLORS = ['#8B5CF6', '#3B82F6', '#F97316', '#EC4899'];
const LAYER_LABELS = ['Rules Engine', 'Feature Engineering', 'ML Algorithms', 'Explainability'];

function SectionHeader({ num, label }: { num: number; label: string }) {
  const color = LAYER_COLORS[num - 1];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}22`, border: `1px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, color, flexShrink: 0 }}>{num}</div>
      <div>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color, fontWeight: 700, letterSpacing: '0.06em' }}>LAYER {num} · </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>{label} — What-If Results</span>
      </div>
    </div>
  );
}

export function WhatIfAnalysis() {
  const { whatIfResult, runWhatIf } = useFraudStore();
  const [ranOnce, setRanOnce] = useState(false);
  const runOnce = useRef(false);

  useEffect(() => {
    if (!runOnce.current) {
      runOnce.current = true;
      runWhatIf();
      setRanOnce(true);
    }
  }, [runWhatIf]);

  const handleRun = () => { setRanOnce(true); };

  const b = whatIfResult?.baseline;
  const s = whatIfResult?.scenario;

  // Layer 2 comparison data
  const featureCompData = b && s ? b.layer2.features.map((f, i) => ({
    name: f.display_label,
    baseline: parseFloat(f.normalized_value.toFixed(3)),
    scenario: parseFloat(s.layer2.features[i].normalized_value.toFixed(3)),
    delta: parseFloat((s.layer2.features[i].normalized_value - f.normalized_value).toFixed(3)),
  })) : [];

  // Layer 1 rule changes
  const ruleChanges = b && s ? b.layer1.rules.filter((rule, i) => rule.status !== s.layer1.rules[i]?.status) : [];

  // Alert level changed
  const alertChanged = b && s && b.layer4.alert_level !== s.layer4.alert_level;
  const probDelta = s && b ? ((s.layer3.final_fraud_probability - b.layer3.final_fraud_probability) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fade-in 0.4s ease' }}>

      {/* Controls at the top */}
      <WhatIfControls onRun={handleRun} />

      {!whatIfResult && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--status-neutral)', fontSize: 13, border: '1px dashed var(--border-subtle)', borderRadius: 10 }}>
          Click <strong style={{ color: '#3B82F6' }}>Run What-If Analysis</strong> to compare scenario vs baseline across all 4 pipeline layers.
        </div>
      )}

      {whatIfResult && b && s && (
        <>
          {/* Comparison summary banner */}
          <div style={{
            display: 'flex', gap: 16, padding: '14px 20px', borderRadius: 10,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          }}>
            {[
              { label: 'Baseline Fraud Probability', value: `${(b.layer3.final_fraud_probability * 100).toFixed(1)}%`, color: '#94A3B8' },
              { label: 'Scenario Fraud Probability', value: `${(s.layer3.final_fraud_probability * 100).toFixed(1)}%`, color: s.layer3.final_fraud_probability > b.layer3.final_fraud_probability ? '#EF4444' : '#4ADE80' },
              { label: 'Delta', value: `${probDelta > 0 ? '+' : ''}${probDelta.toFixed(1)}pp`, color: probDelta > 0 ? '#EF4444' : '#4ADE80' },
              { label: 'Rules Changed', value: `${ruleChanges.length}`, color: ruleChanges.length > 0 ? '#FBBF24' : '#4ADE80' },
            ].map(item => (
              <div key={item.label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>{item.label}</div>
              </div>
            ))}
            {alertChanged && (
              <div style={{ flex: 1, textAlign: 'center', padding: '6px 12px', borderRadius: 8, background: `${ALERT_COLORS[s.layer4.alert_level]}12`, border: `1px solid ${ALERT_COLORS[s.layer4.alert_level]}33` }}>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Alert level changed</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: ALERT_COLORS[b.layer4.alert_level], fontFamily: 'var(--font-mono)' }}>{b.layer4.alert_level}</span>
                  <span style={{ color: 'var(--border-bright)' }}>→</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: ALERT_COLORS[s.layer4.alert_level], fontFamily: 'var(--font-mono)' }}>{s.layer4.alert_level}</span>
                </div>
              </div>
            )}
          </div>

          {/* Layer 1 What-If */}
          <HarnessCard style={{ borderLeft: `3px solid ${LAYER_COLORS[0]}` }}>
            <SectionHeader num={1} label={LAYER_LABELS[0]} />
            {ruleChanges.length > 0 && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
                <span style={{ fontSize: 11, color: '#FBBF24' }}>⚠ {ruleChanges.length} rule{ruleChanges.length > 1 ? 's' : ''} changed from baseline: {ruleChanges.map(r => r.rule_name).join(', ')}</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 8 }}>Baseline</div>
                <Layer1RulesEngine data={b.layer1} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#3B82F6', marginBottom: 8 }}>Scenario</div>
                <Layer1RulesEngine data={s.layer1} />
              </div>
            </div>
          </HarnessCard>

          {/* Layer 2 What-If */}
          <HarnessCard style={{ borderLeft: `3px solid ${LAYER_COLORS[1]}` }}>
            <SectionHeader num={2} label={LAYER_LABELS[1]} />
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--border-bright)', marginBottom: 8 }}>
                Feature Delta — Baseline vs Scenario
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={featureCompData} margin={{ top: 4, right: 8, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }} angle={-30} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 9, fill: 'var(--status-neutral)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                  <Bar dataKey="baseline" fill="#94A3B8" radius={[2, 2, 0, 0]} name="Baseline" />
                  <Bar dataKey="scenario" fill="#3B82F6" radius={[2, 2, 0, 0]} name="Scenario" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </HarnessCard>

          {/* Layer 3 What-If */}
          <HarnessCard style={{ borderLeft: `3px solid ${LAYER_COLORS[2]}` }}>
            <SectionHeader num={3} label={LAYER_LABELS[2]} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'var(--font-mono)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Baseline Models</div>
                {b.layer3.models.map((m, i) => (
                  <div key={m.model_name} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#CBD5E1' }}>{m.model_name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#94A3B8' }}>{(m.fraud_probability * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                      <div style={{ width: `${m.fraud_probability * 100}%`, height: '100%', background: '#94A3B8', borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#3B82F6', fontFamily: 'var(--font-mono)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Scenario Models</div>
                {s.layer3.models.map((m, i) => {
                  const delta = m.fraud_probability - b.layer3.models[i].fraud_probability;
                  return (
                    <div key={m.model_name} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: '#CBD5E1' }}>{m.model_name}</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {Math.abs(delta) > 0.001 && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: delta > 0 ? '#F87171' : '#4ADE80' }}>
                              {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}pp
                            </span>
                          )}
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#3B82F6' }}>{(m.fraud_probability * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                        <div style={{ width: `${m.fraud_probability * 100}%`, height: '100%', background: m.fraud_probability > b.layer3.models[i].fraud_probability ? '#EF4444' : '#4ADE80', borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </HarnessCard>

          {/* Layer 4 What-If */}
          <HarnessCard style={{ borderLeft: `3px solid ${LAYER_COLORS[3]}` }}>
            <SectionHeader num={4} label={LAYER_LABELS[3]} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'var(--font-mono)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Baseline</div>
                <Layer4Explainability data={b.layer4} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#EC4899', fontFamily: 'var(--font-mono)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Scenario</div>
                <Layer4Explainability data={s.layer4} />
              </div>
            </div>
          </HarnessCard>
        </>
      )}
    </div>
  );
}
