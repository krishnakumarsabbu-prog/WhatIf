import { apiClient } from './client';

export interface KPIData {
  total: number;
  verified_count: number;
  declined_count: number;
  verified_rate: number;
  declined_rate: number;
  drift_alert_count: number;
  trend_7d: { date: string; rate: number }[];
  // backward compat aliases
  verified: number;
  declined: number;
  review: number;
  verified_trend: number;
  declined_trend: number;
  review_rate: number;
}

export interface DeclineBreakdownItem {
  reason: string;
  rule: string;
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
  rate: number;
  total: number;
}

export interface LiveEvent {
  id: string;
  tx_id?: string;
  transaction_id?: string;
  started_at?: string;
  event_date?: string;
  final_result: string;
  primary_decline_reason?: string | null;
  rules_fired: string[] | string;
  is_verified?: boolean;
}

export interface SankeyData {
  nodes: { id: number; name: string; pass_rate: number; total: number }[];
  links: { source: number; target: number; value: number; pass_rate: number }[];
}

export async function fetchKPIs(): Promise<KPIData> {
  const { data } = await apiClient.get('/analytics/kpis');
  // Normalize to match both old and new field names
  return {
    ...data,
    verified:      data.verified_count ?? data.verified ?? 0,
    declined:      data.declined_count ?? data.declined ?? 0,
    review:        0,
    review_rate:   0,
    verified_trend: 0,
    declined_trend: 0,
  };
}

export async function fetchDeclineBreakdown(): Promise<DeclineBreakdownItem[]> {
  const { data } = await apiClient.get('/analytics/decline-breakdown');
  return data.map((item: any) => ({
    reason: item.rule ?? item.reason ?? 'Unknown',
    rule:   item.rule ?? '',
    count:  item.count,
    pct:    item.pct,
  }));
}

export async function fetchServiceHealth(): Promise<ServiceHealthItem[]> {
  const { data } = await apiClient.get('/analytics/service-health');
  return data.map((item: any) => ({
    ...item,
    label:  item.label ?? item.service,
    status: (item.pass_rate >= 80 ? 'pass' : item.pass_rate >= 60 ? 'warn' : 'fail') as ServiceHealthItem['status'],
  }));
}

export async function fetchVerificationTrend(): Promise<TrendPoint[]> {
  const { data } = await apiClient.get('/analytics/verification-trend');
  return data;
}

export async function fetchLiveEvents(limit = 50): Promise<LiveEvent[]> {
  const { data } = await apiClient.get(`/analytics/live-events?limit=${limit}`);
  return data.map((t: any) => ({
    id:                     t.id,
    tx_id:                  t.id,
    transaction_id:         t.id,
    started_at:             t.event_date,
    event_date:             t.event_date,
    final_result:           t.final_result,
    primary_decline_reason: t.rules_fired,
    rules_fired:            typeof t.rules_fired === 'string'
                              ? t.rules_fired.split(',').map((s: string) => s.trim()).filter(Boolean)
                              : t.rules_fired ?? [],
    is_verified:            t.final_result === 'IDENTITY_VERIFIED',
  }));
}

export async function fetchSankeyData(): Promise<SankeyData> {
  const { data } = await apiClient.get('/analytics/sankey');
  return data;
}
