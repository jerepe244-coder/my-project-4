// =============================================================================
// ZYRVAE WF-03 — Test Suite Integral del Motor de Calificación
// Cobertura completa de los 18 escenarios mínimos requeridos.
// Datos exclusivamente sintéticos y aislados.
// =============================================================================

const assert = require('assert');
const engine = require('./qualification_engine.js');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
  }
}

console.log('=============================================================================');
console.log('Iniciando Test Suite WF-03 (Lead Qualification Engine)');
console.log('=============================================================================');

const NOW = '2026-10-31T12:00:00.000Z';

// -----------------------------------------------------------------------------
// 1. Prospecto válido con auditoría válida
// -----------------------------------------------------------------------------
runTest('1. Prospecto válido con auditoría válida (Scoring y Clasificación Comercial)', () => {
  const p = {
    id: 'row-1', lead_key: 'prod-acme-1', business_name: 'Acme Corp',
    website_url: 'http://acme.org', country: 'ES', industry: 'Legal',
    status: 'validated', is_test_data: false, is_synthetic_test: false,
    traceability_status: 'CONFIRMED_REAL'
  };
  const a = {
    audit_id: 'aud-acme-1', lead_key: 'prod-acme-1', prospect_id: 'prod-acme-1',
    audit_date: NOW, initial_url: 'http://acme.org', final_url: 'http://acme.org',
    http_status: 200, is_accessible: true, ssl_active: false, has_viewport: true,
    response_time_ms: 250, is_synthetic_test: false, is_test_data: false,
    raw_evidence: JSON.stringify({
      analysis_verifiable: true,
      feature_status: { viewport: 'FOUND', meta_description: 'FOUND', page_title: 'FOUND' },
      traceability: { is_test_data: false, is_synthetic_test: false, traceability_status: 'CONFIRMED_REAL' }
    }),
    commercial_hypotheses: JSON.stringify([
      { category: 'SECURITY_SSL', opportunity: 'Migrar a HTTPS', evidence: 'http://acme.org' }
    ])
  };

  const res = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    rules_overrides: { confirmed_service_codes: ['WEB_SECURITY_SSL'] },
    prospects: [p], audits: [a]
  });

  assert.strictEqual(res.evaluations.length, 1);
  const ev = res.evaluations[0];
  assert.strictEqual(ev.classification, 'PRIORITY_MEDIUM');
  assert.strictEqual(ev.score, 67); // 15 tech + 30 evidence + 12 svc + 10 completeness
  assert.strictEqual(ev.commercial_use_allowed, true);
  assert.strictEqual(ev.traceability_status, 'CONFIRMED_REAL');
  assert.strictEqual(ev.requires_review, false);
});

// -----------------------------------------------------------------------------
// 2. Prospecto incompleto
// -----------------------------------------------------------------------------
runTest('2. Prospecto incompleto (Sin website_url o status no validado -> REVIEW_REQUIRED)', () => {
  const p1 = {
    id: 'row-inc-1', lead_key: 'lead-inc-1', business_name: 'No Web Corp',
    website_url: '', status: 'validated', is_test_data: false, traceability_status: 'CONFIRMED_REAL'
  };
  const p2 = {
    id: 'row-inc-2', lead_key: 'lead-inc-2', business_name: 'Pending Corp',
    website_url: 'https://pending.org', status: 'pending_review', is_test_data: false, traceability_status: 'CONFIRMED_REAL'
  };

  const res = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [p1, p2], audits: []
  });

  assert.strictEqual(res.evaluations[0].classification, 'REVIEW_REQUIRED');
  assert.strictEqual(res.evaluations[0].score, null);
  assert(res.evaluations[0].review_reasons.some(r => r.code === 'MISSING_WEBSITE_URL'));

  assert.strictEqual(res.evaluations[1].classification, 'REVIEW_REQUIRED');
  assert.strictEqual(res.evaluations[1].score, null);
  assert(res.evaluations[1].review_reasons.some(r => r.code === 'PROSPECT_NOT_VALIDATED'));
});

