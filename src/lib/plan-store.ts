'use client';

// Shared, localStorage-backed store for the Plan funnel + the dashboard's
// position⇄plan links. A tiny module store (useSyncExternalStore) so both the
// Plan pages AND the dashboard PositionsTable/drawers read the same state
// without a provider. Mirrors the design's tdplan_* localStorage keys.

import { useSyncExternalStore } from 'react';
import {
  type Plan, type PlanDraft, type Status, type SizeMode,
  TP_BLANK, TP_SEED, PLAN_KEYS,
} from './plan-model';

export type PlanView = 'workbook' | 'editor' | 'board' | 'journal';
export interface JournalRecord { grade?: string; note?: string; reviewed?: boolean }

interface PlanState {
  view: PlanView;
  draft: PlanDraft;
  plans: Plan[];
  editingId: string | null;
  openPlanId: string | null; // plan-detail drawer
  links: Record<string, string>;
  journal: Record<string, JournalRecord>;
  ready: boolean; // hydrated from localStorage (client only)
  remote: boolean; // Supabase is the source of truth (else localStorage)
}

const SEED_LINKS: Record<string, string> = {
  'BTC/USDT.P': 'seed_BTC_idea',
};

let state: PlanState = {
  view: 'workbook',
  draft: TP_BLANK(),
  plans: [],
  editingId: null,
  openPlanId: null,
  links: {},
  journal: {},
  ready: false,
  remote: false,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<PlanState>) => { state = { ...state, ...patch }; emit(); };

const read = <T,>(k: string, fallback: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } };
const writeRaw = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* quota */ } };

let hydrated = false;
function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  const view = (localStorage.getItem(PLAN_KEYS.view) as PlanView) || 'workbook';
  const draft = read<PlanDraft>(PLAN_KEYS.draft, TP_BLANK());
  let plans = read<Plan[]>(PLAN_KEYS.board, []);
  if (!plans.length) plans = TP_SEED();
  const editingId = localStorage.getItem(PLAN_KEYS.editing) || null;
  const links = { ...SEED_LINKS, ...read<Record<string, string>>(PLAN_KEYS.links, {}) };
  const journal = read<Record<string, JournalRecord>>(PLAN_KEYS.journal, {});
  state = { ...state, view, draft, plans, editingId, links, journal, ready: true };
  emit();
  void syncRemote(); // if Supabase is configured, it becomes the source of truth
}

// Pull plans/links/journal from Supabase. A 501 means the backend isn't
// configured → stay in localStorage mode (local dev). Server data replaces the
// local view (no seed injection — a real account starts as it is).
async function syncRemote() {
  try {
    const [pr, lr, jr] = await Promise.all([
      fetch('/api/plans'), fetch('/api/links'), fetch('/api/journal'),
    ]);
    if (pr.status === 501) return; // not configured → localStorage mode
    if (!pr.ok) return;
    const patch: Partial<PlanState> = { remote: true };
    const pj = await pr.json(); patch.plans = (pj.plans as Plan[]) || [];
    if (lr.ok) { const lj = await lr.json(); patch.links = (lj.links as Record<string, string>) || {}; }
    if (jr.ok) { const jj = await jr.json(); patch.journal = (jj.journal as Record<string, JournalRecord>) || {}; }
    set(patch);
  } catch { /* offline / not configured → localStorage mode */ }
}

// Upload a base64 chart to Storage and swap it for the returned URL (top-level
// and the draft snapshot), then upsert the plan. Returns the URL-resolved plan.
async function persistPlanRemote(plan: Plan): Promise<Plan> {
  let p = plan;
  if (typeof p.chart === 'string' && p.chart.startsWith('data:')) {
    try {
      const r = await fetch('/api/plans/chart', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dataUrl: p.chart, planId: p.id }) });
      if (r.ok) { const { url } = await r.json(); p = { ...p, chart: url, draft: p.draft ? { ...p.draft, chart: url } : p.draft }; }
    } catch { /* keep base64 if upload fails */ }
  }
  await fetch('/api/plans', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) }).catch(() => {});
  return p;
}
const apiDeletePlan = (id: string) => fetch('/api/plans?id=' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {});
const apiPostPlan = (p: Plan) => fetch('/api/plans', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) }).catch(() => {});

const subscribe = (cb: () => void) => { hydrate(); listeners.add(cb); return () => { listeners.delete(cb); }; };
const getSnapshot = () => state;
const getServerSnapshot = () => state;

