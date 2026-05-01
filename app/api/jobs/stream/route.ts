import { jobStore } from "@/app/_lib/job-store";
import type { JobSnapshot } from "@/app/_lib/job-types";

export const dynamic = "force-dynamic";

/**
 * SSE channel for the global job state.
 *
 * The store is a singleton — only one job ever exists at a time — so this
 * route is unparameterized: it streams whatever the store currently holds.
 * Clients receive the live snapshot on every store change (idle →
 * processing → completed → idle). A 15s keepalive comment keeps proxies
 * from dropping the connection during long idle stretches.
 */
export async function GET(req: Request): Promise<Response> {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (snapshot: JobSnapshot) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`),
          );
        } catch {
          // Controller already closed; the cancel handler will clean up.
        }
      };

      send(jobStore.getSnapshot());
      unsubscribe = jobStore.subscribe(send);

      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          // ignored — connection is closing
        }
      }, 15_000);

      const onAbort = () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", onAbort, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    unsubscribe?.();
    unsubscribe = null;
    if (keepalive) clearInterval(keepalive);
    keepalive = null;
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable buffering on intermediaries (e.g. Nginx) so events arrive
      // immediately rather than batched.
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
