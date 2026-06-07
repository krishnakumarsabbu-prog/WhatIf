import { useQuery } from '@tanstack/react-query';
import { fetchIntelligenceOverview, fetchRootCause } from '@/api/intelligence';
import { HarnessCard } from '@/design-system/components/HarnessCard';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import { Brain, TrendingDown, TrendingUp, DollarSign, Shield, Lightbulb, TriangleAlert as AlertTriangle, Target } from 'lucide-react';

export function IntelligenceOverview() {
  const { data: overview } = useQuery({
    queryKey: ['intelligence-overview'],
    queryFn: fetchIntelligenceOverview,
    staleTime: 60_000,
  });

  const { data: rootCause } = useQuery({
    queryKey: ['root-cause'],
    queryFn: fetchRootCause,
    staleTime: 60_000,
  });

  if (!overview) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />
        ))}
      </div>
    );
  }

  const approvalRate = overview.approval_rate;
  const declineRate = 100 - approvalRate;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Brain size={22} color="var(--accent-primary)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Decision Intelligence Overview
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Executive view — approval drivers, revenue impact, and top optimization opportunities
          </p>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-primary)', background: 'rgba(0,180,216,0.1)', padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(0,180,216,0.2)' }}>
          1,500 transactions · Live
        </span>
      </div>

      {/* KPI Rail */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Approval Rate',      value: `${approvalRate.toFixed(1)}%`,  icon: Target,       color: approvalRate > 65 ? 'var(--status-pass)' : 'var(--status-warn)', sub: `${overview.verified.toLocaleString()} verified` },
          { label: 'Decline Rate',       value: `${declineRate.toFixed(1)}%`,   icon: TrendingDown, color: 'var(--status-fail)', sub: `${overview.declined.toLocaleString()} declined` },
          { label: 'Est. Revenue Loss',  value: `$${overview.revenue_loss_k}K`, icon: DollarSign,   color: 'var(--status-warn)', sub: 'Annual basis' },
          { label: 'Total Transactions', value: overview.total.toLocaleString(), icon: Shield,      color: 'var(--accent-primary)', sub: 'In-memory dataset' },
        ].map(kpi => (
          <HarnessCard key={kpi.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <kpi.icon size={18} color={kpi.color} />
              </div>
              <div>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{kpi.label}</div>
                <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800, color: kpi.color, lineHeight: 1.1 }}>{kpi.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{kpi.sub}</div>
              </div>
            </div>
          </HarnessCard>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Root Cause */}
        {rootCause && (
          <HarnessCard title="Root Cause Analysis" subtitle="Top drivers of approval loss" glow="fail">
            <div style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Summary</div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{rootCause.summary}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(rootCause.factors ?? []).slice(0, 5).map((f: any, i: number) => (
                <div key={f.factor} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: 14 }}>#{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{f.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.count} declined · {f.pct_of_declined}% of all declines</div>
                  </div>
                  <StatusBadge status={f.confidence === 'HIGH' ? 'pass' : f.confidence === 'MEDIUM' ? 'warn' : 'fail'} label={f.confidence} size="sm" />
                </div>
              ))}
            </div>
          </HarnessCard>
        )}

        {/* Top Recommendations */}
        <HarnessCard title="Top Recommendations" subtitle="Highest ROI policy changes" glow="pass">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(overview.recommendations ?? []).map((rec: any, i: number) => (
              <div key={rec.id} style={{ padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 8, border: `1px solid ${rec.risk_level === 'LOW' ? 'rgba(74,222,128,0.15)' : rec.risk_level === 'MEDIUM' ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.4, flex: 1, paddingRight: 8 }}>{rec.title}</div>
                  <StatusBadge status={rec.risk_level === 'LOW' ? 'pass' : rec.risk_level === 'MEDIUM' ? 'warn' : 'fail'} label={rec.risk_level} size="sm" />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--status-pass)' }}>
                    <TrendingUp size={10} style={{ display: 'inline', marginRight: 3 }} />
                    +{rec.approval_gain_pp}pp approval
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--accent-primary)' }}>
                    <DollarSign size={10} style={{ display: 'inline', marginRight: 3 }} />
                    ${rec.revenue_gain_k}K ARR
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {rec.confidence} confidence
                  </div>
                </div>
              </div>
            ))}
          </div>
        </HarnessCard>
      </div>

      {/* Rule Impact Table */}
      <HarnessCard title="Rule Impact Leaderboard" subtitle="Ranked by business impact score">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Rule', 'Label', 'Affected', '% Volume', 'Declined', 'Approval Loss', 'Impact Score', 'Rev. Loss $K', 'WoW'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(overview.rule_impact ?? []).map((r: any) => (
                <tr key={r.rule} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '8px 10px', color: 'var(--accent-primary)' }}>{r.rule}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{r.label}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{r.affected_count.toLocaleString()}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{r.affected_pct}%</td>
                  <td style={{ padding: '8px 10px', color: 'var(--status-fail)' }}>{r.declined_count.toLocaleString()}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--status-fail)' }}>{r.approval_loss_pct}%</td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${Math.min(r.impact_score / 10 * 100, 100)}%`, background: 'var(--accent-primary)', borderRadius: 2 }} />
                      </div>
                      <span style={{ color: 'var(--accent-primary)', fontSize: 11 }}>{r.impact_score.toFixed(2)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--status-warn)' }}>{r.revenue_impact_k}</td>
                  <td style={{ padding: '8px 10px', color: r.trend_wow > 0 ? 'var(--status-fail)' : 'var(--status-pass)' }}>
                    {r.trend_wow > 0 ? '+' : ''}{r.trend_wow}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HarnessCard>
    </div>
  );
}
