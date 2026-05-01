import { JobController } from "./_components/JobController";
import { jobStore } from "./_lib/job-store";

/**
 * Force per-request rendering so the initial snapshot reflects the live
 * global state (the store is in-memory, so caching the page would freeze
 * it at "idle" forever). After this server pass, the SSE stream takes
 * over for live updates.
 */
export const dynamic = "force-dynamic";

export default function Home() {
  const initialSnapshot = jobStore.getSnapshot();
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <JobController initialSnapshot={initialSnapshot} />
    </div>
  );
}
