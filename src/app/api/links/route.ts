import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth-guard';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Trade ⇄ plan links, keyed by tradePid ('BTC/USDT.P#<time>' or a market pid).
// GET returns the { pid → planId } map; POST upserts one; DELETE removes one.

export async function GET() {
  const denied = await requireOwner();
  if (denied) return denied;
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false }, { status: 501 });
  const { data, error } = await sb.from('links').select('pid, plan_id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const map: Record<string, string> = {};
  for (const r of data || []) map[r.pid as string] = r.plan_id as string;
  return NextResponse.json({ configured: true, links: map });
}

export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false }, { status: 501 });
  const { pid, planId } = (await req.json()) as { pid?: string; planId?: string };
  if (!pid || !planId) return NextResponse.json({ error: 'missing pid/planId' }, { status: 400 });
  const { error } = await sb.from('links').upsert({ pid, plan_id: planId, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false }, { status: 501 });
  const pid = new URL(req.url).searchParams.get('pid');
  if (!pid) return NextResponse.json({ error: 'missing pid' }, { status: 400 });
  const { error } = await sb.from('links').delete().eq('pid', pid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
