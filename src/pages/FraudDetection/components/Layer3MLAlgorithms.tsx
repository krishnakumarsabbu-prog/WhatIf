import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { type EnsembleScore } from '@/types/fraud.types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ── D3 Arc Gauge ──────────────────────────────────────────────────────────
function FraudGauge({ probability }: { probability: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();

    const W = 200, H = 120;
    const cx = W / 2, cy = H - 10;
    const r = 88;

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    // Background arc
    const bgArc = d3.arc()({ innerRadius: r - 18, outerRadius: r, startAngle: -Math.PI / 2, endAngle: Math.PI / 2 });
    g.append('path').attr('d', bgArc!).attr('fill', '#1A2235');

    // Value arc
    const color = probability > 0.75 ? '#EF4444' : probability > 0.5 ? '#F97316' : probability > 0.25 ? '#FBBF24' : '#4ADE80';
    const endAngle = -Math.PI / 2 + probability * Math.PI;
    const valueArc = d3.arc()({ innerRadius: r - 18, outerRadius: r, startAngle: -Math.PI / 2, endAngle });
    g.append('path').attr('d', valueArc!).attr('fill', color).attr('filter', `drop-shadow(0 0 6px ${color}88)`);

    // Tick marks
    [0, 0.25, 0.5, 0.75, 1].forEach(t => {
      const angle = -Math.PI / 2 + t * Math.PI;
      const x1 = Math.cos(angle) * (r + 4), y1 = Math.sin(angle) * (r + 4);
      const x2 = Math.cos(angle) * (r + 12), y2 = Math.sin(angle) * (r + 12);
      g.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2)
        .attr('stroke', '#3B5A80').attr('stroke-width', 1.5);
      g.append('text')
        .attr('x', Math.cos(angle) * (r + 22)).attr('y', Math.sin(angle) * (r + 22) + 4)
        .attr('text-anchor', 'middle').attr('fill', '#64748B').attr('font-size', 9)
        .attr('font-family', 'JetBrains Mono, monospace')
        .text(`${Math.round(t * 100)}%`);
    });

    // Center text
    g.append('text').attr('text-anchor', 'middle').attr('y', -18)
      .attr('fill', color).attr('font-size', 32).attr('font-weight', 800)
      .attr('font-family', 'Syne, sans-serif')
      .text(`${Math.round(probability * 100)}%`);

    g.append('text').attr('text-anchor', 'middle').attr('y', 2)
      .attr('fill', '#94A3B8').attr('font-size', 10).attr('font-family', 'JetBrains Mono, monospace')
      .text('FRAUD PROBABILITY');
  }, [probability]);

  return <svg ref={ref} width={200} height={120} style={{ display: 'block', margin: '0 auto' }} />;
}

// ── Main Layer 3 Component ─────────────────────────────────────────────────
interface Props { data: EnsembleScore }

export function Layer3MLAlgorithms({ data }: Props) {
  const chartData = data.models.map(m => ({
    name: m.model_name,
    probability: Math.round(m.fraud_probability * 100),
    confidence: Math.round(m.confidence * 100),
    weight: m.weight,
  }));

  const modelColors = ['#F97316', '#A855F7', '#06B6D4'];

  return (
    <div style={{ borderLeft: '3px solid #F97316', paddingLeft: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
        {/* Gauge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <FraudGauge probability={data.final_fraud_probability} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>95% Confidence</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#A855F7' }}>
              [{(data.confidence_low * 100).toFixed(1)}% – {(data.confidence_high * 100).toFixed(1)}%]
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '6px 12px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>Anomaly Score</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: data.anomaly_score < 0 ? '#F87171' : '#4ADE80', fontWeight: 700 }}>
              {data.anomaly_score.toFixed(3)}
            </div>
            <div style={{ fontSize: 9, color: 'var(--border-bright)' }}>{data.anomaly_score < -0.2 ? 'ANOMALOUS' : 'NORMAL'}</div>
          </div>
        </div>

        {/* Models */}
        <div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--border-bright)', marginBottom: 12 }}>
            Model Scores — Parallel Execution
          </div>
          {data.models.map((m, i) => (
            <div key={m.model_name} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div>
                  <span style={{ fontSize: 12, color: '#E2E8F0', fontWeight: 600 }}>{m.model_name}</span>
                  <span style={{ fontSize: 9, marginLeft: 6, padding: '1px 5px', borderRadius: 3, background: `${modelColors[i]}22`, color: modelColors[i], fontFamily: 'var(--font-mono)', border: `1px solid ${modelColors[i]}44` }}>
                    w={m.weight.toFixed(2)}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: modelColors[i] }}>
                  {(m.fraud_probability * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                <div style={{
                  width: `${m.fraud_probability * 100}%`, height: '100%', borderRadius: 4,
                  background: modelColors[i], transition: 'width 0.6s ease',
                  boxShadow: `0 0 8px ${modelColors[i]}88`,
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                <span style={{ fontSize: 9, color: 'var(--status-neutral)' }}>Confidence: {(m.confidence * 100).toFixed(0)}%</span>
                <span style={{ fontSize: 9, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>
                  {m.model_type === 'gradient_boost' ? 'XGBoost Classifier' : m.model_type === 'neural_network' ? 'MLP Classifier' : 'Isolation Forest'}
                </span>
              </div>
            </div>
          ))}

          {/* Ensemble bar chart */}
          <div style={{ marginTop: 12 }}>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--status-neutral)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  formatter={(v: number) => [`${v}%`, 'Fraud Probability']}
                />
                <Bar dataKey="probability" radius={[3, 3, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={modelColors[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
