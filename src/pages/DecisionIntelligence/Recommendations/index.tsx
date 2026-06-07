import { useQuery } from '@tanstack/react-query';
import { fetchRecommendations } from '@/api/intelligence';
import { HarnessCard } from '@/design-system/components/HarnessCard';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import { Lightbulb, TrendingUp, DollarSign, Shield, ChevronRight } from 'lucide-react';

const RISK_STATUS: Record<string, 'pass' | 'warn' | 'fail'> = {
  LOW: 'pass', MEDIUM: 'warn', HIGH: 'fail',
};
const CONF_STATUS: Record<string, 'pass' | 'warn' | 'fail'> = {
  HIGH: 'pass', MEDIUM: 'warn', LOW: 'fail',
};

export function Recommendations() {
  const { data: recs = [], isLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: fetchRecommendations,
    staleTime: 60_000,
  });

  if (isLoading) return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 10 }} />)}
    </div>
  );

  const totalGain = recs.filter(r => r.type !== 'BUNDLE').reduce((s, r) => s + r.approval_gain_pp, 0);
  const totalRev = recs.filter(r => r.type !== 'BUNDLE').reduce((s, r) => s + r.revenue_gain_k, 0);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Lightbulb size={20} color="var(--accent-primary)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Policy Recommendations
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            AI-generated recommendations ranked by ROI — approval gain, revenue impact, and compliance risk
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Combined Opportunity</div>
          <div style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--status-pass)' }}>
            +{totalGain.toFixed(1)}pp · ${totalRev.toFixed(0)}K ARR
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {recs.map((rec, i) => (
          <div key={rec.id} style={{
            padding: '16px 18px',
            background: 'var(--bg-surface)',
            border: `1px solid ${rec.risk_level === 'LOW' ? 'rgba(74,222,128,0.2)' : rec.risk_level === 'MEDIUM' ? 'rgba(251,191,36,0.2)' : 'rgba(248,113,113,0.2)'}`,
            borderRadius: 10,
            borderLeft: `4px solid ${rec.risk_level === 'LOW' ? 'var(--status-pass)' : rec.risk_level === 'MEDIUM' ? 'var(--status-warn)' : 'var(--status-fail)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ flex: 1, paddingRight: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>#{i + 1}</span>
                  {rec.type === 'BUNDLE' && <StatusBadge status="info" label="BUNDLE" size="sm" />}
                  <StatusBadge status={RISK_STATUS[rec.risk_level]} label={`${rec.risk_level} RISK`} size="sm" />
                  <StatusBadge status={CONF_STATUS[rec.confidence]} label={`${rec.confidence} CONF.`} size="sm" />
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px', lineHeight: 1.4 }}>{rec.title}</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>{rec.description}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flexShrink: 0, minWidth: 200 }}>
                {[
                  { label: 'Approval Gain', value: `+${rec.approval_gain_pp.toFixed(2)}pp`, icon: TrendingUp, color: 'var(--status-pass)' },
                  { label: 'Revenue Gain',  value: `+$${rec.revenue_gain_k}K`, icon: DollarSign, color: 'var(--accent-primary)' },
                  { label: 'Recovered',     value: rec.recovered_customers.toLocaleString(), icon: Shield, color: 'var(--text-secondary)' },
                  { label: 'Impact Score',  value: rec.impact_score.toFixed(2), icon: ChevronRight, color: 'var(--text-muted)' },
                ].map(m => (
                  <div key={m.label} style={{ textAlign: 'center', padding: '8px', background: 'var(--bg-base)', borderRadius: 6 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>{m.label}</div>
                    <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: m.color, fontWeight: 600 }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '8px 12px', background: 'rgba(0,180,216,0.05)', border: '1px solid rgba(0,180,216,0.1)', borderRadius: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                <Shield size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                {rec.compliance_note}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
