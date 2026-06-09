import { apiClient } from './client';

export interface RuleOverrides {
  // Document Verification
  doc_submission_error_allow:    boolean;
  doc_unsupported_id_allow:      boolean;
  doc_expired_id_allow:          boolean;
  doc_visual_inconclusive_allow: boolean;
  doc_text_inconclusive_allow:   boolean;
  doc_name_mismatch_allow:       boolean;
  doc_dob_mismatch_allow:        boolean;
  doc_capture_quality_allow:     boolean;
  doc_recapture_limit_3:         boolean;
  // Face Scan
  face_liveness_bypass:          boolean;
  face_selfie_threshold_lower:   boolean;
  // Address — GSA Hard-Stop
  rule_7_cmra_continue:          boolean;
  rule_8_pbsa_continue:          boolean;
  rule_9_pobox_continue:         boolean;
  rule_6_fallthrough:            boolean;
  rule_3_fallthrough:            boolean;
  // Address — GSA Fault Code
  koec0647_retry_enabled:        boolean;
  koec0647_dpv_ds_stop:          boolean;
  koec0692_stop:                 boolean;
  koec0039_a_allow_pdma:         boolean;
  koec0039_b_tighten_stop:       boolean;
  split_koec0039_subcodes:       boolean;
  critical_error_fallback_to_pdma: boolean;
  combo_indicators_stop:         boolean;
  continue_on_risk_one:          boolean;
  continue_indicators_to_pdma:   boolean;
  normalize_n_unknown_as_blank:  boolean;
  // Address — KOEC0039 Sub-Codes
  koec0039_A_severity:           'PASS' | 'WARN' | 'STOP';
  koec0039_B_severity:           'PASS' | 'WARN' | 'STOP';
  koec0039_H_severity:           'PASS' | 'WARN' | 'STOP';
  koec0039_M_severity:           'PASS' | 'WARN' | 'STOP';
  koec0039_S_severity:           'PASS' | 'WARN' | 'STOP';
  koec0039_Z_severity:           'PASS' | 'WARN' | 'STOP';
  // Address — PDMA
  pdma_comm_error_allow:         boolean;
  pdma_branch_match_allow:       boolean;
  pdma_no_return_allow:          boolean;
  // Address — Populate Result
  populate_result_relax:         boolean;
  relax_no_result_bridge:        boolean;
  koec0039_override_enabled:     boolean;
  entity_action_change_enabled:  boolean;
  // Risk Evaluation
  risk_allow_threshold_lower:    boolean;
  risk_block_threshold_higher:   boolean;
  risk_interdict_to_allow:       boolean;
}

export const DEFAULT_OVERRIDES: RuleOverrides = {
  doc_submission_error_allow:    false,
  doc_unsupported_id_allow:      false,
  doc_expired_id_allow:          false,
  doc_visual_inconclusive_allow: false,
  doc_text_inconclusive_allow:   false,
  doc_name_mismatch_allow:       false,
  doc_dob_mismatch_allow:        false,
  doc_capture_quality_allow:     false,
  doc_recapture_limit_3:         false,
  face_liveness_bypass:          false,
  face_selfie_threshold_lower:   false,
  rule_7_cmra_continue:          false,
  rule_8_pbsa_continue:          false,
  rule_9_pobox_continue:         false,
  rule_6_fallthrough:            false,
  rule_3_fallthrough:            false,
  koec0647_retry_enabled:        false,
  koec0647_dpv_ds_stop:          false,
  koec0692_stop:                 false,
  koec0039_a_allow_pdma:         false,
  koec0039_b_tighten_stop:       false,
  split_koec0039_subcodes:       false,
  critical_error_fallback_to_pdma: false,
  combo_indicators_stop:         true,
  continue_on_risk_one:          false,
  continue_indicators_to_pdma:   false,
  normalize_n_unknown_as_blank:  true,
  koec0039_A_severity:           'WARN',
  koec0039_B_severity:           'STOP',
  koec0039_H_severity:           'WARN',
  koec0039_M_severity:           'WARN',
  koec0039_S_severity:           'WARN',
  koec0039_Z_severity:           'STOP',
  pdma_comm_error_allow:         false,
  pdma_branch_match_allow:       false,
  pdma_no_return_allow:          false,
  populate_result_relax:         false,
  relax_no_result_bridge:        false,
  koec0039_override_enabled:     true,
  entity_action_change_enabled:  true,
  risk_allow_threshold_lower:    false,
  risk_block_threshold_higher:   false,
  risk_interdict_to_allow:       false,
};

export interface SimulationResult {
  baseline_pass_rate:  number;
  simulated_pass_rate: number;
  delta:               number;
  delta_absolute:      number;
  ci_95_low:           number;
  ci_95_high:          number;
  affected_count:      number;
  breakdown:           { rule: string; count: number; pct: number }[];
  runtime_ms:          number;
}

export interface SensitivityPoint {
  label:     string;
  pass_rate: number;
  delta:     number;
}

export interface ScenarioCard {
  id:          string;
  name:        string;
  label:       string;
  description: string;
  overrides:   Partial<RuleOverrides>;
  impact:      'HIGH' | 'MED' | 'LOW';
  result:      { delta: number; delta_absolute: number };
}

export async function runSimulation(overrides: Partial<RuleOverrides>): Promise<SimulationResult> {
  const { data } = await apiClient.post('/simulation/run', {
    rule_overrides: { ...DEFAULT_OVERRIDES, ...overrides },
    n_iterations: 500,
  });
  return data;
}

export async function runSensitivitySweep(): Promise<SensitivityPoint[]> {
  const { data } = await apiClient.get('/simulation/sensitivity');
  return data;
}

export async function getScenarioCards(): Promise<ScenarioCard[]> {
  const { data } = await apiClient.get('/simulation/scenarios');
  return (data.presets ?? []).map((s: any) => ({
    id:          s.id,
    name:        s.name,
    label:       s.name,
    description: s.description ?? '',
    overrides:   s.overrides ?? {},
    impact:      (s.impact ?? 'MED') as 'HIGH' | 'MED' | 'LOW',
    result:      { delta: s.result?.delta ?? 0, delta_absolute: s.result?.delta_absolute ?? 0 },
  }));
}

export async function saveScenario(
  name: string,
  overrides: Partial<RuleOverrides>,
  result: SimulationResult,
) {
  const { data } = await apiClient.post('/simulation/save', {
    name,
    rule_overrides: { ...DEFAULT_OVERRIDES, ...overrides },
    result,
  });
  return data;
}
