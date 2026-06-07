import { useState, useMemo } from 'react';
import { db } from '@/lib/db';
import { computeFeatureImportance } from '@/api/rules';
import { runSimulation } from '@/api/simulation';
import { HarnessCard } from '@/design-system/components/HarnessCard';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import { FileSearch, Upload, RotateCcw, TrendingDown, TrendingUp, ChevronRight, CircleAlert as AlertCircle } from 'lucide-react';

interface ParsedTransaction {
  id:           string;
  cmra_flag:    boolean;
  pbsa_flag:    boolean;
  pobox_flag:   boolean;
  comm_error:   boolean;
  fault_code:   string | null;
  doc_result:   string;
  face_result:  string | null;
  gsa_result:   string | null;
  pdma_result:  string | null;
  risk_result:  string | null;
  final_result: string;
  rules_fired:  string[];
  event_date:   string;
}

interface RuleTrace {
  rule:     string;
  label:    string;
  fired:    boolean;
  is_stop:  boolean;
  reason:   string;
}

const RULE_LABELS: Record<string, string> = {
  'Rule 0': 'Rule 0 — Clean (→ PDMA)',
  'Rule 1': 'Rule 1 — KOEC0647 (missing #)',
  'Rule 2': 'Rule 2 — KOEC0692 (not USPS)',
  'Rule 3': 'Rule 3 — KOEC0039+X',
  'Rule 5': 'Rule 5 — KOEC0039 (non-X)',
  'Rule 6': 'Rule 6 — GSA Comm Error',
  'Rule 7': 'Rule 7 — CMRA=Y',
  'Rule 8': 'Rule 8 — PBSA=Y',
  'Rule 9': 'Rule 9 — POBox=P',
};

const HARD_STOPS = new Set(['Rule 3', 'Rule 6', 'Rule 7', 'Rule 8', 'Rule 9']);

const SAMPLE_JSON = JSON.stringify({
  id: 'TXN-001234',
  event_date: '2025-12-01',
  doc_result: 'IDENTITY_DOCUMENT_VALIDATED',
  face_result: 'VALIDATED',
  cmra_flag: true,
  pbsa_flag: false,
  pobox_flag: false,
  comm_error: false,
  fault_code: null,
  gsa_result: 'ADDRESS_NOT_CIP_COMPLIANT',
  pdma_result: null,
  risk_result: null,
  final_result: 'IDENTITY_NOT_VERIFIED',
  rules_fired: ['Rule 7'],
}, null, 2);

