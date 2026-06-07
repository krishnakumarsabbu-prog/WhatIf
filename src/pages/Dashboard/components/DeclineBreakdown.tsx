import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { fetchDeclineBreakdown } from '@/api/analytics';
import { HarnessCard, RuleTag } from '@/design-system/components';
import { useNavigate } from 'react-router-dom';

const DECLINE_COLORS = [
  '#F87171', '#FB923C', '#FBBF24', '#34D399',
  '#60A5FA', '#A78BFA', '#F472B6', '#94A3B8',
];

const ruleHints: Record<string, string> = {
  'CMRA=Y (Rule 7)':          'Rule 7',
  'PBSA=Y (Rule 8)':          'Rule 8',
  'POBox=P (Rule 9)':         'Rule 9',
  'KOEC0039+X (Rule 3)':      'Rule 3',
  'GSA Comm Error (Rule 6)':  'Rule 6',
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; payload: { pct: number; count: number } }[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 8, padding: '10px 14px',
      fontSize: 12,
    }}>
      <div style={{ color: '#E2E8F0', marginBottom: 4 }}>{d.name}</div>
      <div style={{ color: 'var(--status-fail)', fontFamily: 'var(--font-mono)' }}>
        {d.payload.count} declined ({d.payload.pct.toFixed(1)}%)
      </div>
    </div>
  );
}

export function DeclineBreakdown() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['decline-breakdown'],
    queryFn: fetchDeclineBreakdown,
    refetchInterval: 30_000,
  });

  const chartData = (data ?? []).map(d => ({ name: d.reason, value: d.count, pct: d.pct, count: d.count }));

  const handleSliceClick = (entry: { name: string }) => {
    if (ruleHints[entry.name]) navigate('/whatif');
  };

  return (
    <HarnessCard title="Decline Breakdown" glow="fail">
      {isLoading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%" cy="50%"
                innerRadius={42} outerRadius={68}
                paddingAngle={2}
                dataKey="value"
                onClick={handleSliceClick}
                style={{ cursor: 'pointer' }}
              >
                {chartData.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={DECLINE_COLORS[idx % DECLINE_COLORS.length]}
                    stroke="var(--bg-surface)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 4 }}>
            {chartData.map((item, idx) => (
              <div key={item.name} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer', padding: '2px 0',
              }} onClick={() => handleSliceClick(item)}>
                <span style={{
                  width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                  background: DECLINE_COLORS[idx % DECLINE_COLORS.length],
                }} />
                <span style={{ flex: 1, fontSize: 11, color: '#CBD5E1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: DECLINE_COLORS[idx % DECLINE_COLORS.length],
                  flexShrink: 0,
                }}>
                  {item.pct.toFixed(1)}%
                </span>
                {ruleHints[item.name] && (
                  <RuleTag rule={ruleHints[item.name]} size="sm" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </HarnessCard>
  );
}
