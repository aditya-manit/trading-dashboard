import type { EventInsight, AssetDir } from '@/hooks/useCalendar';

// Server-only: enriches economic-calendar events with a short "market reaction"
// line via the Claude Messages API. Interpretations depend only on the event
// TYPE (currency + title), so they're cached in-process and reused across weeks.
// Requires ANTHROPIC_API_KEY in the environment — without it, enrichment is
// skipped and events simply carry no insight.

const MODEL = 'claude-haiku-4-5-20251001';
const cache = new Map<string, EventInsight>();

export const insightKey = (country: string, title: string) => `${country}|${title}`;

const SYSTEM = `You annotate ONE macro economic-calendar event for a trader of BTC/USDT perpetual futures.

Describe how markets typically react to the outcome that is BULLISH for the event's own currency (hawkish central bank, hot inflation, strong beat, more hawkish dots, etc.).

For "prints", USE WEB SEARCH to find the 2 MOST RECENT past occurrence dates of this EXACT recurring release (same country/currency AND same release), on or before the "asOf" date. ACCURACY OVER COMPLETENESS:
- Only include a date you have CONFIRMED from an authoritative source: the issuing central bank / official statistics agency, or a major economic calendar (ForexFactory, Investing.com, Trading Economics).
- Cross-check across sources. If sources disagree, or the date you find belongs to a DIFFERENT release, or you cannot confirm it — DO NOT include it.
- It is far better to return "prints": [] than to guess. When in any doubt, return [].

Your FINAL message must be ONLY a JSON object (no prose, no code fences):
{"condition":"<=2 words bullish-for-the-currency scenario, e.g. Hawkish, Hot CPI, Beat, Fewer claims","assets":[{"sym":"<short symbol e.g. BTC, USD, stocks, gold>","dir":"up|down|flat"}],"prints":[{"date":"YYYY-MM-DD","source":"<authoritative source name/URL confirming this exact date>"}]}

Rules:
- 2 to 3 assets; ALWAYS include BTC and its likely direction under that scenario.
- Symbols <=6 chars; use the event currency code where relevant.
- "prints": most recent first; ONLY verified dates each with a real confirming source; [] if uncertain, unverifiable, or a one-off.`;

// Bounded-concurrency map so we don't fire 19 web-search calls at once.
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

export async function enrichInsights(
  events: { country: string; title: string }[],
): Promise<Record<string, EventInsight>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const result: Record<string, EventInsight> = {};

  // Dedupe by event identity.
  const uniq = new Map<string, { country: string; title: string }>();
  for (const e of events) uniq.set(insightKey(e.country, e.title), e);
  const missing = [...uniq.entries()].filter(([k]) => !cache.has(k)).map(([, e]) => e);

  if (apiKey && missing.length) {
    // One web-searched lookup per event (more accurate than a batched call),
    // capped at 5 concurrent. Each result cached so this is one-time per type.
    await pool(missing, 5, async (e) => {
      try {
        const ins = await callClaude(apiKey, e);
        if (ins) cache.set(insightKey(e.country, e.title), ins);
      } catch (err) {
        console.error(`[event-insight] ${e.country} ${e.title}:`, err);
      }
    });
  }

  for (const k of uniq.keys()) { const v = cache.get(k); if (v) result[k] = v; }
  return result;
}

async function callClaude(
  apiKey: string,
  event: { country: string; title: string },
): Promise<EventInsight | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM,
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
  const obj = JSON.parse(text.slice(start, end + 1)) as { condition?: unknown; assets?: unknown; prints?: unknown };

  const dirs: AssetDir[] = ['up', 'down', 'flat'];
  const assets = Array.isArray(obj.assets) ? obj.assets : [];
  const printsRaw = Array.isArray(obj.prints) ? obj.prints : [];
  // Keep only prints the model confirmed with a source and a valid ISO date.
  // No source / malformed date → dropped (we'd rather show nothing than guess).
  const prints = printsRaw
    .map((p) => {
      const o = p as { date?: unknown; source?: unknown };
      return { date: String(o?.date ?? ''), source: String(o?.source ?? '').trim() };
    })
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.source.length > 0)
    .slice(0, 2)
    .map((p) => ({ date: p.date, pct: 0 })); // pct filled later from Gate candles
  return {
    condition: String(obj.condition ?? ''),
    assets: assets.slice(0, 3).map((a) => {
      const asset = a as { sym?: unknown; dir?: unknown };
      const dir = asset.dir as AssetDir;
      return { sym: String(asset.sym ?? ''), dir: dirs.includes(dir) ? dir : 'flat' };
    }),
    prints,
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
