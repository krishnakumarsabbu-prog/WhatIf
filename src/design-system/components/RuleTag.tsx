interface RuleTagProps {
  rule: string;
  size?: 'sm' | 'md';
  highlight?: boolean;
}

export function RuleTag({ rule, size = 'md', highlight }: RuleTagProps) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: size === 'sm' ? 10 : 11,
      fontWeight: 500,
      padding: size === 'sm' ? '1px 6px' : '2px 8px',
      borderRadius: 3,
      background: highlight ? 'rgba(0,180,216,0.15)' : 'rgba(42, 63, 95, 0.6)',
      border: `1px solid ${highlight ? 'rgba(0,180,216,0.4)' : 'var(--border-default)'}`,
      color: highlight ? 'var(--accent-primary)' : '#94A3B8',
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {rule}
    </span>
  );
}

interface AlgorithmBadgeProps {
  name: string;
  category?: string;
}

export function AlgorithmBadge({ name, category }: AlgorithmBadgeProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px',
      borderRadius: 4,
      background: 'rgba(0,180,216,0.08)',
      border: '1px solid rgba(0,180,216,0.2)',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--accent-primary)',
      letterSpacing: '0.04em',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: 'var(--accent-primary)',
        boxShadow: '0 0 6px var(--accent-primary)',
        flexShrink: 0,
      }} />
      {category && <span style={{ color: 'var(--status-neutral)' }}>{category} ·</span>}
      {name}
    </span>
  );
}

interface TooltipExplainProps {
  text: string;
  children?: React.ReactNode;
}

export function TooltipExplain({ text, children }: TooltipExplainProps) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      title={text}
    >
      {children ?? (
        <span style={{
          width: 14, height: 14, borderRadius: '50%',
          border: '1px solid var(--border-bright)',
          color: 'var(--status-neutral)',
          fontSize: 9,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'help',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
        }}>?</span>
      )}
    </span>
  );
}
