-- ==============================================================================
-- ZYRVAE WF-02: Tabla de Auditorías Web de Prospectos (website_audits)
-- Propósito: Almacenar evidencias técnicas objetivas, historial de auditorías
-- y oportunidades comerciales identificadas, vinculadas a la tabla existente prospects.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS website_audits (
    id VARCHAR(36) PRIMARY KEY,
    prospect_id VARCHAR(36) NOT NULL,
    audit_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    initial_url TEXT NOT NULL,
    final_url TEXT,
    http_status INTEGER,
    redirect_count INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    page_title TEXT,
    meta_description TEXT,
    has_viewport BOOLEAN DEFAULT FALSE,
    ssl_active BOOLEAN DEFAULT FALSE,
    is_accessible BOOLEAN DEFAULT FALSE,
    error_code VARCHAR(100),
    raw_evidence JSONB,
    commercial_hypotheses JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_website_audits_prospect
        FOREIGN KEY (prospect_id)
        REFERENCES prospects(id)
        ON DELETE CASCADE
);

-- Índices para optimizar consultas de auditoría y relaciones
CREATE INDEX IF NOT EXISTS idx_website_audits_prospect_id ON website_audits(prospect_id);
CREATE INDEX IF NOT EXISTS idx_website_audits_date ON website_audits(audit_date DESC);
CREATE INDEX IF NOT EXISTS idx_website_audits_accessible ON website_audits(is_accessible);

COMMENT ON TABLE website_audits IS 'Registros de auditorías técnicas de sitios web de prospectos';
COMMENT ON COLUMN website_audits.prospect_id IS 'Referencia foránea a la tabla prospects(id)';
COMMENT ON COLUMN website_audits.raw_evidence IS 'Evidencia técnica objetiva (headers, status, tiempos)';
COMMENT ON COLUMN website_audits.commercial_hypotheses IS 'Hipótesis comerciales derivadas de la evidencia técnica';
