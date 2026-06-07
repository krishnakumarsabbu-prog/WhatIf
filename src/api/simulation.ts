/**
 * What-If Simulation Engine — pure JS, runs against in-memory DB.
 * Implements:
 *   1. Counterfactual Resampling  — re-evaluate each declined tx under rule overrides
 *   2. Bootstrap CI               — 95% confidence interval on Δ pass_rate
 *   3. Sensitivity Sweep          — sweep a single parameter across its range
 */
import { db, type Transaction } from '@/lib/db';

export interface RuleOverrides {
  rule_7_cmra_continue:    boolean;
  rule_8_pbsa_continue:    boolean;
  rule_9_pobox_continue:   boolean;
  rule_6_fallthrough:      boolean;
  rule_3_fallthrough:      boolean;
  populate_result_relax:   boolean;
  koec0039_A_severity:     'PASS' | 'WARN' | 'STOP';
  koec0039_B_severity:     'PASS' | 'WARN' | 'STOP';
  koec0039_H_severity:     'PASS' | 'WARN' | 'STOP';
  koec0039_M_severity:     'PASS' | 'WARN' | 'STOP';
  koec0039_S_severity:     'PASS' | 'WARN' | 'STOP';
  koec0039_Z_severity:     'PASS' | 'WARN' | 'STOP';
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
  value:     number;
  pass_rate: number;
  delta:     number;
}

// Empirical rates derived from the in-memory dataset
function getEmpiricalRates() {
  const txs = db.transactions;
  const withPdma = txs.filter(t => t.pdma_result !== null);
  const pdmaPass = withPdma.filter(t => t.pdma_result === 'ADDRESS_CIP_COMPLIANT').length;
  const pdmaRate = withPdma.length > 0 ? pdmaPass / withPdma.length : 0.91;

  const withRisk = txs.filter(t => t.risk_result !== null);
  const riskAllow = withRisk.filter(t => t.risk_result === 'ALLOW').length;
  const riskRate = withRisk.length > 0 ? riskAllow / withRisk.length : 0.92;

  return { pdmaRate, riskRate };
}

// Seeded RNG per transaction so counterfactuals are reproducible
function txRng(txId: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < txId.length; i++) {
    h = Math.imul(h ^ txId.charCodeAt(i), 0x9e3779b9);
    h = h ^ (h >>> 16);
  }
  return (h >>> 0) / 0xFFFFFFFF;
}

function applyOverride(tx: Transaction, overrides: RuleOverrides, pdmaRate: number, riskRate: number): {
  newOutcome: string;
  triggeredRule: string | null;
} {
  if (tx.final_result === 'IDENTITY_VERIFIED') return { newOutcome: 'IDENTITY_VERIFIED', triggeredRule: null };

  // CMRA Rule 7
  if (overrides.rule_7_cmra_continue && tx.cmra_flag && overrides.populate_result_relax) {
    const passes = txRng(tx.transaction_id, 1) < pdmaRate && txRng(tx.transaction_id, 2) < riskRate;
    return { newOutcome: passes ? 'IDENTITY_VERIFIED' : 'IDENTITY_NOT_VERIFIED', triggeredRule: 'Rule 7 + populateResult' };
  }

  // PBSA Rule 8
  if (overrides.rule_8_pbsa_continue && tx.pbsa_flag && overrides.populate_result_relax) {
    const passes = txRng(tx.transaction_id, 3) < pdmaRate && txRng(tx.transaction_id, 4) < riskRate;
    return { newOutcome: passes ? 'IDENTITY_VERIFIED' : 'IDENTITY_NOT_VERIFIED', triggeredRule: 'Rule 8 + populateResult' };
  }

  // POBox Rule 9
  if (overrides.rule_9_pobox_continue && tx.pobox_flag && overrides.populate_result_relax) {
    const passes = txRng(tx.transaction_id, 5) < pdmaRate && txRng(tx.transaction_id, 6) < riskRate;
    return { newOutcome: passes ? 'IDENTITY_VERIFIED' : 'IDENTITY_NOT_VERIFIED', triggeredRule: 'Rule 9 + populateResult' };
  }

  // Comm error fallthrough Rule 6
  if (overrides.rule_6_fallthrough && tx.comm_error) {
    const passes = txRng(tx.transaction_id, 7) < pdmaRate && txRng(tx.transaction_id, 8) < riskRate;
    return { newOutcome: passes ? 'IDENTITY_VERIFIED' : 'IDENTITY_NOT_VERIFIED', triggeredRule: 'Rule 6 Fallthrough' };
  }

  // KOEC0039+X fallthrough Rule 3
  if (overrides.rule_3_fallthrough && tx.fault_code === 'KOEC0039' && tx.gen_return_code === 'X') {
    const passes = txRng(tx.transaction_id, 9) < pdmaRate && txRng(tx.transaction_id, 10) < riskRate;
    return { newOutcome: passes ? 'IDENTITY_VERIFIED' : 'IDENTITY_NOT_VERIFIED', triggeredRule: 'Rule 3 Fallthrough' };
  }

  // KOEC0039 subcode severity
  if (tx.fault_code === 'KOEC0039' && tx.gen_return_code && tx.gen_return_code !== 'X') {
    const sev = overrides[`koec0039_${tx.gen_return_code}_severity` as keyof RuleOverrides] as string;
    if (sev === 'PASS') {
      const passes = txRng(tx.transaction_id, 11) < pdmaRate && txRng(tx.transaction_id, 12) < riskRate;
      return { newOutcome: passes ? 'IDENTITY_VERIFIED' : 'IDENTITY_NOT_VERIFIED', triggeredRule: `KOEC0039-${tx.gen_return_code} Severity Change` };
    }
  }

  return { newOutcome: tx.final_result, triggeredRule: null };
}

