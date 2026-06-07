/**
 * Rule Intelligence Engine — computes rule firing stats, feature importance,
 * and trend analysis from in-memory DB.
 */
import { db } from '@/lib/db';

export interface RuleStats {
  rule:        string;
  label:       string;
  count:       number;
  pct_of_all:  number;
  pct_of_declined: number;
  outcome:     '100% FAIL' | 'MIXED';
  impact:      'HIGH' | 'MED' | 'LOW';
  trend_wow:   number;
  hard_stop:   boolean;
}

export interface FeatureImportance {
  feature: string;
  label:   string;
  shap:    number;
  direction: 'positive' | 'negative';
}

export interface FunnelStep {
  stage:    string;
  count:    number;
  dropped:  number;
  pass_rate: number;
}

export interface RuleDrilldown {
  rule:         string;
  count:        number;
  pct_declined: number;
  whatif_delta: number;
  top_reasons:  string[];
  weekly_trend: { day: string; count: number }[];
}

export function computeRuleStats(): RuleStats[] {
  const txs = db.transactions;
  const total = txs.length;
  const declined = txs.filter(t => t.final_result === 'IDENTITY_NOT_VERIFIED').length;

  // Count rule firings from primary_decline_reason
  const counts: Record<string, number> = {};
  for (const tx of txs) {
    for (const r of tx.rules_fired) {
      counts[r] = (counts[r] ?? 0) + 1;
    }
  }

  const ruleInfo: { key: string; label: string; hard_stop: boolean; impact: 'HIGH' | 'MED' | 'LOW' }[] = [
    { key: 'Rule 7', label: 'Rule 7 — CMRA=Y',              hard_stop: true,  impact: 'HIGH' },
    { key: 'Rule 8', label: 'Rule 8 — PBSA=Y',              hard_stop: true,  impact: 'HIGH' },
    { key: 'Rule 9', label: 'Rule 9 — POBox=P',             hard_stop: true,  impact: 'MED' },
    { key: 'Rule 5', label: 'Rule 5 — KOEC0039 (non-X)',    hard_stop: false, impact: 'MED' },
    { key: 'Rule 6', label: 'Rule 6 — GSA Comm Error',      hard_stop: true,  impact: 'MED' },
    { key: 'Rule 3', label: 'Rule 3 — KOEC0039+X',          hard_stop: true,  impact: 'LOW' },
    { key: 'Rule 1', label: 'Rule 1 — KOEC0647 (missing #)',hard_stop: false, impact: 'LOW' },
    { key: 'Rule 2', label: 'Rule 2 — KOEC0692 (not USPS)', hard_stop: false, impact: 'LOW' },
    { key: 'Rule 0', label: 'Rule 0 — Clean (→ PDMA)',      hard_stop: false, impact: 'LOW' },
  ];

  // Compute week-over-week trend (last 7 days vs prior 7)
  const now = new Date();
  const last7 = new Date(now); last7.setDate(last7.getDate() - 7);
  const prev7 = new Date(now); prev7.setDate(prev7.getDate() - 14);
  const last7Str = last7.toISOString().split('T')[0];
  const prev7Str = prev7.toISOString().split('T')[0];

  const countsLast7: Record<string, number> = {};
  const countsPrev7: Record<string, number> = {};
  for (const tx of txs) {
    for (const r of tx.rules_fired) {
      if (tx.event_date >= last7Str) countsLast7[r] = (countsLast7[r] ?? 0) + 1;
      else if (tx.event_date >= prev7Str) countsPrev7[r] = (countsPrev7[r] ?? 0) + 1;
    }
  }

  return ruleInfo.map(({ key, label, hard_stop, impact }) => {
    const count = counts[key] ?? 0;
    const l7 = countsLast7[key] ?? 0;
    const p7 = countsPrev7[key] ?? 1;
    const wow = parseFloat(((l7 - p7) / p7 * 100).toFixed(1));

    return {
      rule:    key,
      label,
      count,
      pct_of_all:      total > 0 ? parseFloat((count / total * 100).toFixed(1)) : 0,
      pct_of_declined: declined > 0 ? parseFloat((count / declined * 100).toFixed(1)) : 0,
      outcome: (hard_stop ? '100% FAIL' : 'MIXED') as '100% FAIL' | 'MIXED',
      impact,
      trend_wow: wow,
      hard_stop,
    };
  }).sort((a, b) => b.count - a.count);
}

