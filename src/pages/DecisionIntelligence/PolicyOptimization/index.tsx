import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchRuleImpact, fetchRecommendations, fetchComplianceRisk } from '@/api/intelligence';
import { runSimulation } from '@/api/simulation';
import { HarnessCard } from '@/design-system/components/HarnessCard';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import { DollarSign, TrendingUp, Shield, Play, RotateCcw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const RULE_OVERRIDES = [
  { key: 'rule_7_cmra_continue',  label: 'Rule 7: CMRA → PDMA',  rule: 'Rule 7' },
  { key: 'rule_8_pbsa_continue',  label: 'Rule 8: PBSA → PDMA',  rule: 'Rule 8' },
  { key: 'rule_9_pobox_continue', label: 'Rule 9: POBox → PDMA', rule: 'Rule 9' },
  { key: 'rule_6_fallthrough',    label: 'Rule 6: Comm Bypass',   rule: 'Rule 6' },
  { key: 'rule_3_fallthrough',    label: 'Rule 3: Fault Bypass',  rule: 'Rule 3' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} style={{
      width: 38, height: 20, borderRadius: 10, cursor: 'pointer', flexShrink: 0,
      background: checked ? 'var(--accent-primary)' : 'var(--bg-elevated)',
      border: `1px solid ${checked ? 'var(--accent-primary)' : 'var(--border-default)'}`,
      position: 'relative', transition: 'all 0.2s',
    }}>
      <span style={{ position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', left: checked ? 21 : 2, transition: 'left 0.2s' }} />
    </button>
  );
}

export function PolicyOptimization() {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const { data: impacts = [] } = useQuery({ queryKey: ['rule-impact'], queryFn: fetchRuleImpact, staleTime: 60_000 });
  const { data: recs = [] } = useQuery({ queryKey: ['recommendations'], queryFn: fetchRecommendations, staleTime: 60_000 });

  const simMutation = useMutation({
    mutationFn: () => runSimulation(overrides),
  });

  const { data: complianceRisk } = useQuery({
    queryKey: ['compliance-risk-policy', overrides],
    queryFn: () => fetchComplianceRisk(overrides),
    enabled: Object.values(overrides).some(Boolean),
  });

  const simResult = simMutation.data;
  const activeCount = Object.values(overrides).filter(Boolean).length;

  // Revenue opportunity chart data
  const revenueData = impacts.filter(r => r.is_hard_stop).map(r => ({
    name: r.rule,
    current_loss: r.revenue_impact_k,
    recoverable: parseFloat((r.counterfactual_gain * 0.24).toFixed(1)),
  }));

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <TrendingUp size={20} color="var(--accent-primary)" />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Policy Optimization Engine
          </h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
          Multi-objective optimization: maximize approval rate + revenue while minimizing compliance risk
        </p>
      </div>

      {/* Revenue opportunity chart */}
      {revenueData.length > 0 && (
        <HarnessCard title="Revenue Opportunity by Rule" subtitle="Current loss vs. recoverable ARR if rule relaxed">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData} margin={{ top: 8, right: 20, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} tickFormatter={v => `$${v}K`} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }} formatter={(v: number, name: string) => [`$${v}K`, name === 'current_loss' ? 'Current Loss' : 'Recoverable ARR']} />
              <Bar dataKey="current_loss" fill="rgba(248,113,113,0.6)" name="current_loss" radius={[3,3,0,0]} />
              <Bar dataKey="recoverable" fill="rgba(74,222,128,0.6)" name="recoverable" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </HarnessCard>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20 }}>
        {/* Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <HarnessCard title="Optimization Variables" subtitle="Select rules to relax" glow="accent">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {RULE_OVERRIDES.map(def => {
                const impact = impacts.find(r => r.rule === def.rule);
                return (
                  <div key={def.key} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{def.label}</div>
                        {impact && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                            {impact.affected_count} affected · ${impact.revenue_impact_k}K loss
                          </div>
                        )}
                      </div>
                      <Toggle checked={!!overrides[def.key]} onChange={v => setOverrides(prev => ({ ...prev, [def.key]: v }))} />
                    </div>
                  </div>
                );
              })}
            </div>
          </HarnessCard>

          {complianceRisk && activeCount > 0 && (
            <HarnessCard title="Compliance Risk">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  border: `4px solid ${complianceRisk.category === 'LOW' ? 'var(--status-pass)' : complianceRisk.category === 'MEDIUM' ? 'var(--status-warn)' : 'var(--status-fail)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-display)', color: complianceRisk.category === 'LOW' ? 'var(--status-pass)' : complianceRisk.category === 'MEDIUM' ? 'var(--status-warn)' : 'var(--status-fail)' }}>
                    {complianceRisk.risk_score}
                  </span>
                </div>
                <div>
                  <StatusBadge status={complianceRisk.category === 'LOW' ? 'pass' : complianceRisk.category === 'MEDIUM' ? 'warn' : 'fail'} label={`${complianceRisk.category} RISK`} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>{complianceRisk.recommendation}</div>
                </div>
              </div>
            </HarnessCard>
          )}

          <button
            onClick={() => simMutation.mutate()}
            disabled={simMutation.isPending || activeCount === 0}
            style={{
              padding: '10px', borderRadius: 8, cursor: activeCount > 0 ? 'pointer' : 'not-allowed',
              background: activeCount > 0 ? 'linear-gradient(90deg, #00B4D8 0%, #0284C7 100%)' : 'var(--bg-elevated)',
              border: 'none', color: activeCount > 0 ? '#fff' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-display)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Play size={14} /> {simMutation.isPending ? 'Simulating…' : 'Run Optimization Sim'}
          </button>
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {simResult && !simMutation.isPending && (
            <>
              <HarnessCard title="Optimization Results" glow={simResult.delta > 0 ? 'pass' : 'none'}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Approval Gain', value: `${simResult.delta > 0 ? '+' : ''}${simResult.delta.toFixed(2)}pp`, color: simResult.delta > 0 ? 'var(--status-pass)' : 'var(--status-fail)' },
                    { label: 'New Rate', value: `${simResult.simulated_pass_rate.toFixed(1)}%`, color: 'var(--accent-primary)' },
                    { label: 'Revenue Gain Est.', value: `+$${(simResult.delta_absolute * 0.24).toFixed(0)}K`, color: 'var(--status-pass)' },
                  ].map(m => (
                    <div key={m.label} style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-base)', borderRadius: 8 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>{m.label}</div>
                      <div style={{ fontSize: 24, fontFamily: 'var(--font-display)', fontWeight: 800, color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>95% Bootstrap CI</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-primary)' }}>
                    [{simResult.ci_95_low > 0 ? '+' : ''}{simResult.ci_95_low.toFixed(1)}%, {simResult.ci_95_high > 0 ? '+' : ''}{simResult.ci_95_high.toFixed(1)}%]
                  </span>
                </div>
              </HarnessCard>
            </>
          )}

          {/* Pareto-optimal recommendations */}
          <HarnessCard title="Pareto-Optimal Recommendations" subtitle="Best approval gain per compliance risk unit">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recs.filter(r => r.type !== 'BUNDLE').slice(0, 4).map(rec => {
                const efficiency = rec.approval_gain_pp / Math.max(rec.risk_level === 'HIGH' ? 3 : rec.risk_level === 'MEDIUM' ? 2 : 1, 1);
                return (
                  <div key={rec.id} style={{ display: 'flex', gap: 12, padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 3 }}>{rec.title}</div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ fontSize: 10, color: 'var(--status-pass)' }}><TrendingUp size={9} style={{ display: 'inline' }} /> +{rec.approval_gain_pp.toFixed(2)}pp</span>
                        <span style={{ fontSize: 10, color: 'var(--accent-primary)' }}><DollarSign size={9} style={{ display: 'inline' }} /> ${rec.revenue_gain_k}K</span>
                        <StatusBadge status={rec.risk_level === 'LOW' ? 'pass' : rec.risk_level === 'MEDIUM' ? 'warn' : 'fail'} label={rec.risk_level} size="sm" />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>Efficiency</div>
                      <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 700 }}>{efficiency.toFixed(2)}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>pp/risk unit</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </HarnessCard>

          {!simResult && !simMutation.isPending && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '40px', background: 'var(--bg-surface)', border: '1px dashed var(--border-subtle)', borderRadius: 10 }}>
              <TrendingUp size={36} color="var(--text-muted)" strokeWidth={1} />
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0, textAlign: 'center' }}>Select optimization variables and run simulation to see projected gains</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
