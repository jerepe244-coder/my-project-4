import { TraceabilityStatus } from './prospect';

export type FindingSeverity = 'confirmed_problem' | 'warning' | 'unverified' | 'missing_data' | 'audit_error';

export interface CommercialHypothesis {
  category?: string;
  opportunity?: string;
  evidence?: string;
  type?: string;
  detail?: string;
}

export interface RawEvidence {
  analysis_verifiable?: boolean;
  feature_status?: {
    viewport?: 'FOUND' | 'MISSING' | 'NOT_VERIFIED';
    meta_description?: 'FOUND' | 'MISSING' | 'NOT_VERIFIED';
    page_title?: 'FOUND' | 'MISSING' | 'NOT_VERIFIED';
    ssl?: 'ACTIVE' | 'INACTIVE';
  };
  headers?: Record<string, string>;
  traceability?: {
    is_test_data?: boolean | null;
    is_synthetic_test?: boolean;
    traceability_status?: TraceabilityStatus;
  };
  error_details?: string;
  response_time_ms?: number;
  http_status?: number;
  final_url?: string;
  redirect_count?: number;
}

export interface WebsiteAudit {
  id: string;
  audit_id: string;
  prospect_id: string;
  lead_key: string;
  audit_date: string;
  initial_url: string;
  final_url?: string;
  http_status?: number;
  redirect_count: number;
  response_time_ms?: number;
  page_title?: string;
  meta_description?: string;
  has_viewport: boolean;
  ssl_active: boolean;
  is_accessible: boolean;
  error_code?: string;
  commercial_hypotheses: CommercialHypothesis[] | string;
  raw_evidence: RawEvidence | string;
  is_synthetic_test: boolean;
  is_test_data: boolean | null;
  traceability_status: TraceabilityStatus;
  requires_review: boolean;
  created_at: string;
}

export interface CategorizedFinding {
  code: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  evidence?: string;
  serviceCode?: string;
}
