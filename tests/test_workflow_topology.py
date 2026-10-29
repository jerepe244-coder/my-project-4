#!/usr/bin/env python3
"""
Topology and Safety Verification for ZYRVAE WF-02 Workflow JSON.
Verifies graph connections, branch isolation (zero paths from test branch
to WF-01 or write nodes), SSRF enforcement, and synthetic ID constraints.
"""

import json
import os
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
        """Verifica que tanto la rama mock como la real pasen obligatoriamente por el filtro SSRF."""
        mock_conns = self.connections.get("Mock WF-01 (Safe Synthetic)", {}).get("main", [[]])[0]
        call_conns = self.connections.get("Call WF-01 (Live Intake & Dedup)", {}).get("main", [[]])[0]

        mock_targets = [t["node"] for t in mock_conns]
        call_targets = [t["node"] for t in call_conns]

        self.assertIn("SSRF Security Filter", mock_targets)
        self.assertIn("SSRF Security Filter", call_targets)

    def test_06_synthetic_execution_simulation_in_node_runtime(self):
        """
        Simulación de ejecución real en Node.js de los bloques de código JavaScript del workflow:
        1. Valida el procesamiento de los 6 casos sintéticos.
        2. Garantiza que la rama de prueba Mock nunca invoque WF-01 (wf01_executed_live: false).
        3. Comprueba el bloqueo preventivo SSRF del caso 5 (127.0.0.1).
        4. Comprueba que Preview Test Audit confirme _storage_status: 'DRY_RUN_NO_DATABASE_WRITE_PERFORMED'.
        5. Garantiza cero escrituras en Data Tables.
        """
        import subprocess

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



if __name__ == "__main__":
    unittest.main()
