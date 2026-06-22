'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';
import { ProfileMenu } from './ProfileMenu';
import { usePlanStore, planActions, type PlanView } from '@/lib/plan-store';
import { usePositionHistory } from '@/hooks/usePositionHistory';

const TABS = [
  { id: 'overview',   label: 'Overview' },
  { id: 'positions',  label: 'Positions' },
  { id: 'reports',    label: 'Reports' },
  { id: 'history',    label: 'History' },
];

const PLAN_TABS: { label: string; v: PlanView; active: PlanView[] }[] = [
  { label: 'Workbook', v: 'workbook', active: ['workbook'] },
  { label: 'Plans', v: 'board', active: ['board', 'editor'] },
  { label: 'Journal', v: 'journal', active: ['journal'] },
];

type Page = 'dashboard' | 'plan' | 'heatmap';

const PAGES: { id: Page; label: string; accent: string }[] = [
  { id: 'dashboard', label: 'Dashboard', accent: '#23211b' },
  { id: 'plan', label: 'Plan', accent: '#7c5cff' },
  { id: 'heatmap', label: 'Heatmap', accent: '#8b5cf6' },
];

export function Topbar({ page, onPageChange }: { page: Page; onPageChange: (p: Page) => void }) {
  const { mutate } = useSWRConfig();
  const [synced, setSynced] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const onPlan = page === 'plan';
  const onHeatmap = page === 'heatmap';
  const { view: planView, plans } = usePlanStore();
  const { data: tradeData } = usePositionHistory();
  const tradeCount = (tradeData || []).filter((p) => Math.abs(parseFloat(p.max_size) || 0) > 0).length;

  useEffect(() => { setSynced('just now'); }, []);

  useEffect(() => {
    if (onPlan || onHeatmap) return;
    const handleScroll = () => {
      const topbarH = 70;
      const scrollY = window.scrollY + topbarH + 40;
      let current = 'overview';
      for (const tab of TABS) {
        const el = document.getElementById(tab.id);
        if (el && el.getBoundingClientRect().top + window.scrollY <= scrollY) {
          current = tab.id;
        }
      }
      setActiveTab(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [onPlan, onHeatmap]);

  const handleTabClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    setActiveTab(id);
  }, []);

  const handleRefresh = useCallback(async () => {
    await mutate(() => true, undefined, { revalidate: true });
    setSynced('just now');
  }, [mutate]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 30px', borderBottom: '1px solid #f0efec', position: 'sticky', top: 0, zIndex: 50, background: '#ffffff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {/* Gate.io logo */}
        <div style={{ width: 34, height: 34, borderRadius: 10, background: '#ffffff', border: '1.5px solid #e8e8e4', display: 'grid', placeItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
            {/* Blue ring arc — 270° visible, 90° gap at upper-right */}
            <circle cx="12" cy="12" r="7.5" stroke="#3B6CE7" strokeWidth="4" fill="none" strokeDasharray="35.3 11.8" strokeLinecap="butt"/>
            {/* Teal square in the gap */}
            <rect x="14.5" y="3" width="6.5" height="6.5" rx="1.5" fill="#2ED9A0"/>
          </svg>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#f6f5f2', border: '1px solid #eeede9', borderRadius: 11, padding: '7px 13px' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#23211b' }}>Gate.io Futures</span>
          <span style={{ color: '#b3b2aa', fontSize: 12 }}>▾</span>
        </div>

        {/* Dashboard / Plan / Heatmap toggle */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#f6f5f2', border: '1px solid #eeede9', borderRadius: 11, padding: 3 }}>
          {PAGES.map(({ id, label, accent }) => {
            const active = page === id;
            return (
              <button
                key={id}
                onClick={() => onPageChange(id)}
                style={{
                  fontFamily: 'inherit', cursor: 'pointer', border: 'none', borderRadius: 8,
                  padding: '6px 14px', fontWeight: active ? 800 : 700, fontSize: 12,
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  color: active ? accent : '#8c8a81',
                  background: active ? '#fff' : 'transparent',
                  boxShadow: active ? '0 1px 2px rgba(20,20,12,0.14)' : 'none',
                  transition: 'all .15s',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? accent : 'transparent', flex: '0 0 auto' }} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Nav tabs (hidden on the heatmap page, which has its own controls) */}
      {!onHeatmap && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f6f5f2', border: '1px solid #eeede9', borderRadius: 12, padding: 4 }}>
        {onPlan
          ? PLAN_TABS.map(({ label, v, active }) => {
              const isActive = active.includes(planView);
              return (
                <button
                  key={label}
                  onClick={() => planActions.setView(v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontWeight: isActive ? 800 : 600,
                    fontSize: 13.5,
                    color: isActive ? '#6a45d8' : '#8c8a81',
                    background: isActive ? '#fff' : 'transparent',
                    padding: '6px 14px',
                    borderRadius: 9,
                    boxShadow: isActive ? '0 1px 2px rgba(110,70,210,0.14)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all .15s ease',
                  }}
                >
                  {isActive ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c5cff', flex: '0 0 auto' }} /> : null}
                  {label}
                  {(() => { const n = label === 'Plans' ? plans.length : label === 'Journal' ? tradeCount : 0; return n ? <span style={{ fontWeight: 800, fontSize: 10, color: isActive ? '#6a45d8' : '#a8a69b', background: isActive ? '#f1ecff' : '#ececea', borderRadius: 99, padding: '1px 6px', fontVariantNumeric: 'tabular-nums' }}>{n}</span> : null; })()}
                </button>
              );
            })
          : TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontWeight: isActive ? 800 : 600,
                    fontSize: 13.5,
                    color: isActive ? '#6a45d8' : '#8c8a81',
                    background: isActive ? '#fff' : 'transparent',
                    padding: '6px 14px',
                    borderRadius: 9,
                    boxShadow: isActive ? '0 1px 2px rgba(110,70,210,0.14)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all .15s ease',
                  }}
                >
                  {isActive ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c5cff', flex: '0 0 auto' }} /> : null}
                  {tab.label}
                </button>
              );
            })}
      </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Segmented sync pill: lock·Read-only | hairline | live-pulse·Synced */}
        <button onClick={handleRefresh} title="Refresh" style={{ display: 'inline-flex', alignItems: 'stretch', background: '#fff', border: '1px solid #e9e6df', borderRadius: 999, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,20,12,0.05)', fontSize: 12.5, padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
          <style>{'@keyframes tbPulse{0%{transform:scale(.5);opacity:.45;}70%{opacity:0;}100%{transform:scale(1.9);opacity:0;}}'}</style>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', color: '#8c8a81', fontWeight: 600 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a8a69b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            Read-only
          </span>
          <span style={{ width: 1, background: '#ece9e3' }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px' }}>
            <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8, flex: '0 0 auto', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: '#1f9d55', opacity: 0.5, animation: 'tbPulse 1.9s ease-out infinite' }} />
              <span style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: '#1f9d55' }} />
            </span>
            <span style={{ fontWeight: 700, color: '#39372f' }}>Synced</span>
            <span style={{ fontWeight: 600, color: '#a8a69b' }}>{synced ?? '…'}</span>
          </span>
        </button>
        <ProfileMenu />
      </div>
    </div>
  );
}
