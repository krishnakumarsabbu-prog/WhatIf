import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  computeDriftReport,
  computeDriftHeatmap,
  computePageHinkley,
  computeDriftTimeline,
  type DriftSeverity,
} from '@/api/drift';
import { HarnessCard } from '@/design-system/components/HarnessCard';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import { DriftHeatmap } from './DriftHeatmap';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';
import { Activity, TriangleAlert, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const SEV_STATUS: Record<DriftSeverity, 'pass' | 'warn' | 'fail'> = {
  STABLE:         'pass',
  MONITOR:        'warn',
  DRIFT_DETECTED: 'fail',
};

const VAR_LABELS: Record<string, string> = {
  cmra_rate:       'CMRA Rate',
  pbsa_rate:       'PBSA Rate',
  koec0039_rate:   'KOEC0039 Rate',
  comm_error_rate: 'Comm Error Rate',
  doc_fail_rate:   'Doc Fail Rate',
  pass_rate:       'Verification Rate',
};

export function DriftDetection() {
  const [selectedVar, setSelectedVar] = useState<string | null>(null);

  const { data: driftVars = [] } = useQuery({
    queryKey: ['drift-report'],
    queryFn: computeDriftReport,
    staleTime: 30_000,
  });

  const { data: heatmapCells = [] } = useQuery({
    queryKey: ['drift-heatmap'],
    queryFn: computeDriftHeatmap,
    staleTime: 30_000,
  });

  const { data: ph } = useQuery({
    queryKey: ['page-hinkley'],
    queryFn: computePageHinkley,
    staleTime: 30_000,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['drift-timeline', selectedVar],
    queryFn: () => computeDriftTimeline(selectedVar ?? 'pass_rate'),
    staleTime: 30_000,
    enabled: !!selectedVar,
  });

  const alertCount = driftVars.filter(v => v.alert).length;
  const monitorCount = driftVars.filter(v => v.severity === 'MONITOR').length;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <Activity size={20} color="var(--accent-primary)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Drift Detection Center
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
            PSI · KL Divergence · KS Test · Page-Hinkley sequential monitoring
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {alertCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '6px' }}>
              <TriangleAlert size={14} color="var(--status-fail)" />
              <span style={{ fontSize: '12px', color: 'var(--status-fail)', fontFamily: 'var(--font-mono)' }}>
                {alertCount} DRIFT ALERT{alertCount > 1 ? 'S' : ''}
              </span>
            </div>
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-primary)', background: 'rgba(0,180,216,0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(0,180,216,0.2)', display: 'flex', alignItems: 'center' }}>
            PSI + KL + Page-Hinkley
          </span>
        </div>
      </div>

      {/* Summary KPI rail */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Variables Monitored', value: driftVars.length, color: 'var(--text-primary)' },
          { label: 'Drift Alerts', value: alertCount, color: alertCount > 0 ? 'var(--status-fail)' : 'var(--status-pass)' },
          { label: 'Monitor Zone', value: monitorCount, color: monitorCount > 0 ? '#FCD34D' : 'var(--status-pass)' },
          { label: 'Stable', value: driftVars.filter(v => v.severity === 'STABLE').length, color: 'var(--status-pass)' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>{k.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-display)', color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* PSI Heatmap */}
      <HarnessCard title="PSI Heatmap — Last 14 Days" subtitle="Click a row label to inspect timeline">
        <DriftHeatmap
          cells={heatmapCells}
          selectedVar={selectedVar}
          onVarClick={v => setSelectedVar(prev => prev === v ? null : v)}
        />
        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
          {[
            { label: 'STABLE (PSI < 0.10)', color: '#4ADE80', bg: '#1A3A2A' },
            { label: 'MONITOR (0.10–0.20)', color: '#FCD34D', bg: '#3A2F0A' },
            { label: 'DRIFT DETECTED (> 0.20)', color: '#F87171', bg: '#3A1A1A' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: l.bg, border: `1px solid ${l.color}` }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </HarnessCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Variable drill-down */}
        <HarnessCard title="Variable Drift Metrics" subtitle="Baseline: days 15–30 · Current: last 14 days">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {driftVars.map((v, i) => (
              <div
                key={v.variable}
                onClick={() => setSelectedVar(prev => prev === v.variable ? null : v.variable)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 70px 70px 90px',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 0',
                  borderBottom: i < driftVars.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  cursor: 'pointer',
                  background: selectedVar === v.variable ? 'rgba(0,180,216,0.05)' : 'transparent',
                  borderRadius: '4px',
                  paddingLeft: selectedVar === v.variable ? '6px' : '0',
                  transition: 'all 0.15s',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{v.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{v.variable}</div>
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '11px', color: v.alert ? 'var(--status-fail)' : 'var(--text-secondary)' }}>
                  PSI {v.psi.toFixed(3)}
                </div>
                <div style={{ textAlign: 'right', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {v.baseline_rate.toFixed(1)}%
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontSize: '11px', fontFamily: 'var(--font-mono)', color: v.trend > 0 ? 'var(--status-fail)' : v.trend < 0 ? 'var(--status-pass)' : 'var(--text-muted)' }}>
                  {v.trend > 0 ? <TrendingUp size={11} /> : v.trend < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                  {v.trend > 0 ? '+' : ''}{v.trend.toFixed(1)}pp
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <StatusBadge status={SEV_STATUS[v.severity]} label={v.severity.replace('_', ' ')} />
                </div>
              </div>
            ))}
          </div>
        </HarnessCard>

        {/* Page-Hinkley / Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {ph && (
            <HarnessCard
              title="Page-Hinkley Change Point"
              subtitle="Daily verification rate stream"
              glow={ph.change_point ? 'warn' : 'none'}
            >
              <div style={{ height: '180px' }}>
                <ResponsiveContainer>
                  <AreaChart data={ph.stream} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="ph-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fill: '#475569', fontSize: 9 }} unit="%" />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
                      labelStyle={{ color: 'var(--text-secondary)', fontSize: '11px' }}
                      itemStyle={{ color: 'var(--accent-primary)', fontSize: '11px' }}
                      formatter={(v: number) => [`${v}%`, 'Verify Rate']}
                    />
                    {ph.change_point && (
                      <ReferenceLine x={ph.change_point} stroke="#FCD34D" strokeDasharray="4 2" label={{ value: 'CP', fill: '#FCD34D', fontSize: 10 }} />
                    )}
                    <Area type="monotone" dataKey="rate" stroke="var(--accent-primary)" fill="url(#ph-grad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {ph.change_point && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                  {[
                    { label: 'Change Point', value: ph.change_point },
                    { label: 'Rate Before', value: `${ph.rate_before}%` },
                    { label: 'Delta', value: `${ph.delta > 0 ? '+' : ''}${ph.delta}pp`, color: ph.delta < 0 ? 'var(--status-fail)' : 'var(--status-pass)' },
                  ].map(m => (
                    <div key={m.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>{m.label}</div>
                      <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: m.color ?? 'var(--accent-primary)', fontWeight: 600 }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </HarnessCard>
          )}

          {/* Variable timeline */}
          {selectedVar && timeline.length > 0 && (
            <HarnessCard
              title={`Timeline — ${VAR_LABELS[selectedVar] ?? selectedVar}`}
              subtitle="Daily PSI vs baseline"
            >
              <div style={{ height: '160px' }}>
                <ResponsiveContainer>
                  <LineChart data={timeline} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fill: '#475569', fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
                      labelStyle={{ color: 'var(--text-secondary)', fontSize: '11px' }}
                      formatter={(v: number) => [v.toFixed(3), 'PSI']}
                    />
                    <ReferenceLine y={0.10} stroke="#FCD34D" strokeDasharray="3 2" />
                    <ReferenceLine y={0.20} stroke="#F87171" strokeDasharray="3 2" />
                    <Line type="monotone" dataKey="psi" stroke="var(--accent-primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </HarnessCard>
          )}
        </div>
      </div>
    </div>
  );
}
