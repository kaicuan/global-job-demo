import type { Operation, OperationLog } from '@/lib/db/schema';

import { CompletedView } from './completed-view';
import { IdleView } from './idle-view';
import { RunningView } from './running-view';

type Props = {
  operation: Operation;
  initialLogs: OperationLog[];
};

/**
 * Pure status switch. Each view is self-contained: it owns its own
 * action, pending state, and (for running) the log poll + refresh trigger.
 * This component is server-renderable — it holds no client state itself.
 */
export function OperationPanel({ operation, initialLogs }: Props) {
  switch (operation.status) {
    case 'idle':
      return <IdleView />;
    case 'running':
      return <RunningView operation={operation} initialLogs={initialLogs} />;
    case 'completed':
      return <CompletedView operation={operation} />;
  }
}
