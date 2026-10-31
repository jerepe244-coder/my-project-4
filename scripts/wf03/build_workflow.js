// =============================================================================
// ZYRVAE WF-03 — Build Workflow Script
// Genera el archivo JSON del workflow n8n ZYRVAE WF-03 embebiendo
// el motor de calificación puro scripts/wf03/qualification_engine.js.
// =============================================================================

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const ENGINE_PATH = path.join(__dirname, 'qualification_engine.js');
const OUTPUT_PATH = path.join(ROOT_DIR, 'workflows/ZYRVAE_WF-03_Lead_Qualification_Prioritization.json');

const engineCode = fs.readFileSync(ENGINE_PATH, 'utf8');

// Código JS para el nodo Qualify Leads (Rules Engine)
const engineNodeJsCode = `
// =============================================================================
// ZYRVAE WF-03 — Qualify Leads (Rules Engine Node)
// AUTO-GENERATED EMBED FROM scripts/wf03/qualification_engine.js
// DO NOT EDIT DIRECTLY. Edit qualification_engine.js and re-run build_workflow.js
// =============================================================================

${engineCode}

// Node execution logic
const inputItems = $input.all();
if (!inputItems || inputItems.length === 0) {
  return [{ json: { error: 'No input items received', items_count: 0 } }];
}

const firstJson = inputItems[0].json || {};
const context = firstJson.context || {
  evaluated_at: new Date().toISOString(),
  run_mode: firstJson.run_mode || 'SYNTHETIC_TEST',
  persist_excluded_test_data: false,
  execution_id: $execution ? $execution.id : 'manual'
};

const prospects = firstJson.prospects || [];
const audits = firstJson.audits || [];
const existingQualifications = firstJson.existing_qualifications || [];
const rulesOverrides = firstJson.rules_overrides || {};

const batchResult = wf03QualifyBatch({
  context: context,
  rules_overrides: rulesOverrides,
  prospects: prospects,
  audits: audits,
  existing_qualifications: existingQualifications
});

// Retorna el resultado completo del lote para downstream routing
return [{ json: batchResult }];
`;

