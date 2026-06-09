import { create } from 'zustand';
import {
  type TransactionInput, type PipelineResult, type WhatIfParams,
  type FraudAlert, type AppMode,
} from '@/types/fraud.types';
import {
  runFullPipeline, generateSyntheticTransaction, generateHistoricalAlerts,
  runWhatIfPipeline,
} from '@/services/layerProcessors';

interface FraudStore {
  // Mode
  mode: AppMode;
  setMode: (m: AppMode) => void;

  // Transaction analysis
  currentTx: TransactionInput;
  setCurrentTx: (tx: Partial<TransactionInput>) => void;
  pipelineResult: PipelineResult | null;
  isProcessing: boolean;
  processingLayer: 0 | 1 | 2 | 3 | 4;
  analyzeTransaction: () => void;

  // What-If
  whatIfParams: WhatIfParams;
  setWhatIfParam: <K extends keyof WhatIfParams>(key: K, val: WhatIfParams[K]) => void;
  whatIfResult: { scenario: PipelineResult; baseline: PipelineResult } | null;
  runWhatIf: () => void;

  // Alerts
  alerts: FraudAlert[];
  acknowledgeAlert: (id: string) => void;
  addAlert: (result: PipelineResult) => void;

  // History
  history: PipelineResult[];
}

function defaultWhatIfParams(): WhatIfParams {
  return {
    amount: 2500,
    velocity: 5,
    geo_risk_score: 0.3,
    device_trust_score: 0.7,
    time_anomaly_score: 0.2,
    merchant_risk_category: 'Medium',
    behavioral_deviation: 0.25,
    network_risk_score: 0.2,
  };
}

export const useFraudStore = create<FraudStore>((set, get) => ({
  mode: 'synthetic',
  setMode: (m) => set({ mode: m }),

  currentTx: generateSyntheticTransaction(),
  setCurrentTx: (tx) => set(s => ({ currentTx: { ...s.currentTx, ...tx } })),
  pipelineResult: null,
  isProcessing: false,
  processingLayer: 0,

  analyzeTransaction: async () => {
    const tx = get().currentTx;
    set({ isProcessing: true, processingLayer: 1, pipelineResult: null });

    // Animate through layers with delay
    for (let layer = 1; layer <= 4; layer++) {
      await new Promise<void>(resolve => setTimeout(resolve, 600));
      set({ processingLayer: layer as 1 | 2 | 3 | 4 });
    }

    await new Promise<void>(resolve => setTimeout(resolve, 400));
    const result = runFullPipeline(tx);

    set({ pipelineResult: result, isProcessing: false, processingLayer: 0 });
    get().addAlert(result);
    set(s => ({ history: [result, ...s.history.slice(0, 49)] }));
  },

  whatIfParams: defaultWhatIfParams(),
  setWhatIfParam: (key, val) => set(s => ({ whatIfParams: { ...s.whatIfParams, [key]: val } })),
  whatIfResult: null,

  runWhatIf: () => {
    const { whatIfParams, currentTx } = get();
    const { scenario_result, baseline_result } = runWhatIfPipeline(whatIfParams, currentTx);
    set({ whatIfResult: { scenario: scenario_result, baseline: baseline_result } });
  },

  alerts: generateHistoricalAlerts(25),
  acknowledgeAlert: (id) => set(s => ({
    alerts: s.alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a),
  })),
  addAlert: (result) => {
    const l4 = result.layer4;
    if (l4.alert_level === 'LOW' && Math.random() > 0.3) return;
    const alert: FraudAlert = {
      id: `ALERT-${Date.now().toString(36).toUpperCase()}`,
      transaction_id: result.transaction.transaction_id,
      alert_level: l4.alert_level,
      fraud_probability: result.layer3.final_fraud_probability,
      recommended_action: l4.recommended_action,
      top_reason: l4.reason_codes[0]?.description ?? '',
      amount: result.transaction.amount,
      timestamp: result.processed_at,
      acknowledged: false,
    };
    set(s => ({ alerts: [alert, ...s.alerts.slice(0, 99)] }));
  },

  history: [],
}));
