import { useQuery } from '@tanstack/react-query';
import { fetchKPIs } from '@/api/analytics';
import { MetricKPI } from '@/design-system/components';
import { TriangleAlert as AlertTriangle } from 'lucide-react';

export function KPIRail() {
  const { data, isLoading } = useQuery({
    queryKey: ['kpis'],
    queryFn: fetchKPIs,
    refetchInterval: 10_000,
  });

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 16,
    }}>
      <MetricKPI
        label="Identity Verified"
        value={isLoading ? null : data?.verified_rate ?? 0}
        trend={data?.verified_trend ?? 0}
        status="pass"
        loading={isLoading}
      />
      <MetricKPI
        label="Identity Declined"
        value={isLoading ? null : data?.declined_rate ?? 0}
        trend={data?.declined_trend ?? 0}
        status="fail"
        loading={isLoading}
      />
      <MetricKPI
        label="In Review"
        value={isLoading ? null : data?.review_rate ?? 0}
        status="warn"
        loading={isLoading}
        sublabel="Manual review queue"
      />
      <div style={{
        padding: '20px 24px 18px',
        display: 'flex', flexDirection: 'column', gap: 6,
        borderLeft: '3px solid var(--status-warn)',
        background: 'var(--grad-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)',
        borderLeftWidth: 3,
        boxShadow: 'var(--glow-warn), var(--shadow-card)',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 10, fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--status-neutral)',
        }}>
          Drift Alerts
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={20} color="var(--status-warn)" />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 40, fontWeight: 800, lineHeight: 1,
            color: 'var(--status-warn)',
          }}>
            3
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--status-warn)', fontFamily: 'var(--font-mono)' }}>
          PSI &gt; 0.2 detected · cmra_rate
        </span>
      </div>
    </div>
  );
}