function evaluateRuleTrace(tx: ParsedTransaction): RuleTrace[] {
  const traces: RuleTrace[] = [];
  const rf = new Set(tx.rules_fired);

  traces.push({ rule: 'Rule 7', label: RULE_LABELS['Rule 7'], fired: tx.cmra_flag, is_stop: true, reason: tx.cmra_flag ? 'cmra_flag = true → HARD STOP' : 'cmra_flag = false → skip' });
  traces.push({ rule: 'Rule 8', label: RULE_LABELS['Rule 8'], fired: tx.pbsa_flag, is_stop: true, reason: tx.pbsa_flag ? 'pbsa_flag = true → HARD STOP' : 'pbsa_flag = false → skip' });
  traces.push({ rule: 'Rule 9', label: RULE_LABELS['Rule 9'], fired: tx.pobox_flag, is_stop: true, reason: tx.pobox_flag ? 'pobox_flag = true → HARD STOP' : 'pobox_flag = false → skip' });
  traces.push({ rule: 'Rule 6', label: RULE_LABELS['Rule 6'], fired: tx.comm_error, is_stop: true, reason: tx.comm_error ? 'comm_error = true → HARD STOP' : 'comm_error = false → skip' });

  const isKOEC0039 = tx.fault_code === 'KOEC0039';
  const subCodeX = isKOEC0039 && rf.has('Rule 3');
  traces.push({ rule: 'Rule 3', label: RULE_LABELS['Rule 3'], fired: subCodeX, is_stop: true, reason: subCodeX ? 'fault_code = KOEC0039 + sub-code X → HARD STOP' : 'condition not met → skip' });
  traces.push({ rule: 'Rule 5', label: RULE_LABELS['Rule 5'], fired: isKOEC0039 && !subCodeX, is_stop: false, reason: isKOEC0039 && !subCodeX ? 'fault_code = KOEC0039 (non-X sub-code) → continue to PDMA' : 'condition not met → skip' });
  traces.push({ rule: 'Rule 1', label: RULE_LABELS['Rule 1'], fired: tx.fault_code === 'KOEC0647', is_stop: false, reason: tx.fault_code === 'KOEC0647' ? 'fault_code = KOEC0647 (missing #) → soft flag' : 'condition not met → skip' });
  traces.push({ rule: 'Rule 2', label: RULE_LABELS['Rule 2'], fired: tx.fault_code === 'KOEC0692', is_stop: false, reason: tx.fault_code === 'KOEC0692' ? 'fault_code = KOEC0692 (non-USPS) → soft flag' : 'condition not met → skip' });
  traces.push({ rule: 'Rule 0', label: RULE_LABELS['Rule 0'], fired: rf.has('Rule 0') || (!tx.cmra_flag && !tx.pbsa_flag && !tx.pobox_flag && !tx.comm_error && !tx.fault_code), is_stop: false, reason: 'No GSA flags → clean path, proceed to PDMA' });

  return traces;
}

function computeSHAP(tx: ParsedTransaction) {
  const allTxs = db.transactions;
  const baseRate = allTxs.filter(t => t.final_result === 'IDENTITY_VERIFIED').length / allTxs.length;

  const features = [
    { label: 'cmra_flag',    value: tx.cmra_flag,   group: (ts: typeof allTxs[0]) => ts.cmra_flag === tx.cmra_flag },
    { label: 'pbsa_flag',    value: tx.pbsa_flag,   group: (ts: typeof allTxs[0]) => ts.pbsa_flag === tx.pbsa_flag },
    { label: 'pobox_flag',   value: tx.pobox_flag,  group: (ts: typeof allTxs[0]) => ts.pobox_flag === tx.pobox_flag },
    { label: 'comm_error',   value: tx.comm_error,  group: (ts: typeof allTxs[0]) => ts.comm_error === tx.comm_error },
    { label: 'fault_code',   value: tx.fault_code,  group: (ts: typeof allTxs[0]) => ts.fault_code === tx.fault_code },
    { label: 'doc_result',   value: tx.doc_result,  group: (ts: typeof allTxs[0]) => ts.doc_result === tx.doc_result },
    { label: 'face_result',  value: tx.face_result, group: (ts: typeof allTxs[0]) => ts.face_result === tx.face_result },
  ];

  return features.map(f => {
    const subset = allTxs.filter(f.group as any);
    const rate = subset.length > 0 ? subset.filter(t => t.final_result === 'IDENTITY_VERIFIED').length / subset.length : baseRate;
    const shap = rate - baseRate;
    return {
      label:     f.label,
      value:     f.value === null ? 'null' : String(f.value),
      shap:      parseFloat(shap.toFixed(4)),
      abs_shap:  Math.abs(shap),
      direction: shap >= 0 ? 'positive' : 'negative',
      n:         subset.length,
    };
  }).sort((a, b) => b.abs_shap - a.abs_shap);
}

