import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLiveEvents, type LiveEvent } from '@/api/analytics';
import { HarnessCard, StatusBadge, RuleTag } from '@/design-system/components';
import { Pause, Play } from 'lucide-react';

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function truncateTx(tx: string) {
  return tx.length > 10 ? tx.slice(0, 10) + '…' : tx;
}

export function LiveDecisionStream() {
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState<LiveEvent[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery<LiveEvent[]>({
    queryKey: ['live-events'],
    queryFn: () => fetchLiveEvents(50),
    refetchInterval: paused ? false : 5_000,
  });

  useEffect(() => {
    if (data && !paused) {
      setVisible(data.slice(0, 40));
      if (listRef.current) {
        listRef.current.scrollTop = 0;
      }
    }
  }, [data, paused]);

  return (
    <HarnessCard
      title="Live Decision Stream"
      glow="none"
      action={
        <button
          onClick={() => setPaused(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px',
            borderRadius: 4,
            background: paused ? 'var(--accent-muted)' : 'transparent',
            border: '1px solid var(--border-default)',
            color: paused ? 'var(--accent-primary)' : 'var(--status-neutral)',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            transition: 'all var(--transition-fast)',
          }}
        >
          {paused ? <Play size={11} /> : <Pause size={11} />}
          {paused ? 'Resume' : 'Pause'}
        </button>
      }
      noPad
    >
      <div
        ref={listRef}
        style={{
          maxHeight: 260,
          overflowY: 'auto',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '80px 110px 1fr 120px',
          padding: '8px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 10,
          color: 'var(--border-bright)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          position: 'sticky', top: 0,
          background: 'var(--bg-surface)',
          zIndex: 1,
        }}>
          <span>Time</span>
          <span>Transaction</span>
          <span>Result</span>
          <span>Triggered By</span>
        </div>

        {visible.map((evt, i) => {
          const isPass = evt.final_result === 'IDENTITY_VERIFIED';
          return (
            <div
              key={evt.id ?? i}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 110px 1fr 120px',
                padding: '7px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: 11,
                alignItems: 'center',
                background: i === 0 ? (isPass ? 'rgba(74,222,128,0.04)' : 'rgba(248,113,113,0.04)') : 'transparent',
                transition: 'background 0.3s',
                animation: i === 0 ? 'slide-in-up 0.25s ease forwards' : undefined,
              }}
            >
              <span style={{ color: 'var(--status-neutral)', fontSize: 10 }}>
                {evt.started_at ? formatTime(evt.started_at) : '—'}
              </span>
              <span style={{ color: 'var(--accent-primary)' }}>
                {truncateTx(evt.transaction_id)}
              </span>
              <StatusBadge
                status={isPass ? 'pass' : 'fail'}
                label={isPass ? 'VERIFIED' : 'NOT VERIFIED'}
                size="sm"
              />
              <span style={{ fontSize: 10, color: 'var(--status-neutral)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {evt.primary_decline_reason ? (
                  <RuleTag rule={evt.primary_decline_reason.length > 16 ? evt.primary_decline_reason.slice(0,16)+'…' : evt.primary_decline_reason} size="sm" />
                ) : (
                  <span style={{ color: 'var(--status-pass)', fontSize: 10 }}>All Pass</span>
                )}
              </span>
            </div>
          );
        })}

        {visible.length === 0 && (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--status-neutral)', fontSize: 12 }}>
            No events yet — data loading...
          </div>
        )}
      </div>
    </HarnessCard>
  );
}
