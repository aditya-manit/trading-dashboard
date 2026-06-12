'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';

const TABS = [
  { id: 'overview',   label: 'Overview' },
  { id: 'positions',  label: 'Positions' },
  { id: 'reports',    label: 'Reports' },
  { id: 'history',    label: 'History' },
];

export function Topbar() {
  const { mutate } = useSWRConfig();
  const [synced, setSynced] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { setSynced('just now'); }, []);

  useEffect(() => {
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
  }, []);

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
      </div>

      {/* Nav tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f6f5f2', border: '1px solid #eeede9', borderRadius: 12, padding: 4 }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              style={{
                fontWeight: isActive ? 700 : 600,
                fontSize: 13.5,
                color: isActive ? '#d6532a' : '#8c8a81',
                background: isActive ? 'linear-gradient(135deg,#fdeadd,#fbd6c4)' : 'transparent',
                padding: '8px 16px',
                borderRadius: 9,
                boxShadow: isActive ? '0 1px 2px rgba(200,90,40,0.08)' : 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all .15s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={handleRefresh}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 12.5, color: '#8c8a81', background: '#f6f5f2', border: '1px solid #eeede9', padding: '7px 13px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2faa63', boxShadow: '0 0 0 3px rgba(47,170,99,0.16)', display: 'inline-block' }} />
          Read-only · {synced ? `synced ${synced}` : 'syncing…'}
        </button>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(150deg,#d7d4cc,#bcb9af)', display: 'grid', placeItems: 'center', color: '#46443c', fontWeight: 700, fontSize: 13 }}>AV</div>
      </div>
    </div>
  );
}
