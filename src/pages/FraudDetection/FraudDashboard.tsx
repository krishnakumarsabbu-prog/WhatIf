import { useMemo } from 'react';
import { useFraudStore } from '@/store/fraudStore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell,
} from 'recharts';
import { HarnessCard } from '@/design-system/components';
import { TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, ShieldAlert, TrendingUp } from 'lucide-react';
import { type AlertLevel } from '@/types/fraud.types';
import { generateHistoricalAlerts } from '@/services/layerProcessors';

const ALERT_COLORS: Record<AlertLevel, string> = {
  CRITICAL: '#EF4444', HIGH: '#F97316', MEDIUM: '#FBBF24', LOW: '#4ADE80',
};

const ALERT_BG: Record<AlertLevel, string> = {
  CRITICAL: 'rgba(239,68,68,0.08)', HIGH: 'rgba(249,115,22,0.08)', MEDIUM: 'rgba(251,191,36,0.08)', LOW: 'rgba(74,222,128,0.06)',
};

// Generate chart data once
const trendData = Array.from({ length: 24 }, (_, i) => {
  const rng = (seed: number) => { let s = seed * 9301 + 49297; return (s % 233280) / 233280; };
  return {
    hour: `${String(i).padStart(2, '0')}:00`,
    score: parseFloat((0.15 + rng(i * 13 + 7) * 0.65).toFixed(2)),
    count: Math.floor(5 + rng(i * 17 + 3) * 45),
  };
});

export function FraudDashboard() {
  const { alerts, pipelineResult, history } = useFraudStore();

  const stats = useMemo(() => {
    const total  = Math.max(history.length, 100);
    const fraud  = alerts.filter(a => a.alert_level === 'CRITICAL' || a.alert_level === 'HIGH').length;
    const fp_rate = parseFloat((alerts.filter(a => a.acknowledged && a.recommended_action === 'APPROVE').length / Math.max(alerts.length, 1) * 100).toFixed(1));
    const avg_risk = alerts.length > 0 ? parseFloat((alerts.reduce((s, a) => s + a.fraud_probability, 0) / alerts.length * 100).toFixed(1)) : 0;
    return { total, fraud, fp_rate, avg_risk };
  }, [alerts, history]);

  const breakdown = useMemo(() => {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    alerts.forEach(a => counts[a.alert_level]++);
    return Object.entries(counts).map(([level, count]) => ({ level, count }));
  }, [alerts]);

  const layerHealth = [
    { layer: 'Rules Engine', status: 'OPERATIONAL', color: '#4ADE80', latency: '2ms' },
    { layer: 'Feature Eng.', status: 'OPERATIONAL', color: '#4ADE80', latency: '1ms' },
    { layer: 'ML Scoring',   status: 'OPERATIONAL', color: '#4ADE80', latency: '8ms' },
    { layer: 'Explainability', status: 'OPERATIONAL', color: '#4ADE80', latency: '3ms' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fade-in 0.4s ease' }}>

      {/* KPI Rail */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Analyzed', value: stats.total, icon: TrendingUp, color: '#3B82F6', suffix: '' },
          { label: 'Fraud Detected', value: stats.fraud, icon: ShieldAlert, color: '#EF4444', suffix: '' },
          { label: 'False Positive Rate', value: stats.fp_rate, icon: AlertTriangle, color: '#FBBF24', suffix: '%' },
          { label: 'Avg Risk Score', value: stats.avg_risk, icon: CheckCircle, color: '#4ADE80', suffix: '%' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            padding: '16px 20px', borderRadius: 10,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            display: 'flex', gap: 12, alignItems: 'center',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${kpi.color}18`, border: `1px solid ${kpi.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <kpi.icon size={18} color={kpi.color} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>
                {kpi.value}{kpi.suffix}
              </div>
              <div style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Fraud score trend */}
        <HarnessCard title="Fraud Score Trend — Last 24h" subtitle="Hourly average fraud probability">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} interval={3} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 9, fill: 'var(--status-neutral)' }} tickFormatter={v => `${Math.round(v * 100)}%`} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, 'Fraud Risk']}
              />
              <ReferenceLine y={0.5} stroke="var(--status-warn)" strokeDasharray="4 4" strokeWidth={1} />
              <Line type="monotone" dataKey="score" stroke="#EF4444" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#EF4444' }} />
            </LineChart>
          </ResponsiveContainer>
        </HarnessCard>

        {/* Alert breakdown */}
        <HarnessCard title="Alert Distribution">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {breakdown.map(b => (
              <div key={b.level} style={{
                padding: '10px 14px', borderRadius: 8,
                background: ALERT_BG[b.level as AlertLevel],
                border: `1px solid ${ALERT_COLORS[b.level as AlertLevel]}33`,
              }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: ALERT_COLORS[b.level as AlertLevel] }}>{b.count}</div>
                <div style={{ fontSize: 11, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>{b.level}</div>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={breakdown} margin={{ top: 0, right: 8, left: -24, bottom: 0 }}>
              <YAxis tick={{ fontSize: 9, fill: 'var(--status-neutral)' }} axisLine={false} tickLine={false} />
              <XAxis dataKey="level" tick={{ fontSize: 9, fill: 'var(--status-neutral)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11 }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {breakdown.map(b => <Cell key={b.level} fill={ALERT_COLORS[b.level as AlertLevel]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </HarnessCard>
      </div>

      {/* Pipeline health */}
      <HarnessCard title="Pipeline Health — All 4 Layers">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {layerHealth.map((l, i) => (
            <div key={l.layer} style={{
              padding: '14px 16px', borderRadius: 8,
              background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: ['#8B5CF6', '#3B82F6', '#F97316', '#EC4899'][i], fontWeight: 700 }}>LAYER {i + 1}</span>
                <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(74,222,128,0.15)', color: '#4ADE80', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>●&nbsp;{l.status}</span>
              </div>
              <div style={{ fontSize: 12, color: '#E2E8F0', fontWeight: 600 }}>{l.layer}</div>
              <div style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>Avg latency: {l.latency}</div>
            </div>
          ))}
        </div>
      </HarnessCard>

      {/* Recent alerts feed */}
      <HarnessCard title="Recent Alerts Feed" subtitle="Latest Layer 4 outputs">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {alerts.slice(0, 8).map(alert => (
            <div key={alert.id} style={{
              display: 'flex', gap: 12, alignItems: 'center', padding: '9px 0',
              borderBottom: '1px solid var(--border-subtle)', opacity: alert.acknowledged ? 0.6 : 1,
            }}>
              <div style={{
                padding: '2px 7px', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                background: ALERT_BG[alert.alert_level], color: ALERT_COLORS[alert.alert_level],
                border: `1px solid ${ALERT_COLORS[alert.alert_level]}44`, whiteSpace: 'nowrap',
              }}>{alert.alert_level}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#CBD5E1', fontWeight: 500 }}>{alert.transaction_id} — ${alert.amount.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: 'var(--status-neutral)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.top_reason}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: ALERT_COLORS[alert.alert_level] }}>{(alert.fraud_probability * 100).toFixed(0)}%</div>
                <div style={{ fontSize: 9, color: 'var(--status-neutral)' }}>{new Date(alert.timestamp).toLocaleTimeString()}</div>
              </div>
              <div style={{
                padding: '2px 7px', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                background: 'rgba(148,163,184,0.1)', color: 'var(--status-neutral)', border: '1px solid var(--border-subtle)',
              }}>{alert.recommended_action}</div>
            </div>
          ))}
        </div>
      </HarnessCard>
    </div>
  );
}