// Código JS para el nodo Intake & Config
const intakeNodeJsCode = `
// =============================================================================
// ZYRVAE WF-03 — Intake Candidates & Config
// Default: RUN_SYNTHETIC_TEST = true (Seguridad y aislamiento garantizados)
// =============================================================================

const RUN_SYNTHETIC_TEST = true;

const now = new Date().toISOString();

// Configuración de reglas y servicios confirmados
const rulesOverrides = {
  confirmed_service_codes: ['WEB_SECURITY_SSL'],
  audit_unknown_traceability_policy: 'REVIEW'
};

if (RUN_SYNTHETIC_TEST) {
  // Lote sintético exhaustivo con casos borde
  const syntheticProspects = [
    {
      id: 'synth-row-1',
      lead_key: 'synth-lead-confirmed-http',
      business_name: 'Alpha Dental Care',
      website_url: 'http://alpha-dental.example.com',
      country: 'ES',
      industry: 'Health & Dental',
      status: 'validated',
      is_test_data: true,
      is_synthetic_test: true,
      traceability_status: 'TEST_DATA'
    },
    {
      id: 'synth-row-2',
      lead_key: 'real-candidate-acme',
      business_name: 'Acme Legal Services',
      website_url: 'http://acme-legal.com',
      country: 'ES',
      industry: 'Legal',
      status: 'validated',
      is_test_data: false,
      is_synthetic_test: false,
      traceability_status: 'CONFIRMED_REAL'
    },
    {
      id: 'synth-row-3',
      lead_key: 'real-candidate-high-opp',
      business_name: 'Apex Logistics S.L.',
      website_url: 'http://apex-logistics.es',
      country: 'ES',
      industry: 'Logistics',
      status: 'validated',
      is_test_data: false,
      is_synthetic_test: false,
      traceability_status: 'CONFIRMED_REAL'
    },
    {
      id: 'synth-row-4',
      lead_key: 'lead-unknown-traceability',
      business_name: 'Beta Studio Design',
      website_url: 'https://beta-studio.com',
      country: 'ES',
      industry: 'Design',
      status: 'validated',
      is_test_data: null,
      is_synthetic_test: false,
      traceability_status: 'UNKNOWN_TRACEABILITY'
    },
    {
      id: 'synth-row-5',
      lead_key: 'lead-incomplete-prospect',
      business_name: 'Gamma Incomplete',
      website_url: '',
      country: 'ES',
      industry: 'Retail',
      status: 'pending_review',
      is_test_data: false,
      is_synthetic_test: false,
      traceability_status: 'CONFIRMED_REAL'
    },
    {
      id: 'synth-row-6',
      lead_key: 'lead-no-audit',
      business_name: 'Delta Without Audit',
      website_url: 'https://delta-corp.com',
      country: 'ES',
      industry: 'Consulting',
      status: 'validated',
      is_test_data: false,
      is_synthetic_test: false,
      traceability_status: 'CONFIRMED_REAL'
    },
    {
      id: 'synth-row-7',
      lead_key: 'lead-stale-audit',
      business_name: 'Epsilon Old Audit',
      website_url: 'http://epsilon-old.com',
      country: 'ES',
      industry: 'Real Estate',
      status: 'validated',
      is_test_data: false,
      is_synthetic_test: false,
      traceability_status: 'CONFIRMED_REAL'
    },
    {
      id: 'synth-row-8',
      lead_key: 'lead-contradictory-audit',
      business_name: 'Zeta Contradictory Audit',
      website_url: 'https://zeta-conflict.com',
      country: 'ES',
      industry: 'Hospitality',
      status: 'validated',
      is_test_data: false,
      is_synthetic_test: false,
      traceability_status: 'CONFIRMED_REAL'
    }
  ];

  const staleDate = new Date(Date.now() - 200 * 86400000).toISOString();

  const syntheticAudits = [
    {
      id: 'aud-synth-1',
      audit_id: 'aud_synth_01',
      lead_key: 'synth-lead-confirmed-http',
      prospect_id: 'synth-lead-confirmed-http',
      audit_date: now,
      initial_url: 'http://alpha-dental.example.com',
      final_url: 'http://alpha-dental.example.com',
      http_status: 200,
      is_accessible: true,
      ssl_active: false,
      has_viewport: true,
      response_time_ms: 320,
      raw_evidence: JSON.stringify({
        analysis_verifiable: true,
        feature_status: { viewport: 'FOUND', meta_description: 'FOUND', page_title: 'FOUND' },
        traceability: { is_test_data: true, is_synthetic_test: true, traceability_status: 'TEST_DATA' }
      }),
      commercial_hypotheses: JSON.stringify([
        { category: 'SECURITY_SSL', opportunity: 'Migración a HTTPS', evidence: 'http://alpha-dental.example.com' }
      ]),
      is_synthetic_test: true,
      is_test_data: true
    },
    {
      id: 'aud-synth-2',
      audit_id: 'aud_real_acme_01',
      lead_key: 'real-candidate-acme',
      prospect_id: 'real-candidate-acme',
      audit_date: now,
      initial_url: 'http://acme-legal.com',
      final_url: 'http://acme-legal.com',
      http_status: 200,
      is_accessible: true,
      ssl_active: false,
      has_viewport: true,
      response_time_ms: 450,
      raw_evidence: JSON.stringify({
        analysis_verifiable: true,
        feature_status: { viewport: 'FOUND', meta_description: 'FOUND', page_title: 'FOUND' },
        traceability: { is_test_data: false, is_synthetic_test: false, traceability_status: 'CONFIRMED_REAL' }
      }),
      commercial_hypotheses: JSON.stringify([
        { category: 'SECURITY_SSL', opportunity: 'Migración a HTTPS', evidence: 'http://acme-legal.com' }
      ]),
      is_synthetic_test: false,
      is_test_data: false
    },
    {
      id: 'aud-synth-3',
      audit_id: 'aud_real_apex_01',
      lead_key: 'real-candidate-high-opp',
      prospect_id: 'real-candidate-high-opp',
      audit_date: now,
      initial_url: 'http://apex-logistics.es',
      final_url: 'http://apex-logistics.es',
      http_status: 200,
      is_accessible: true,
      ssl_active: false,
      has_viewport: false,
      response_time_ms: 3500,
      raw_evidence: JSON.stringify({
        analysis_verifiable: true,
        feature_status: { viewport: 'PROVEN_ABSENT', meta_description: 'PROVEN_ABSENT', page_title: 'FOUND' },
        traceability: { is_test_data: false, is_synthetic_test: false, traceability_status: 'CONFIRMED_REAL' }
      }),
      commercial_hypotheses: JSON.stringify([
        { category: 'SECURITY_SSL', opportunity: 'HTTPS', evidence: 'http://apex-logistics.es' },
        { category: 'MOBILE_RESPONSIVE', opportunity: 'Diseño móvil', evidence: 'Sin viewport' },
        { category: 'SEO_ONPAGE', opportunity: 'Meta description', evidence: 'Sin meta description' },
        { category: 'PERFORMANCE', opportunity: 'Optimización de velocidad', evidence: '3500ms' }
      ]),
      is_synthetic_test: false,
      is_test_data: false
    },
    {
      id: 'aud-synth-7',
      audit_id: 'aud_stale_01',
      lead_key: 'lead-stale-audit',
      prospect_id: 'lead-stale-audit',
      audit_date: staleDate,
      initial_url: 'http://epsilon-old.com',
      final_url: 'http://epsilon-old.com',
      http_status: 200,
      is_accessible: true,
      raw_evidence: JSON.stringify({
        analysis_verifiable: true,
        feature_status: { viewport: 'FOUND', meta_description: 'FOUND', page_title: 'FOUND' }
      }),
      is_synthetic_test: false,
      is_test_data: false
    },
    {
      id: 'aud-synth-8',
      audit_id: 'aud_contradictory_01',
      lead_key: 'lead-contradictory-audit',
      prospect_id: 'lead-contradictory-audit',
      audit_date: now,
      initial_url: 'https://zeta-conflict.com',
      final_url: 'https://zeta-conflict.com',
      http_status: 500,
      is_accessible: true, // Contradicción: accessible=true con 500
      raw_evidence: JSON.stringify({
        analysis_verifiable: false,
        unverifiable_reason: 'server_error'
      }),
      is_synthetic_test: false,
      is_test_data: false
    }
  ];

  return [{
    json: {
      run_mode: 'SYNTHETIC_TEST',
      context: {
        evaluated_at: now,
        run_mode: 'SYNTHETIC_TEST',
        persist_excluded_test_data: false,
        execution_id: $execution ? $execution.id : 'manual-test'
      },
      rules_overrides: rulesOverrides,
      prospects: syntheticProspects,
      audits: syntheticAudits,
      existing_qualifications: []
    }
  }];
}

// Rama de Producción: el input debe proveerse o leerse desde Data Tables
return [{
  json: {
    run_mode: 'PRODUCTION',
    context: {
      evaluated_at: now,
      run_mode: 'PRODUCTION',
      persist_excluded_test_data: false,
      execution_id: $execution ? $execution.id : 'manual-prod'
    },
    rules_overrides: rulesOverrides,
    prospects: $input.first().json.prospects || [],
    audits: $input.first().json.audits || [],
    existing_qualifications: $input.first().json.existing_qualifications || []
  }
}];
`;

