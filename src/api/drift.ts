/**
 * Drift Detection Engine — pure JS.
 * Implements PSI, KL Divergence, KS approximation, Page-Hinkley.
 * Splits 30-day window into baseline (days 15–30) vs current (last 14 days).
 */
import { db, type Transaction } from '@/lib/db';

export type DriftSeverity = 'STABLE' | 'MONITOR' | 'DRIFT_DETECTED';

export interface DriftVariable {
  variable:      string;
  label:         string;
  psi:           number;
  kl:            number;
  ks_stat:       number;
  severity:      DriftSeverity;
  baseline_rate: number;
  current_rate:  number;
  trend:         number;
  alert:         boolean;
}

export interface DriftHeatmapCell {
  variable: string;
  date:     string;
  psi:      number;
  severity: DriftSeverity;
}

export interface DriftTimelinePoint {
  date:     string;
  psi:      number;
  severity: DriftSeverity;
}

export interface PageHinkleyResult {
  stream:         { date: string; rate: number }[];
  change_point:   string | null;
  rate_before:    number;
  rate_after:     number;
  delta:          number;
}

const PSI_STABLE  = 0.10;
const PSI_MONITOR = 0.20;

function psiSeverity(psi: number): DriftSeverity {
  return psi < PSI_STABLE ? 'STABLE' : psi < PSI_MONITOR ? 'MONITOR' : 'DRIFT_DETECTED';
}

// PSI for a binary proportion: p_current vs p_baseline
function computePSI(p_base: number, p_curr: number): number {
  const b = Math.max(p_base, 1e-6);
  const c = Math.max(p_curr, 1e-6);
  const b2 = Math.max(1 - b, 1e-6);
  const c2 = Math.max(1 - c, 1e-6);
  return (c - b) * Math.log(c / b) + (c2 - b2) * Math.log(c2 / b2);
}

// KL divergence for binary distributions
function computeKL(p_base: number, p_curr: number): number {
  const b = Math.max(p_base, 1e-6);
  const c = Math.max(p_curr, 1e-6);
  const b2 = Math.max(1 - b, 1e-6);
  const c2 = Math.max(1 - c, 1e-6);
  return b * Math.log(b / c) + b2 * Math.log(b2 / c2);
}

// Approximate KS statistic for proportions
function ksApprox(p_base: number, p_curr: number): number {
  return Math.abs(p_base - p_curr);
}

function getWindowRates(daysAgoStart: number, daysAgoEnd: number) {
  const now = new Date();
  const start = new Date(now); start.setDate(start.getDate() - daysAgoStart);
  const end   = new Date(now); end.setDate(end.getDate() - daysAgoEnd);
  const startStr = start.toISOString().split('T')[0];
  const endStr   = end.toISOString().split('T')[0];

  const txs = db.transactions.filter(t => t.event_date >= endStr && t.event_date <= startStr);
  const n = Math.max(txs.length, 1);

  return {
    n,
    cmra_rate:       txs.filter(t => t.cmra_flag).length / n,
    pbsa_rate:       txs.filter(t => t.pbsa_flag).length / n,
    pobox_rate:      txs.filter(t => t.pobox_flag).length / n,
    koec0039_rate:   txs.filter(t => t.fault_code === 'KOEC0039').length / n,
    comm_error_rate: txs.filter(t => t.comm_error).length / n,
    doc_fail_rate:   txs.filter(t => t.doc_result !== 'IDENTITY_DOCUMENT_VALIDATED').length / n,
    pass_rate:       txs.filter(t => t.final_result === 'IDENTITY_VERIFIED').length / n,
  };
}

