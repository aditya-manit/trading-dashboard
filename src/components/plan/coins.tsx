import type { Sym } from '@/lib/plan-model';

// Color-coded asset logos (ported from the design's tpCoin / identity SVGs).
export function CoinIcon({ sym, size = 15 }: { sym: Sym; size?: number }) {
  if (sym === 'ETH') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ flex: '0 0 auto' }}>
        <circle cx={16} cy={16} r={16} fill="#627eea" />
        <path d="M16 5.5 9 16.2 16 20.3 23 16.2z" fill="#fff" />
        <path d="M16 21.6 9 17.5 16 26.5 23 17.5z" fill="#fff" fillOpacity={0.8} />
      </svg>
    );
  }
  if (sym === 'SOL') {
    const gid = `sol-${size}`;
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ flex: '0 0 auto' }}>
        <defs>
          <linearGradient id={gid} x1={4} y1={24} x2={28} y2={8} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor="#9945ff" />
            <stop offset={1} stopColor="#14f195" />
          </linearGradient>
        </defs>
        <circle cx={16} cy={16} r={16} fill="#1a1813" />
        <g fill={`url(#${gid})`}>
          <path d="M10.4 19.6c.1-.1.3-.2.5-.2h12.2c.3 0 .5.4.3.6l-2.4 2.4c-.1.1-.3.2-.5.2H8.3c-.3 0-.5-.4-.3-.6z" />
          <path d="M10.4 9.4c.1-.1.3-.2.5-.2h12.2c.3 0 .5.4.3.6l-2.4 2.4c-.1.1-.3.2-.5.2H8.3c-.3 0-.5-.4-.3-.6z" />
          <path d="M21.6 14.5c-.1-.1-.3-.2-.5-.2H8.9c-.3 0-.5.4-.3.6l2.4 2.4c.1.1.3.2.5.2h12.2c.3 0 .5-.4.3-.6z" />
        </g>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ flex: '0 0 auto' }}>
      <circle cx={16} cy={16} r={16} fill="#f7931a" />
      <g transform="translate(16 16) scale(1.34) translate(-16 -16)">
        <path d="M21.6 14.1c.2-1.6-1-2.5-2.7-3.1l.6-2.2-1.4-.3-.5 2.1c-.4-.1-.8-.2-1.1-.3l.5-2.1-1.3-.3-.6 2.2c-.3-.1-.6-.1-.9-.2l-1.8-.5-.4 1.4s1 .2 1 .3c.5.1.6.5.6.7l-.6 2.5c0 0 .1 0 .1 0l-.1 0-.9 3.6c-.1.2-.2.4-.6.3 0 0-1-.2-1-.2l-.7 1.6 1.7.4c.3.1.6.2 1 .3l-.6 2.2 1.3.3.6-2.2c.4.1.7.2 1.1.3l-.5 2.2 1.4.3.6-2.2c2.3.4 4 .3 4.8-1.8.6-1.7 0-2.6-1.2-3.2.9-.2 1.6-.8 1.8-2zm-3.2 4.3c-.4 1.7-3.3.8-4.2.6l.7-2.9c.9.2 3.9.7 3.5 2.3zm.5-4.3c-.4 1.6-2.8.8-3.6.6l.7-2.7c.8.2 3.3.6 2.9 2.1z" fill="#fff" />
      </g>
    </svg>
  );
}

export const COIN_BRAND: Record<Sym, string> = { BTC: '#f7931a', ETH: '#627eea', SOL: '#9945ff' };
