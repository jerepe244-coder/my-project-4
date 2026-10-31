export type TraceabilityStatus =
  | 'CONFIRMED_REAL'
  | 'TEST_DATA'
  | 'UNKNOWN_TRACEABILITY'
  | 'CONTRADICTORY_TRACEABILITY';

export type ProspectStatus =
  | 'validated'
  | 'pending_review'
  | 'rejected'
  | 'imported';

export type PriorityClassification =
  | 'PRIORITY_HIGH'
  | 'PRIORITY_MEDIUM'
  | 'PRIORITY_LOW'
  | 'REVIEW_REQUIRED'
  | 'EXCLUDED_TEST_DATA';

export interface Prospect {
  id: string;
  lead_key: string;
  business_name: string;
  website_url: string;
  country?: string;
  industry?: string;
  status: ProspectStatus;
  source?: string;
  source_url?: string;
  evidence_notes?: string;
  is_test_data: boolean | null;
  is_synthetic_test: boolean;
  traceability_status: TraceabilityStatus;
  requires_review: boolean;
  created_at: string;
  updated_at?: string;
}

export interface IncompleteFieldIndicator {
  field: string;
  label: string;
  severity: 'warning' | 'error' | 'info';
}
