import { useEffect, useState } from 'react';
import { useSimulationStore } from '@/store/useSimulationStore';
import {
  runSensitivitySweep, getScenarioCards,
  type RuleOverrides, type SensitivityPoint, type ScenarioCard, DEFAULT_OVERRIDES,
} from '@/api/simulation';
import { HarnessCard, AlgorithmBadge } from '@/design-system/components';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  Play, RotateCcw, Save, TrendingUp, ChevronDown, ChevronRight,
  FileCheck, Camera, MapPin, Building, ShieldAlert, Info,
} from 'lucide-react';

// ── Tiny Toggle ──────────────────────────────────────────────────────────
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
  const colorMap: Record<string, string> = { PASS: '#4ADE80', WARN: '#FCD34D', STOP: '#F87171' };
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

// ── Toggle row with plain-English description ────────────────────────────
function ToggleRow({
  label, description, ruleKey, tag, tagColor, defaultOn, tightens,
}: {
  label: string;
  description: string;
  ruleKey: keyof RuleOverrides;
  tag?: string;
  tagColor?: string;
  defaultOn?: boolean;
  tightens?: boolean;
}) {
  const { overrides, setOverride } = useSimulationStore();
  const rawValue = overrides[ruleKey] ?? DEFAULT_OVERRIDES[ruleKey as keyof typeof DEFAULT_OVERRIDES];
  const checked = typeof rawValue === 'boolean' ? rawValue : false;
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div style={{
      padding: '10px 0', borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, color: '#E2E8F0', fontWeight: 500, lineHeight: 1.3 }}>{label}</span>
          {tag && (
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)',
              background: `${tagColor ?? '#0EA5E9'}22`,
              color: tagColor ?? '#0EA5E9', border: `1px solid ${tagColor ?? '#0EA5E9'}44`,
              whiteSpace: 'nowrap', fontWeight: 700, letterSpacing: '0.05em',
            }}>{tag}</span>
          )}
          {defaultOn && (
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)',
              background: 'rgba(74,222,128,0.08)', color: '#4ADE80',
              border: '1px solid rgba(74,222,128,0.25)', whiteSpace: 'nowrap',
            }}>DEFAULT ON</span>
          )}
          {tightens && (
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)',
              background: 'rgba(248,113,113,0.08)', color: '#F87171',
              border: '1px solid rgba(248,113,113,0.25)', whiteSpace: 'nowrap',
            }}>TIGHTENS</span>
          )}
          <button
            onClick={() => setShowInfo(s => !s)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--border-bright)', flexShrink: 0 }}
          >
            <Info size={11} />
          </button>
        </div>
        <Toggle checked={checked} onChange={v => setOverride(ruleKey, v)} />
      </div>
      {showInfo && (
        <div style={{
          fontSize: 11, color: 'var(--status-neutral)', lineHeight: 1.6,
          background: 'rgba(14,165,233,0.05)', borderRadius: 4,
          padding: '6px 10px', borderLeft: '2px solid var(--accent-primary)',
        }}>
          {description}
        </div>
      )}
    </div>
  );
}

