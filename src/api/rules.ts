import { apiClient } from './client';

export interface RuleStats {
  rule:             string;
  label:            string;
  count:            number;
  pct_of_all:       number;
  pct_of_declined:  number;
  outcome:          '100% FAIL' | 'MIXED';
  impact:           'HIGH' | 'MED' | 'LOW';
  trend_wow:        number;
  hard_stop:        boolean;
}

export interface FeatureImportance {
  feature:   string;
  label:     string;
  shap:      number;
  direction: 'positive' | 'negative';
}

export interface FunnelStep {
  stage:     string;
  count:     number;
  dropped:   number;
  pass_rate: number;
}

export async function computeRuleStats(): Promise<RuleStats[]> {
  const { data } = await apiClient.get('/rules/stats');
  return data;
}

export async function computeFeatureImportance(): Promise<FeatureImportance[]> {
  const { data } = await apiClient.get('/rules/feature-importance');
  return data;
}

export async function computeOutcomeFunnel(): Promise<FunnelStep[]> {
  const { data } = await apiClient.get('/rules/outcome-funnel');
  return data;
}

export async function computeRuleTrend(rule: string): Promise<{ date: string; count: number }[]> {
  const { data } = await apiClient.get(`/rules/trend/${encodeURIComponent(rule)}`);
  return data;
}