// Código JS para el nodo Validate Input Candidates
const validateInputJsCode = `
// =============================================================================
// ZYRVAE WF-03 — Validate Input Candidates
// =============================================================================

const item = $input.first().json;
const prospects = item.prospects;
const audits = item.audits;

if (!Array.isArray(prospects)) {
  throw new Error('WF-03 INPUT ERROR (FATAL): prospects debe ser un array.');
}
if (!Array.isArray(audits)) {
  throw new Error('WF-03 INPUT ERROR (FATAL): audits debe ser un array.');
}

const validProspects = [];
const discardedRows = [];

prospects.forEach((p, idx) => {
  if (!p || typeof p !== 'object' || Array.isArray(p)) {
    discardedRows.push({ index: idx, reason: 'ROW_NOT_OBJECT' });
    return;
  }
  if (!p.lead_key || typeof p.lead_key !== 'string' || !p.lead_key.trim()) {
    discardedRows.push({ index: idx, row_id: p.id || null, reason: 'MISSING_OR_INVALID_LEAD_KEY' });
    return;
  }
  validProspects.push(p);
});

return [{
  json: {
    ...item,
    prospects: validProspects,
    validation_meta: {
      input_prospect_count: prospects.length,
      valid_prospect_count: validProspects.length,
      discarded_rows_count: discardedRows.length,
      discarded_rows: discardedRows
    }
  }
}];
`;

