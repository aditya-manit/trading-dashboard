'use client';

import { useSyncExternalStore } from 'react';

// Shared, persisted width for ALL side drawers (plan / open-position /
// recent-trade / journal). Drag a drawer's left edge to resize; the width
// sticks across drawers and reloads (localStorage `tdplan_drawer_w`).

const KEY = 'tdplan_drawer_w';
export const DRAWER_DEFAULT = 534;
const MIN_W = 360;
const maxW = () => Math.min(typeof window !== 'undefined' ? window.innerWidth * 0.96 : 1000, 1000);

let width = DRAWER_DEFAULT;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try { const v = +(localStorage.getItem(KEY) || ''); if (v) width = Math.max(MIN_W, Math.min(1000, v)); } catch { /* noop */ }
}
function setWidth(w: number) {
  width = Math.max(MIN_W, Math.min(maxW(), Math.round(w)));
  try { localStorage.setItem(KEY, String(width)); } catch { /* quota */ }
  emit();
}

export function useDrawerWidth(): number {
  return useSyncExternalStore(
    (cb) => { load(); listeners.add(cb); return () => listeners.delete(cb); },
    () => width,
    () => DRAWER_DEFAULT,
  );
}

// Plan-drawer companion stage panel tracks the live width during a drag.
function syncStage(w: number) {
  const stage = document.querySelector<HTMLElement>('.tp-plan-stage');
  if (stage) { stage.style.right = w + 'px'; stage.style.width = `min(680px, calc(100vw - ${w + 60}px))`; }
}

// The drag handle — drop as the FIRST child of a position:fixed drawer.
export function DrawerResizeHandle() {
  const onDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const handle = e.currentTarget;
    const drawer = handle.parentElement;
    if (!drawer) return;
    const startX = e.clientX;
    const startW = drawer.getBoundingClientRect().width;
    const lo = MIN_W, hi = maxW();
    let live = startW;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    handle.classList.add('drawer-resize-on');
    const move = (ev: MouseEvent) => {
      live = Math.max(lo, Math.min(hi, startW + (startX - ev.clientX)));
      drawer.style.width = live + 'px';
      syncStage(live);
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      handle.classList.remove('drawer-resize-on');
      setWidth(live);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };
  return (
    <>
      <style>{`.drawer-resize{position:absolute;left:0;top:0;height:100%;width:9px;cursor:ew-resize;z-index:7}.drawer-resize::before{content:"";position:absolute;left:0;top:0;height:100%;width:3px;background:transparent;transition:background .15s}.drawer-resize:hover::before,.drawer-resize-on::before{background:#7c5cff}.drawer-resize::after{content:"";position:absolute;left:3px;top:50%;transform:translateY(-50%);width:4px;height:34px;border-radius:3px;background:#d8d4ea;opacity:0;transition:opacity .15s}.drawer-resize:hover::after,.drawer-resize-on::after{opacity:1}`}</style>
      <div className="drawer-resize" onMouseDown={onDown} title="Drag to resize" />
    </>
  );
}