// -----------------------------------------------------------------------------
// 3. Auditoría inexistente
// -----------------------------------------------------------------------------
runTest('3. Auditoría inexistente para prospecto válido (-> REVIEW_REQUIRED con NO_AUDIT_EVIDENCE)', () => {
  const p = {
    id: 'row-no-aud', lead_key: 'lead-no-aud', business_name: 'Delta Corp',
    website_url: 'https://delta.org', status: 'validated', is_test_data: false, traceability_status: 'CONFIRMED_REAL'
  };

  const res = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [p], audits: []
  });

  const ev = res.evaluations[0];
  assert.strictEqual(ev.classification, 'REVIEW_REQUIRED');
  assert.strictEqual(ev.score, null);
  assert(ev.review_reasons.some(r => r.code === 'NO_AUDIT_EVIDENCE'));
});

// -----------------------------------------------------------------------------
// 4. Auditoría vencida
// -----------------------------------------------------------------------------
runTest('4. Auditoría vencida (> 180 días -> REVIEW_REQUIRED con AUDIT_STALE)', () => {
  const staleDate = new Date(Date.parse(NOW) - 190 * 86400000).toISOString();
  const p = {
    id: 'row-stale', lead_key: 'lead-stale', business_name: 'Old Corp',
    website_url: 'http://old.org', status: 'validated', is_test_data: false, traceability_status: 'CONFIRMED_REAL'
  };
  const a = {
    audit_id: 'aud-stale', lead_key: 'lead-stale', prospect_id: 'lead-stale',
    audit_date: staleDate, initial_url: 'http://old.org', final_url: 'http://old.org',
    http_status: 200, is_accessible: true,
    raw_evidence: JSON.stringify({
      analysis_verifiable: true,
      feature_status: { viewport: 'FOUND', meta_description: 'FOUND', page_title: 'FOUND' }
    })
  };

  const res = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [p], audits: [a]
  });

  const ev = res.evaluations[0];
  assert.strictEqual(ev.classification, 'REVIEW_REQUIRED');
  assert(ev.review_reasons.some(r => r.code === 'AUDIT_STALE'));
});

// -----------------------------------------------------------------------------
// 5. Auditoría contradictoria
// -----------------------------------------------------------------------------
runTest('5. Auditoría contradictoria (is_accessible=true con http_status=500 y conflicto 14 días)', () => {
  const p = {
    id: 'row-conf', lead_key: 'lead-conf', business_name: 'Conf Corp',
    website_url: 'https://conf.org', status: 'validated', is_test_data: false, traceability_status: 'CONFIRMED_REAL'
  };
  const aBadStatus = {
    audit_id: 'aud-bad-stat', lead_key: 'lead-conf', prospect_id: 'lead-conf',
    audit_date: NOW, initial_url: 'https://conf.org', final_url: 'https://conf.org',
    http_status: 500, is_accessible: true, // Contradicción
    raw_evidence: JSON.stringify({ analysis_verifiable: false, unverifiable_reason: 'server_error' })
  };

  const res1 = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [p], audits: [aBadStatus]
  });
  assert.strictEqual(res1.evaluations[0].classification, 'REVIEW_REQUIRED');
  assert(res1.evaluations[0].review_reasons.some(r => r.code === 'EVIDENCE_CONTRADICTION'));

  // Conflicto de 2 auditorías recientes con distinta accesibilidad
  const d1 = NOW;
  const d2 = new Date(Date.parse(NOW) - 3 * 86400000).toISOString();
  const a1 = {
    audit_id: 'aud-c1', lead_key: 'lead-conf', prospect_id: 'lead-conf',
    audit_date: d1, initial_url: 'https://conf.org', final_url: 'https://conf.org',
    http_status: 200, is_accessible: true,
    raw_evidence: JSON.stringify({ analysis_verifiable: true, feature_status: { viewport: 'FOUND', meta_description: 'FOUND', page_title: 'FOUND' } })
  };
  const a2 = {
    audit_id: 'aud-c2', lead_key: 'lead-conf', prospect_id: 'lead-conf',
    audit_date: d2, initial_url: 'https://conf.org', final_url: 'https://conf.org',
    http_status: 503, is_accessible: false,
    raw_evidence: JSON.stringify({ analysis_verifiable: false, unverifiable_reason: 'server_error' })
  };

  const res2 = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [p], audits: [a1, a2]
  });
  assert.strictEqual(res2.evaluations[0].classification, 'REVIEW_REQUIRED');
  assert(res2.evaluations[0].review_reasons.some(r => r.code === 'EVIDENCE_CONFLICT_BETWEEN_AUDITS'));
});

