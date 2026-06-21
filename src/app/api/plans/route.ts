import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth-guard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Plan } from '@/lib/plan-model';

// Plans board persistence. When Supabase isn't configured the route reports
// { configured: false } so the client falls back to localStorage (local dev).
// All writes are full-object upserts (save / move / edit / duplicate all POST
// the whole Plan); DELETE removes by id.

export async function GET() {
  const denied = await requireOwner();
  if (denied) return denied;
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false }, { status: 501 });
  const { data, error } = await sb.from('plans').select('data').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, plans: (data || []).map((r) => r.data as Plan) });
}

export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false }, { status: 501 });
  const plan = (await req.json()) as Plan;
  if (!plan?.id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  const created = plan.createdAt ? new Date(plan.createdAt).toISOString() : new Date().toISOString();
  const { error } = await sb.from('plans').upsert({ id: plan.id, data: plan, created_at: created, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false }, { status: 501 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  const { error } = await sb.from('plans').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
