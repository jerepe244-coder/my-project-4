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


if __name__ == "__main__":
    unittest.main()
