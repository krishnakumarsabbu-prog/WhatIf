import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';

type KPIStatus = 'pass' | 'fail' | 'warn' | 'accent' | 'neutral';

interface MetricKPIProps {
  label: string;
  value: number | null;
  suffix?: string;
  prefix?: string;
  trend?: number | null;
  status?: KPIStatus;
  decimals?: number;
  loading?: boolean;
  sublabel?: string;
}

const statusColors: Record<KPIStatus, string> = {
  pass:    '#4ADE80',
  fail:    '#F87171',
  warn:    '#FBBF24',
  accent:  '#00B4D8',
  neutral: '#94A3B8',
};

const statusGlows: Record<KPIStatus, string> = {
  pass:    '0 0 20px rgba(74,222,128,0.25)',
  fail:    '0 0 20px rgba(248,113,113,0.25)',
  warn:    '0 0 20px rgba(251,191,36,0.2)',
  accent:  '0 0 20px rgba(0,180,216,0.3)',
  neutral: 'none',
};

function useCountUp(target: number | null, duration = 1200) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  const startValRef = useRef(0);

  useEffect(() => {
    if (target === null) return;
    startValRef.current = display;
    startRef.current = null;

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(startValRef.current + (target - startValRef.current) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return display;
}

export function MetricKPI({
  label, value, suffix = '%', prefix = '',
  trend, status = 'neutral', decimals = 1,
  loading, sublabel,
}: MetricKPIProps) {
  const displayed = useCountUp(value);
  const color = statusColors[status];
  const glow  = statusGlows[status];

  if (loading) {
    return (
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 12, width: '60%' }} />
        <div className="skeleton" style={{ height: 40, width: '80%' }} />
        <div className="skeleton" style={{ height: 10, width: '40%' }} />
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px 24px 18px',
      display: 'flex', flexDirection: 'column', gap: 6,
      borderLeft: `3px solid ${color}`,
      background: 'var(--grad-card)',
      borderRadius: 'var(--radius-lg)',
      border: `1px solid var(--border-default)`,
      borderLeftWidth: 3,
      boxShadow: `${glow}, var(--shadow-card)`,
      transition: 'box-shadow var(--transition-base)',
    }}>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--status-neutral)',
      }}>
        {label}
      </span>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        {prefix && <span style={{ fontSize: 16, color, fontFamily: 'var(--font-display)' }}>{prefix}</span>}
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 40,
          fontWeight: 800,
          lineHeight: 1,
          color,
          textShadow: glow !== 'none' ? `0 0 30px ${color}40` : 'none',
          animation: 'count-up 0.4s ease forwards',
        }}>
          {value === null ? '—' : displayed.toFixed(decimals)}
        </span>
        {suffix && (
          <span style={{ fontSize: 18, color: `${color}99`, fontFamily: 'var(--font-display)', fontWeight: 600 }}>
            {suffix}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 18 }}>
        {trend != null && (
          <>
            {trend > 0 ? (
              <TrendingUp size={13} color="var(--status-pass)" />
            ) : trend < 0 ? (
              <TrendingDown size={13} color="var(--status-fail)" />
            ) : (
              <Minus size={13} color="var(--status-neutral)" />
            )}
            <span style={{
              fontSize: 11,
              color: trend > 0 ? 'var(--status-pass)' : trend < 0 ? 'var(--status-fail)' : 'var(--status-neutral)',
              fontFamily: 'var(--font-mono)',
            }}>
              {trend > 0 ? '+' : ''}{trend?.toFixed(1)}% vs prior period
            </span>
          </>
        )}
        {sublabel && !trend && (
          <span style={{ fontSize: 11, color: 'var(--status-neutral)' }}>{sublabel}</span>
        )}
      </div>
    </div>
  );
}
