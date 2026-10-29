// =============================================================================
// ZYRVAE WF-03 — Lead Qualification & Prioritization — Motor de calificación
// Reglas: v1.0.0 (documentadas en docs/ARCHITECTURE_WF-03.md §6)
//
// FUENTE ÚNICA DE VERDAD: scripts/wf03/qualification_engine.js
// Este archivo se embebe en el nodo n8n "Qualify Leads (Rules Engine)" mediante
// `node scripts/wf03/build_workflow.js`. No editar el código embebido en n8n:
// editar este archivo, regenerar el JSON y volver a importar.
//
// Principios:
//  * Determinista: misma entrada + mismas reglas + misma fecha => misma salida.
//  * Explicable: cada punto de la puntuación tiene justificación y referencia.
//  * Prudente: evidencia insuficiente => revisión manual, nunca precisión falsa.
//  * Sin efectos externos: función pura, sin red, sin escritura.
// =============================================================================

var WF03_RULES_VERSION = '1.0.0';

var WF03_DEFAULT_RULES = {
  version: '1.0.0',
  score: { min: 0, max: 100 },
  thresholds: { high: 70, medium: 45 },
  // Hallazgos técnicos verificables (solo con evidencia HTML/HTTP comprobada)
  findings: {
    NO_HTTPS: { points: 15, service: 'WEB_SECURITY_SSL', label: 'El sitio se sirve por HTTP sin cifrar (URL final sin HTTPS)' },
    NO_VIEWPORT: { points: 15, service: 'MOBILE_RESPONSIVE_UX', label: 'Ausencia comprobada de meta viewport en el HTML analizado' },
    NO_META_DESCRIPTION: { points: 8, service: 'SEO_ONPAGE', label: 'Ausencia comprobada de meta description en el HTML analizado' },
    NO_TITLE: { points: 7, service: 'SEO_ONPAGE', label: 'Ausencia comprobada de <title> en el HTML analizado' },
    SLOW_RESPONSE: { points: 5, service: 'WEB_PERFORMANCE', label: 'Tiempo de respuesta medido superior al umbral', threshold_ms: 3000 }
  },
  technical_cap: 40,
  evidence: {
    verifiable_full: 15,
    verifiable_partial: 8,
    fresh_days: 30,
    fresh_points: 10,
    recent_days: 90,
    recent_points: 5,
    aging_max_days: 180,
    consistency_points: 5,
    future_tolerance_hours: 24
  },
  service_fit: { one: 12, two_or_more: 20 },
  completeness: { business_name: 3, website_url: 3, country: 2, industry: 2 },
  accepted_prospect_statuses: ['validated'],
  audit_conflict_window_days: 14,
  // 'REVIEW' (estricto, por defecto): un UNKNOWN_TRACEABILITY en la auditoría
  // envía el prospecto a revisión aunque prospects lo confirme como real.
  // 'DEFER_TO_PROSPECT': prevalece la marca canónica de prospects (WF-01).
  audit_unknown_traceability_policy: 'REVIEW',
  // Catálogo de servicios. confirmed=false hasta que ZYRVAE los confirme
  // explícitamente (Config node: CONFIRMED_SERVICE_CODES).
  service_catalog: {
    WEB_SECURITY_SSL: { name: 'Securización web / migración a HTTPS', confirmed: false },
    MOBILE_RESPONSIVE_UX: { name: 'Optimización móvil / diseño responsivo', confirmed: false },
    SEO_ONPAGE: { name: 'SEO on-page (title / meta description)', confirmed: false },
    WEB_PERFORMANCE: { name: 'Optimización de rendimiento web', confirmed: false }
  },
  // Categorías de hipótesis emitidas por WF-02 => hallazgos que las respaldan.
  // null = la categoría nunca se puntúa (p. ej. sitio caído no es un defecto verificado).
  hypothesis_support: {
    SECURITY_SSL: ['NO_HTTPS'],
    MOBILE_RESPONSIVE: ['NO_VIEWPORT'],
    SEO_ONPAGE: ['NO_META_DESCRIPTION', 'NO_TITLE'],
    PERFORMANCE: ['SLOW_RESPONSE'],
    SITE_HEALTH: null,
    AVAILABILITY: null,
    NO_WEBSITE: null
  },
  suspected_test_patterns: {
    id_markers: ['synth-', 'testonly'],
    name_prefixes: ['[test'],
    domains: ['example.com', 'example.org', 'example.net']
  }
};

var WF03_LABELS = {
  PRIORITY_HIGH: 'Prioridad alta',
  PRIORITY_MEDIUM: 'Prioridad media',
  PRIORITY_LOW: 'Prioridad baja',
  REVIEW_REQUIRED: 'Revisión pendiente',
  EXCLUDED_TEST_DATA: 'Excluido: dato de prueba'
};

// ----------------------------------------------------------------------------
// Utilidades puras
// ----------------------------------------------------------------------------
function wf03Clone(o) { return JSON.parse(JSON.stringify(o)); }

function wf03Fnv(str, seed) {
  var h = seed >>> 0;
  for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return ('00000000' + h.toString(16)).slice(-8);
}
// Mismo algoritmo que WF-02 (Prepare Persistence Payload) para coherencia.
function wf03StableHash(str) { return wf03Fnv(str, 2166136261) + wf03Fnv(str, 3735928559); }

function wf03Canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(wf03Canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; })
      .map(function (k) { return JSON.stringify(k) + ':' + wf03Canonical(v[k]); }).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

function wf03IsBlank(v) { return v === null || v === undefined || (typeof v === 'string' && v.trim() === ''); }

function wf03ParseBool(v) {
  if (v === true || v === false) return { value: v, valid: true, present: true };
  if (wf03IsBlank(v)) return { value: null, valid: true, present: false };
  if (typeof v === 'string') {
    var s = v.trim().toLowerCase();
    if (s === 'true') return { value: true, valid: true, present: true };
    if (s === 'false') return { value: false, valid: true, present: true };
  }
  return { value: null, valid: false, present: true, raw: v };
}

function wf03ParseNumber(v) {
  if (typeof v === 'number' && isFinite(v)) return { value: v, valid: true, present: true };
  if (wf03IsBlank(v)) return { value: null, valid: true, present: false };
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return { value: Number(v.trim()), valid: true, present: true };
  return { value: null, valid: false, present: true, raw: v };
}

function wf03ParseJson(v) {
  if (wf03IsBlank(v)) return { ok: true, value: null, present: false };
  if (typeof v === 'object') return { ok: true, value: v, present: true };
  if (typeof v === 'string') {
    try { return { ok: true, value: JSON.parse(v), present: true }; } catch (e) { return { ok: false, value: null, present: true, error: String(e && e.message ? e.message : e) }; }
  }
  return { ok: false, value: null, present: true, error: 'tipo inesperado: ' + typeof v };
}

function wf03ParseDate(v) {
  if (wf03IsBlank(v)) return { ms: null, valid: true, present: false };
  if (typeof v !== 'string') return { ms: null, valid: false, present: true };
  var ms = Date.parse(v);
  return isFinite(ms) ? { ms: ms, valid: true, present: true } : { ms: null, valid: false, present: true };
}

function wf03Text(v) {
  if (v === null || v === undefined) return { value: null, valid: true };
  if (typeof v === 'string') return { value: v.trim() === '' ? null : v.trim(), valid: true };
  return { value: null, valid: false, raw: v };
}

function wf03NormUrl(u) {
  if (typeof u !== 'string') return null;
  var s = u.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  return s || null;
}

