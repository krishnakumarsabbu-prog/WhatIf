import { db, type Transaction } from '@/lib/db';

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

export interface SankeyData {
  nodes: { id: number; name: string; pass_rate: number; total: number }[];
  links: { source: number; target: number; value: number; pass_rate: number }[];
}

// Simulate async (matches original API contract)
function resolve<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

function midpointDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 15);
  return d.toISOString().split('T')[0];
}

export async function fetchKPIs(): Promise<KPIData> {
  const rows = db.transactions;
  const total    = rows.length;
  const verified = rows.filter(r => r.final_result === 'IDENTITY_VERIFIED').length;
  const declined = rows.filter(r => r.final_result === 'IDENTITY_NOT_VERIFIED').length;
  const review   = 0; // No REVIEW state in synthetic data

  const mid = midpointDate();
  const recent = rows.filter(r => r.event_date >= mid);
  const prior  = rows.filter(r => r.event_date < mid);

  const rate = (set: Transaction[]) =>
    set.length > 0 ? (set.filter(r => r.final_result === 'IDENTITY_VERIFIED').length / set.length) * 100 : 0;

  const recentRate = rate(recent);
  const priorRate  = rate(prior);

  return resolve({
    total, verified, declined, review,
    verified_rate: total > 0 ? (verified / total) * 100 : 0,
    declined_rate: total > 0 ? (declined / total) * 100 : 0,
    review_rate:   0,
    verified_trend: recentRate - priorRate,
    declined_trend: -(recentRate - priorRate),
  });
}

