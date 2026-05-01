import "server-only";
import { EventEmitter } from "node:events";
import {
  IDLE_SNAPSHOT,
  type JobResult,
  type JobSnapshot,
  type LogEntry,
  type LogStatus,
} from "./job-types";

class JobConflictError extends Error {
  constructor() {
    super("A job is already running.");
    this.name = "JobConflictError";
  }
}

class JobStore {
  private snapshot: JobSnapshot = IDLE_SNAPSHOT;
  private controller: AbortController | null = null;
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  getSnapshot(): JobSnapshot {
    return this.snapshot;
  }

  /** Atomically claim the idle slot and start a new job. */
  start(): { jobId: string; signal: AbortSignal } {
    if (this.snapshot.status !== "idle") {
      throw new JobConflictError();
    }
    const jobId = crypto.randomUUID();
    const controller = new AbortController();
    this.controller = controller;
    this.snapshot = {
      status: "processing",
      jobId,
      startedAt: Date.now(),
      logs: [],
    };
    this.publish();
    return { jobId, signal: controller.signal };
  }

  appendLog(message: string): string {
    if (this.snapshot.status !== "processing") return "";
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      message,
      status: "loading",
      startedAt: Date.now(),
    };
    this.snapshot = {
      ...this.snapshot,
      logs: [...this.snapshot.logs, entry],
    };
    this.publish();
    return entry.id;
  }

  resolveLog(id: string, status: Exclude<LogStatus, "loading">, error?: string): void {
    if (this.snapshot.status !== "processing" || !id) return;
    const idx = this.snapshot.logs.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const next = [...this.snapshot.logs];
    next[idx] = { ...next[idx], status, endedAt: Date.now(), error };
    this.snapshot = { ...this.snapshot, logs: next };
    this.publish();
  }

  /** Finalise the running job with a result. No-ops unless we are still processing. */
  complete(jobId: string, result: JobResult): void {
    if (this.snapshot.status !== "processing" || this.snapshot.jobId !== jobId) {
      return;
    }
    this.snapshot = {
      status: "completed",
      jobId: this.snapshot.jobId,
      startedAt: this.snapshot.startedAt,
      endedAt: Date.now(),
      logs: this.snapshot.logs,
      result,
    };
    this.controller = null;
    this.publish();
  }

  /** Aborts in-flight work and returns to idle. Cancel and reset share this path. */
  reset(): void {
    this.controller?.abort();
    this.controller = null;
    this.snapshot = IDLE_SNAPSHOT;
    this.publish();
  }

  subscribe(listener: (s: JobSnapshot) => void): () => void {
    this.emitter.on("change", listener);
    return () => this.emitter.off("change", listener);
  }

  private publish(): void {
    this.emitter.emit("change", this.snapshot);
  }
}

const STORE_KEY = Symbol.for("demo.jobStore.v1");
type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: JobStore };
const g = globalThis as GlobalWithStore;
if (!g[STORE_KEY]) g[STORE_KEY] = new JobStore();

export const jobStore: JobStore = g[STORE_KEY]!;
export { JobConflictError };
