import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth-guard';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Daily snapshot of the derived heatmap metrics (TLL + center of gravity), so the
// strip can show a day-over-day trend instead of a context-free number. One row
// per day+symbol+interval (last-write-wins within a day). Owner-gated; no extra
// Apify run — the client posts metrics it already computed from the payload.
//   GET  ?symbol=&interval=  → { configured, history: [{day, price, tll, lcg, lcg_gap}] } (≤60d, asc)
//   POST { symbol, interval, price, tll, lcg, lcgGap } → upsert today's row

const DAYS = 60;

export async function GET(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false, history: [] }, { status: 501 });
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || 'BTC').toUpperCase();
  const interval = searchParams.get('interval') || '24h';
  const { data, error } = await sb
    .from('heatmap_metrics_daily')
    .select('day, price, tll, lcg, lcg_gap')
    .eq('symbol', symbol).eq('interval', interval)
    .order('day', { ascending: false })
    .limit(DAYS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const history = (data || []).map((r) => ({
    day: r.day as string, price: Number(r.price), tll: Number(r.tll), lcg: Number(r.lcg), lcg_gap: Number(r.lcg_gap),
  })).reverse(); // oldest → newest for sparklines
  return NextResponse.json({ configured: true, history });
}

export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false }, { status: 501 });
  const body = (await req.json().catch(() => ({}))) as {
    symbol?: string; interval?: string; price?: number; tll?: number; lcg?: number; lcgGap?: number;
  };
  if (!body.symbol || !body.interval || !Number.isFinite(body.tll)) {
    return NextResponse.json({ error: 'missing symbol/interval/tll' }, { status: 400 });
  }
  const day = new Date().toISOString().slice(0, 10); // UTC date
  const { error } = await sb.from('heatmap_metrics_daily').upsert({
    day, symbol: body.symbol.toUpperCase(), interval: body.interval,
    price: body.price ?? null, tll: body.tll ?? null, lcg: body.lcg ?? null, lcg_gap: body.lcgGap ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
