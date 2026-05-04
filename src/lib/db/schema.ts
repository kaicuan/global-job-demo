import {
  pgTable,
  text,
  timestamp,
  uuid,
  serial,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export type OperationStatus = 'idle' | 'running' | 'completed';
export type LogStatus = 'running' | 'completed' | 'fail';

export const SINGLETON_ID = 'singleton';

export const operations = pgTable(
  'operations',
  {
    id: text('id').primaryKey().default(SINGLETON_ID),
    status: text('status').$type<OperationStatus>().notNull().default('idle'),
    // `runId` changes every time the operation transitions out of idle.
    // Workers capture it on claim and re-check it before each step; if it
    // no longer matches, this run is no longer the canonical one and the
    // worker abandons quietly.
    runId: uuid('run_id'),
    resultUrl: text('result_url'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  () => [
    // Note: CHECK expressions cannot be parameterized; the literal must be
    // baked into the SQL text. Keep this in sync with `SINGLETON_ID`.
    check('operations_singleton', sql`id = 'singleton'`),
  ],
);

export const operationLogs = pgTable('operation_logs', {
  id: serial('id').primaryKey(),
  message: text('message').notNull(),
  status: text('status').$type<LogStatus>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export type Operation = typeof operations.$inferSelect;
export type OperationLog = typeof operationLogs.$inferSelect;
