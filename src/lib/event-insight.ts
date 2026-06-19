import type { AssetDir, ReleasedInfo } from '@/hooks/useCalendar';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// Server-only enrichment via the Claude Messages API. Two tiers, cached by
// `currency|title` and PERSISTED to disk so values don't change on restart /
// reload. Requires ANTHROPIC_API_KEY — without it, enrichment is skipped.
//   • reactions: condition + assets ("if hawkish → BTC↓") — cheap, batched, NO
//     web search — produced for ALL relevant events (every card gets it).
//   • prints: the 2 most recent occurrence dates — per-event web search,
//     verified — produced only for the strip's 4 cards (the expensive bit).
// Calls use temperature 0 so a re-enrichment returns the same answer.

const MODEL = 'claude-haiku-4-5-20251001';
const dirs: AssetDir[] = ['up', 'down', 'flat'];
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const authHeaders = (apiKey: string) => ({ 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' });

type Reaction = { condition: string; assets: { sym: string; dir: AssetDir }[] };
const reactionCache = new Map<string, Reaction>();
const printsCache = new Map<string, { date: string }[]>();
const releasedCache = new Map<string, ReleasedInfo>();
const asset = (a: unknown): { sym: string; dir: AssetDir } => {
  const o = a as { sym?: unknown; dir?: unknown };
  const dir = o?.dir as AssetDir;
  return { sym: String(o?.sym ?? ''), dir: dirs.includes(dir) ? dir : 'flat' };
};

export const insightKey = (country: string, title: string) => `${country}|${title}`;

// ── Disk persistence (survives dev restarts & redeploys with a writable FS) ──
const CACHE_FILE = join(process.cwd(), '.cache', 'event-insight.json');
let cacheLoaded = false;

function loadCache() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const raw = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as {
      reactions?: Record<string, Reaction>;
      prints?: Record<string, { date: string }[]>;
      released?: Record<string, ReleasedInfo>;
    };
    for (const [k, v] of Object.entries(raw.reactions ?? {})) reactionCache.set(k, v);
    for (const [k, v] of Object.entries(raw.prints ?? {})) printsCache.set(k, v);
    for (const [k, v] of Object.entries(raw.released ?? {})) releasedCache.set(k, v);
  } catch { /* no cache yet */ }
}

function saveCache() {
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify({
      reactions: Object.fromEntries(reactionCache),
      prints: Object.fromEntries(printsCache),
      released: Object.fromEntries(releasedCache),
    }));
  } catch { /* read-only FS (e.g. serverless) — stays in-memory only */ }
}

// ── Permanent released-outcomes archive (committed, per-occurrence) ──
// Once an event has settled (a few hours after release) its final details are
// written here and NEVER re-fetched. Unlike the .cache file this is committed
// to the repo, keyed by `currency|title|YYYY-MM-DD` so each occurrence is kept
// forever (a new FOMC doesn't overwrite the last one).
const ARCHIVE_FILE = join(process.cwd(), 'data', 'released-archive.json');
const archive = new Map<string, ReleasedInfo>();
let archiveLoaded = false;
// Two-stage timing after a release fires:
//   FETCH_AFTER_MS (2h) — don't web-search the actual until the figure has had
//     time to be reported/indexed, so the first pull lands a CONFIRMED number
//     rather than burning a search on a too-fresh event (which returns blank).
//   SETTLE_MS (4h) — once the reaction has settled, promote the cached outcome
//     into the permanent committed archive, never to be re-fetched.
const FETCH_AFTER_MS = 2 * 3_600_000;
const SETTLE_MS = 4 * 3_600_000;
const relKey = (country: string, title: string, date: string) => `${country}|${title}|${date.slice(0, 10)}`;

function loadArchive() {
  if (archiveLoaded) return;
  archiveLoaded = true;
  try {
    const raw = JSON.parse(readFileSync(ARCHIVE_FILE, 'utf8')) as Record<string, ReleasedInfo>;
    for (const [k, v] of Object.entries(raw)) archive.set(k, v);
  } catch { /* no archive yet */ }
}

function saveArchive() {
  try {
    mkdirSync(dirname(ARCHIVE_FILE), { recursive: true });
    writeFileSync(ARCHIVE_FILE, JSON.stringify(Object.fromEntries([...archive.entries()].sort()), null, 2));
  } catch { /* read-only FS */ }
}