// Código JS para el nodo Route Evaluations by Type
const routeEvaluationsJsCode = `
// =============================================================================
// ZYRVAE WF-03 — Route Evaluations & Prepare Persistence
// =============================================================================

const batchResult = $input.first().json;
const evaluations = batchResult.evaluations || [];

const itemsOut = [];

evaluations.forEach(ev => {
  const record = ev.persistence_record || {};
  const recValidationErrors = ev.record_errors || [];

  itemsOut.push({
    json: {
      lead_key: ev.lead_key,
      qualification_id: ev.qualification_id,
      classification: ev.classification,
      priority_label: ev.priority_label,
      score: ev.score,
      traceability_status: ev.traceability_status,
      is_test_data: ev.is_test_data,
      requires_review: ev.requires_review,
      commercial_use_allowed: ev.commercial_use_allowed,
      persistence_action: ev.persistence_action,
      explanation: ev.explanation,
      is_synthetic_run: ev.is_synthetic_run,
      validation_errors: recValidationErrors,
      record: record,
      outcome_summary: ev.outcome_summary
    }
  });
});

return itemsOut;
`;

// Código JS para Preview Test Qualifications (No Write)
const previewTestJsCode = `
// =============================================================================
// ZYRVAE WF-03 — Preview Test Qualifications (No Write Terminal)
// =============================================================================

const items = $input.all();
return items.map(item => ({
  json: {
    ...item.json,
    _storage_status: 'DRY_RUN_NO_DATABASE_WRITE_PERFORMED',
    _preview_message: 'Modo sintético activo: Cero escrituras en la base de datos.'
  }
}));
`;

// Código JS para Record Skipped / Unchanged
const recordSkippedJsCode = `
// =============================================================================
// ZYRVAE WF-03 — Record Skipped / Unchanged
// =============================================================================

const items = $input.all();
return items.map(item => ({
  json: {
    ...item.json,
    _storage_status: 'SKIPPED_IDEMPOTENT_OR_TEST_DATA',
    _detail: 'Registro idéntico ya existente o dato de prueba omitido según política.'
  }
}));
`;

// Código JS para Record Persistence Success
const recordSuccessJsCode = `
// =============================================================================
// ZYRVAE WF-03 — Record Persistence Success
// =============================================================================

const items = $input.all();
return items.map(item => ({
  json: {
    ...item.json,
    _storage_status: 'PERSISTED_REAL',
    _persisted_table: 'lead_qualifications'
  }
}));
`;

// Código JS para Handle Persistence Error
const handleWriteErrorJsCode = `
// =============================================================================
// ZYRVAE WF-03 — Handle Persistence Error
// =============================================================================

const items = $input.all();
return items.map(item => {
  const err = item.json.error || item.json;
  return {
    json: {
      ...item.json,
      _storage_status: 'PERSISTENCE_FAILED',
      _storage_error: typeof err === 'object' ? JSON.stringify(err) : String(err)
    }
  };
});
`;

// Código JS para Build Execution Summary
const executionSummaryJsCode = `
// =============================================================================
// ZYRVAE WF-03 — Build Execution Summary
// =============================================================================

const items = $input.all();
let highCount = 0;
let mediumCount = 0;
let lowCount = 0;
let reviewCount = 0;
let excludedCount = 0;
let persistedCount = 0;
let skippedCount = 0;
let failedCount = 0;
let previewCount = 0;

const evaluationsSummary = [];

items.forEach(item => {
  const j = item.json;
  evaluationsSummary.push({
    lead_key: j.lead_key,
    qualification_id: j.qualification_id,
    classification: j.classification,
    score: j.score,
    traceability_status: j.traceability_status,
    commercial_use_allowed: j.commercial_use_allowed,
    storage_status: j._storage_status
  });

  if (j.classification === 'PRIORITY_HIGH') highCount++;
  else if (j.classification === 'PRIORITY_MEDIUM') mediumCount++;
  else if (j.classification === 'PRIORITY_LOW') lowCount++;
  else if (j.classification === 'REVIEW_REQUIRED') reviewCount++;
  else if (j.classification === 'EXCLUDED_TEST_DATA') excludedCount++;

  if (j._storage_status === 'PERSISTED_REAL') persistedCount++;
  else if (j._storage_status === 'SKIPPED_IDEMPOTENT_OR_TEST_DATA') skippedCount++;
  else if (j._storage_status === 'PERSISTENCE_FAILED') failedCount++;
  else if (j._storage_status === 'DRY_RUN_NO_DATABASE_WRITE_PERFORMED') previewCount++;
});

const hasErrors = failedCount > 0;

return [{
  json: {
    workflow: 'ZYRVAE WF-03 — Lead Qualification & Prioritization',
    status: hasErrors ? 'COMPLETED_WITH_STORAGE_FAILURES' : 'SUCCESS',
    executed_at: new Date().toISOString(),
    total_evaluated: items.length,
    counts: {
      priority_high: highCount,
      priority_medium: mediumCount,
      priority_low: lowCount,
      review_required: reviewCount,
      excluded_test_data: excludedCount
    },
    storage: {
      persisted_real: persistedCount,
      skipped_idempotent: skippedCount,
      persistence_failed: failedCount,
      dry_run_preview: previewCount
    },
    commercial_ready_leads: items
      .filter(i => i.json.commercial_use_allowed === true)
      .map(i => ({ lead_key: i.json.lead_key, qualification_id: i.json.qualification_id, score: i.json.score, classification: i.json.classification })),
    evaluations: evaluationsSummary
  }
}];
`;