// ── actions ───────────────────────────────────────────────────────────────
export const planActions = {
  setView(v: PlanView) { writeRaw(PLAN_KEYS.view, v); set({ view: v }); },

  setDraft(patch: Partial<PlanDraft>) {
    const prev = state.draft;
    const next: PlanDraft = { ...prev, ...patch };
    // per-unit sizing memory: switching the unit must NOT reinterpret the number
    if (patch.sizeMode !== undefined && patch.sizeMode !== prev.sizeMode) {
      const store = { ...(prev.sizeVals || {}) };
      if (prev.sizeVal !== '' && prev.sizeVal != null) store[prev.sizeMode] = prev.sizeVal;
      next.sizeVals = store;
      next.sizeVal = store[patch.sizeMode as SizeMode] ?? '';
    }
    write(PLAN_KEYS.draft, next);
    set({ draft: next });
  },
  clearDraft() { try { localStorage.removeItem(PLAN_KEYS.draft); localStorage.removeItem(PLAN_KEYS.editing); } catch {} set({ draft: TP_BLANK(), editingId: null }); },
  setDraftFull(d: PlanDraft) { write(PLAN_KEYS.draft, d); set({ draft: d }); },

  savePlan(plan: Plan) {
    const plans = state.editingId
      ? state.plans.map((p) => (p.id === state.editingId ? plan : p))
      : [plan, ...state.plans];
    try { localStorage.removeItem(PLAN_KEYS.draft); localStorage.removeItem(PLAN_KEYS.editing); } catch {}
    set({ plans, draft: TP_BLANK(), editingId: null, view: 'board' });
    writeRaw(PLAN_KEYS.view, 'board');
    if (state.remote) void persistPlanRemote(plan).then((p) => set({ plans: state.plans.map((x) => (x.id === p.id ? p : x)) }));
    else write(PLAN_KEYS.board, plans);
  },
  deletePlan(id: string) {
    const plans = state.plans.filter((p) => p.id !== id);
    // drop links that pointed at this plan (server cascades too; keep client in sync)
    const links = Object.fromEntries(Object.entries(state.links).filter(([, pid]) => pid !== id));
    set({ plans, links });
    if (state.remote) void apiDeletePlan(id);
    else { write(PLAN_KEYS.board, plans); write(PLAN_KEYS.links, links); }
  },
  movePlan(id: string, status: Status) {
    const plans = state.plans.map((p) => (p.id === id ? { ...p, status } : p));
    set({ plans });
    if (state.remote) { const np = plans.find((p) => p.id === id); if (np) void apiPostPlan(np); }
    else write(PLAN_KEYS.board, plans);
  },
  startEdit(id: string, draft: PlanDraft) {
    write(PLAN_KEYS.draft, draft); writeRaw(PLAN_KEYS.editing, id); writeRaw(PLAN_KEYS.view, 'editor');
    set({ draft, editingId: id, view: 'editor', openPlanId: null });
  },
  openPlan(id: string) { set({ openPlanId: id }); },
  closePlan() { set({ openPlanId: null }); },
  duplicatePlan(id: string) {
    const src = state.plans.find((p) => p.id === id);
    if (!src) return;
    const copy: Plan = { ...src, id: 'tp_' + Date.now().toString(36), status: 'idea', createdAt: Date.now(), name: (src.name || '') + (src.name ? ' copy' : '') };
    const plans = [copy, ...state.plans];
    set({ plans, openPlanId: copy.id });
    if (state.remote) void apiPostPlan(copy);
    else write(PLAN_KEYS.board, plans);
  },
  cancelEdit() { try { localStorage.removeItem(PLAN_KEYS.draft); localStorage.removeItem(PLAN_KEYS.editing); } catch {} writeRaw(PLAN_KEYS.view, 'board'); set({ draft: TP_BLANK(), editingId: null, view: 'board' }); },
  updateThesis(id: string, field: keyof PlanDraft, value: string) {
    const plans = state.plans.map((p) => p.id === id
      ? { ...p, [field]: value, draft: { ...(p.draft || ({} as PlanDraft)), [field]: value } }
      : p);
    set({ plans });
    if (state.remote) { const np = plans.find((p) => p.id === id); if (np) void apiPostPlan(np); }
    else write(PLAN_KEYS.board, plans);
  },

  linkSet(pid: string, planId: string) {
    const links = { ...state.links, [pid]: planId };
    set({ links });
    if (state.remote) void fetch('/api/links', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pid, planId }) }).catch(() => {});
    else write(PLAN_KEYS.links, links);
  },
  linkClear(pid: string) {
    const links = { ...state.links }; delete links[pid];
    set({ links });
    if (state.remote) void fetch('/api/links?pid=' + encodeURIComponent(pid), { method: 'DELETE' }).catch(() => {});
    else write(PLAN_KEYS.links, links);
  },

  setJournalField(pid: string, patch: JournalRecord) {
    const rec = { ...(state.journal[pid] || {}), ...patch, reviewed: true };
    const journal = { ...state.journal, [pid]: rec };
    set({ journal });
    if (state.remote) void fetch('/api/journal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tradeKey: pid, ...rec }) }).catch(() => {});
    else write(PLAN_KEYS.journal, journal);
  },
};

export function usePlanStore(): PlanState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export { TP_BLANK };
export type { Plan, PlanDraft, Status };