const REACTION_SYSTEM = `You annotate macro economic-calendar events for a trader of BTC/USDT perpetual futures. For each event, give the typical market reaction to the outcome that is BULLISH for the event's own currency (hawkish central bank, hot inflation, strong beat, more hawkish dots, etc.).

Reply with ONLY a JSON array — no prose, no code fences — one object per input event, IN THE SAME ORDER:
{"condition":"ONE word only, e.g. Hawkish, Hot, Beat, Fewer (no qualifiers like 'hawkish hold')","assets":[{"sym":"<short symbol e.g. BTC, USD, stocks, gold>","dir":"up|down|flat"}]}

Rules:
- 2 to 3 assets; ALWAYS include BTC and its likely direction under that scenario.
- Symbols <=6 chars; use the event currency code where relevant.`;

const PRINTS_SYSTEM = `You find the 2 MOST RECENT *already-completed* occurrence dates of ONE recurring economic release (same country/currency AND same release), for a BTC trader's calendar.

The dates must be STRICTLY BEFORE the "asOf" date — occurrences that have already happened. DO NOT include an occurrence dated on asOf itself or in the future (e.g. a meeting taking place today/this week). Return the two that occurred just before that.

USE WEB SEARCH — do not rely on memory. ACCURACY OVER COMPLETENESS:
- Only include a date CONFIRMED from an authoritative source: the issuing central bank / official statistics agency, or a major economic calendar (ForexFactory, Investing.com, Trading Economics). Cross-check across sources.
- If sources disagree, the date belongs to a DIFFERENT release, or you cannot confirm it — DO NOT include it. It is far better to return [] than to guess.

Your FINAL message must be ONLY a JSON object (no prose, no code fences):
{"prints":[{"date":"YYYY-MM-DD","source":"<authoritative source name/URL confirming this exact date>"}]}
Most recent first; [] if uncertain, unverifiable, or a one-off.`;

// Bounded-concurrency map so we don't fire 19 web-search calls at once.
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

// Tier 1 — reactions for ALL relevant events (one batched call, no web search).
export async function enrichReactions(
  events: { country: string; title: string }[],
): Promise<Record<string, Reaction>> {
  loadCache();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const result: Record<string, Reaction> = {};
  const uniq = new Map<string, { country: string; title: string }>();
  for (const e of events) uniq.set(insightKey(e.country, e.title), e);
  const missing = [...uniq.entries()].filter(([k]) => !reactionCache.has(k)).map(([, e]) => e);

  if (apiKey && missing.length) {
    try {
      const res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: authHeaders(apiKey),
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1500,
          temperature: 0,
          system: REACTION_SYSTEM,
          messages: [{ role: 'user', content: JSON.stringify(missing.map((e) => ({ currency: e.country, event: e.title }))) }],
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text: string = (data.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
      const s = text.indexOf('['), en = text.lastIndexOf(']');
      if (s === -1 || en === -1) throw new Error('no JSON array in model reply');
      const arr = JSON.parse(text.slice(s, en + 1)) as unknown[];
      arr.forEach((o, i) => {
        const e = missing[i]; if (!e) return;
        const obj = o as { condition?: unknown; assets?: unknown };
        const assets = Array.isArray(obj.assets) ? obj.assets : [];
        reactionCache.set(insightKey(e.country, e.title), {
          condition: String(obj.condition ?? ''),
          assets: assets.slice(0, 3).map((a) => {
            const x = a as { sym?: unknown; dir?: unknown };
            const dir = x.dir as AssetDir;
            return { sym: String(x.sym ?? ''), dir: dirs.includes(dir) ? dir : 'flat' };
          }),
        });
      });
    } catch (err) {
      console.error('[event-insight] reactions failed:', err);
    }
    saveCache();
  }

  for (const k of uniq.keys()) { const v = reactionCache.get(k); if (v) result[k] = v; }
  return result;
}

// Tier 2 — verified "2 prints" dates, per-event web search, only for the strip.
export async function enrichPrints(
  events: { country: string; title: string }[],
): Promise<Record<string, { date: string }[]>> {
  loadCache();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const result: Record<string, { date: string }[]> = {};
  const uniq = new Map<string, { country: string; title: string }>();
  for (const e of events) uniq.set(insightKey(e.country, e.title), e);
  const missing = [...uniq.entries()].filter(([k]) => !printsCache.has(k)).map(([, e]) => e);

  if (apiKey && missing.length) {
    await pool(missing, 5, async (e) => {
      try {
        printsCache.set(insightKey(e.country, e.title), await fetchPrints(apiKey, e));
      } catch (err) {
        console.error(`[event-insight] prints ${e.country} ${e.title}:`, err);
      }
    });
    saveCache();
  }

  for (const k of uniq.keys()) { const v = printsCache.get(k); if (v) result[k] = v; }
  return result;
}

async function fetchPrints(
  apiKey: string,
  event: { country: string; title: string },
): Promise<{ date: string }[]> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      temperature: 0,
      system: PRINTS_SYSTEM,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
      messages: [{
        role: 'user',
        content: JSON.stringify({ asOf: new Date().toISOString().slice(0, 10), currency: event.country, event: event.title }),
      }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);

  const data = await res.json();
  // With web search the reply has several blocks; the JSON object is the final
  // text block. Prefer the last text block, fall back to all concatenated.
  const texts: string[] = (data.content || [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text);
  let text = texts[texts.length - 1] ?? '';
  if (!text.includes('{')) text = texts.join('');

  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in model reply');
  const obj = JSON.parse(text.slice(start, end + 1)) as { prints?: unknown };

  // Keep only dates the model confirmed with a source and a valid ISO format.
  const raw = Array.isArray(obj.prints) ? obj.prints : [];
  return raw
    .map((p) => {
      const o = p as { date?: unknown; source?: unknown };
      return { date: String(o?.date ?? ''), source: String(o?.source ?? '').trim() };
    })
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.source.length > 0)
    .slice(0, 2)
    .map((p) => ({ date: p.date }));
}

