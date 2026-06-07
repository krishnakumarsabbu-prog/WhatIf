import { type ReactNode, type CSSProperties } from 'react';
import clsx from 'clsx';

type GlowVariant = 'pass' | 'fail' | 'warn' | 'accent' | 'none';

interface HarnessCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  glow?: GlowVariant;
  className?: string;
  style?: CSSProperties;
  action?: ReactNode;
  badge?: ReactNode;
  noPad?: boolean;
}

const glowBorderMap: Record<GlowVariant, string> = {
  pass:   '1px solid rgba(74, 222, 128, 0.3)',
  fail:   '1px solid rgba(248, 113, 113, 0.3)',
  warn:   '1px solid rgba(251, 191, 36, 0.25)',
  accent: '1px solid rgba(0, 180, 216, 0.3)',
  none:   '1px solid var(--border-default)',
};

const glowShadowMap: Record<GlowVariant, string> = {
  pass:   'var(--glow-pass), var(--shadow-card)',
  fail:   'var(--glow-fail), var(--shadow-card)',
  warn:   'var(--glow-warn), var(--shadow-card)',
  accent: 'var(--glow-accent), var(--shadow-card)',
  none:   'var(--shadow-card)',
};

export function HarnessCard({
  title, subtitle, children, glow = 'none',
  className, style, action, badge, noPad,
}: HarnessCardProps) {
  return (
    <div
      className={clsx('harness-card', className)}
      style={{
        background: 'var(--grad-card)',
        border: glowBorderMap[glow],
        borderRadius: 'var(--radius-lg)',
        boxShadow: glowShadowMap[glow],
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {(title || action) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          gap: 8,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {title && (
              <span style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 12,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#CBD5E1',
                whiteSpace: 'nowrap',
              }}>
                {title}
              </span>
            )}
            {badge}
          </div>
          {subtitle && (
            <span style={{ fontSize: 11, color: 'var(--status-neutral)', marginLeft: 'auto', marginRight: 8 }}>
              {subtitle}
            </span>
          )}
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
      )}
      <div style={{ flex: 1, padding: noPad ? 0 : '16px 20px', minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
