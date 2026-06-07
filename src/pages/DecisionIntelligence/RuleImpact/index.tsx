import { useQuery } from '@tanstack/react-query';
import { fetchRuleImpact, fetchRevenueLoss } from '@/api/intelligence';
import { HarnessCard } from '@/design-system/components/HarnessCard';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import { Shield, DollarSign, TrendingDown, TrendingUp, TriangleAlert as AlertTriangle } from 'lucide-react';

export function RuleImpactAnalysis() {
  const { data: impacts = [] } = useQuery({ queryKey: ['rule-impact'], queryFn: fetchRuleImpact, staleTime: 60_000 });
  const { data: revenue } = useQuery({ queryKey: ['revenue-loss'], queryFn: fetchRevenueLoss, staleTime: 60_000 });

  const maxImpact = impacts[0]?.impact_score ?? 1;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Shield size={20} color="var(--accent-primary)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Rule Impact Analysis
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Weighted impact score = population% × approval loss% × business weight · Revenue impact in $K/year
          </p>
        </div>
        {revenue && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Total Annual Revenue Loss</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--status-warn)' }}>
              ${revenue.total_revenue_loss_k}K
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{revenue.total_declined?.toLocaleString()} declined · ${240}/yr basis</div>
          </div>
        )}
      </div>

      {/* Summary KPIs */}
      {impacts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Top Harmful Rule',     value: impacts[0]?.rule,             sub: `Impact ${impacts[0]?.impact_score.toFixed(2)}`,          color: 'var(--status-fail)' },
            { label: 'Highest Rev. Loss',    value: impacts.sort((a,b)=>b.revenue_impact_k-a.revenue_impact_k)[0]?.rule, sub: `$${impacts[0]?.revenue_impact_k}K/yr`, color: 'var(--status-warn)' },
            { label: 'Most Volatile (WoW)',  value: [...impacts].sort((a,b)=>Math.abs(b.trend_wow)-Math.abs(a.trend_wow))[0]?.rule, sub: `${[...impacts].sort((a,b)=>Math.abs(b.trend_wow)-Math.abs(a.trend_wow))[0]?.trend_wow}% WoW`, color: 'var(--accent-primary)' },
            { label: 'Recoverable Customers', value: impacts.filter(r=>r.is_hard_stop).reduce((s,r)=>s+r.counterfactual_gain,0).toLocaleString(), sub: 'If hard stops → PDMA', color: 'var(--status-pass)' },
          ].map(kpi => (
            <div key={kpi.label} style={{ padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 700, color: kpi.color, lineHeight: 1.2 }}>{kpi.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Impact Chart */}
      <HarnessCard title="Impact Score Ranking" subtitle="Impact Score = Population% × Approval Loss% × Business Weight">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {impacts.map(rule => (
            <div key={rule.rule} style={{
              padding: '12px 14px',
              background: 'var(--bg-base)',
              borderRadius: 8,
              border: `1px solid ${rule.is_hard_stop ? 'rgba(248,113,113,0.15)' : 'var(--border-subtle)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-primary)', fontWeight: 700 }}>{rule.rule}</span>
                    {rule.is_hard_stop && <StatusBadge status="fail" label="HARD STOP" size="sm" />}
                    <StatusBadge status={rule.trend_wow > 5 ? 'fail' : rule.trend_wow < -5 ? 'pass' : 'warn'} label={`${rule.trend_wow > 0 ? '+' : ''}${rule.trend_wow}% WoW`} size="sm" />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{rule.label}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>Impact Score</div>
                  <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 800, color: rule.impact_score > 3 ? 'var(--status-fail)' : rule.impact_score > 1 ? 'var(--status-warn)' : 'var(--text-secondary)' }}>
                    {rule.impact_score.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Impact bar */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(rule.impact_score / maxImpact) * 100}%`,
                    background: rule.impact_score > 3 ? 'var(--status-fail)' : rule.impact_score > 1 ? 'var(--status-warn)' : 'var(--accent-primary)',
                    borderRadius: 3,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Affected',    value: rule.affected_count.toLocaleString(), sub: `${rule.affected_pct}%`,       icon: TrendingDown, color: 'var(--text-secondary)' },
                  { label: 'Declined',    value: rule.declined_count.toLocaleString(), sub: `${rule.approval_loss_pct}% loss`, icon: AlertTriangle, color: 'var(--status-fail)' },
                  { label: 'Rev. Loss',   value: `$${rule.revenue_impact_k}K`,        sub: 'annual',                     icon: DollarSign, color: 'var(--status-warn)' },
                  ...(rule.is_hard_stop ? [{ label: 'Recoverable', value: rule.counterfactual_gain.toLocaleString(), sub: 'via PDMA route', icon: TrendingUp, color: 'var(--status-pass)' }] : []),
                ].map(stat => (
                  <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <stat.icon size={11} color={stat.color} />
                    <div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: stat.color, fontWeight: 600 }}>{stat.value}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{stat.label} · {stat.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </HarnessCard>
    </div>
  );
}