// Tier 3 — released events: actual figure + surprise + realized reaction
// (per-event web search, verified, persisted). For the drawer's "Released" tab.
const RELEASED_SYSTEM = `You report what happened for an economic release that has ALREADY occurred (the "date" is given), for a BTC/USDT perp trader.

USE WEB SEARCH to find the ACTUAL released figure and how markets reacted in the hours after — do not rely on memory. If you cannot confirm the actual figure from a credible source, set "actual" to "".

Your FINAL message must be ONLY a JSON object (no prose, no code fences):
{"actual":"<the figure ONLY, in the SAME format/units as the forecast>","surprise":"Hot|Soft|In line","bearishForBtc":true|false,"condition":"ONE word bullish-for-currency scenario, e.g. hawkish, hot, beat, fewer (no qualifiers)","ifReaction":[{"sym":"crypto","dir":"up|down|flat"}],"reaction":[{"sym":"BTC","dir":"up|down|flat"},{"sym":"stocks","dir":"up|down|flat"}],"note":"<optional, <=140 chars: a useful detail — vs forecast/previous, a notable move, or what stood out. Empty string if nothing noteworthy.>"}

Rules:
- "actual": if the release HAS a numeric reading, give JUST that figure in the forecast's format (data: "0.4%"; rate decision: the SINGLE policy rate e.g. "3.75%", never a range). If the release has NO number — a policy STATEMENT, SUMMARY, PRESS CONFERENCE, speech, or minutes — give a SHORT 1-2 word qualitative outcome instead (e.g. "Hawkish", "Dovish", "Hawkish hold"). NEVER invent a number or repeat a rate range (e.g. "3.625%" or "3.50%-3.75%") for a non-numeric event.
- MATCH THE FORECAST'S FORMAT EXACTLY. If the forecast is a VOTE SPLIT like "1-0-8", the actual MUST be the SAME N-part split in the same order (e.g. "0-2-7") — never collapse it to "7-2" or a single number.
- A "...Summary" / "...Statement" / "...Minutes" / "...Press Conference" is the COMMENTARY, not the decision — give its TONE ("Hawkish hold"), NEVER the policy rate. The rate belongs to the rate-decision event; give the right event the credit.
- "surprise": how the release compared to what was EXPECTED — this drives the Actual's colour, so be precise.
  • Forecast given → Hot = actual above forecast, Soft = below, In line = equals it.
  • No forecast figure (statement, dot plot, press conf) → judge vs the PRIOR reading / consensus you find: Hot if clearly more hawkish/stronger than expected (e.g. dot plot revised UP), Soft if more dovish/weaker, In line if it matched.
  • A rate HELD exactly at the forecast is "In line" even if the meeting was hawkish — the hawkish surprise belongs to the projections/statement event, NOT the rate decision. Give the right event the credit.
- "reaction": SEPARATELY, what BTC and stocks ACTUALLY did after the print (2 assets, BTC first). Report the TRUTH from web search even if it DIVERGED from the typical reaction — do NOT force it to match "surprise" or "bearishForBtc".
- "bearishForBtc": whether the outcome would TYPICALLY be read as bearish for BTC (not necessarily what actually happened).
- "note": one precise, factual line — the specific number vs forecast/prior, what stood out, or why the figure was in-line but the meeting still moved markets.

EXAMPLES (input → output):
{"currency":"USD","event":"Federal Funds Rate","forecast":"3.75%"} (Fed held at 3.75%) →
{"actual":"3.75%","surprise":"In line","bearishForBtc":false,"condition":"hawkish","ifReaction":[{"sym":"crypto","dir":"down"}],"reaction":[{"sym":"BTC","dir":"down"},{"sym":"stocks","dir":"down"}],"note":"Held at 3.75% as expected — the hawkish surprise was the dot plot, not the rate."}

{"currency":"USD","event":"FOMC Economic Projections","forecast":""} (dot plot revised up) →
{"actual":"3.8%","surprise":"Hot","bearishForBtc":true,"condition":"hawkish","ifReaction":[{"sym":"crypto","dir":"down"}],"reaction":[{"sym":"BTC","dir":"down"},{"sym":"stocks","dir":"down"}],"note":"Median 2026 dot raised to 3.8% from 3.4%; 9 of 18 now project hikes — the real hawkish surprise."}

{"currency":"USD","event":"Core CPI m/m","forecast":"0.3%"} (hot print but BTC rallied) →
{"actual":"0.4%","surprise":"Hot","bearishForBtc":true,"condition":"hot","ifReaction":[{"sym":"BTC","dir":"down"}],"reaction":[{"sym":"BTC","dir":"up"},{"sym":"stocks","dir":"up"}],"note":"Hot 0.4% vs 0.3%, yet BTC rallied on positioning — reaction diverged from the usual drop."}

{"currency":"USD","event":"FOMC Statement","forecast":""} (no number — hawkish text) →
{"actual":"Hawkish","surprise":"Hot","bearishForBtc":true,"condition":"hawkish","ifReaction":[{"sym":"crypto","dir":"down"}],"reaction":[{"sym":"BTC","dir":"down"},{"sym":"stocks","dir":"down"}],"note":"Dropped the easing bias and flagged upside inflation risks — no figure, tone hawkish."}

{"currency":"GBP","event":"MPC Official Bank Rate Votes","forecast":"1-0-8"} (two members dissented for a hike) →
{"actual":"0-2-7","surprise":"Hot","bearishForBtc":true,"condition":"hawkish","ifReaction":[{"sym":"crypto","dir":"down"}],"reaction":[{"sym":"BTC","dir":"down"},{"sym":"stocks","dir":"up"}],"note":"2 of 9 dissented for a hike vs none expected — same 3-part split format, hawkish surprise."}

{"currency":"GBP","event":"Monetary Policy Summary","forecast":""} (rate held, hawkish minutes) →
{"actual":"Hawkish hold","surprise":"In line","bearishForBtc":true,"condition":"hawkish","ifReaction":[{"sym":"crypto","dir":"down"}],"reaction":[{"sym":"BTC","dir":"down"},{"sym":"stocks","dir":"up"}],"note":"Held; minutes leaned hawkish on sticky services inflation — TONE, not the 3.75% rate (that's the rate event)."}`;

