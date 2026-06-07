import { apiClient } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DecisionNode {
  id:           string;
  label:        string;
  type:         string;
  category:     string;
  volume:       number;
  pass_count:   number;
  fail_count:   number;
  success_rate: number;
  failure_rate: number;
}

export interface DecisionEdge {
  source:       string;
  target:       string;
  count:        number;
  pass_count:   number;
  fail_count:   number;
  success_rate: number;
  failure_rate: number;
}

export interface DecisionGraph {
  nodes: DecisionNode[];
  edges: DecisionEdge[];
}

export interface RankScore {
  node_id:    string;
  label:      string;
  score:      number;
  raw_score:  number;
}

export interface Community {
  community_id:    number;
  members:         string[];
  member_labels:   string[];
  size:            number;
  total_failures:  number;
  description:     string;
}

export interface CriticalPath {
  path:                  string;
  total:                 number;
  failures:              number;
  passes:                number;
  failure_rate:          number;
  pct_of_all_failures:   number;
}

export interface RuleImpact {
  rule:                string;
  label:               string;
  affected_count:      number;
  affected_pct:        number;
  declined_count:      number;
  approval_loss_pct:   number;
  impact_score:        number;
  revenue_impact_k:    number;
  risk_weight:         number;
  trend_wow:           number;
  is_hard_stop:        boolean;
  counterfactual_gain: number;
  category:            string;
}

export interface Recommendation {
  id:                   string;
  rule:                 string;
  label:                string;
  title:                string;
  description:          string;
  approval_gain_pp:     number;
  recovered_customers:  number;
  revenue_gain_k:       number;
  risk_level:           'LOW' | 'MEDIUM' | 'HIGH';
  compliance_note:      string;
  confidence:           'LOW' | 'MEDIUM' | 'HIGH';
  impact_score:         number;
  type:                 string;
  priority:             number;
}

export interface SegmentData {
  dimension:    string;
  segment:      string;
  count:        number;
  pct_of_all:   number;
  verified:     number;
  not_verified: number;
  approval_rate: number;
  decline_rate:  number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  type:  string;
  pct:   number;
}

export interface TreemapNode {
  id:       string;
  label:    string;
  value:    number;
  pct:      number;
  children: { id: string; label: string; value: number; pct: number; verified: boolean }[];
}

export interface ReplayResult {
  total:              number;
  original_verified:  number;
  new_verified:       number;
  recovered:          number;
  delta_absolute:     number;
  delta_pp:           number;
  original_rate:      number;
  new_rate:           number;
  breakdown_by_rule:  { rule: string; recovered: number }[];
}

export interface JourneyStep {
  step:   string;
  status: string;
  detail: string;
}

export interface ExplainResult {
  transaction:     Record<string, any>;
  is_verified:     boolean;
  journey:         JourneyStep[];
  rules_fired:     string[];
  contributing:    { rule: string; fired: boolean; impact: string; is_stop: boolean }[];
  shap:            { feature: string; value: string; shap: number; abs_shap: number; direction: string }[];
  counterfactual:  { outcome: string; would_verify: boolean; rules_bypassed: string[]; probability: number; reason: string } | null;
  primary_reason:  string;
}

export interface TimelineEvent {
  version:       string;
  date:          string;
  author:        string;
  rule:          string;
  change:        string;
  type:          string;
  impact:        string;
  approval_delta: number;
  rate_before:   number | null;
  rate_after:    number | null;
  actual_delta:  number;
  is_harmful:    boolean;
}

export interface ComplianceRisk {
  risk_score:     number;
  category:       'LOW' | 'MEDIUM' | 'HIGH';
  active_count:   number;
  factors:        { factor: string; weight: number; description: string }[];
  recommendation: string;
}

export interface IntelligenceOverview {
  total:              number;
  verified:           number;
  declined:           number;
  approval_rate:      number;
  top_harmful_rule:   RuleImpact;
  top_recommendation: Recommendation;
  revenue_loss_k:     number;
  rule_impact:        RuleImpact[];
  recommendations:    Recommendation[];
}

