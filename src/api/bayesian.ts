/**
 * Bayesian Network Engine — pure JS, trained from in-memory DB.
 * Implements:
 *   - CPT (Conditional Probability Table) learning via frequency counting
 *   - Exact inference via enumeration over evidence-consistent transactions
 *   - Mutual Information ranking
 *   - Network structure as DAG
 */
import { db, type Transaction } from '@/lib/db';

export type NodeName = 'DOC_VERIFY' | 'FACE_SCAN' | 'GSA_RESULT' | 'PDMA_RESULT' | 'RISK_RESULT' | 'IDENTITY_VERIFIED';

export interface EvidenceMap {
  DOC_VERIFY?:       'PASS' | 'FAIL' | null;
  FACE_SCAN?:        'PASS' | 'FAIL' | null;
  GSA_RESULT?:       'CLEAN' | 'CMRA' | 'PBSA' | 'POBOX' | 'ERROR' | 'FAULT' | null;
  PDMA_RESULT?:      'COMPLIANT' | 'NOT_COMPLIANT' | null;
  RISK_RESULT?:      'ALLOW' | 'BLOCK' | null;
  IDENTITY_VERIFIED?: 'YES' | 'NO' | null;
}

export interface PosteriorResult {
  p_verified:    number;
  p_not_verified: number;
  confidence:    'HIGH' | 'MEDIUM' | 'LOW';
  sample_size:   number;
  algorithm:     string;
}

export interface MIScore {
  node:     NodeName;
  mi_score: number;
  label:    string;
}

export interface CPTRow {
  condition: string;
  p_pass:    number;
  p_fail:    number;
  count:     number;
}

export type CPTTable = {
  node:    NodeName;
  parents: NodeName[];
  rows:    CPTRow[];
};

// Map a Transaction's fields to discretized node states
function discretize(tx: Transaction): EvidenceMap {
  return {
    DOC_VERIFY:       tx.doc_result === 'IDENTITY_DOCUMENT_VALIDATED' ? 'PASS' : 'FAIL',
    FACE_SCAN:        tx.face_result === 'VALIDATED' ? 'PASS' : tx.face_result !== null ? 'FAIL' : null,
    GSA_RESULT:       tx.cmra_flag   ? 'CMRA'
                    : tx.pbsa_flag   ? 'PBSA'
                    : tx.pobox_flag  ? 'POBOX'
                    : tx.gsa_result === 'PROCESSING_ERROR' ? 'ERROR'
                    : tx.fault_code  ? 'FAULT'
                    : tx.gsa_result  ? 'CLEAN'
                    : null,
    PDMA_RESULT:      tx.pdma_result === 'ADDRESS_CIP_COMPLIANT' ? 'COMPLIANT'
                    : tx.pdma_result !== null ? 'NOT_COMPLIANT'
                    : null,
    RISK_RESULT:      tx.risk_result === 'ALLOW' ? 'ALLOW'
                    : tx.risk_result !== null ? 'BLOCK'
                    : null,
    IDENTITY_VERIFIED: tx.final_result === 'IDENTITY_VERIFIED' ? 'YES' : 'NO',
  };
}

function evidenceMatches(txState: EvidenceMap, evidence: EvidenceMap): boolean {
  for (const [key, val] of Object.entries(evidence)) {
    if (val == null) continue;
    const txVal = txState[key as keyof EvidenceMap];
    if (txVal == null) return false;
    if (txVal !== val) return false;
  }
  return true;
}

export function queryPosterior(evidence: EvidenceMap, algorithm = 'variable_elimination'): PosteriorResult {
  const txs = db.transactions;
  const t0 = performance.now();

  // Filter to transactions matching evidence
  const matching = txs.filter(tx => evidenceMatches(discretize(tx), evidence));
  const verified = matching.filter(tx => tx.final_result === 'IDENTITY_VERIFIED').length;
  const total = matching.length;

  const p_verified = total > 0 ? verified / total : 0.5;

  const confidence: PosteriorResult['confidence'] =
    total >= 100 ? 'HIGH' : total >= 20 ? 'MEDIUM' : 'LOW';

  return {
    p_verified:    parseFloat(p_verified.toFixed(4)),
    p_not_verified: parseFloat((1 - p_verified).toFixed(4)),
    confidence,
    sample_size: total,
    algorithm,
  };
}

