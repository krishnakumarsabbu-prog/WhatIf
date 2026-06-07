import { HarnessCard, AlgorithmBadge, StatusBadge } from '@/design-system/components';
import { Construction } from 'lucide-react';

interface ComingSoonProps {
  title: string;
  description: string;
  algorithm?: string;
  category?: string;
  phase?: string;
}

export function ComingSoon({ title, description, algorithm, category, phase = 'Phase 2' }: ComingSoonProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fade-in 0.4s ease forwards' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22, fontWeight: 700,
            color: '#E2E8F0', marginBottom: 4,
          }}>{title}</h1>
          <p style={{ fontSize: 12, color: 'var(--status-neutral)' }}>{description}</p>
        </div>
        {algorithm && <AlgorithmBadge name={algorithm} category={category} />}
      </div>

      <HarnessCard>
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '60px 20px', gap: 16, textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Construction size={28} color="var(--accent-primary)" />
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18, fontWeight: 700,
              color: '#E2E8F0', marginBottom: 8,
            }}>
              {title}
            </div>
            <p style={{ fontSize: 13, color: 'var(--status-neutral)', maxWidth: 440, lineHeight: 1.7 }}>
              {description}
            </p>
          </div>
          <StatusBadge status="info" label={phase} dot />
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--border-bright)',
            padding: '8px 16px',
            background: 'var(--bg-elevated)',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
          }}>
            Scheduled for {phase} implementation
          </div>
        </div>
      </HarnessCard>
    </div>
  );
}