// -----------------------------------------------------------------------------
// 6. Datos de prueba explícitos
// -----------------------------------------------------------------------------
runTest('6. Datos de prueba explícitos (is_test_data=true / is_synthetic_test=true -> EXCLUDED_TEST_DATA)', () => {
  const p1 = {
    id: 'row-t1', lead_key: 'lead-test-1', business_name: 'Test Co',
    website_url: 'http://testco.com', status: 'validated', is_test_data: true
  };
  const p2 = {
    id: 'row-t2', lead_key: 'synth-lead-2', business_name: 'Synth Co',
    website_url: 'http://synthco.com', status: 'validated', is_synthetic_test: true
  };

  const res = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [p1, p2], audits: []
  });

  assert.strictEqual(res.evaluations[0].classification, 'EXCLUDED_TEST_DATA');
  assert.strictEqual(res.evaluations[0].score, null);
  assert.strictEqual(res.evaluations[0].commercial_use_allowed, false);

  assert.strictEqual(res.evaluations[1].classification, 'EXCLUDED_TEST_DATA');
  assert.strictEqual(res.evaluations[1].score, null);
  assert.strictEqual(res.evaluations[1].commercial_use_allowed, false);
});

// -----------------------------------------------------------------------------
// 7. Trazabilidad desconocida
// -----------------------------------------------------------------------------
runTest('7. Trazabilidad desconocida (traceability_status=UNKNOWN_TRACEABILITY -> REVIEW_REQUIRED)', () => {
  const p = {
    id: 'row-unk', lead_key: 'lead-unk-1', business_name: 'Unknown Co',
    website_url: 'https://unk.com', status: 'validated', is_test_data: null,
    traceability_status: 'UNKNOWN_TRACEABILITY'
  };

  const res = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [p], audits: []
  });

  const ev = res.evaluations[0];
  assert.strictEqual(ev.classification, 'REVIEW_REQUIRED');
  assert.strictEqual(ev.traceability_status, 'UNKNOWN_TRACEABILITY');
  assert.strictEqual(ev.commercial_use_allowed, false);
  assert(ev.review_reasons.some(r => r.code === 'TRACEABILITY_UNKNOWN'));
});

// -----------------------------------------------------------------------------
// 8. Trazabilidad nula
// -----------------------------------------------------------------------------
runTest('8. Trazabilidad nula (is_test_data ausente -> TRACEABILITY_UNCONFIRMED, no asume real)', () => {
  const p = {
    id: 'row-null-trace', lead_key: 'lead-null-trace', business_name: 'Null Trace Co',
    website_url: 'https://nulltrace.com', status: 'validated'
    // is_test_data ausente
  };

  const res = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [p], audits: []
  });

  const ev = res.evaluations[0];
  assert.strictEqual(ev.classification, 'REVIEW_REQUIRED');
  assert.strictEqual(ev.traceability_status, 'UNKNOWN_TRACEABILITY');
  assert.strictEqual(ev.commercial_use_allowed, false);
  assert(ev.review_reasons.some(r => r.code === 'TRACEABILITY_UNCONFIRMED'));
});

