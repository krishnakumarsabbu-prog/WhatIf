import { useQuery } from '@tanstack/react-query';
import { fetchTimeline, fetchApprovalTrendAnnotated } from '@/api/intelligence';
import { HarnessCard } from '@/design-system/components/HarnessCard';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Clock, TriangleAlert as AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

const IMPACT_STATUS: Record<string, 'pass' | 'warn' | 'fail'> = {
  POSITIVE: 'pass', NEUTRAL: 'warn', NEGATIVE: 'fail',
};

const CHANGE_TYPE_COLORS: Record<string, string> = {
  NEW: '#EF4444', THRESHOLD: '#F59E0B', UPGRADE: '#10B981',
  ENHANCEMENT: '#F97316', ESCALATION: '#DC2626', FLOW: '#0EA5E9', BUG: '#8B5CF6',
};

export function RuleTimeline() {
  const { data: timeline = [] } = useQuery({ queryKey: ['rule-timeline'], queryFn: fetchTimeline, staleTime: Infinity });
  const { data: trendData = [] } = useQuery({ queryKey: ['approval-trend-annotated'], queryFn: fetchApprovalTrendAnnotated, staleTime: Infinity });

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Clock size={20} color="var(--accent-primary)" />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Rule Version Timeline
          </h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
          Track rule changes and their correlation with approval rate — identify harmful deployments
        </p>
      </div>

      {/* Approval trend chart */}
      {trendData.length > 0 && (
        <HarnessCard title="Approval Rate with Version Annotations" subtitle="Vertical markers indicate rule deployments">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 8, right: 20, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} interval={6} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} tickFormatter={v => `${v.toFixed(0)}%`} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                formatter={(v: number) => [`${v.toFixed(1)}%`, 'Approval Rate']}
                labelFormatter={(label, payload) => {
                  const ev = payload?.[0]?.payload?.event;
                  return ev ? `${label} · ${ev.version}: ${ev.change}` : label;
                }}
              />
              {/* Version marker lines */}
              {timeline.map(ev => (
                <ReferenceLine
                  key={ev.version}
                  x={ev.date}
                  stroke={ev.is_harmful ? '#EF4444' : '#10B981'}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              ))}
              <Line type="monotone" dataKey="rate" stroke="var(--accent-primary)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--accent-primary)' }} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 20, height: 1, background: '#EF4444', borderTop: '2px dashed #EF4444' }} />
              Harmful change
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 20, height: 1, background: '#10B981', borderTop: '2px dashed #10B981' }} />
              Positive change
            </div>
          </div>
        </HarnessCard>
      )}

      {/* Timeline events */}
      <HarnessCard title="Version History" subtitle="Rule changes, threshold updates, and deployment events">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {timeline.map((ev, i) => {
            const typeColor = CHANGE_TYPE_COLORS[ev.type] ?? '#64748B';
            return (
              <div key={ev.version} style={{
                display: 'flex', gap: 16, padding: '14px 0',
                borderBottom: i < timeline.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                {/* Timeline dot */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: ev.is_harmful ? 'var(--status-fail)' : 'var(--status-pass)', border: `2px solid ${ev.is_harmful ? 'var(--status-fail)' : 'var(--status-pass)'}`, marginTop: 3 }} />
                  {i < timeline.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border-subtle)', marginTop: 4 }} />}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-primary)', fontWeight: 700 }}>{ev.version}</span>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: typeColor, background: `${typeColor}15`, padding: '1px 6px', borderRadius: 3 }}>{ev.type}</span>
                        <StatusBadge status={IMPACT_STATUS[ev.impact]} label={ev.impact} size="sm" />
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{ev.change}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                        {ev.rule} · {ev.date} · by {ev.author}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>Approval Delta</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        {ev.approval_delta > 0 ? <TrendingUp size={12} color="var(--status-pass)" /> : ev.approval_delta < 0 ? <TrendingDown size={12} color="var(--status-fail)" /> : null}
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
                          color: ev.approval_delta > 0 ? 'var(--status-pass)' : ev.approval_delta < 0 ? 'var(--status-fail)' : 'var(--text-muted)',
                        }}>
                          {ev.approval_delta > 0 ? '+' : ''}{ev.approval_delta.toFixed(1)}pp
                        </span>
                      </div>
                      {ev.rate_before !== null && ev.rate_after !== null && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                          {ev.rate_before}% → {ev.rate_after}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </HarnessCard>

      {/* Summary of harmful changes */}
      <HarnessCard title="Potentially Harmful Changes" subtitle="Deployments correlated with approval decline">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {timeline.filter(ev => ev.is_harmful).map(ev => (
            <div key={ev.version} style={{ display: 'flex', gap: 12, padding: '10px 12px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 8 }}>
              <AlertTriangle size={14} color="var(--status-fail)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{ev.version} — {ev.change}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {ev.rule} · {ev.date} · Approval delta: {ev.approval_delta.toFixed(1)}pp
                </div>
              </div>
            </div>
          ))}
        </div>
      </HarnessCard>
    </div>
  );
}
