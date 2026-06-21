import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth-guard';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Journal review records (grade + note per trade), keyed by trade_key = tradePid.
// A thin overlay on the live Gate trades — the trades themselves are never stored.
// GET returns the { trade_key → {grade, note, reviewed} } map; POST upserts one.

export async function GET() {
  const denied = await requireOwner();
  if (denied) return denied;
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false }, { status: 501 });
  const { data, error } = await sb.from('journal_entries').select('trade_key, grade, note, reviewed');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const map: Record<string, { grade?: string; note?: string; reviewed?: boolean }> = {};
  for (const r of data || []) map[r.trade_key as string] = { grade: r.grade ?? undefined, note: r.note ?? undefined, reviewed: r.reviewed ?? undefined };
  return NextResponse.json({ configured: true, journal: map });
}

export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false }, { status: 501 });
  const { tradeKey, grade, note, reviewed } = (await req.json()) as { tradeKey?: string; grade?: string; note?: string; reviewed?: boolean };
  if (!tradeKey) return NextResponse.json({ error: 'missing tradeKey' }, { status: 400 });
  const { error } = await sb.from('journal_entries').upsert({
    trade_key: tradeKey, grade: grade ?? null, note: note ?? null, reviewed: reviewed ?? true, updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
