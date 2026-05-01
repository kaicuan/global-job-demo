export type JobStatus = "idle" | "processing" | "completed";

export type LogStatus = "loading" | "success" | "failure";

export interface LogEntry {
  id: string;
  message: string;
  status: LogStatus;
  startedAt: number;
  endedAt?: number;
  error?: string;
}

export interface ModuleSummary {
  key: string;
  label: string;
  value: number;
}

export interface JobResult {
  total: number;
  modules: ModuleSummary[];
}

export type JobSnapshot =
  | { status: "idle"; logs: []; jobId?: undefined; result?: undefined }
  | {
      status: "processing";
      jobId: string;
      startedAt: number;
      logs: LogEntry[];
      result?: undefined;
    }
  | {
      status: "completed";
      jobId: string;
      startedAt: number;
      endedAt: number;
      logs: LogEntry[];
      result: JobResult;
    };

export const IDLE_SNAPSHOT: JobSnapshot = { status: "idle", logs: [] };
