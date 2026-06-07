import { useQuery } from '@tanstack/react-query';
import { fetchSankeyData } from '@/api/analytics';
import { HarnessCard, AlgorithmBadge } from '@/design-system/components';
import { SankeyDiagram } from './SankeyDiagram';

const NODE_LABELS: Record<string, string> = {
  'DOC VERIFY':    'Document Verification',
  'FACE SCAN':     'Face Scan / Selfie',
  'GSA CHECK':     'GSA Address Check',
  'PDMA CHECK':    'PDMA Risk Evaluation',
  'RISK EVAL':     'SPS Risk Evaluation',
  'VERIFIED':      'Identity Verified',
  'NOT VERIFIED':  'Identity Not Verified',
};

export function SankeyJourney() {
  const { data, isLoading } = useQuery({
    queryKey: ['sankey'],
    queryFn: fetchSankeyData,
    refetchInterval: 60_000,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fade-in 0.4s ease forwards' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22, fontWeight: 700,
            color: '#E2E8F0', marginBottom: 4,
          }}>
            Journey Analytics
          </h1>
          <p style={{ fontSize: 12, color: 'var(--status-neutral)' }}>
            Customer flow through the 7-node IDPF orchestration pipeline — volume, pass rates &amp; drop-offs
          </p>
        </div>
        <AlgorithmBadge name="DAG Path Mining" category="Graph" />
      </div>

      {/* Main Sankey diagram */}
      <HarnessCard
        title="Identity Verification Flow — All Transactions"
        subtitle="Hover nodes/links for details"
        style={{ minHeight: 540 }}
        noPad
      >
        {isLoading ? (
          <div className="skeleton" style={{ height: 480, margin: 20 }} />
        ) : (
          <div style={{ padding: '16px 0 8px' }}>
            <SankeyDiagram data={data!} />
          </div>
        )}
      </HarnessCard>

      {/* Node Metrics Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <HarnessCard title="Node Pass-Rate Metrics">
          {isLoading ? (
            <div className="skeleton" style={{ height: 160 }} />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Service Node', 'Volume', 'Pass Rate', 'Status'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '6px 8px',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: 10,
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--border-bright)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.nodes ?? [])
                  .filter(n => n.total > 0)
                  .map(node => {
                    const color = node.pass_rate >= 80 ? 'var(--status-pass)'
                      : node.pass_rate >= 60 ? 'var(--status-warn)'
                      : 'var(--status-fail)';
                    return (
                      <tr key={node.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '8px', color: '#CBD5E1' }}>
                          {NODE_LABELS[node.name] ?? node.name}
                        </td>
                        <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: 'var(--status-neutral)' }}>
                          {node.total.toLocaleString()}
                        </td>
                        <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color }}>
                          {node.pass_rate.toFixed(1)}%
                        </td>
                        <td style={{ padding: '8px' }}>
                          <span style={{
                            display: 'inline-block',
                            width: 60, height: 4,
                            background: `linear-gradient(90deg, ${color} ${node.pass_rate}%, var(--bg-elevated) ${node.pass_rate}%)`,
                            borderRadius: 2,
                          }} />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </HarnessCard>

        <HarnessCard title="GSA Exit Path Analysis">
          {isLoading ? (
            <div className="skeleton" style={{ height: 160 }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'CMRA=Y → Hard Stop',          pct: 13, color: '#F87171', rule: 'Rule 7' },
                { label: 'PBSA=Y → Hard Stop',          pct: 10, color: '#FB923C', rule: 'Rule 8' },
                { label: 'POBox=P → Hard Stop',         pct: 8,  color: '#FBBF24', rule: 'Rule 9' },
                { label: 'KOEC0039 → Stop/Review',      pct: 5,  color: '#A78BFA', rule: 'Rule 3/5' },
                { label: 'Comm Error → Stop',           pct: 3,  color: '#94A3B8', rule: 'Rule 6' },
                { label: 'Clean → PDMA',                pct: 61, color: '#4ADE80', rule: 'Rule 0' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: '#CBD5E1' }}>{item.label}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: item.color }}>{item.pct}%</span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9,
                        padding: '1px 5px', borderRadius: 2,
                        background: 'rgba(42,63,95,0.6)', border: '1px solid var(--border-default)',
                        color: 'var(--status-neutral)',
                      }}>{item.rule}</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${item.pct}%`,
                      background: item.color, borderRadius: 2,
                      boxShadow: `0 0 6px ${item.color}60`,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </HarnessCard>
      </div>
    </div>
  );
}
