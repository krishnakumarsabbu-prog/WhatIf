import { type RulesEngineOutput, type RuleStatus } from '@/types/fraud.types';

const statusColor: Record<RuleStatus, string> = {
  PASS: '#4ADE80',
  FAIL: '#F87171',
  WARN: '#FBBF24',
};

const statusBg: Record<RuleStatus, string> = {
  PASS: 'rgba(74,222,128,0.08)',
  FAIL: 'rgba(248,113,113,0.08)',
  WARN: 'rgba(251,191,36,0.08)',
};

interface Props {
  data: RulesEngineOutput;
  highlightedFeature?: string | null;
}

export function Layer1RulesEngine({ data, highlightedFeature }: Props) {
  return (
    <div style={{ borderLeft: '3px solid #8B5CF6', paddingLeft: 16 }}>
      {/* Summary row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
        {[
          { label: 'Passed', count: data.pass_count, color: '#4ADE80' },
          { label: 'Failed', count: data.fail_count, color: '#F87171' },
          { label: 'Warnings', count: data.warn_count, color: '#FBBF24' },
          { label: 'Rules Score', count: data.rules_score, color: '#8B5CF6', suffix: '' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, padding: '8px 10px', borderRadius: 8,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: s.color }}>
              {s.count}{s.suffix ?? ''}
            </div>
            <div style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Rules table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
          {['Rule Name', 'Threshold', 'Actual', 'Status', 'Risk Weight'].map(h => (
            <div key={h} style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--border-bright)' }}>
              {h}
            </div>
          ))}
        </div>
        {data.rules.map(rule => {
          const ruleFeature = {
            'Velocity Check': 'velocity_score',
            'Amount Threshold': 'amount_zscore',
            'Geo-Anomaly': 'geo_risk_index',
            'Device Fingerprint': 'device_trust_score',
            'Time Pattern': 'time_anomaly_score',
            'Merchant Risk Score': 'merchant_risk_score',
            'Behavioral Deviation': 'behavioral_deviation',
            'Blacklist Check': 'network_risk_score',
          }[rule.rule_name];
          const isHighlighted = ruleFeature === highlightedFeature;

          return (
            <div key={rule.rule_name} style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8,
              padding: '8px 8px', borderBottom: '1px solid var(--border-subtle)',
              background: isHighlighted ? 'rgba(139,92,246,0.12)' : statusBg[rule.status],
              borderLeft: isHighlighted ? '2px solid #8B5CF6' : 'none',
              transition: 'background 0.2s',
            }}>
              <div>
                <div style={{ fontSize: 12, color: '#E2E8F0', fontWeight: 500 }}>{rule.rule_name}</div>
                <div style={{ fontSize: 10, color: 'var(--status-neutral)', marginTop: 1 }}>{rule.description}</div>
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center' }}>{String(rule.threshold)}</div>
              <div style={{ fontSize: 12, color: '#E2E8F0', fontFamily: 'var(--font-mono)', fontWeight: 600, display: 'flex', alignItems: 'center' }}>{String(rule.actual_value)}</div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: statusColor[rule.status], background: statusBg[rule.status],
                  border: `1px solid ${statusColor[rule.status]}44`,
                }}>{rule.status}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                  <div style={{ width: `${rule.risk_weight * 100}%`, height: '100%', background: statusColor[rule.status], borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>{Math.round(rule.risk_weight * 100)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