export function runSimulation(overrides: Partial<RuleOverrides>): SimulationResult {
  const t0 = performance.now();
  const merged = { ...DEFAULT_OVERRIDES, ...overrides };
  const { pdmaRate, riskRate } = getEmpiricalRates();
  const txs = db.transactions;

  const baselineVerified = txs.filter(t => t.final_result === 'IDENTITY_VERIFIED').length;
  const baselineRate = baselineVerified / txs.length;

  const outcomes: string[] = [];
  const breakdown: Record<string, number> = {};

  for (const tx of txs) {
    const { newOutcome, triggeredRule } = applyOverride(tx, merged, pdmaRate, riskRate);
    outcomes.push(newOutcome);
    if (triggeredRule && newOutcome !== tx.final_result) {
      breakdown[triggeredRule] = (breakdown[triggeredRule] ?? 0) + 1;
    }
  }

  const newVerified = outcomes.filter(o => o === 'IDENTITY_VERIFIED').length;
  const newRate = newVerified / outcomes.length;

  // Bootstrap CI (500 iterations for speed)
  const n = outcomes.length;
  const bootDeltas: number[] = [];
  for (let iter = 0; iter < 500; iter++) {
    let sample = 0;
    for (let j = 0; j < n; j++) {
      if (outcomes[Math.floor(Math.random() * n)] === 'IDENTITY_VERIFIED') sample++;
    }
    bootDeltas.push(sample / n - baselineRate);
  }
  bootDeltas.sort((a, b) => a - b);
  const ci_low  = bootDeltas[Math.floor(0.025 * bootDeltas.length)];
  const ci_high = bootDeltas[Math.floor(0.975 * bootDeltas.length)];

  const affectedCount = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const total = affectedCount || 1;

  return {
    baseline_pass_rate:  parseFloat((baselineRate * 100).toFixed(2)),
    simulated_pass_rate: parseFloat((newRate * 100).toFixed(2)),
    delta:               parseFloat(((newRate - baselineRate) * 100).toFixed(2)),
    delta_absolute:      newVerified - baselineVerified,
    ci_95_low:           parseFloat((ci_low * 100).toFixed(2)),
    ci_95_high:          parseFloat((ci_high * 100).toFixed(2)),
    affected_count:      affectedCount,
    breakdown:           Object.entries(breakdown)
      .map(([rule, count]) => ({ rule, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count),
    runtime_ms: Math.round(performance.now() - t0),
  };
}

// Sensitivity sweep: vary populate_result_relax + rule_X over several combos
export function runSensitivitySweep(): SensitivityPoint[] {
  const combos: { label: string; overrides: Partial<RuleOverrides> }[] = [
    { label: 'Baseline', overrides: {} },
    { label: 'Rule 7 Only',   overrides: { rule_7_cmra_continue: true, populate_result_relax: true } },
    { label: 'Rule 8 Only',   overrides: { rule_8_pbsa_continue: true, populate_result_relax: true } },
    { label: 'Rule 9 Only',   overrides: { rule_9_pobox_continue: true, populate_result_relax: true } },
    { label: 'Rules 7+8',     overrides: { rule_7_cmra_continue: true, rule_8_pbsa_continue: true, populate_result_relax: true } },
    { label: 'Rules 7+8+9',   overrides: { rule_7_cmra_continue: true, rule_8_pbsa_continue: true, rule_9_pobox_continue: true, populate_result_relax: true } },
    { label: '+Comm Err',     overrides: { rule_7_cmra_continue: true, rule_8_pbsa_continue: true, rule_9_pobox_continue: true, rule_6_fallthrough: true, populate_result_relax: true } },
    { label: '+KOEC0039+X',   overrides: { rule_7_cmra_continue: true, rule_8_pbsa_continue: true, rule_9_pobox_continue: true, rule_6_fallthrough: true, rule_3_fallthrough: true, populate_result_relax: true } },
  ];

  return combos.map((c, i) => {
    const r = runSimulation(c.overrides);
    return { label: c.label, value: i, pass_rate: r.simulated_pass_rate, delta: r.delta };
  });
}

export function getScenarioCards() {
  return [
    { id: 1,  label: 'PBSA → PDMA + populateResult',      overrides: { rule_8_pbsa_continue: true, populate_result_relax: true }, impact: 'HIGH' },
    { id: 2,  label: 'CMRA → PDMA + populateResult',       overrides: { rule_7_cmra_continue: true, populate_result_relax: true }, impact: 'MEDIUM' },
    { id: 3,  label: 'POBox → PDMA + populateResult',      overrides: { rule_9_pobox_continue: true, populate_result_relax: true }, impact: 'MEDIUM' },
    { id: 4,  label: 'All GSA Overrides + populateResult', overrides: { rule_7_cmra_continue: true, rule_8_pbsa_continue: true, rule_9_pobox_continue: true, populate_result_relax: true }, impact: 'HIGH' },
    { id: 5,  label: 'Comm Error Fallthrough',             overrides: { rule_6_fallthrough: true }, impact: 'MEDIUM' },
    { id: 6,  label: 'KOEC0039+X Fallthrough',             overrides: { rule_3_fallthrough: true }, impact: 'LOW' },
    { id: 7,  label: 'Full Recovery Scenario',             overrides: { rule_7_cmra_continue: true, rule_8_pbsa_continue: true, rule_9_pobox_continue: true, rule_6_fallthrough: true, rule_3_fallthrough: true, populate_result_relax: true }, impact: 'HIGH' },
  ].map(s => ({
    ...s,
    result: runSimulation(s.overrides as Partial<RuleOverrides>),
  }));
}
