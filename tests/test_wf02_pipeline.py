#!/usr/bin/env python3
"""
Unit and integration test suite for ZYRVAE WF-02 Pipeline.
Verifies CSV ingestion, validation, WF-01 integration simulation,
SSRF filtering, non-invasive website audit, and persistence schema compliance.
"""

import unittest
import os
import sys
import uuid

# Asegurar import de scripts locales
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from scripts.audit_engine import parse_and_validate_csv, audit_website, is_ssrf_safe


class TestZYRVAEWF02Pipeline(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_leads_test.csv")
        with open(fixture_path, "r", encoding="utf-8") as f:
            cls.csv_content = f.read()

    def test_01_csv_parsing_and_error_handling(self):
        """Valida que el parser detecte filas vacías, sintaxis inválida y duplicados in-batch."""
        result = parse_and_validate_csv(self.csv_content)
        
        self.assertEqual(result["total_rows_processed"], 6)
        self.assertEqual(result["valid_count"], 3)
        self.assertEqual(result["error_count"], 3)

        error_types = [e["error_type"] for e in result["errors"]]
        self.assertIn("INVALID_URL_SYNTAX", error_types)
        self.assertIn("IN_BATCH_DUPLICATE", error_types)
        self.assertIn("EMPTY_ROW", error_types)

    def test_02_ssrf_protection_guard(self):
        """Verifica que destinos privados, loopback y metadata cloud sean estrictamente bloqueados."""
        unsafe_urls = [
            "http://127.0.0.1:8080/admin",
            "http://localhost:3000",
            "http://10.0.0.15/secret",
            "http://192.168.1.1",
            "http://169.254.169.254/latest/meta-data/",
            "ftp://ftp.example.com",
            "file:///etc/passwd"
        ]
        for url in unsafe_urls:
            is_safe, reason = is_ssrf_safe(url)
            self.assertFalse(is_safe, f"URL insegura no fue bloqueada: {url} ({reason})")

    def test_03_ssrf_safe_urls(self):
        """Verifica que dominios públicos estándar pasen el filtro SSRF."""
        safe_urls = [
            "https://example.com",
            "https://httpbin.org/status/200"
        ]
        for url in safe_urls:
            is_safe, reason = is_ssrf_safe(url)
            self.assertTrue(is_safe, f"URL pública segura fue bloqueada: {url} ({reason})")

    def test_04_valid_website_audit_extraction(self):
        """Audita una URL real válida y comprueba la recolección de métricas objetivas."""
        audit = audit_website("https://example.com")
        self.assertTrue(audit["is_accessible"])
        self.assertEqual(audit["http_status"], 200)
        self.assertEqual(audit["page_title"], "Example Domain")
        self.assertTrue(audit["ssl_active"])
        self.assertGreater(audit["response_time_ms"], 0)
        self.assertIsInstance(audit["commercial_hypotheses"], list)

    def test_05_http_error_does_not_eliminate_lead(self):
        """Verifica que un error HTTP 404 o 500 no aborte el flujo ni borre datos."""
        audit = audit_website("https://httpbin.org/status/404")
        self.assertFalse(audit["is_accessible"])
        self.assertEqual(audit["http_status"], 404)
        self.assertEqual(audit["error_code"], "HTTP_ERROR_404")
        # El registro de auditoría debe existir para documentar la evidencia
        self.assertEqual(len(audit["commercial_hypotheses"]), 1)

    def test_06_simulated_wf01_integration_and_persistence_payload(self):
        """
        Simula el ciclo completo:
        1. Fila CSV válida -> 2. Invocación WF-01 (mock ID) -> 3. Auditoría -> 4. Payload website_audits
        """
        parsed = parse_and_validate_csv(self.csv_content)
        valid_prospect = parsed["valid_leads"][0]  # [TEST-01]

        # Simulación de respuesta de WF-01 Lead Intake & Data Quality asociada a tabla prospects
        mock_wf01_response = {
            "prospect_id": str(uuid.uuid4()),
            "status": "CREATED_NEW",
            "normalized_business_name": valid_prospect["business_name"].replace("[TEST-01] ", ""),
            "normalized_website_url": valid_prospect["website_url"]
        }

        # Auditoría web
        audit_result = audit_website(mock_wf01_response["normalized_website_url"])

        # Generación del registro a persistir en website_audits (vinculado a prospects.id)
        audit_db_record = {
            "id": str(uuid.uuid4()),
            "prospect_id": mock_wf01_response["prospect_id"],
            "initial_url": valid_prospect["website_url"],
            "final_url": audit_result.get("final_url"),
            "http_status": audit_result.get("http_status"),
            "redirect_count": audit_result.get("redirect_count", 0),
            "response_time_ms": audit_result.get("response_time_ms"),
            "page_title": audit_result.get("page_title"),
            "meta_description": audit_result.get("meta_description"),
            "has_viewport": audit_result.get("has_viewport", False),
            "ssl_active": audit_result.get("ssl_active", False),
            "is_accessible": audit_result.get("is_accessible", False),
            "error_code": audit_result.get("error_code"),
            "raw_evidence": audit_result.get("raw_evidence"),
            "commercial_hypotheses": audit_result.get("commercial_hypotheses")
        }

        # Verificaciones de integridad y trazabilidad
        self.assertEqual(audit_db_record["prospect_id"], mock_wf01_response["prospect_id"])
        self.assertIsNotNone(audit_db_record["id"])
        self.assertTrue(audit_db_record["is_accessible"])
        self.assertEqual(audit_db_record["http_status"], 200)


if __name__ == "__main__":
    unittest.main()
