// Trade-plan data model + math — ported from the handoff-22 design's DCLogic
// (tpCompute / planToDraft / tpAutoName). The Editor, Plans board, plan drawer,
// and Journal adherence all build on this. localStorage-backed (see plan-store).

export type Sym = 'BTC' | 'ETH' | 'SOL';
export type Dir = 'long' | 'short';
export type Conv = 'low' | 'med' | 'high';
export type SizeMode = 'qty' | 'margin' | 'marginpct' | 'riskusd' | 'riskpct';
export type Status = 'idea' | 'armed' | 'triggered';

// The in-progress editor draft.
export interface PlanDraft {
  sym: Sym;
  dir: Dir;
  conv: Conv;
  entryMode: 'price' | 'zone';
  entry: string;
  ez1: string;
  ez2: string;
  stop: string;
  t1: string;
  t2: string;
  t3: string;
  lev: number;
  sizeMode: SizeMode;
  sizeVal: string;
  sizeVals?: Partial<Record<SizeMode, string>>;
  chart: string;
  name: string;
  rationale: string;
  trigger: string;
  invalidation: string;
  targetNote: string;
  // management-rule slots (compose into targetNote) + expected trade date (ISO)
  trailPeriod?: string;
  bankPct?: string;
  bankTarget?: string;
  tradeDate?: string;
}

// A saved plan: board metadata + (for user plans) a full `draft` snapshot. Seeds
// instead carry numeric entry/stop + an rr string, from which planToDraft rebuilds.
export interface Plan {
  id: string;
  sym: Sym;
  dir: Dir;
  status: Status;
  createdAt: number;
  name: string;
  conv: Conv;
  rationale: string;
  trigger: string;
  invalidation: string;
  targetNote: string;
  // numeric snapshot + labels (seeds use these; user plans also carry a full draft)
  entry?: string | number;
  stop?: string | number;
  lev: number;
  rr?: string;
  symLabel?: string;
  entryLabel?: string;
  stopLabel?: string;
  riskPctLabel?: string;
  chart?: string;
  draft?: PlanDraft;
  tradeDate?: string; // expected trade date (ISO yyyy-mm-dd)
}

// Account equity used for % sizing. Mirrors the dashboard header; the Editor can
// be fed the real account total instead of this constant.
export const TP_EQUITY = 284712.4;

export const TP_MARKETS: Record<Sym, { mark: number; step: number; tick: number; label: string }> = {
  BTC: { mark: 63880, step: 0.001, tick: 1, label: 'BTC/USDT.P' },
  ETH: { mark: 3470, step: 0.01, tick: 0.1, label: 'ETH/USDT.P' },
  SOL: { mark: 150.0, step: 0.1, tick: 0.01, label: 'SOL/USDT.P' },
};

export function TP_BLANK(): PlanDraft {
  return {
    sym: 'BTC', dir: 'long', conv: 'med', entryMode: 'price',
    entry: '', ez1: '', ez2: '', stop: '', t1: '', t2: '', t3: '',
    lev: 5, sizeMode: 'marginpct', sizeVal: '', sizeVals: {},
    chart: '', name: '', rationale: '', trigger: '', invalidation: '', targetNote: '',
    trailPeriod: '', bankPct: '70', bankTarget: '100k', tradeDate: todayISO(),
  };
}

// ── date helpers (shared by editor / board cards / plan drawer) ──────────────
export const todayISO = (): string => dateToISO(new Date());
export const dateToISO = (dt: Date): string =>
  dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
export const isoToDate = (s?: string): Date | null => {
  if (!s) return null;
  const a = String(s).split('-');
  const dt = new Date(+a[0], +a[1] - 1, +a[2]);
  return isNaN(dt.getTime()) ? null : dt;
};

const REL_M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const REL_WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// compact relative label for an ISO date (Today / Tomorrow / weekday / Jun 30, 2026)
export function relDateLabel(iso?: string): { label: string; sub: string | null } | null {
  const dt = isoToDate(iso);
  if (!dt) return null;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const diff = Math.round((dt.getTime() - t0.getTime()) / 86400000);
  const short = REL_M[dt.getMonth()] + ' ' + dt.getDate();
  if (diff === 0) return { label: 'Today', sub: short };
  if (diff === 1) return { label: 'Tomorrow', sub: short };
  if (diff > 1 && diff <= 6) return { label: REL_WD[dt.getDay()], sub: short };
  if (diff === -1) return { label: 'Yesterday', sub: short };
  return { label: short + ', ' + dt.getFullYear(), sub: null };
}

