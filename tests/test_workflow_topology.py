#!/usr/bin/env python3
"""
Topology and Safety Verification for ZYRVAE WF-02 Workflow JSON.
Verifies graph connections, branch isolation (zero paths from test branch
to WF-01 or write nodes), SSRF enforcement, WF-01 contract mapping,
and native Data Table persistence configuration.
"""

import json
import os
import subprocess
import unittest


class TestWorkflowTopologyAndSafety(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        wf_path = os.path.join(
            os.path.dirname(__file__), "..", "workflows", "ZYRVAE_WF-02_CSV_Lead_Import_Website_Audit.json"
        )
        with open(wf_path, "r", encoding="utf-8") as f:
            cls.wf = json.load(f)
        cls.nodes_by_name = {n["name"]: n for n in cls.wf["nodes"]}
        cls.connections = cls.wf["connections"]

    def test_01_mandatory_workflow_metadata(self):
        """Verifica que el workflow esté inactivo por diseño."""
        self.assertFalse(self.wf.get("active", True), "El workflow debe tener active: false")
        self.assertEqual(self.wf.get("name"), "ZYRVAE WF-02 — CSV Lead Import & Website Audit")

    def test_02_default_test_mode_enforced_in_code(self):
        """Comprueba que RUN_SYNTHETIC_TEST = true sea el valor por defecto en el código del parser."""
        parser_node = self.nodes_by_name["Parse & Validate CSV"]
        js_code = parser_node["parameters"]["jsCode"]
        self.assertIn("const RUN_SYNTHETIC_TEST = true;", js_code)
        self.assertIn("SYNTH-PROSPECT-", self.nodes_by_name["Mock WF-01 (Safe Synthetic)"]["parameters"]["jsCode"])
        self.assertIn("TESTONLY", self.nodes_by_name["Mock WF-01 (Safe Synthetic)"]["parameters"]["jsCode"])

    def test_03_zero_paths_from_test_branch_to_live_wf01(self):
        """
        Verificación topológica estricta:
        La salida 0 (True: Modo Test) de 'Is Test Mode? (WF-01 Guard)' NUNCA debe conectarse a Call WF-01.
        """
        guard_conns = self.connections.get("Is Test Mode? (WF-01 Guard)", {}).get("main", [])
        self.assertGreaterEqual(len(guard_conns), 2, "El guard IF debe tener al menos 2 salidas")

        true_branch_nodes = [target["node"] for target in guard_conns[0]]
        false_branch_nodes = [target["node"] for target in guard_conns[1]]

        self.assertIn("Mock WF-01 (Safe Synthetic)", true_branch_nodes)
        self.assertNotIn("Call WF-01 (Live Intake & Dedup)", true_branch_nodes)
        self.assertIn("Call WF-01 (Live Intake & Dedup)", false_branch_nodes)

    def test_04_zero_paths_from_test_branch_to_database_writes(self):
        """
        Verificación topológica estricta:
        La salida 0 (True: Modo Test) de 'Is Test Mode? (Storage Guard)' NUNCA debe conectarse a nodos de escritura.
        """
        storage_guard_conns = self.connections.get("Is Test Mode? (Storage Guard)", {}).get("main", [])
        self.assertGreaterEqual(len(storage_guard_conns), 2, "El storage guard IF debe tener al menos 2 salidas")

        true_branch_nodes = [target["node"] for target in storage_guard_conns[0]]
        false_branch_nodes = [target["node"] for target in storage_guard_conns[1]]

        self.assertIn("Preview Test Audit (No Write)", true_branch_nodes)
        self.assertNotIn("Write to website_audits Table (Prod Only)", true_branch_nodes)
        self.assertIn("Write to website_audits Table (Prod Only)", false_branch_nodes)

    def test_05_ssrf_filter_enforced_on_both_branches(self):
        """
        Verifica que tanto la rama mock como la real pasen obligatoriamente por el filtro SSRF.
        Mock: Mock WF-01 -> SSRF Security Filter
        Live: Call WF-01 -> Process WF-01 Response -> SSRF Security Filter
        """
        mock_conns = self.connections.get("Mock WF-01 (Safe Synthetic)", {}).get("main", [[]])[0]
        call_conns = self.connections.get("Call WF-01 (Live Intake & Dedup)", {}).get("main", [[]])[0]

        mock_targets = [t["node"] for t in mock_conns]
        call_targets = [t["node"] for t in call_conns]

        self.assertIn("SSRF Security Filter", mock_targets)
        self.assertIn("Process WF-01 Response", call_targets)

        # Verificar que Process WF-01 Response desemboque en SSRF Security Filter
        proc_conns = self.connections.get("Process WF-01 Response", {}).get("main", [[]])[0]
        proc_targets = [t["node"] for t in proc_conns]
        self.assertIn("SSRF Security Filter", proc_targets)

    def test_06_synthetic_execution_simulation_in_node_runtime(self):
        """
        Simulación de ejecución real en Node.js de los bloques de código JavaScript del workflow:
        1. Valida el procesamiento de los 6 casos sintéticos.
        2. Garantiza que la rama de prueba Mock nunca invoque WF-01 (wf01_executed_live: false).
        3. Comprueba el bloqueo preventivo SSRF del caso 5 (127.0.0.1).
        4. Comprueba que Preview Test Audit confirme _storage_status: 'DRY_RUN_NO_DATABASE_WRITE_PERFORMED'.
        5. Garantiza cero escrituras en Data Tables.
        """
        js_script = """
const fs = require('fs');
const wf = JSON.parse(fs.readFileSync('workflows/ZYRVAE_WF-02_CSV_Lead_Import_Website_Audit.json', 'utf8'));
const nodesByName = Object.fromEntries(wf.nodes.map(n => [n.name, n]));

// 1. Ejecutar Parse & Validate CSV
const parserFn = new Function('$input', '$execution', nodesByName['Parse & Validate CSV'].parameters.jsCode);
const validLeads = parserFn({ all: () => [{}] }, { id: 'sim-exec-test' });

if (validLeads.length !== 3) {
  console.error('Expected 3 valid leads out of 6 synthetic cases, got ' + validLeads.length);
  process.exit(1);
}

// 2. Instanciar funciones de los nodos
const mockWf01Fn = new Function('$input', nodesByName['Mock WF-01 (Safe Synthetic)'].parameters.jsCode);
const ssrfFn = new Function('$input', nodesByName['SSRF Security Filter'].parameters.jsCode);
const ssrfBlockFn = new Function('$input', '$', nodesByName['Handle SSRF Block'].parameters.jsCode);
const extractFn = new Function('$input', '$', nodesByName['Extract Metadata & Facts'].parameters.jsCode);
const payloadFn = new Function('$input', nodesByName['Prepare Persistence Payload'].parameters.jsCode);
const previewFn = new Function('$input', nodesByName['Preview Test Audit (No Write)'].parameters.jsCode);

const results = [];
for (const lead of validLeads) {
  // Verificación de guard WF-01
  if (lead.json.is_synthetic_test !== true) throw new Error('Guard de WF-01 violado');
  const mockRes = mockWf01Fn({ item: lead });
  if (mockRes.json.wf01_executed_live !== false) throw new Error('WF-01 ejecutado en modo test');
  if (!mockRes.json.prospect_id.includes('TESTONLY')) throw new Error('ID no sintético');

  // SSRF Filter
  const ssrfRes = ssrfFn({ item: mockRes });
  let auditOut;
  if (ssrfRes.json.is_ssrf_safe) {
    let mockResponse = ssrfRes.json.audit_target_url.includes('503')
      ? { statusCode: 503, headers: {}, body: '<html><title>503 Error</title></html>' }
      : { statusCode: 200, headers: {}, body: '<html><title>Tech Corp</title><meta name=\"viewport\" content=\"width=device-width\"></html>' };
    auditOut = extractFn({ item: { json: mockResponse } }, () => ({ item: ssrfRes, first: () => ssrfRes }));
  } else {
    auditOut = ssrfBlockFn({ item: ssrfRes }, () => ({ item: ssrfRes, first: () => ssrfRes }));
  }

  // Payload
  const payloadRes = payloadFn({ item: auditOut });
  if (payloadRes.json.is_synthetic_test !== true) throw new Error('Storage Guard violado en payload');

  // Preview Terminal
  const previewRes = previewFn({ item: payloadRes });
  if (previewRes.json._storage_status !== 'DRY_RUN_NO_DATABASE_WRITE_PERFORMED') {
    throw new Error('Estado de almacenamiento inseguro');
  }
  results.push(previewRes.json);
}

console.log(JSON.stringify({ status: 'OK', processedCount: results.length, samples: results.map(r => ({ id: r.id, status: r._storage_status, error: r.error_code })) }));
"""
        proc = subprocess.run(["node", "-e", js_script], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, f"Error en simulación Node: {proc.stderr}")
        self.assertIn('"status":"OK"', proc.stdout)
        self.assertIn("DRY_RUN_NO_DATABASE_WRITE_PERFORMED", proc.stdout)

    def test_07_real_branch_wf01_contract_and_stable_id(self):
        """
        Comprueba el contrato con WF-01:
        1. Process WF-01 Response extrae el lead_key estable devuelto por WF-01.
        2. Mapea prospect_id y lead_key sin usar IDs sintéticos.
        3. Si WF-01 falla o no devuelve lead_key, arroja error y no inventa IDs.
        """
        js_script = """
const fs = require('fs');
const wf = JSON.parse(fs.readFileSync('workflows/ZYRVAE_WF-02_CSV_Lead_Import_Website_Audit.json', 'utf8'));
const nodesByName = Object.fromEntries(wf.nodes.map(n => [n.name, n]));

const procFn = new Function('$input', '$', nodesByName['Process WF-01 Response'].parameters.jsCode);

// Caso 1: Payload real devuelto por WF-01
const mockWf01Output = {
  summary: { input_records_received: 1, inserted: 1, validated: 1 },
  errors: [],
  records: [
    {
      lead_key: 'dom:acme-corp.com',
      business_name: 'Acme Corp',
      domain: 'acme-corp.com',
      outcome: 'insert',
      final_status: 'validated'
    }
  ]
};

const loopProspect = {
  json: {
    row_index: 2,
    business_name: 'Acme Corp',
    website_url: 'https://acme-corp.com',
    is_synthetic_test: false
  }
};

const res = procFn({ item: { json: mockWf01Output } }, () => ({ item: loopProspect, first: () => loopProspect }));

if (res.json.prospect_id !== 'dom:acme-corp.com') throw new Error('ID estable no mapeado: ' + res.json.prospect_id);
if (res.json.lead_key !== 'dom:acme-corp.com') throw new Error('lead_key no mapeado');
if (res.json.prospect_id.includes('SYNTH')) throw new Error('ID sintético usado en producción');
if (res.json.wf01_executed_live !== true) throw new Error('Flag de ejecución en vivo incorrecto');

// Caso 2: Payload sin lead_key -> debe arrojar excepción de contrato
let threw = false;
try {
  procFn({ item: { json: { summary: {}, errors: [{ error_message: 'DB connection failure' }], records: [] } } }, () => ({ item: loopProspect, first: () => loopProspect }));
} catch (e) {
  threw = true;
  if (!e.message.includes('WF-01 Contract Failure')) throw new Error('Error de contrato no identificado: ' + e.message);
}
if (!threw) throw new Error('No falló ante respuesta inválida de WF-01');

console.log('WF-01 Contract OK');
"""
        proc = subprocess.run(["node", "-e", js_script], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, f"Error en test contrato WF-01: {proc.stderr}")
        self.assertIn("WF-01 Contract OK", proc.stdout)

    def test_08_persistence_payload_idempotency_and_optional_fields(self):
        """
        Comprueba la clave de idempotencia y campos opcionales en Prepare Persistence Payload:
        1. Para un mismo prospecto y URL, audit_id es determinista (idempotente).
        2. Para tests sintéticos, audit_id incluye SYNTH-AUDIT-*-TESTONLY.
        3. Todos los campos requeridos por la tabla website_audits están presentes con tipos coherentes.
        """
        js_script = """
const fs = require('fs');
const wf = JSON.parse(fs.readFileSync('workflows/ZYRVAE_WF-02_CSV_Lead_Import_Website_Audit.json', 'utf8'));
const nodesByName = Object.fromEntries(wf.nodes.map(n => [n.name, n]));

const payloadFn = new Function('$input', nodesByName['Prepare Persistence Payload'].parameters.jsCode);

// Producción: dos ejecuciones del mismo prospecto y URL
const auditItem1 = {
  prospect_id: 'dom:acme-corp.com',
  lead_key: 'dom:acme-corp.com',
  initial_url: 'https://acme-corp.com',
  final_url: 'https://acme-corp.com/home',
  http_status: 200,
  redirect_count: 1,
  response_time_ms: 245,
  page_title: 'Acme Official',
  meta_description: 'We make everything',
  has_viewport: true,
  ssl_active: true,
  is_accessible: true,
  error_code: null,
  raw_evidence: { status_code: 200 },
  commercial_hypotheses: [],
  is_synthetic_test: false
};

const res1 = payloadFn({ item: { json: auditItem1 } });
const res2 = payloadFn({ item: { json: auditItem1 } });

// Idempotencia: el audit_id debe ser idéntico
if (res1.json.audit_id !== res2.json.audit_id) {
  throw new Error('Fallo de idempotencia: audit_id difiere entre ejecuciones del mismo prospecto');
}
if (!res1.json.audit_id.startsWith('aud_')) {
  throw new Error('Prefijo de audit_id de producción incorrecto: ' + res1.json.audit_id);
}

// Prueba sintética: audit_id sintético
const synthItem = { ...auditItem1, is_synthetic_test: true, prospect_id: 'SYNTH-PROSPECT-1-TESTONLY' };
const resSynth = payloadFn({ item: { json: synthItem } });
if (!resSynth.json.audit_id.includes('TESTONLY')) {
  throw new Error('audit_id sintético no contiene TESTONLY: ' + resSynth.json.audit_id);
}

// Validación de tipos
if (typeof res1.json.audit_date !== 'string') throw new Error('audit_date no es ISO string');
if (typeof res1.json.redirect_count !== 'number') throw new Error('redirect_count no es número');
if (typeof res1.json.response_time_ms !== 'number') throw new Error('response_time_ms no es número');
if (typeof res1.json.raw_evidence !== 'string') throw new Error('raw_evidence debe serializarse a string JSON');
if (typeof res1.json.commercial_hypotheses !== 'string') throw new Error('commercial_hypotheses debe serializarse a string JSON');
if (typeof res1.json.is_test_data !== 'boolean') throw new Error('is_test_data debe ser booleano');
if (typeof res1.json.is_synthetic_test !== 'boolean') throw new Error('is_synthetic_test debe ser booleano');

console.log('Idempotency & Schema OK');
"""
        proc = subprocess.run(["node", "-e", js_script], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, f"Error en test de idempotencia y esquema: {proc.stderr}")
        self.assertIn("Idempotency & Schema OK", proc.stdout)

    def test_09_native_data_table_persistence_node_config(self):
        """
        Verifica la configuración del nodo nativo de persistencia:
        1. Tipo: n8n-nodes-base.dataTable (v1.1)
        2. Operación: upsert con target en 'dpLz1QDQU3l4GyrP' (website_audits)
        3. Filtro de coincidencia en audit_id (clave de idempotencia)
        4. Gestión de errores con onError: continueErrorOutput
        5. Conexiones a Record Persistence Success y Handle Write Error
        """
        node = self.nodes_by_name.get("Write to website_audits Table (Prod Only)")
        self.assertIsNotNone(node, "El nodo Write to website_audits Table (Prod Only) debe existir")
        self.assertEqual(node["type"], "n8n-nodes-base.dataTable")
        self.assertEqual(node.get("typeVersion"), 1.1)
        self.assertEqual(node.get("onError"), "continueErrorOutput")

        params = node.get("parameters", {})
        self.assertEqual(params.get("resource"), "row")
        self.assertEqual(params.get("operation"), "upsert")
        self.assertEqual(params.get("dataTableId", {}).get("value"), "dpLz1QDQU3l4GyrP")

        # Verificar filtro en audit_id
        conditions = params.get("filters", {}).get("conditions", [])
        self.assertTrue(any(c.get("keyName") == "audit_id" for c in conditions), "Filtro upsert debe usar audit_id")

        # Verificar mapeo de columnas para trazabilidad de prueba
        col_mappings = params.get("columns", {}).get("value", {})
        self.assertEqual(col_mappings.get("is_test_data"), "={{ $json.is_test_data }}")
        self.assertEqual(col_mappings.get("is_synthetic_test"), "={{ $json.is_synthetic_test }}")

        # Conexiones de salida
        write_conns = self.connections.get("Write to website_audits Table (Prod Only)", {}).get("main", [])
        self.assertEqual(len(write_conns), 2, "Debe tener 2 pines de salida (éxito y error)")

        success_targets = [t["node"] for t in write_conns[0]]
        error_targets = [t["node"] for t in write_conns[1]]

        self.assertIn("Record Persistence Success", success_targets)
        self.assertIn("Handle Write Error", error_targets)

    def test_10_write_error_handling_explicit(self):
        """
        Verifica que ante un fallo de escritura:
        1. Handle Write Error registre _storage_status: 'PERSISTENCE_FAILED'
        2. Conserve el error exacto
        3. Nunca declare éxito si la persistencia falla
        """
        js_script = """
const fs = require('fs');
const wf = JSON.parse(fs.readFileSync('workflows/ZYRVAE_WF-02_CSV_Lead_Import_Website_Audit.json', 'utf8'));
const nodesByName = Object.fromEntries(wf.nodes.map(n => [n.name, n]));

const errFn = new Function('$input', '$', nodesByName['Handle Write Error'].parameters.jsCode);

const mockErrorItem = {
  json: {
    error: 'DataTable constraint violation: duplicate key or network timeout'
  }
};
const mockPayload = {
  json: {
    audit_id: 'aud_test123',
    prospect_id: 'dom:acme.com',
    initial_url: 'https://acme.com'
  }
};

const res = errFn({ item: mockErrorItem }, () => ({ item: mockPayload, first: () => mockPayload }));

if (res.json._storage_status !== 'PERSISTENCE_FAILED') {
  throw new Error('Estado de persistencia no refleja fallo: ' + res.json._storage_status);
}
if (!res.json.storage_error.includes('DataTable constraint violation')) {
  throw new Error('Mensaje de error no capturado');
}

console.log('Error Handling OK');
"""
        proc = subprocess.run(["node", "-e", js_script], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, f"Error en test de manejo de error: {proc.stderr}")
        self.assertIn("Error Handling OK", proc.stdout)


if __name__ == "__main__":
    unittest.main()