// -----------------------------------------------------------------------------
// 9. Trazabilidad contradictoria
// -----------------------------------------------------------------------------
runTest('9. Trazabilidad contradictoria (test=true y real=true simultáneos, o dominio example.com)', () => {
  const pContra = {
    id: 'row-contra', lead_key: 'lead-contra', business_name: 'Contra Co',
    website_url: 'https://contra.com', status: 'validated',
    is_test_data: true, traceability_status: 'CONFIRMED_REAL' // Contradicción directa
  };
  const pDomain = {
    id: 'row-domain', lead_key: 'lead-domain', business_name: 'Example Co',
    website_url: 'https://example.com', status: 'validated',
    is_test_data: false, traceability_status: 'CONFIRMED_REAL' // Usa dominio reservado
  };

  const res = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [pContra, pDomain], audits: []
  });

  assert.strictEqual(res.evaluations[0].traceability_status, 'CONTRADICTORY_TRACEABILITY');
  assert.strictEqual(res.evaluations[0].classification, 'REVIEW_REQUIRED');

  assert.strictEqual(res.evaluations[1].traceability_status, 'CONTRADICTORY_TRACEABILITY');
  assert.strictEqual(res.evaluations[1].classification, 'REVIEW_REQUIRED');
});

// -----------------------------------------------------------------------------
// 10. Duplicados
// -----------------------------------------------------------------------------
runTest('10. Duplicados (Filas idénticas deduplicadas vs filas en conflicto enviadas a revisión)', () => {
  const pSame1 = { id: 'r1', lead_key: 'lead-dup-same', business_name: 'Same Co', website_url: 'http://same.com', status: 'validated', is_test_data: false, traceability_status: 'CONFIRMED_REAL' };
  const pSame2 = { id: 'r2', lead_key: 'lead-dup-same', business_name: 'Same Co', website_url: 'http://same.com', status: 'validated', is_test_data: false, traceability_status: 'CONFIRMED_REAL' };

  const pDiff1 = { id: 'r3', lead_key: 'lead-dup-diff', business_name: 'Diff Co A', website_url: 'http://diff-a.com', status: 'validated', is_test_data: false, traceability_status: 'CONFIRMED_REAL' };
  const pDiff2 = { id: 'r4', lead_key: 'lead-dup-diff', business_name: 'Diff Co B', website_url: 'http://diff-b.com', status: 'validated', is_test_data: false, traceability_status: 'CONFIRMED_REAL' };

  const aSame = {
    audit_id: 'aud-same', lead_key: 'lead-dup-same', prospect_id: 'lead-dup-same', audit_date: NOW,
    initial_url: 'http://same.com', final_url: 'http://same.com', http_status: 200, is_accessible: true,
    raw_evidence: JSON.stringify({ analysis_verifiable: true, feature_status: { viewport: 'FOUND', meta_description: 'FOUND', page_title: 'FOUND' } })
  };

  const res = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [pSame1, pSame2, pDiff1, pDiff2], audits: [aSame]
  });

  const evSame = res.evaluations.find(e => e.lead_key === 'lead-dup-same');
  assert(evSame.warnings.some(w => w.code === 'DUPLICATE_PROSPECT_ROWS'));

  const evDiff = res.evaluations.find(e => e.lead_key === 'lead-dup-diff');
  assert.strictEqual(evDiff.classification, 'REVIEW_REQUIRED');
  assert(evDiff.review_reasons.some(r => r.code === 'DUPLICATE_PROSPECT_CONFLICT'));
});

