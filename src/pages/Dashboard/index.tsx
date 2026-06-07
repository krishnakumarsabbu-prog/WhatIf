import { KPIRail } from './components/KPIRail';
import { DeclineBreakdown } from './components/DeclineBreakdown';
import { ServiceHealthMatrix } from './components/ServiceHealthMatrix';
import { LiveDecisionStream } from './components/LiveDecisionStream';
import { VerificationTrendChart } from './components/VerificationTrend';

export function Dashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fade-in 0.4s ease forwards' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 4 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22, fontWeight: 700,
          color: '#E2E8F0',
          letterSpacing: '-0.01em',
          marginBottom: 4,
        }}>
          Command Center
        </h1>
        <p style={{ fontSize: 12, color: 'var(--status-neutral)' }}>
          Real-time IDPF identity verification pipeline intelligence — last 30 days
        </p>
      </div>

      {/* KPI Rail */}
      <KPIRail />

      {/* Row 2: Decline Breakdown + Service Health */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DeclineBreakdown />
        <ServiceHealthMatrix />
      </div>

      {/* Row 3: Live Stream */}
      <LiveDecisionStream />

      {/* Row 4: Trend Chart */}
      <VerificationTrendChart />
    </div>
  );
}