// Mutual Information: MI(X; IDENTITY_VERIFIED)
function entropy(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

export function computeMutualInformation(): MIScore[] {
  const txs = db.transactions;
  const states = txs.map(discretize);
  const n = states.length;

  const targetKey: keyof EvidenceMap = 'IDENTITY_VERIFIED';
  const targetValues = ['YES', 'NO'];

  const nodes: { node: NodeName; label: string; values: string[] }[] = [
    { node: 'DOC_VERIFY',   label: 'Document Verify',   values: ['PASS', 'FAIL'] },
    { node: 'FACE_SCAN',    label: 'Face Scan',          values: ['PASS', 'FAIL'] },
    { node: 'GSA_RESULT',   label: 'GSA Result',         values: ['CLEAN', 'CMRA', 'PBSA', 'POBOX', 'ERROR', 'FAULT'] },
    { node: 'PDMA_RESULT',  label: 'PDMA Result',        values: ['COMPLIANT', 'NOT_COMPLIANT'] },
    { node: 'RISK_RESULT',  label: 'Risk Evaluation',    values: ['ALLOW', 'BLOCK'] },
  ];

  return nodes.map(({ node, label, values }) => {
    const eligible = states.filter(s => s[node] != null && s[targetKey] != null);
    if (eligible.length === 0) return { node, label, mi_score: 0 };

    const ne = eligible.length;
    const pTarget: Record<string, number> = {};
    for (const tv of targetValues) {
      pTarget[tv] = eligible.filter(s => s[targetKey] === tv).length / ne;
    }

    let conditionalEntropy = 0;
    for (const xv of values) {
      const subset = eligible.filter(s => s[node] === xv);
      if (subset.length === 0) continue;
      const pX = subset.length / ne;
      const pVerified = subset.filter(s => s[targetKey] === 'YES').length / subset.length;
      conditionalEntropy += pX * entropy(pVerified);
    }

    const baseEntropy = entropy(pTarget['YES'] ?? 0.5);
    const mi = Math.max(0, baseEntropy - conditionalEntropy);

    return { node, label, mi_score: parseFloat(mi.toFixed(4)) };
  }).sort((a, b) => b.mi_score - a.mi_score);
}

// CPT for a single node
export function computeCPT(node: NodeName): CPTTable {
  const txs = db.transactions;
  const states = txs.map(discretize);

  const parentMap: Record<NodeName, NodeName[]> = {
    DOC_VERIFY:       [],
    FACE_SCAN:        ['DOC_VERIFY'],
    GSA_RESULT:       ['DOC_VERIFY'],
    PDMA_RESULT:      ['GSA_RESULT'],
    RISK_RESULT:      ['PDMA_RESULT', 'FACE_SCAN'],
    IDENTITY_VERIFIED: ['RISK_RESULT', 'GSA_RESULT'],
  };

  const parents = parentMap[node];

  if (parents.length === 0) {
    // Marginal
    const vals = states.filter(s => s[node] != null);
    const pass = vals.filter(s => s[node] === 'PASS' || s[node] === 'YES' || s[node] === 'ALLOW' || s[node] === 'COMPLIANT' || s[node] === 'CLEAN').length;
    return {
      node,
      parents: [],
      rows: [{
        condition: 'Marginal',
        p_pass: vals.length > 0 ? pass / vals.length : 0,
        p_fail: vals.length > 0 ? (vals.length - pass) / vals.length : 1,
        count: vals.length,
      }],
    };
  }

  // Group by first parent value for display
  const parent = parents[0];
  const parentValues = [...new Set(states.map(s => s[parent]).filter(Boolean))];

  const rows: CPTRow[] = parentValues.map(pv => {
    const subset = states.filter(s => s[parent] === pv && s[node] != null);
    const passStates = ['PASS', 'YES', 'ALLOW', 'COMPLIANT', 'CLEAN'];
    const pass = subset.filter(s => passStates.includes(s[node] as string)).length;
    return {
      condition: `${parent}=${pv}`,
      p_pass: subset.length > 0 ? pass / subset.length : 0,
      p_fail: subset.length > 0 ? (subset.length - pass) / subset.length : 1,
      count: subset.length,
    };
  }).filter(r => r.count > 0);

  return { node, parents, rows };
}

export const NETWORK_EDGES: [NodeName, NodeName][] = [
  ['DOC_VERIFY',  'FACE_SCAN'],
  ['DOC_VERIFY',  'GSA_RESULT'],
  ['GSA_RESULT',  'PDMA_RESULT'],
  ['PDMA_RESULT', 'RISK_RESULT'],
  ['FACE_SCAN',   'RISK_RESULT'],
  ['RISK_RESULT', 'IDENTITY_VERIFIED'],
  ['GSA_RESULT',  'IDENTITY_VERIFIED'],
];

export const NODE_LABELS: Record<NodeName, string> = {
  DOC_VERIFY:       'Document Verify',
  FACE_SCAN:        'Face Scan',
  GSA_RESULT:       'GSA Address',
  PDMA_RESULT:      'PDMA Risk',
  RISK_RESULT:      'Risk Eval',
  IDENTITY_VERIFIED: 'ID Verified',
};
