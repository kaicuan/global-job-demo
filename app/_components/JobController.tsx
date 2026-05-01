"use client";

import { useEffect, useState, useTransition } from "react";
import { cancelJob, resetJob, startJob } from "@/app/_lib/actions";
import type { JobSnapshot } from "@/app/_lib/job-types";
import { CompletedView, IdleView, ProcessingView } from "./views";

interface Props {
  initialSnapshot: JobSnapshot;
}

/**
 * Single client component that owns:
 *  • the live `JobSnapshot` (seeded from the server, kept in sync via SSE)
 *  • the three server-action dispatchers
 *
 * The view is a pure switch on `snapshot.status`. Because the server
 * already rendered with `initialSnapshot`, the first paint matches the
 * current global state — refreshes during processing show the live view
 * immediately, before the SSE handshake completes.
 */
export function JobController({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState<JobSnapshot>(initialSnapshot);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const source = new EventSource("/api/jobs/stream");
    source.onmessage = (event) => {
      try {
        setSnapshot(JSON.parse(event.data) as JobSnapshot);
      } catch {
        // Malformed payload — ignore; next snapshot will overwrite anyway.
      }
    };
    return () => source.close();
  }, []);

  const dispatch = (action: () => Promise<unknown>) => () => {
    startTransition(async () => {
      await action();
    });
  };

  switch (snapshot.status) {
    case "idle":
      return <IdleView onStart={dispatch(startJob)} pending={pending} />;
    case "processing":
      return (
        <ProcessingView
          snapshot={snapshot}
          onCancel={dispatch(cancelJob)}
          pending={pending}
        />
      );
    case "completed":
      return (
        <CompletedView
          snapshot={snapshot}
          onReset={dispatch(resetJob)}
          pending={pending}
        />
      );
  }
}
