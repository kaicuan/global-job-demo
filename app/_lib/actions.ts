"use server";

import { after } from "next/server";
import { jobStore, JobConflictError } from "./job-store";
import { runJob } from "./orchestrator";

/**
 * Starts the global background job. If another caller has already won the
 * race, return that job's id rather than failing — every observer is
 * looking at the same global state anyway, so reporting "already running"
 * to the late caller would just be noise.
 */
export async function startJob(): Promise<{ jobId: string }> {
  try {
    const { jobId, signal } = jobStore.start();
    // Detach from the request lifecycle. Server actions do not need to
    // await the background work; the SSE channel reports progress.
    after(() => runJob(jobId, signal));
    return { jobId };
  } catch (err) {
    if (err instanceof JobConflictError) {
      const snap = jobStore.getSnapshot();
      if (snap.status !== "idle") return { jobId: snap.jobId };
    }
    throw err;
  }
}

export async function cancelJob(): Promise<void> {
  if (jobStore.getSnapshot().status !== "processing") return;
  jobStore.reset();
}

export async function resetJob(): Promise<void> {
  if (jobStore.getSnapshot().status !== "completed") return;
  jobStore.reset();
}
