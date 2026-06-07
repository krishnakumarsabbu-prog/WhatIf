import { apiClient } from './client';

export interface RuleOverrides {
  rule_7_cmra_continue:   boolean;
  rule_8_pbsa_continue:   boolean;
  rule_9_pobox_continue:  boolean;
  rule_6_fallthrough:     boolean;
  rule_3_fallthrough:     boolean;
  populate_result_relax:  boolean;
  koec0039_A_severity:    'PASS' | 'WARN' | 'STOP';
  koec0039_B_severity:    'PASS' | 'WARN' | 'STOP';
  koec0039_H_severity:    'PASS' | 'WARN' | 'STOP';
  koec0039_M_severity:    'PASS' | 'WARN' | 'STOP';
  koec0039_S_severity:    'PASS' | 'WARN' | 'STOP';
  koec0039_Z_severity:    'PASS' | 'WARN' | 'STOP';
}

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
  impact:      'HIGH' | 'MEDIUM' | 'LOW';
  result:      { delta: number; delta_absolute: number };
}

export const DEFAULT_OVERRIDES: RuleOverrides = {
  rule_7_cmra_continue:   false,
  rule_8_pbsa_continue:   false,
  rule_9_pobox_continue:  false,
  rule_6_fallthrough:     false,
  rule_3_fallthrough:     false,
  populate_result_relax:  false,
  koec0039_A_severity:    'WARN',
  koec0039_B_severity:    'STOP',
  koec0039_H_severity:    'WARN',
  koec0039_M_severity:    'WARN',
  koec0039_S_severity:    'WARN',
  koec0039_Z_severity:    'STOP',
};

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
    impact:      (s.impact ?? 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW',
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
