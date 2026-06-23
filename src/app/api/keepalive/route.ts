import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { captureDailyHeatmapMetrics } from '@/lib/heatmap-capture';

// Daily keepalive (Vercel cron, see vercel.json) — one trivial read to reset the
// free Supabase project's inactivity timer, which otherwise PAUSES the project
// after ~7 days idle and breaks all persistence. A read is enough; no writes.
//
// It ALSO captures the day's liquidation-heatmap metrics (TLL/LCG) so the heatmap
// strip's trend fills in even on days the owner doesn't open the page. Folded in
// here (not a 2nd cron) because Vercel Hobby allows only ONE cron. The capture is
// best-effort and runs AFTER the ping, so an Apify failure never breaks keepalive.
//
// This is a PUBLIC path (the cron runs with no user session — see proxy.ts), so
// it's optionally guarded by CRON_SECRET: when that env var is set, Vercel sends
// `Authorization: Bearer <CRON_SECRET>` on the cron call and we require it. With
// no secret set it still works (the query is a harmless count).

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // the heatmap capture runs the Apify Actor (slow-ish)

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ ok: true, supabase: false });
  // HEAD count = the lightest possible touch that still hits Postgres.
  const { error } = await sb.from('released_archive').select('occ_key', { head: true, count: 'exact' });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  // Best-effort daily heatmap-metric capture (never let it break the keepalive).
  const heatmap = await captureDailyHeatmapMetrics().catch((e) => ({ ok: false, reason: String(e) }));
  return NextResponse.json({ ok: true, pinged: new Date().toISOString(), heatmap });
}
