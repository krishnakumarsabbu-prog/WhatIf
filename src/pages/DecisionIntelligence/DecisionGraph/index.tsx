import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchDecisionGraph, fetchPageRank, fetchBetweenness,
  fetchCommunities, fetchCriticalPaths,
} from '@/api/intelligence';
import { HarnessCard } from '@/design-system/components/HarnessCard';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import { GitBranch, ChartBar as BarChart3, Network, TriangleAlert as AlertTriangle, ChevronRight } from 'lucide-react';

const NODE_COLORS: Record<string, string> = {
  entry:    '#0EA5E9',
  service:  '#10B981',
  rule:     '#F59E0B',
  logic:    '#8B5CF6',
  terminal: '#64748B',
};

const CATEGORY_COLORS: Record<string, string> = {
  outcome:     '#64748B',
  address:     '#F59E0B',
  identity:    '#10B981',
  biometric:   '#06B6D4',
  compliance:  '#3B82F6',
  risk:        '#EF4444',
  'post-process': '#8B5CF6',
  ingestion:   '#0EA5E9',
  reliability: '#F97316',
  fault:       '#DC2626',
};

function NodeCard({ node }: { node: any }) {
  const color = CATEGORY_COLORS[node.category] ?? '#64748B';
  return (
    <div style={{
      padding: '10px 12px',
      background: 'var(--bg-base)',
      borderRadius: 8,
      border: `1px solid ${color}30`,
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{node.label}</div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 1 }}>{node.id}</div>
        </div>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color, background: `${color}15`, padding: '2px 6px', borderRadius: 3 }}>
          {node.category}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{node.volume.toLocaleString()}</span> transactions
        </div>
        <div style={{ fontSize: 10, color: 'var(--status-pass)' }}>✓ {node.success_rate}%</div>
        <div style={{ fontSize: 10, color: 'var(--status-fail)' }}>✗ {node.failure_rate}%</div>
      </div>
      <div style={{ marginTop: 6, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${node.success_rate}%`, background: `linear-gradient(90deg, ${color}, ${color}88)`, borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

export function DecisionGraph() {
  const [activeTab, setActiveTab] = useState<'nodes' | 'pagerank' | 'betweenness' | 'communities' | 'paths'>('nodes');

  const { data: graph, isLoading } = useQuery({ queryKey: ['decision-graph'], queryFn: fetchDecisionGraph, staleTime: Infinity });
  const { data: pagerank = [] } = useQuery({ queryKey: ['pagerank'], queryFn: fetchPageRank, staleTime: Infinity });
  const { data: betweenness = [] } = useQuery({ queryKey: ['betweenness'], queryFn: fetchBetweenness, staleTime: Infinity });
  const { data: communities = [] } = useQuery({ queryKey: ['communities'], queryFn: fetchCommunities, staleTime: Infinity });
  const { data: criticalPaths = [] } = useQuery({ queryKey: ['critical-paths'], queryFn: fetchCriticalPaths, staleTime: Infinity });

  const tabs = [
    { id: 'nodes',       label: 'Pipeline Nodes',  icon: Network },
    { id: 'pagerank',    label: 'PageRank',         icon: BarChart3 },
    { id: 'betweenness', label: 'Betweenness',      icon: BarChart3 },
    { id: 'communities', label: 'Communities',      icon: GitBranch },
    { id: 'paths',       label: 'Critical Paths',   icon: AlertTriangle },
  ] as const;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <GitBranch size={20} color="var(--accent-primary)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Decision Graph Engine
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            IDPF pipeline topology · PageRank influence · Betweenness centrality · Community detection · Critical paths
          </p>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-primary)', background: 'rgba(0,180,216,0.1)', padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(0,180,216,0.2)' }}>
          Pure Python Graph Engine
        </span>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', borderRadius: 8, padding: 4, border: '1px solid var(--border-subtle)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '7px 8px', borderRadius: 6, cursor: 'pointer', border: 'none',
              background: activeTab === tab.id ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
              fontSize: 11, fontFamily: 'var(--font-body)', transition: 'all 0.15s',
            }}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Nodes Tab */}
      {activeTab === 'nodes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Edge flow summary */}
          <HarnessCard title="Pipeline Flow" subtitle={`${graph?.edges.length ?? 0} edges · ${graph?.nodes.length ?? 0} nodes`}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                <span key={cat} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color, background: `${color}15`, padding: '2px 8px', borderRadius: 10, border: `1px solid ${color}30` }}>
                  {cat}
                </span>
              ))}
            </div>
            {/* Linear pipeline visualization */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto', padding: '8px 0' }}>
              {['REQUEST_IN', 'DOC_VERIFY', 'FACE_SCAN', 'GSA_CHECK', 'PDMA_CHECK', 'RISK_EVAL', 'POPULATE_RESULT', 'VERIFIED'].map((nodeId, idx) => {
                const node = graph?.nodes.find(n => n.id === nodeId);
                const color = node ? (CATEGORY_COLORS[node.category] ?? '#64748B') : '#64748B';
                return (
                  <div key={nodeId} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <div style={{ padding: '6px 10px', background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 6, textAlign: 'center', minWidth: 90 }}>
                      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color, marginBottom: 2 }}>{nodeId}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{node?.volume.toLocaleString() ?? '—'}</div>
                      <div style={{ fontSize: 9, color: 'var(--status-pass)' }}>{node?.success_rate ?? 0}% ✓</div>
                    </div>
                    {idx < 7 && <ChevronRight size={12} color="var(--text-muted)" />}
                  </div>
                );
              })}
            </div>
          </HarnessCard>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {(graph?.nodes ?? []).filter(n => n.volume > 0).map(node => (
              <NodeCard key={node.id} node={node} />
            ))}
          </div>
        </div>
      )}

      {/* PageRank Tab */}
      {activeTab === 'pagerank' && (
        <HarnessCard title="PageRank — Node Influence" subtitle="Higher score = more influential in the decision pipeline">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            PageRank identifies the most influential nodes. Nodes with high PageRank sit at critical junctions of the decision pipeline where failures cascade.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pagerank.slice(0, 12).map((item, i) => (
              <div key={item.node_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 20, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>#{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: i < 3 ? 600 : 400 }}>{item.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-primary)' }}>{item.score.toFixed(4)}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${item.score * 100}%`, background: `linear-gradient(90deg, var(--accent-primary), #0EA5E9)`, borderRadius: 3, transition: 'width 0.4s' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </HarnessCard>
      )}

      {/* Betweenness Tab */}
      {activeTab === 'betweenness' && (
        <HarnessCard title="Betweenness Centrality — Decision Bottlenecks" subtitle="Nodes that most transactions must pass through">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            High betweenness = bottleneck. If these nodes fail or are blocked, they cut off large portions of the pipeline.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {betweenness.slice(0, 12).map((item, i) => (
              <div key={item.node_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 20, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>#{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: i < 3 ? 600 : 400 }}>{item.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#F59E0B' }}>{item.score.toFixed(4)}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${item.score * 100}%`, background: 'linear-gradient(90deg, #F59E0B, #FBBF24)', borderRadius: 3, transition: 'width 0.4s' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </HarnessCard>
      )}

      {/* Communities Tab */}
      {activeTab === 'communities' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {communities.map((comm, i) => {
            const clusterColors = ['#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];
            const color = clusterColors[i % clusterColors.length];
            return (
              <HarnessCard key={comm.community_id} title={`Cluster ${comm.community_id + 1}`} subtitle={`${comm.size} nodes · ${comm.total_failures.toLocaleString()} failures`}>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Member Nodes</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {comm.member_labels.map((lbl: string) => (
                      <span key={lbl} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color, background: `${color}15`, padding: '2px 6px', borderRadius: 3 }}>{lbl}</span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{comm.description}</div>
                {comm.total_failures > 0 && (
                  <div style={{ marginTop: 8, fontSize: 10, color: 'var(--status-fail)' }}>
                    {comm.total_failures.toLocaleString()} total failures in this cluster
                  </div>
                )}
              </HarnessCard>
            );
          })}
        </div>
      )}

      {/* Critical Paths Tab */}
      {activeTab === 'paths' && (
        <HarnessCard title="Critical Failure Paths" subtitle="Decision paths generating highest rejection volume">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {criticalPaths.map((p, i) => (
              <div key={i} style={{
                padding: '10px 14px',
                background: p.failure_rate > 80 ? 'rgba(248,113,113,0.06)' : 'var(--bg-base)',
                border: `1px solid ${p.failure_rate > 80 ? 'rgba(248,113,113,0.2)' : 'var(--border-subtle)'}`,
                borderRadius: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{p.path}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Failures</div>
                      <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--status-fail)', fontWeight: 700 }}>{p.failures.toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Fail Rate</div>
                      <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: p.failure_rate > 80 ? 'var(--status-fail)' : 'var(--status-warn)', fontWeight: 700 }}>{p.failure_rate}%</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>% of All Fails</div>
                      <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 700 }}>{p.pct_of_all_failures}%</div>
                    </div>
                  </div>
                </div>
                <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.pct_of_all_failures}%`, background: 'var(--status-fail)', borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </HarnessCard>
      )}
    </div>
  );
}
