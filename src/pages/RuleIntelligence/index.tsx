import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  computeRuleStats,
  computeFeatureImportance,
  computeOutcomeFunnel,
  computeRuleTrend,
  type RuleStats,
} from '@/api/rules';
import { HarnessCard } from '@/design-system/components/HarnessCard';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, FunnelChart, Funnel, LabelList,
} from 'recharts';
import { ShieldAlert, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

const IMPACT_COLOR: Record<string, string> = {
  HIGH: '#F87171',
  MED:  '#FCD34D',
  LOW:  '#94A3B8',
};

function TrendIcon({ wow }: { wow: number }) {
  if (wow > 5) return <TrendingUp size={12} color="var(--status-fail)" />;
  if (wow < -5) return <TrendingDown size={12} color="var(--status-pass)" />;
  return <Minus size={12} color="var(--text-muted)" />;
}

export function RuleIntelligence() {
  const [selectedRule, setSelectedRule] = useState<string | null>(null);

  const { data: rules = [] } = useQuery({
    queryKey: ['rule-stats'],
    queryFn: computeRuleStats,
    staleTime: 30_000,
  });

  const { data: features = [] } = useQuery({
    queryKey: ['feature-importance'],
    queryFn: computeFeatureImportance,
    staleTime: Infinity,
  });

  const { data: funnel = [] } = useQuery({
    queryKey: ['outcome-funnel'],
    queryFn: computeOutcomeFunnel,
    staleTime: 30_000,
  });

  const { data: trend = [] } = useQuery({
    queryKey: ['rule-trend', selectedRule],
    queryFn: () => computeRuleTrend(selectedRule!),
    enabled: !!selectedRule,
    staleTime: 30_000,
  });

  const maxShap = features[0]?.shap ?? 1;
  const totalFired = rules.reduce((s, r) => s + r.count, 0);

  const funnelChartData = funnel.map(f => ({
    name: f.stage,
    value: f.count,
    fill: f.pass_rate > 85 ? '#4ADE80' : f.pass_rate > 60 ? '#FCD34D' : '#F87171',
  }));

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <ShieldAlert size={20} color="var(--accent-primary)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Rule Intelligence Dashboard
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
            Rule firing frequency · SHAP feature importance · Outcome funnel · Week-over-week trend
          </p>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-primary)', background: 'rgba(0,180,216,0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(0,180,216,0.2)', display: 'flex', alignItems: 'center' }}>
          SHAP Approximation · WoW Trend
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
        {/* Rule table */}
        <HarnessCard title="Rule Firing Analysis" subtitle={`${totalFired.toLocaleString()} total firings across all rules`}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-subtle)' }}>
                  {['Rule', 'Firings', '% of All', '% Declined', 'Outcome', 'Impact', 'WoW', 'Hard Stop'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Rule' ? 'left' : 'right', color: 'var(--text-muted)', fontWeight: 500, fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map((r: RuleStats, i) => (
                  <tr
                    key={r.rule}
                    onClick={() => setSelectedRule(prev => prev === r.rule ? null : r.rule)}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      background: selectedRule === r.rule ? 'rgba(0,180,216,0.06)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <td style={{ padding: '10px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600 }}>{r.rule}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {r.label.replace(r.rule + ' — ', '')}
                      </div>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {r.count.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {r.pct_of_all}%
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: r.pct_of_declined > 30 ? 'var(--status-fail)' : 'var(--text-secondary)' }}>
                      {r.pct_of_declined}%
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <StatusBadge status={r.outcome === '100% FAIL' ? 'fail' : 'warn'} label={r.outcome} />
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: IMPACT_COLOR[r.impact] }}>{r.impact}</span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: r.trend_wow > 5 ? 'var(--status-fail)' : r.trend_wow < -5 ? 'var(--status-pass)' : 'var(--text-muted)' }}>
                        <TrendIcon wow={r.trend_wow} />
                        {r.trend_wow > 0 ? '+' : ''}{r.trend_wow}%
                      </div>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      {r.hard_stop
                        ? <StatusBadge status="fail" label="STOP" />
                        : <StatusBadge status="neutral" label="SOFT" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rule trend inline */}
          {selectedRule && trend.length > 0 && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Daily firing trend — {selectedRule}
              </div>
              <div style={{ height: '100px' }}>
                <ResponsiveContainer>
                  <LineChart data={trend} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 8 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fill: '#475569', fontSize: 8 }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
                      formatter={(v: number) => [v, 'Firings']}
                    />
                    <Line type="monotone" dataKey="count" stroke="var(--accent-primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </HarnessCard>

        {/* Side panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* SHAP waterfall */}
          <HarnessCard title="SHAP Feature Importance" subtitle="P(verified|feat=1) − P(verified|feat=0)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {features.map(f => (
                <div key={f.feature}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{f.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {f.direction === 'negative'
                        ? <TrendingDown size={10} color="var(--status-fail)" />
                        : <TrendingUp size={10} color="var(--status-pass)" />}
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: f.direction === 'negative' ? 'var(--status-fail)' : 'var(--status-pass)' }}>
                        {f.shap.toFixed(4)}
                      </span>
                    </div>
                  </div>
                  <div style={{ height: '5px', background: 'var(--bg-base)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(f.shap / maxShap) * 100}%`,
                      background: f.direction === 'negative' ? 'var(--status-fail)' : 'var(--status-pass)',
                      borderRadius: '3px',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </HarnessCard>

          {/* Outcome Funnel */}
          <HarnessCard title="Outcome Funnel" subtitle="Cumulative pass-through rate">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {funnel.map((step, i) => (
                <div key={step.stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{step.stage}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {step.dropped > 0 && (
                        <span style={{ fontSize: '10px', color: 'var(--status-fail)', fontFamily: 'var(--font-mono)' }}>
                          -{step.dropped.toLocaleString()}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: step.pass_rate > 85 ? 'var(--status-pass)' : step.pass_rate > 60 ? '#FCD34D' : 'var(--status-fail)' }}>
                        {step.pass_rate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-base)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${step.pass_rate}%`,
                      background: step.pass_rate > 85
                        ? 'linear-gradient(90deg, #4ADE80, #22D3EE)'
                        : step.pass_rate > 60
                        ? 'linear-gradient(90deg, #FCD34D, #F59E0B)'
                        : 'linear-gradient(90deg, #F87171, #EF4444)',
                      borderRadius: '4px',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </HarnessCard>
        </div>
      </div>
    </div>
  );
}
