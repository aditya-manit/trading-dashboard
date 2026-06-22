import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth-guard';
import { clearPrints } from '@/lib/event-insight';

// Force a re-pull of one event's "2 prints": clears the frozen set so the next
// /api/calendar/insights call web-searches + re-freezes it. Owner-gated (the
// re-search costs a Claude web search). The client revalidates insights after.
export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  const { country, title } = (await req.json().catch(() => ({}))) as { country?: string; title?: string };
  if (!country || !title) return NextResponse.json({ error: 'missing country/title' }, { status: 400 });
  await clearPrints(country, title);
  return NextResponse.json({ ok: true });
}
