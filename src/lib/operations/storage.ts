import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LOCAL_RESULT_PATH_PREFIX = '/api/operations/result/';

/**
 * Result handle. The URL is what the client fetches from; on Vercel it's a
 * CDN-served blob URL, locally it's an internal route that streams from disk.
 */
export type StoredResult = {
  url: string;
  byteLength: number;
};

/**
 * Persists the aggregated result.
 *
 * Routing rule:
 *   - `BLOB_READ_WRITE_TOKEN` set  → Vercel Blob (production / preview)
 *   - otherwise                    → temp filesystem (local dev)
 *
 * Each write uses a fresh opaque id, so old completions never collide with
 * new ones at the CDN layer. The two backends are interchangeable from the
 * caller's perspective; the filesystem backend exists so the demo runs
 * without a Vercel account.
 */
export async function writeResult(payload: unknown): Promise<StoredResult> {
  const id = randomUUID();
  const json = JSON.stringify(payload);
  const bytes = Buffer.byteLength(json);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const { url } = await put(`operations/${id}.json`, json, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
    return { url, byteLength: bytes };
  }

  const dir = localResultDir();
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${id}.json`), json, 'utf8');
  return { url: `${LOCAL_RESULT_PATH_PREFIX}${id}`, byteLength: bytes };
}

/** Reads a locally-stored result. Used by the result route handler. */
export async function readLocalResult(id: string): Promise<string> {
  return readFile(join(localResultDir(), `${id}.json`), 'utf8');
}

/**
 * Deletes a result by URL. Idempotent — missing files / blobs are not an
 * error. Dispatches between the Vercel Blob and FS backends based on URL
 * shape (absolute http URL → blob, relative path → local file).
 */
export async function deleteResult(url: string): Promise<void> {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const { del } = await import('@vercel/blob');
    await del(url);
    return;
  }
  if (url.startsWith(LOCAL_RESULT_PATH_PREFIX)) {
    const id = url.slice(LOCAL_RESULT_PATH_PREFIX.length);
    try {
      await unlink(join(localResultDir(), `${id}.json`));
    } catch (err) {
      // Already gone — fine.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
}

function localResultDir(): string {
  return join(tmpdir(), 'demo-operations');
}
