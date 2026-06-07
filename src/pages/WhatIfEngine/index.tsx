import { useEffect, useState } from 'react';
import { useSimulationStore } from '@/store/useSimulationStore';
import { runSensitivitySweep, getScenarioCards, type RuleOverrides, DEFAULT_OVERRIDES } from '@/api/simulation';
import { HarnessCard, AlgorithmBadge, StatusBadge } from '@/design-system/components';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine,
} from 'recharts';
import { Play, RotateCcw, Save, TrendingUp, TrendingDown } from 'lucide-react';

// ── Toggle component ─────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: checked ? 'var(--accent-primary)' : 'var(--bg-elevated)',
        border: `1px solid ${checked ? 'var(--accent-primary)' : 'var(--border-default)'}`,
        cursor: 'pointer', position: 'relative', transition: 'all 0.2s', flexShrink: 0,
        boxShadow: checked ? 'var(--glow-accent)' : 'none',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, width: 14, height: 14,
        borderRadius: '50%', background: '#fff',
        left: checked ? 22 : 3, transition: 'left 0.2s',
      }} />
    </button>
  );
}

// ── Severity select ──────────────────────────────────────────────────────
function SeveritySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
        borderRadius: 4, color: '#CBD5E1', fontSize: 11, padding: '2px 6px',
        fontFamily: 'var(--font-mono)', cursor: 'pointer',
      }}
    >
      <option value="PASS">PASS</option>
      <option value="WARN">WARN</option>
      <option value="STOP">STOP</option>
    </select>
  );
}

