import { apiClient } from './client';

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

export async function computeDriftReport(): Promise<DriftVariable[]> {
  const { data } = await apiClient.get('/drift/report');
  return data;
}

export async function computeDriftHeatmap(): Promise<DriftHeatmapCell[]> {
  const { data } = await apiClient.get('/drift/heatmap');
  return data;
}

export async function computePageHinkley(): Promise<PageHinkleyResult> {
  const { data } = await apiClient.get('/drift/page-hinkley');
  return data;
}

export async function computeDriftTimeline(variable: string): Promise<DriftTimelinePoint[]> {
  const { data } = await apiClient.get(`/drift/timeline/${variable}`);
  return data;
}
