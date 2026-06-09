import { useFraudStore } from '@/store/fraudStore';
import { HarnessCard } from '@/design-system/components';
import { CheckCheck } from 'lucide-react';
import { type AlertLevel, type RecommendedAction } from '@/types/fraud.types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const ALERT_COLORS: Record<AlertLevel, string> = {
  CRITICAL: '#EF4444', HIGH: '#F97316', MEDIUM: '#FBBF24', LOW: '#4ADE80',
};

const ALERT_BG: Record<AlertLevel, string> = {
  CRITICAL: 'rgba(239,68,68,0.08)', HIGH: 'rgba(249,115,22,0.08)', MEDIUM: 'rgba(251,191,36,0.06)', LOW: 'rgba(74,222,128,0.06)',
};

const ACTION_COLORS: Record<RecommendedAction, string> = {
  BLOCK: '#EF4444', REVIEW: '#F97316', MONITOR: '#FBBF24', APPROVE: '#4ADE80',
};

type SortKey = 'time' | 'risk' | 'amount' | 'level';
import { useState } from 'react';

export function AlertCenter() {
  const { alerts, acknowledgeAlert } = useFraudStore();
  const [filter, setFilter] = useState<AlertLevel | 'ALL'>('ALL');
  const [sort, setSort] = useState<SortKey>('time');
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  const filtered = alerts
    .filter(a => filter === 'ALL' || a.alert_level === filter)
    .filter(a => showAcknowledged ? true : !a.acknowledged)
    .sort((a, b) => {
      if (sort === 'time')   return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (sort === 'risk')   return b.fraud_probability - a.fraud_probability;
      if (sort === 'amount') return b.amount - a.amount;
      const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return order[b.alert_level] - order[a.alert_level];
    });

  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  alerts.forEach(a => counts[a.alert_level]++);
  const unacked = alerts.filter(a => !a.acknowledged).length;

  const barData = Object.entries(counts).map(([level, count]) => ({ level, count }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fade-in 0.4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#E2E8F0', marginBottom: 4 }}>Alert Center</h1>
          <p style={{ fontSize: 12, color: 'var(--status-neutral)' }}>{unacked} unacknowledged alerts from Layer 4 outputs</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowAcknowledged(v => !v)}
            style={{
              padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
              background: showAcknowledged ? 'rgba(148,163,184,0.12)' : 'var(--bg-elevated)',
              border: '1px solid var(--border-default)', color: 'var(--status-neutral)', fontSize: 11,
            }}
          >
            {showAcknowledged ? 'Hide' : 'Show'} Acknowledged
          </button>
        </div>
      </div>

      {/* Stats + chart */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) 200px', gap: 12 }}>
        {(Object.keys(counts) as AlertLevel[]).map(level => (
          <div key={level} style={{
            padding: '14px 16px', borderRadius: 10,
            background: ALERT_BG[level], border: `1px solid ${ALERT_COLORS[level]}33`,
            cursor: 'pointer',
            outline: filter === level ? `2px solid ${ALERT_COLORS[level]}` : 'none',
          }} onClick={() => setFilter(f => f === level ? 'ALL' : level)}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: ALERT_COLORS[level] }}>{counts[level]}</div>
            <div style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>{level}</div>
          </div>
        ))}
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={barData} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
            <XAxis dataKey="level" tick={{ fontSize: 8, fill: 'var(--status-neutral)' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {barData.map(b => <Cell key={b.level} fill={ALERT_COLORS[b.level as AlertLevel]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--status-neutral)' }}>Filter:</span>
        {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
            background: filter === f ? (f === 'ALL' ? 'rgba(148,163,184,0.2)' : ALERT_BG[f as AlertLevel] ?? 'transparent') : 'transparent',
            border: `1px solid ${filter === f ? (f === 'ALL' ? 'var(--border-default)' : ALERT_COLORS[f as AlertLevel]) : 'var(--border-subtle)'}`,
            color: filter === f ? (f === 'ALL' ? '#E2E8F0' : ALERT_COLORS[f as AlertLevel]) : 'var(--status-neutral)',
          }}>{f}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--status-neutral)' }}>Sort:</span>
          {(['time', 'risk', 'amount', 'level'] as SortKey[]).map(s => (
            <button key={s} onClick={() => setSort(s)} style={{
              padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)',
              background: sort === s ? 'rgba(0,180,216,0.12)' : 'var(--bg-elevated)',
              border: `1px solid ${sort === s ? 'rgba(0,180,216,0.3)' : 'var(--border-subtle)'}`,
              color: sort === s ? 'var(--accent-primary)' : 'var(--status-neutral)',
            }}>{s}</button>
          ))}
        </div>
      </div>

      {/* Alert list */}
      <HarnessCard noPad>
        <div>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 100px 90px 110px 100px 80px', gap: 10, padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
            {['Alert Level', 'Transaction / Reason', 'Amount', 'Risk Score', 'Action', 'Time', ''].map(h => (
              <div key={h} style={{ fontSize: 9, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--border-bright)' }}>{h}</div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--status-neutral)', fontSize: 12 }}>
              No alerts matching current filter.
            </div>
          )}

          {filtered.map(alert => (
            <div key={alert.id} style={{
              display: 'grid', gridTemplateColumns: '120px 1fr 100px 90px 110px 100px 80px', gap: 10,
              padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)',
              opacity: alert.acknowledged ? 0.55 : 1,
              transition: 'opacity 0.2s',
              background: alert.acknowledged ? 'transparent' : ALERT_BG[alert.alert_level],
            }}>
              {/* Alert level */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: ALERT_COLORS[alert.alert_level], background: ALERT_BG[alert.alert_level],
                  border: `1px solid ${ALERT_COLORS[alert.alert_level]}44`,
                }}>{alert.alert_level}</span>
              </div>

              {/* Transaction + reason */}
              <div>
                <div style={{ fontSize: 11, color: '#CBD5E1', fontWeight: 600, marginBottom: 1 }}>{alert.transaction_id}</div>
                <div style={{ fontSize: 10, color: 'var(--status-neutral)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.top_reason}</div>
              </div>

              {/* Amount */}
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: '#E2E8F0', fontFamily: 'var(--font-mono)' }}>
                ${alert.amount.toLocaleString()}
              </div>

              {/* Risk score */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                  <div style={{ width: `${alert.fraud_probability * 100}%`, height: '100%', background: ALERT_COLORS[alert.alert_level], borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: ALERT_COLORS[alert.alert_level], fontWeight: 700 }}>{(alert.fraud_probability * 100).toFixed(0)}%</span>
              </div>

              {/* Action */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: ACTION_COLORS[alert.recommended_action],
                  background: `${ACTION_COLORS[alert.recommended_action]}15`,
                  border: `1px solid ${ACTION_COLORS[alert.recommended_action]}33`,
                }}>{alert.recommended_action}</span>
              </div>

              {/* Time */}
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>
                {new Date(alert.timestamp).toLocaleTimeString()}
              </div>

              {/* Acknowledge */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {!alert.acknowledged ? (
                  <button onClick={() => acknowledgeAlert(alert.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
                    background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)',
                    color: '#4ADE80', fontSize: 10, fontFamily: 'var(--font-mono)',
                  }}>
                    <CheckCheck size={10} /> ACK
                  </button>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--border-bright)', fontFamily: 'var(--font-mono)' }}>✓ acked</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </HarnessCard>
    </div>
  );
}
