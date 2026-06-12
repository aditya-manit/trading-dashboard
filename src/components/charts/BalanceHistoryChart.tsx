'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountBook } from '@/hooks/useAccountBook';
import { formatDateShort, formatUsd } from '@/lib/formatters';
import type { GateAccountBookEntry } from '@/types/gate';

function buildChartData(entries: GateAccountBookEntry[]) {
  if (!entries.length) return [];
  const step = Math.max(1, Math.floor(entries.length / 150));
  return entries
    .filter((_, i) => i % step === 0 || i === entries.length - 1)
    .map((e) => ({
      date: formatDateShort(e.time),
      balance: parseFloat(e.balance),
    }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const balance: number = payload[0]?.value;
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3.5 py-2.5 shadow-lg text-sm">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="font-semibold text-gray-900">{formatUsd(balance)}</p>
    </div>
  );
}

export function BalanceHistoryChart() {
  const { data: entries, isLoading } = useAccountBook();
  const chartData = Array.isArray(entries) ? buildChartData(entries) : [];

  const balances = chartData.map((d) => d.balance);
  const minBalance = balances.length ? Math.min(...balances) : 0;
  const maxBalance = balances.length ? Math.max(...balances) : 0;
  const padding = (maxBalance - minBalance) * 0.05;
  const domainMin = Math.floor(minBalance - padding);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Balance History</h2>
        <p className="text-xs text-gray-400 mt-0.5">Last 180 days · USDT</p>
      </div>
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
          No balance history available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            <YAxis
              domain={[domainMin, 'auto']}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#balGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
