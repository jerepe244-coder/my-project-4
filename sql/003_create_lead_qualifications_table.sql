-- ==============================================================================
-- ZYRVAE WF-03: Tabla de Calificaciones y Priorización de Prospectos (lead_qualifications)
-- Propósito: Almacenar evaluaciones comerciales deterministas, explicables y
-- auditables, derivadas de evidencias técnicas de WF-02 y prospectos de WF-01.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS lead_qualifications (
    qualification_id VARCHAR(100) PRIMARY KEY,
    lead_key VARCHAR(255) NOT NULL,
    prospect_row_ids JSONB,
    business_name TEXT,
    website_url TEXT,
    evaluated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    rules_version VARCHAR(20) NOT NULL,
    rules_digest VARCHAR(64) NOT NULL,
    evidence_fingerprint VARCHAR(64) NOT NULL,
    run_mode VARCHAR(20) NOT NULL,
    classification VARCHAR(50) NOT NULL,
    priority_label VARCHAR(50) NOT NULL,
    score INTEGER,
    score_components JSONB,
    caps_applied JSONB,
    traceability_status VARCHAR(50) NOT NULL,
    is_test_data BOOLEAN, -- NULL: desconocido (revisión), TRUE: prueba, FALSE: confirmado real
    requires_review BOOLEAN NOT NULL DEFAULT FALSE,
    review_reasons JSONB,
    exclusion_reason TEXT,
    verified_findings JSONB,
    hypotheses_assessment JSONB,
    service_fit JSONB,
    warnings JSONB,
    commercial_signals JSONB,
    commercial_use_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    primary_audit_id VARCHAR(100),
    source_audit_ids JSONB,
    evidence_refs JSONB,
    input_snapshot JSONB,
    explanation TEXT,
    supersedes_qualification_id VARCHAR(100),
    previous_classification VARCHAR(50),
    workflow_execution_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lead_qualifications_prospect
        FOREIGN KEY (lead_key)
        REFERENCES prospects(lead_key)
        ON DELETE CASCADE
);

-- Índices para optimizar consultas de priorización, prospección comercial y auditoría
CREATE INDEX IF NOT EXISTS idx_lead_qualifications_lead_key ON lead_qualifications(lead_key);
CREATE INDEX IF NOT EXISTS idx_lead_qualifications_classification ON lead_qualifications(classification);
CREATE INDEX IF NOT EXISTS idx_lead_qualifications_score ON lead_qualifications(score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_lead_qualifications_traceability ON lead_qualifications(traceability_status);
CREATE INDEX IF NOT EXISTS idx_lead_qualifications_review ON lead_qualifications(requires_review);
CREATE INDEX IF NOT EXISTS idx_lead_qualifications_evaluated_at ON lead_qualifications(evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_qualifications_commercial_use ON lead_qualifications(commercial_use_allowed);
CREATE INDEX IF NOT EXISTS idx_lead_qualifications_audit_id ON lead_qualifications(primary_audit_id);
CREATE INDEX IF NOT EXISTS idx_lead_qualifications_rules_version ON lead_qualifications(rules_version);
CREATE INDEX IF NOT EXISTS idx_lead_qualifications_supersedes ON lead_qualifications(supersedes_qualification_id);

COMMENT ON TABLE lead_qualifications IS 'Calificaciones comerciales explicables y priorización de prospectos con trazabilidad completa (WF-03)';
COMMENT ON COLUMN lead_qualifications.qualification_id IS 'Identificador determinista de la evaluación (lq_<fingerprint> o SYNTH-LQ-<fingerprint>-TESTONLY)';
COMMENT ON COLUMN lead_qualifications.lead_key IS 'Identificador canónico del prospecto en prospects(lead_key)';
COMMENT ON COLUMN lead_qualifications.evidence_fingerprint IS 'Hash FNV-1a canónico de los datos de entrada, reglas y resultado de evaluación';
COMMENT ON COLUMN lead_qualifications.score IS 'Puntuación comercial normalizada (0-100). NULL si la evaluación requiere revisión o fue excluida';
COMMENT ON COLUMN lead_qualifications.classification IS 'Nivel asignado: PRIORITY_HIGH, PRIORITY_MEDIUM, PRIORITY_LOW, REVIEW_REQUIRED, EXCLUDED_TEST_DATA';
COMMENT ON COLUMN lead_qualifications.traceability_status IS 'Estado estricto de trazabilidad: CONFIRMED_REAL, TEST_DATA, UNKNOWN_TRACEABILITY, CONTRADICTORY_TRACEABILITY';
COMMENT ON COLUMN lead_qualifications.commercial_use_allowed IS 'Flag estricto: TRUE solo si classification es comercial válida, trazabilidad es CONFIRMED_REAL y no es ejecución sintética';
COMMENT ON COLUMN lead_qualifications.supersedes_qualification_id IS 'Referencia a la calificación anterior del mismo prospecto cuando la evidencia o reglas cambiaron (idempotencia no destructiva)';