// ── Graph API ─────────────────────────────────────────────────────────────────

export async function fetchDecisionGraph(): Promise<DecisionGraph> {
  const { data } = await apiClient.get('/graph/graph');
  return data;
}

export async function fetchPageRank(): Promise<RankScore[]> {
  const { data } = await apiClient.get('/graph/pagerank');
  return data;
}

export async function fetchBetweenness(): Promise<RankScore[]> {
  const { data } = await apiClient.get('/graph/betweenness');
  return data;
}

export async function fetchCommunities(): Promise<Community[]> {
  const { data } = await apiClient.get('/graph/communities');
  return data;
}

export async function fetchCriticalPaths(): Promise<CriticalPath[]> {
  const { data } = await apiClient.get('/graph/critical-paths');
  return data;
}

// ── Population API ────────────────────────────────────────────────────────────

export async function fetchSegments(dimension = 'gsa_result'): Promise<SegmentData[]> {
  const { data } = await apiClient.get(`/population/segments?dimension=${dimension}`);
  return data;
}

export async function fetchAllSegments(): Promise<{ dimension: string; segments: SegmentData[] }[]> {
  const { data } = await apiClient.get('/population/all-segments');
  return data;
}

export async function fetchPopulationFunnel(): Promise<FunnelStage[]> {
  const { data } = await apiClient.get('/population/funnel');
  return data;
}

export async function fetchTreemap(): Promise<TreemapNode[]> {
  const { data } = await apiClient.get('/population/treemap');
  return data;
}

export async function fetchSegmentHeatmap(): Promise<{ rows: string[]; cols: string[]; cells: any[] }> {
  const { data } = await apiClient.get('/population/heatmap');
  return data;
}

// ── Recommendations API ───────────────────────────────────────────────────────

export async function fetchRecommendations(): Promise<Recommendation[]> {
  const { data } = await apiClient.get('/recommendations/list');
  return data;
}

export async function fetchRuleImpact(): Promise<RuleImpact[]> {
  const { data } = await apiClient.get('/recommendations/rule-impact');
  return data;
}

export async function fetchRevenueLoss(): Promise<{ total_declined: number; total_revenue_loss_k: number; by_rule: RuleImpact[] }> {
  const { data } = await apiClient.get('/recommendations/revenue-loss');
  return data;
}

export async function fetchComplianceRisk(overrides: Record<string, boolean>): Promise<ComplianceRisk> {
  const { data } = await apiClient.post('/recommendations/compliance-risk', { overrides });
  return data;
}

// ── Intelligence API ──────────────────────────────────────────────────────────

export async function fetchIntelligenceOverview(): Promise<IntelligenceOverview> {
  const { data } = await apiClient.get('/intelligence/overview');
  return data;
}

export async function fetchRootCause(): Promise<any> {
  const { data } = await apiClient.get('/intelligence/root-cause');
  return data;
}

export async function runReplay(overrides: Record<string, boolean>): Promise<ReplayResult> {
  const { data } = await apiClient.post('/intelligence/replay', { overrides });
  return data;
}

export async function explainTransaction(txId: string): Promise<ExplainResult> {
  const { data } = await apiClient.get(`/intelligence/explain/${txId}`);
  return data;
}

export async function searchTransactions(q: string): Promise<{ id: string; date: string; result: string; rules_fired: string }[]> {
  const { data } = await apiClient.get(`/intelligence/explain-search?q=${encodeURIComponent(q)}`);
  return data;
}

export async function fetchTimeline(): Promise<TimelineEvent[]> {
  const { data } = await apiClient.get('/intelligence/timeline');
  return data;
}

export async function fetchApprovalTrendAnnotated(): Promise<{ date: string; rate: number; event: TimelineEvent | null }[]> {
  const { data } = await apiClient.get('/intelligence/timeline/approval-trend');
  return data;
}