function wf03UrlScheme(u) {
  if (typeof u !== 'string') return null;
  var m = u.trim().match(/^([a-z][a-z0-9+.-]*):\/\//i);
  return m ? m[1].toLowerCase() : null;
}

function wf03UrlHost(u) {
  var n = wf03NormUrl(u);
  if (!n) return null;
  return n.split('/')[0].split(':')[0];
}

function wf03ClampScore(score, rules) {
  var min = rules.score.min, max = rules.score.max;
  if (typeof score !== 'number' || !isFinite(score)) return null;
  return Math.max(min, Math.min(max, Math.round(score)));
}

function wf03ClassifyScore(score, rules) {
  if (score === null || score === undefined) return null;
  if (score >= rules.thresholds.high) return 'PRIORITY_HIGH';
  if (score >= rules.thresholds.medium) return 'PRIORITY_MEDIUM';
  return 'PRIORITY_LOW';
}

function wf03RowTime(row) {
  var u = wf03ParseDate(row && row.updatedAt);
  var c = wf03ParseDate(row && row.createdAt);
  return u.ms !== null ? u.ms : (c.ms !== null ? c.ms : -1);
}

function wf03RowIdNum(row) {
  var n = wf03ParseNumber(row && row.id);
  return n.value === null ? -1 : n.value;
}

// ----------------------------------------------------------------------------
// Reglas efectivas (configurables y versionadas)
// ----------------------------------------------------------------------------
function wf03BuildRules(overrides) {
  var rules = wf03Clone(WF03_DEFAULT_RULES);
  var errors = [];
  var o = overrides || {};
  if (o.confirmed_service_codes !== undefined && o.confirmed_service_codes !== null) {
    if (!Array.isArray(o.confirmed_service_codes)) {
      errors.push('confirmed_service_codes debe ser un array');
    } else {
      o.confirmed_service_codes.forEach(function (code) {
        if (rules.service_catalog[code]) rules.service_catalog[code].confirmed = true;
        else errors.push('Código de servicio desconocido: ' + code);
      });
    }
  }
  if (o.audit_unknown_traceability_policy !== undefined && o.audit_unknown_traceability_policy !== null) {
    if (['REVIEW', 'DEFER_TO_PROSPECT'].indexOf(o.audit_unknown_traceability_policy) === -1) {
      errors.push('audit_unknown_traceability_policy inválida: ' + o.audit_unknown_traceability_policy);
    } else {
      rules.audit_unknown_traceability_policy = o.audit_unknown_traceability_policy;
    }
  }
  return { rules: rules, errors: errors, digest: wf03StableHash(wf03Canonical(rules)) };
}

// ----------------------------------------------------------------------------
// Trazabilidad (política estricta: la ausencia de marca NUNCA equivale a real)
// ----------------------------------------------------------------------------
function wf03ResolveTraceability(leadKey, prospectRows, audits, rules) {
  var test = [], real = [], unknown = [], invalid = [], suspect = [];
  var canonicalReal = false;

  function readFlag(value, source, field, isCanonical, falseMeansReal) {
    var b = wf03ParseBool(value);
    if (!b.valid) { invalid.push(source + '.' + field + '=' + JSON.stringify(value)); return; }
    if (b.value === true) test.push(source + '.' + field + '=true');
    else if (b.value === false && falseMeansReal) {
      real.push(source + '.' + field + '=false');
      if (isCanonical) canonicalReal = true;
    }
  }
  function readStatus(value, source) {
    if (wf03IsBlank(value)) return;
    if (value === 'TEST_DATA') test.push(source + '.traceability_status=TEST_DATA');
    else if (value === 'CONFIRMED_REAL') real.push(source + '.traceability_status=CONFIRMED_REAL');
    else if (value === 'UNKNOWN_TRACEABILITY') unknown.push(source + '.traceability_status=UNKNOWN_TRACEABILITY');
    else invalid.push(source + '.traceability_status=' + JSON.stringify(value));
  }

  var p = rules.suspected_test_patterns;
  var lkLower = String(leadKey).toLowerCase();
  p.id_markers.forEach(function (m) { if (lkLower.indexOf(m) !== -1) test.push('lead_key contiene marcador sintético "' + m + '"'); });

  prospectRows.forEach(function (row) {
    var src = 'prospects#' + (row.id !== undefined && row.id !== null ? row.id : '?');
    readFlag(row.is_test_data, src, 'is_test_data', true, true);
    readFlag(row.is_synthetic_test, src, 'is_synthetic_test', false, false);
    readStatus(row.traceability_status, src);
    var name = typeof row.business_name === 'string' ? row.business_name.trim().toLowerCase() : '';
    p.name_prefixes.forEach(function (pref) { if (name.indexOf(pref) === 0) suspect.push(src + '.business_name comienza con "' + pref + '"'); });
    var host = wf03UrlHost(row.website_url);
    if (host) p.domains.forEach(function (d) { if (host === d || host.slice(-(d.length + 1)) === '.' + d) suspect.push(src + '.website_url usa dominio reservado de ejemplo "' + d + '"'); });
  });

  audits.forEach(function (a) {
    var src = 'website_audits:' + a.audit_id;
    readFlag(a.is_test_data, src, 'is_test_data', false, true);
    readFlag(a.is_synthetic_test, src, 'is_synthetic_test', false, false);
    var raw = wf03ParseJson(a.raw_evidence);
    var t = raw.ok && raw.value && typeof raw.value === 'object' ? raw.value.traceability : null;
    if (t && typeof t === 'object') {
      readFlag(t.is_test_data, src + '#raw_evidence.traceability', 'is_test_data', false, true);
      readFlag(t.is_synthetic_test, src + '#raw_evidence.traceability', 'is_synthetic_test', false, false);
      readStatus(t.traceability_status, src + '#raw_evidence.traceability');
    }
  });

  var reasons = [];
  var status, isTestData;
  var auditUnknown = unknown.filter(function (s) { return s.indexOf('website_audits:') === 0; });
  var prospectUnknown = unknown.filter(function (s) { return s.indexOf('prospects#') === 0; });

  if (test.length && (real.length || canonicalReal)) {
    status = 'CONTRADICTORY_TRACEABILITY'; isTestData = null;
    reasons.push({ code: 'TRACEABILITY_CONTRADICTORY', detail: 'Marcas de prueba y de dato real simultáneas: [' + test.concat(real).join('; ') + ']' });
  } else if (test.length) {
    status = 'TEST_DATA'; isTestData = true;
  } else if (invalid.length) {
    status = 'UNKNOWN_TRACEABILITY'; isTestData = null;
    reasons.push({ code: 'TRACEABILITY_FLAG_INVALID', detail: 'Marcas de trazabilidad con valor o tipo inválido: [' + invalid.join('; ') + ']' });
  } else if (prospectUnknown.length) {
    status = 'UNKNOWN_TRACEABILITY'; isTestData = null;
    reasons.push({ code: 'TRACEABILITY_UNKNOWN', detail: 'El prospecto declara traceability_status=UNKNOWN_TRACEABILITY' });
  } else if (!canonicalReal) {
    status = 'UNKNOWN_TRACEABILITY'; isTestData = null;
    reasons.push({ code: 'TRACEABILITY_UNCONFIRMED', detail: 'prospects.is_test_data ausente o nulo: no se asume dato real sin confirmación explícita' });
  } else if (auditUnknown.length && rules.audit_unknown_traceability_policy === 'REVIEW') {
    status = 'UNKNOWN_TRACEABILITY'; isTestData = null;
    reasons.push({ code: 'TRACEABILITY_UNKNOWN_IN_AUDIT', detail: 'La auditoría registra trazabilidad desconocida: [' + auditUnknown.join('; ') + ']' });
  } else if (suspect.length) {
    status = 'CONTRADICTORY_TRACEABILITY'; isTestData = null;
    reasons.push({ code: 'TRACEABILITY_SUSPECTED_TEST_PATTERN', detail: 'Confirmado como real pero con patrones típicos de prueba: [' + suspect.join('; ') + ']' });
  } else {
    status = 'CONFIRMED_REAL'; isTestData = false;
  }

  return {
    status: status,
    is_test_data: isTestData,
    review_reasons: reasons,
    signals: { test: test, real: real, unknown: unknown, invalid: invalid, suspected: suspect },
    audit_unknown_policy: rules.audit_unknown_traceability_policy
  };
}

// ----------------------------------------------------------------------------
// Selección y análisis de la auditoría
// ----------------------------------------------------------------------------
function wf03AuditDigest(a) {
  var copy = {};
  Object.keys(a).forEach(function (k) { if (['id', 'createdAt', 'updatedAt'].indexOf(k) === -1) copy[k] = a[k]; });
  return wf03StableHash(wf03Canonical(copy));
}

function wf03SortAuditsDesc(list) {
  return list.slice().sort(function (x, y) {
    var dx = wf03ParseDate(x.audit.audit_date).ms, dy = wf03ParseDate(y.audit.audit_date).ms;
    dx = dx === null ? -Infinity : dx; dy = dy === null ? -Infinity : dy;
    if (dx !== dy) return dy - dx;
    var tx = wf03RowTime(x.audit), ty = wf03RowTime(y.audit);
    if (tx !== ty) return ty - tx;
    return String(x.audit.audit_id) < String(y.audit.audit_id) ? -1 : (String(x.audit.audit_id) > String(y.audit.audit_id) ? 1 : 0);
  });
}

function wf03AnalyzeAudit(auditGroup, rules, nowMs) {
  var a = auditGroup.audit;
  var ref = 'website_audits:' + a.audit_id;
  var res = {
    audit_id: a.audit_id,
    review_reasons: [],
    minor_issues: [],
    warnings: [],
    findings: [],
    verifiable: false,
    partial: false,
    feature_status: null,
    hypotheses: [],
    freshness: { audit_date: null, age_days: null, bucket: 'UNKNOWN' },
    snapshot: null
  };
  function review(code, detail, sub) { res.review_reasons.push({ code: code, detail: detail, evidence_ref: ref + (sub ? '#' + sub : '') }); }
  function minor(code, detail, sub) { res.minor_issues.push({ code: code, detail: detail, evidence_ref: ref + (sub ? '#' + sub : '') }); }

  if (auditGroup.conflict) review('DUPLICATE_AUDIT_CONFLICT', 'Existen ' + auditGroup.count + ' filas con audit_id ' + a.audit_id + ' y contenido distinto');
  else if (auditGroup.count > 1) res.warnings.push({ code: 'DUPLICATE_AUDIT_ROWS', detail: auditGroup.count + ' filas idénticas con audit_id ' + a.audit_id + ' (deduplicadas)' });

  if (!wf03IsBlank(a.lead_key) && !wf03IsBlank(a.prospect_id) && a.lead_key !== a.prospect_id) {
    review('EVIDENCE_CONTRADICTION', 'website_audits.lead_key (' + a.lead_key + ') difiere de prospect_id (' + a.prospect_id + ')', 'prospect_id');
  }

  var raw = wf03ParseJson(a.raw_evidence);
  var hyps = wf03ParseJson(a.commercial_hypotheses);
  var acc = wf03ParseBool(a.is_accessible);
  var http = wf03ParseNumber(a.http_status);
  var rt = wf03ParseNumber(a.response_time_ms);
  var hv = wf03ParseBool(a.has_viewport);
  var ssl = wf03ParseBool(a.ssl_active);
  var errorCode = typeof a.error_code === 'string' ? a.error_code.trim() : (wf03IsBlank(a.error_code) ? '' : String(a.error_code));
  var rawObj = raw.ok && raw.value && typeof raw.value === 'object' && !Array.isArray(raw.value) ? raw.value : null;

  // Frescura
  var d = wf03ParseDate(a.audit_date);
  if (d.ms !== null) {
    var ageMs = nowMs - d.ms;
    var ageDays = Math.floor(ageMs / 86400000);
    res.freshness.audit_date = new Date(d.ms).toISOString();
    if (ageMs < -rules.evidence.future_tolerance_hours * 3600000) {
      res.freshness.bucket = 'FUTURE';
      review('AUDIT_DATE_IN_FUTURE', 'audit_date (' + a.audit_date + ') es posterior a la fecha de evaluación', 'audit_date');
    } else {
      ageDays = Math.max(0, ageDays);
      res.freshness.age_days = ageDays;
      if (ageDays <= rules.evidence.fresh_days) res.freshness.bucket = 'FRESH';
      else if (ageDays <= rules.evidence.recent_days) res.freshness.bucket = 'RECENT';
      else if (ageDays <= rules.evidence.aging_max_days) res.freshness.bucket = 'AGING';
      else { res.freshness.bucket = 'STALE'; review('AUDIT_STALE', 'Auditoría con ' + ageDays + ' días (> ' + rules.evidence.aging_max_days + '): requiere reauditoría', 'audit_date'); }
    }
  } else if (!d.valid) {
    res.freshness.bucket = 'UNKNOWN';
    minor('AUDIT_DATE_INVALID', 'audit_date con formato inválido: ' + JSON.stringify(a.audit_date), 'audit_date');
  }

  if (!raw.ok) review('AUDIT_EVIDENCE_UNPARSEABLE', 'raw_evidence no es JSON válido (' + raw.error + ')', 'raw_evidence');
  else if (raw.present && !rawObj) review('AUDIT_EVIDENCE_UNPARSEABLE', 'raw_evidence no es un objeto JSON', 'raw_evidence');

  if (!acc.valid || !acc.present) review('AUDIT_FIELD_INVALID', 'is_accessible ausente o con tipo inesperado: ' + JSON.stringify(a.is_accessible), 'is_accessible');
  if (!http.valid) review('AUDIT_FIELD_INVALID', 'http_status con tipo inesperado: ' + JSON.stringify(a.http_status), 'http_status');
  if (!rt.valid) minor('AUDIT_FIELD_INVALID', 'response_time_ms con tipo inesperado: ' + JSON.stringify(a.response_time_ms), 'response_time_ms');

  var ssrf = errorCode === 'SSRF_BLOCKED' || (rawObj && rawObj.unverifiable_reason === 'ssrf_blocked');
  if (ssrf) review('AUDIT_SSRF_BLOCKED', 'La URL fue bloqueada por el filtro anti-SSRF (destino privado o inválido): sin evidencia del sitio', 'error_code');

  if (acc.value === false && !ssrf) {
    review('SITE_UNREACHABLE_REAUDIT', 'Sitio no accesible durante la auditoría (http_status=' + (http.value === null ? 'n/d' : http.value) + ', error_code=' + (errorCode || 'n/d') + '). No se interpreta como defecto de calidad; requiere reauditoría.', 'is_accessible');
  }

  // Contradicciones internas de la evidencia
  var statusOk = http.value !== null && http.value >= 200 && http.value < 400;
  if (acc.value === true && http.present && http.valid && !statusOk) review('EVIDENCE_CONTRADICTION', 'is_accessible=true pero http_status=' + http.value, 'http_status');
  if (acc.value === false && statusOk) review('EVIDENCE_CONTRADICTION', 'is_accessible=false pero http_status=' + http.value, 'http_status');

  var fs = rawObj && rawObj.feature_status && typeof rawObj.feature_status === 'object' ? rawObj.feature_status : null;
  res.feature_status = fs;
  var av = rawObj ? rawObj.analysis_verifiable : undefined;

  if (rawObj) {
    if (av === true && acc.value === false) review('EVIDENCE_CONTRADICTION', 'analysis_verifiable=true con sitio no accesible', 'raw_evidence.analysis_verifiable');
    if (av === true && rawObj.content_length === 0) review('EVIDENCE_CONTRADICTION', 'analysis_verifiable=true con content_length=0', 'raw_evidence.content_length');
    if (fs && hv.valid && hv.present) {
      if (fs.viewport === 'PROVEN_ABSENT' && hv.value === true) review('EVIDENCE_CONTRADICTION', 'has_viewport=true pero feature_status.viewport=PROVEN_ABSENT', 'raw_evidence.feature_status.viewport');
      if (fs.viewport === 'FOUND' && hv.value === false) review('EVIDENCE_CONTRADICTION', 'has_viewport=false pero feature_status.viewport=FOUND', 'raw_evidence.feature_status.viewport');
    }
  }

  // Verificabilidad del análisis HTML
  if (acc.value === true && !ssrf && raw.ok && rawObj !== null) {
    if (av === undefined && !fs) {
      review('AUDIT_LEGACY_UNVERIFIABLE', 'Auditoría en formato heredado (sin analysis_verifiable ni feature_status): no distingue ausencia comprobada de análisis no verificable', 'raw_evidence');
    } else if (av === false) {
      var reason = rawObj.unverifiable_reason;
      if (reason === 'empty_body') review('AUDIT_CONTENT_EMPTY_BODY', 'Respuesta con cuerpo vacío: no hay HTML verificable', 'raw_evidence.unverifiable_reason');
      else if (reason === 'non_html_response') review('AUDIT_CONTENT_NON_HTML', 'Respuesta HTTP sin contenido HTML verificable (content_type=' + (rawObj.content_type || 'n/d') + ')', 'raw_evidence.unverifiable_reason');
      else review('AUDIT_CONTENT_UNVERIFIABLE', 'Análisis HTML no verificable (motivo=' + (reason || 'n/d') + ')', 'raw_evidence.unverifiable_reason');
    } else if (av !== true) {
      review('AUDIT_FIELD_INVALID', 'raw_evidence.analysis_verifiable con valor inesperado: ' + JSON.stringify(av), 'raw_evidence.analysis_verifiable');
    } else {
      res.verifiable = true;
      var keys = ['viewport', 'meta_description', 'page_title'];
      keys.forEach(function (k) {
        var v = fs ? fs[k] : undefined;
        if (v !== 'FOUND' && v !== 'PROVEN_ABSENT') res.partial = true;
      });
      if (!http.present) res.partial = true;
    }
  } else if (acc.value === true && raw.ok && rawObj === null) {
    review('AUDIT_LEGACY_UNVERIFIABLE', 'raw_evidence ausente: no hay evidencia verificable del análisis HTML', 'raw_evidence');
  }

  // Hallazgos verificados (solo con análisis verificable y sitio accesible)
  if (res.verifiable && acc.value === true) {
    var urlForScheme = !wf03IsBlank(a.final_url) ? a.final_url : a.initial_url;
    var scheme = wf03UrlScheme(urlForScheme);
    var schemeField = !wf03IsBlank(a.final_url) ? 'final_url' : 'initial_url';
    if (scheme === 'http') res.findings.push({ code: 'NO_HTTPS', evidence: schemeField + '=' + urlForScheme, evidence_ref: ref + '#' + schemeField });
    var map = { viewport: 'NO_VIEWPORT', meta_description: 'NO_META_DESCRIPTION', page_title: 'NO_TITLE' };
    Object.keys(map).forEach(function (k) {
      if (fs && fs[k] === 'PROVEN_ABSENT') res.findings.push({ code: map[k], evidence: 'feature_status.' + k + '=PROVEN_ABSENT', evidence_ref: ref + '#raw_evidence.feature_status.' + k });
    });
    var thr = rules.findings.SLOW_RESPONSE.threshold_ms;
    if (rt.value !== null && rt.value > thr) res.findings.push({ code: 'SLOW_RESPONSE', evidence: 'response_time_ms=' + rt.value + ' (> ' + thr + ')', evidence_ref: ref + '#response_time_ms' });
    if (ssl.valid && ssl.present && scheme && ssl.value !== (scheme === 'https')) {
      minor('SSL_FLAG_INCONSISTENT', 'ssl_active=' + ssl.value + ' no coincide con el esquema de ' + schemeField + ' (' + scheme + ')', 'ssl_active');
    }
    if (errorCode) minor('ERROR_CODE_ON_ACCESSIBLE', 'error_code="' + errorCode + '" en una auditoría accesible', 'error_code');
  }

  // Evaluación de hipótesis comerciales de WF-02 (no se puntúan nunca por sí mismas)
  var findingCodes = res.findings.map(function (f) { return f.code; });
  if (!hyps.ok) {
    minor('HYPOTHESES_UNPARSEABLE', 'commercial_hypotheses no es JSON válido (' + hyps.error + ')', 'commercial_hypotheses');
  } else if (hyps.present && !Array.isArray(hyps.value)) {
    minor('HYPOTHESES_UNPARSEABLE', 'commercial_hypotheses no es un array', 'commercial_hypotheses');
  } else if (Array.isArray(hyps.value)) {
    hyps.value.forEach(function (h, idx) {
      var cat = h && typeof h === 'object' ? h.category : null;
      var support = Object.prototype.hasOwnProperty.call(rules.hypothesis_support, cat) ? rules.hypothesis_support[cat] : undefined;
      var status, supporting = [];
      if (support === undefined) status = 'UNKNOWN_CATEGORY';
      else if (support === null) status = 'NOT_SCORED_UNVERIFIED';
      else {
        supporting = support.filter(function (c) { return findingCodes.indexOf(c) !== -1; });
        status = supporting.length ? 'SUPPORTED' : 'UNSUPPORTED';
      }
      res.hypotheses.push({
        category: cat === undefined ? null : cat,
        status: status,
        supporting_findings: supporting,
        wf02_evidence: h && typeof h === 'object' && typeof h.evidence === 'string' ? h.evidence : null,
        wf02_opportunity: h && typeof h === 'object' && typeof h.opportunity === 'string' ? h.opportunity : null,
        evidence_ref: ref + '#commercial_hypotheses[' + idx + ']'
      });
    });
  }

  res.snapshot = {
    audit_id: a.audit_id,
    audit_date: a.audit_date === undefined ? null : a.audit_date,
    initial_url: a.initial_url === undefined ? null : a.initial_url,
    final_url: a.final_url === undefined ? null : a.final_url,
    http_status: a.http_status === undefined ? null : a.http_status,
    is_accessible: a.is_accessible === undefined ? null : a.is_accessible,
    ssl_active: a.ssl_active === undefined ? null : a.ssl_active,
    has_viewport: a.has_viewport === undefined ? null : a.has_viewport,
    response_time_ms: a.response_time_ms === undefined ? null : a.response_time_ms,
    error_code: a.error_code === undefined ? null : a.error_code,
    analysis_verifiable: rawObj && rawObj.analysis_verifiable !== undefined ? rawObj.analysis_verifiable : null,
    unverifiable_reason: rawObj && rawObj.unverifiable_reason !== undefined ? rawObj.unverifiable_reason : null,
    feature_status: fs,
    content_length: rawObj && rawObj.content_length !== undefined ? rawObj.content_length : null,
    hypothesis_categories: res.hypotheses.map(function (h) { return h.category; })
  };
  return res;
}

// ----------------------------------------------------------------------------
// Evaluación de un prospecto
// ----------------------------------------------------------------------------
function wf03EvaluateProspect(leadKey, prospectRows, auditGroups, rules, rulesDigest, ctx, existingForLead) {
  var nowMs = Date.parse(ctx.evaluated_at);
  var isSynthetic = ctx.run_mode === 'SYNTHETIC_TEST';
  var reviewReasons = [];
  var warnings = [];
  var minorIssues = [];

  var sortedP = prospectRows.slice().sort(function (x, y) {
    var t = wf03RowTime(y) - wf03RowTime(x);
    return t !== 0 ? t : wf03RowIdNum(y) - wf03RowIdNum(x);
  });
  var p = sortedP[0];
  var prospectRowIds = sortedP.map(function (r) { return r.id === undefined || r.id === null ? null : String(r.id); });

  if (prospectRows.length > 1) {
    var digests = {};
    prospectRows.forEach(function (r) {
      digests[wf03StableHash(wf03Canonical({
        business_name: r.business_name, website_url: r.website_url, status: r.status, final_status: r.final_status,
        is_test_data: r.is_test_data, is_synthetic_test: r.is_synthetic_test, traceability_status: r.traceability_status,
        country: r.country, industry: r.industry
      }))] = true;
    });
    if (Object.keys(digests).length > 1) reviewReasons.push({ code: 'DUPLICATE_PROSPECT_CONFLICT', detail: prospectRows.length + ' filas en prospects con lead_key ' + leadKey + ' y datos distintos', evidence_ref: 'prospects:' + leadKey });
    else warnings.push({ code: 'DUPLICATE_PROSPECT_ROWS', detail: prospectRows.length + ' filas idénticas en prospects con lead_key ' + leadKey + ' (deduplicadas)' });
  }

  var allAudits = auditGroups.map(function (g) { return g.audit; });
  var trace = wf03ResolveTraceability(leadKey, prospectRows, allAudits, rules);

  var bn = wf03Text(p.business_name), wu = wf03Text(p.website_url), co = wf03Text(p.country), ind = wf03Text(p.industry);
  [['business_name', bn], ['website_url', wu], ['country', co], ['industry', ind]].forEach(function (pair) {
    if (!pair[1].valid) warnings.push({ code: 'FIELD_TYPE_UNEXPECTED', detail: 'prospects.' + pair[0] + ' tiene tipo inesperado: ' + JSON.stringify(pair[1].raw) });
  });
  var statusRaw = p.status !== undefined && p.status !== null && p.status !== '' ? p.status : p.final_status;
  var st = wf03Text(statusRaw);

  // Selección de auditoría (unión por lead_key canónico; sin heurísticas)
  var sortedAudits = wf03SortAuditsDesc(auditGroups);
  var prospectUrlNorm = wf03NormUrl(wu.value);
  var matching = prospectUrlNorm ? sortedAudits.filter(function (g) { return wf03NormUrl(g.audit.initial_url) === prospectUrlNorm; }) : sortedAudits;
  var primaryGroup = null;
  var analysis = null;
  if (sortedAudits.length && prospectUrlNorm && !matching.length) {
    primaryGroup = sortedAudits[0];
  } else if (matching.length) {
    primaryGroup = matching[0];
  }

  var classification = null;
  var exclusionReason = null;

  if (trace.status === 'TEST_DATA') {
    classification = 'EXCLUDED_TEST_DATA';
    exclusionReason = 'TEST_DATA: ' + trace.signals.test.join('; ');
  } else {
    trace.review_reasons.forEach(function (r) { reviewReasons.push({ code: r.code, detail: r.detail, evidence_ref: 'prospects:' + leadKey }); });

    if (!wu.valid) reviewReasons.push({ code: 'FIELD_TYPE_UNEXPECTED', detail: 'prospects.website_url con tipo inesperado', evidence_ref: 'prospects:' + leadKey + '#website_url' });
    else if (!wu.value) reviewReasons.push({ code: 'MISSING_WEBSITE_URL', detail: 'El prospecto no tiene website_url: no hay evidencia web evaluable', evidence_ref: 'prospects:' + leadKey + '#website_url' });

    if (!st.valid || !st.value) reviewReasons.push({ code: 'PROSPECT_STATUS_UNKNOWN', detail: 'Estado de validación de WF-01 ausente o inválido', evidence_ref: 'prospects:' + leadKey + '#status' });
    else if (rules.accepted_prospect_statuses.indexOf(st.value) === -1) reviewReasons.push({ code: 'PROSPECT_NOT_VALIDATED', detail: 'Estado WF-01 "' + st.value + '" no está en [' + rules.accepted_prospect_statuses.join(', ') + ']', evidence_ref: 'prospects:' + leadKey + '#status' });

    if (!sortedAudits.length) {
      reviewReasons.push({ code: 'NO_AUDIT_EVIDENCE', detail: 'No existe auditoría en website_audits para este lead_key', evidence_ref: 'website_audits:lead_key=' + leadKey });
    } else if (prospectUrlNorm && !matching.length) {
      reviewReasons.push({ code: 'AUDIT_URL_MISMATCH', detail: 'Ninguna auditoría corresponde a website_url del prospecto (' + wu.value + '); auditoría más reciente: ' + primaryGroup.audit.initial_url, evidence_ref: 'website_audits:' + primaryGroup.audit.audit_id + '#initial_url' });
    }

    if (primaryGroup) {
      analysis = wf03AnalyzeAudit(primaryGroup, rules, nowMs);
      analysis.review_reasons.forEach(function (r) { reviewReasons.push(r); });
      analysis.warnings.forEach(function (w) { warnings.push(w); });
      analysis.minor_issues.forEach(function (m) { minorIssues.push(m); });
      // Conflicto entre auditorías recientes de la misma URL
      var pool = matching.length ? matching : sortedAudits;
      if (pool.length > 1) {
        var a0 = pool[0].audit, a1 = pool[1].audit;
        var d0 = wf03ParseDate(a0.audit_date).ms, d1 = wf03ParseDate(a1.audit_date).ms;
        var acc0 = wf03ParseBool(a0.is_accessible).value, acc1 = wf03ParseBool(a1.is_accessible).value;
        if (d0 !== null && d1 !== null && Math.abs(d0 - d1) <= rules.audit_conflict_window_days * 86400000 && acc0 !== null && acc1 !== null && acc0 !== acc1) {
          reviewReasons.push({ code: 'EVIDENCE_CONFLICT_BETWEEN_AUDITS', detail: 'Auditorías ' + a0.audit_id + ' y ' + a1.audit_id + ' (≤ ' + rules.audit_conflict_window_days + ' días) discrepan en accesibilidad', evidence_ref: 'website_audits:' + a0.audit_id });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Puntuación (solo si no hay exclusión ni motivos de revisión)
  // ---------------------------------------------------------------------------
  var score = null, components = null, caps = [], serviceFit = [], findingsOut = [];
  if (analysis) {
    findingsOut = analysis.findings.map(function (f) {
      var def = rules.findings[f.code];
      var svc = rules.service_catalog[def.service];
      return { code: f.code, label: def.label, evidence: f.evidence, evidence_ref: f.evidence_ref, points: def.points, service_code: def.service, service_confirmed: !!(svc && svc.confirmed) };
    });
    var svcMap = {};
    findingsOut.forEach(function (f) {
      if (!svcMap[f.service_code]) svcMap[f.service_code] = { service_code: f.service_code, name: rules.service_catalog[f.service_code].name, confirmed: f.service_confirmed, supporting_findings: [] };
      svcMap[f.service_code].supporting_findings.push(f.code);
    });
    serviceFit = Object.keys(svcMap).sort().map(function (k) { return svcMap[k]; });
  }

  if (!classification && reviewReasons.length) classification = 'REVIEW_REQUIRED';

  if (!classification) {
    var tItems = findingsOut.map(function (f) { return { code: f.code, points: f.points, justification: f.label + ' (' + f.evidence + ')', evidence_ref: f.evidence_ref }; });
    var tRaw = tItems.reduce(function (s, i) { return s + i.points; }, 0);
    var tPts = Math.min(tRaw, rules.technical_cap);
    if (tRaw > rules.technical_cap) tItems.push({ code: 'TECHNICAL_CAP', points: rules.technical_cap - tRaw, justification: 'Tope del componente técnico (' + rules.technical_cap + ')', evidence_ref: null });
    if (!tItems.length) tItems.push({ code: 'NO_VERIFIED_FINDINGS', points: 0, justification: 'La auditoría verificable no muestra defectos técnicos comprobados', evidence_ref: 'website_audits:' + analysis.audit_id });

    var auditRef = 'website_audits:' + analysis.audit_id;
    var eItems = [];
    var vPts = analysis.partial ? rules.evidence.verifiable_partial : rules.evidence.verifiable_full;
    eItems.push({ code: analysis.partial ? 'AUDIT_PARTIAL' : 'AUDIT_COMPLETE', points: vPts, justification: analysis.partial ? 'Análisis HTML verificable pero incompleto (feature_status o http_status faltantes)' : 'Análisis HTML verificable y completo', evidence_ref: auditRef + '#raw_evidence' });
    var b = analysis.freshness.bucket;
    var fPts = b === 'FRESH' ? rules.evidence.fresh_points : (b === 'RECENT' ? rules.evidence.recent_points : 0);
    eItems.push({ code: 'FRESHNESS_' + b, points: fPts, justification: analysis.freshness.age_days === null ? 'Fecha de auditoría desconocida' : 'Antigüedad de la auditoría: ' + analysis.freshness.age_days + ' días', evidence_ref: auditRef + '#audit_date' });
    var cPts = minorIssues.length ? 0 : rules.evidence.consistency_points;
    eItems.push({ code: minorIssues.length ? 'MINOR_INCONSISTENCIES' : 'EVIDENCE_CONSISTENT', points: cPts, justification: minorIssues.length ? 'Inconsistencias menores: ' + minorIssues.map(function (m) { return m.code; }).join(', ') : 'Sin inconsistencias entre campos de la auditoría y el prospecto', evidence_ref: auditRef });
    var ePts = vPts + fPts + cPts;

    var confirmedServices = serviceFit.filter(function (s) { return s.confirmed; });
    var sPts = confirmedServices.length >= 2 ? rules.service_fit.two_or_more : (confirmedServices.length === 1 ? rules.service_fit.one : 0);
    var sItems = [{ code: 'CONFIRMED_SERVICE_MATCHES', points: sPts, justification: confirmedServices.length ? 'Servicios confirmados respaldados por hallazgos: ' + confirmedServices.map(function (s) { return s.service_code; }).join(', ') : 'Ningún servicio confirmado de ZYRVAE respaldado por hallazgos verificados', evidence_ref: null }];

    var dItems = [];
    var comp = rules.completeness;
    [['business_name', bn], ['website_url', wu], ['country', co], ['industry', ind]].forEach(function (pair) {
      var present = pair[1].valid && !!pair[1].value;
      dItems.push({ code: 'FIELD_' + pair[0].toUpperCase(), points: present ? comp[pair[0]] : 0, justification: present ? pair[0] + ' presente' : pair[0] + ' ausente o inválido', evidence_ref: 'prospects:' + leadKey + '#' + pair[0] });
    });
    var dPts = dItems.reduce(function (s, i) { return s + i.points; }, 0);

    score = wf03ClampScore(tPts + ePts + sPts + dPts, rules);
    components = {
      technical: { points: tPts, max: rules.technical_cap, items: tItems },
      evidence: { points: ePts, max: rules.evidence.verifiable_full + rules.evidence.fresh_points + rules.evidence.consistency_points, items: eItems },
      service_fit: { points: sPts, max: rules.service_fit.two_or_more, items: sItems },
      completeness: { points: dPts, max: comp.business_name + comp.website_url + comp.country + comp.industry, items: dItems }
    };

    classification = wf03ClassifyScore(score, rules);

    // Topes: la prioridad alta exige evidencia completa, fresca, coherente y servicio confirmado
    if (analysis.partial) caps.push({ code: 'PARTIAL_AUDIT', detail: 'Auditoría parcial: máximo prioridad media' });
    if (b === 'AGING') caps.push({ code: 'AUDIT_AGING', detail: 'Auditoría de ' + analysis.freshness.age_days + ' días (> ' + rules.evidence.recent_days + '): máximo prioridad media' });
    if (b === 'UNKNOWN') caps.push({ code: 'AUDIT_DATE_UNKNOWN', detail: 'Actualidad de la evidencia no verificable: máximo prioridad media' });
    if (minorIssues.length) caps.push({ code: 'MINOR_INCONSISTENCY', detail: 'Inconsistencias menores en la evidencia: máximo prioridad media' });
    if (analysis.hypotheses.some(function (h) { return h.status === 'UNSUPPORTED' || h.status === 'UNKNOWN_CATEGORY'; })) caps.push({ code: 'UNSUPPORTED_HYPOTHESES', detail: 'WF-02 registró hipótesis sin respaldo verificable: se ignoran y se limita a prioridad media' });
    if (sPts === 0) caps.push({ code: 'SERVICE_FIT_UNCONFIRMED', detail: 'Sin encaje con servicios confirmados de ZYRVAE: máximo prioridad media' });
    caps.forEach(function (c) { c.binding = classification === 'PRIORITY_HIGH'; });
    if (classification === 'PRIORITY_HIGH' && caps.length) classification = 'PRIORITY_MEDIUM';
  }

  var commercialUse = ['PRIORITY_HIGH', 'PRIORITY_MEDIUM', 'PRIORITY_LOW'].indexOf(classification) !== -1 && trace.status === 'CONFIRMED_REAL' && !isSynthetic;

  var otherAuditIds = sortedAudits.map(function (g) { return g.audit.audit_id; }).filter(function (id) { return !primaryGroup || id !== primaryGroup.audit.audit_id; });
  var inputSnapshot = {
    prospect: {
      lead_key: leadKey,
      row_ids: prospectRowIds,
      business_name: p.business_name === undefined ? null : p.business_name,
      website_url: p.website_url === undefined ? null : p.website_url,
      country: p.country === undefined ? null : p.country,
      industry: p.industry === undefined ? null : p.industry,
      status: statusRaw === undefined ? null : statusRaw,
      is_test_data: p.is_test_data === undefined ? null : p.is_test_data,
      is_synthetic_test: p.is_synthetic_test === undefined ? null : p.is_synthetic_test,
      traceability_status: p.traceability_status === undefined ? null : p.traceability_status
    },
    primary_audit: analysis ? analysis.snapshot : (primaryGroup ? { audit_id: primaryGroup.audit.audit_id } : null),
    other_audit_ids: otherAuditIds
  };

  var outcomeDigest = {
    classification: classification,
    score: score,
    review_codes: reviewReasons.map(function (r) { return r.code; }).sort(),
    caps: caps.map(function (c) { return c.code; }).sort(),
    findings: findingsOut.map(function (f) { return f.code; }).sort(),
    freshness_bucket: analysis ? analysis.freshness.bucket : null,
    traceability: trace.status
  };
  var fingerprint = wf03StableHash(wf03Canonical({ rules_version: rules.version, rules_digest: rulesDigest, lead_key: leadKey, input: inputSnapshot, outcome: outcomeDigest }));
  var qualificationId = isSynthetic ? 'SYNTH-LQ-' + fingerprint + '-TESTONLY' : 'lq_' + fingerprint;

  var ev = {
    qualification_id: qualificationId,
    lead_key: leadKey,
    prospect_row_ids: prospectRowIds,
    business_name: bn.value,
    website_url: wu.value,
    evaluated_at: ctx.evaluated_at,
    rules_version: rules.version,
    rules_digest: rulesDigest,
    evidence_fingerprint: fingerprint,
    run_mode: ctx.run_mode,
    is_synthetic_run: isSynthetic,
    classification: classification,
    priority_label: WF03_LABELS[classification],
    score: score,
    score_components: components,
    caps_applied: caps,
    traceability_status: trace.status,
    is_test_data: trace.is_test_data,
    traceability: trace,
    requires_review: classification === 'REVIEW_REQUIRED',
    review_reasons: classification === 'REVIEW_REQUIRED' ? reviewReasons : [],
    exclusion_reason: exclusionReason,
    verified_findings: findingsOut,
    hypotheses_assessment: analysis ? analysis.hypotheses : [],
    service_fit: serviceFit,
    warnings: warnings.concat(minorIssues.map(function (m) { return { code: m.code, detail: m.detail, evidence_ref: m.evidence_ref }; })),
    commercial_signals: {
      buying_intent: 'NOT_ASSESSED',
      budget: 'UNKNOWN',
      decision_authority: 'UNKNOWN',
      urgency: 'UNKNOWN',
      note: 'WF-03 mide oportunidad técnica verificada. No infiere intención de compra, presupuesto, urgencia ni autoridad de decisión.'
    },
    commercial_use_allowed: commercialUse,
    primary_audit_id: primaryGroup ? primaryGroup.audit.audit_id : null,
    source_audit_ids: sortedAudits.map(function (g) { return g.audit.audit_id; }),
    evidence_refs: {
      prospect: { table: 'prospects', lead_key: leadKey, row_ids: prospectRowIds },
      primary_audit: primaryGroup ? { table: 'website_audits', audit_id: primaryGroup.audit.audit_id, audit_date: primaryGroup.audit.audit_date === undefined ? null : primaryGroup.audit.audit_date } : null,
      other_audit_ids: otherAuditIds
    },
    input_snapshot: inputSnapshot,
    supersedes_qualification_id: null,
    previous_classification: null,
    persistence_action: null
  };

  // Idempotencia / versionado (solo apéndice: nunca se sobrescribe historial)
  var existing = (existingForLead || []).slice().sort(function (x, y) {
    var dx = wf03ParseDate(x.evaluated_at).ms || 0, dy = wf03ParseDate(y.evaluated_at).ms || 0;
    if (dx !== dy) return dy - dx;
    return String(x.qualification_id) < String(y.qualification_id) ? 1 : -1;
  });
  var same = existing.filter(function (r) { return r.qualification_id === qualificationId; });
  var latestOther = existing.filter(function (r) { return r.qualification_id !== qualificationId; })[0];
  if (latestOther) { ev.supersedes_qualification_id = latestOther.qualification_id; ev.previous_classification = latestOther.classification || null; }

  if (isSynthetic) ev.persistence_action = 'PREVIEW_ONLY';
  else if (classification === 'EXCLUDED_TEST_DATA' && !ctx.persist_excluded_test_data) ev.persistence_action = 'SKIP_TEST_DATA';
  else if (same.length) ev.persistence_action = 'NOOP_UNCHANGED';
  else ev.persistence_action = 'UPSERT';

  ev.explanation = wf03Explain(ev, analysis);
  ev.outcome_summary = {
    lead_key: ev.lead_key,
    qualification_id: ev.qualification_id,
    classification: ev.classification,
    score: ev.score,
    traceability_status: ev.traceability_status,
    review_reason_codes: ev.review_reasons.map(function (r) { return r.code; }),
    exclusion_reason: ev.exclusion_reason,
    caps: caps.map(function (c) { return c.code; }),
    primary_audit_id: ev.primary_audit_id,
    commercial_use_allowed: ev.commercial_use_allowed
  };

  var recCheck = wf03ValidatePersistenceRecord(wf03BuildPersistenceRecord(ev, ctx));
  if (recCheck.length) { ev.persistence_action = 'NONE_INVALID_RECORD'; ev.record_errors = recCheck; }
  return ev;
}

function wf03Explain(ev, analysis) {
  var v = 'reglas v' + ev.rules_version;
  if (ev.classification === 'EXCLUDED_TEST_DATA') {
    return 'Excluido de la priorización comercial (' + v + '): dato de prueba. Señales: ' + ev.traceability.signals.test.join('; ') + '.';
  }
  if (ev.classification === 'REVIEW_REQUIRED') {
    return 'Revisión pendiente (' + v + '). No se asigna puntuación comercial. Motivos: ' +
      ev.review_reasons.map(function (r) { return '[' + r.code + '] ' + r.detail; }).join(' | ') + '.';
  }
  var parts = [];
  parts.push(ev.priority_label + ' — puntuación ' + ev.score + '/100 (' + v + ').');
  parts.push('Hallazgos técnicos verificados: ' + (ev.verified_findings.length ? ev.verified_findings.map(function (f) { return f.code + ' (' + f.evidence_ref + ')'; }).join(', ') : 'ninguno') + '.');
  var conf = ev.service_fit.filter(function (s) { return s.confirmed; });
  var unconf = ev.service_fit.filter(function (s) { return !s.confirmed; });
  parts.push('Encaje con servicios confirmados: ' + (conf.length ? conf.map(function (s) { return s.service_code; }).join(', ') : 'ninguno') + (unconf.length ? '; servicios relacionados sin confirmar: ' + unconf.map(function (s) { return s.service_code; }).join(', ') : '') + '.');
  if (analysis) parts.push('Evidencia: auditoría ' + analysis.audit_id + (analysis.freshness.age_days !== null ? ' de hace ' + analysis.freshness.age_days + ' días' : ' sin fecha verificable') + ', análisis ' + (analysis.partial ? 'parcial' : 'completo') + '.');
  var c = ev.score_components;
  parts.push('Componentes: técnico ' + c.technical.points + '/' + c.technical.max + ', evidencia ' + c.evidence.points + '/' + c.evidence.max + ', servicio ' + c.service_fit.points + '/' + c.service_fit.max + ', completitud ' + c.completeness.points + '/' + c.completeness.max + '.');
  if (ev.caps_applied.length) parts.push('Topes: ' + ev.caps_applied.map(function (x) { return x.code + (x.binding ? ' (aplicado)' : ''); }).join(', ') + '.');
  var hyp = ev.hypotheses_assessment.filter(function (h) { return h.status !== 'SUPPORTED'; });
  if (hyp.length) parts.push('Hipótesis de WF-02 no puntuadas: ' + hyp.map(function (h) { return h.category + '=' + h.status; }).join(', ') + '.');
  parts.push('La prioridad refleja oportunidad técnica verificada; no se evaluó intención de compra, presupuesto, urgencia ni autoridad de decisión.');
  return parts.join(' ');
}

// ----------------------------------------------------------------------------
// Persistencia (registro plano para la Data Table lead_qualifications)
// ----------------------------------------------------------------------------
var WF03_PERSISTENCE_COLUMNS = [
  'qualification_id', 'lead_key', 'prospect_row_ids', 'business_name', 'website_url', 'evaluated_at',
  'rules_version', 'rules_digest', 'evidence_fingerprint', 'run_mode', 'classification', 'priority_label',
  'score', 'score_components', 'caps_applied', 'traceability_status', 'is_test_data', 'requires_review',
  'review_reasons', 'exclusion_reason', 'verified_findings', 'hypotheses_assessment', 'service_fit',
  'warnings', 'commercial_signals', 'commercial_use_allowed', 'primary_audit_id', 'source_audit_ids',
  'evidence_refs', 'input_snapshot', 'explanation', 'supersedes_qualification_id', 'previous_classification',
  'workflow_execution_id'
];

function wf03BuildPersistenceRecord(ev, ctx) {
  var j = function (v) { return JSON.stringify(v === undefined ? null : v); };
  return {
    qualification_id: ev.qualification_id,
    lead_key: ev.lead_key,
    prospect_row_ids: j(ev.prospect_row_ids),
    business_name: ev.business_name || '',
    website_url: ev.website_url || '',
    evaluated_at: ev.evaluated_at,
    rules_version: ev.rules_version,
    rules_digest: ev.rules_digest,
    evidence_fingerprint: ev.evidence_fingerprint,
    run_mode: ev.run_mode,
    classification: ev.classification,
    priority_label: ev.priority_label,
    score: ev.score,
    score_components: j(ev.score_components),
    caps_applied: j(ev.caps_applied),
    traceability_status: ev.traceability_status,
    is_test_data: ev.is_test_data,
    requires_review: ev.requires_review,
    review_reasons: j(ev.review_reasons),
    exclusion_reason: ev.exclusion_reason || '',
    verified_findings: j(ev.verified_findings),
    hypotheses_assessment: j(ev.hypotheses_assessment),
    service_fit: j(ev.service_fit),
    warnings: j(ev.warnings),
    commercial_signals: j(ev.commercial_signals),
    commercial_use_allowed: ev.commercial_use_allowed,
    primary_audit_id: ev.primary_audit_id || '',
    source_audit_ids: j(ev.source_audit_ids),
    evidence_refs: j(ev.evidence_refs),
    input_snapshot: j(ev.input_snapshot),
    explanation: ev.explanation || '',
    supersedes_qualification_id: ev.supersedes_qualification_id || '',
    previous_classification: ev.previous_classification || '',
    workflow_execution_id: ctx && ctx.execution_id !== undefined && ctx.execution_id !== null ? String(ctx.execution_id) : ''
  };
}

function wf03ValidatePersistenceRecord(rec) {
  var errs = [];
  ['qualification_id', 'lead_key', 'evaluated_at', 'rules_version', 'rules_digest', 'evidence_fingerprint', 'classification', 'traceability_status', 'run_mode'].forEach(function (k) {
    if (typeof rec[k] !== 'string' || !rec[k]) errs.push('Campo requerido vacío: ' + k);
  });
  if (rec.score !== null && (typeof rec.score !== 'number' || rec.score < 0 || rec.score > 100)) errs.push('score fuera de rango');
  if (['PRIORITY_HIGH', 'PRIORITY_MEDIUM', 'PRIORITY_LOW'].indexOf(rec.classification) !== -1 && rec.score === null) errs.push('Clasificación comercial sin puntuación');
  if (['REVIEW_REQUIRED', 'EXCLUDED_TEST_DATA'].indexOf(rec.classification) !== -1 && rec.score !== null) errs.push('Revisión/exclusión con puntuación');
  if (rec.commercial_use_allowed === true && rec.traceability_status !== 'CONFIRMED_REAL') errs.push('Uso comercial permitido sin trazabilidad confirmada');
  Object.keys(rec).forEach(function (k) { if (WF03_PERSISTENCE_COLUMNS.indexOf(k) === -1) errs.push('Columna no declarada: ' + k); });
  return errs;
}

// ----------------------------------------------------------------------------
// Lote completo
// ----------------------------------------------------------------------------
function wf03QualifyBatch(input) {
  input = input || {};
  var ctx = input.context || {};
  if (typeof ctx.evaluated_at !== 'string' || !isFinite(Date.parse(ctx.evaluated_at))) throw new Error('WF-03 CONFIG ERROR (PERMANENT): context.evaluated_at inválido');
  if (ctx.run_mode !== 'PRODUCTION' && ctx.run_mode !== 'SYNTHETIC_TEST') throw new Error('WF-03 CONFIG ERROR (PERMANENT): context.run_mode inválido: ' + ctx.run_mode);
  var built = wf03BuildRules(input.rules_overrides);
  if (built.errors.length) throw new Error('WF-03 CONFIG ERROR (PERMANENT): ' + built.errors.join('; '));
  var rules = built.rules, digest = built.digest;

  function asArray(v, name) {
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) throw new Error('WF-03 INPUT ERROR (PERMANENT): ' + name + ' no es un array');
    return v;
  }
  var prospects = asArray(input.prospects, 'prospects');
  var audits = asArray(input.audits, 'audits');
  var existing = asArray(input.existing_qualifications, 'existing_qualifications');

  var inputErrors = [];
  var emptyRows = 0;
  var groups = {};
  prospects.forEach(function (row, idx) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) { inputErrors.push({ source: 'prospects', index: idx, row_id: null, error_code: 'ROW_NOT_OBJECT', error_class: 'PERMANENT', detail: 'Fila no es un objeto' }); return; }
    if (Object.keys(row).length === 0) { emptyRows++; return; }
    var lk = row.lead_key;
    if (typeof lk !== 'string' || !lk.trim()) {
      inputErrors.push({ source: 'prospects', index: idx, row_id: row.id === undefined ? null : row.id, error_code: wf03IsBlank(lk) ? 'MISSING_LEAD_KEY' : 'INVALID_LEAD_KEY_TYPE', error_class: 'PERMANENT', detail: 'lead_key canónico ausente o inválido: ' + JSON.stringify(lk === undefined ? null : lk) });
      return;
    }
    (groups[lk] = groups[lk] || []).push(row);
  });

  var auditById = {};
  audits.forEach(function (row, idx) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) { inputErrors.push({ source: 'website_audits', index: idx, row_id: null, error_code: 'ROW_NOT_OBJECT', error_class: 'PERMANENT', detail: 'Fila no es un objeto' }); return; }
    if (Object.keys(row).length === 0) { emptyRows++; return; }
    if (typeof row.audit_id !== 'string' || !row.audit_id.trim()) { inputErrors.push({ source: 'website_audits', index: idx, row_id: row.id === undefined ? null : row.id, error_code: 'MISSING_AUDIT_ID', error_class: 'PERMANENT', detail: 'Auditoría sin audit_id: no puede referenciarse como evidencia' }); return; }
    var key = typeof row.lead_key === 'string' && row.lead_key.trim() ? row.lead_key : (typeof row.prospect_id === 'string' && row.prospect_id.trim() ? row.prospect_id : null);
    if (!key) { inputErrors.push({ source: 'website_audits', index: idx, row_id: row.id === undefined ? null : row.id, error_code: 'MISSING_PROSPECT_REFERENCE', error_class: 'PERMANENT', detail: 'Auditoría ' + row.audit_id + ' sin lead_key ni prospect_id' }); return; }
    var g = auditById[row.audit_id];
    if (!g) g = auditById[row.audit_id] = { key: key, rows: [] };
    g.rows.push(row);
  });

  var auditsByLead = {};
  Object.keys(auditById).sort().forEach(function (id) {
    var g = auditById[id];
    var rows = g.rows.slice().sort(function (x, y) { var t = wf03RowTime(y) - wf03RowTime(x); return t !== 0 ? t : wf03RowIdNum(y) - wf03RowIdNum(x); });
    var dg = {};
    rows.forEach(function (r) { dg[wf03AuditDigest(r)] = true; });
    var keys = {};
    rows.forEach(function (r) { keys[typeof r.lead_key === 'string' && r.lead_key ? r.lead_key : r.prospect_id] = true; });
    var group = { audit: rows[0], count: rows.length, conflict: Object.keys(dg).length > 1 };
    Object.keys(keys).forEach(function (k) { (auditsByLead[k] = auditsByLead[k] || []).push(group); });
  });

  var existingByLead = {};
  existing.forEach(function (r) {
    if (r && typeof r === 'object' && typeof r.lead_key === 'string' && typeof r.qualification_id === 'string') (existingByLead[r.lead_key] = existingByLead[r.lead_key] || []).push(r);
  });

  var evaluations = Object.keys(groups).sort().map(function (lk) {
    return wf03EvaluateProspect(lk, groups[lk], auditsByLead[lk] || [], rules, digest, ctx, existingByLead[lk] || []);
  });

  var orphanAudits = Object.keys(auditsByLead).sort().filter(function (k) { return !groups[k]; }).map(function (k) {
    return { lead_key: k, audit_ids: auditsByLead[k].map(function (g) { return g.audit.audit_id; }), detail: 'Auditoría sin prospecto correspondiente en prospects (no evaluada)' };
  });

  return {
    rules_version: rules.version,
    rules_digest: digest,
    rules: rules,
    evaluations: evaluations,
    input_errors: inputErrors,
    orphan_audits: orphanAudits,
    stats: {
      prospect_rows: prospects.length,
      audit_rows: audits.length,
      existing_qualification_rows: existing.length,
      empty_rows_ignored: emptyRows,
      unique_leads: evaluations.length
    }
  };
}

if (typeof module !== 'undefined' && module && module.exports) {
  module.exports = {
    WF03_RULES_VERSION: WF03_RULES_VERSION,
    WF03_DEFAULT_RULES: WF03_DEFAULT_RULES,
    WF03_PERSISTENCE_COLUMNS: WF03_PERSISTENCE_COLUMNS,
    wf03StableHash: wf03StableHash,
    wf03Canonical: wf03Canonical,
    wf03BuildRules: wf03BuildRules,
    wf03ClampScore: wf03ClampScore,
    wf03ClassifyScore: wf03ClassifyScore,
    wf03ResolveTraceability: wf03ResolveTraceability,
    wf03AnalyzeAudit: wf03AnalyzeAudit,
    wf03BuildPersistenceRecord: wf03BuildPersistenceRecord,
    wf03ValidatePersistenceRecord: wf03ValidatePersistenceRecord,
    wf03QualifyBatch: wf03QualifyBatch
  };
}
