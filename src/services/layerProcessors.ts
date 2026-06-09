import {
  type TransactionInput, type RulesEngineOutput, type RuleResult,
  type FeatureVector, type FeatureItem, type EnsembleScore, type MLModelScore,
  type ExplainabilityOutput, type SHAPValue, type ReasonCode, type PipelineResult,
  type WhatIfParams,
} from '@/types/fraud.types';

// ── Deterministic RNG ──────────────────────────────────────────────────────
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h);
}

// ── LAYER 1 ───────────────────────────────────────────────────────────────
export function runLayer1(tx: TransactionInput): RulesEngineOutput {
  const rules: RuleResult[] = [
    {
      rule_name: 'Velocity Check',
      threshold: 10, actual_value: tx.velocity,
      status: tx.velocity > 20 ? 'FAIL' : tx.velocity > 10 ? 'WARN' : 'PASS',
      risk_weight: 0.85, description: 'Transactions per hour above threshold indicate card testing',
    },
    {
      rule_name: 'Amount Threshold',
      threshold: 5000, actual_value: tx.amount,
      status: tx.amount > 10000 ? 'FAIL' : tx.amount > 5000 ? 'WARN' : 'PASS',
      risk_weight: 0.7, description: 'High-value transactions require additional scrutiny',
    },
    {
      rule_name: 'Geo-Anomaly',
      threshold: '0.7', actual_value: tx.geo_risk_score.toFixed(2),
      status: tx.geo_risk_score > 0.8 ? 'FAIL' : tx.geo_risk_score > 0.6 ? 'WARN' : 'PASS',
      risk_weight: 0.75, description: 'Geographic risk score exceeds safe threshold',
    },
    {
      rule_name: 'Device Fingerprint',
      threshold: '0.3', actual_value: (1 - tx.device_trust_score).toFixed(2),
      status: tx.device_trust_score < 0.2 ? 'FAIL' : tx.device_trust_score < 0.4 ? 'WARN' : 'PASS',
      risk_weight: 0.8, description: 'Unknown or low-trust device fingerprint detected',
    },
    {
      rule_name: 'Time Pattern',
      threshold: '0.7', actual_value: tx.time_anomaly_score.toFixed(2),
      status: tx.time_anomaly_score > 0.8 ? 'FAIL' : tx.time_anomaly_score > 0.6 ? 'WARN' : 'PASS',
      risk_weight: 0.6, description: 'Transaction time deviates from user behavioral pattern',
    },
    {
      rule_name: 'Blacklist Check',
      threshold: 'Clean', actual_value: tx.network_risk_score > 0.9 ? 'FLAGGED' : 'Clean',
      status: tx.network_risk_score > 0.9 ? 'FAIL' : 'PASS',
      risk_weight: 0.95, description: 'IP or device found on fraud blacklist',
    },
    {
      rule_name: 'Behavioral Deviation',
      threshold: '0.6', actual_value: tx.behavioral_deviation.toFixed(2),
      status: tx.behavioral_deviation > 0.75 ? 'FAIL' : tx.behavioral_deviation > 0.55 ? 'WARN' : 'PASS',
      risk_weight: 0.65, description: 'User behavior significantly deviates from established pattern',
    },
    {
      rule_name: 'Merchant Risk Score',
      threshold: 'Medium', actual_value: tx.merchant_category,
      status: tx.merchant_category === 'Critical' ? 'FAIL' : tx.merchant_category === 'High' ? 'WARN' : 'PASS',
      risk_weight: 0.55, description: 'Merchant category is associated with elevated fraud rates',
    },
  ];

  const pass_count = rules.filter(r => r.status === 'PASS').length;
  const fail_count = rules.filter(r => r.status === 'FAIL').length;
  const warn_count = rules.filter(r => r.status === 'WARN').length;

  const failWeight = rules.filter(r => r.status === 'FAIL').reduce((s, r) => s + r.risk_weight, 0);
  const warnWeight = rules.filter(r => r.status === 'WARN').reduce((s, r) => s + r.risk_weight * 0.5, 0);
  const totalWeight = rules.reduce((s, r) => s + r.risk_weight, 0);
  const rules_score = Math.min(100, Math.round(((failWeight + warnWeight) / totalWeight) * 100));

  return { rules, pass_count, fail_count, warn_count, rules_score };
}