// ── Collapsible section ──────────────────────────────────────────────────
function Section({
  icon: Icon, title, subtitle, stageNum, stageColor, children, defaultOpen = false,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  stageNum: number;
  stageColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      border: `1px solid ${open ? stageColor + '44' : 'var(--border-subtle)'}`,
      borderRadius: 10, overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', background: open ? `${stageColor}0D` : 'var(--bg-panel)',
          border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s',
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: `${stageColor}22`, border: `1px solid ${stageColor}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={13} color={stageColor} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: stageColor, fontWeight: 700 }}>
              STAGE {stageNum}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>{title}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--status-neutral)', marginTop: 1 }}>{subtitle}</div>
        </div>
        {open ? <ChevronDown size={14} color="var(--status-neutral)" /> : <ChevronRight size={14} color="var(--status-neutral)" />}
      </button>
      {open && (
        <div style={{ padding: '4px 14px 12px', background: 'var(--bg-panel)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Pipeline banner ──────────────────────────────────────────────────────
function PipelineBanner({ overrides }: { overrides: Partial<RuleOverrides> }) {
  const stages = [
    {
      label: 'Document\nVerification', color: '#0EA5E9',
      active: Object.keys(overrides).some(k => k.startsWith('doc_')),
    },
    {
      label: 'Face\nScan', color: '#10B981',
      active: Object.keys(overrides).some(k => k.startsWith('face_')),
    },
    {
      label: 'GSA\nAddress', color: '#F59E0B',
      active: Object.keys(overrides).some(k => k.startsWith('rule_') || k.startsWith('koec') || k.includes('indicator') || k.includes('combo') || k.includes('normalize')),
    },
    {
      label: 'PDMA\nCheck', color: '#8B5CF6',
      active: Object.keys(overrides).some(k => k.startsWith('pdma_') || k.includes('populate') || k.includes('bridge') || k.includes('entity')),
    },
    {
      label: 'Risk\nEval', color: '#EF4444',
      active: Object.keys(overrides).some(k => k.startsWith('risk_')),
    },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 16px',
      border: '1px solid var(--border-subtle)',
    }}>
      {stages.map((s, i) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{
            flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 6,
            background: s.active ? `${s.color}18` : 'transparent',
            border: s.active ? `1px solid ${s.color}44` : '1px solid transparent',
            transition: 'all 0.2s',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: s.active ? s.color : 'var(--border-bright)', whiteSpace: 'pre', lineHeight: 1.4, fontFamily: 'var(--font-mono)' }}>
              {s.label}
            </div>
            {s.active && (
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, margin: '4px auto 0', boxShadow: `0 0 6px ${s.color}` }} />
            )}
          </div>
          {i < stages.length - 1 && (
            <div style={{ width: 16, textAlign: 'center', color: 'var(--border-bright)', fontSize: 12, flexShrink: 0 }}>→</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────
export function WhatIfEngine() {
  const { overrides, result, running, runSim, resetOverrides, saveScenario, setOverride } = useSimulationStore();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [sensitivityData, setSensitivityData] = useState<SensitivityPoint[]>([]);
  const [presets, setPresets] = useState<ScenarioCard[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      runSensitivitySweep().then(setSensitivityData).catch(() => {});
      getScenarioCards().then(setPresets).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, []);

  const merged = { ...DEFAULT_OVERRIDES, ...overrides };
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
            Turn on rule overrides below, then click <strong style={{ color: '#CBD5E1' }}>Run Simulation</strong> to see how many more customers would pass identity verification.
          </p>
        </div>
        <AlgorithmBadge name="Monte Carlo Bootstrap · 500 iterations" category="Simulation" />
      </div>

      {/* How It Works banner */}
      <div style={{
        background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)',
        borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <Info size={15} color="#0EA5E9" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0EA5E9', marginBottom: 4 }}>How this works</div>
          <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.7 }}>
            Every customer goes through a 5-stage pipeline: <strong style={{ color: '#CBD5E1' }}>Document → Face → Address (GSA) → Address (PDMA) → Risk</strong>.
            Each stage can block a customer for a specific reason. The overrides below let you soften or tighten individual checks.
            The simulation replays all historical transactions with your changes applied to estimate the new pass rate.
            Changes marked <span style={{ color: '#F87171', fontWeight: 700 }}>TIGHTENS</span> will reject more customers; most others will accept more.
          </div>
        </div>
      </div>

      {/* Pipeline stage indicator */}
      <PipelineBanner overrides={overrides} />

      {/* Quick Scenarios */}
      {presets.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--border-bright)', marginBottom: 8 }}>
            Quick Scenarios — click to apply
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {presets.slice(0, 10).map(sc => (
              <button
                key={sc.id}
                onClick={() => {
                  resetOverrides();
                  Object.entries(sc.overrides).forEach(([k, v]) => setOverride(k as keyof RuleOverrides, v as boolean | string));
                  setTimeout(runSim, 80);
                }}
                style={{
                  padding: '10px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 11, color: '#CBD5E1', marginBottom: 5, lineHeight: 1.35 }}>{sc.label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 2,
                    background: sc.impact === 'HIGH' ? 'rgba(74,222,128,0.12)' : sc.impact === 'MED' ? 'rgba(251,191,36,0.10)' : 'rgba(148,163,184,0.08)',
                    color: sc.impact === 'HIGH' ? 'var(--status-pass)' : sc.impact === 'MED' ? 'var(--status-warn)' : 'var(--status-neutral)',
                    fontFamily: 'var(--font-mono)', fontWeight: 700,
                  }}>{sc.impact}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: sc.result.delta > 0 ? 'var(--status-pass)' : 'var(--status-neutral)' }}>
                    {sc.result.delta > 0 ? '+' : ''}{sc.result.delta.toFixed(1)}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main layout: left rules, right results */}
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── LEFT: Rule sections ──────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* STAGE 1 — Document Verification */}
          <Section
            icon={FileCheck}
            title="Document Verification"
            subtitle="Controls for ID document quality, validity, and data matching"
            stageNum={1}
            stageColor="#0EA5E9"
            defaultOpen
          >
            <ToggleRow
              ruleKey="doc_submission_error_allow"
              label="Allow submission errors"
              description="If the document upload system returns a technical error, the customer is normally blocked. Turning this on lets them continue even if the doc system had a glitch — useful when the error is clearly an infrastructure problem, not a genuine bad document."
              tag="RULE DOC-1"
              tagColor="#0EA5E9"
            />
            <ToggleRow
              ruleKey="doc_unsupported_id_allow"
              label="Allow unsupported ID types"
              description="The system only recognizes certain ID types (passport, national ID, driver's licence, etc.). An unsupported type normally blocks the customer. Enable this to let customers with unusual government IDs pass through for manual review."
              tag="RULE DOC-2"
              tagColor="#0EA5E9"
            />
            <ToggleRow
              ruleKey="doc_expired_id_allow"
              label="Allow expired IDs"
              description="By default, any ID past its expiry date is rejected. Turn this on to let recently expired IDs (e.g., within 90 days) continue to identity verification — useful in regions where renewal backlogs are common."
              tag="RULE DOC-3"
              tagColor="#0EA5E9"
            />
            <ToggleRow
              ruleKey="doc_visual_inconclusive_allow"
              label="Allow inconclusive visual scan"
              description="The visual scan checks that the ID photo, holograms, and layout look genuine. An inconclusive result means the system is unsure — not that the ID is definitely fake. Enabling this allows borderline cases to proceed rather than hard-blocking."
              tag="RULE DOC-4"
              tagColor="#0EA5E9"
            />
            <ToggleRow
              ruleKey="doc_text_inconclusive_allow"
              label="Allow inconclusive text extraction"
              description="The OCR layer reads the text on the document. If the text result is inconclusive (e.g., smudge, glare), the customer is normally blocked. Enabling this lets customers with a poor-quality image retry or proceed to the next stage."
              tag="RULE DOC-5"
              tagColor="#0EA5E9"
            />
            <ToggleRow
              ruleKey="doc_name_mismatch_allow"
              label="Allow name mismatch"
              description="If the name on the document doesn't match the name the customer provided during onboarding, the check fails. Enabling this allows minor variations — nicknames, maiden names, transliteration differences — to pass through."
              tag="RULE DOC-6"
              tagColor="#0EA5E9"
            />
            <ToggleRow
              ruleKey="doc_dob_mismatch_allow"
              label="Allow date-of-birth mismatch"
              description="A date-of-birth discrepancy between the document and the customer's stated DOB normally triggers a fail. Enable this to pass customers where the discrepancy is within a small tolerance (e.g., data-entry errors)."
              tag="RULE DOC-7"
              tagColor="#0EA5E9"
            />
            <ToggleRow
              ruleKey="doc_capture_quality_allow"
              label="Allow poor capture quality"
              description="If the photo of the ID is too blurry, too dark, or otherwise poor quality, it's normally rejected. Enabling this allows low-quality captures to proceed — useful if you want to give customers more retries or handle poor camera environments."
              tag="RULE DOC-8"
              tagColor="#0EA5E9"
            />
            <ToggleRow
              ruleKey="doc_recapture_limit_3"
              label="Increase recapture limit to 3 (default: 2)"
              description="Customers normally get 2 attempts to capture a usable document photo before being blocked. Enabling this gives them a third attempt, reducing drop-offs caused by camera conditions rather than fraud."
              tag="RULE DOC-9"
              tagColor="#0EA5E9"
            />
          </Section>

          {/* STAGE 2 — Face Scan */}
          <Section
            icon={Camera}
            title="Face Scan"
            subtitle="Liveness detection and selfie-to-document matching thresholds"
            stageNum={2}
            stageColor="#10B981"
          >
            <ToggleRow
              ruleKey="face_liveness_bypass"
              label="Bypass liveness check"
              description="Liveness detection confirms the selfie is from a live person (not a printed photo or screen). Bypassing this entirely is a significant security trade-off — only enable in test environments or when liveness data is unavailable from the provider."
              tag="RULE FACE-1"
              tagColor="#10B981"
            />
            <ToggleRow
              ruleKey="face_selfie_threshold_lower"
              label="Lower selfie match threshold (0.75 → 0.60)"
              description="The selfie is compared to the document photo with a similarity score. The default threshold is 0.75 (75% similar). Lowering it to 0.60 accepts more customers whose selfie quality is lower — useful for older populations or poor lighting conditions, at the cost of slightly higher false-acceptance rate."
              tag="RULE FACE-2"
              tagColor="#10B981"
            />
          </Section>

          {/* STAGE 3 — GSA Address */}
          <Section
            icon={MapPin}
            title="Address Verification — GSA"
            subtitle="Government Services Agency hard-stop rules, fault codes, and sub-code severities"
            stageNum={3}
            stageColor="#F59E0B"
          >
            {/* Hard-stop sub-group */}
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F59E0B', padding: '8px 0 4px', letterSpacing: '0.08em' }}>
              HARD-STOP OVERRIDES (Rules 3, 6, 7, 8, 9)
            </div>
            <ToggleRow
              ruleKey="rule_7_cmra_continue"
              label="Rule 7: CMRA address → continue to PDMA"
              description="CMRA (Commercial Mail Receiving Agency) addresses like UPS Stores are normally a hard-stop because they're not residential. Enabling this routes them to the PDMA stage for a secondary address check instead of immediately blocking."
              tag="RULE 7"
              tagColor="#F59E0B"
            />
            <ToggleRow
              ruleKey="rule_8_pbsa_continue"
              label="Rule 8: PBSA address → continue to PDMA"
              description="PBSA (Private Box Service Address) flags are similar to CMRA. Enabling this override lets these customers proceed to PDMA rather than getting hard-stopped."
              tag="RULE 8"
              tagColor="#F59E0B"
            />
            <ToggleRow
              ruleKey="rule_9_pobox_continue"
              label="Rule 9: PO Box address → continue to PDMA"
              description="A PO Box address is normally a hard-stop for identity verification since it's not a residential address. Enabling this allows PO Box holders to proceed to PDMA for further checking."
              tag="RULE 9"
              tagColor="#F59E0B"
            />
            <ToggleRow
              ruleKey="rule_6_fallthrough"
              label="Rule 6: GSA comm error → fallthrough to PDMA"
              description="If the GSA address service is temporarily unavailable, the customer is normally blocked. Enabling this fallthrough means a GSA outage doesn't stop customers — they continue to PDMA instead."
              tag="RULE 6"
              tagColor="#F59E0B"
            />
            <ToggleRow
              ruleKey="rule_3_fallthrough"
              label="Rule 3: KOEC0039+X → fallthrough to PDMA"
              description="When GSA returns KOEC0039 with a Group 1 database unavailable indicator (sub-code X), the customer is normally stopped. This fallthrough allows them to continue to PDMA instead."
              tag="RULE 3"
              tagColor="#F59E0B"
            />

            {/* Fault code sub-group */}
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F59E0B', padding: '12px 0 4px', letterSpacing: '0.08em' }}>
              FAULT CODE TOGGLES (KOEC0039, KOEC0647, KOEC0692)
            </div>
            <ToggleRow
              ruleKey="koec0647_retry_enabled"
              label="KOEC0647: Mark as retryable (missing street number)"
              description="KOEC0647 means the address is missing a house/building number. Normally this is a terminal failure. Enabling this makes it retryable — the customer can correct their address and try again rather than being permanently blocked."
              tag="KOEC0647"
              tagColor="#F59E0B"
            />
            <ToggleRow
              ruleKey="koec0647_dpv_ds_stop"
              label="KOEC0647 + DPV code D/S → hard-stop"
              description="If KOEC0647 occurs AND the USPS delivery point validation code is D (default) or S (secondary unit missing), tighten to a hard-stop. This prevents customers with structurally bad addresses from proceeding even if the retry toggle is on."
              tag="KOEC0647"
              tagColor="#F59E0B"
              tightens
            />
            <ToggleRow
              ruleKey="koec0692_stop"
              label="KOEC0692: Tighten to hard-stop"
              description="KOEC0692 is currently treated as a warning (customer continues). Enabling this tightens it to a hard-stop — useful if your risk policy treats non-deliverable vacant addresses as unacceptable for identity verification."
              tag="KOEC0692"
              tagColor="#F59E0B"
              tightens
            />
            <ToggleRow
              ruleKey="koec0039_a_allow_pdma"
              label="KOEC0039 sub-code A → soften to PDMA fallthrough"
              description="Sub-code A on KOEC0039 indicates a general address anomaly. This override softens the response from a stop to a PDMA fallthrough, letting the PDMA stage make the final call on these borderline cases."
              tag="KOEC0039-A"
              tagColor="#F59E0B"
            />
            <ToggleRow
              ruleKey="koec0039_b_tighten_stop"
              label="KOEC0039 sub-code B → hard-stop"
              description="Sub-code B (address undeliverable) is currently a warning. Enabling this promotes it to a hard-stop — appropriate if your policy requires confirmed deliverable addresses."
              tag="KOEC0039-B"
              tagColor="#F59E0B"
              tightens
            />
            <ToggleRow
              ruleKey="split_koec0039_subcodes"
              label="Append return code to reason code"
              description="When enabled, the reason code in the decision record will include the specific KOEC0039 sub-code (e.g., KOEC0039-B) rather than just KOEC0039. Useful for detailed audit trails and reporting granularity."
              tag="KOEC0039"
              tagColor="#F59E0B"
            />
            <ToggleRow
              ruleKey="critical_error_fallback_to_pdma"
              label="Critical errors (KOAA0023/KOEC0040) → fallback to PDMA"
              description="Certain critical GSA system errors normally cause an immediate hard-stop. Enabling this fallback allows these rare technical failures to route to PDMA instead, preventing infrastructure issues from blocking customers."
              tag="KOAA0023"
              tagColor="#F59E0B"
            />
            <ToggleRow
              ruleKey="combo_indicators_stop"
              label="Multiple risk indicators → hard-stop"
              description="If a customer's address triggers multiple GSA risk flags at once (e.g., CMRA + vacant + no-stat), it's treated as a hard-stop. This is on by default as a defence against layered address fraud."
              tag="COMBO"
              tagColor="#F59E0B"
              defaultOn
              tightens
            />
            <ToggleRow
              ruleKey="continue_on_risk_one"
              label="Global continueOnRisk=1 behavior"
              description="When GSA returns a single risk indicator, the normal behavior is to stop. Enabling this makes a single risk flag non-blocking — the customer continues to the next stage. Useful for higher-risk tolerance onboarding strategies."
              tag="RISK-1"
              tagColor="#F59E0B"
            />
            <ToggleRow
              ruleKey="continue_indicators_to_pdma"
              label="Any risk indicator → continue to PDMA"
              description="Any GSA risk indicator currently stops the customer. This override routes all indicator cases to PDMA for secondary checking rather than hard-blocking them at the GSA stage."
              tag="INDICATORS"
              tagColor="#F59E0B"
            />
            <ToggleRow
              ruleKey="normalize_n_unknown_as_blank"
              label="Treat N/UNKNOWN/NULL values as blank"
              description="GSA sometimes returns 'N', 'UNKNOWN', or null for indicator fields. This normalization setting (on by default) treats all three as 'not flagged', preventing false positives from inconsistent GSA response formats."
              tag="NORMALIZE"
              tagColor="#F59E0B"
              defaultOn
            />

            {/* KOEC0039 sub-code severity table */}
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F59E0B', padding: '12px 0 4px', letterSpacing: '0.08em' }}>
              KOEC0039 SUB-CODE SEVERITIES
            </div>
            <div style={{ fontSize: 11, color: 'var(--status-neutral)', marginBottom: 8, lineHeight: 1.6 }}>
              Each KOEC0039 return code can independently be set to PASS (allow through), WARN (flag for review), or STOP (hard-block). Default severity is shown below.
            </div>
            {([
              { code: 'A', desc: 'Address anomaly — general match issue' },
              { code: 'B', desc: 'Address undeliverable' },
              { code: 'H', desc: 'High-rise default — floor/unit missing' },
              { code: 'M', desc: 'Military / APO / FPO address' },
              { code: 'S', desc: 'Secondary unit number required' },
              { code: 'Z', desc: 'Zip code correction applied' },
            ] as const).map(({ code, desc }) => (
              <div key={code} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 0', borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#E2E8F0' }}>
                    KOEC0039-<span style={{ color: '#F59E0B' }}>{code}</span>
                  </span>
                  <div style={{ fontSize: 10, color: 'var(--status-neutral)', marginTop: 1 }}>{desc}</div>
                </div>
                <SeveritySelect
                  value={(overrides[`koec0039_${code}_severity` as keyof RuleOverrides] ?? DEFAULT_OVERRIDES[`koec0039_${code}_severity` as keyof typeof DEFAULT_OVERRIDES]) as string}
                  onChange={v => setOverride(`koec0039_${code}_severity` as keyof RuleOverrides, v)}
                />
              </div>
            ))}

            {/* Override enablement flags */}
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F59E0B', padding: '12px 0 4px', letterSpacing: '0.08em' }}>
              OVERRIDE ENABLEMENT FLAGS
            </div>
            <ToggleRow
              ruleKey="koec0039_override_enabled"
              label="Force NOT_CIP_COMPLIANT for KOEC0039 hits"
              description="When enabled (default), any KOEC0039 result forces the address outcome to NOT_CIP_COMPLIANT regardless of other passing indicators. Disabling this lets the address pass if other checks are clean."
              tag="CIP"
              tagColor="#F59E0B"
              defaultOn
              tightens
            />
            <ToggleRow
              ruleKey="entity_action_change_enabled"
              label="Apply entity-specific recommendation rules"
              description="When enabled (default), the entity type (individual vs business) changes the final recommendation logic. For example, business addresses follow different rules than residential. Disabling this applies a uniform rule set to all entity types."
              tag="ENTITY"
              tagColor="#F59E0B"
              defaultOn
            />
          </Section>

          {/* STAGE 4 — PDMA */}
          <Section
            icon={Building}
            title="Address Verification — PDMA"
            subtitle="PDMA branch-address check overrides and populate-result relaxation"
            stageNum={4}
            stageColor="#8B5CF6"
          >
            <ToggleRow
              ruleKey="pdma_comm_error_allow"
              label="Allow PDMA communication errors"
              description="If the PDMA address service is temporarily down or returns a communication error, the customer is normally hard-stopped. Enabling this allows a PDMA outage to be treated as non-blocking — customers continue to risk evaluation."
              tag="RULE 10"
              tagColor="#8B5CF6"
            />
            <ToggleRow
              ruleKey="pdma_branch_match_allow"
              label="Allow branch-address matches to pass"
              description="PDMA checks whether the customer's address matches a known financial institution branch address (which could indicate address fraud or data errors). Normally this is a stop. Enabling this allows branch-address matches to pass."
              tag="RULE 12"
              tagColor="#8B5CF6"
            />
            <ToggleRow
              ruleKey="pdma_no_return_allow"
              label="Allow missing PDMA response"
              description="If PDMA returns no response at all (timeout, empty body), the customer is hard-stopped. Enabling this treats a missing response as non-blocking — useful in environments with unreliable PDMA connectivity."
              tag="RULE 13"
              tagColor="#8B5CF6"
            />
            <ToggleRow
              ruleKey="populate_result_relax"
              label="populateResult relaxation: NO_RESULT + PDMA pass = COMPLIANT"
              description="This is the key 'last mile' rule. If GSA returns no result (NO_RESULT) but PDMA confirms the address is compliant, the overall address outcome is set to COMPLIANT rather than NOT_CIP_COMPLIANT. This catches many customers who are legitimate but live in addresses GSA doesn't have data on."
              tag="RULE 15"
              tagColor="#8B5CF6"
            />
            <ToggleRow
              ruleKey="relax_no_result_bridge"
              label="GSA NO_RESULT bridged by PDMA pass"
              description="An extension of the populate-result relaxation. When GSA returns NO_RESULT, PDMA's passing result actively 'bridges' the gap and overrides the NO_RESULT to COMPLIANT. Works in conjunction with the rule above."
              tag="BRIDGE"
              tagColor="#8B5CF6"
            />
          </Section>

          {/* STAGE 5 — Risk Evaluation */}
          <Section
            icon={ShieldAlert}
            title="Risk Evaluation"
            subtitle="ML-based risk score thresholds and interdict outcome handling"
            stageNum={5}
            stageColor="#EF4444"
          >
            <ToggleRow
              ruleKey="risk_allow_threshold_lower"
              label="Lower allow threshold (0.40 → 0.30)"
              description="The risk model assigns each customer a fraud probability score. If the score is below the allow threshold, the customer passes. Lowering this threshold from 0.40 to 0.30 means customers with slightly higher risk scores can still be approved — accepting more customers at the cost of marginally higher fraud exposure."
              tag="RISK-ALLOW"
              tagColor="#EF4444"
            />
            <ToggleRow
              ruleKey="risk_block_threshold_higher"
              label="Raise block threshold (0.75 → 0.85)"
              description="The block threshold determines when customers are definitely rejected (high fraud probability). Raising it from 0.75 to 0.85 means fewer customers get hard-blocked — those scoring between 0.75 and 0.85 will now be routed to manual review or allowed through instead."
              tag="RISK-BLOCK"
              tagColor="#EF4444"
            />
            <ToggleRow
              ruleKey="risk_interdict_to_allow"
              label="Treat INTERDICT outcomes as ALLOW"
              description="The risk model can return an INTERDICT outcome for customers who match sanctions or watch-list patterns. Enabling this converts all INTERDICT outcomes to ALLOW — only appropriate in very specific regulatory contexts. This is a high-impact change."
              tag="INTERDICT"
              tagColor="#EF4444"
            />
          </Section>

          {/* Action row */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button
              onClick={runSim}
              disabled={running}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px 0', borderRadius: 8, cursor: running ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(90deg, #00B4D8 0%, #0284C7 100%)',
                border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                fontFamily: 'var(--font-display)', letterSpacing: '0.04em',
                boxShadow: running ? 'none' : 'var(--glow-accent)', opacity: running ? 0.6 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              <Play size={14} />
              {running ? 'Computing…' : `Run Simulation${activeCount > 0 ? ` (${activeCount} change${activeCount > 1 ? 's' : ''})` : ''}`}
            </button>
            <button
              onClick={resetOverrides}
              title="Reset all to defaults"
              style={{
                padding: '11px 14px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                color: 'var(--status-neutral)',
              }}
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* ── RIGHT: Results panel ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Empty state */}
          {!result && !running && (
            <HarnessCard>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 16, textAlign: 'center' }}>
                <TrendingUp size={40} color="var(--border-bright)" />
                <div>
                  <p style={{ color: '#CBD5E1', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No simulation run yet</p>
                  <p style={{ color: 'var(--status-neutral)', fontSize: 12 }}>
                    Expand any section on the left, toggle the rules you want to test, then hit <strong style={{ color: '#CBD5E1' }}>Run Simulation</strong>.<br />
                    Results show how many more (or fewer) customers would be verified with those changes.
                  </p>
                </div>
              </div>
            </HarnessCard>
          )}

          {/* Loading */}
          {running && (
            <HarnessCard>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 20px', gap: 16 }}>
                <div className="skeleton" style={{ width: 220, height: 44 }} />
                <div className="skeleton" style={{ width: '100%', height: 60 }} />
                <div className="skeleton" style={{ width: '100%', height: 120 }} />
                <div style={{ fontSize: 12, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>
                  Replaying {activeCount} rule change{activeCount > 1 ? 's' : ''} across all transactions × 500 bootstrap samples…
                </div>
              </div>
            </HarnessCard>
          )}

          {/* Results */}
          {result && !running && (
            <>
              {/* Plain-English summary */}
              <div style={{
                padding: '14px 16px', borderRadius: 10,
                background: result.delta > 0 ? 'rgba(74,222,128,0.07)' : result.delta < 0 ? 'rgba(248,113,113,0.07)' : 'var(--bg-elevated)',
                border: `1px solid ${result.delta > 0 ? 'rgba(74,222,128,0.25)' : result.delta < 0 ? 'rgba(248,113,113,0.25)' : 'var(--border-subtle)'}`,
              }}>
                <div style={{ fontSize: 13, color: '#E2E8F0', lineHeight: 1.7 }}>
                  {result.delta_absolute > 0 ? (
                    <>With these changes, approximately <strong style={{ color: '#4ADE80' }}>{result.delta_absolute.toLocaleString()} more customers</strong> would successfully complete identity verification — a pass rate increase from <strong>{result.baseline_pass_rate.toFixed(1)}%</strong> to <strong style={{ color: '#4ADE80' }}>{result.simulated_pass_rate.toFixed(1)}%</strong>.</>
                  ) : result.delta_absolute < 0 ? (
                    <>These changes would <strong style={{ color: '#F87171' }}>block {Math.abs(result.delta_absolute).toLocaleString()} additional customers</strong>, tightening the pass rate from <strong>{result.baseline_pass_rate.toFixed(1)}%</strong> to <strong style={{ color: '#F87171' }}>{result.simulated_pass_rate.toFixed(1)}%</strong>.</>
                  ) : (
                    <>No change detected. The selected overrides do not affect the current transaction dataset.</>
                  )}
                </div>
              </div>

              {/* KPI trio */}
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

                {/* 95% CI */}
                <div style={{
                  padding: '10px 14px', borderRadius: 6,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 16,
                }}>
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
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--border-bright)', marginBottom: 8 }}>
                      Which rules recovered customers
                    </div>
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

                {result.affected_count === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--status-neutral)', textAlign: 'center', padding: '12px 0' }}>
                    No transactions in the dataset are affected by the selected overrides.
                  </div>
                )}
              </HarnessCard>

              {/* Runtime + save */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!saveDialogOpen ? (
                  <button
                    onClick={() => setSaveDialogOpen(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                      color: 'var(--status-neutral)', fontSize: 12,
                    }}
                  >
                    <Save size={13} /> Save Scenario
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                    <input
                      autoFocus
                      value={scenarioName}
                      onChange={e => setScenarioName(e.target.value)}
                      placeholder="Name this scenario…"
                      onKeyDown={e => {
                        if (e.key === 'Enter') { saveScenario(scenarioName || 'Untitled Scenario'); setSaveDialogOpen(false); setScenarioName(''); }
                        if (e.key === 'Escape') setSaveDialogOpen(false);
                      }}
                      style={{
                        flex: 1, padding: '6px 10px', borderRadius: 6,
                        background: 'var(--bg-input)', border: '1px solid var(--border-accent)',
                        color: '#E2E8F0', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => { saveScenario(scenarioName || 'Untitled Scenario'); setSaveDialogOpen(false); setScenarioName(''); }}
                      style={{ padding: '6px 14px', borderRadius: 6, cursor: 'pointer', background: 'var(--accent-strong)', border: 'none', color: '#fff', fontSize: 12 }}
                    >Save</button>
                    <button onClick={() => setSaveDialogOpen(false)} style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--status-neutral)', fontSize: 12 }}>×</button>
                  </div>
                )}
                <span style={{ fontSize: 11, color: 'var(--border-bright)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                  {result.runtime_ms}ms · 500 iterations
                </span>
              </div>
            </>
          )}

          {/* Sensitivity curve */}
          {sensitivityData.length > 0 && (
            <HarnessCard title="Sensitivity Analysis" subtitle="Pass rate across common override combinations">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={sensitivityData} margin={{ top: 8, right: 20, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                    formatter={(v: number) => [`${v.toFixed(1)}%`, 'Verified Rate']}
                  />
                  <ReferenceLine y={sensitivityData[0]?.pass_rate} stroke="var(--status-warn)" strokeDasharray="4 4" strokeWidth={1} />
                  <Line
                    type="monotone" dataKey="pass_rate" stroke="var(--accent-primary)" strokeWidth={2.5}
                    dot={{ fill: 'var(--accent-primary)', r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: 'var(--accent-primary)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </HarnessCard>
          )}

          {/* Pipeline reference card */}
          <HarnessCard title="Pipeline Decision Reference">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { outcome: 'COMPLIANT', desc: 'All stages passed. Customer verified.', color: '#4ADE80' },
                { outcome: 'NOT_CIP_COMPLIANT', desc: 'Failed a CIP-required check. Cannot onboard.', color: '#F87171' },
                { outcome: 'PDMA_COMPLIANT', desc: 'GSA inconclusive but PDMA confirmed address.', color: '#A78BFA' },
                { outcome: 'NO_RESULT', desc: 'GSA had no data. Fallback or block applies.', color: '#FCD34D' },
                { outcome: 'ALLOW', desc: 'Risk model scored below block threshold.', color: '#4ADE80' },
                { outcome: 'BLOCK', desc: 'Risk model scored above block threshold.', color: '#F87171' },
                { outcome: 'REVIEW', desc: 'Score in grey zone — manual review queue.', color: '#FCD34D' },
                { outcome: 'INTERDICT', desc: 'Sanctions / watch-list match detected.', color: '#F97316' },
              ].map(row => (
                <div key={row.outcome} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-elevated)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: row.color, fontWeight: 700, whiteSpace: 'nowrap', marginTop: 1 }}>{row.outcome}</span>
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
