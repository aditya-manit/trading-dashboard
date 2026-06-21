import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth-guard';
import { supabaseAdmin, CHARTS_BUCKET } from '@/lib/supabase/admin';

// Upload a trade chart image to Supabase Storage, return its public URL.
// Body: { dataUrl: "data:image/...;base64,...", planId?: string }. The client
// sends the base64 it already read from the file; we decode + upload server-side
// (service-role key) and hand back the URL to store on the plan row.

const MIME_EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
};

export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false }, { status: 501 });

  const { dataUrl, planId } = (await req.json()) as { dataUrl?: string; planId?: string };
  const m = dataUrl?.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return NextResponse.json({ error: 'expected a base64 data URL' }, { status: 400 });
  const mime = m[1];
  const ext = MIME_EXT[mime] || 'png';
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > 8 * 1024 * 1024) return NextResponse.json({ error: 'image too large (>8MB)' }, { status: 413 });

  const path = `${planId ? planId + '/' : ''}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(CHARTS_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = sb.storage.from(CHARTS_BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
