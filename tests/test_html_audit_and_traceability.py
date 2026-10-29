#!/usr/bin/env python3
"""
Isolated Test Suite for HTML Audit Integrity and Test Data Traceability.
Verifies the 5 specific HTML audit cases:
1. Valid HTML with viewport and meta description.
2. Valid HTML without viewport and meta description.
3. Empty body response.
4. Non-HTML response (JSON / API).
5. HTTP error response (503 Service Unavailable).

Also verifies the full traceability matrix:
- Explicit test flag propagation (is_test_data: true with is_synthetic_test: false).
- Synthetic test mode propagation.
- Defensive pattern matching for missing indicators.
- Explicit real leads and missing indicator fallback.
- Idempotency and persistence payload structure with is_test_data column.
"""

import json
import os
import subprocess
import unittest


class TestHtmlAuditAndTraceability(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        wf_path = os.path.join(
            os.path.dirname(__file__), "..", "workflows", "ZYRVAE_WF-02_CSV_Lead_Import_Website_Audit.json"
        )
        with open(wf_path, "r", encoding="utf-8") as f:
            cls.wf = json.load(f)
        cls.nodes_by_name = {n["name"]: n for n in cls.wf["nodes"]}

    def _execute_extract_node(self, http_response, prospect_data):
        """Helper executing Extract Metadata & Facts inside isolated Node.js runtime."""
        js_code = self.nodes_by_name["Extract Metadata & Facts"]["parameters"]["jsCode"]
        wrapper = f"""
const extractFn = new Function('$input', '$', {json.dumps(js_code)});
const itemInput = {{ item: {{ json: {json.dumps(http_response)} }} }};
const prospectInput = {{ item: {{ json: {json.dumps(prospect_data)} }}, first: () => ({{ json: {json.dumps(prospect_data)} }}) }};
const result = extractFn(itemInput, () => prospectInput);
console.log(JSON.stringify(result.json));
"""
        proc = subprocess.run(["node", "-e", wrapper], capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError(f"Node execution error: {proc.stderr}")
        return json.loads(proc.stdout)

    def _execute_payload_node(self, audit_item):
        """Helper executing Prepare Persistence Payload inside isolated Node.js runtime."""
        js_code = self.nodes_by_name["Prepare Persistence Payload"]["parameters"]["jsCode"]
        wrapper = f"""
const payloadFn = new Function('$input', {json.dumps(js_code)});
const itemInput = {{ item: {{ json: {json.dumps(audit_item)} }} }};
const result = payloadFn(itemInput);
console.log(JSON.stringify(result.json));
"""
        proc = subprocess.run(["node", "-e", wrapper], capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError(f"Node execution error: {proc.stderr}")
        return json.loads(proc.stdout)

    # --------------------------------------------------------------------------
    # 1. HTML Audit Integrity Tests (5 Cases)
    # --------------------------------------------------------------------------

    def test_case_01_valid_html_with_viewport_and_description(self):
        """
        Caso 1: HTML válido con viewport y meta description.
        - Debe calcular content_length > 0
        - Debe detectar viewport (FOUND, has_viewport: true)
        - Debe extraer page_title y meta_description (FOUND)
        - analysis_verifiable: true
        - CERO hipótesis de MOBILE_RESPONSIVE o SEO_ONPAGE (sin falsos positivos)
        """
        html = """<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Acme Corporation | Soluciones Globales</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Líder en servicios y tecnología de vanguardia para empresas.">
</head>
<body><h1>Bienvenido a Acme</h1></body>
</html>"""
        http_resp = {
            "statusCode": 200,
            "headers": {
                "content-type": "text/html; charset=UTF-8",
                "server": "nginx"
            },
            "data": html
        }
        prospect = {
            "prospect_id": "dom:acme-corp.com",
            "lead_key": "dom:acme-corp.com",
            "audit_target_url": "https://acme-corp.com",
            "is_test_data": True,
            "is_synthetic_test": False
        }

        res = self._execute_extract_node(http_resp, prospect)

        self.assertTrue(res["is_accessible"])
        self.assertEqual(res["http_status"], 200)
        self.assertTrue(res["has_viewport"])
        self.assertEqual(res["page_title"], "Acme Corporation | Soluciones Globales")
        self.assertEqual(res["meta_description"], "Líder en servicios y tecnología de vanguardia para empresas.")

        raw_ev = res["raw_evidence"]
        self.assertGreater(raw_ev["content_length"], 0)
        self.assertTrue(raw_ev["analysis_verifiable"])
        self.assertIsNone(raw_ev["unverifiable_reason"])
        self.assertEqual(raw_ev["feature_status"]["viewport"], "FOUND")
        self.assertEqual(raw_ev["feature_status"]["meta_description"], "FOUND")
        self.assertEqual(raw_ev["feature_status"]["page_title"], "FOUND")

        categories = [h["category"] for h in res["commercial_hypotheses"]]
        self.assertNotIn("MOBILE_RESPONSIVE", categories, "Falso positivo: generó MOBILE_RESPONSIVE cuando sí existe viewport")
        self.assertNotIn("SEO_ONPAGE", categories, "Falso positivo: generó SEO_ONPAGE cuando sí existe meta description")
        self.assertNotIn("SITE_HEALTH", categories)

    def test_case_02_valid_html_without_viewport_and_description(self):
        """
        Caso 2: HTML válido sin viewport y sin meta description.
        - analysis_verifiable: true
        - viewport_status: PROVEN_ABSENT, has_viewport: false
        - meta_desc_status: PROVEN_ABSENT, meta_description: ''
        - SÍ debe generar hipótesis comerciales por ausencia comprobada
        """
        html = """<!doctype html>
<html>
<head>
    <title>Sitio Simple Sin Optimizar</title>
</head>
<body><p>Contenido sin tags de optimización moderna.</p></body>
</html>"""
        http_resp = {
            "statusCode": 200,
            "headers": {
                "content-type": "text/html; charset=UTF-8"
            },
            "data": html
        }
        prospect = {
            "prospect_id": "dom:sitio-viejo.com",
            "lead_key": "dom:sitio-viejo.com",
            "audit_target_url": "https://sitio-viejo.com",
            "is_test_data": False,
            "is_synthetic_test": False
        }

        res = self._execute_extract_node(http_resp, prospect)

        self.assertTrue(res["is_accessible"])
        self.assertFalse(res["has_viewport"])
        self.assertEqual(res["page_title"], "Sitio Simple Sin Optimizar")
        self.assertEqual(res["meta_description"], "")

        raw_ev = res["raw_evidence"]
        self.assertTrue(raw_ev["analysis_verifiable"])
        self.assertEqual(raw_ev["feature_status"]["viewport"], "PROVEN_ABSENT")
        self.assertEqual(raw_ev["feature_status"]["meta_description"], "PROVEN_ABSENT")

        categories = [h["category"] for h in res["commercial_hypotheses"]]
        self.assertIn("MOBILE_RESPONSIVE", categories, "Debe generar hipótesis de ausencia comprobada de viewport")
        self.assertIn("SEO_ONPAGE", categories, "Debe generar hipótesis de ausencia comprobada de meta description")

    def test_case_03_empty_body_response(self):
        """
        Caso 3: Respuesta con cuerpo vacío (200 OK pero body vacío).
        - content_length = 0
        - analysis_verifiable: false
        - unverifiable_reason: 'empty_body'
        - Estados: UNVERIFIABLE
        - NUNCA debe generar hipótesis de MOBILE_RESPONSIVE ni SEO_ONPAGE
        """
        http_resp = {
            "statusCode": 200,
            "headers": {
                "content-type": "text/html"
            },
            "data": ""
        }
        prospect = {
            "prospect_id": "dom:empty-site.org",
            "lead_key": "dom:empty-site.org",
            "audit_target_url": "https://empty-site.org",
            "is_test_data": True,
            "is_synthetic_test": False
        }

        res = self._execute_extract_node(http_resp, prospect)

        self.assertTrue(res["is_accessible"])
        self.assertFalse(res["has_viewport"])
        self.assertIsNone(res["page_title"])
        self.assertIsNone(res["meta_description"])

        raw_ev = res["raw_evidence"]
        self.assertEqual(raw_ev["content_length"], 0)
        self.assertFalse(raw_ev["analysis_verifiable"])
        self.assertEqual(raw_ev["unverifiable_reason"], "empty_body")
        self.assertEqual(raw_ev["feature_status"]["viewport"], "UNVERIFIABLE")
        self.assertEqual(raw_ev["feature_status"]["meta_description"], "UNVERIFIABLE")
        self.assertEqual(raw_ev["feature_status"]["page_title"], "UNVERIFIABLE")

        categories = [h["category"] for h in res["commercial_hypotheses"]]
        self.assertNotIn("MOBILE_RESPONSIVE", categories, "No debe asumir ausencia de viewport en cuerpo vacío")
        self.assertNotIn("SEO_ONPAGE", categories, "No debe asumir ausencia de meta description en cuerpo vacío")

    def test_case_04_non_html_response(self):
        """
        Caso 4: Respuesta no HTML (ej. JSON API / application/json).
        - analysis_verifiable: false
        - unverifiable_reason: 'non_html_response'
        - Estados: UNVERIFIABLE
        - NUNCA debe generar hipótesis de MOBILE_RESPONSIVE ni SEO_ONPAGE
        """
        http_resp = {
            "statusCode": 200,
            "headers": {
                "content-type": "application/json; charset=utf-8"
            },
            "data": json.dumps({"status": "active", "service": "api-gateway", "version": "1.0"})
        }
        prospect = {
            "prospect_id": "dom:api.service.io",
            "lead_key": "dom:api.service.io",
            "audit_target_url": "https://api.service.io",
            "is_test_data": False,
            "is_synthetic_test": False
        }

        res = self._execute_extract_node(http_resp, prospect)

        self.assertTrue(res["is_accessible"])
        self.assertFalse(res["has_viewport"])
        self.assertIsNone(res["page_title"])
        self.assertIsNone(res["meta_description"])

        raw_ev = res["raw_evidence"]
        self.assertFalse(raw_ev["analysis_verifiable"])
        self.assertEqual(raw_ev["unverifiable_reason"], "non_html_response")
        self.assertEqual(raw_ev["feature_status"]["viewport"], "UNVERIFIABLE")
        self.assertEqual(raw_ev["feature_status"]["meta_description"], "UNVERIFIABLE")

        categories = [h["category"] for h in res["commercial_hypotheses"]]
        self.assertNotIn("MOBILE_RESPONSIVE", categories, "No debe producir falsos positivos en respuestas no HTML")
        self.assertNotIn("SEO_ONPAGE", categories, "No debe producir falsos positivos en respuestas no HTML")

    def test_case_05_http_error_response(self):
        """
        Caso 5: Error HTTP (ej. 503 Service Unavailable).
        - is_accessible: false
        - error_code: 'HTTP_ERROR_503'
        - analysis_verifiable: false
        - unverifiable_reason: 'http_error'
        - Hipótesis: SÍ genera SITE_HEALTH, pero NO MOBILE_RESPONSIVE ni SEO_ONPAGE
        """
        http_resp = {
            "statusCode": 503,
            "headers": {
                "content-type": "text/html"
            },
            "data": "<html><title>503 Service Temporarily Unavailable</title><body>Maintenance</body></html>"
        }
        prospect = {
            "prospect_id": "dom:down-server.com",
            "lead_key": "dom:down-server.com",
            "audit_target_url": "https://down-server.com",
            "is_test_data": False,
            "is_synthetic_test": False
        }

        res = self._execute_extract_node(http_resp, prospect)

        self.assertFalse(res["is_accessible"])
        self.assertEqual(res["http_status"], 503)
        self.assertEqual(res["error_code"], "HTTP_ERROR_503")

        raw_ev = res["raw_evidence"]
        self.assertFalse(raw_ev["analysis_verifiable"])
        self.assertEqual(raw_ev["unverifiable_reason"], "http_error")
        self.assertEqual(raw_ev["feature_status"]["viewport"], "UNVERIFIABLE")
        self.assertEqual(raw_ev["feature_status"]["meta_description"], "UNVERIFIABLE")

        categories = [h["category"] for h in res["commercial_hypotheses"]]
        self.assertIn("SITE_HEALTH", categories, "Debe advertir sobre indisponibilidad del servidor")
        self.assertNotIn("MOBILE_RESPONSIVE", categories, "No debe generar hipótesis de diseño móvil en páginas de error HTTP")
        self.assertNotIn("SEO_ONPAGE", categories, "No debe generar hipótesis SEO on-page en páginas de error HTTP")

    # --------------------------------------------------------------------------
    # 2. Test Data Traceability & Propagation Matrix
    # --------------------------------------------------------------------------

    def test_traceability_case_a_execution_10_scenario(self):
        """
        Escenario exacto de Ejecución #10:
        Prospecto de prueba ejecutado en la rama real de producción
        (is_test_data: true, is_synthetic_test: false).
        Debe propagar is_test_data: true hasta el payload final de website_audits.
        """
        http_resp = {
            "statusCode": 200,
            "headers": {"content-type": "text/html; charset=utf-8"},
            "data": "<!doctype html><html><head><meta name=viewport content=\"width=device-width,initial-scale=1\"><title>Example Domain</title></head><body><h1>Example</h1></body></html>"
        }
        prospect = {
            "prospect_id": "dom:example.com",
            "lead_key": "dom:example.com",
            "audit_target_url": "https://example.com",
            "business_name": "[TEST-PROD-VERIFY] Sandbox Corp",
            "source": "MANUAL_TEST_PROD_BRANCH",
            "is_test_data": True,
            "is_synthetic_test": False
        }

        extract_res = self._execute_extract_node(http_resp, prospect)
        self.assertTrue(extract_res["is_test_data"], "Extract node debe preservar is_test_data: true")
        self.assertFalse(extract_res["is_synthetic_test"])
        self.assertEqual(extract_res["raw_evidence"]["traceability"]["detection_method"], "explicit_flag")
        # Verificar que encontró el viewport sin comillas en example.com
        self.assertTrue(extract_res["has_viewport"])
        self.assertEqual(extract_res["page_title"], "Example Domain")

        payload_res = self._execute_payload_node(extract_res)
        self.assertTrue(payload_res["is_test_data"], "Prepare Persistence Payload debe emitir is_test_data: true")
        self.assertFalse(payload_res["is_synthetic_test"], "Prepare Persistence Payload debe emitir is_synthetic_test: false")
        self.assertTrue(payload_res["audit_id"].startswith("aud_"), "Rama de persistencia real debe usar clave determinista")

    def test_traceability_case_b_synthetic_mode(self):
        """
        Escenario sintético predeterminado (RUN_SYNTHETIC_TEST = true).
        is_synthetic_test: true -> is_test_data debe ser true automáticamente.
        """
        http_resp = {"statusCode": 200, "headers": {"content-type": "text/html"}, "data": "<html><title>Test</title></html>"}
        prospect = {
            "prospect_id": "SYNTH-PROSPECT-1-TESTONLY",
            "lead_key": "SYNTH-PROSPECT-1-TESTONLY",
            "audit_target_url": "https://example.com",
            "is_synthetic_test": True
        }

        extract_res = self._execute_extract_node(http_resp, prospect)
        self.assertTrue(extract_res["is_test_data"])
        self.assertTrue(extract_res["is_synthetic_test"])
        self.assertEqual(extract_res["raw_evidence"]["traceability"]["detection_method"], "synthetic_test_mode")

        payload_res = self._execute_payload_node(extract_res)
        self.assertTrue(payload_res["is_test_data"])
        self.assertTrue(payload_res["is_synthetic_test"])
        self.assertIn("TESTONLY", payload_res["audit_id"])

    def test_traceability_case_c_defensive_pattern_match_on_missing_flags(self):
        """
        Manejo defensivo ante indicadores ausentes (undefined / null):
        Si falta el booleano pero la empresa o dominio contiene marcadores de prueba,
        NUNCA asumir que es real: marcar is_test_data = true vía defensive_pattern_match.
        """
        test_cases = [
            {"business_name": "[TEST] Alpha Agency", "lead_key": "dom:alpha.com", "website_url": "https://alpha.com"},
            {"business_name": "Beta Labs", "lead_key": "dom:example.org", "website_url": "https://example.org"},
            {"business_name": "Sandbox Demo Inc", "lead_key": "dom:demo.net", "website_url": "https://demo.net"},
            {"business_name": "Omega Co", "lead_key": "dom:omega.com", "source": "synthetic_csv_import", "website_url": "https://omega.com"},
        ]

        http_resp = {"statusCode": 200, "headers": {"content-type": "text/html"}, "data": "<html><title>Demo</title></html>"}

        for tc in test_cases:
            prospect = {
                "prospect_id": tc["lead_key"],
                "lead_key": tc["lead_key"],
                "audit_target_url": tc["website_url"],
                "business_name": tc["business_name"],
                "source": tc.get("source", ""),
                # Indicadores ausentes intencionalmente
                "is_test_data": None,
                "is_synthetic_test": None
            }
            extract_res = self._execute_extract_node(http_resp, prospect)
            self.assertTrue(
                extract_res["is_test_data"],
                f"Fallo en detección defensiva para prospecto con indicadores de prueba: {tc}"
            )
            self.assertEqual(
                extract_res["raw_evidence"]["traceability"]["detection_method"],
                "defensive_pattern_match"
            )

    def test_traceability_case_d_explicit_real_lead(self):
        """
        Prospecto real verificado:
        is_test_data: false, is_synthetic_test: false.
        Debe registrarse como real con detection_method: 'explicit_real'.
        """
        http_resp = {"statusCode": 200, "headers": {"content-type": "text/html"}, "data": "<html><title>Real Business</title></html>"}
        prospect = {
            "prospect_id": "dom:realbusiness.com.ar",
            "lead_key": "dom:realbusiness.com.ar",
            "audit_target_url": "https://realbusiness.com.ar",
            "business_name": "Real Business SRL",
            "source": "PROD_CSV_IMPORT",
            "is_test_data": False,
            "is_synthetic_test": False
        }

        extract_res = self._execute_extract_node(http_resp, prospect)
        self.assertFalse(extract_res["is_test_data"])
        self.assertFalse(extract_res["is_synthetic_test"])
        self.assertEqual(extract_res["raw_evidence"]["traceability"]["detection_method"], "explicit_real")

        payload_res = self._execute_payload_node(extract_res)
        self.assertFalse(payload_res["is_test_data"])
        self.assertFalse(payload_res["is_synthetic_test"])

    def test_traceability_case_e_missing_indicator_inferred_real_with_audit_trail(self):
        """
        Prospecto sin indicadores booleanos pero sin ningún patrón de prueba:
        Debe inferirse como real pero dejando constancia explícita en raw_evidence.traceability.
        """
        http_resp = {"statusCode": 200, "headers": {"content-type": "text/html"}, "data": "<html><title>Genuine Co</title></html>"}
        prospect = {
            "prospect_id": "dom:genuine-enterprises.net",
            "lead_key": "dom:genuine-enterprises.net",
            "audit_target_url": "https://genuine-enterprises.net",
            "business_name": "Genuine Enterprises",
            "source": "inbound_web",
            "is_test_data": None,
            "is_synthetic_test": None
        }

        extract_res = self._execute_extract_node(http_resp, prospect)
        self.assertFalse(extract_res["is_test_data"])
        self.assertEqual(extract_res["raw_evidence"]["traceability"]["detection_method"], "missing_indicator_inferred_real")


if __name__ == "__main__":
    unittest.main()
