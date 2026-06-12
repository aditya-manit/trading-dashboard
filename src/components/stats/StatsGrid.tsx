'use client';

import { Wallet, TrendingUp, Target, BarChart3 } from 'lucide-react';
import { useAccount } from '@/hooks/useAccount';
import { usePositionHistory } from '@/hooks/usePositionHistory';
import { formatUsd, formatPercent } from '@/lib/formatters';
import { StatCard } from './StatCard';

export function StatsGrid() {
  const { data: account, isLoading: accountLoading } = useAccount();
  const { data: positions, isLoading: posLoading } = usePositionHistory();

  const validAccount = account && typeof account.total === 'string' ? account : null;
  const validPositions = Array.isArray(positions) ? positions : [];

  const totalPnl = validPositions.reduce((sum, p) => sum + parseFloat(p.pnl), 0);
  const winning = validPositions.filter((p) => parseFloat(p.pnl) > 0).length;
  const winRate = validPositions.length > 0 ? winning / validPositions.length : 0;
  const pnls = validPositions.map((p) => parseFloat(p.pnl));
  const bestTrade = pnls.length ? Math.max(...pnls) : 0;
  const worstTrade = pnls.length ? Math.min(...pnls) : 0;

  const isProfit = totalPnl >= 0;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        title="Account Balance"
        value={validAccount ? formatUsd(validAccount.total) : '—'}
        subvalue={validAccount ? `Available: ${formatUsd(validAccount.available)}` : undefined}
        icon={Wallet}
        iconColor="text-indigo-600"
        iconBg="bg-indigo-50"
        isLoading={accountLoading}
      />
      <StatCard
        title="Realised PnL (180d)"
        value={validPositions.length ? formatUsd(totalPnl) : '—'}
        subvalue={validPositions.length ? `${validPositions.length} positions closed` : undefined}
        icon={TrendingUp}
        iconColor={isProfit ? 'text-emerald-600' : 'text-red-500'}
        iconBg={isProfit ? 'bg-emerald-50' : 'bg-red-50'}
        valueColor={isProfit ? 'text-emerald-600' : 'text-red-500'}
        isLoading={posLoading}
      />
      <StatCard
        title="Win Rate"
        value={validPositions.length ? formatPercent(winRate) : '—'}
        subvalue={validPositions.length ? `${winning} / ${validPositions.length} wins` : undefined}
        icon={Target}
        iconColor="text-violet-600"
        iconBg="bg-violet-50"
        isLoading={posLoading}
      />
      <StatCard
        title="Best / Worst"
        value={pnls.length ? `${formatUsd(bestTrade)}` : '—'}
        subvalue={pnls.length ? `Worst: ${formatUsd(worstTrade)}` : undefined}
        icon={BarChart3}
        iconColor="text-amber-600"
        iconBg="bg-amber-50"
        isLoading={posLoading}
      />
    </div>
  );
}