// -----------------------------------------------------------------------------
// 11. Reintentos e idempotencia
// -----------------------------------------------------------------------------
runTest('11. Reintentos e idempotencia (Mismo input -> NOOP; nueva evidencia -> UPSERT con supersedes)', () => {
  const p = { id: 'r1', lead_key: 'lead-idemp', business_name: 'Idemp Co', website_url: 'http://idemp.com', status: 'validated', is_test_data: false, traceability_status: 'CONFIRMED_REAL' };
  const a1 = {
    audit_id: 'aud-idemp', lead_key: 'lead-idemp', prospect_id: 'lead-idemp', audit_date: NOW,
    initial_url: 'http://idemp.com', final_url: 'http://idemp.com', http_status: 200, is_accessible: true,
    raw_evidence: JSON.stringify({ analysis_verifiable: true, feature_status: { viewport: 'FOUND', meta_description: 'FOUND', page_title: 'FOUND' } })
  };

  const res1 = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [p], audits: [a1], existing_qualifications: []
  });
  const qid1 = res1.evaluations[0].qualification_id;
  assert.strictEqual(res1.evaluations[0].persistence_action, 'UPSERT');

  // Reejecución con el registro previo en existing_qualifications
  const res2 = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [p], audits: [a1],
    existing_qualifications: [{ qualification_id: qid1, lead_key: 'lead-idemp', evaluated_at: NOW, classification: 'PRIORITY_LOW' }]
  });
  assert.strictEqual(res2.evaluations[0].persistence_action, 'NOOP_UNCHANGED');

  // Nueva evidencia: cambio en el audit
  const a2 = {
    ...a1,
    raw_evidence: JSON.stringify({ analysis_verifiable: true, feature_status: { viewport: 'PROVEN_ABSENT', meta_description: 'FOUND', page_title: 'FOUND' } })
  };
  const res3 = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [p], audits: [a2],
    existing_qualifications: [{ qualification_id: qid1, lead_key: 'lead-idemp', evaluated_at: NOW, classification: 'PRIORITY_LOW' }]
  });
  assert.strictEqual(res3.evaluations[0].persistence_action, 'UPSERT');
  assert.strictEqual(res3.evaluations[0].supersedes_qualification_id, qid1);
});

// -----------------------------------------------------------------------------
// 12. Errores de lectura y validación de entrada
// -----------------------------------------------------------------------------
runTest('12. Errores de lectura (prospects no array, fila no objeto, sin lead_key)', () => {
  assert.throws(() => {
    engine.wf03QualifyBatch({ context: { evaluated_at: NOW, run_mode: 'PRODUCTION' }, prospects: 'not-array' });
  }, /WF-03 INPUT ERROR/);

  const res = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [
      null,
      'string-row',
      { id: 'bad-key', lead_key: '' }, // missing lead_key
      { id: 'ok-key', lead_key: 'valid-lk', business_name: 'Ok', website_url: 'https://ok.com', status: 'validated', is_test_data: true }
    ],
    audits: []
  });

  assert.strictEqual(res.input_errors.length, 3);
  assert.strictEqual(res.evaluations.length, 1);
});

// -----------------------------------------------------------------------------
// 13. Errores de persistencia (wf03ValidatePersistenceRecord)
// -----------------------------------------------------------------------------
runTest('13. Errores de persistencia y validación de registro (Campos requeridos, rangos y columnas)', () => {
  const badRecord1 = {
    qualification_id: '',
    lead_key: 'lk',
    evaluated_at: NOW,
    rules_version: '1.0.0',
    rules_digest: 'digest',
    evidence_fingerprint: 'fp',
    classification: 'PRIORITY_HIGH',
    traceability_status: 'CONFIRMED_REAL',
    run_mode: 'PRODUCTION',
    score: 150 // fuera de rango
  };
  const errs1 = engine.wf03ValidatePersistenceRecord(badRecord1);
  assert(errs1.some(e => e.includes('Campo requerido vacío: qualification_id')));
  assert(errs1.some(e => e.includes('score fuera de rango')));

  const badRecord2 = {
    qualification_id: 'qid',
    lead_key: 'lk',
    evaluated_at: NOW,
    rules_version: '1.0.0',
    rules_digest: 'digest',
    evidence_fingerprint: 'fp',
    classification: 'REVIEW_REQUIRED',
    traceability_status: 'UNKNOWN_TRACEABILITY',
    run_mode: 'PRODUCTION',
    score: 50 // Revisión no debe tener score
  };
  const errs2 = engine.wf03ValidatePersistenceRecord(badRecord2);
  assert(errs2.some(e => e.includes('Revisión/exclusión con puntuación')));
});

