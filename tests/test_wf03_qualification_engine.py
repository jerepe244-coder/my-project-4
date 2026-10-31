"""
ZYRVAE WF-03 — Lead Qualification & Prioritization Test Suite
Pruebas automatizadas de lógica, trazabilidad, contratos e integridad topológica del workflow WF-03.
Utiliza exclusivamente datos sintéticos aislados.
"""

import json
import os
import subprocess
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
ENGINE_PATH = ROOT_DIR / "scripts" / "wf03" / "qualification_engine.js"
WORKFLOW_PATH = ROOT_DIR / "workflows" / "ZYRVAE_WF-03_Lead_Qualification_Prioritization.json"
SQL_PATH = ROOT_DIR / "sql" / "003_create_lead_qualifications_table.sql"


class TestWF03QualificationEngine(unittest.TestCase):
    """Pruebas del motor puro de calificación y trazabilidad (scripts/wf03/qualification_engine.js)."""

    def run_engine_batch(self, payload):
        """Ejecuta wf03QualifyBatch con el payload indicado a través de Node.js."""
        script = f"""
        const engine = require('{ENGINE_PATH.as_posix()}');
        const input = {json.dumps(payload)};
        const res = engine.wf03QualifyBatch(input);
        console.log(JSON.stringify(res));
        """
        proc = subprocess.run(
            ["node", "-e", script],
            capture_output=True,
            text=True,
            check=True
        )
        return json.loads(proc.stdout)

    def test_prospecto_valido_con_auditoria_valida(self):
        """Escenario 1: Prospecto válido con auditoría fresca y hallazgo técnico NO_HTTPS."""
        now = "2026-10-31T12:00:00.000Z"
        payload = {
            "context": {"evaluated_at": now, "run_mode": "PRODUCTION"},
            "rules_overrides": {"confirmed_service_codes": ["WEB_SECURITY_SSL"]},
            "prospects": [{
                "id": "row-1", "lead_key": "prod-lead-1", "business_name": "Acme Legal",
                "website_url": "http://acme-legal.com", "country": "ES", "industry": "Legal",
                "status": "validated", "is_test_data": False, "is_synthetic_test": False,
                "traceability_status": "CONFIRMED_REAL"
            }],
            "audits": [{
                "audit_id": "aud-1", "lead_key": "prod-lead-1", "prospect_id": "prod-lead-1",
                "audit_date": now, "initial_url": "http://acme-legal.com", "final_url": "http://acme-legal.com",
                "http_status": 200, "is_accessible": True, "ssl_active": False, "has_viewport": True,
                "response_time_ms": 300, "is_synthetic_test": False, "is_test_data": False,
                "raw_evidence": json.dumps({
                    "analysis_verifiable": True,
                    "feature_status": {"viewport": "FOUND", "meta_description": "FOUND", "page_title": "FOUND"},
                    "traceability": {"is_test_data": False, "is_synthetic_test": False, "traceability_status": "CONFIRMED_REAL"}
                })
            }]
        }
        res = self.run_engine_batch(payload)
        ev = res["evaluations"][0]
        self.assertEqual(ev["classification"], "PRIORITY_MEDIUM")
        self.assertEqual(ev["score"], 67)
        self.assertTrue(ev["commercial_use_allowed"])
        self.assertEqual(ev["traceability_status"], "CONFIRMED_REAL")
        self.assertFalse(ev["requires_review"])

    def test_prospecto_incompleto(self):
        """Escenario 2: Prospecto sin website_url o status no validated -> REVIEW_REQUIRED."""
        now = "2026-10-31T12:00:00.000Z"
        payload = {
            "context": {"evaluated_at": now, "run_mode": "PRODUCTION"},
            "prospects": [
                {"lead_key": "inc-1", "business_name": "No Web", "website_url": "", "status": "validated", "is_test_data": False, "traceability_status": "CONFIRMED_REAL"},
                {"lead_key": "inc-2", "business_name": "Pending", "website_url": "https://ok.com", "status": "draft", "is_test_data": False, "traceability_status": "CONFIRMED_REAL"}
            ],
            "audits": []
        }
        res = self.run_engine_batch(payload)
        ev1, ev2 = res["evaluations"]
        self.assertEqual(ev1["classification"], "REVIEW_REQUIRED")
        self.assertIsNone(ev1["score"])
        self.assertTrue(any(r["code"] == "MISSING_WEBSITE_URL" for r in ev1["review_reasons"]))

        self.assertEqual(ev2["classification"], "REVIEW_REQUIRED")
        self.assertIsNone(ev2["score"])
        self.assertTrue(any(r["code"] == "PROSPECT_NOT_VALIDATED" for r in ev2["review_reasons"]))

    def test_auditoria_inexistente(self):
        """Escenario 3: Prospecto sin auditoría correspondiente -> REVIEW_REQUIRED."""
        now = "2026-10-31T12:00:00.000Z"
        payload = {
            "context": {"evaluated_at": now, "run_mode": "PRODUCTION"},
            "prospects": [{"lead_key": "no-aud", "business_name": "No Audit", "website_url": "https://noaud.com", "status": "validated", "is_test_data": False, "traceability_status": "CONFIRMED_REAL"}],
            "audits": []
        }
        res = self.run_engine_batch(payload)
        ev = res["evaluations"][0]
        self.assertEqual(ev["classification"], "REVIEW_REQUIRED")
        self.assertTrue(any(r["code"] == "NO_AUDIT_EVIDENCE" for r in ev["review_reasons"]))

    def test_auditoria_vencida(self):
        """Escenario 4: Auditoría > 180 días -> AUDIT_STALE."""
        now = "2026-10-31T12:00:00.000Z"
        stale_date = "2026-03-01T12:00:00.000Z"
        payload = {
            "context": {"evaluated_at": now, "run_mode": "PRODUCTION"},
            "prospects": [{"lead_key": "stale", "business_name": "Old", "website_url": "http://old.com", "status": "validated", "is_test_data": False, "traceability_status": "CONFIRMED_REAL"}],
            "audits": [{
                "audit_id": "aud-stale", "lead_key": "stale", "prospect_id": "stale", "audit_date": stale_date,
                "initial_url": "http://old.com", "final_url": "http://old.com", "http_status": 200, "is_accessible": True,
                "raw_evidence": json.dumps({"analysis_verifiable": True, "feature_status": {"viewport": "FOUND", "meta_description": "FOUND", "page_title": "FOUND"}})
            }]
        }
        res = self.run_engine_batch(payload)
        ev = res["evaluations"][0]
        self.assertEqual(ev["classification"], "REVIEW_REQUIRED")
        self.assertTrue(any(r["code"] == "AUDIT_STALE" for r in ev["review_reasons"]))

    def test_datos_de_prueba_y_trazabilidad(self):
        """Escenarios 6, 7, 8, 9: Marcas de prueba, nulas, desconocidas y contradictorias."""
        now = "2026-10-31T12:00:00.000Z"
        payload = {
            "context": {"evaluated_at": now, "run_mode": "PRODUCTION"},
            "prospects": [
                # Explícito test
                {"lead_key": "synth-t1", "business_name": "Test Co", "website_url": "http://test.com", "status": "validated", "is_test_data": True},
                # Desconocido
                {"lead_key": "unk-t2", "business_name": "Unk Co", "website_url": "http://unk.com", "status": "validated", "is_test_data": None, "traceability_status": "UNKNOWN_TRACEABILITY"},
                # Nulo (sin confirmar)
                {"lead_key": "null-t3", "business_name": "Null Co", "website_url": "http://null.com", "status": "validated"},
                # Contradictorio
                {"lead_key": "contra-t4", "business_name": "Contra Co", "website_url": "http://contra.com", "status": "validated", "is_test_data": True, "traceability_status": "CONFIRMED_REAL"}
            ],
            "audits": []
        }
        res = self.run_engine_batch(payload)
        by_key = {e["lead_key"]: e for e in res["evaluations"]}
        ev_test = by_key["synth-t1"]
        ev_unk = by_key["unk-t2"]
        ev_null = by_key["null-t3"]
        ev_contra = by_key["contra-t4"]

        self.assertEqual(ev_test["classification"], "EXCLUDED_TEST_DATA")
        self.assertEqual(ev_test["traceability_status"], "TEST_DATA")
        self.assertFalse(ev_test["commercial_use_allowed"])

        self.assertEqual(ev_unk["classification"], "REVIEW_REQUIRED")
        self.assertEqual(ev_unk["traceability_status"], "UNKNOWN_TRACEABILITY")
        self.assertFalse(ev_unk["commercial_use_allowed"])

        self.assertEqual(ev_null["classification"], "REVIEW_REQUIRED")
        self.assertEqual(ev_null["traceability_status"], "UNKNOWN_TRACEABILITY")
        self.assertFalse(ev_null["commercial_use_allowed"])

        self.assertEqual(ev_contra["classification"], "REVIEW_REQUIRED")
        self.assertEqual(ev_contra["traceability_status"], "CONTRADICTORY_TRACEABILITY")
        self.assertFalse(ev_contra["commercial_use_allowed"])

    def test_idempotencia_y_reintentos(self):
        """Escenario 11: Mismo prospecto con misma evidencia produce NOOP; nueva evidencia produce UPSERT."""
        now = "2026-10-31T12:00:00.000Z"
        p = {"lead_key": "idemp-lead", "business_name": "Idemp", "website_url": "http://idemp.com", "status": "validated", "is_test_data": False, "traceability_status": "CONFIRMED_REAL"}
        a = {
            "audit_id": "aud-idemp", "lead_key": "idemp-lead", "prospect_id": "idemp-lead", "audit_date": now,
            "initial_url": "http://idemp.com", "final_url": "http://idemp.com", "http_status": 200, "is_accessible": True,
            "raw_evidence": json.dumps({"analysis_verifiable": True, "feature_status": {"viewport": "FOUND", "meta_description": "FOUND", "page_title": "FOUND"}})
        }
        res1 = self.run_engine_batch({
            "context": {"evaluated_at": now, "run_mode": "PRODUCTION"},
            "prospects": [p], "audits": [a], "existing_qualifications": []
        })
        qid = res1["evaluations"][0]["qualification_id"]
        self.assertEqual(res1["evaluations"][0]["persistence_action"], "UPSERT")

        # Re-run con el registro previo en existing_qualifications
        res2 = self.run_engine_batch({
            "context": {"evaluated_at": now, "run_mode": "PRODUCTION"},
            "prospects": [p], "audits": [a],
            "existing_qualifications": [{"qualification_id": qid, "lead_key": "idemp-lead", "evaluated_at": now, "classification": "PRIORITY_LOW"}]
        })
        self.assertEqual(res2["evaluations"][0]["persistence_action"], "NOOP_UNCHANGED")

    def test_limites_scoring_y_umbrales(self):
        """Escenarios 14 y 15: Límites [0, 100] y umbrales de prioridad."""
        script = f"""
        const engine = require('{ENGINE_PATH.as_posix()}');
        const r = engine.WF03_DEFAULT_RULES;
        console.log(JSON.stringify({{
            clamped_neg: engine.wf03ClampScore(-15, r),
            clamped_over: engine.wf03ClampScore(150, r),
            class_high: engine.wf03ClassifyScore(70, r),
            class_med: engine.wf03ClassifyScore(45, r),
            class_low: engine.wf03ClassifyScore(44, r)
        }}));
        """
        proc = subprocess.run(["node", "-e", script], capture_output=True, text=True, check=True)
        data = json.loads(proc.stdout)
        self.assertEqual(data["clamped_neg"], 0)
        self.assertEqual(data["clamped_over"], 100)
        self.assertEqual(data["class_high"], "PRIORITY_HIGH")
        self.assertEqual(data["class_med"], "PRIORITY_MEDIUM")
        self.assertEqual(data["class_low"], "PRIORITY_LOW")


