import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { type ExplainabilityOutput, type AlertLevel, type RecommendedAction } from '@/types/fraud.types';

const ALERT_COLORS: Record<AlertLevel, string> = {
  CRITICAL: '#EF4444', HIGH: '#F97316', MEDIUM: '#FBBF24', LOW: '#4ADE80',
};

const ACTION_COLORS: Record<RecommendedAction, string> = {
  BLOCK: '#EF4444', REVIEW: '#F97316', MONITOR: '#FBBF24', APPROVE: '#4ADE80',
};

interface Props {
  data: ExplainabilityOutput;
  onFeatureHover?: (feature: string | null) => void;
}

export function Layer4Explainability({ data, onFeatureHover }: Props) {
  const [tab, setTab] = useState<'shap' | 'reasons' | 'audit'>('shap');

  const shapData = data.shap_values.map(s => ({
    name: s.display_label,
    feature: s.feature,
    value: parseFloat(s.shap_value.toFixed(3)),
    abs: Math.abs(s.shap_value),
  })).sort((a, b) => b.abs - a.abs);

  return (
    <div style={{ borderLeft: '3px solid #EC4899', paddingLeft: 16 }}>
      {/* Alert + Action header */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{
          flex: 1, padding: '12px 16px', borderRadius: 8,
          background: `${ALERT_COLORS[data.alert_level]}12`,
          border: `1px solid ${ALERT_COLORS[data.alert_level]}44`,
        }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--status-neutral)', marginBottom: 2 }}>ALERT LEVEL</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: ALERT_COLORS[data.alert_level] }}>
            {data.alert_level}
          </div>
        </div>
        <div style={{
          flex: 1, padding: '12px 16px', borderRadius: 8,
          background: `${ACTION_COLORS[data.recommended_action]}12`,
          border: `1px solid ${ACTION_COLORS[data.recommended_action]}44`,
        }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--status-neutral)', marginBottom: 2 }}>RECOMMENDED ACTION</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: ACTION_COLORS[data.recommended_action] }}>
            {data.recommended_action}
          </div>
        </div>
        <div style={{
          flex: 2, padding: '12px 16px', borderRadius: 8,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--status-neutral)', marginBottom: 4 }}>DECISION SUMMARY</div>
          <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.5 }}>{data.decision_summary}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
        {(['shap', 'reasons', 'audit'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 16px', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid #EC4899' : '2px solid transparent',
            color: tab === t ? '#EC4899' : 'var(--status-neutral)',
            fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600,
            cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
            transition: 'all 0.15s',
          }}>
            {t === 'shap' ? 'SHAP Values' : t === 'reasons' ? 'Reason Codes' : 'Audit Trail'}
          </button>
        ))}
      </div>

      {tab === 'shap' && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--status-neutral)', marginBottom: 10, lineHeight: 1.5 }}>
            Positive values (red) <strong style={{ color: '#F87171' }}>increase fraud risk</strong>. Negative values (blue) <strong style={{ color: '#60A5FA' }}>decrease fraud risk</strong>.
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={shapData} layout="vertical" margin={{ top: 4, right: 60, left: 120, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
              <XAxis type="number" domain={['auto', 'auto']} tick={{ fontSize: 9, fill: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#CBD5E1' }} axisLine={false} tickLine={false} width={116} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                formatter={(v: number) => [v.toFixed(3), 'SHAP Value']}
              />
              <ReferenceLine x={0} stroke="var(--border-default)" strokeWidth={1} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]}
                onMouseEnter={(d: { feature?: string }) => onFeatureHover?.(d.feature ?? null)}
                onMouseLeave={() => onFeatureHover?.(null)}
              >
                {shapData.map(d => (
                  <Cell key={d.feature} fill={d.value >= 0 ? '#F87171' : '#60A5FA'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'reasons' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.reason_codes.map(rc => (
            <div key={rc.code} style={{
              display: 'flex', gap: 12, padding: '10px 12px', borderRadius: 8,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: rc.impact === 'HIGH' ? 'rgba(248,113,113,0.15)' : rc.impact === 'MEDIUM' ? 'rgba(251,191,36,0.12)' : 'rgba(74,222,128,0.1)',
                border: `1px solid ${rc.impact === 'HIGH' ? '#F87171' : rc.impact === 'MEDIUM' ? '#FBBF24' : '#4ADE80'}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
                color: rc.impact === 'HIGH' ? '#F87171' : rc.impact === 'MEDIUM' ? '#FBBF24' : '#4ADE80',
              }}>{rc.rank}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#EC4899' }}>{rc.code}</span>
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(148,163,184,0.1)', color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>{rc.contributing_feature}</span>
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    background: rc.impact === 'HIGH' ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.1)',
                    color: rc.impact === 'HIGH' ? '#F87171' : '#FBBF24',
                  }}>{rc.impact}</span>
                </div>
                <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.5 }}>{rc.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {data.audit_trail.map((entry, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EC4899', boxShadow: '0 0 6px #EC489988' }} />
                {i < data.audit_trail.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border-subtle)', minHeight: 20, marginTop: 4 }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#EC4899', fontWeight: 700 }}>{entry.event}</span>
                  <span style={{ fontSize: 9, color: 'var(--border-bright)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--status-neutral)' }}>analyst: {entry.analyst_id}</span>
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{entry.details}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