const workflow = {
  name: 'ZYRVAE WF-03 — Lead Qualification & Prioritization',
  nodes: [
    {
      parameters: {},
      id: 'wf03-node-manual-trigger',
      name: 'Manual Trigger',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [0, 300]
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: intakeNodeJsCode
      },
      id: 'wf03-node-intake-config',
      name: 'Configure & Intake Candidates',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [240, 300]
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: validateInputJsCode
      },
      id: 'wf03-node-validate-input',
      name: 'Validate Input Candidates',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [480, 300]
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: engineNodeJsCode
      },
      id: 'wf03-node-rules-engine',
      name: 'Qualify Leads (Rules Engine)',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [720, 300]
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: routeEvaluationsJsCode
      },
      id: 'wf03-node-route-evaluations',
      name: 'Route Evaluations by Type',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [960, 300]
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: '',
            typeValidation: 'strict',
            version: 2
          },
          conditions: [
            {
              id: 'c1',
              leftValue: '={{ $json.is_synthetic_run }}',
              rightValue: true,
              operator: {
                type: 'boolean',
                operation: 'true',
                singleValue: true
              }
            }
          ],
          combinator: 'and'
        }
      },
      id: 'wf03-node-storage-guard',
      name: 'Is Test Mode? (Storage Guard)',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [1200, 300]
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: previewTestJsCode
      },
      id: 'wf03-node-preview-test',
      name: 'Preview Test Qualifications (No Write)',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1440, 180]
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: '',
            typeValidation: 'strict',
            version: 2
          },
          conditions: [
            {
              id: 'c2',
              leftValue: '={{ $json.persistence_action }}',
              rightValue: 'UPSERT',
              operator: {
                type: 'string',
                operation: 'equals'
              }
            }
          ],
          combinator: 'and'
        }
      },
      id: 'wf03-node-filter-persistable',
      name: 'Filter Valid Persistable Records',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [1440, 420]
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: recordSkippedJsCode
      },
      id: 'wf03-node-record-skipped',
      name: 'Record Skipped / Unchanged',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1680, 560]
    },
    {
      parameters: {
        resource: 'row',
        operation: 'upsert',
        dataTableId: {
          __rl: true,
          mode: 'id',
          value: 'GTtrgRiV4XxZijZZ',
          cachedResultName: 'lead_qualifications'
        },
        matchType: 'allConditions',
        filters: {
          conditions: [
            {
              keyName: 'qualification_id',
              condition: 'eq',
              keyValue: '={{ $json.record.qualification_id }}'
            }
          ]
        },
        columns: {
          mappingMode: 'defineBelow',
          value: {
            qualification_id: '={{ $json.record.qualification_id }}',
            lead_key: '={{ $json.record.lead_key }}',
            prospect_row_ids: '={{ $json.record.prospect_row_ids }}',
            business_name: '={{ $json.record.business_name }}',
            website_url: '={{ $json.record.website_url }}',
            evaluated_at: '={{ $json.record.evaluated_at }}',
            rules_version: '={{ $json.record.rules_version }}',
            rules_digest: '={{ $json.record.rules_digest }}',
            evidence_fingerprint: '={{ $json.record.evidence_fingerprint }}',
            run_mode: '={{ $json.record.run_mode }}',
            classification: '={{ $json.record.classification }}',
            priority_label: '={{ $json.record.priority_label }}',
            score: '={{ $json.record.score }}',
            score_components: '={{ $json.record.score_components }}',
            caps_applied: '={{ $json.record.caps_applied }}',
            traceability_status: '={{ $json.record.traceability_status }}',
            is_test_data: '={{ $json.record.is_test_data }}',
            requires_review: '={{ $json.record.requires_review }}',
            review_reasons: '={{ $json.record.review_reasons }}',
            exclusion_reason: '={{ $json.record.exclusion_reason }}',
            verified_findings: '={{ $json.record.verified_findings }}',
            hypotheses_assessment: '={{ $json.record.hypotheses_assessment }}',
            service_fit: '={{ $json.record.service_fit }}',
            warnings: '={{ $json.record.warnings }}',
            commercial_signals: '={{ $json.record.commercial_signals }}',
            commercial_use_allowed: '={{ $json.record.commercial_use_allowed }}',
            primary_audit_id: '={{ $json.record.primary_audit_id }}',
            source_audit_ids: '={{ $json.record.source_audit_ids }}',
            evidence_refs: '={{ $json.record.evidence_refs }}',
            input_snapshot: '={{ $json.record.input_snapshot }}',
            explanation: '={{ $json.record.explanation }}',
            supersedes_qualification_id: '={{ $json.record.supersedes_qualification_id }}',
            previous_classification: '={{ $json.record.previous_classification }}',
            workflow_execution_id: '={{ $json.record.workflow_execution_id }}'
          }
        }
      },
      id: 'wf03-node-datatable-write',
      name: 'Write to lead_qualifications Table (Prod Only)',
      type: 'n8n-nodes-base.dataTable',
      typeVersion: 1.1,
      position: [1680, 360],
      onError: 'continueErrorOutput'
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: recordSuccessJsCode
      },
      id: 'wf03-node-record-success',
      name: 'Record Persistence Success',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1920, 300]
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: handleWriteErrorJsCode
      },
      id: 'wf03-node-handle-write-error',
      name: 'Handle Persistence Error',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1920, 450]
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: executionSummaryJsCode
      },
      id: 'wf03-node-execution-summary',
      name: 'Build Execution Summary',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2160, 300]
    }
  ],
  connections: {
    'Manual Trigger': {
      main: [
        [
          {
            node: 'Configure & Intake Candidates',
            type: 'main',
            index: 0
          }
        ]
      ]
    },
    'Configure & Intake Candidates': {
      main: [
        [
          {
            node: 'Validate Input Candidates',
            type: 'main',
            index: 0
          }
        ]
      ]
    },
    'Validate Input Candidates': {
      main: [
        [
          {
            node: 'Qualify Leads (Rules Engine)',
            type: 'main',
            index: 0
          }
        ]
      ]
    },
    'Qualify Leads (Rules Engine)': {
      main: [
        [
          {
            node: 'Route Evaluations by Type',
            type: 'main',
            index: 0
          }
        ]
      ]
    },
    'Route Evaluations by Type': {
      main: [
        [
          {
            node: 'Is Test Mode? (Storage Guard)',
            type: 'main',
            index: 0
          }
        ]
      ]
    },
    'Is Test Mode? (Storage Guard)': {
      main: [
        [
          {
            node: 'Preview Test Qualifications (No Write)',
            type: 'main',
            index: 0
          }
        ],
        [
          {
            node: 'Filter Valid Persistable Records',
            type: 'main',
            index: 0
          }
        ]
      ]
    },
    'Preview Test Qualifications (No Write)': {
      main: [
        [
          {
            node: 'Build Execution Summary',
            type: 'main',
            index: 0
          }
        ]
      ]
    },
    'Filter Valid Persistable Records': {
      main: [
        [
          {
            node: 'Write to lead_qualifications Table (Prod Only)',
            type: 'main',
            index: 0
          }
        ],
        [
          {
            node: 'Record Skipped / Unchanged',
            type: 'main',
            index: 0
          }
        ]
      ]
    },
    'Record Skipped / Unchanged': {
      main: [
        [
          {
            node: 'Build Execution Summary',
            type: 'main',
            index: 0
          }
        ]
      ]
    },
    'Write to lead_qualifications Table (Prod Only)': {
      main: [
        [
          {
            node: 'Record Persistence Success',
            type: 'main',
            index: 0
          }
        ],
        [
          {
            node: 'Handle Persistence Error',
            type: 'main',
            index: 0
          }
        ]
      ]
    },
    'Record Persistence Success': {
      main: [
        [
          {
            node: 'Build Execution Summary',
            type: 'main',
            index: 0
          }
        ]
      ]
    },
    'Handle Persistence Error': {
      main: [
        [
          {
            node: 'Build Execution Summary',
            type: 'main',
            index: 0
          }
        ]
      ]
    }
  },
  active: false,
  settings: {
    executionOrder: 'v1'
  },
  tags: []
};

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(workflow, null, 2), 'utf8');
console.log(`Successfully built workflow JSON at ${OUTPUT_PATH}`);
console.log(`Nodes count: ${workflow.nodes.length}`);
console.log(`Active state: ${workflow.active}`);