// the management rule sentence composed from the three editable slots
export const composeNote = (pct?: string, period?: string, target?: string): string =>
  'Trail with Donchian(' + (period || 'your TF') + ', 3) on impulse candles (HA). Bank ' +
  (pct || '70') + '% when reward hits $' + (target || '100k') + ', then trail the rest as before.';

export const tpNum = (v: unknown): number => parseFloat(String(v ?? '').replace(/,/g, ''));
export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
export const tpMoney = (v: number, dec = 0): string =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
// live comma separators for price/size inputs (display only; nfld strips them)
export const tpFmtNum = (v: string): string => {
  if (v === '' || v == null) return '';
  const neg = String(v).trim().startsWith('-');
  const [intp, dec] = String(v).replace(/[^0-9.]/g, '').split('.');
  const i = (intp || '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + (i || '0') + (dec !== undefined ? '.' + dec : '');
};

export function tpAutoName(src: { rationale?: string; sym?: Sym; dir?: Dir }): string {
  const r = (src.rationale || '').trim();
  if (r) return r.split(/\s+/).slice(0, 6).join(' ');
  return `${src.sym || 'BTC'} ${src.dir || 'long'}`;
}
export const tpPlanName = (p: Plan): string => (p.name && p.name.trim() ? p.name.trim() : tpAutoName(p));

export interface RR {
  i: number;
  price: number;
  r: number;
  rr: string;
  rewardUSD: number;
  distPct: number;
}

export interface Compute {
  mkt: (typeof TP_MARKETS)[Sym];
  Q: number;
  L: number;
  E: number;
  hasEntry: boolean;
  S: number;
  hasStop: boolean;
  usingLiqStop: boolean;
  isLong: boolean;
  riskPerUnit: number;
  hasRisk: boolean;
  qty: number;
  hasQty: boolean;
  notional: number;
  margin: number;
  marginPct: number;
  riskUSD: number;
  riskPct: number;
  liq: number;
  distStopPct: number;
  rrList: RR[];
  primaryR: number;
  blendedR: number;
  dirErr: string;
  levWarn: boolean;
  levBlocked: boolean;
  sizeIsPct: boolean;
  sizePct: number;
  sizeWarn: boolean;
  sizeBlocked: boolean;
  valid: boolean;
}

// Core trade math — risk, sizing, R:R, liquidation, validity. Faithful port of
// the design's tpCompute (qty is in units of the asset; notional = qty × price).
export function tpCompute(d: PlanDraft, equity = TP_EQUITY, markOverride?: number): Compute {
  const base = TP_MARKETS[d.sym] || TP_MARKETS.BTC;
  // real live mark when the caller has one (e.g. BTC from Gate); else the static ref
  const mkt = markOverride && isFinite(markOverride) ? { ...base, mark: markOverride } : base;
  const Q = equity;
  const L = Math.max(1, tpNum(d.lev) || 5);

  let E: number;
  if (d.entryMode === 'zone') {
    const a = tpNum(d.ez1), b = tpNum(d.ez2);
    E = isFinite(a) && isFinite(b) ? (a + b) / 2 : isFinite(a) ? a : b;
  } else E = tpNum(d.entry);

  const hasEntry = isFinite(E);
  const userStop = tpNum(d.stop), hasStop = isFinite(userStop);
  const tps = [d.t1, d.t2, d.t3].map((v) => tpNum(v)).filter((v) => isFinite(v));
  const isLong = d.dir === 'long';
  const refE = hasEntry ? E : mkt.mark; // fall back to mark for a live preview before entry typed
  const liq = hasEntry ? (isLong ? E * (1 - 1 / L) : E * (1 + 1 / L)) : NaN; // simple isolated approx
  const usingLiqStop = hasEntry && !hasStop; // no stop → ride to liquidation
  const S = hasStop ? userStop : hasEntry ? liq : NaN;
  const riskPerUnit = hasEntry && isFinite(S) ? Math.abs(refE - S) : NaN;
  const hasRisk = isFinite(riskPerUnit) && riskPerUnit > 0;

  let qty = NaN;
  const sv = tpNum(d.sizeVal);
  if (isFinite(sv) && refE > 0) {
    if (d.sizeMode === 'qty') qty = sv;
    else if (d.sizeMode === 'margin') qty = (sv * L) / refE;
    else if (d.sizeMode === 'marginpct') qty = ((Q * sv) / 100 * L) / refE;
    else if (d.sizeMode === 'riskusd') qty = hasRisk ? sv / riskPerUnit : NaN;
    else if (d.sizeMode === 'riskpct') qty = hasRisk ? (Q * sv) / 100 / riskPerUnit : NaN;
  }
  const hasQty = isFinite(qty) && qty > 0;
  const notional = hasQty ? qty * refE : NaN;
  const margin = hasQty ? notional / L : NaN;
  const marginPct = hasQty ? (margin / Q) * 100 : NaN;
  const riskUSD = hasQty && hasRisk ? qty * riskPerUnit : NaN;
  const riskPct = isFinite(riskUSD) ? (riskUSD / Q) * 100 : NaN;
  const distStopPct = hasRisk ? (riskPerUnit / refE) * 100 : NaN;

  const rrList: RR[] = tps.map((t, i) => {
    const reward = Math.abs(t - refE);
    const r = hasRisk ? reward / riskPerUnit : NaN;
    const rewardUSD = hasQty ? Math.abs(t - refE) * qty : NaN;
    return { i: i + 1, price: t, r, rr: isFinite(r) ? r.toFixed(2) : '—', rewardUSD, distPct: (Math.abs(t - refE) / refE) * 100 };
  });
  const primaryR = rrList.length ? rrList[0].r : NaN;
  const blendedR = rrList.length ? rrList.reduce((s, x) => s + (isFinite(x.r) ? x.r : 0), 0) / rrList.length : NaN;

  let dirErr = '';
  if (hasEntry && hasStop) {
    if (isLong && S >= refE) dirErr = 'For a long, stop must sit below entry.';
    else if (!isLong && S <= refE) dirErr = 'For a short, stop must sit above entry.';
  }
  if (!dirErr && tps.length) {
    const bad = isLong ? tps.some((t) => t <= refE) : tps.some((t) => t >= refE);
    if (bad) dirErr = isLong ? 'Targets must sit above entry for a long.' : 'Targets must sit below entry for a short.';
  }
  const levWarn = L > 5;
  const levBlocked = L > 10;
  const sizeIsPct = d.sizeMode === 'marginpct' || d.sizeMode === 'riskpct';
  const sizePct = sizeIsPct ? sv : NaN;
  const sizeWarn = sizeIsPct && isFinite(sizePct) && sizePct > 50;
  const sizeBlocked = sizeIsPct && isFinite(sizePct) && sizePct > 70;
  const valid = hasEntry && (hasStop || usingLiqStop) && tps.length > 0 && isFinite(sv) && hasQty && !dirErr && !levBlocked && !sizeBlocked;

  return {
    mkt, Q, L, E: refE, hasEntry, S, hasStop, usingLiqStop, isLong, riskPerUnit, hasRisk, qty, hasQty,
    notional, margin, marginPct, riskUSD, riskPct, liq, distStopPct, rrList, primaryR, blendedR,
    dirErr, levWarn, levBlocked, sizeIsPct, sizePct, sizeWarn, sizeBlocked, valid,
  };
}

// Rebuild an editor draft from a saved plan (real plans store a `draft` snapshot;
// seeds derive TP1 from the stored R:R).
export function planToDraft(p: Plan): PlanDraft {
  if (p.draft) return p.draft;
  const E = Number(p.entry), S = Number(p.stop), rr = parseFloat(p.rr || ''), risk = Math.abs(E - S);
  let t1 = '';
  if (isFinite(rr) && isFinite(risk) && risk > 0) t1 = String(Math.round(p.dir === 'long' ? E + rr * risk : E - rr * risk));
  return {
    ...TP_BLANK(),
    sym: p.sym, dir: p.dir, lev: p.lev, entryMode: 'price', entry: String(E), stop: String(S), t1,
    sizeMode: 'marginpct', sizeVal: '50', conv: p.conv,
    rationale: p.rationale, trigger: p.trigger, invalidation: p.invalidation, targetNote: p.targetNote,
  };
}

// 6 demo plans (2 Ideas, 2 Armed, 1 Triggered, + 1 extra) shown until the user
// touches the board. Charts on BTC-idea + ETH-armed.
export function TP_SEED(): Plan[] {
  const mk = (o: Partial<Plan> & { sym: Sym; dir: Dir; status: Status }): Plan =>
    ({ id: `seed_${o.sym}_${o.status}`, conv: 'med', createdAt: Date.now(), name: '', rationale: '', trigger: '', invalidation: '', targetNote: '', lev: 5, ...o }) as Plan;
  return [
    mk({ sym: 'BTC', symLabel: 'BTC/USDT.P', dir: 'long', entry: 63800, entryLabel: '$63,800', stop: 61900, stopLabel: '$61,900', lev: 5, rr: '3.10', riskPctLabel: '0.98%', status: 'idea', chart: '/seed-chart-btc.png',
      rationale: 'Reclaim of the $63.5k range high after a week of accumulation; spot CVD turning up and funding still flat.', trigger: 'Hourly close back above $63,800 with rising volume.', invalidation: 'Loss of $61,900 — that flips the range back to distribution.', targetNote: 'Scale out into $66k liquidity; trail the rest toward the $70k swing.' }),
    mk({ sym: 'SOL', symLabel: 'SOL/USDT.P', dir: 'long', entry: 148.2, entryLabel: '$148.20', stop: 142.0, stopLabel: '$142.00', lev: 5, rr: '2.45', riskPctLabel: '1.20%', status: 'idea',
      rationale: 'Higher-low structure off $140 support with relative strength vs ETH; DEX volumes climbing.', trigger: 'Bounce confirmation off the $148 retest with a bullish engulfing.', invalidation: 'Daily close under $142 breaks the trend of higher lows.', targetNote: 'First target $160 round number, then the $168 prior high.' }),
    mk({ sym: 'ETH', symLabel: 'ETH/USDT.P', dir: 'short', entry: 3540, entryLabel: '$3,540', stop: 3620, stopLabel: '$3,620', lev: 3, rr: '2.75', riskPctLabel: '0.85%', status: 'idea',
      rationale: 'Lower-high into the $3,550 weekly resistance with momentum fading; BTC dominance ticking up.', trigger: 'Rejection candle and 4H close back below $3,540.', invalidation: 'Reclaim and hold above $3,620.', targetNote: 'Scale out into $3,360, final into $3,300.' }),
    mk({ sym: 'ETH', symLabel: 'ETH/USDT.P', dir: 'short', entry: 3470, entryLabel: '$3,470', stop: 3558, stopLabel: '$3,558', lev: 3, rr: '2.10', riskPctLabel: '0.80%', status: 'armed', chart: '/seed-chart-eth.png',
      rationale: 'Rejection at the $3,500 supply zone with bearish divergence on the 4H RSI; ETH lagging BTC.', trigger: 'Rejection wick + close below $3,470 on the 4H.', invalidation: 'Acceptance above $3,558 invalidates the supply zone.', targetNote: 'Cover into $3,300 support; stretch target $3,200.' }),
    mk({ sym: 'BTC', symLabel: 'BTC/USDT.P', dir: 'short', entry: 66200, entryLabel: '$66,200', stop: 67900, stopLabel: '$67,900', lev: 4, rr: '1.85', riskPctLabel: '0.90%', status: 'armed',
      rationale: 'Failed breakout above $66k with a long upper wick; open interest spiking into resistance = trapped longs.', trigger: 'Break and retest of $66,200 as resistance.', invalidation: 'Reclaim and hold above $67,900.', targetNote: 'Target the $63.5k range low where buyers step in.' }),
    mk({ sym: 'ETH', symLabel: 'ETH/USDT.P', dir: 'long', entry: 3305, entryLabel: '$3,305', stop: 3180, stopLabel: '$3,180', lev: 5, rr: '3.25', riskPctLabel: '1.45%', status: 'triggered',
      rationale: 'Bounce off the $3,300 weekly support with capitulation volume; funding reset negative.', trigger: 'Triggered on the reclaim of $3,305 intraday.', invalidation: 'Close below $3,180 weekly support.', targetNote: 'Ladder out $3,500 / $3,650; final into $3,800.' }),
  ];
}

// localStorage keys (mirrors the design).
export const PLAN_KEYS = {
  view: 'tdplan_view',
  draft: 'tdplan_tp_draft',
  board: 'tdplan_board',
  editing: 'tdplan_editing',
  links: 'tdplan_pos_links',
  journal: 'tdplan_journal',
  demoCharts: 'tdplan_demo_charts',
} as const;
