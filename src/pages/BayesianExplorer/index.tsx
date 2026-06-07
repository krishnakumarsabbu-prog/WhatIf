import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  queryPosterior,
  computeMutualInformation,
  computeCPT,
  type EvidenceMap,
  type PosteriorResult,
  type NodeName,
  NODE_LABELS,
} from '@/api/bayesian';
import { HarnessCard } from '@/design-system/components/HarnessCard';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import { BayesianGraph } from './BayesianGraph';
import { Network, Brain, Info, ChevronDown, RotateCcw, Table } from 'lucide-react';

const EVIDENCE_OPTIONS: Record<keyof EvidenceMap, { label: string; values: string[] }> = {
  DOC_VERIFY:        { label: 'Document Verify',  values: ['(any)', 'PASS', 'FAIL'] },
  FACE_SCAN:         { label: 'Face Scan',         values: ['(any)', 'PASS', 'FAIL'] },
  GSA_RESULT:        { label: 'GSA Result',        values: ['(any)', 'CLEAN', 'CMRA', 'PBSA', 'POBOX', 'ERROR', 'FAULT'] },
  PDMA_RESULT:       { label: 'PDMA Result',       values: ['(any)', 'COMPLIANT', 'NOT_COMPLIANT'] },
  RISK_RESULT:       { label: 'Risk Evaluation',   values: ['(any)', 'ALLOW', 'BLOCK'] },
  IDENTITY_VERIFIED: { label: 'ID Verified',       values: ['(any)', 'YES', 'NO'] },
};

const NODES_ORDER: NodeName[] = ['DOC_VERIFY', 'FACE_SCAN', 'GSA_RESULT', 'PDMA_RESULT', 'RISK_RESULT', 'IDENTITY_VERIFIED'];

const DEFAULT_POSTERIOR: PosteriorResult = {
  p_verified:     0,
  p_not_verified: 1,
  confidence:     'LOW',
  sample_size:    0,
  algorithm:      'loading…',
};

