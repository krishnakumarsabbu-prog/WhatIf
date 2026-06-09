import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { type FeatureVector } from '@/types/fraud.types';

interface Props {
  data: FeatureVector;
  onFeatureHover?: (feature: string | null) => void;
}

export function Layer2FeatureEngineering({ data, onFeatureHover }: Props) {
  const chartData = data.features.map(f => ({
    name: f.display_label,
    feature: f.feature_name,
    value: f.normalized_value,
    importance: f.importance_weight,
    raw: f.raw_value,
  }));

  return (
    <div style={{ borderLeft: '3px solid #3B82F6', paddingLeft: 16 }}>
      {/* Feature table */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
          {['Feature', 'Raw Value', 'Normalized', 'Importance'].map(h => (
            <div key={h} style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--border-bright)' }}>{h}</div>
          ))}
        </div>
        {data.features.map(f => (
          <div
            key={f.feature_name}
            onMouseEnter={() => onFeatureHover?.(f.feature_name)}
            onMouseLeave={() => onFeatureHover?.(null)}
            style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8,
              padding: '7px 8px', borderBottom: '1px solid var(--border-subtle)',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: '#E2E8F0', fontWeight: 500 }}>{f.display_label}</div>
              <div style={{ fontSize: 9, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>{f.feature_name}</div>
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center' }}>
              {typeof f.raw_value === 'number' && f.raw_value > 10 ? f.raw_value.toFixed(0) : f.raw_value.toFixed(2)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                <div style={{
                  width: `${f.normalized_value * 100}%`, height: '100%', borderRadius: 3,
                  background: f.normalized_value > 0.6 ? '#F87171' : f.normalized_value > 0.35 ? '#FBBF24' : '#4ADE80',
                }} />
              </div>
              <span style={{ fontSize: 10, color: '#CBD5E1', fontFamily: 'var(--font-mono)' }}>{f.normalized_value.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                <div style={{ width: `${f.importance_weight * 100}%`, height: '100%', borderRadius: 3, background: '#3B82F6' }} />
              </div>
              <span style={{ fontSize: 10, color: '#CBD5E1', fontFamily: 'var(--font-mono)' }}>{f.importance_weight.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--border-bright)', marginBottom: 10 }}>
          Feature Vector Visualization
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }} angle={-35} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
            <YAxis domain={[0, 1]} tick={{ fontSize: 9, fill: 'var(--status-neutral)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}
              formatter={(v: number) => [v.toFixed(3), 'Normalized']}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {chartData.map(d => (
                <Cell key={d.feature} fill={d.value > 0.6 ? '#F87171' : d.value > 0.35 ? '#FBBF24' : '#4ADE80'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
