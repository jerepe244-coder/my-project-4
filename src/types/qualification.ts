import { PriorityClassification, TraceabilityStatus } from './prospect';

export interface ScoreComponents {
  technical: number;
  evidence: number;
  services: number;
  completeness: number;
  technical_cap_applied?: boolean;
}

export interface AppliedCap {
  code: string;
  reason: string;
  max_classification: PriorityClassification;
  is_binding: boolean;
}

export interface ReviewReason {
  code: string;
  message: string;
  field?: string;
}

export interface VerifiedFinding {
  code: string;
  label: string;
  points: number;
  service_code?: string;
  evidence?: string;
}

export interface ServiceFit {
  service_code: string;
  service_name: string;
  confirmed: boolean;
  matched_findings: string[];
}

export interface CommercialSignals {
  has_budget_signal: boolean;
  has_intent_signal: boolean;
  has_urgency_signal: boolean;
  has_decision_maker_signal: boolean;
  technical_opportunity_only: boolean;
  disclaimer: string;
}

export interface LeadQualification {
  qualification_id: string;
  lead_key: string;
  prospect_row_ids?: string[] | string;
  business_name?: string;
  website_url?: string;
  evaluated_at: string;
  rules_version: string;
  rules_digest: string;
  evidence_fingerprint: string;
  run_mode: 'PRODUCTION' | 'SYNTHETIC_TEST';
  classification: PriorityClassification;
  priority_label: string;
  score: number | null;
  score_components?: ScoreComponents | string;
  caps_applied?: AppliedCap[] | string;
  traceability_status: TraceabilityStatus;
  is_test_data: boolean | null;
  requires_review: boolean;
  review_reasons?: ReviewReason[] | string;
  exclusion_reason?: string | null;
  verified_findings?: VerifiedFinding[] | string;
  hypotheses_assessment?: Record<string, unknown> | string;
  service_fit?: ServiceFit[] | string;
  warnings?: string[] | string;
  commercial_signals?: CommercialSignals | string;
  commercial_use_allowed: boolean;
  primary_audit_id?: string;
  source_audit_ids?: string[] | string;
  evidence_refs?: Record<string, unknown> | string;
  input_snapshot?: Record<string, unknown> | string;
  explanation?: string;
  supersedes_qualification_id?: string | null;
  previous_classification?: string | null;
  workflow_execution_id?: string;
  created_at: string;
}
