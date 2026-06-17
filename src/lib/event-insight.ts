import type { EventInsight, AssetDir } from '@/hooks/useCalendar';

// Server-only: enriches economic-calendar events with a short "market reaction"
// line via the Claude Messages API. Interpretations depend only on the event
// TYPE (currency + title), so they're cached in-process and reused across weeks.
// Requires ANTHROPIC_API_KEY in the environment — without it, enrichment is
// skipped and events simply carry no insight.

const MODEL = 'claude-haiku-4-5-20251001';
const cache = new Map<string, EventInsight>();

export const insightKey = (country: string, title: string) => `${country}|${title}`;

const SYSTEM = `You annotate macro economic-calendar events for a crypto trader who trades BTC/USDT perpetual futures. For each event, describe how markets typically react to the outcome that is BULLISH for that event's own currency (a hawkish central bank, a hot inflation print, a strong beat, more hawkish dots, etc.).

Reply with ONLY a JSON array — no prose, no code fences. One object per input event, in the same order:
{"condition":"<=2 words for the bullish-for-the-currency scenario, e.g. Hawkish, Hot CPI, Beat, Fewer claims, Higher dots","assets":[{"sym":"<short symbol e.g. BTC, USD, stocks, gold>","dir":"up|down|flat"}]}

Rules:
- 2 to 3 assets per event.
- ALWAYS include BTC and give its likely direction under that scenario.
- Keep symbols <=6 chars; use the event currency code where relevant.
- "dir" is the move under the stated condition.`;

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
    try {
      const insights = await callClaude(apiKey, missing);
      missing.forEach((e, i) => { if (insights[i]) cache.set(insightKey(e.country, e.title), insights[i]); });
    } catch (err) {
      console.error('[event-insight] enrichment failed:', err);
    }
  }

  for (const k of uniq.keys()) { const v = cache.get(k); if (v) result[k] = v; }
  return result;
}

async function callClaude(
  apiKey: string,
  events: { country: string; title: string }[],
): Promise<EventInsight[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: JSON.stringify(events.map((e) => ({ currency: e.country, event: e.title }))),
      }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text: string = (data.content || [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');

  const start = text.indexOf('['), end = text.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('no JSON array in model reply');
  const arr = JSON.parse(text.slice(start, end + 1)) as unknown[];

  const dirs: AssetDir[] = ['up', 'down', 'flat'];
  return arr.map((o) => {
    const obj = o as { condition?: unknown; assets?: unknown };
    const assets = Array.isArray(obj.assets) ? obj.assets : [];
    return {
      condition: String(obj.condition ?? ''),
      assets: assets.slice(0, 3).map((a) => {
        const asset = a as { sym?: unknown; dir?: unknown };
        const dir = asset.dir as AssetDir;
        return { sym: String(asset.sym ?? ''), dir: dirs.includes(dir) ? dir : 'flat' };
      }),
    };
  });
}