// ── LAYER 2 ───────────────────────────────────────────────────────────────
export function runLayer2(tx: TransactionInput, l1: RulesEngineOutput): FeatureVector {
  const normalize = (v: number, min: number, max: number) => Math.min(1, Math.max(0, (v - min) / (max - min)));

  const features: FeatureItem[] = [
    {
      feature_name: 'velocity_score',
      display_label: 'Velocity Score',
      raw_value: tx.velocity,
      normalized_value: normalize(tx.velocity, 0, 50),
      importance_weight: 0.85,
    },
    {
      feature_name: 'amount_zscore',
      display_label: 'Amount Z-Score',
      raw_value: tx.amount,
      normalized_value: normalize(tx.amount, 0, 50000),
      importance_weight: 0.70,
    },
    {
      feature_name: 'geo_risk_index',
      display_label: 'Geo Risk Index',
      raw_value: tx.geo_risk_score,
      normalized_value: tx.geo_risk_score,
      importance_weight: 0.75,
    },
    {
      feature_name: 'device_trust_score',
      display_label: 'Device Trust (inverted)',
      raw_value: tx.device_trust_score,
      normalized_value: 1 - tx.device_trust_score,
      importance_weight: 0.80,
    },
    {
      feature_name: 'time_anomaly_score',
      display_label: 'Time Anomaly',
      raw_value: tx.time_anomaly_score,
      normalized_value: tx.time_anomaly_score,
      importance_weight: 0.60,
    },
    {
      feature_name: 'merchant_risk_score',
      display_label: 'Merchant Risk',
      raw_value: { Low: 0.1, Medium: 0.4, High: 0.7, Critical: 1.0 }[tx.merchant_category] ?? 0.4,
      normalized_value: { Low: 0.1, Medium: 0.4, High: 0.7, Critical: 1.0 }[tx.merchant_category] ?? 0.4,
      importance_weight: 0.55,
    },
    {
      feature_name: 'behavioral_deviation',
      display_label: 'Behavioral Deviation',
      raw_value: tx.behavioral_deviation,
      normalized_value: tx.behavioral_deviation,
      importance_weight: 0.65,
    },
    {
      feature_name: 'network_risk_score',
      display_label: 'Network Risk',
      raw_value: tx.network_risk_score,
      normalized_value: tx.network_risk_score,
      importance_weight: 0.72,
    },
  ];

  return {
    features,
    vector: features.map(f => f.normalized_value),
  };
}

// ── LAYER 3 ───────────────────────────────────────────────────────────────
export function runLayer3(l2: FeatureVector, seed?: number): EnsembleScore {
  const rng = seededRandom(seed ?? Math.floor(Math.random() * 10000));
  const v = l2.vector;

  // Weighted sum approximating XGBoost-style scoring
  const weights = [0.85, 0.70, 0.75, 0.80, 0.60, 0.55, 0.65, 0.72];
  const raw = v.reduce((s, val, i) => s + val * weights[i], 0) / weights.reduce((a, b) => a + b, 0);

  const xgb_prob = Math.min(0.99, Math.max(0.01, raw * 0.9 + rng() * 0.1));
  const nn_prob  = Math.min(0.99, Math.max(0.01, raw * 0.85 + rng() * 0.15));
  const iso_score = -0.5 + raw * 0.8 + rng() * 0.2;

  const iso_prob = Math.min(0.99, Math.max(0.01, (iso_score + 0.5) * 0.8));

  const models: MLModelScore[] = [
    { model_name: 'XGBoost',          model_type: 'gradient_boost',    fraud_probability: xgb_prob, confidence: 0.88, weight: 0.50 },
    { model_name: 'Neural Network',   model_type: 'neural_network',     fraud_probability: nn_prob,  confidence: 0.82, weight: 0.35 },
    { model_name: 'Isolation Forest', model_type: 'isolation_forest',   fraud_probability: iso_prob, confidence: 0.74, weight: 0.15 },
  ];

  const final_fraud_probability = models.reduce((s, m) => s + m.fraud_probability * m.weight, 0);
  const noise = rng() * 0.05;

  return {
    models,
    final_fraud_probability,
    confidence_low:  Math.max(0, final_fraud_probability - 0.08 - noise),
    confidence_high: Math.min(1, final_fraud_probability + 0.08 + noise),
    anomaly_score: iso_score,
  };
}

