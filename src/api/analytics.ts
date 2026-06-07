import { supabase } from '@/lib/supabase';

export interface KPIData {
  total: number;
  verified: number;
  declined: number;
  review: number;
  verified_rate: number;
  declined_rate: number;
  review_rate: number;
  verified_trend: number;
  declined_trend: number;
}

export interface DeclineBreakdownItem {
  reason: string;
  count: number;
  pct: number;
}

export interface ServiceHealthItem {
  service: string;
  label: string;
  pass_rate: number;
  total: number;
  status: 'pass' | 'warn' | 'fail';
}

export interface TrendPoint {
  date: string;
  verified: number;
  declined: number;
  total: number;
  rate: number;
}

export interface LiveEvent {
  id: string;
  transaction_id: string;
  started_at: string;
  final_result: string;
  primary_decline_reason: string | null;
  rules_fired: string[];
}

export async function fetchKPIs(): Promise<KPIData> {
  const { data, error } = await supabase
    .from('transaction_summary')
    .select('final_result, event_date')
    .order('event_date', { ascending: false });

  if (error) throw error;

  const rows = data ?? [];
  const total = rows.length;
  const verified = rows.filter(r => r.final_result === 'IDENTITY_VERIFIED').length;
  const declined = rows.filter(r => r.final_result === 'IDENTITY_NOT_VERIFIED').length;
  const review   = total - verified - declined;

  // Compare last 15 days vs prior 15 days for trend
  const midDate = new Date();
  midDate.setDate(midDate.getDate() - 15);
  const midStr = midDate.toISOString().split('T')[0];

  const recent = rows.filter(r => r.event_date >= midStr);
  const prior  = rows.filter(r => r.event_date < midStr);

  const recentRate = recent.length > 0
    ? (recent.filter(r => r.final_result === 'IDENTITY_VERIFIED').length / recent.length) * 100
    : 0;
  const priorRate  = prior.length > 0
    ? (prior.filter(r => r.final_result === 'IDENTITY_VERIFIED').length / prior.length) * 100
    : 0;

  return {
    total,
    verified,
    declined,
    review,
    verified_rate: total > 0 ? (verified / total) * 100 : 0,
    declined_rate: total > 0 ? (declined / total) * 100 : 0,
    review_rate:   total > 0 ? (review   / total) * 100 : 0,
    verified_trend: priorRate > 0 ? recentRate - priorRate : 0,
    declined_trend: priorRate > 0 ? -(recentRate - priorRate) : 0,
  };
}