export async function fetchDeclineBreakdown(): Promise<DeclineBreakdownItem[]> {
  const rows = db.transactions.filter(
    r => r.final_result === 'IDENTITY_NOT_VERIFIED' && r.primary_decline_reason,
  );

  const counts: Record<string, number> = {};
  for (const r of rows) {
    const k = r.primary_decline_reason!;
    counts[k] = (counts[k] ?? 0) + 1;
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return resolve(
    Object.entries(counts)
      .map(([reason, count]) => ({ reason, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  );
}

export async function fetchServiceHealth(): Promise<ServiceHealthItem[]> {
  const rows = db.transactions;
  const n    = rows.length;

  const passRate = (filter: (r: Transaction) => boolean, pool?: (r: Transaction) => boolean) => {
    const eligible = pool ? rows.filter(pool) : rows;
    return eligible.length > 0 ? (eligible.filter(filter).length / eligible.length) * 100 : 0;
  };

  const services: ServiceHealthItem[] = [
    {
      service:   'doc_result',
      label:     'Document Verify',
      pass_rate: passRate(r => r.doc_result === 'IDENTITY_DOCUMENT_VALIDATED'),
      total:     n,
      status:    'pass',
    },
    {
      service:   'face_result',
      label:     'Face Scan',
      pass_rate: passRate(
        r => r.face_result === 'VALIDATED',
        r => r.face_result !== null,
      ),
      total: rows.filter(r => r.face_result !== null).length,
      status: 'pass',
    },
    {
      service:   'gsa_result',
      label:     'GSA Address Check',
      pass_rate: passRate(
        r => r.gsa_result === 'NO_RESULT' || r.gsa_result === 'ADDRESS_CIP_COMPLIANT',
        r => r.gsa_result !== null,
      ),
      total: rows.filter(r => r.gsa_result !== null).length,
      status: 'pass',
    },
    {
      service:   'pdma_result',
      label:     'PDMA Risk',
      pass_rate: passRate(
        r => r.pdma_result === 'ADDRESS_CIP_COMPLIANT',
        r => r.pdma_result !== null,
      ),
      total: rows.filter(r => r.pdma_result !== null).length,
      status: 'pass',
    },
    {
      service:   'risk_result',
      label:     'Risk Evaluation',
      pass_rate: passRate(
        r => r.risk_result === 'ALLOW',
        r => r.risk_result !== null,
      ),
      total: rows.filter(r => r.risk_result !== null).length,
      status: 'pass',
    },
  ];

  return resolve(
    services.map(s => ({
      ...s,
      status: (s.pass_rate >= 80 ? 'pass' : s.pass_rate >= 60 ? 'warn' : 'fail') as ServiceHealthItem['status'],
    })),
  );
}

export async function fetchVerificationTrend(): Promise<TrendPoint[]> {
  const byDate: Record<string, { verified: number; total: number }> = {};

  for (const r of db.transactions) {
    const d = r.event_date;
    if (!byDate[d]) byDate[d] = { verified: 0, total: 0 };
    byDate[d].total++;
    if (r.final_result === 'IDENTITY_VERIFIED') byDate[d].verified++;
  }

  return resolve(
    Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { verified, total }]) => ({
        date,
        verified,
        declined: total - verified,
        total,
        rate: total > 0 ? (verified / total) * 100 : 0,
      })),
  );
}

export async function fetchLiveEvents(limit = 50): Promise<LiveEvent[]> {
  return resolve(
    [...db.transactions]
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .slice(0, limit)
      .map(r => ({
        id: r.id,
        transaction_id: r.transaction_id,
        started_at: r.started_at,
        final_result: r.final_result,
        primary_decline_reason: r.primary_decline_reason,
        rules_fired: r.rules_fired,
      })),
  );
}

// ── Sankey ────────────────────────────────────────────────────────────────

const NODE_NAMES = [
  'REQUEST IN', 'DOC VERIFY', 'FACE SCAN',
  'GSA CHECK',  'PDMA CHECK', 'RISK EVAL',
  'VERIFIED',   'NOT VERIFIED',
];
const NODE_IDX: Record<string, number> = Object.fromEntries(
  NODE_NAMES.map((n, i) => [n, i]),
);

export async function fetchSankeyData(): Promise<SankeyData> {
  const rows = db.transactions;

  const linkMap: Record<string, { value: number; pass: number }> = {};
  const nodeVol: Record<number, { total: number; pass: number }> = {};

  const addLink = (src: string, tgt: string, isPass: boolean) => {
    const si = NODE_IDX[src], ti = NODE_IDX[tgt];
    if (si == null || ti == null) return;
    const key = `${si}-${ti}`;
    if (!linkMap[key]) linkMap[key] = { value: 0, pass: 0 };
    linkMap[key].value++;
    if (isPass) linkMap[key].pass++;
    if (!nodeVol[si]) nodeVol[si] = { total: 0, pass: 0 };
    nodeVol[si].total++;
    if (isPass) nodeVol[si].pass++;
  };

  for (const r of rows) {
    const ok = r.final_result === 'IDENTITY_VERIFIED';

    addLink('REQUEST IN', 'DOC VERIFY', ok);

    if (r.doc_result === 'IDENTITY_DOCUMENT_VALIDATED') {
      addLink('DOC VERIFY', 'FACE SCAN', ok);

      if (r.face_result === 'VALIDATED') {
        addLink('FACE SCAN', 'GSA CHECK', ok);

        const gsaPass = r.gsa_result === 'NO_RESULT' || r.gsa_result === 'ADDRESS_CIP_COMPLIANT';

        if (gsaPass) {
          if (r.pdma_result) {
            addLink('GSA CHECK', 'PDMA CHECK', ok);
            if (r.pdma_result === 'ADDRESS_CIP_COMPLIANT') {
              addLink('PDMA CHECK', 'RISK EVAL', ok);
            } else {
              addLink('PDMA CHECK', 'NOT VERIFIED', false);
            }
          } else if (r.risk_result) {
            addLink('GSA CHECK', 'RISK EVAL', ok);
          }
        } else {
          addLink('GSA CHECK', 'NOT VERIFIED', false);
        }

        if (r.risk_result === 'ALLOW') {
          addLink('RISK EVAL', 'VERIFIED', true);
        } else if (r.risk_result && r.risk_result !== 'ALLOW') {
          addLink('RISK EVAL', 'NOT VERIFIED', false);
        }
      } else if (r.face_result !== null) {
        addLink('FACE SCAN', 'NOT VERIFIED', false);
      }
    } else {
      addLink('DOC VERIFY', 'NOT VERIFIED', false);
    }
  }

  const nodes = NODE_NAMES.map((name, id) => ({
    id, name,
    total: nodeVol[id]?.total ?? 0,
    pass_rate: (nodeVol[id]?.total ?? 0) > 0
      ? (nodeVol[id].pass / nodeVol[id].total) * 100
      : 0,
  }));

  const links = Object.entries(linkMap)
    .map(([key, { value, pass }]) => {
      const [source, target] = key.split('-').map(Number);
      return { source, target, value, pass_rate: value > 0 ? (pass / value) * 100 : 0 };
    })
    .filter(l => l.value > 0);

  return resolve({ nodes, links });
}