// ── LAYER 4 ───────────────────────────────────────────────────────────────
export function runLayer4(
  tx: TransactionInput,
  l1: RulesEngineOutput,
  l2: FeatureVector,
  l3: EnsembleScore,
): ExplainabilityOutput {
  const prob = l3.final_fraud_probability;
  const baseVal = 0.12;

  // Approximate SHAP values from feature importance × deviation from base
  const shap_values: SHAPValue[] = l2.features.map(f => ({
    feature: f.feature_name,
    display_label: f.display_label,
    shap_value: (f.normalized_value - 0.3) * f.importance_weight * 0.6,
    base_value: baseVal,
  })).sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value));

  // Alert level
  const alert_level = prob >= 0.75 ? 'CRITICAL' : prob >= 0.5 ? 'HIGH' : prob >= 0.25 ? 'MEDIUM' : 'LOW';
  const recommended_action =
    prob >= 0.75 ? 'BLOCK' : prob >= 0.5 ? 'REVIEW' : prob >= 0.25 ? 'MONITOR' : 'APPROVE';

  // Reason codes from highest SHAP magnitude
  const reason_codes: ReasonCode[] = shap_values.slice(0, 5).map((s, i) => ({
    rank: i + 1,
    code: `FRAUD-${String(i + 1).padStart(3, '0')}`,
    description: shap_reason(s.feature, s.shap_value, tx),
    contributing_feature: s.display_label,
    impact: Math.abs(s.shap_value) > 0.15 ? 'HIGH' : Math.abs(s.shap_value) > 0.07 ? 'MEDIUM' : 'LOW',
  }));

  const final_score = Math.round(prob * 100);

  return {
    shap_values,
    reason_codes,
    alert_level,
    recommended_action,
    final_score,
    decision_summary: buildSummary(alert_level, recommended_action, final_score, reason_codes[0]),
    audit_trail: [
      { timestamp: new Date().toISOString(), event: 'PIPELINE_INITIATED', analyst_id: 'system', details: `Transaction ${tx.transaction_id} submitted for analysis` },
      { timestamp: new Date().toISOString(), event: 'RULES_EVALUATED',    analyst_id: 'system', details: `${l1.pass_count} passed, ${l1.fail_count} failed, ${l1.warn_count} warnings` },
      { timestamp: new Date().toISOString(), event: 'ML_SCORED',          analyst_id: 'system', details: `Ensemble fraud probability: ${(prob * 100).toFixed(1)}%` },
      { timestamp: new Date().toISOString(), event: 'DECISION_RENDERED',  analyst_id: 'system', details: `Alert: ${alert_level} · Action: ${recommended_action}` },
    ],
  };
}

function shap_reason(feature: string, val: number, tx: TransactionInput): string {
  const reasons: Record<string, string> = {
    velocity_score:      `Transaction velocity (${tx.velocity}/hr) ${val > 0 ? 'significantly exceeds' : 'is within'} normal user pattern`,
    amount_zscore:       `Transaction amount ($${tx.amount.toLocaleString()}) ${val > 0 ? 'is unusually high' : 'is within normal range'} for this user`,
    geo_risk_index:      `Geographic origin has ${val > 0 ? 'elevated' : 'low'} fraud association (score: ${tx.geo_risk_score.toFixed(2)})`,
    device_trust_score:  `Device ${val > 0 ? 'has not been seen before or has low trust score' : 'is a recognized trusted device'}`,
    time_anomaly_score:  `Transaction time ${val > 0 ? 'deviates significantly from user\'s behavioral window' : 'is consistent with typical activity'}`,
    merchant_risk_score: `Merchant category "${tx.merchant_category}" is ${val > 0 ? 'associated with elevated fraud rates' : 'low-risk'}`,
    behavioral_deviation:`Behavioral pattern deviation score ${val > 0 ? 'exceeds' : 'is below'} acceptable threshold`,
    network_risk_score:  `Network indicators ${val > 0 ? 'suggest proxy/VPN usage or flagged IP range' : 'are clean'}`,
  };
  return reasons[feature] ?? `Feature "${feature}" contributed ${val > 0 ? 'positively' : 'negatively'} to fraud score`;
}