export async function fetchDeclineBreakdown(): Promise<DeclineBreakdownItem[]> {
  const { data, error } = await supabase
    .from('transaction_summary')
    .select('primary_decline_reason')
    .eq('final_result', 'IDENTITY_NOT_VERIFIED')
    .not('primary_decline_reason', 'is', null);

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = row.primary_decline_reason ?? 'Unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return Object.entries(counts)
    .map(([reason, count]) => ({ reason, count, pct: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export async function fetchServiceHealth(): Promise<ServiceHealthItem[]> {
  const { data, error } = await supabase
    .from('transaction_summary')
    .select('doc_result, face_result, gsa_result, pdma_result, risk_result, final_result');

  if (error) throw error;

  const rows = data ?? [];
  const n = rows.length;

  const services: ServiceHealthItem[] = [
    {
      service: 'doc_result',
      label: 'Document Verify',
      pass_rate: n > 0 ? (rows.filter(r => r.doc_result === 'IDENTITY_DOCUMENT_VALIDATED').length / n) * 100 : 0,
      total: n,
      status: 'pass',
    },
    {
      service: 'face_result',
      label: 'Face Scan',
      pass_rate: (() => {
        const eligible = rows.filter(r => r.face_result != null);
        return eligible.length > 0
          ? (eligible.filter(r => r.face_result === 'VALIDATED').length / eligible.length) * 100
          : 0;
      })(),
      total: rows.filter(r => r.face_result != null).length,
      status: 'pass',
    },
    {
      service: 'gsa_result',
      label: 'GSA Address Check',
      pass_rate: (() => {
        const eligible = rows.filter(r => r.gsa_result != null);
        return eligible.length > 0
          ? (eligible.filter(r => ['NO_RESULT','ADDRESS_CIP_COMPLIANT'].includes(r.gsa_result ?? '')).length / eligible.length) * 100
          : 0;
      })(),
      total: rows.filter(r => r.gsa_result != null).length,
      status: 'pass',
    },
    {
      service: 'pdma_result',
      label: 'PDMA Risk',
      pass_rate: (() => {
        const eligible = rows.filter(r => r.pdma_result != null);
        return eligible.length > 0
          ? (eligible.filter(r => r.pdma_result === 'ADDRESS_CIP_COMPLIANT').length / eligible.length) * 100
          : 0;
      })(),
      total: rows.filter(r => r.pdma_result != null).length,
      status: 'pass',
    },
    {
      service: 'risk_result',
      label: 'Risk Evaluation',
      pass_rate: (() => {
        const eligible = rows.filter(r => r.risk_result != null);
        return eligible.length > 0
          ? (eligible.filter(r => r.risk_result === 'ALLOW').length / eligible.length) * 100
          : 0;
      })(),
      total: rows.filter(r => r.risk_result != null).length,
      status: 'pass',
    },
  ];

  return services.map(s => ({
    ...s,
    status: s.pass_rate >= 80 ? 'pass' : s.pass_rate >= 60 ? 'warn' : 'fail',
  }));
}

export async function fetchVerificationTrend(): Promise<TrendPoint[]> {
  const { data, error } = await supabase
    .from('transaction_summary')
    .select('event_date, final_result')
    .order('event_date', { ascending: true });

  if (error) throw error;

  const byDate: Record<string, { verified: number; total: number }> = {};
  for (const row of data ?? []) {
    const d = row.event_date;
    if (!byDate[d]) byDate[d] = { verified: 0, total: 0 };
    byDate[d].total++;
    if (row.final_result === 'IDENTITY_VERIFIED') byDate[d].verified++;
  }

  return Object.entries(byDate).map(([date, { verified, total }]) => ({
    date,
    verified,
    declined: total - verified,
    total,
    rate: total > 0 ? (verified / total) * 100 : 0,
  }));
}

export async function fetchLiveEvents(limit = 50): Promise<LiveEvent[]> {
  const { data, error } = await supabase
    .from('transaction_summary')
    .select('id, transaction_id, started_at, final_result, primary_decline_reason, rules_fired')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export interface SankeyData {
  nodes: { id: number; name: string; pass_rate: number; total: number }[];
  links: { source: number; target: number; value: number; pass_rate: number }[];
}

const NODE_NAMES = [
  'REQUEST IN', 'DOC VERIFY', 'FACE SCAN',
  'GSA CHECK', 'PDMA CHECK', 'RISK EVAL',
  'VERIFIED', 'NOT VERIFIED',
];
const NODE_IDX: Record<string, number> = Object.fromEntries(NODE_NAMES.map((n, i) => [n, i]));

export async function fetchSankeyData(): Promise<SankeyData> {
  const { data, error } = await supabase
    .from('transaction_summary')
    .select('doc_result, face_result, gsa_result, pdma_result, risk_result, final_result');

  if (error) throw error;
  const rows = data ?? [];

  type LinkKey = string;
  const linkMap: Record<LinkKey, { value: number; pass: number }> = {};
  const nodeVolume: Record<number, { total: number; pass: number }> = {};

  const link = (src: string, tgt: string, isPass: boolean) => {
    const si = NODE_IDX[src];
    const ti = NODE_IDX[tgt];
    if (si == null || ti == null) return;
    const key = `${si}-${ti}`;
    if (!linkMap[key]) linkMap[key] = { value: 0, pass: 0 };
    linkMap[key].value++;
    if (isPass) linkMap[key].pass++;
    if (!nodeVolume[si]) nodeVolume[si] = { total: 0, pass: 0 };
    nodeVolume[si].total++;
    if (isPass) nodeVolume[si].pass++;
  };

  for (const row of rows) {
    const isFinal = row.final_result === 'IDENTITY_VERIFIED';

    link('REQUEST IN', 'DOC VERIFY', isFinal);

    if (row.doc_result === 'IDENTITY_DOCUMENT_VALIDATED') {
      link('DOC VERIFY', 'FACE SCAN', isFinal);

      if (row.face_result === 'VALIDATED') {
        link('FACE SCAN', 'GSA CHECK', isFinal);

        if (row.gsa_result && !['ADDRESS_NOT_CIP_COMPLIANT','PROCESSING_ERROR'].includes(row.gsa_result)) {
          // Goes to PDMA or directly to risk
          if (row.pdma_result) {
            link('GSA CHECK', 'PDMA CHECK', isFinal);
            if (row.pdma_result === 'ADDRESS_CIP_COMPLIANT') {
              link('PDMA CHECK', 'RISK EVAL', isFinal);
            } else {
              link('PDMA CHECK', 'NOT VERIFIED', false);
            }
          } else if (row.risk_result) {
            link('GSA CHECK', 'RISK EVAL', isFinal);
          }
        } else {
          link('GSA CHECK', 'NOT VERIFIED', false);
        }

        if (row.risk_result === 'ALLOW') {
          link('RISK EVAL', 'VERIFIED', true);
        } else if (row.risk_result) {
          link('RISK EVAL', 'NOT VERIFIED', false);
        }
      } else if (row.face_result != null) {
        link('FACE SCAN', 'NOT VERIFIED', false);
      }
    } else {
      link('DOC VERIFY', 'NOT VERIFIED', false);
    }
  }

  const nodes = NODE_NAMES.map((name, id) => ({
    id,
    name,
    total: nodeVolume[id]?.total ?? 0,
    pass_rate: nodeVolume[id]?.total > 0
      ? (nodeVolume[id].pass / nodeVolume[id].total) * 100
      : 0,
  }));

  const links = Object.entries(linkMap).map(([key, { value, pass }]) => {
    const [source, target] = key.split('-').map(Number);
    return { source, target, value, pass_rate: value > 0 ? (pass / value) * 100 : 0 };
  }).filter(l => l.value > 0);

  return { nodes, links };
}
