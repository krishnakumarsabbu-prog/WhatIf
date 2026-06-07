import { useQuery } from '@tanstack/react-query';
import { fetchServiceHealth } from '@/api/analytics';
import { HarnessCard } from '@/design-system/components';

const serviceIcons: Record<string, string> = {
  'Document Verify': '📄',
  'Face Scan':       '👤',
  'GSA Address Check': '📍',
  'PDMA Risk':       '🔍',
  'Risk Evaluation': '⚡',
};

export function ServiceHealthMatrix() {
  const { data, isLoading } = useQuery({
    queryKey: ['service-health'],
    queryFn: fetchServiceHealth,
    refetchInterval: 15_000,
  });

  const statusColor: Record<string, string> = {
    pass: 'var(--status-pass)',
    warn: 'var(--status-warn)',
    fail: 'var(--status-fail)',
  };

  return (
    <HarnessCard title="Service Health Matrix">
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="skeleton" style={{ height: 36 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(data ?? []).map((svc) => {
            const color = statusColor[svc.status];
            return (
              <div key={svc.service}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#CBD5E1', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{serviceIcons[svc.label] ?? '⬡'}</span>
                    {svc.label}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color,
                    fontWeight: 500,
                  }}>
                    {svc.pass_rate.toFixed(1)}%
                  </span>
                </div>
                <div style={{
                  height: 6,
                  background: 'var(--bg-elevated)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${svc.pass_rate}%`,
                    background: `linear-gradient(90deg, ${color} 0%, ${color}99 100%)`,
                    borderRadius: 3,
                    boxShadow: `0 0 8px ${color}60`,
                    transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
                  }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--status-neutral)', marginTop: 2 }}>
                  {svc.total.toLocaleString()} transactions evaluated
                </div>
              </div>
            );
          })}
        </div>
      )}
    </HarnessCard>
  );
}
