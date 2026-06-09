// ── TRANSACTION INPUT ──────────────────────────────────────────────────────
export interface TransactionInput {
  transaction_id: string;
  amount: number;
  merchant_category: string;
  user_id: string;
  location: string;
  device_id: string;
  time_of_day: number; // 0-23
  ip_address: string;
  velocity: number; // transactions per hour
  geo_risk_score: number; // 0-1
  device_trust_score: number; // 0-1
  time_anomaly_score: number; // 0-1
  behavioral_deviation: number; // 0-1
  network_risk_score: number; // 0-1
}

// ── LAYER 1: RULES ENGINE ─────────────────────────────────────────────────
export type RuleStatus = 'PASS' | 'FAIL' | 'WARN';

export interface RuleResult {
  rule_name: string;
  threshold: number | string;
  actual_value: number | string;
  status: RuleStatus;
  risk_weight: number; // 0-1
  description: string;
}

export interface RulesEngineOutput {
  rules: RuleResult[];
  pass_count: number;
  fail_count: number;
  warn_count: number;
  rules_score: number; // 0-100 composite
}

// ── LAYER 2: FEATURE ENGINEERING ─────────────────────────────────────────
export interface FeatureItem {
  feature_name: string;
  raw_value: number;
  normalized_value: number; // 0-1
  importance_weight: number; // 0-1
  display_label: string;
}

export interface FeatureVector {
  features: FeatureItem[];
  vector: number[]; // flat normalized array passed to ML
}

// ── LAYER 3: ML ALGORITHMS ─────────────────────────────────────────────────
export interface MLModelScore {
  model_name: string;
  model_type: 'gradient_boost' | 'neural_network' | 'isolation_forest';
  fraud_probability: number; // 0-1
  confidence: number; // 0-1
  weight: number; // ensemble weight
}

export interface EnsembleScore {
  models: MLModelScore[];
  final_fraud_probability: number; // 0-1
  confidence_low: number;
  confidence_high: number;
  anomaly_score: number; // -1 to 1 (isolation forest)
}

// ── LAYER 4: EXPLAINABILITY ───────────────────────────────────────────────
export interface SHAPValue {
  feature: string;
  shap_value: number; // positive = increases fraud risk
  display_label: string;
  base_value: number;
}

export type AlertLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type RecommendedAction = 'BLOCK' | 'REVIEW' | 'MONITOR' | 'APPROVE';

export interface ReasonCode {
  rank: number;
  code: string;
  description: string;
  contributing_feature: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AuditEntry {
  timestamp: string;
  event: string;
  analyst_id: string;
  details: string;
}

export interface ExplainabilityOutput {
  shap_values: SHAPValue[];
  reason_codes: ReasonCode[];
  alert_level: AlertLevel;
  recommended_action: RecommendedAction;
  audit_trail: AuditEntry[];
  final_score: number; // 0-100
  decision_summary: string;
}

// ── COMBINED PIPELINE RESULT ───────────────────────────────────────────────
export interface PipelineResult {
  transaction: TransactionInput;
  layer1: RulesEngineOutput;
  layer2: FeatureVector;
  layer3: EnsembleScore;
  layer4: ExplainabilityOutput;
  processed_at: string;
  runtime_ms: number;
}

// ── WHAT-IF ───────────────────────────────────────────────────────────────
export interface WhatIfParams {
  amount: number;
  velocity: number;
  geo_risk_score: number;
  device_trust_score: number;
  time_anomaly_score: number;
  merchant_risk_category: 'Low' | 'Medium' | 'High' | 'Critical';
  behavioral_deviation: number;
  network_risk_score: number;
}

export interface WhatIfComparison {
  baseline: PipelineResult;
  scenario: PipelineResult;
  layer1_changes: number;
  layer2_deltas: { feature: string; baseline: number; scenario: number; delta: number }[];
  layer3_delta: number;
  layer4_alert_changed: boolean;
  baseline_alert: AlertLevel;
  scenario_alert: AlertLevel;
}

// ── ALERTS ────────────────────────────────────────────────────────────────
export interface FraudAlert {
  id: string;
  transaction_id: string;
  alert_level: AlertLevel;
  fraud_probability: number;
  recommended_action: RecommendedAction;
  top_reason: string;
  amount: number;
  timestamp: string;
  acknowledged: boolean;
}

// ── APP MODE ──────────────────────────────────────────────────────────────
export type AppMode = 'synthetic' | 'live';