export function computeDriftReport(): DriftVariable[] {
  const baseline = getWindowRates(30, 14);
  const current  = getWindowRates(14, 0);

  const vars: { key: keyof ReturnType<typeof getWindowRates>; label: string }[] = [
    { key: 'cmra_rate',       label: 'CMRA Rate' },
    { key: 'pbsa_rate',       label: 'PBSA Rate' },
    { key: 'pobox_rate',      label: 'POBox Rate' },
    { key: 'koec0039_rate',   label: 'KOEC0039 Rate' },
    { key: 'comm_error_rate', label: 'Comm Error Rate' },
    { key: 'doc_fail_rate',   label: 'Doc Fail Rate' },
    { key: 'pass_rate',       label: 'Verification Rate' },
  ];

  return vars.map(({ key, label }) => {
    const b = baseline[key] as number;
    const c = current[key] as number;
    const psi = Math.abs(computePSI(b, c));
    const kl  = Math.abs(computeKL(b, c));
    const ks  = ksApprox(b, c);
    const sev = psiSeverity(psi);

    return {
      variable:      key,
      label,
      psi:           parseFloat(psi.toFixed(4)),
      kl:            parseFloat(kl.toFixed(4)),
      ks_stat:       parseFloat(ks.toFixed(4)),
      severity:      sev,
      baseline_rate: parseFloat((b * 100).toFixed(2)),
      current_rate:  parseFloat((c * 100).toFixed(2)),
      trend:         parseFloat(((c - b) * 100).toFixed(2)),
      alert:         sev === 'DRIFT_DETECTED',
    };
  }).sort((a, b) => b.psi - a.psi);
}

export function computeDriftHeatmap(): DriftHeatmapCell[] {
  const txsByDate = new Map<string, Transaction[]>();
  for (const tx of db.transactions) {
    if (!txsByDate.has(tx.event_date)) txsByDate.set(tx.event_date, []);
    txsByDate.get(tx.event_date)!.push(tx);
  }

  const dates = [...txsByDate.keys()].sort().slice(-14);
  const baselineAll = db.transactions.filter(t => {
    const ref = new Date(); ref.setDate(ref.getDate() - 14);
    return t.event_date < ref.toISOString().split('T')[0];
  });
  const bn = Math.max(baselineAll.length, 1);
  const baseline = {
    cmra_rate:       baselineAll.filter(t => t.cmra_flag).length / bn,
    pbsa_rate:       baselineAll.filter(t => t.pbsa_flag).length / bn,
    koec0039_rate:   baselineAll.filter(t => t.fault_code === 'KOEC0039').length / bn,
    comm_error_rate: baselineAll.filter(t => t.comm_error).length / bn,
    doc_fail_rate:   baselineAll.filter(t => t.doc_result !== 'IDENTITY_DOCUMENT_VALIDATED').length / bn,
    pass_rate:       baselineAll.filter(t => t.final_result === 'IDENTITY_VERIFIED').length / bn,
  };

  const variables = Object.keys(baseline) as (keyof typeof baseline)[];
  const cells: DriftHeatmapCell[] = [];

  for (const date of dates) {
    const dayTxs = txsByDate.get(date) ?? [];
    const dn = Math.max(dayTxs.length, 1);
    const dayRates: typeof baseline = {
      cmra_rate:       dayTxs.filter(t => t.cmra_flag).length / dn,
      pbsa_rate:       dayTxs.filter(t => t.pbsa_flag).length / dn,
      koec0039_rate:   dayTxs.filter(t => t.fault_code === 'KOEC0039').length / dn,
      comm_error_rate: dayTxs.filter(t => t.comm_error).length / dn,
      doc_fail_rate:   dayTxs.filter(t => t.doc_result !== 'IDENTITY_DOCUMENT_VALIDATED').length / dn,
      pass_rate:       dayTxs.filter(t => t.final_result === 'IDENTITY_VERIFIED').length / dn,
    };

    for (const v of variables) {
      const psi = Math.abs(computePSI(baseline[v], dayRates[v]));
      cells.push({ variable: v, date, psi: parseFloat(psi.toFixed(3)), severity: psiSeverity(psi) });
    }
  }

  return cells;
}