function buildSummary(alert: string, action: string, score: number, top: ReasonCode | undefined): string {
  if (alert === 'CRITICAL') return `CRITICAL FRAUD ALERT (${score}% probability) — ${action} recommended. Primary signal: ${top?.description ?? 'multiple high-risk indicators'}`;
  if (alert === 'HIGH')     return `High fraud risk detected (${score}%) — ${action} for manual review. ${top?.description ?? ''}`;
  if (alert === 'MEDIUM')   return `Moderate fraud signals (${score}%) — transaction placed under monitoring. ${top?.description ?? ''}`;
  return `Low fraud risk (${score}%) — transaction approved with standard monitoring.`;
}

// ── FULL PIPELINE ─────────────────────────────────────────────────────────
export function runFullPipeline(tx: TransactionInput): PipelineResult {
  const t0 = performance.now();
  const seed = hashStr(tx.transaction_id + tx.user_id);
  const l1 = runLayer1(tx);
  const l2 = runLayer2(tx, l1);
  const l3 = runLayer3(l2, seed);
  const l4 = runLayer4(tx, l1, l2, l3);
  return {
    transaction: tx,
    layer1: l1, layer2: l2, layer3: l3, layer4: l4,
    processed_at: new Date().toISOString(),
    runtime_ms: Math.round(performance.now() - t0),
  };
}

// ── SYNTHETIC TRANSACTION GENERATOR ──────────────────────────────────────
export const MERCHANT_CATEGORIES = ['Low', 'Medium', 'High', 'Critical'] as const;

export function generateSyntheticTransaction(overrides?: Partial<TransactionInput>): TransactionInput {
  const rng = seededRandom(Math.floor(Math.random() * 999999));
  const id = `TXN-${Date.now().toString(36).toUpperCase()}`;
  return {
    transaction_id:    id,
    amount:            Math.round(50 + rng() * 9950),
    merchant_category: MERCHANT_CATEGORIES[Math.floor(rng() * 4)],
    user_id:           `USR-${Math.floor(rng() * 9999).toString().padStart(4, '0')}`,
    location:          ['New York', 'Los Angeles', 'Miami', 'Chicago', 'London', 'Lagos'][Math.floor(rng() * 6)],
    device_id:         `DEV-${Math.floor(rng() * 99999).toString(16).toUpperCase()}`,
    time_of_day:       Math.floor(rng() * 24),
    ip_address:        `${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}.1`,
    velocity:          Math.round(1 + rng() * 30),
    geo_risk_score:    parseFloat((rng() * 0.9).toFixed(2)),
    device_trust_score: parseFloat((0.1 + rng() * 0.9).toFixed(2)),
    time_anomaly_score: parseFloat((rng() * 0.9).toFixed(2)),
    behavioral_deviation: parseFloat((rng() * 0.9).toFixed(2)),
    network_risk_score: parseFloat((rng() * 0.9).toFixed(2)),
    ...overrides,
  };
}

// ── PRESET SCENARIOS ──────────────────────────────────────────────────────
export interface FraudScenario {
  name: string;
  description: string;
  color: string;
  overrides: Partial<TransactionInput>;
}

