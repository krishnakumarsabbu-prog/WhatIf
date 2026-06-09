import { useEffect, useState, useCallback, useRef } from 'react';
import { useSimulationStore } from '@/store/useSimulationStore';
import {
  runSensitivitySweep, getScenarioCards, getPipelineTrace,
  type RuleOverrides, type SensitivityPoint, type ScenarioCard,
  type PipelineTraceResult, type IDPFTrace,
  DEFAULT_OVERRIDES,
} from '@/api/simulation';
import { HarnessCard, AlgorithmBadge } from '@/design-system/components';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  Play, RotateCcw, Save, TrendingUp, ChevronDown, ChevronRight,
  FileCheck, Camera, MapPin, Building, ShieldAlert, Info,
  CheckCircle, XCircle, AlertTriangle, ArrowRight,
} from 'lucide-react';

// ── Toggle ────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      style={{
        width: 40, height: 22, borderRadius: 11, flexShrink: 0,
        background: checked ? 'var(--accent-primary)' : 'var(--bg-elevated)',
        border: `1px solid ${checked ? 'var(--accent-primary)' : 'var(--border-default)'}`,
        cursor: 'pointer', position: 'relative', transition: 'all 0.2s',
        boxShadow: checked ? 'var(--glow-accent)' : 'none',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, width: 14, height: 14,
        borderRadius: '50%', background: '#fff',
        left: checked ? 22 : 3, transition: 'left 0.2s',
      }} />
    </button>
  );
}

// ── Severity select ──────────────────────────────────────────────────────
function SeveritySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const colorMap: Record<string, string> = { PASS: '#4ADE80', WARN: '#FBBF24', STOP: '#F87171' };
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'var(--bg-elevated)', border: `1px solid ${colorMap[value] ?? 'var(--border-default)'}`,
        borderRadius: 4, color: colorMap[value] ?? '#CBD5E1', fontSize: 11,
        padding: '2px 8px', fontFamily: 'var(--font-mono)', cursor: 'pointer', fontWeight: 700,
      }}
    >
      <option value="PASS">PASS</option>
      <option value="WARN">WARN</option>
      <option value="STOP">STOP</option>
    </select>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────