export function computePageHinkley(): PageHinkleyResult {
  const txsByDate = new Map<string, number>();
  const totByDate = new Map<string, number>();
  for (const tx of db.transactions) {
    const d = tx.event_date;
    totByDate.set(d, (totByDate.get(d) ?? 0) + 1);
    if (tx.final_result === 'IDENTITY_VERIFIED') txsByDate.set(d, (txsByDate.get(d) ?? 0) + 1);
  }

  const stream = [...totByDate.keys()].sort().map(date => ({
    date,
    rate: parseFloat(((txsByDate.get(date) ?? 0) / (totByDate.get(date) ?? 1) * 100).toFixed(1)),
  }));

  if (stream.length === 0) return { stream: [], change_point: null, rate_before: 0, rate_after: 0, delta: 0 };

  // Page-Hinkley test
  const baseline_mean = stream.slice(0, Math.max(1, Math.floor(stream.length / 3)))
    .reduce((a, b) => a + b.rate, 0) / Math.max(1, Math.floor(stream.length / 3));

  let cum = 0, M = 0;
  let changeIdx: number | null = null;
  const delta = 0.5;
  const threshold = 10;

  for (let i = 0; i < stream.length; i++) {
    cum += stream[i].rate - baseline_mean - delta;
    M = Math.max(M, cum);
    if (M - cum > threshold) { changeIdx = i; break; }
  }

  const cp = changeIdx !== null ? stream[changeIdx].date : null;
  const beforeRates = changeIdx !== null ? stream.slice(0, changeIdx).map(s => s.rate) : stream.slice(0, Math.floor(stream.length / 2)).map(s => s.rate);
  const afterRates  = changeIdx !== null ? stream.slice(changeIdx).map(s => s.rate) : stream.slice(Math.floor(stream.length / 2)).map(s => s.rate);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const rb = avg(beforeRates);
  const ra = avg(afterRates);

  return {
    stream,
    change_point:   cp,
    rate_before:    parseFloat(rb.toFixed(1)),
    rate_after:     parseFloat(ra.toFixed(1)),
    delta:          parseFloat((ra - rb).toFixed(1)),
  };
}

export function computeDriftTimeline(variable: string): DriftTimelinePoint[] {
  const txsByDate = new Map<string, Transaction[]>();
  for (const tx of db.transactions) {
    if (!txsByDate.has(tx.event_date)) txsByDate.set(tx.event_date, []);
    txsByDate.get(tx.event_date)!.push(tx);
  }

  const dates = [...txsByDate.keys()].sort();
  if (dates.length < 2) return [];

  // Use first 7 days as baseline rate
  const baselineDays = dates.slice(0, 7);
  const baselineTxs  = baselineDays.flatMap(d => txsByDate.get(d) ?? []);
  const getRate = (txs: Transaction[]) => {
    const n = Math.max(txs.length, 1);
    if (variable === 'cmra_rate')       return txs.filter(t => t.cmra_flag).length / n;
    if (variable === 'pbsa_rate')       return txs.filter(t => t.pbsa_flag).length / n;
    if (variable === 'koec0039_rate')   return txs.filter(t => t.fault_code === 'KOEC0039').length / n;
    if (variable === 'comm_error_rate') return txs.filter(t => t.comm_error).length / n;
    if (variable === 'doc_fail_rate')   return txs.filter(t => t.doc_result !== 'IDENTITY_DOCUMENT_VALIDATED').length / n;
    return txs.filter(t => t.final_result === 'IDENTITY_VERIFIED').length / n;
  };
  const baseRate = getRate(baselineTxs);

  return dates.slice(7).map(date => {
    const dayTxs = txsByDate.get(date) ?? [];
    const curr   = getRate(dayTxs);
    const psi    = Math.abs(computePSI(baseRate, curr));
    return { date, psi: parseFloat(psi.toFixed(3)), severity: psiSeverity(psi) };
  });
}
