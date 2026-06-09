import { useState } from 'react';
import { useFraudStore } from '@/store/fraudStore';
import { generateSyntheticTransaction, MERCHANT_CATEGORIES } from '@/services/layerProcessors';
import { PipelineFlow } from './components/PipelineFlow';
import { Layer1RulesEngine } from './components/Layer1RulesEngine';
import { Layer2FeatureEngineering } from './components/Layer2FeatureEngineering';
import { Layer3MLAlgorithms } from './components/Layer3MLAlgorithms';
import { Layer4Explainability } from './components/Layer4Explainability';
import { HarnessCard } from '@/design-system/components';
import { Play, Shuffle, ChevronDown, ChevronRight } from 'lucide-react';
import { type TransactionInput } from '@/types/fraud.types';

const LAYER_COLORS = ['#8B5CF6', '#3B82F6', '#F97316', '#EC4899'];
const LAYER_LABELS = ['Rules Engine', 'Feature Engineering', 'ML Algorithms', 'Explainability'];

function CollapsibleLayer({ num, label, color, children, defaultOpen = true }: {
  num: number; label: string; color: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${open ? color + '44' : 'var(--border-subtle)'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', background: open ? `${color}0C` : 'var(--bg-surface)',
        border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: `${color}22`, border: `1px solid ${color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, color,
        }}>{num}</div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color, fontWeight: 700, letterSpacing: '0.06em' }}>LAYER {num} · </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>{label}</span>
        </div>
        {open ? <ChevronDown size={14} color="var(--status-neutral)" /> : <ChevronRight size={14} color="var(--status-neutral)" />}
      </button>
      {open && <div style={{ padding: '16px 20px', background: 'var(--bg-surface)' }}>{children}</div>}
    </div>
  );
}

function TxField({ label, field, type = 'text', options }: {
  label: string; field: keyof TransactionInput; type?: string; options?: string[];
}) {
  const { currentTx, setCurrentTx } = useFraudStore();
  const val = currentTx[field];

  if (options) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <label style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>{label}</label>
        <select
          value={String(val)}
          onChange={e => setCurrentTx({ [field]: e.target.value } as Partial<TransactionInput>)}
          style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: '#E2E8F0', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }}
        >
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>{label}</label>
      <input
        type={type} value={String(val)}
        onChange={e => setCurrentTx({ [field]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value } as Partial<TransactionInput>)}
        style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: '#E2E8F0', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }}
      />
    </div>
  );
}

export function TransactionAnalysis() {
  const { currentTx, setCurrentTx, analyzeTransaction, pipelineResult, isProcessing, processingLayer } = useFraudStore();
  const [highlightedFeature, setHighlightedFeature] = useState<string | null>(null);

  const completedLayers = pipelineResult
    ? [1, 2, 3, 4]
    : isProcessing
      ? Array.from({ length: processingLayer - 1 }, (_, i) => i + 1)
      : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fade-in 0.4s ease' }}>

      {/* Pipeline stepper */}
      <PipelineFlow
        currentLayer={isProcessing ? processingLayer as 1|2|3|4 : 0}
        completedLayers={completedLayers}
      />

      {/* Input panel */}
      <HarnessCard title="Transaction Input" glow="accent" action={
        <button onClick={() => setCurrentTx(generateSyntheticTransaction())} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          color: 'var(--status-neutral)', fontSize: 11, cursor: 'pointer',
        }}>
          <Shuffle size={11} /> Randomize
        </button>
      }>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          <TxField label="Transaction ID"    field="transaction_id" />
          <TxField label="Amount ($)"        field="amount"          type="number" />
          <TxField label="User ID"           field="user_id" />
          <TxField label="Device ID"         field="device_id" />
          <TxField label="Location"          field="location" />
          <TxField label="IP Address"        field="ip_address" />
          <TxField label="Time of Day (0-23)" field="time_of_day"    type="number" />
          <TxField label="Merchant Category" field="merchant_category" options={[...MERCHANT_CATEGORIES]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          <TxField label="Velocity (txn/hr)"     field="velocity"           type="number" />
          <TxField label="Geo Risk (0-1)"         field="geo_risk_score"     type="number" />
          <TxField label="Device Trust (0-1)"     field="device_trust_score" type="number" />
          <TxField label="Time Anomaly (0-1)"     field="time_anomaly_score" type="number" />
          <TxField label="Behavioral Dev. (0-1)"  field="behavioral_deviation" type="number" />
          <TxField label="Network Risk (0-1)"     field="network_risk_score" type="number" />
        </div>
        <button
          onClick={analyzeTransaction}
          disabled={isProcessing}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 24px', borderRadius: 8, cursor: isProcessing ? 'not-allowed' : 'pointer',
            background: 'linear-gradient(90deg, #8B5CF6 0%, #6D28D9 100%)',
            border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
            fontFamily: 'var(--font-display)', letterSpacing: '0.04em',
            boxShadow: isProcessing ? 'none' : '0 0 16px rgba(139,92,246,0.5)',
            opacity: isProcessing ? 0.6 : 1,
          }}
        >
          <Play size={14} />
          {isProcessing ? `Processing Layer ${processingLayer}…` : 'Analyze Transaction'}
        </button>
      </HarnessCard>

      {/* 4 Layer results */}
      {(pipelineResult || isProcessing) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Layer 1 */}
          <CollapsibleLayer num={1} label={LAYER_LABELS[0]} color={LAYER_COLORS[0]}>
            {isProcessing && processingLayer <= 1 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--status-neutral)', fontSize: 12 }}>Evaluating rules…</div>
            ) : pipelineResult ? (
              <Layer1RulesEngine data={pipelineResult.layer1} highlightedFeature={highlightedFeature} />
            ) : null}
          </CollapsibleLayer>

          {/* Layer 1 → 2 connector */}
          {pipelineResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 24px' }}>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #8B5CF6, #3B82F6)' }} />
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--border-bright)', whiteSpace: 'nowrap' }}>
                rules_score = {pipelineResult.layer1.rules_score} → feature extraction
              </div>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #8B5CF6, #3B82F6)' }} />
            </div>
          )}

          {/* Layer 2 */}
          <CollapsibleLayer num={2} label={LAYER_LABELS[1]} color={LAYER_COLORS[1]}>
            {isProcessing && processingLayer <= 2 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--status-neutral)', fontSize: 12 }}>Extracting feature vector…</div>
            ) : pipelineResult ? (
              <Layer2FeatureEngineering data={pipelineResult.layer2} onFeatureHover={setHighlightedFeature} />
            ) : null}
          </CollapsibleLayer>

          {/* Layer 2 → 3 connector */}
          {pipelineResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 24px' }}>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #3B82F6, #F97316)' }} />
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--border-bright)', whiteSpace: 'nowrap' }}>
                vector [{pipelineResult.layer2.vector.map(v => v.toFixed(2)).join(', ')}] → ML scoring
              </div>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #3B82F6, #F97316)' }} />
            </div>
          )}

          {/* Layer 3 */}
          <CollapsibleLayer num={3} label={LAYER_LABELS[2]} color={LAYER_COLORS[2]}>
            {isProcessing && processingLayer <= 3 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--status-neutral)', fontSize: 12 }}>Running ML models in parallel…</div>
            ) : pipelineResult ? (
              <Layer3MLAlgorithms data={pipelineResult.layer3} />
            ) : null}
          </CollapsibleLayer>

          {/* Layer 3 → 4 connector */}
          {pipelineResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 24px' }}>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #F97316, #EC4899)' }} />
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--border-bright)', whiteSpace: 'nowrap' }}>
                fraud_probability = {(pipelineResult.layer3.final_fraud_probability * 100).toFixed(1)}% → explainability
              </div>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #F97316, #EC4899)' }} />
            </div>
          )}

          {/* Layer 4 */}
          <CollapsibleLayer num={4} label={LAYER_LABELS[3]} color={LAYER_COLORS[3]}>
            {isProcessing && processingLayer <= 4 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--status-neutral)', fontSize: 12 }}>Generating SHAP explanations…</div>
            ) : pipelineResult ? (
              <Layer4Explainability data={pipelineResult.layer4} onFeatureHover={setHighlightedFeature} />
            ) : null}
          </CollapsibleLayer>

          {pipelineResult && (
            <div style={{ fontSize: 11, color: 'var(--border-bright)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
              Pipeline completed in {pipelineResult.runtime_ms}ms
            </div>
          )}
        </div>
      )}

      {!pipelineResult && !isProcessing && (
        <div style={{
          textAlign: 'center', padding: '60px 20px', color: 'var(--status-neutral)',
          fontSize: 13, border: '1px dashed var(--border-subtle)', borderRadius: 10,
        }}>
          Configure a transaction above and click <strong style={{ color: '#8B5CF6' }}>Analyze Transaction</strong> to run the full 4-layer pipeline.
        </div>
      )}
    </div>
  );
}
