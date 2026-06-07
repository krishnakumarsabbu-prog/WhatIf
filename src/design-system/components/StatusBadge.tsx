import clsx from 'clsx';

type StatusVariant = 'pass' | 'fail' | 'warn' | 'info' | 'neutral' | 'processing';

interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
  dot?: boolean;
  size?: 'sm' | 'md';
}

const variantConfig: Record<StatusVariant, {
  bg: string; color: string; border: string; glow?: string;
}> = {
  pass:       { bg: 'rgba(74,222,128,0.12)', color: '#4ADE80', border: 'rgba(74,222,128,0.3)', glow: '0 0 8px rgba(74,222,128,0.3)' },
  fail:       { bg: 'rgba(248,113,113,0.12)', color: '#F87171', border: 'rgba(248,113,113,0.3)', glow: '0 0 8px rgba(248,113,113,0.3)' },
  warn:       { bg: 'rgba(251,191,36,0.10)', color: '#FBBF24', border: 'rgba(251,191,36,0.25)', glow: '0 0 8px rgba(251,191,36,0.3)' },
  info:       { bg: 'rgba(96,165,250,0.10)', color: '#60A5FA', border: 'rgba(96,165,250,0.25)' },
  neutral:    { bg: 'rgba(148,163,184,0.08)', color: '#94A3B8', border: 'rgba(148,163,184,0.2)' },
  processing: { bg: 'rgba(0,180,216,0.10)', color: '#00B4D8', border: 'rgba(0,180,216,0.3)', glow: '0 0 8px rgba(0,180,216,0.25)' },
};

const defaultLabels: Record<StatusVariant, string> = {
  pass:       'VERIFIED',
  fail:       'NOT VERIFIED',
  warn:       'REVIEW',
  info:       'INFO',
  neutral:    'UNKNOWN',
  processing: 'PROCESSING',
};

export function StatusBadge({ status, label, dot = true, size = 'md' }: StatusBadgeProps) {
  const cfg = variantConfig[status];
  const text = label ?? defaultLabels[status];
  const isSmall = size === 'sm';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: isSmall ? '2px 7px' : '3px 10px',
      borderRadius: 4,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      boxShadow: cfg.glow,
      fontFamily: 'var(--font-mono)',
      fontSize: isSmall ? 10 : 11,
      fontWeight: 500,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      {dot && (
        <span style={{
          width: isSmall ? 5 : 6, height: isSmall ? 5 : 6,
          borderRadius: '50%',
          background: cfg.color,
          boxShadow: cfg.glow,
          flexShrink: 0,
        }} />
      )}
      {text}
    </span>
  );
}