export function RequestAnalyzer() {
  const [jsonInput, setJsonInput] = useState('');
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const ruleTrace = useMemo(() => (parsed ? evaluateRuleTrace(parsed) : []), [parsed]);
  const shapValues = useMemo(() => (parsed ? computeSHAP(parsed) : []), [parsed]);

  const whatIfSim = useMemo(() => {
    if (!parsed) return null;
    return runSimulation({ rule_7_cmra_continue: true, rule_8_pbsa_continue: true, rule_9_pobox_continue: true });
  }, [parsed]);

  function loadSample() {
    setJsonInput(SAMPLE_JSON);
    setParseError(null);
  }

  function analyze() {
    try {
      const obj = JSON.parse(jsonInput);
      const tx: ParsedTransaction = {
        id:           obj.id ?? crypto.randomUUID(),
        event_date:   obj.event_date ?? new Date().toISOString().split('T')[0],
        doc_result:   obj.doc_result ?? 'IDENTITY_DOCUMENT_VALIDATED',
        face_result:  obj.face_result ?? null,
        cmra_flag:    Boolean(obj.cmra_flag),
        pbsa_flag:    Boolean(obj.pbsa_flag),
        pobox_flag:   Boolean(obj.pobox_flag),
        comm_error:   Boolean(obj.comm_error),
        fault_code:   obj.fault_code ?? null,
        gsa_result:   obj.gsa_result ?? null,
        pdma_result:  obj.pdma_result ?? null,
        risk_result:  obj.risk_result ?? null,
        final_result: obj.final_result ?? 'IDENTITY_NOT_VERIFIED',
        rules_fired:  Array.isArray(obj.rules_fired) ? obj.rules_fired : [],
      };
      setParsed(tx);
      setParseError(null);
    } catch (e) {
      setParseError(`JSON parse error: ${(e as Error).message}`);
      setParsed(null);
    }
  }

  function reset() {
    setJsonInput('');
    setParsed(null);
    setParseError(null);
  }

  const maxShap = shapValues[0]?.abs_shap ?? 1;
  const firedStops = ruleTrace.filter(r => r.fired && r.is_stop);
  const isVerified = parsed?.final_result === 'IDENTITY_VERIFIED';

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <FileSearch size={20} color="var(--accent-primary)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Request / Response Analyzer
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
            Paste IDPF transaction JSON — rule trace · SHAP waterfall · what-if quick analysis
          </p>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-primary)', background: 'rgba(0,180,216,0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(0,180,216,0.2)' }}>
          Rule Trace + SHAP
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px' }}>
        {/* JSON input panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <HarnessCard title="Transaction JSON" subtitle="Paste or load a sample">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <button onClick={loadSample} style={{ flex: 1, padding: '7px 12px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                <Upload size={12} /> Load Sample
              </button>
              <button onClick={reset} style={{ padding: '7px 12px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <RotateCcw size={12} /> Reset
              </button>
            </div>
            <textarea
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
              placeholder={'{\n  "cmra_flag": true,\n  "pbsa_flag": false,\n  "final_result": "IDENTITY_NOT_VERIFIED",\n  "rules_fired": ["Rule 7"],\n  ...\n}'}
              style={{
                width: '100%',
                height: '320px',
                background: 'var(--bg-base)',
                border: `1px solid ${parseError ? 'var(--status-fail)' : 'var(--border-subtle)'}`,
                borderRadius: '8px',
                padding: '12px',
                color: 'var(--text-primary)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                resize: 'vertical',
                outline: 'none',
                lineHeight: 1.6,
                boxSizing: 'border-box',
              }}
            />
            {parseError && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
                <AlertCircle size={12} color="var(--status-fail)" />
                <span style={{ fontSize: '11px', color: 'var(--status-fail)', fontFamily: 'var(--font-mono)' }}>{parseError}</span>
              </div>
            )}
            <button
              onClick={analyze}
              disabled={!jsonInput.trim()}
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '10px',
                background: jsonInput.trim() ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: jsonInput.trim() ? '#0B0F1A' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '8px',
                cursor: jsonInput.trim() ? 'pointer' : 'not-allowed',
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              <FileSearch size={15} /> Analyze Transaction
            </button>
          </HarnessCard>
        </div>

        {/* Analysis results */}
        {!parsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '12px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px dashed var(--border-subtle)' }}>
            <FileSearch size={40} color="var(--text-muted)" strokeWidth={1} />
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Paste a transaction JSON and click Analyze</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: 0 }}>Or load the sample to see a CMRA decline trace</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Outcome banner */}
            <div style={{
              padding: '16px 20px',
              background: isVerified ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
              border: `1px solid ${isVerified ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
              borderRadius: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                  {parsed.id} · {parsed.event_date}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-display)', color: isVerified ? 'var(--status-pass)' : 'var(--status-fail)' }}>
                  {parsed.final_result}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {firedStops.map(r => <StatusBadge key={r.rule} status="fail" label={r.rule} />)}
                {firedStops.length === 0 && <StatusBadge status="pass" label="No Hard Stops" />}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Rule Trace */}
              <HarnessCard title="Rule Trace" subtitle="Evaluation order: Rules 7→8→9→6→3→5→1→2→0">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {ruleTrace.map(r => (
                    <div key={r.rule} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '10px',
                      padding: '8px 10px',
                      background: r.fired ? (r.is_stop ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.06)') : 'transparent',
                      border: `1px solid ${r.fired ? (r.is_stop ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)') : 'var(--border-subtle)'}`,
                      borderRadius: '6px',
                      opacity: r.fired ? 1 : 0.5,
                    }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.fired ? (r.is_stop ? 'var(--status-fail)' : 'var(--status-pass)') : 'var(--text-muted)', flexShrink: 0, marginTop: '4px' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: r.fired ? (r.is_stop ? 'var(--status-fail)' : 'var(--status-pass)') : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {r.rule} {r.is_stop && r.fired ? '— HARD STOP' : ''}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{r.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </HarnessCard>

              {/* SHAP waterfall */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <HarnessCard title="SHAP Waterfall" subtitle="Feature contribution to P(verified)">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {shapValues.map(f => (
                      <div key={f.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            {f.label}={f.value}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {f.direction === 'negative'
                              ? <TrendingDown size={10} color="var(--status-fail)" />
                              : <TrendingUp size={10} color="var(--status-pass)" />}
                            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: f.direction === 'negative' ? 'var(--status-fail)' : 'var(--status-pass)' }}>
                              {f.shap > 0 ? '+' : ''}{(f.shap * 100).toFixed(1)}pp
                            </span>
                          </div>
                        </div>
                        <div style={{ height: '5px', background: 'var(--bg-base)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${(f.abs_shap / maxShap) * 100}%`,
                            background: f.direction === 'negative' ? 'var(--status-fail)' : 'var(--status-pass)',
                            borderRadius: '3px',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </HarnessCard>

                {/* What-if quick sim */}
                {whatIfSim && !isVerified && (
                  <HarnessCard title="What-If Quick View" subtitle="If hard-stop rules 7/8/9 route to PDMA" glow="accent">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {[
                        { label: 'Baseline Rate', value: `${whatIfSim.baseline_pass_rate.toFixed(1)}%`, color: 'var(--text-secondary)' },
                        { label: 'Simulated Rate', value: `${whatIfSim.simulated_pass_rate.toFixed(1)}%`, color: 'var(--status-pass)' },
                        { label: 'Delta', value: `${whatIfSim.delta > 0 ? '+' : ''}${whatIfSim.delta.toFixed(2)}pp`, color: 'var(--accent-primary)' },
                        { label: 'Recovered', value: `+${whatIfSim.delta_absolute.toLocaleString()}`, color: 'var(--accent-primary)' },
                      ].map(m => (
                        <div key={m.label} style={{ textAlign: 'center', padding: '8px', background: 'var(--bg-base)', borderRadius: '6px' }}>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '3px' }}>{m.label}</div>
                          <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: m.color, fontWeight: 600 }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ChevronRight size={10} /> Navigate to What-If Engine for full simulation controls
                    </div>
                  </HarnessCard>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
