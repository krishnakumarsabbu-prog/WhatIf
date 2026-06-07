import { apiClient } from './client';

export type NodeName = 'DOC_VERIFY' | 'FACE_SCAN' | 'GSA_RESULT' | 'PDMA_RESULT' | 'RISK_RESULT' | 'IDENTITY_VERIFIED';

export interface EvidenceMap {
  DOC_VERIFY?:        'PASS' | 'FAIL' | null;
  FACE_SCAN?:         'PASS' | 'FAIL' | null;
  GSA_RESULT?:        'CLEAN' | 'CMRA' | 'PBSA' | 'POBOX' | 'ERROR' | 'FAULT' | null;
  PDMA_RESULT?:       'COMPLIANT' | 'NOT_COMPLIANT' | null;
  RISK_RESULT?:       'ALLOW' | 'BLOCK' | null;
  IDENTITY_VERIFIED?: 'YES' | 'NO' | null;
}

export interface PosteriorResult {
  p_verified:     number;
  p_not_verified: number;
  confidence:     'HIGH' | 'MEDIUM' | 'LOW';
  sample_size:    number;
  algorithm:      string;
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

export const NODE_LABELS: Record<NodeName, string> = {
  DOC_VERIFY:        'Document Verify',
  FACE_SCAN:         'Face Scan',
  GSA_RESULT:        'GSA Address',
  PDMA_RESULT:       'PDMA Risk',
  RISK_RESULT:       'Risk Eval',
  IDENTITY_VERIFIED: 'ID Verified',
};

export const NETWORK_EDGES: [NodeName, NodeName][] = [
  ['DOC_VERIFY',  'FACE_SCAN'],
  ['DOC_VERIFY',  'GSA_RESULT'],
  ['GSA_RESULT',  'PDMA_RESULT'],
  ['PDMA_RESULT', 'RISK_RESULT'],
  ['FACE_SCAN',   'RISK_RESULT'],
  ['RISK_RESULT', 'IDENTITY_VERIFIED'],
  ['GSA_RESULT',  'IDENTITY_VERIFIED'],
];

export async function queryPosterior(evidence: EvidenceMap): Promise<PosteriorResult> {
  const { data } = await apiClient.post('/analytics/bayesian/query', evidence);
  return data;
}

export async function computeMutualInformation(): Promise<MIScore[]> {
  const { data } = await apiClient.get('/analytics/bayesian/mutual-information');
  return data;
}

export async function computeCPT(node: NodeName): Promise<CPTTable> {
  const { data } = await apiClient.get(`/analytics/bayesian/cpt/${node}`);
  return data;
}