export async function enrichReleased(
  events: { country: string; title: string; date: string; forecast?: string }[],
): Promise<Record<string, ReleasedInfo>> {
  loadCache();
  loadArchive();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const result: Record<string, ReleasedInfo> = {};

  // Dedupe by OCCURRENCE (currency|title|date) — each release is kept separately.
  const uniq = new Map<string, { country: string; title: string; date: string; forecast?: string }>();
  for (const e of events) uniq.set(relKey(e.country, e.title, e.date), e);

  // Fetch only occurrences that are (a) absent from BOTH the archive and the
  // transient cache, AND (b) at least FETCH_AFTER_MS past release — so the
  // first (and usually only) web search lands a confirmed figure instead of a
  // blank. Archived events are final; too-fresh events wait and show "—" until
  // they settle, then pull cleanly.
  const toFetch = [...uniq.entries()]
    .filter(([occ, e]) => !archive.has(occ) && !releasedCache.has(occ) && Date.now() - new Date(e.date).getTime() > FETCH_AFTER_MS)
    .map(([, e]) => e);
  if (apiKey && toFetch.length) {
    await pool(toFetch, 5, async (e) => {
      try {
        const info = await fetchReleased(apiKey, e);
        if (info) releasedCache.set(relKey(e.country, e.title, e.date), info);
      } catch (err) {
        console.error(`[event-insight] released ${e.country} ${e.title}:`, err);
      }
    });
    saveCache();
  }

  // Promote settled occurrences (≥4h after release) from the transient cache
  // into the permanent committed archive — written once, kept forever.
  let promoted = false;
  for (const [occ, e] of uniq) {
    if (archive.has(occ)) continue;
    const info = releasedCache.get(occ);
    if (info && Date.now() - new Date(e.date).getTime() > SETTLE_MS) { archive.set(occ, info); promoted = true; }
  }
  if (promoted) saveArchive();

  // Result keyed by currency|title (what the client merges on); archive wins.
  for (const [occ, e] of uniq) {
    const info = archive.get(occ) ?? releasedCache.get(occ);
    if (info) result[insightKey(e.country, e.title)] = info;
  }
  return result;
}