export function BayesianExplorer() {
  const [evidence, setEvidence] = useState<EvidenceMap>({});
  const [activeNode, setActiveNode] = useState<NodeName | null>(null);
  const [showCPT, setShowCPT] = useState(false);

  const { data: posterior = DEFAULT_POSTERIOR } = useQuery({
    queryKey: ['posterior', evidence],
    queryFn:  () => queryPosterior(evidence),
  });

  const { data: miScores = [] } = useQuery({
    queryKey: ['mi'],
    queryFn:  computeMutualInformation,
    staleTime: Infinity,
  });

  const { data: cptData } = useQuery({
    queryKey: ['cpt', activeNode],
    queryFn:  () => computeCPT(activeNode!),
    enabled:  !!activeNode,
  });

  // Build per-node pass probabilities for graph from posterior
  const nodeStates = NODES_ORDER.map(name => {
    const passProb =
      name === 'IDENTITY_VERIFIED' ? posterior.p_verified
      : name === 'RISK_RESULT'     ? Math.min(0.99, posterior.p_verified * 1.05)
      : name === 'PDMA_RESULT'     ? Math.min(0.99, posterior.p_verified * 1.12)
      : name === 'GSA_RESULT'      ? Math.min(0.99, posterior.p_verified * 1.2)
      : name === 'FACE_SCAN'       ? Math.min(0.99, posterior.p_verified * 1.15)
      :                              Math.min(0.99, posterior.p_verified * 1.3);
    return { name, p_pass: Math.min(0.99, Math.max(0.01, passProb)) };
  });

  function setEvidenceField(key: keyof EvidenceMap, val: string) {
    if (val === '(any)') {
      setEvidence(prev => { const n = { ...prev }; delete n[key]; return n; });
    } else {
      setEvidence(prev => ({ ...prev, [key]: val as any }));
    }
  }

  function resetEvidence() {
    setEvidence({});
    setActiveNode(null);
  }

  const confidenceStatus = posterior.confidence === 'HIGH' ? 'pass' : posterior.confidence === 'MEDIUM' ? 'warn' : 'fail';
  const maxMI = miScores[0]?.mi_score ?? 1;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <Network size={20} color="var(--accent-primary)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Bayesian Dependency Explorer
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
            Set evidence across service nodes — posterior probability updates via exact inference
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-primary)', background: 'rgba(0,180,216,0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(0,180,216,0.2)' }}>
            Bayesian Network • Exact Inference
          </span>
          <button
            onClick={resetEvidence}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
        {/* Evidence Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <HarnessCard title="Evidence Input" subtitle="Set observed node states">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(Object.entries(EVIDENCE_OPTIONS) as [keyof EvidenceMap, typeof EVIDENCE_OPTIONS[keyof EvidenceMap]][]).map(([key, opt]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                    {opt.label}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={(evidence[key] as string) ?? '(any)'}
                      onChange={e => setEvidenceField(key, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 28px 7px 10px',
                        background: 'var(--bg-base)',
                        border: `1px solid ${evidence[key] ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                        borderRadius: '6px',
                        color: evidence[key] ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        appearance: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {opt.values.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <ChevronDown size={12} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>
                </div>
              ))}
            </div>
          </HarnessCard>

          {/* Posterior Result */}
          <HarnessCard
            title="Posterior P(Verified)"
            glow={posterior.p_verified >= 0.7 ? 'pass' : posterior.p_verified >= 0.4 ? 'warn' : 'fail'}
          >
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{
                fontSize: '48px', fontWeight: 800,
                fontFamily: 'var(--font-display)',
                color: posterior.p_verified >= 0.7 ? 'var(--status-pass)' : posterior.p_verified >= 0.4 ? '#FCD34D' : 'var(--status-fail)',
                lineHeight: 1,
              }}>
                {(posterior.p_verified * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                P(NOT verified) = {(posterior.p_not_verified * 100).toFixed(1)}%
              </div>
              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <StatusBadge status={confidenceStatus} label={`${posterior.confidence} confidence`} />
                <StatusBadge status="info" label={`n=${posterior.sample_size}`} />
              </div>
              <div style={{ marginTop: '10px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {posterior.algorithm}
              </div>
            </div>
          </HarnessCard>
        </div>

        {/* Main area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Graph */}
          <HarnessCard
            title="Belief Network"
            subtitle="Click a node to inspect its CPT"
            action={
              <button
                onClick={() => setShowCPT(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', background: showCPT ? 'rgba(0,180,216,0.15)' : 'transparent', border: '1px solid var(--border-subtle)', color: showCPT ? 'var(--accent-primary)' : 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
              >
                <Table size={13} /> CPT
              </button>
            }
          >
            <BayesianGraph
              nodeStates={nodeStates}
              activeNode={activeNode}
              onNodeClick={node => setActiveNode(prev => prev === node ? null : node)}
            />
          </HarnessCard>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Mutual Information */}
            <HarnessCard
              title="Mutual Information Ranking"
              subtitle="MI(node; IDENTITY_VERIFIED)"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {miScores.map(mi => (
                  <div key={mi.node}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{mi.label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-primary)' }}>
                        {mi.mi_score.toFixed(4)}
                      </span>
                    </div>
                    <div style={{ height: '5px', background: 'var(--bg-base)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(mi.mi_score / maxMI) * 100}%`,
                        background: `linear-gradient(90deg, var(--accent-primary), #0EA5E9)`,
                        borderRadius: '3px',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </HarnessCard>

            {/* CPT Inspector */}
            {showCPT && activeNode && cptData ? (
              <HarnessCard
                title={`CPT — ${NODE_LABELS[activeNode]}`}
                subtitle={cptData.parents.length > 0 ? `Conditioned on: ${cptData.parents.join(', ')}` : 'Marginal distribution'}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Condition</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--status-pass)', fontWeight: 500 }}>P(Pass)</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--status-fail)', fontWeight: 500 }}>P(Fail)</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>n</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cptData.rows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{row.condition}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--status-pass)' }}>{(row.p_pass * 100).toFixed(1)}%</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--status-fail)' }}>{(row.p_fail * 100).toFixed(1)}%</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>{row.count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </HarnessCard>
            ) : (
              <HarnessCard title="CPT Inspector" subtitle="Click a graph node to inspect">
                <div style={{ height: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Brain size={32} color="var(--text-muted)" strokeWidth={1} />
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
                    {showCPT ? 'Select a node in the graph above' : 'Enable CPT view to inspect tables'}
                  </p>
                </div>
              </HarnessCard>
            )}
          </div>
        </div>
      </div>

      {/* Inference legend */}
      <div style={{ display: 'flex', gap: '20px', padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
        <Info size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '1px' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0, lineHeight: 1.6 }}>
          Inference uses exact enumeration over evidence-consistent transactions from the 1,500-sample in-memory dataset.
          Set multiple evidence nodes simultaneously to compute joint posterior probabilities.
          Confidence is HIGH when n ≥ 100, MEDIUM when n ≥ 20, LOW otherwise.
        </p>
      </div>
    </div>
  );
}