function ToggleRow({ label, description, ruleKey, tag, tagColor, defaultOn, tightens }: {
  label: string; description: string; ruleKey: keyof RuleOverrides;
  tag?: string; tagColor?: string; defaultOn?: boolean; tightens?: boolean;
}) {
  const { overrides, setOverride } = useSimulationStore();
  const rawValue = overrides[ruleKey] ?? DEFAULT_OVERRIDES[ruleKey as keyof typeof DEFAULT_OVERRIDES];
  const checked = typeof rawValue === 'boolean' ? rawValue : false;
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div style={{ padding: '9px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, color: '#E2E8F0', fontWeight: 500, lineHeight: 1.3 }}>{label}</span>
          {tag && (
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)',
              background: `${tagColor ?? '#0EA5E9'}22`, color: tagColor ?? '#0EA5E9',
              border: `1px solid ${tagColor ?? '#0EA5E9'}44`, whiteSpace: 'nowrap', fontWeight: 700,
            }}>{tag}</span>
          )}
          {defaultOn && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', background: 'rgba(74,222,128,0.08)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.25)', whiteSpace: 'nowrap' }}>DEFAULT ON</span>}
          {tightens && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', background: 'rgba(248,113,113,0.08)', color: '#F87171', border: '1px solid rgba(248,113,113,0.25)', whiteSpace: 'nowrap' }}>TIGHTENS</span>}
          <button onClick={() => setShowInfo(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--border-bright)', flexShrink: 0 }}>
            <Info size={11} />
          </button>
        </div>
        <Toggle checked={checked} onChange={v => setOverride(ruleKey, v)} />
      </div>
      {showInfo && (
        <div style={{ fontSize: 11, color: 'var(--status-neutral)', lineHeight: 1.6, background: 'rgba(14,165,233,0.05)', borderRadius: 4, padding: '6px 10px', borderLeft: '2px solid var(--accent-primary)', marginTop: 4 }}>
          {description}
        </div>
      )}
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────
function Section({ icon: Icon, title, subtitle, stageNum, stageColor, children, defaultOpen = false }: {
  icon: React.ElementType; title: string; subtitle: string;
  stageNum: number; stageColor: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${open ? stageColor + '44' : 'var(--border-subtle)'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: open ? `${stageColor}0D` : 'var(--bg-panel)', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: `${stageColor}22`, border: `1px solid ${stageColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} color={stageColor} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: stageColor, fontWeight: 700 }}>STAGE {stageNum}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>{title}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--status-neutral)', marginTop: 1 }}>{subtitle}</div>
        </div>
        {open ? <ChevronDown size={14} color="var(--status-neutral)" /> : <ChevronRight size={14} color="var(--status-neutral)" />}
      </button>
      {open && <div style={{ padding: '4px 14px 12px', background: 'var(--bg-panel)' }}>{children}</div>}
    </div>
  );
}

// ── Pipeline stage indicator ──────────────────────────────────────────────
function PipelineBanner({ overrides }: { overrides: Partial<RuleOverrides> }) {
  const stages = [
    { label: 'Document\nVerification', color: '#0EA5E9', active: Object.keys(overrides).some(k => k.startsWith('doc_')) },
    { label: 'Face\nScan', color: '#10B981', active: Object.keys(overrides).some(k => k.startsWith('face_')) },
    { label: 'GSA\nAddress', color: '#F59E0B', active: Object.keys(overrides).some(k => k.startsWith('rule_') || k.startsWith('koec') || k.includes('indicator') || k.includes('combo') || k.includes('normalize') || k.includes('continue') || k.includes('critical')) },
    { label: 'PDMA\nCheck', color: '#8B5CF6', active: Object.keys(overrides).some(k => k.startsWith('pdma_') || k.includes('populate') || k.includes('bridge') || k.includes('entity')) },
    { label: 'Risk\nEval', color: '#EF4444', active: Object.keys(overrides).some(k => k.startsWith('risk_')) },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border-subtle)' }}>
      {stages.map((s, i) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 6, background: s.active ? `${s.color}18` : 'transparent', border: s.active ? `1px solid ${s.color}44` : '1px solid transparent', transition: 'all 0.2s' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: s.active ? s.color : 'var(--border-bright)', whiteSpace: 'pre', lineHeight: 1.4, fontFamily: 'var(--font-mono)' }}>{s.label}</div>
            {s.active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, margin: '4px auto 0', boxShadow: `0 0 6px ${s.color}` }} />}
          </div>
          {i < stages.length - 1 && <div style={{ width: 16, textAlign: 'center', color: 'var(--border-bright)', fontSize: 12, flexShrink: 0 }}>→</div>}
        </div>
      ))}
    </div>
  );
}

// ── IDPF Trace Panel ──────────────────────────────────────────────────────
const OUTCOME_COLOR = {
  VALIDATED: '#4ADE80', NOT_VALIDATED: '#F87171', RECAPTURE: '#FBBF24',
  NO_RESULT: '#94A3B8', ADDRESS_CIP_COMPLIANT: '#4ADE80', ADDRESS_NOT_CIP_COMPLIANT: '#F87171',
  PROCESSING_ERROR: '#F97316', ALLOW: '#4ADE80', INTERDICT: '#FBBF24', BLOCK: '#F87171',
  IDENTITY_VERIFIED: '#4ADE80', IDENTITY_NOT_VERIFIED: '#F87171',
};

function OutcomePill({ outcome, changed }: { outcome: string; changed?: boolean }) {
  const color = OUTCOME_COLOR[outcome as keyof typeof OUTCOME_COLOR] ?? '#94A3B8';
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
      color, background: `${color}15`, border: `1px solid ${color}44`,
      outline: changed ? `2px solid ${color}` : 'none', outlineOffset: 1,
    }}>{outcome.replace(/_/g, ' ')}</span>
  );
}

function StageRow({ stageNum, stageColor, icon: Icon, label, trace, baseline }: {
  stageNum: number; stageColor: string; icon: React.ElementType; label: string;
  trace: IDPFTrace | null; baseline: IDPFTrace | null;
}) {
  const [open, setOpen] = useState(false);
  const stageKey = ['doc_stage', 'face_stage', 'gsa_stage', 'pdma_stage', 'risk_stage', 'final'][stageNum - 1];

  // Get the outcome for this stage
  const getStageOutcome = (t: IDPFTrace | null) => {
    if (!t) return null;
    if (stageNum === 1) return t.doc_stage.outcome;
    if (stageNum === 2) return t.face_stage.outcome;
    if (stageNum === 3) return t.gsa_stage.outcome;
    if (stageNum === 4) return t.pdma_stage.evaluated ? t.pdma_stage.outcome : 'NOT_EVALUATED';
    if (stageNum === 5) return t.address_outcome.result;
    if (stageNum === 6) return t.risk_stage.outcome;
    if (stageNum === 7) return t.final.outcome;
    return null;
  };

  const scenarioOutcome = getStageOutcome(trace);
  const baselineOutcome = getStageOutcome(baseline);
  const changed = scenarioOutcome !== baselineOutcome;

  const getDetails = (t: IDPFTrace | null) => {
    if (!t) return null;
    if (stageNum === 1) {
      const s = t.doc_stage;
      return (
        <div>
          {s.triggers.length > 0 ? (
            <div>
              <div style={{ fontSize: 10, color: 'var(--status-neutral)', marginBottom: 4 }}>Triggers fired:</div>
              {s.triggers.map(tr => (
                <div key={tr} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                  <XCircle size={10} color="#F87171" />
                  <span style={{ fontSize: 11, color: '#F87171', fontFamily: 'var(--font-mono)' }}>{tr}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <CheckCircle size={11} color="#4ADE80" />
              <span style={{ fontSize: 11, color: '#4ADE80' }}>No rejection triggers — document passes all checks</span>
            </div>
          )}
        </div>
      );
    }
    if (stageNum === 2) {
      const s = t.face_stage;
      return (
        <div>
          {s.triggers.length > 0 ? (
            s.triggers.map(tr => (
              <div key={tr} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 0' }}>
                <XCircle size={10} color="#F87171" />
                <span style={{ fontSize: 11, color: '#F87171', fontFamily: 'var(--font-mono)' }}>{tr}</span>
              </div>
            ))
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <CheckCircle size={11} color="#4ADE80" />
              <span style={{ fontSize: 11, color: '#4ADE80' }}>Liveness passed · selfie score above threshold</span>
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--status-neutral)' }}>
            Threshold: {(t.face_stage.inputs.threshold_applied as number)?.toFixed(2)} {(t.face_stage.inputs as Record<string, unknown>).liveness_bypassed ? '· liveness bypassed' : ''}
          </div>
        </div>
      );
    }
    if (stageNum === 3) {
      const s = t.gsa_stage;
      return (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            {s.rule_fired !== null && (
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-mono)', background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', fontWeight: 700 }}>
                RULE {s.rule_fired} FIRED
              </span>
            )}
            {s.overridden && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-mono)', background: 'rgba(74,222,128,0.1)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.25)' }}>OVERRIDE ACTIVE</span>}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{s.reason_code}</div>
          <div style={{ fontSize: 11, color: 'var(--status-neutral)' }}>
            Proceed to PDMA: <span style={{ color: s.proceed_to_pdma ? '#4ADE80' : '#F87171', fontWeight: 700 }}>{s.proceed_to_pdma ? 'YES' : 'NO'}</span>
          </div>
          {!!(s.inputs.cmra_flag || s.inputs.pbsa_flag || s.inputs.pobox_flag) && (
            <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
              {s.inputs.cmra_flag ? <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(248,113,113,0.1)', color: '#F87171', fontFamily: 'var(--font-mono)', border: '1px solid rgba(248,113,113,0.3)' }}>CMRA=Y</span> : null}
              {s.inputs.pbsa_flag ? <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(248,113,113,0.1)', color: '#F87171', fontFamily: 'var(--font-mono)', border: '1px solid rgba(248,113,113,0.3)' }}>PBSA=Y</span> : null}
              {s.inputs.pobox_flag ? <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(248,113,113,0.1)', color: '#F87171', fontFamily: 'var(--font-mono)', border: '1px solid rgba(248,113,113,0.3)' }}>POBOX=P</span> : null}
              {s.inputs.fault_code ? <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontFamily: 'var(--font-mono)', border: '1px solid rgba(245,158,11,0.3)' }}>{String(s.inputs.fault_code)}{s.inputs.fault_sub_code ? `-${String(s.inputs.fault_sub_code)}` : ''}</span> : null}
            </div>
          )}
        </div>
      );
    }
    if (stageNum === 4) {
      const s = t.pdma_stage;
      if (!s.evaluated) return <div style={{ fontSize: 11, color: 'var(--status-neutral)' }}>PDMA not evaluated — GSA hard-stopped before reaching PDMA.</div>;
      return (
        <div>
          {s.rule_fired !== null && (
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-mono)', background: 'rgba(139,92,246,0.15)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.3)', fontWeight: 700 }}>
              RULE {s.rule_fired} FIRED
            </span>
          )}
          {s.overridden && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-mono)', background: 'rgba(74,222,128,0.1)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.25)' }}>OVERRIDE ACTIVE</span>}
          <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{s.reason_code}</div>
        </div>
      );
    }
    if (stageNum === 5) {
      const s = t.address_outcome;
      return (
        <div>
          {s.gsa_bridged_by_pdma && (
            <div style={{ fontSize: 11, color: '#4ADE80', marginBottom: 4 }}>
              ✓ GSA NO_RESULT bridged by PDMA pass (populateResult relaxation active)
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--status-neutral)' }}>
            populateResult relax: <span style={{ color: s.populate_result_relax ? '#4ADE80' : '#94A3B8', fontFamily: 'var(--font-mono)' }}>{s.populate_result_relax ? 'ON' : 'OFF'}</span>
          </div>
        </div>
      );
    }
    if (stageNum === 6) {
      const s = t.risk_stage;
      const inp = s.inputs as Record<string, unknown>;
      return (
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{s.reason.replace(/_/g, ' ')}</div>
          {inp.risk_score !== null && inp.risk_score !== undefined && (
            <div style={{ fontSize: 11, color: 'var(--status-neutral)' }}>
              Score: <strong style={{ color: '#E2E8F0' }}>{Number(inp.risk_score).toFixed(3)}</strong> · Allow ≤ {Number(inp.allow_threshold).toFixed(2)} · Block ≥ {Number(inp.block_threshold).toFixed(2)}
            </div>
          )}
        </div>
      );
    }
    if (stageNum === 7) {
      const s = t.final;
      return (
        <div>
          {s.rejection_reasons.length > 0 ? (
            <div>
              {s.rejection_reasons.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '3px 0' }}>
                  <XCircle size={10} color="#F87171" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#F87171' }}>{r}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <CheckCircle size={11} color="#4ADE80" />
              <span style={{ fontSize: 11, color: '#4ADE80' }}>All stages passed — identity verified</span>
            </div>
          )}
          {s.recommendation && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--status-neutral)' }}>
              Recommendation: <span style={{ color: '#FBBF24', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{s.recommendation}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const passIcon = scenarioOutcome === 'VALIDATED' || scenarioOutcome === 'NO_RESULT' || scenarioOutcome === 'ADDRESS_CIP_COMPLIANT' || scenarioOutcome === 'ALLOW' || scenarioOutcome === 'IDENTITY_VERIFIED';

  return (
    <div style={{ border: `1px solid ${changed ? stageColor + '55' : 'var(--border-subtle)'}`, borderRadius: 8, overflow: 'hidden', transition: 'border-color 0.3s', background: changed ? `${stageColor}06` : 'transparent' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        {/* Stage number */}
        <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: `${stageColor}22`, border: `1px solid ${stageColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={11} color={stageColor} />
        </div>
        {/* Label */}
        <div style={{ flex: 1, textAlign: 'left' }}>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: stageColor, fontWeight: 700 }}>STAGE {stageNum} · </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0' }}>{label}</span>
        </div>
        {/* Outcome comparison */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {changed && baseline && baselineOutcome && (
            <>
              <span style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>
                {baselineOutcome.replace(/_/g, ' ')}
              </span>
              <ArrowRight size={10} color={stageColor} />
            </>
          )}
          {scenarioOutcome && <OutcomePill outcome={scenarioOutcome} changed={changed} />}
        </div>
        {open ? <ChevronDown size={12} color="var(--status-neutral)" /> : <ChevronRight size={12} color="var(--status-neutral)" />}
      </button>
      {open && trace && (
        <div style={{ padding: '8px 14px 12px', borderTop: `1px solid ${stageColor}22` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 6 }}>Scenario</div>
              {getDetails(trace)}
            </div>
            {changed && (
              <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: 12 }}>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 6 }}>Baseline</div>
                {getDetails(baseline)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IDPFTracePipeline({ traceResult }: { traceResult: PipelineTraceResult | null }) {
  if (!traceResult) return null;
  const { scenario, baseline } = traceResult;

  const rows = [
    { stageNum: 1, color: '#0EA5E9', icon: FileCheck,    label: 'Document Verification' },
    { stageNum: 2, color: '#10B981', icon: Camera,        label: 'Face Scan' },
    { stageNum: 3, color: '#F59E0B', icon: MapPin,        label: 'Address — GSA' },
    { stageNum: 4, color: '#8B5CF6', icon: Building,      label: 'Address — PDMA' },
    { stageNum: 5, color: '#A78BFA', icon: Building,      label: 'populateResult (Address Combined)' },
    { stageNum: 6, color: '#EF4444', icon: ShieldAlert,   label: 'Risk Evaluation' },
    { stageNum: 7, color: scenario.final.outcome === 'IDENTITY_VERIFIED' ? '#4ADE80' : '#F87171', icon: scenario.final.outcome === 'IDENTITY_VERIFIED' ? CheckCircle : XCircle, label: 'Final Identity Decision' },
  ];

  const changed = scenario.final.outcome !== baseline.final.outcome;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Final outcome banner */}
      <div style={{
        padding: '12px 16px', borderRadius: 10,
        background: changed
          ? (scenario.final.outcome === 'IDENTITY_VERIFIED' ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)')
          : 'var(--bg-elevated)',
        border: `1px solid ${changed ? (scenario.final.outcome === 'IDENTITY_VERIFIED' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)') : 'var(--border-subtle)'}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
            TRANSACTION {traceResult.transaction_id}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: scenario.final.outcome === 'IDENTITY_VERIFIED' ? '#4ADE80' : '#F87171' }}>
            {scenario.final.outcome.replace(/_/g, ' ')}
          </div>
          {changed && (
            <div style={{ fontSize: 11, color: 'var(--status-neutral)', marginTop: 2 }}>
              Changed from baseline: <span style={{ color: baseline.final.outcome === 'IDENTITY_VERIFIED' ? '#4ADE80' : '#F87171', fontWeight: 700 }}>{baseline.final.outcome.replace(/_/g, ' ')}</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {scenario.final.recommendation && (
            <div style={{ fontSize: 11, color: '#FBBF24', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {scenario.final.recommendation}
            </div>
          )}
          <div style={{ fontSize: 10, color: 'var(--status-neutral)', marginTop: 2 }}>
            {Object.values(scenario.final.stages_passed).filter(Boolean).length} / 4 stages passed
          </div>
        </div>
      </div>

      {/* Stage rows */}
      {rows.map(r => (
        <StageRow
          key={r.stageNum}
          stageNum={r.stageNum}
          stageColor={r.color}
          icon={r.icon}
          label={r.label}
          trace={scenario}
          baseline={baseline}
        />
      ))}
    </div>
  );
}

// ── Main WhatIfEngine page ────────────────────────────────────────────────
export function WhatIfEngine() {
  const { overrides, result, running, runSim, resetOverrides, saveScenario, setOverride } = useSimulationStore();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [sensitivityData, setSensitivityData] = useState<SensitivityPoint[]>([]);
  const [presets, setPresets] = useState<ScenarioCard[]>([]);
  const [traceResult, setTraceResult] = useState<PipelineTraceResult | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const traceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      runSensitivitySweep().then(setSensitivityData).catch(() => {});
      getScenarioCards().then(setPresets).catch(() => {});
      // Load initial trace with default overrides
      getPipelineTrace({}).then(setTraceResult).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, []);

  // Debounced trace update when overrides change
  useEffect(() => {
    if (traceTimerRef.current) clearTimeout(traceTimerRef.current);
    traceTimerRef.current = setTimeout(() => {
      setTraceLoading(true);
      getPipelineTrace(overrides)
        .then(r => { setTraceResult(r); setTraceLoading(false); })
        .catch(() => setTraceLoading(false));
    }, 500);
    return () => { if (traceTimerRef.current) clearTimeout(traceTimerRef.current); };
  }, [overrides]);

  const activeCount = Object.keys(overrides).filter(k => {
    const v = overrides[k as keyof RuleOverrides];
    const def = DEFAULT_OVERRIDES[k as keyof typeof DEFAULT_OVERRIDES];
    return v !== def;
  }).length;

  const deltaColor = (d: number) => d > 0 ? 'var(--status-pass)' : d < 0 ? 'var(--status-fail)' : 'var(--status-neutral)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fade-in 0.4s ease' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#E2E8F0', marginBottom: 4 }}>
            What-If Simulation Engine
          </h1>
          <p style={{ fontSize: 12, color: 'var(--status-neutral)' }}>
            Toggle rule overrides to see how each IDPF pipeline stage decision changes — Doc → Face → GSA → PDMA → Risk → Final Identity
          </p>
        </div>
        <AlgorithmBadge name="Monte Carlo Bootstrap · 500 iterations" category="Simulation" />
      </div>

      {/* How It Works */}
      <div style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Info size={15} color="#0EA5E9" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0EA5E9', marginBottom: 4 }}>How the IDPF Pipeline works</div>
          <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.7 }}>
            Every customer goes through 5 stages sequentially. <strong style={{ color: '#CBD5E1' }}>Document</strong> checks ID validity (11 triggers).
            <strong style={{ color: '#CBD5E1' }}> Face</strong> checks liveness + selfie score.
            <strong style={{ color: '#CBD5E1' }}> GSA</strong> evaluates the address against Rules 0–9.
            <strong style={{ color: '#CBD5E1' }}> PDMA</strong> checks branch-address match (Rules 10–14).
            <strong style={{ color: '#CBD5E1' }}> Risk</strong> scores fraud probability against allow/block thresholds.
            The <strong style={{ color: '#CBD5E1' }}>Pipeline Trace</strong> panel on the right shows exactly which rule fired and why — live as you toggle overrides.
          </div>
        </div>
      </div>

      {/* Pipeline banner */}
      <PipelineBanner overrides={overrides} />

      {/* Quick Scenarios */}
      {presets.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--border-bright)', marginBottom: 8 }}>
            Quick Scenarios — click to apply
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {presets.slice(0, 10).map(sc => (
              <button key={sc.id} onClick={() => {
                resetOverrides();
                Object.entries(sc.overrides).forEach(([k, v]) => setOverride(k as keyof RuleOverrides, v as boolean | string));
                setTimeout(runSim, 80);
              }} style={{ padding: '10px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 11, color: '#CBD5E1', marginBottom: 5, lineHeight: 1.35 }}>{sc.label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 2, background: sc.impact === 'HIGH' ? 'rgba(74,222,128,0.12)' : sc.impact === 'MED' ? 'rgba(251,191,36,0.10)' : 'rgba(148,163,184,0.08)', color: sc.impact === 'HIGH' ? 'var(--status-pass)' : sc.impact === 'MED' ? 'var(--status-warn)' : 'var(--status-neutral)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{sc.impact}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: sc.result.delta > 0 ? 'var(--status-pass)' : 'var(--status-neutral)' }}>
                    {sc.result.delta > 0 ? '+' : ''}{sc.result.delta.toFixed(1)}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 16, alignItems: 'start' }}>

        {/* LEFT: Rule overrides ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Stage 1 — Document */}
          <Section icon={FileCheck} title="Document Verification" subtitle="ID validity, submission quality, and data-field matching" stageNum={1} stageColor="#0EA5E9" defaultOpen>
            <ToggleRow ruleKey="doc_submission_error_allow" label="Allow submission errors" tag="DOC-1" tagColor="#0EA5E9" description="System submission errors are non-blocking. Normally a technical error stops the session." />
            <ToggleRow ruleKey="doc_unsupported_id_allow" label="Allow unsupported ID types" tag="DOC-2" tagColor="#0EA5E9" description="Unrecognised ID document types continue to next stage instead of hard-failing." />
            <ToggleRow ruleKey="doc_expired_id_allow" label="Allow expired IDs" tag="DOC-3" tagColor="#0EA5E9" description="IDs past their expiry date are still accepted. Useful in regions with renewal backlogs." />
            <ToggleRow ruleKey="doc_visual_inconclusive_allow" label="Allow inconclusive visual result" tag="DOC-4" tagColor="#0EA5E9" description="Visual scan result of Failed or Inconclusive is treated as passing." />
            <ToggleRow ruleKey="doc_text_inconclusive_allow" label="Allow inconclusive text extraction" tag="DOC-5" tagColor="#0EA5E9" description="OCR text result of Failed or Inconclusive does not block the session." />
            <ToggleRow ruleKey="doc_name_mismatch_allow" label="Allow first name / surname mismatch" tag="DOC-6" tagColor="#0EA5E9" description="Name discrepancies between document and supplied data are allowed through." />
            <ToggleRow ruleKey="doc_dob_mismatch_allow" label="Allow date-of-birth mismatch" tag="DOC-7" tagColor="#0EA5E9" description="Date-of-birth discrepancy between document and supplied data is non-blocking." />
            <ToggleRow ruleKey="doc_capture_quality_allow" label="Allow poor/failed capture quality" tag="DOC-8" tagColor="#0EA5E9" description="Poor or Failed capture quality does not block — treated as VALIDATED with a warning." />
            <ToggleRow ruleKey="doc_recapture_limit_3" label="Set recapture limit to 3 (default: 2)" tag="DOC-9" tagColor="#0EA5E9" description="Customers get 3 capture attempts before being blocked, instead of the default 2." />
          </Section>

          {/* Stage 2 — Face Scan */}
          <Section icon={Camera} title="Face Scan" subtitle="Liveness detection and selfie-to-document match threshold" stageNum={2} stageColor="#10B981">
            <ToggleRow ruleKey="face_liveness_bypass" label="Bypass liveness check" tag="FACE-1" tagColor="#10B981" description="Liveness detection is skipped entirely. Selfie score threshold still applies. Use with caution — significant security trade-off." />
            <ToggleRow ruleKey="face_selfie_threshold_lower" label="Lower selfie match threshold (0.75 → 0.60)" tag="FACE-2" tagColor="#10B981" description="The selfie-to-document photo similarity threshold is reduced from 0.75 to 0.60, recovering borderline face scan failures." />
          </Section>

          {/* Stage 3 — GSA */}
          <Section icon={MapPin} title="Address Verification — GSA" subtitle="Rules 0–9: hard-stop indicators, fault codes, sub-code severities" stageNum={3} stageColor="#F59E0B">
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F59E0B', padding: '8px 0 4px', letterSpacing: '0.08em' }}>HARD-STOP INDICATOR OVERRIDES (Rules 7–9)</div>
            <ToggleRow ruleKey="rule_7_cmra_continue" label="Rule 7: CMRA=Y → continue to PDMA" tag="RULE 7" tagColor="#F59E0B" description="Commercial mail-receiving addresses (mailbox stores) are normally hard-stopped at GSA. This routes them to PDMA for a secondary address check." />
            <ToggleRow ruleKey="rule_8_pbsa_continue" label="Rule 8: PBSA=Y → continue to PDMA" tag="RULE 8" tagColor="#F59E0B" description="PO Box street addresses that GSA flags as PBSA are routed to PDMA instead of hard-stopping." />
            <ToggleRow ruleKey="rule_9_pobox_continue" label="Rule 9: PO Box=P → continue to PDMA" tag="RULE 9" tagColor="#F59E0B" description="PO Box addresses are allowed to proceed to PDMA rather than receiving a hard-stop at GSA." />
            <ToggleRow ruleKey="rule_6_fallthrough" label="Rule 6: GSA comm error → fallthrough to PDMA" tag="RULE 6" tagColor="#F59E0B" description="When GSA returns a communication error (Rule 6 — PROCESSING_ERROR), route to PDMA instead of stopping. Prevents outages from blocking customers." />
            <ToggleRow ruleKey="rule_3_fallthrough" label="Rule 3: KOEC0039+X → fallthrough to PDMA" tag="RULE 3" tagColor="#F59E0B" description="Rule 3 fires when KOEC0039 with sub-code X (Group1X/database unavailable). This fallback routes those cases to PDMA instead of STOP." />
            <ToggleRow ruleKey="continue_on_risk_one" label="Global continueOnRisk=1 behavior" tag="RISK-1" tagColor="#F59E0B" description="Sets effective continueOnRisk='1' globally — all single risk indicators allow continuation to PDMA." />
            <ToggleRow ruleKey="continue_indicators_to_pdma" label="Any risk indicator → continue to PDMA" tag="INDICATORS" tagColor="#F59E0B" description="Regardless of which indicator is flagged (CMRA/PBSA/POBOX), always route to PDMA rather than hard-stop." />

            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F59E0B', padding: '12px 0 4px', letterSpacing: '0.08em' }}>FAULT CODE TOGGLES</div>
            <ToggleRow ruleKey="koec0647_retry_enabled" label="KOEC0647: Mark as retryable" tag="KOEC0647" tagColor="#F59E0B" description="Rule 1 (KOEC0647 — missing/incorrect unit number) is marked retryable rather than terminal, allowing the customer to correct their address." />
            <ToggleRow ruleKey="koec0647_dpv_ds_stop" label="KOEC0647 + DPV code D/S → stop" tag="KOEC0647" tagColor="#F59E0B" tightens description="If KOEC0647 fires AND the USPS delivery point code is D or S, tighten to a hard-stop. Prevents structurally invalid addresses from proceeding." />
            <ToggleRow ruleKey="koec0692_stop" label="KOEC0692: Tighten to hard-stop" tag="KOEC0692" tagColor="#F59E0B" tightens description="Rule 2 (KOEC0692 non-USPS warning) is normally soft — this tightens it to a hard-stop for stricter address policy." />
            <ToggleRow ruleKey="koec0039_a_allow_pdma" label="KOEC0039 sub-code A → soften to PDMA" tag="KOEC0039-A" tagColor="#F59E0B" description="Rule 5 sub-code A (general address anomaly): soften response to route to PDMA instead of NOT_CIP_COMPLIANT stop." />
            <ToggleRow ruleKey="koec0039_b_tighten_stop" label="KOEC0039 sub-code B → hard-stop" tag="KOEC0039-B" tagColor="#F59E0B" tightens description="Rule 5 sub-code B (address undeliverable): promotes from warning to hard-stop for stricter address compliance." />
            <ToggleRow ruleKey="split_koec0039_subcodes" label="Append return code to reason code" tag="KOEC0039" tagColor="#F59E0B" description="Reason code in the decision record will include the specific sub-code (e.g., INPUT_ADDRESS_ERROR_KOEC0039_B). Improves audit trail granularity." />
            <ToggleRow ruleKey="critical_error_fallback_to_pdma" label="Critical errors (KOAA0023/KOEC0040) → PDMA" tag="KOAA0023" tagColor="#F59E0B" description="Rule 4 critical fault codes (KOAA0023, KOEC0040, KOAA0040) fall back to PDMA evaluation instead of hard-stopping. Prevents infrastructure failures from blocking customers." />
            <ToggleRow ruleKey="combo_indicators_stop" label="Multiple GSA indicators → hard-stop" tag="COMBO" tagColor="#F59E0B" defaultOn tightens description="When multiple risk indicators fire simultaneously (e.g., CMRA + PBSA), the combo triggers a hard-stop. On by default as defence against layered fraud." />
            <ToggleRow ruleKey="normalize_n_unknown_as_blank" label="Treat N/UNKNOWN/NULL as blank" tag="NORMALIZE" tagColor="#F59E0B" defaultOn description="GSA returns inconsistent null-like values. This normalization (on by default) treats 'N', 'UNKNOWN', 'NULL', 'NONE' as blank — preventing false positives from GSA response variations." />

            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F59E0B', padding: '12px 0 4px', letterSpacing: '0.08em' }}>KOEC0039 SUB-CODE SEVERITIES</div>
            <div style={{ fontSize: 11, color: 'var(--status-neutral)', marginBottom: 8, lineHeight: 1.6 }}>
              Each KOEC0039 return code can independently be set to PASS, WARN (continue to PDMA), or STOP (hard-block).
            </div>
            {([
              { code: 'A', desc: 'Address anomaly — general match issue' },
              { code: 'B', desc: 'Address undeliverable' },
              { code: 'H', desc: 'High-rise default — floor/unit missing' },
              { code: 'M', desc: 'Military / APO / FPO address' },
              { code: 'S', desc: 'Secondary unit number required' },
              { code: 'Z', desc: 'Zip code correction applied' },
            ] as const).map(({ code, desc }) => (
              <div key={code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#E2E8F0' }}>KOEC0039-<span style={{ color: '#F59E0B' }}>{code}</span></span>
                  <div style={{ fontSize: 10, color: 'var(--status-neutral)', marginTop: 1 }}>{desc}</div>
                </div>
                <SeveritySelect
                  value={(overrides[`koec0039_${code}_severity` as keyof RuleOverrides] ?? DEFAULT_OVERRIDES[`koec0039_${code}_severity` as keyof typeof DEFAULT_OVERRIDES]) as string}
                  onChange={v => setOverride(`koec0039_${code}_severity` as keyof RuleOverrides, v)}
                />
              </div>
            ))}

            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F59E0B', padding: '12px 0 4px', letterSpacing: '0.08em' }}>OVERRIDE ENABLEMENT FLAGS</div>
            <ToggleRow ruleKey="koec0039_override_enabled" label="Force NOT_CIP_COMPLIANT for KOEC0039" tag="CIP" tagColor="#F59E0B" defaultOn tightens description="When enabled (default), any KOEC0039 result forces the address outcome to NOT_CIP_COMPLIANT + CIP_ADDRESS_REVIEW recommendation regardless of other indicators." />
            <ToggleRow ruleKey="entity_action_change_enabled" label="Apply entity-specific recommendation rules" tag="ENTITY" tagColor="#F59E0B" defaultOn description="Entity-type (individual vs business) changes the recommendation logic. ENTITY addresses follow different rules than residential addresses." />
          </Section>

          {/* Stage 4 — PDMA */}
          <Section icon={Building} title="Address Verification — PDMA" subtitle="Rules 10–14: branch-address check and populateResult relaxation" stageNum={4} stageColor="#8B5CF6">
            <ToggleRow ruleKey="pdma_comm_error_allow" label="Rule 10: Allow PDMA communication errors" tag="RULE 10" tagColor="#8B5CF6" description="When the PDMA service is unreachable, the customer continues rather than being hard-stopped (Rule 10)." />
            <ToggleRow ruleKey="pdma_branch_match_allow" label="Rule 12: Allow branch-address matches" tag="RULE 12" tagColor="#8B5CF6" description="When the address matches a known financial branch address (Rule 12), allow it to pass rather than blocking." />
            <ToggleRow ruleKey="pdma_no_return_allow" label="Rule 14: Allow absent branch-match response" tag="RULE 14" tagColor="#8B5CF6" description="When PDMA doesn't return a branch-match answer at all (Rule 14 — default NOT_CIP_COMPLIANT for safety), allow it to pass." />
            <ToggleRow ruleKey="populate_result_relax" label="populateResult relaxation: NO_RESULT + PDMA pass = COMPLIANT" tag="RULE 15" tagColor="#8B5CF6" description="The key 'last mile' rule. If GSA returns NO_RESULT but PDMA confirms the address, the combined outcome is ADDRESS_CIP_COMPLIANT rather than NOT_CIP_COMPLIANT." />
            <ToggleRow ruleKey="relax_no_result_bridge" label="GSA NO_RESULT bridged by PDMA pass" tag="BRIDGE" tagColor="#8B5CF6" description="Extends populateResult relaxation: GSA NO_RESULT is actively 'bridged' to COMPLIANT when PDMA passes. Works together with the rule above." />
          </Section>

          {/* Stage 5 — Risk */}
          <Section icon={ShieldAlert} title="Risk Evaluation" subtitle="ML risk score thresholds — allow/interdict/block bands" stageNum={5} stageColor="#EF4444">
            <ToggleRow ruleKey="risk_allow_threshold_lower" label="Lower allow threshold (0.40 → 0.30)" tag="ALLOW" tagColor="#EF4444" description="The allow band is widened: risk_score ≤ 0.30 is now ALLOW (was 0.40). More customers with moderate risk scores are approved." />
            <ToggleRow ruleKey="risk_block_threshold_higher" label="Raise block threshold (0.75 → 0.85)" tag="BLOCK" tagColor="#EF4444" description="The block threshold rises to 0.85 (from 0.75). Customers scoring between 0.75 and 0.85 enter interdict review instead of being hard-blocked." />
            <ToggleRow ruleKey="risk_interdict_to_allow" label="Treat INTERDICT outcomes as ALLOW" tag="INTERDICT" tagColor="#EF4444" description="Customers whose risk score falls between the allow and block thresholds (normally INTERDICT) are allowed through. High-impact policy change." />
          </Section>

          {/* Action row */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button onClick={runSim} disabled={running} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 8, cursor: running ? 'not-allowed' : 'pointer', background: 'linear-gradient(90deg, #00B4D8 0%, #0284C7 100%)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.04em', boxShadow: running ? 'none' : 'var(--glow-accent)', opacity: running ? 0.6 : 1, transition: 'opacity 0.2s' }}>
              <Play size={14} />
              {running ? 'Computing…' : `Run Simulation${activeCount > 0 ? ` (${activeCount} change${activeCount > 1 ? 's' : ''})` : ''}`}
            </button>
            <button onClick={resetOverrides} title="Reset all to defaults" style={{ padding: '11px 14px', borderRadius: 8, cursor: 'pointer', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--status-neutral)' }}>
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* RIGHT: Trace + Results ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* IDPF Pipeline Trace */}
          <HarnessCard title="Pipeline Decision Trace" subtitle={traceLoading ? 'updating…' : 'live · updates as you toggle rules'} glow="accent">
            {!traceResult && !traceLoading && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--status-neutral)', fontSize: 12 }}>
                Connecting to backend… toggle any rule to see the IDPF decision trace.
              </div>
            )}
            {traceLoading && !traceResult && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--status-neutral)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                Loading trace…
              </div>
            )}
            {traceResult && (
              <div style={{ opacity: traceLoading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                <IDPFTracePipeline traceResult={traceResult} />
              </div>
            )}
          </HarnessCard>

          {/* Simulation result */}
          {!result && !running && (
            <HarnessCard>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 14, textAlign: 'center' }}>
                <TrendingUp size={36} color="var(--border-bright)" />
                <p style={{ color: '#CBD5E1', fontSize: 13 }}>
                  Click <strong style={{ color: 'var(--accent-primary)' }}>Run Simulation</strong> to run Monte Carlo bootstrap over all 1,500 synthetic transactions and see the aggregate pass-rate impact.
                </p>
              </div>
            </HarnessCard>
          )}

          {running && (
            <HarnessCard>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', gap: 16 }}>
                <div className="skeleton" style={{ width: 220, height: 44 }} />
                <div className="skeleton" style={{ width: '100%', height: 60 }} />
                <div style={{ fontSize: 12, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>
                  Replaying {activeCount} override change{activeCount !== 1 ? 's' : ''} across 1,500 transactions × 500 bootstrap samples…
                </div>
              </div>
            </HarnessCard>
          )}

          {result && !running && (
            <>
              {/* Plain-English summary */}
              <div style={{ padding: '14px 16px', borderRadius: 10, background: result.delta > 0 ? 'rgba(74,222,128,0.07)' : result.delta < 0 ? 'rgba(248,113,113,0.07)' : 'var(--bg-elevated)', border: `1px solid ${result.delta > 0 ? 'rgba(74,222,128,0.25)' : result.delta < 0 ? 'rgba(248,113,113,0.25)' : 'var(--border-subtle)'}` }}>
                <div style={{ fontSize: 13, color: '#E2E8F0', lineHeight: 1.7 }}>
                  {result.delta_absolute > 0 ? (
                    <>With these changes, approximately <strong style={{ color: '#4ADE80' }}>{result.delta_absolute.toLocaleString()} more customers</strong> would successfully complete identity verification — pass rate <strong>{result.baseline_pass_rate.toFixed(1)}%</strong> → <strong style={{ color: '#4ADE80' }}>{result.simulated_pass_rate.toFixed(1)}%</strong>.</>
                  ) : result.delta_absolute < 0 ? (
                    <>These changes would <strong style={{ color: '#F87171' }}>block {Math.abs(result.delta_absolute).toLocaleString()} additional customers</strong>, tightening the pass rate from <strong>{result.baseline_pass_rate.toFixed(1)}%</strong> to <strong style={{ color: '#F87171' }}>{result.simulated_pass_rate.toFixed(1)}%</strong>.</>
                  ) : (
                    <>No change detected. The selected overrides do not affect the current transaction dataset.</>
                  )}
                </div>
              </div>

              {/* KPIs */}
              <HarnessCard title="Simulation Results" glow={result.delta > 0 ? 'pass' : result.delta < 0 ? 'fail' : 'none'}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                  {[
                    { label: 'Baseline Rate', value: result.baseline_pass_rate, color: 'var(--status-neutral)', suffix: '%' },
                    { label: 'Simulated Rate', value: result.simulated_pass_rate, color: deltaColor(result.delta), suffix: '%' },
                    { label: 'Delta', value: result.delta, color: deltaColor(result.delta), prefix: result.delta > 0 ? '+' : '', suffix: 'pp' },
                  ].map(kpi => (
                    <div key={kpi.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--status-neutral)', marginBottom: 4 }}>{kpi.label}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>
                        {kpi.prefix ?? ''}{kpi.value.toFixed(1)}{kpi.suffix}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CI */}
                <div style={{ padding: '10px 14px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>95% Bootstrap CI</div>
                    <div style={{ fontSize: 10, color: 'var(--border-bright)', marginTop: 2 }}>We're 95% confident the true impact falls in this range</div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--accent-primary)', fontWeight: 700 }}>
                    [{result.ci_95_low > 0 ? '+' : ''}{result.ci_95_low.toFixed(1)}pp, {result.ci_95_high > 0 ? '+' : ''}{result.ci_95_high.toFixed(1)}pp]
                  </span>
                </div>

                {/* Breakdown */}
                {result.affected_count > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--border-bright)', marginBottom: 8 }}>Which rules recovered customers</div>
                    {result.breakdown.map((b, i) => (
                      <div key={b.rule} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: 'var(--border-bright)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{i === result.breakdown.length - 1 ? '└' : '├'}</span>
                          <span style={{ fontSize: 11, color: '#CBD5E1' }}>{b.rule}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--status-neutral)' }}>{b.pct.toFixed(1)}%</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--status-pass)', minWidth: 56, textAlign: 'right' }}>+{b.count.toLocaleString()} tx</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </HarnessCard>

              {/* Save */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!saveDialogOpen ? (
                  <button onClick={() => setSaveDialogOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6, cursor: 'pointer', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--status-neutral)', fontSize: 12 }}>
                    <Save size={13} /> Save Scenario
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                    <input autoFocus value={scenarioName} onChange={e => setScenarioName(e.target.value)}
                      placeholder="Name this scenario…"
                      onKeyDown={e => { if (e.key === 'Enter') { saveScenario(scenarioName || 'Untitled'); setSaveDialogOpen(false); setScenarioName(''); } if (e.key === 'Escape') setSaveDialogOpen(false); }}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-accent)', color: '#E2E8F0', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
                    <button onClick={() => { saveScenario(scenarioName || 'Untitled'); setSaveDialogOpen(false); setScenarioName(''); }} style={{ padding: '6px 14px', borderRadius: 6, cursor: 'pointer', background: 'var(--accent-strong)', border: 'none', color: '#fff', fontSize: 12 }}>Save</button>
                    <button onClick={() => setSaveDialogOpen(false)} style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--status-neutral)', fontSize: 12 }}>×</button>
                  </div>
                )}
                <span style={{ fontSize: 11, color: 'var(--border-bright)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                  {result.runtime_ms}ms · 500 iterations
                </span>
              </div>
            </>
          )}

          {/* Sensitivity chart */}
          {sensitivityData.length > 0 && (
            <HarnessCard title="Sensitivity Analysis" subtitle="Pass rate across common override combinations">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={sensitivityData} margin={{ top: 8, right: 20, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--status-neutral)' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Verified Rate']} />
                  <ReferenceLine y={sensitivityData[0]?.pass_rate} stroke="var(--status-warn)" strokeDasharray="4 4" strokeWidth={1} />
                  <Line type="monotone" dataKey="pass_rate" stroke="var(--accent-primary)" strokeWidth={2.5} dot={{ fill: 'var(--accent-primary)', r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: 'var(--accent-primary)' }} />
                </LineChart>
              </ResponsiveContainer>
            </HarnessCard>
          )}

          {/* Decision outcomes reference */}
          <HarnessCard title="IDPF Decision Outcomes Reference">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { outcome: 'IDENTITY_VERIFIED', desc: 'All 4 stages passed. Customer verified.', color: '#4ADE80' },
                { outcome: 'IDENTITY_NOT_VERIFIED', desc: 'One or more stages failed.', color: '#F87171' },
                { outcome: 'ADDRESS_CIP_COMPLIANT', desc: 'GSA/PDMA confirms address is CIP-compliant.', color: '#4ADE80' },
                { outcome: 'ADDRESS_NOT_CIP_COMPLIANT', desc: 'Address fails GSA or PDMA check.', color: '#F87171' },
                { outcome: 'NO_RESULT', desc: 'GSA has no data for this address.', color: '#FBBF24' },
                { outcome: 'PROCESSING_ERROR', desc: 'GSA system error — comm or critical fault.', color: '#F97316' },
                { outcome: 'ALLOW', desc: 'Risk score ≤ allow threshold.', color: '#4ADE80' },
                { outcome: 'INTERDICT', desc: 'Risk score in grey zone — manual review.', color: '#FBBF24' },
                { outcome: 'BLOCK', desc: 'Risk score ≥ block threshold.', color: '#F87171' },
                { outcome: 'VALIDATED', desc: 'Document or face stage passed.', color: '#4ADE80' },
                { outcome: 'NOT_VALIDATED', desc: 'Document or face stage failed.', color: '#F87171' },
                { outcome: 'RECAPTURE', desc: 'Capture quality low — retry available.', color: '#FBBF24' },
              ].map(row => (
                <div key={row.outcome} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 8px', borderRadius: 6, background: 'var(--bg-elevated)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: row.color, fontWeight: 700, whiteSpace: 'nowrap', marginTop: 1 }}>{row.outcome}</span>
                  <span style={{ fontSize: 10, color: 'var(--status-neutral)', lineHeight: 1.5 }}>{row.desc}</span>
                </div>
              ))}
            </div>
          </HarnessCard>
        </div>
      </div>
    </div>
  );
}
