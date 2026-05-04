import type { NextRequest } from 'next/server';

import { readLocalResult } from '@/lib/operations/storage';

/**
 * Serves a result that was written to the filesystem fallback (i.e. when
 * `BLOB_READ_WRITE_TOKEN` is not set, typically local dev). In production
 * the operation's `resultUrl` points directly at the Vercel Blob CDN URL,
 * so this handler is only hit in dev.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const json = await readLocalResult(id);
    return new Response(json, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}
