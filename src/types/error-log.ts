export type WorkflowOrigin = 'WF-01' | 'WF-02' | 'WF-03' | 'SYSTEM' | 'API';

export interface ErrorLogRecord {
  id: string;
  timestamp: string;
  workflow: WorkflowOrigin;
  lead_key?: string;
  record_id?: string;
  error_type: string;
  error_message: string;
  status: 'logged' | 'pending_investigation' | 'resolved' | 'acknowledged';
  raw_payload?: Record<string, unknown> | string;
  stack_trace?: string;
}