async function fetchReleased(
  apiKey: string,
  event: { country: string; title: string; date: string; forecast?: string },
): Promise<ReleasedInfo | null> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      temperature: 0,
      system: RELEASED_SYSTEM,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
      messages: [{ role: 'user', content: JSON.stringify({ date: event.date.slice(0, 10), currency: event.country, event: event.title, forecast: event.forecast || '' }) }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const texts: string[] = (data.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text);
  let text = texts[texts.length - 1] ?? '';
  if (!text.includes('{')) text = texts.join('');
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in model reply');
  const o = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;

  const actual = String(o.actual ?? '').trim();
  const reaction = (Array.isArray(o.reaction) ? o.reaction : []).slice(0, 3).map(asset);
  // Require a CONFIRMED actual. A post-release event always has one (a figure,
  // or a qualitative tone like "Hawkish hold"). An empty actual means the figure
  // wasn't confirmable yet — throw so it is NOT cached and re-pulls next time,
  // instead of freezing on a flat-guess reaction. (This was the bug that left
  // the BoE summary/votes blank: empty actual + flat reaction got cached final.)
  if (!actual) throw new Error('actual not confirmed yet');
  return {
    actual,
    surprise: String(o.surprise ?? 'In line'),
    bearishForBtc: o.bearishForBtc === true,
    condition: String(o.condition ?? ''),
    ifReaction: (Array.isArray(o.ifReaction) ? o.ifReaction : []).slice(0, 3).map(asset),
    reaction,
    note: String(o.note ?? '').trim() || undefined,
  };
}

// ─── Real BTC daily moves (Gate.io) ───────────────────────────────────────────
// Maps a UTC 'YYYY-MM-DD' date → BTC's measured (close-open)/open % move that day.
// Used to fill the "2 prints" reactions with real numbers, not model guesses.
let candleCache: { at: number; map: Map<string, number> } | null = null;

export async function btcDailyMoves(): Promise<Map<string, number>> {
  if (candleCache && Date.now() - candleCache.at < 3_600_000) return candleCache.map;
  const map = new Map<string, number>();
  try {
    // Wide window (~1000d) so older occurrence dates still resolve to a candle.
    const from = Math.floor(Date.now() / 1000) - 1000 * 86400;
    const res = await fetch(
      `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=BTC_USDT&interval=1d&from=${from}&limit=1000`,
      { next: { revalidate: 3600 } },
    );
    if (res.ok) {
      const raw: string[][] = await res.json();
      for (const c of raw) {
        const open = parseFloat(c[5]), close = parseFloat(c[2]);
        if (!open) continue;
        const day = new Date(parseInt(c[0], 10) * 1000).toISOString().slice(0, 10);
        map.set(day, ((close - open) / open) * 100);
      }
    }
  } catch { /* leave map empty — prints just won't render */ }
  candleCache = { at: Date.now(), map };
  return map;
}
