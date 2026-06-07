import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { runReplay, fetchComplianceRisk } from '@/api/intelligence';
import { HarnessCard } from '@/design-system/components/HarnessCard';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import { Play, RotateCcw, Shield, TrendingUp, TrendingDown } from 'lucide-react';

const OVERRIDE_DEFS = [
  { key: 'rule_7_cmra_continue',  label: 'Rule 7: CMRA=Y → Route to PDMA',    risk: 'MEDIUM' },
  { key: 'rule_8_pbsa_continue',  label: 'Rule 8: PBSA=Y → Route to PDMA',    risk: 'MEDIUM' },
  { key: 'rule_9_pobox_continue', label: 'Rule 9: POBox=P → Route to PDMA',   risk: 'LOW' },
  { key: 'rule_6_fallthrough',    label: 'Rule 6: Comm Error → Fallthrough',   risk: 'LOW' },
  { key: 'rule_3_fallthrough',    label: 'Rule 3: KOEC0039+X → Fallthrough',   risk: 'HIGH' },
  { key: 'populate_result_relax', label: 'populateResult() Relaxation (#15)',  risk: 'MEDIUM' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} style={{
      width: 38, height: 20, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
      background: checked ? 'var(--accent-primary)' : 'var(--bg-elevated)',
      border: `1px solid ${checked ? 'var(--accent-primary)' : 'var(--border-default)'}`,
      position: 'relative', transition: 'all 0.2s',
    }}>
      <span style={{
        position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%', background: '#fff',
        left: checked ? 21 : 2, transition: 'left 0.2s',
      }} />
    </button>
  );
}

export function DecisionReplay() {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const replayMutation = useMutation({
    mutationFn: () => runReplay(overrides),
  });

  const { data: complianceRisk } = useQuery({
    queryKey: ['compliance-risk', overrides],
    queryFn: () => fetchComplianceRisk(overrides),
    enabled: Object.keys(overrides).some(k => overrides[k]),
  });

  const result = replayMutation.data;
  const activeCount = Object.values(overrides).filter(Boolean).length;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Play size={20} color="var(--accent-primary)" />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Decision Replay Studio
          </h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
          Replay 1,500 historical transactions under new rule configurations — see exact recovered / lost customers
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20 }}>
        {/* Config Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <HarnessCard title="Rule Override Configuration" glow="accent">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {OVERRIDE_DEFS.map(def => (
                <div key={def.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{def.label}</div>
                    <div style={{ fontSize: 10, color: def.risk === 'HIGH' ? 'var(--status-fail)' : def.risk === 'MEDIUM' ? 'var(--status-warn)' : 'var(--status-pass)', marginTop: 2 }}>
                      {def.risk} risk
                    </div>
                  </div>
                  <Toggle
                    checked={!!overrides[def.key]}
                    onChange={v => setOverrides(prev => ({ ...prev, [def.key]: v }))}
                  />
                </div>
              ))}
            </div>
          </HarnessCard>

          {/* Compliance Risk */}
          {complianceRisk && activeCount > 0 && (
            <HarnessCard title="Compliance Risk Assessment">
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{
                  fontSize: 48, fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: 1,
                  color: complianceRisk.category === 'LOW' ? 'var(--status-pass)' : complianceRisk.category === 'MEDIUM' ? 'var(--status-warn)' : 'var(--status-fail)',
                }}>
                  {complianceRisk.risk_score}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Risk Score / 100</div>
                <div style={{ marginTop: 8 }}>
                  <StatusBadge status={complianceRisk.category === 'LOW' ? 'pass' : complianceRisk.category === 'MEDIUM' ? 'warn' : 'fail'} label={`${complianceRisk.category} RISK`} />
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {complianceRisk.recommendation}
              </div>
            </HarnessCard>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => replayMutation.mutate()}
              disabled={replayMutation.isPending || activeCount === 0}
              style={{
                flex: 1, padding: '10px', borderRadius: 8, cursor: activeCount > 0 ? 'pointer' : 'not-allowed',
                background: activeCount > 0 ? 'linear-gradient(90deg, #00B4D8 0%, #0284C7 100%)' : 'var(--bg-elevated)',
                border: 'none', color: activeCount > 0 ? '#fff' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-display)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Play size={14} /> {replayMutation.isPending ? 'Replaying…' : 'Replay Transactions'}
            </button>
            <button onClick={() => { setOverrides({}); replayMutation.reset(); }} style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div>
          {!result && !replayMutation.isPending && (
            <div style={{ height: '100%', minHeight: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg-surface)', border: '1px dashed var(--border-subtle)', borderRadius: 12 }}>
              <Play size={40} color="var(--text-muted)" strokeWidth={1} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Toggle overrides and click Replay Transactions</p>
            </div>
          )}

          {replayMutation.isPending && (
            <div style={{ height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
              <div className="skeleton" style={{ width: 200, height: 40 }} />
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Replaying {(1500).toLocaleString()} transactions…</div>
            </div>
          )}

          {result && !replayMutation.isPending && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* KPI Banner */}
              <div style={{
                padding: '16px 20px',
                background: result.recovered > 0 ? 'rgba(74,222,128,0.08)' : 'rgba(100,116,139,0.06)',
                border: `1px solid ${result.recovered > 0 ? 'rgba(74,222,128,0.3)' : 'var(--border-subtle)'}`,
                borderRadius: 10,
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
              }}>
                {[
                  { label: 'Baseline Rate',    value: `${result.original_rate.toFixed(1)}%`, color: 'var(--text-secondary)' },
                  { label: 'Replayed Rate',    value: `${result.new_rate.toFixed(1)}%`,      color: result.recovered > 0 ? 'var(--status-pass)' : 'var(--text-secondary)' },
                  { label: 'Delta',            value: `${result.delta_pp > 0 ? '+' : ''}${result.delta_pp.toFixed(2)}pp`, color: result.delta_pp > 0 ? 'var(--status-pass)' : 'var(--status-fail)' },
                  { label: 'Recovered',        value: `+${result.recovered.toLocaleString()}`, color: 'var(--accent-primary)' },
                ].map(m => (
                  <div key={m.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Breakdown by rule */}
              {result.breakdown_by_rule.length > 0 && (
                <HarnessCard title="Recovered Transactions by Rule">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.breakdown_by_rule.map((b: any) => (
                      <div key={b.rule} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-base)', borderRadius: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <TrendingUp size={12} color="var(--status-pass)" />
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{b.rule} override active</span>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--status-pass)', fontWeight: 600 }}>
                          +{b.recovered.toLocaleString()} recovered
                        </span>
                      </div>
                    ))}
                  </div>
                </HarnessCard>
              )}

              {result.recovered === 0 && (
                <HarnessCard>
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>
                    No transactions recovered under current overrides. Try enabling different rules.
                  </div>
                </HarnessCard>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