class TestWF03WorkflowTopology(unittest.TestCase):
    """Pruebas de topología y aislamiento del archivo de workflow n8n."""

    def setUp(self):
        self.assertTrue(WORKFLOW_PATH.exists(), f"Workflow no encontrado en {WORKFLOW_PATH}")
        with open(WORKFLOW_PATH, "r", encoding="utf-8") as f:
            self.wf = json.load(f)

    def test_workflow_active_state_is_strictly_false(self):
        """Garantía operativa: WF-03 DEBE permanecer con active = false."""
        self.assertFalse(self.wf.get("active", True), "WF-03 debe estar inactivo (active: false)")

    def test_run_synthetic_test_defaults_to_true(self):
        """Garantía de aislamiento: Configure & Intake Candidates debe tener RUN_SYNTHETIC_TEST = true por defecto."""
        intake_node = next((n for n in self.wf["nodes"] if n["name"] == "Configure & Intake Candidates"), None)
        self.assertIsNotNone(intake_node)
        js_code = intake_node["parameters"].get("jsCode", "")
        self.assertIn("RUN_SYNTHETIC_TEST = true", js_code)

    def test_storage_guard_isolates_test_mode(self):
        """Garantía de persistencia: Storage Guard desvía el modo test exclusivamente a Preview (0 caminos a escritura)."""
        connections = self.wf.get("connections", {})
        guard_conn = connections.get("Is Test Mode? (Storage Guard)", {}).get("main", [])
        self.assertEqual(len(guard_conn), 2, "Storage guard debe tener 2 ramas (true/false)")

        true_branch = guard_conn[0]
        false_branch = guard_conn[1]

        # La rama true va a Preview Test Qualifications (No Write)
        self.assertEqual(true_branch[0]["node"], "Preview Test Qualifications (No Write)")
        # La rama false va al filtro de persistencia
        self.assertEqual(false_branch[0]["node"], "Filter Valid Persistable Records")

    def test_persistence_error_handling(self):
        """Garantía de manejo de errores: el nodo DataTable debe contar con onError: continueErrorOutput."""
        datatable_node = next((n for n in self.wf["nodes"] if n["name"] == "Write to lead_qualifications Table (Prod Only)"), None)
        self.assertIsNotNone(datatable_node)
        self.assertEqual(datatable_node.get("onError"), "continueErrorOutput")

        connections = self.wf.get("connections", {})
        dt_conn = connections.get("Write to lead_qualifications Table (Prod Only)", {}).get("main", [])
        self.assertEqual(len(dt_conn), 2, "DataTable node debe bifurcar en éxito y error")
        self.assertEqual(dt_conn[0][0]["node"], "Record Persistence Success")
        self.assertEqual(dt_conn[1][0]["node"], "Handle Persistence Error")


class TestWF03SchemaCompatibility(unittest.TestCase):
    """Pruebas de correspondencia entre el DDL SQL y las columnas declaradas en el motor."""

    def test_sql_ddl_covers_all_persistence_columns(self):
        """Verifica que sql/003_create_lead_qualifications_table.sql contenga todas las columnas del motor."""
        self.assertTrue(SQL_PATH.exists(), f"SQL DDL no encontrado en {SQL_PATH}")
        with open(SQL_PATH, "r", encoding="utf-8") as f:
            sql_content = f.read().lower()

        script = f"""
        const engine = require('{ENGINE_PATH.as_posix()}');
        console.log(JSON.stringify(engine.WF03_PERSISTENCE_COLUMNS));
        """
        proc = subprocess.run(["node", "-e", script], capture_output=True, text=True, check=True)
        columns = json.loads(proc.stdout)

        for col in columns:
            self.assertIn(col.lower(), sql_content, f"Columna {col} declarada en el motor no existe en el DDL SQL")


if __name__ == "__main__":
    unittest.main()
