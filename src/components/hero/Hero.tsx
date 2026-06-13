'use client';

import { useState } from 'react';
import { useAccount } from '@/hooks/useAccount';
import { usePositions } from '@/hooks/usePositions';
import { MilestoneDrawer } from './MilestoneDrawer';

const MILESTONES = [775000, 1200000, 1860000, 2880000, 4460000, 6690000, 10040000];

function fmtK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${(n / 1000).toFixed(0)}K`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Hero() {
  const { data: account } = useAccount();
  const { data: rawPositions } = usePositions();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const positions = Array.isArray(rawPositions) ? rawPositions : [];
  const balance = parseFloat(account?.total ?? '0');
  const unrealizedPnl = positions.reduce((s, p) => s + parseFloat(p.unrealised_pnl), 0);
  const positionMarginUsed = positions.reduce((s, p) => s + parseFloat(p.margin ?? '0'), 0);
  const totalBalance = parseFloat(account?.total ?? '1') || 1;
  const marginPct = totalBalance > 0 ? Math.min(100, (positionMarginUsed / totalBalance) * 100) : 0;

  const nextMilestone = MILESTONES.find(m => balance < m) ?? MILESTONES[MILESTONES.length - 1];
  const progressPct = Math.min(100, (balance / nextMilestone) * 100);
  const toGo = Math.max(0, nextMilestone - balance);

  const balanceParts = balance.toFixed(2).split('.');
  const isUp = unrealizedPnl >= 0;

  return (
    <>
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, border: '1px solid #f0efec', background: 'linear-gradient(100deg,#ffffff 0%,#faf8ff 42%,#f1ebff 70%,#e7dcff 100%)', padding: '34px 36px' }}>
        <div style={{ position: 'absolute', top: -120, right: -60, width: 520, height: 340, background: 'radial-gradient(circle at 70% 30%,rgba(150,120,255,0.5),rgba(170,140,255,0.12) 55%,transparent 72%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
            <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.14em', color: '#7e63c8', textTransform: 'uppercase' }}>Your portfolio</span>
            <span style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', color: '#1a1813', lineHeight: 1.1 }}>
              {greeting()} 👋
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: 52, letterSpacing: '-0.03em', lineHeight: 1, color: '#16140f' }}>
                ${Number(balanceParts[0]).toLocaleString('en-US')}
                <span style={{ fontSize: 26, color: '#b09a86' }}>.{balanceParts[1] ?? '00'}</span>
              </span>
              {unrealizedPnl !== 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 15, color: isUp ? '#1f9d55' : '#df5338', background: isUp ? 'rgba(47,170,99,0.13)' : 'rgba(223,83,56,0.13)', padding: '7px 13px', borderRadius: 10 }}>
                  {isUp ? '▲' : '▼'} {isUp ? '+$' : '-$'}{Math.abs(unrealizedPnl).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} uPnL
                </span>
              )}
            </div>
            <span style={{ fontWeight: 500, fontSize: 14.5, color: '#897f70' }}>
              BTC/USDT perpetual on Gate.io Futures
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch', minWidth: 300 }}>
            <button
              onClick={() => setDrawerOpen(true)}
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(6px)', border: '1px solid #e6ddfb', borderRadius: 16, padding: '15px 18px', display: 'flex', flexDirection: 'column', gap: 11, boxShadow: '0 8px 24px rgba(70,50,150,0.08)', fontFamily: 'inherit' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 11.5, letterSpacing: '0.06em', color: '#a59683', textTransform: 'uppercase' }}>Next milestone</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#7e63c8' }}>{fmtK(nextMilestone)} ›</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 22, color: '#16140f', letterSpacing: '-0.02em' }}>{progressPct.toFixed(1)}%</span>
                <span style={{ fontWeight: 600, fontSize: 12.5, color: '#897f70' }}>· ${toGo.toLocaleString('en-US', { maximumFractionDigits: 0 })} to go</span>
              </div>
              <div style={{ height: 9, background: '#eae2fb', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPct.toFixed(1)}%`, background: 'linear-gradient(90deg,#9d82ff,#7c5cff)', borderRadius: 99 }} />
              </div>
            </button>

            <div style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(6px)', border: '1px solid #e6ddfb', borderRadius: 16, padding: '16px 18px', display: 'flex', gap: 24, boxShadow: '0 8px 24px rgba(70,50,150,0.08)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontWeight: 600, fontSize: 11.5, color: '#a59683', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Open</span>
                <span style={{ fontWeight: 800, fontSize: 20, color: '#1a1813' }}>{positions.length}</span>
              </div>
              <div style={{ width: 1, background: '#e7def8' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontWeight: 600, fontSize: 11.5, color: '#a59683', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Unrealized</span>
                <span style={{ fontWeight: 800, fontSize: 20, color: unrealizedPnl >= 0 ? '#1f9d55' : '#df5338' }}>
                  {unrealizedPnl >= 0 ? '+$' : '-$'}{Math.abs(unrealizedPnl).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              <div style={{ width: 1, background: '#e7def8' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontWeight: 600, fontSize: 11.5, color: '#a59683', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Margin</span>
                <span style={{ fontWeight: 800, fontSize: 20, color: '#1a1813' }}>{marginPct.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {drawerOpen && <MilestoneDrawer balance={balance} onClose={() => setDrawerOpen(false)} />}
    </>
  );
}
