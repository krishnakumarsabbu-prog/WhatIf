import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { explainTransaction, searchTransactions } from '@/api/intelligence';
import type { ExplainResult } from '@/api/intelligence';
import { HarnessCard } from '@/design-system/components/HarnessCard';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import { Search, FileSearch, TrendingDown, TrendingUp, GitBranch } from 'lucide-react';

const STEP_COLORS: Record<string, string> = {
  PASS: 'var(--status-pass)', FAIL: 'var(--status-fail)', WARN: 'var(--status-warn)',
  VERIFIED: 'var(--status-pass)', NOT_VERIFIED: 'var(--status-fail)', SKIPPED: 'var(--text-muted)',
};

export function ExplainDecline() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const searchMutation = useMutation({
    mutationFn: (q: string) => searchTransactions(q),
    onSuccess: (data) => setSearchResults(data),
  });

  const explainMutation = useMutation({
    mutationFn: (id: string) => explainTransaction(id),
  });

  function handleSearch() {
    if (!query.trim()) return;
    searchMutation.mutate(query.trim());
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    explainMutation.mutate(id);
    setSearchResults([]);
  }

  const result: ExplainResult | undefined = explainMutation.data;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <FileSearch size={20} color="var(--accent-primary)" />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Explain My Decline
          </h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
          Search any transaction ID — full journey reconstruction, contributing rules, SHAP explanation, and counterfactual outcome
        </p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search by Transaction ID (e.g. TX00042)"
              style={{
                width: '100%', padding: '10px 12px 10px 34px',
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
                fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={!query.trim() || searchMutation.isPending}
            style={{
              padding: '10px 20px', background: 'var(--accent-primary)', border: 'none', borderRadius: 8,
              color: '#0B0F1A', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Search size={14} /> Search
          </button>
        </div>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 50, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, zIndex: 10, marginTop: 4, maxHeight: 300, overflowY: 'auto' }}>
            {searchResults.map(tx => (
              <button
                key={tx.id}
                onClick={() => handleSelect(tx.id)}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent-primary)' }}>{tx.id}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 10 }}>{tx.date}</span>
                </div>
                <StatusBadge status={tx.result === 'IDENTITY_VERIFIED' ? 'pass' : 'fail'} label={tx.result === 'IDENTITY_VERIFIED' ? 'VERIFIED' : 'NOT VERIFIED'} size="sm" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {explainMutation.isPending && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 8 }} />)}
        </div>
      )}

      {/* Result */}
      {result && !explainMutation.isPending && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Outcome banner */}
          <div style={{
            padding: '16px 20px',
            background: result.is_verified ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
            border: `1px solid ${result.is_verified ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
            borderRadius: 10,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                {result.transaction.id} · {result.transaction.event_date}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)', color: result.is_verified ? 'var(--status-pass)' : 'var(--status-fail)' }}>
                {result.transaction.final_result}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{result.primary_reason}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {result.rules_fired.map(r => <StatusBadge key={r} status={result.contributing.find(c => c.rule === r && c.is_stop) ? 'fail' : 'warn'} label={r} />)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Journey */}
            <HarnessCard title="Decision Journey" subtitle="Complete pipeline reconstruction">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {result.journey.map((step, i) => {
                  const color = STEP_COLORS[step.status] ?? 'var(--text-muted)';
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: i < result.journey.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: `2px solid ${color}`, marginTop: 3 }} />
                        {i < result.journey.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border-subtle)', marginTop: 2 }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{step.step}</span>
                          <StatusBadge status={step.status === 'PASS' || step.status === 'VERIFIED' ? 'pass' : step.status === 'WARN' || step.status === 'SKIPPED' ? 'warn' : 'fail'} label={step.status} size="sm" />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{step.detail}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </HarnessCard>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* SHAP */}
              <HarnessCard title="SHAP Feature Contributions" subtitle="Δ from baseline approval probability">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.shap.slice(0, 7).map(f => (
                    <div key={f.feature}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{f.feature}={f.value}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {f.direction === 'negative' ? <TrendingDown size={10} color="var(--status-fail)" /> : <TrendingUp size={10} color="var(--status-pass)" />}
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: f.direction === 'negative' ? 'var(--status-fail)' : 'var(--status-pass)' }}>
                            {f.shap > 0 ? '+' : ''}{(f.shap * 100).toFixed(1)}pp
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg-base)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(f.abs_shap / (result.shap[0]?.abs_shap ?? 1)) * 100}%`, background: f.direction === 'negative' ? 'var(--status-fail)' : 'var(--status-pass)', borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </HarnessCard>

              {/* Counterfactual */}
              {result.counterfactual && (
                <HarnessCard title="Counterfactual Analysis" subtitle="What if hard stops were bypassed?" glow={result.counterfactual.would_verify ? 'pass' : 'none'}>
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', color: result.counterfactual.would_verify ? 'var(--status-pass)' : 'var(--status-fail)' }}>
                      {result.counterfactual.outcome}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                      Probability: {(result.counterfactual.probability * 100).toFixed(0)}%
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {result.counterfactual.reason}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                      {result.counterfactual.rules_bypassed.map(r => <StatusBadge key={r} status="info" label={`${r} bypassed`} size="sm" />)}
                    </div>
                  </div>
                </HarnessCard>
              )}
            </div>
          </div>
        </div>
      )}

      {!result && !explainMutation.isPending && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '60px 0', background: 'var(--bg-surface)', borderRadius: 12, border: '1px dashed var(--border-subtle)' }}>
          <GitBranch size={40} color="var(--text-muted)" strokeWidth={1} />
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Search for a Transaction ID to see full journey reconstruction</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>Try: TX00042, TX00123, TX00500, TX01000</p>
        </div>
      )}
    </div>
  );
}