// -----------------------------------------------------------------------------
// 14. Límites del scoring (0 a 100)
// -----------------------------------------------------------------------------
runTest('14. Límites del scoring (wf03ClampScore acota a [0, 100])', () => {
  const rules = engine.WF03_DEFAULT_RULES;
  assert.strictEqual(engine.wf03ClampScore(-20, rules), 0);
  assert.strictEqual(engine.wf03ClampScore(0, rules), 0);
  assert.strictEqual(engine.wf03ClampScore(55.4, rules), 55);
  assert.strictEqual(engine.wf03ClampScore(100, rules), 100);
  assert.strictEqual(engine.wf03ClampScore(180, rules), 100);
  assert.strictEqual(engine.wf03ClampScore(NaN, rules), null);
});

// -----------------------------------------------------------------------------
// 15. Umbrales de clasificación
// -----------------------------------------------------------------------------
runTest('15. Umbrales de clasificación (>= 70 HIGH, >= 45 MEDIUM, < 45 LOW)', () => {
  const rules = engine.WF03_DEFAULT_RULES;
  assert.strictEqual(engine.wf03ClassifyScore(100, rules), 'PRIORITY_HIGH');
  assert.strictEqual(engine.wf03ClassifyScore(70, rules), 'PRIORITY_HIGH');
  assert.strictEqual(engine.wf03ClassifyScore(69, rules), 'PRIORITY_MEDIUM');
  assert.strictEqual(engine.wf03ClassifyScore(45, rules), 'PRIORITY_MEDIUM');
  assert.strictEqual(engine.wf03ClassifyScore(44, rules), 'PRIORITY_LOW');
  assert.strictEqual(engine.wf03ClassifyScore(0, rules), 'PRIORITY_LOW');
});

// -----------------------------------------------------------------------------
// 16. Evidencias técnicas insuficientes (Sitio inaccesible y SSRF)
// -----------------------------------------------------------------------------
runTest('16. Evidencias técnicas insuficientes (Inaccesible -> reauditoría sin penalizar; SSRF bloqueado)', () => {
  const p = { id: 'r1', lead_key: 'lead-unreach', business_name: 'Down Co', website_url: 'http://down.com', status: 'validated', is_test_data: false, traceability_status: 'CONFIRMED_REAL' };
  const aDown = {
    audit_id: 'aud-down', lead_key: 'lead-unreach', prospect_id: 'lead-unreach', audit_date: NOW,
    initial_url: 'http://down.com', final_url: 'http://down.com', http_status: 502, is_accessible: false,
    raw_evidence: JSON.stringify({ analysis_verifiable: false, unverifiable_reason: 'bad_gateway' })
  };

  const resDown = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [p], audits: [aDown]
  });
  const evDown = resDown.evaluations[0];
  assert.strictEqual(evDown.classification, 'REVIEW_REQUIRED');
  assert(evDown.review_reasons.some(r => r.code === 'SITE_UNREACHABLE_REAUDIT'));
  assert.strictEqual(evDown.score, null); // NUNCA se puntúa un sitio caído

  const aSSRF = {
    audit_id: 'aud-ssrf', lead_key: 'lead-unreach', prospect_id: 'lead-unreach', audit_date: NOW,
    initial_url: 'http://127.0.0.1', final_url: 'http://127.0.0.1', http_status: null, is_accessible: false,
    error_code: 'SSRF_BLOCKED',
    raw_evidence: JSON.stringify({ analysis_verifiable: false, unverifiable_reason: 'ssrf_blocked' })
  };
  const resSSRF = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    prospects: [p], audits: [aSSRF]
  });
  const evSSRF = resSSRF.evaluations[0];
  assert.strictEqual(evSSRF.classification, 'REVIEW_REQUIRED');
  assert(evSSRF.review_reasons.some(r => r.code === 'AUDIT_SSRF_BLOCKED'));
});

