'use client';

const MILESTONES = [
  { month: 'Jun', target: 775000, note: 'Fire on all 3 setups. Max 5x. Compound every win fully.', pct: 7.8, color: '#3B82F6' },
  { month: 'Jul', target: 1200000, note: 'No breaks. 3–5 trades/month. Win rate must stay above 60%.', pct: 12, color: '#0EA5E9' },
  { month: 'Aug', target: 1860000, note: 'Expect a brutal drawdown month. Risk of -30% is real here.', pct: 18.6, color: '#14B8A6' },
  { month: 'Sep', target: 2880000, note: 'If alive and at $2.8M+, you are on track. Do not over-trade.', pct: 28.8, color: '#22C55E' },
  { month: 'Oct', target: 4460000, note: 'This is where most blow up. Drop to 3x leverage. Protect gains.', pct: 44.6, color: '#F59E0B' },
  { month: 'Nov', target: 6690000, note: 'Scale back in carefully. 2–3 high conviction trades only.', pct: 66.9, color: '#F97316' },
  { month: 'Dec', target: 10040000, note: "Target: $10M. Easing the pace — protect, don't force the finish.", pct: 100, color: '#EF4444' },
];

function fmtK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${(n / 1000).toFixed(0)}k`;
}

interface Props {
  balance: number;
  onClose: () => void;
}

export function MilestoneDrawer({ balance, onClose }: Props) {
  const nextMilestone = MILESTONES.find(m => balance < m.target) ?? MILESTONES[MILESTONES.length - 1];
  const progressPct = Math.min(100, (balance / nextMilestone.target) * 100);
  const toGo = Math.max(0, nextMilestone.target - balance);

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,12,0.34)', zIndex: 90, animation: 'fadeIn .2s ease' }}
      />
      <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 444, maxWidth: '92vw', background: '#ffffff', zIndex: 91, boxShadow: '-24px 0 60px rgba(20,18,12,0.2)', display: 'flex', flexDirection: 'column', animation: 'drawerIn .28s cubic-bezier(.22,.8,.3,1)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 24px', borderBottom: '1px solid #f0efec' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontWeight: 700, fontSize: 10.5, color: '#7c5cff', letterSpacing: '0.07em' }}>$500K → $10M · 20× · +55% → +50%</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#1a1813', letterSpacing: '-0.01em' }}>Leverage road to $10M</span>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid #ececea', background: '#f6f5f2', color: '#56544b', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 800, fontSize: 30, color: '#16140f', letterSpacing: '-0.02em' }}>${balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#9b988d' }}>/ ${nextMilestone.target.toLocaleString('en-US')}</span>
            </div>
            <div style={{ height: 12, background: '#eae2fb', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct.toFixed(1)}%`, background: 'linear-gradient(90deg,#9d82ff,#7c5cff)', borderRadius: 99 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: '#7c5cff' }}>{progressPct.toFixed(1)}% there</span>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#897f70' }}>${toGo.toLocaleString('en-US', { maximumFractionDigits: 0 })} to go</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#9b988d', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Road to $10M · monthly targets</span>
              <span style={{ fontWeight: 700, fontSize: 11, color: '#7c5cff' }}>+55% → +50%</span>
            </div>

            {MILESTONES.map((m, idx) => {
              const isCurrent = balance < m.target && (idx === 0 || balance >= MILESTONES[idx - 1].target);
              const isGoal = idx === MILESTONES.length - 1;
              const done = balance >= m.target;
              const barPct = done ? 100 : isCurrent ? (balance / m.target) * 100 : m.pct;

              return (
                <div
                  key={m.month}
                  style={{
                    padding: isCurrent ? '13px 14px' : '13px 2px',
                    borderRadius: isCurrent ? 12 : 0,
                    background: isCurrent ? '#f6f2ff' : 'transparent',
                    border: isCurrent ? '1px solid #e2d6fb' : 'none',
                    marginBottom: isCurrent ? 8 : 0,
                    borderBottom: !isCurrent ? '1px solid #f5f4f1' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
                    <span style={{ fontWeight: 700, fontSize: 11.5, color: isCurrent ? '#7e63c8' : done ? '#2faa63' : '#a8a69b', width: 26, flexShrink: 0 }}>{m.month}</span>
                    <span style={{ fontWeight: 800, fontSize: 14.5, color: '#1a1813' }}>{fmtK(m.target)}</span>
                    {isCurrent && <span style={{ fontWeight: 700, fontSize: 9.5, color: '#fff', background: '#7c5cff', padding: '2px 7px', borderRadius: 6, letterSpacing: '0.05em' }}>NOW</span>}
                    {isGoal && !isCurrent && <span style={{ fontWeight: 700, fontSize: 9.5, color: '#fff', background: '#22a35a', padding: '2px 7px', borderRadius: 6, letterSpacing: '0.05em' }}>GOAL</span>}
                    {done && !isGoal && <span style={{ fontWeight: 700, fontSize: 9.5, color: '#fff', background: '#2faa63', padding: '2px 7px', borderRadius: 6, letterSpacing: '0.05em' }}>DONE</span>}
                    {!isCurrent && !isGoal && !done && <span style={{ fontWeight: 600, fontSize: 11.5, color: '#b0aea3' }}>{m.pct}%</span>}
                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 12, color: '#7c5cff' }}>{idx < 5 ? '+55%' : '+50%'}</span>
                  </div>
                  <div style={{ height: 8, background: isCurrent ? '#e6dff6' : '#f0efeb', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, barPct)}%`, background: m.color, borderRadius: 99, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontWeight: 500, fontSize: 12, color: isCurrent ? '#7a715f' : '#8c8a81', marginTop: 8, lineHeight: 1.45 }}>{m.note}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
