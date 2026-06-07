import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { fetchVerificationTrend } from '@/api/analytics';
import { HarnessCard } from '@/design-system/components';

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}

function TrendTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 8, padding: '10px 14px',
      fontSize: 11, fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ color: 'var(--status-neutral)', marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) + '%' : p.value}
        </div>
      ))}
    </div>
  );
}

export function VerificationTrendChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['verification-trend'],
    queryFn: fetchVerificationTrend,
    refetchInterval: 60_000,
  });

  const chartData = (data ?? []).map(d => ({
    date: d.date.slice(5),  // MM-DD
    rate: parseFloat(d.rate.toFixed(1)),
    total: d.total,
  }));

  // Compute baseline (first 7 days avg)
  const baselineRate = chartData.length > 0
    ? chartData.slice(0, Math.min(7, chartData.length)).reduce((a, b) => a + b.rate, 0) /
      Math.min(7, chartData.length)
    : 62;

  return (
    <HarnessCard
      title="30-Day Verification Rate Trend"
      subtitle={`Baseline: ${baselineRate.toFixed(1)}%`}
      style={{ minHeight: 220 }}
    >
      {isLoading ? (
        <div className="skeleton" style={{ height: 160 }} />
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#00B4D8" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#00B4D8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}
              axisLine={false} tickLine={false}
              interval={4}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip content={<TrendTooltip />} />
            <ReferenceLine
              y={baselineRate}
              stroke="var(--status-warn)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Area
              type="monotone"
              dataKey="rate"
              name="Verified Rate"
              stroke="var(--accent-primary)"
              strokeWidth={2}
              fill="url(#rateGrad)"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--accent-primary)', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </HarnessCard>
  );
}
