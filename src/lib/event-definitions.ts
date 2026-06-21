import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Plain-language definitions of economic-calendar releases, shown on hover over
// an event name. Curated seed below (no API needed); anything not in the seed
// or the on-disk cache is fetched once from Claude and then persisted, so we
// never call the API for a title we've already defined.

const MODEL = 'claude-haiku-4-5-20251001';
const norm = (t: string) => t.trim();

// Curated definitions for the common releases (keyed by exact feed title).
export const SEED_DEFS: Record<string, string> = {
  'Federal Funds Rate': "The Fed's benchmark interest-rate decision. Hikes tighten dollar liquidity and usually weigh on risk assets like BTC; cuts do the opposite.",
  'FOMC Statement': "The Fed's official policy statement released with the rate decision — its wording on inflation and the path of rates drives markets, BTC included.",
  'FOMC Economic Projections': "The Fed's quarterly 'dot plot' of where officials see rates, growth and inflation heading. More hawkish dots pressure risk assets.",
  'FOMC Press Conference': "The Fed Chair's Q&A after the decision. The tone (hawkish vs dovish) often moves markets more than the statement itself.",
  'FOMC Meeting Minutes': 'Detailed record of the last Fed meeting, released ~3 weeks later. Can reveal how hawkish or split officials really were.',
  'CPI m/m': 'Consumer Price Index — the main inflation gauge. A hotter-than-expected print raises rate-hike odds and typically hurts BTC and stocks.',
  'CPI y/y': 'Consumer Price Index vs a year ago — the headline inflation rate. Hot inflation supports higher-for-longer rates, pressuring risk assets.',
  'Core CPI m/m': "CPI excluding food and energy — a cleaner read on underlying inflation that the Fed watches closely.",
  'Core PCE Price Index m/m': "The Fed's preferred inflation measure. A hot print backs higher rates and tends to weigh on risk assets.",
  'Non-Farm Employment Change': 'US jobs added last month (excluding farms) — the headline labor report. Big surprises swing rate expectations and whip markets.',
  'Average Hourly Earnings m/m': 'Wage growth, a key driver of inflation. Hotter earnings raise rate-hike odds.',
  'Unemployment Rate': 'Share of the labor force without work — a core labor-market gauge feeding Fed policy.',
  'Unemployment Claims': 'Weekly count of new jobless claims — a timely pulse on the labor market. Rising claims hint at a cooling economy.',
  'Retail Sales m/m': 'Month-over-month change in retail spending — a read on consumer demand and growth.',
  'Core Retail Sales m/m': 'Retail sales excluding autos — a steadier gauge of underlying consumer spending.',
  'PPI m/m': 'Producer Price Index — wholesale inflation, often a leading signal for consumer inflation.',
  'ISM Manufacturing PMI': 'Survey of factory activity; above 50 signals expansion, below 50 contraction. A broad growth indicator.',
  'ISM Services PMI': 'Survey of services-sector activity; above 50 = expansion. Services dominate the US economy.',
  'GDP q/q': 'Quarterly change in total economic output — the broadest measure of growth.',
  'Claimant Count Change': 'Change in the number of UK people claiming unemployment benefits — a monthly labor-market gauge for the pound.',
  'Average Earnings Index 3m/y': 'UK wage growth over three months vs a year ago — a wage-inflation read the BoE watches.',
  'Monetary Policy Summary': "The Bank of England's statement explaining its rate decision and economic outlook.",
  'Official Bank Rate': "The Bank of England's benchmark interest-rate decision.",
  'MPC Official Bank Rate Votes': "How the BoE's rate-setting committee voted — a more hawkish or dovish split signals the future path.",
  'Monetary Policy Statement': "A central bank's official statement on its rate decision and policy outlook.",
  'SNB Policy Rate': "The Swiss National Bank's benchmark interest-rate decision.",
  'SNB Monetary Policy Assessment': "The Swiss National Bank's quarterly policy decision and economic assessment.",
  'SNB Press Conference': "The SNB's briefing after its policy decision, where officials explain their stance.",
  'Cash Rate': "The Reserve Bank of Australia's benchmark interest-rate decision.",
  'RBA Rate Statement': "The RBA's statement explaining its rate decision and outlook.",
  'RBA Press Conference': "The RBA Governor's briefing after the rate decision.",
  'BOJ Policy Rate': "The Bank of Japan's benchmark rate decision. BoJ shifts can trigger yen carry-trade unwinds that ripple into BTC.",
  'BOJ Press Conference': "The Bank of Japan Governor's briefing after the policy decision.",
  'Main Refinancing Rate': "The ECB's benchmark interest-rate decision for the euro area.",
  'ECB Press Conference': "The ECB President's briefing after the decision — the tone often moves the euro and risk assets.",
};

const defCache = new Map<string, string>();
const CACHE_FILE = join(process.cwd(), '.cache', 'event-defs.json');
let loaded = false;

async function load() {
  if (loaded) return;
  loaded = true;
  for (const [k, v] of Object.entries(SEED_DEFS)) defCache.set(k, v);
  const sb = supabaseAdmin();
  if (sb) {
    try {
      const { data } = await sb.from('event_defs').select('title, definition');
      for (const r of data || []) defCache.set(r.title as string, String(r.definition));
    } catch { /* unreachable → seed only, misses re-fetch */ }
    return;
  }
  try {
    const raw = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as Record<string, string>;
    for (const [k, v] of Object.entries(raw)) defCache.set(k, String(v));
  } catch { /* no fetched-defs file yet */ }
}

// Persist only the fetched ones (seed lives in code).
async function save() {
  const fetched = [...defCache].filter(([k]) => !(k in SEED_DEFS));
  const sb = supabaseAdmin();
  if (sb) {
    try {
      const now = new Date().toISOString();
      const rows = fetched.map(([title, definition]) => ({ title, definition, updated_at: now }));
      if (rows.length) await sb.from('event_defs').upsert(rows);
    } catch { /* best-effort */ }
    return;
  }
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(fetched), null, 2));
  } catch { /* read-only FS — stays in-memory */ }
}

export async function getDefinitions(titles: string[]): Promise<Record<string, string>> {
  await load();
  const want = [...new Set(titles.map(norm))];
  const missing = want.filter((t) => !defCache.has(t));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && missing.length) {
    try {
      const defs = await fetchDefs(apiKey, missing);
      missing.forEach((t, i) => { if (defs[i]) defCache.set(t, defs[i]); });
      await save();
    } catch (err) {
      console.error('[event-defs] fetch failed:', err);
    }
  }

  const out: Record<string, string> = {};
  for (const t of want) { const v = defCache.get(t); if (v) out[t] = v; }
  return out;
}

async function fetchDefs(apiKey: string, titles: string[]): Promise<string[]> {
  const SYSTEM = `You write one-sentence definitions of economic-calendar releases for a crypto (BTC) trader: what the release measures or what happens, and briefly why it can move markets. Max ~160 characters each, plain language, no fluff.

Reply with ONLY a JSON array of strings — one per input event, in the same order. No prose, no code fences.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0,
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(titles) }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text: string = (data.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
  const s = text.indexOf('['), en = text.lastIndexOf(']');
  if (s === -1 || en === -1) throw new Error('no JSON array in model reply');
  const arr = JSON.parse(text.slice(s, en + 1)) as unknown[];
  return arr.map((x) => String(x ?? ''));
}