export function computeFeatureImportance(): FeatureImportance[] {
  const txs = db.transactions;
  const n   = txs.length;
  if (n === 0) return [];

  const basePassRate = txs.filter(t => t.final_result === 'IDENTITY_VERIFIED').length / n;

  // SHAP approximation: mean(P(verified|feat=1)) - mean(P(verified|feat=0))
  const features: { key: keyof typeof txs[0]; label: string }[] = [
    { key: 'pbsa_flag',   label: 'pbsa_flag' },
    { key: 'cmra_flag',   label: 'cmra_flag' },
    { key: 'pobox_flag',  label: 'pobox_flag' },
    { key: 'comm_error',  label: 'comm_error' },
  ];

  // Also fault code features
  const faultFeatures = [
    { code: 'KOEC0039', label: 'fault_KOEC0039' },
    { code: 'KOEC0647', label: 'fault_KOEC0647' },
    { code: 'KOEC0692', label: 'fault_KOEC0692' },
  ];

  const results: FeatureImportance[] = [];

  for (const { key, label } of features) {
    const withFeat    = txs.filter(t => t[key] === true);
    const withoutFeat = txs.filter(t => t[key] === false);
    const pWith    = withFeat.length    > 0 ? withFeat.filter(t    => t.final_result === 'IDENTITY_VERIFIED').length / withFeat.length    : basePassRate;
    const pWithout = withoutFeat.length > 0 ? withoutFeat.filter(t => t.final_result === 'IDENTITY_VERIFIED').length / withoutFeat.length : basePassRate;
    const shap = pWith - pWithout;
    results.push({ feature: label, label, shap: parseFloat(Math.abs(shap).toFixed(4)), direction: shap > 0 ? 'positive' : 'negative' });
  }

  for (const { code, label } of faultFeatures) {
    const withFault    = txs.filter(t => t.fault_code === code);
    const withoutFault = txs.filter(t => t.fault_code !== code);
    const pWith    = withFault.length    > 0 ? withFault.filter(t    => t.final_result === 'IDENTITY_VERIFIED').length / withFault.length    : basePassRate;
    const pWithout = withoutFault.length > 0 ? withoutFault.filter(t => t.final_result === 'IDENTITY_VERIFIED').length / withoutFault.length : basePassRate;
    const shap = pWith - pWithout;
    results.push({ feature: label, label, shap: parseFloat(Math.abs(shap).toFixed(4)), direction: shap > 0 ? 'positive' : 'negative' });
  }

  // Doc fail feature
  const docFail    = txs.filter(t => t.doc_result !== 'IDENTITY_DOCUMENT_VALIDATED');
  const docPass    = txs.filter(t => t.doc_result === 'IDENTITY_DOCUMENT_VALIDATED');
  const pFail      = docFail.length > 0 ? docFail.filter(t => t.final_result === 'IDENTITY_VERIFIED').length / docFail.length : 0;
  const pPassDoc   = docPass.length > 0 ? docPass.filter(t => t.final_result === 'IDENTITY_VERIFIED').length / docPass.length : basePassRate;
  results.push({ feature: 'doc_fail', label: 'doc_visual_fail', shap: parseFloat(Math.abs(pFail - pPassDoc).toFixed(4)), direction: 'negative' });

  return results.sort((a, b) => b.shap - a.shap);
}

export function computeOutcomeFunnel(): FunnelStep[] {
  const txs = db.transactions;
  const n = txs.length;

  const docPass    = txs.filter(t => t.doc_result === 'IDENTITY_DOCUMENT_VALIDATED').length;
  const facePass   = txs.filter(t => t.face_result === 'VALIDATED').length;
  const gsaPass    = txs.filter(t => t.gsa_result !== null && !['ADDRESS_NOT_CIP_COMPLIANT', 'PROCESSING_ERROR'].includes(t.gsa_result)).length;
  const pdmaEval   = txs.filter(t => t.pdma_result !== null).length;
  const riskEval   = txs.filter(t => t.risk_result !== null).length;
  const verified   = txs.filter(t => t.final_result === 'IDENTITY_VERIFIED').length;

  return [
    { stage: 'Total Requests',        count: n,        dropped: 0,              pass_rate: 100 },
    { stage: 'After Doc Verify',      count: docPass,  dropped: n - docPass,    pass_rate: docPass  / n  * 100 },
    { stage: 'After Face Scan',       count: facePass, dropped: docPass - facePass, pass_rate: facePass / n * 100 },
    { stage: 'After GSA Check',       count: gsaPass,  dropped: facePass - gsaPass, pass_rate: gsaPass  / n * 100 },
    { stage: 'After PDMA (eligible)', count: pdmaEval, dropped: gsaPass - pdmaEval, pass_rate: pdmaEval / n * 100 },
    { stage: 'After Risk Eval',       count: riskEval, dropped: pdmaEval - riskEval, pass_rate: riskEval / n * 100 },
    { stage: 'Verified',              count: verified, dropped: riskEval - verified, pass_rate: verified / n * 100 },
  ];
}

export function computeRuleTrend(rule: string): { date: string; count: number }[] {
  const byDate: Record<string, number> = {};
  for (const tx of db.transactions) {
    if (tx.rules_fired.includes(rule)) {
      byDate[tx.event_date] = (byDate[tx.event_date] ?? 0) + 1;
    }
  }
  return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
}