// -----------------------------------------------------------------------------
// 17. Servicios no confirmados (Tope a PRIORITY_MEDIUM)
// -----------------------------------------------------------------------------
runTest('17. Servicios no confirmados (Sin encaje confirmado -> tope máximo PRIORITY_MEDIUM)', () => {
  const p = { id: 'r1', lead_key: 'lead-unconf-svc', business_name: 'Apex Co', website_url: 'http://apex.com', country: 'ES', industry: 'Logistics', status: 'validated', is_test_data: false, traceability_status: 'CONFIRMED_REAL' };
  // Auditoría con múltiples defectos técnicos que sumarían más de 70 puntos
  const a = {
    audit_id: 'aud-high', lead_key: 'lead-unconf-svc', prospect_id: 'lead-unconf-svc', audit_date: NOW,
    initial_url: 'http://apex.com', final_url: 'http://apex.com', http_status: 200, is_accessible: true,
    has_viewport: false, response_time_ms: 3500,
    raw_evidence: JSON.stringify({
      analysis_verifiable: true,
      feature_status: { viewport: 'PROVEN_ABSENT', meta_description: 'PROVEN_ABSENT', page_title: 'FOUND' },
      traceability: { is_test_data: false, is_synthetic_test: false, traceability_status: 'CONFIRMED_REAL' }
    })
  };

  // Sin confirmed_service_codes
  const res = engine.wf03QualifyBatch({
    context: { evaluated_at: NOW, run_mode: 'PRODUCTION' },
    rules_overrides: { confirmed_service_codes: [] },
    prospects: [p], audits: [a]
  });

  const ev = res.evaluations[0];
  // Score: technical (15 NO_HTTPS + 15 NO_VIEWPORT + 8 NO_META + 5 SLOW = 43 -> capped at 40)
  // + evidence 30 + service 0 + completeness 10 = 80
  assert(ev.score >= 70, `Score esperado >= 70, fue ${ev.score}`);
  assert.strictEqual(ev.classification, 'PRIORITY_MEDIUM', 'Debe estar topado a PRIORITY_MEDIUM por falta de servicios confirmados');
  assert(ev.caps_applied.some(c => c.code === 'SERVICE_FIT_UNCONFIRMED' && c.binding === true));
});

// -----------------------------------------------------------------------------
// 18. Consistencia de resultados ante ejecuciones repetidas (Determinismo)
// -----------------------------------------------------------------------------
runTest('18. Consistencia de resultados ante ejecuciones repetidas (Determinismo estricto)', () => {
  const p = { id: 'r1', lead_key: 'lead-det-1', business_name: 'Det Co', website_url: 'http://det.com', country: 'ES', industry: 'IT', status: 'validated', is_test_data: false, traceability_status: 'CONFIRMED_REAL' };
  const a = {
    audit_id: 'aud-det-1', lead_key: 'lead-det-1', prospect_id: 'lead-det-1', audit_date: NOW,
    initial_url: 'http://det.com', final_url: 'http://det.com', http_status: 200, is_accessible: true,
    raw_evidence: JSON.stringify({ analysis_verifiable: true, feature_status: { viewport: 'FOUND', meta_description: 'FOUND', page_title: 'FOUND' } })
  };

  const run1 = engine.wf03QualifyBatch({ context: { evaluated_at: NOW, run_mode: 'PRODUCTION' }, prospects: [p], audits: [a] });
  const run2 = engine.wf03QualifyBatch({ context: { evaluated_at: NOW, run_mode: 'PRODUCTION' }, prospects: [p], audits: [a] });
  const run3 = engine.wf03QualifyBatch({ context: { evaluated_at: NOW, run_mode: 'PRODUCTION' }, prospects: [p], audits: [a] });

  const qid1 = run1.evaluations[0].qualification_id;
  const qid2 = run2.evaluations[0].qualification_id;
  const qid3 = run3.evaluations[0].qualification_id;

  assert.strictEqual(qid1, qid2);
  assert.strictEqual(qid2, qid3);
  assert.strictEqual(run1.evaluations[0].score, run2.evaluations[0].score);
  assert.strictEqual(run1.evaluations[0].classification, run2.evaluations[0].classification);
  assert.strictEqual(run1.evaluations[0].evidence_fingerprint, run2.evaluations[0].evidence_fingerprint);
});

console.log('=============================================================================');
console.log(`Resumen de Ejecución: ${passedTests} de ${totalTests} tests pasaron con éxito.`);
console.log('=============================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