export const FRAUD_SCENARIOS: FraudScenario[] = [
  {
    name: 'High Amount Attack',
    description: 'Large single transaction with unusual device',
    color: '#EF4444',
    overrides: { amount: 45000, velocity: 2, device_trust_score: 0.15, behavioral_deviation: 0.8, network_risk_score: 0.7, merchant_category: 'High' },
  },
  {
    name: 'Velocity Fraud',
    description: 'Card testing with rapid small transactions',
    color: '#F97316',
    overrides: { amount: 1, velocity: 48, device_trust_score: 0.3, behavioral_deviation: 0.9, geo_risk_score: 0.7 },
  },
  {
    name: 'Account Takeover',
    description: 'Compromised account from unusual location',
    color: '#A855F7',
    overrides: { geo_risk_score: 0.92, device_trust_score: 0.05, behavioral_deviation: 0.95, network_risk_score: 0.88, time_anomaly_score: 0.85 },
  },
  {
    name: 'Card Testing',
    description: 'Small amounts testing card validity',
    color: '#06B6D4',
    overrides: { amount: 1, velocity: 35, merchant_category: 'Critical', behavioral_deviation: 0.88, network_risk_score: 0.82 },
  },
  {
    name: 'Geo Spoofing',
    description: 'Suspicious location and network mismatch',
    color: '#10B981',
    overrides: { geo_risk_score: 0.95, network_risk_score: 0.92, time_anomaly_score: 0.78, device_trust_score: 0.2, behavioral_deviation: 0.65 },
  },
];

// ── WHAT-IF PIPELINE ──────────────────────────────────────────────────────
export function runWhatIfPipeline(
  params: WhatIfParams,
  baseline_tx: TransactionInput,
): { scenario_tx: TransactionInput; scenario_result: PipelineResult; baseline_result: PipelineResult } {
  const merchantMap = { Low: 0, Medium: 1, High: 2, Critical: 3 } as const;

  const scenario_tx: TransactionInput = {
    ...baseline_tx,
    amount:              params.amount,
    velocity:            params.velocity,
    geo_risk_score:      params.geo_risk_score,
    device_trust_score:  params.device_trust_score,
    time_anomaly_score:  params.time_anomaly_score,
    merchant_category:   params.merchant_risk_category,
    behavioral_deviation: params.behavioral_deviation,
    network_risk_score:  params.network_risk_score,
  };

  return {
    scenario_tx,
    scenario_result: runFullPipeline(scenario_tx),
    baseline_result: runFullPipeline(baseline_tx),
  };
}

// ── GENERATE HISTORICAL ALERTS ────────────────────────────────────────────
import type { FraudAlert } from '@/types/fraud.types';

export function generateHistoricalAlerts(count = 20): FraudAlert[] {
  const alerts: FraudAlert[] = [];
  const levels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
  const actions = ['BLOCK', 'REVIEW', 'MONITOR', 'APPROVE'] as const;
  const reasons = [
    'Unusually high transaction velocity',
    'Geographic location mismatch',
    'Unknown device fingerprint',
    'Large amount deviation from baseline',
    'Night-time transaction anomaly',
    'High-risk merchant category',
    'Behavioral pattern deviation',
    'Blacklisted IP range',
  ];
  for (let i = 0; i < count; i++) {
    const rng = seededRandom(i * 137 + 42);
    const prob = rng();
    const level = prob > 0.75 ? 'CRITICAL' : prob > 0.5 ? 'HIGH' : prob > 0.25 ? 'MEDIUM' : 'LOW';
    const action = prob > 0.75 ? 'BLOCK' : prob > 0.5 ? 'REVIEW' : prob > 0.25 ? 'MONITOR' : 'APPROVE';
    alerts.push({
      id: `ALERT-${String(i + 1).padStart(4, '0')}`,
      transaction_id: `TXN-${(1000 + i).toString(36).toUpperCase()}`,
      alert_level: level,
      fraud_probability: parseFloat(prob.toFixed(2)),
      recommended_action: action,
      top_reason: reasons[Math.floor(rng() * reasons.length)],
      amount: Math.round(50 + rng() * 9950),
      timestamp: new Date(Date.now() - i * 3600000 * (1 + rng() * 3)).toISOString(),
      acknowledged: rng() > 0.5,
    });
  }
  return alerts;
}