// ── Override row ─────────────────────────────────────────────────────────
function OverrideRow({ label, subLabel, ruleKey, scenarios }: {
  label: string; subLabel?: string; ruleKey: keyof RuleOverrides;
  scenarios?: { delta: number }[];
}) {
  const { overrides, setOverride } = useSimulationStore();
  const value = overrides[ruleKey] ?? DEFAULT_OVERRIDES[ruleKey as keyof typeof DEFAULT_OVERRIDES];
  const checked = typeof value === 'boolean' ? value : false;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0', borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div>
        <div style={{ fontSize: 12, color: '#CBD5E1' }}>{label}</div>
        {subLabel && <div style={{ fontSize: 10, color: 'var(--status-neutral)', marginTop: 1 }}>{subLabel}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {checked && scenarios && scenarios[0]?.delta > 0 && (
          <span style={{ fontSize: 11, color: 'var(--status-pass)', fontFamily: 'var(--font-mono)' }}>
            +{scenarios[0].delta.toFixed(1)}%
          </span>
        )}
        <Toggle checked={checked} onChange={v => setOverride(ruleKey, v)} />
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────
export function WhatIfEngine() {
  const { overrides, result, running, runSim, resetOverrides, saveScenario, setOverride } = useSimulationStore();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [sensitivityData, setSensitivityData] = useState<ReturnType<typeof runSensitivitySweep>>([]);
  const [presets, setPresets] = useState<ReturnType<typeof getScenarioCards>>([]);

  useEffect(() => {
    // Pre-compute presets and sensitivity on mount (deferred)
    const t = setTimeout(() => {
      setSensitivityData(runSensitivitySweep());
      setPresets(getScenarioCards());
    }, 200);
    return () => clearTimeout(t);
  }, []);

  const merged = { ...DEFAULT_OVERRIDES, ...overrides };

  const deltaColor = (d: number) => d > 0 ? 'var(--status-pass)' : d < 0 ? 'var(--status-fail)' : 'var(--status-neutral)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fade-in 0.4s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#E2E8F0', marginBottom: 4 }}>
            What-If Simulation Engine
          </h1>
          <p style={{ fontSize: 12, color: 'var(--status-neutral)' }}>
            Toggle rule overrides and simulate their impact on onboarding rates — Monte Carlo + Counterfactual Resampling
          </p>
        </div>
        <AlgorithmBadge name="Monte Carlo + Counterfactual Resampling" category="Simulation" />
      </div>

      {/* Preset Scenario Cards */}
      {presets.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--border-bright)', marginBottom: 8 }}>
            Quick-Apply Scenarios
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {presets.slice(0, 4).map(sc => (
              <button
                key={sc.id}
                onClick={() => {
                  resetOverrides();
                  Object.entries(sc.overrides).forEach(([k, v]) => setOverride(k as keyof RuleOverrides, v as boolean));
                  setTimeout(runSim, 80);
                }}
                style={{
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 11, color: '#CBD5E1', marginBottom: 4, lineHeight: 1.4 }}>{sc.label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: 10, padding: '1px 5px', borderRadius: 2,
                    background: sc.impact === 'HIGH' ? 'rgba(74,222,128,0.12)' : sc.impact === 'MEDIUM' ? 'rgba(251,191,36,0.10)' : 'rgba(148,163,184,0.08)',
                    color: sc.impact === 'HIGH' ? 'var(--status-pass)' : sc.impact === 'MEDIUM' ? 'var(--status-warn)' : 'var(--status-neutral)',
                    fontFamily: 'var(--font-mono)',
                  }}>{sc.impact}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: sc.result.delta > 0 ? 'var(--status-pass)' : 'var(--status-neutral)' }}>
                    {sc.result.delta > 0 ? '+' : ''}{sc.result.delta.toFixed(1)}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>

        {/* Left: Override panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <HarnessCard title="GSA Hard-Stop Overrides" glow="accent">
            <div style={{ fontSize: 10, color: 'var(--status-warn)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
              ⚠ Requires populateResult relaxation (#15) to take effect
            </div>
            <OverrideRow label="Rule 7: CMRA=Y → continue to PDMA"    subLabel="PR/territory addresses" ruleKey="rule_7_cmra_continue" />
            <OverrideRow label="Rule 8: PBSA=Y → continue to PDMA"    subLabel="PO Box/special addresses" ruleKey="rule_8_pbsa_continue" />
            <OverrideRow label="Rule 9: POBox=P → continue to PDMA"   subLabel="PO Box type addresses" ruleKey="rule_9_pobox_continue" />
            <OverrideRow label="Rule 6: Comm Error → fallthrough"      subLabel="GSA outage resilience" ruleKey="rule_6_fallthrough" />
            <OverrideRow label="Rule 3: KOEC0039+X → fallthrough"      subLabel="Group 1 DB unavailable" ruleKey="rule_3_fallthrough" />
          </HarnessCard>

          <HarnessCard title="Post-Processing Overrides" glow="accent">
            <OverrideRow
              label="populateResult() relaxation (#15)"
              subLabel="NO_RESULT + PDMA compliant = COMPLIANT"
              ruleKey="populate_result_relax"
            />
          </HarnessCard>

          <HarnessCard title="KOEC0039 Sub-Code Severity">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(['A','B','H','M','S','Z'] as const).map(code => (
                <div key={code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#CBD5E1' }}>
                    genRetCode <span style={{ color: 'var(--accent-primary)' }}>{code}</span>
                  </span>
                  <SeveritySelect
                    value={(overrides[`koec0039_${code}_severity` as keyof RuleOverrides] ?? DEFAULT_OVERRIDES[`koec0039_${code}_severity` as keyof typeof DEFAULT_OVERRIDES]) as string}
                    onChange={v => setOverride(`koec0039_${code}_severity` as keyof RuleOverrides, v)}
                  />
                </div>
              ))}
            </div>
          </HarnessCard>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={runSim}
              disabled={running}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                background: 'linear-gradient(90deg, #00B4D8 0%, #0284C7 100%)',
                border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
                fontFamily: 'var(--font-display)', letterSpacing: '0.04em',
                boxShadow: running ? 'none' : 'var(--glow-accent)',
                opacity: running ? 0.7 : 1,
              }}
            >
              <Play size={14} /> {running ? 'Computing…' : 'Run Simulation'}
            </button>
            <button
              onClick={resetOverrides}
              style={{
                padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--status-neutral)',
              }}
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Right: Results panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!result && !running && (
            <HarnessCard>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 12, textAlign: 'center' }}>
                <TrendingUp size={36} color="var(--border-bright)" />
                <p style={{ color: 'var(--status-neutral)', fontSize: 13 }}>
                  Configure rule overrides on the left and click <strong style={{ color: '#CBD5E1' }}>Run Simulation</strong> to see the estimated onboarding impact.
                </p>
              </div>
            </HarnessCard>
          )}

          {running && (
            <HarnessCard>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: 16 }}>
                <div className="skeleton" style={{ width: 200, height: 40 }} />
                <div className="skeleton" style={{ width: '100%', height: 80 }} />
                <div style={{ fontSize: 12, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>
                  Running Monte Carlo simulation × 500 bootstrap iterations…
                </div>
              </div>
            </HarnessCard>
          )}

          {result && !running && (
            <>
              {/* Rate comparison */}
              <HarnessCard title="Simulation Results" glow={result.delta > 0 ? 'pass' : result.delta < 0 ? 'fail' : 'none'}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                  {[
                    { label: 'Baseline Rate', value: result.baseline_pass_rate, color: 'var(--status-neutral)', suffix: '%' },
                    { label: 'Simulated Rate', value: result.simulated_pass_rate, color: result.delta > 0 ? 'var(--status-pass)' : 'var(--status-fail)', suffix: '%' },
                    { label: 'Delta', value: result.delta, color: deltaColor(result.delta), prefix: result.delta > 0 ? '+' : '', suffix: '%' },
                  ].map(kpi => (
                    <div key={kpi.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--status-neutral)', marginBottom: 4 }}>{kpi.label}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>
                        {kpi.prefix ?? ''}{kpi.value.toFixed(1)}{kpi.suffix}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CI band */}
                <div style={{
                  padding: '10px 14px', borderRadius: 6,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 16,
                }}>
                  <span style={{ fontSize: 11, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>
                    95% Bootstrap CI
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent-primary)' }}>
                    [{result.ci_95_low > 0 ? '+' : ''}{result.ci_95_low.toFixed(1)}%, {result.ci_95_high > 0 ? '+' : ''}{result.ci_95_high.toFixed(1)}%]
                  </span>
                </div>

                {/* Affected breakdown */}
                {result.affected_count > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--border-bright)', marginBottom: 8 }}>
                      Recovered Transactions: {result.delta_absolute.toLocaleString()}
                    </div>
                    {result.breakdown.map((b, i) => (
                      <div key={b.rule} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: 11, color: '#CBD5E1' }}>
                          {i === result.breakdown.length - 1 ? '└──' : '├──'} {b.rule}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--status-pass)' }}>
                          +{b.count.toLocaleString()} tx
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {result.affected_count === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--status-neutral)', textAlign: 'center', padding: '12px 0' }}>
                    No transactions affected by current overrides. Try enabling rules on the left.
                  </div>
                )}
              </HarnessCard>

              {/* Save button */}
              <div style={{ display: 'flex', gap: 8 }}>
                {!saveDialogOpen ? (
                  <button
                    onClick={() => setSaveDialogOpen(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                      color: 'var(--status-neutral)', fontSize: 12,
                    }}
                  >
                    <Save size={13} /> Save Scenario
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                    <input
                      autoFocus
                      value={scenarioName}
                      onChange={e => setScenarioName(e.target.value)}
                      placeholder="Scenario name…"
                      style={{
                        flex: 1, padding: '6px 10px', borderRadius: 6,
                        background: 'var(--bg-input)', border: '1px solid var(--border-accent)',
                        color: '#E2E8F0', fontSize: 12, fontFamily: 'var(--font-mono)',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => { saveScenario(scenarioName || 'Untitled Scenario'); setSaveDialogOpen(false); setScenarioName(''); }}
                      style={{ padding: '6px 14px', borderRadius: 6, cursor: 'pointer', background: 'var(--accent-strong)', border: 'none', color: '#fff', fontSize: 12 }}
                    >Save</button>
                    <button onClick={() => setSaveDialogOpen(false)} style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--status-neutral)', fontSize: 12 }}>×</button>
                  </div>
                )}
                <span style={{ fontSize: 11, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {result.runtime_ms}ms · 500 bootstrap iterations
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sensitivity curve */}
      {sensitivityData.length > 0 && (
        <HarnessCard title="Sensitivity Analysis — Rule Override Combinations" subtitle="Pass rate for each combination of active overrides">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={sensitivityData} margin={{ top: 8, right: 20, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                formatter={(v: number) => [`${v.toFixed(1)}%`, 'Verified Rate']}
              />
              <ReferenceLine y={sensitivityData[0]?.pass_rate} stroke="var(--status-warn)" strokeDasharray="4 4" strokeWidth={1} />
              <Line
                type="monotone" dataKey="pass_rate" stroke="var(--accent-primary)" strokeWidth={2.5}
                dot={{ fill: 'var(--accent-primary)', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: 'var(--accent-primary)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </HarnessCard>
      )}
    </div>
  );
}
