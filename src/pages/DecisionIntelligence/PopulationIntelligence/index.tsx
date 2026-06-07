import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSegments, fetchPopulationFunnel, fetchTreemap, fetchSegmentHeatmap } from '@/api/intelligence';
import { HarnessCard } from '@/design-system/components/HarnessCard';
import { Users } from 'lucide-react';

const DIMENSIONS = [
  { key: 'gsa_result',  label: 'GSA Result' },
  { key: 'fault_code',  label: 'Fault Code' },
  { key: 'doc_result',  label: 'Doc Result' },
  { key: 'face_result', label: 'Face Result' },
  { key: 'pdma_result', label: 'PDMA Result' },
  { key: 'risk_result', label: 'Risk Result' },
];

export function PopulationIntelligence() {
  const [dimension, setDimension] = useState('gsa_result');

  const { data: segments = [] } = useQuery({
    queryKey: ['segments', dimension],
    queryFn: () => fetchSegments(dimension),
    staleTime: 60_000,
  });

  const { data: funnel = [] } = useQuery({ queryKey: ['pop-funnel'], queryFn: fetchPopulationFunnel, staleTime: Infinity });
  const { data: treemap = [] } = useQuery({ queryKey: ['treemap'], queryFn: fetchTreemap, staleTime: Infinity });
  const { data: heatmap } = useQuery({ queryKey: ['seg-heatmap'], queryFn: fetchSegmentHeatmap, staleTime: Infinity });

  const maxCount = segments[0]?.count ?? 1;

  const SEGMENT_COLORS = ['#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#F97316'];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Users size={20} color="var(--accent-primary)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Population Intelligence
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Segment populations by pipeline dimension — approval rates, decline drivers, and funnel drop-off
          </p>
        </div>
      </div>

      {/* Dimension selector */}
      <div style={{ display: 'flex', gap: 6 }}>
        {DIMENSIONS.map(d => (
          <button
            key={d.key}
            onClick={() => setDimension(d.key)}
            style={{
              padding: '6px 14px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${dimension === d.key ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
              background: dimension === d.key ? 'rgba(0,180,216,0.1)' : 'transparent',
              color: dimension === d.key ? 'var(--accent-primary)' : 'var(--text-muted)',
              fontSize: 12, transition: 'all 0.15s',
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Segment breakdown */}
        <HarnessCard title={`Segments by ${DIMENSIONS.find(d => d.key === dimension)?.label}`} subtitle="Population share and approval rates">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {segments.map((seg, i) => {
              const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
              return (
                <div key={seg.segment} style={{ padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color, fontWeight: 600 }}>{seg.segment}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                        {seg.count.toLocaleString()} transactions · {seg.pct_of_all}% of volume
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700, color: seg.approval_rate > 60 ? 'var(--status-pass)' : seg.approval_rate > 30 ? 'var(--status-warn)' : 'var(--status-fail)' }}>
                        {seg.approval_rate}%
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>approval rate</div>
                    </div>
                  </div>
                  {/* Stacked bar */}
                  <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ height: '100%', width: `${seg.approval_rate}%`, background: 'var(--status-pass)', transition: 'width 0.4s' }} />
                    <div style={{ height: '100%', width: `${seg.decline_rate}%`, background: 'var(--status-fail)', transition: 'width 0.4s' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
                    <span style={{ fontSize: 10, color: 'var(--status-pass)' }}>✓ {seg.verified.toLocaleString()}</span>
                    <span style={{ fontSize: 10, color: 'var(--status-fail)' }}>✗ {seg.not_verified.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </HarnessCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Funnel */}
          <HarnessCard title="Decline Funnel" subtitle="Drop-off at each pipeline stage">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {funnel.map((stage, i) => {
                const maxFunnelCount = funnel[0]?.count ?? 1;
                return (
                  <div key={stage.stage} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 140, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right', flexShrink: 0 }}>{stage.stage}</div>
                    <div style={{ flex: 1, height: 20, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        height: '100%',
                        width: `${(stage.count / maxFunnelCount) * 100}%`,
                        background: stage.type === 'outcome' ? 'var(--status-pass)'
                          : stage.type === 'entry' ? 'var(--accent-primary)'
                          : 'var(--status-fail)',
                        borderRadius: 3, transition: 'width 0.4s', display: 'flex', alignItems: 'center', paddingLeft: 6,
                      }}>
                        <span style={{ fontSize: 9, color: '#fff', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                          {stage.count.toLocaleString()} ({stage.pct}%)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </HarnessCard>

          {/* Heatmap */}
          {heatmap && (
            <HarnessCard title="Approval Rate Heatmap" subtitle="GSA Result × Doc Result">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 9, color: 'var(--text-muted)' }}>GSA \ Doc</th>
                      {heatmap.cols.map((col: string) => (
                        <th key={col} style={{ padding: '6px 8px', textAlign: 'center', fontSize: 9, color: 'var(--text-muted)', maxWidth: 100 }}>
                          {col.replace('IDENTITY_DOCUMENT_', '').slice(0, 12)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.rows.map((row: string) => (
                      <tr key={row}>
                        <td style={{ padding: '6px 8px', fontSize: 10, color: 'var(--text-muted)' }}>{row.replace('ADDRESS_', '').slice(0, 16)}</td>
                        {heatmap.cols.map((col: string) => {
                          const cell = heatmap.cells.find((c: any) => c.row === row && c.col === col);
                          const rate = cell?.approval_rate ?? 0;
                          const bg = rate > 70 ? 'rgba(74,222,128,0.15)' : rate > 30 ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)';
                          const textColor = rate > 70 ? 'var(--status-pass)' : rate > 30 ? 'var(--status-warn)' : 'var(--status-fail)';
                          return (
                            <td key={col} style={{ padding: '8px', textAlign: 'center', background: bg, borderRadius: 4 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: textColor }}>{rate}%</div>
                              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>n={cell?.count ?? 0}</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </HarnessCard>
          )}
        </div>
      </div>

      {/* Treemap */}
      <HarnessCard title="Population Treemap" subtitle="GSA Result → Final Outcome distribution">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {treemap.map((node, i) => {
            const TMAP_COLORS = ['#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'];
            const color = TMAP_COLORS[i % TMAP_COLORS.length];
            const width = Math.max(node.pct * 3, 60);
            return (
              <div key={node.id} style={{ width, minWidth: 80, padding: '12px 10px', background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color, fontWeight: 600, marginBottom: 4 }}>{node.label.replace('ADDRESS_', '').slice(0, 14)}</div>
                <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-secondary)' }}>{node.pct}%</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{node.value.toLocaleString()} tx</div>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {node.children.map((child: any) => (
                    <div key={child.id} style={{ fontSize: 9, color: child.verified ? 'var(--status-pass)' : 'var(--status-fail)' }}>
                      {child.verified ? '✓' : '✗'} {child.pct}%
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </HarnessCard>
    </div>
  );
}
