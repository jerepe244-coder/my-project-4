#!/usr/bin/env python3
"""
ZYRVAE WF-02 — CSV Lead Import & Website Audit Engine
Implements validation, deduplication, SSRF security guard, non-invasive HTTP audit,
and objective opportunity classification for n8n code nodes and test harnesses.
"""

import csv
import io
import ipaddress
import re
import socket
import time
import urllib.parse
from typing import Dict, List, Optional, Tuple
import urllib.request
import urllib.error

# Headers admitidos según especificación ZYRVAE WF-02
ALLOWED_HEADERS = {
    "business_name",
    "website_url",
    "country",
    "industry",
    "source",
    "source_url",
    "evidence_notes",
}

# Rangos de IP privadas/reservadas bloqueadas para prevenir SSRF
BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),      # Loopback
    ipaddress.ip_network("10.0.0.0/8"),       # Privada Clase A
    ipaddress.ip_network("172.16.0.0/12"),    # Privada Clase B
    ipaddress.ip_network("192.168.0.0/16"),   # Privada Clase C
    ipaddress.ip_network("169.254.0.0/16"),   # Link-local / Cloud Metadata
    ipaddress.ip_network("0.0.0.0/8"),        # Red local
    ipaddress.ip_network("::1/128"),          # Loopback IPv6
    ipaddress.ip_network("fc00::/7"),         # Unique local IPv6
    ipaddress.ip_network("fe80::/10"),        # Link-local IPv6
]

USER_AGENT = "ZYRVAE-AuditBot/1.0 (+https://zyrvae.com/bot)"
MAX_RESPONSE_BYTES = 2 * 1024 * 1024  # 2 MB limit
HTTP_TIMEOUT_SECONDS = 8


def is_ssrf_safe(url: str) -> Tuple[bool, Optional[str]]:
    """
    Verifica que la URL no apunte a localhost, redes privadas o metadata cloud.
    """
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False, f"Esquema no permitido: {parsed.scheme}"

        hostname = parsed.hostname
        if not hostname:
            return False, "Host ausente en la URL"

        if hostname.lower() in ("localhost", "127.0.0.1", "::1", "metadata.google.internal"):
            return False, f"Host bloqueado por seguridad: {hostname}"

        # Resolver DNS para verificar la IP real
        try:
            addr_info = socket.getaddrinfo(hostname, None)
            for item in addr_info:
                ip_str = item[4][0]
                ip_obj = ipaddress.ip_address(ip_str)
                for net in BLOCKED_IP_NETWORKS:
                    if ip_obj in net:
                        return False, f"IP resuelta ({ip_str}) pertenece a red privada/bloqueada"
        except socket.gaierror:
            # Fallo de resolución DNS no es un fallo de SSRF en sí, pero no se puede auditar
            return False, "No se pudo resolver el nombre de dominio (DNS lookup failed)"

        return True, None
    except Exception as e:
        return False, f"Error en validación de seguridad de URL: {str(e)}"


def parse_and_validate_csv(csv_content: str) -> Dict:
    """
    Parsea y valida el contenido de un CSV según las reglas de negocio de WF-02.
    """
    reader = csv.DictReader(io.StringIO(csv_content.strip()))
    
    headers = reader.fieldnames or []
    header_diff = set(headers) - ALLOWED_HEADERS
    if header_diff:
        # Informar encabezados desconocidos pero tolerar si los básicos están presentes
        pass

    valid_leads: List[Dict] = []
    skipped_errors: List[Dict] = []
    seen_urls = set()

    for row_idx, row in enumerate(reader, start=2):  # Fila 1 = encabezados
        business_name = (row.get("business_name") or "").strip()
        website_url = (row.get("website_url") or "").strip()
        country = (row.get("country") or "").strip()
        industry = (row.get("industry") or "").strip()
        source = (row.get("source") or "CSV_IMPORT").strip()
        source_url = (row.get("source_url") or "").strip()
        evidence_notes = (row.get("evidence_notes") or "").strip()

        # Validación 1: Fila vacía
        if not business_name and not website_url:
            skipped_errors.append({
                "row_index": row_idx,
                "error_type": "EMPTY_ROW",
                "message": "Fila vacía o sin campos esenciales",
                "raw": row
            })
            continue

        # Validación 2: Business name obligatorio
        if not business_name:
            skipped_errors.append({
                "row_index": row_idx,
                "error_type": "MISSING_BUSINESS_NAME",
                "message": "El nombre de la empresa (business_name) es obligatorio",
                "raw": row
            })
            continue

        # Validación 3: URL sintácticamente válida
        if website_url:
            if not (website_url.startswith("http://") or website_url.startswith("https://")):
                # Intentar auto-corrección si parece dominio simple
                if "." in website_url and not " " in website_url:
                    website_url = "https://" + website_url
                else:
                    skipped_errors.append({
                        "row_index": row_idx,
                        "error_type": "INVALID_URL_SYNTAX",
                        "message": f"URL con formato inválido: {website_url}",
                        "raw": row
                    })
                    continue

        # Validación 4: Deduplicación dentro del mismo lote CSV
        normalized_url = website_url.lower().rstrip("/")
        if normalized_url and normalized_url in seen_urls:
            skipped_errors.append({
                "row_index": row_idx,
                "error_type": "IN_BATCH_DUPLICATE",
                "message": f"URL duplicada dentro del mismo archivo CSV: {website_url}",
                "raw": row
            })
            continue
        if normalized_url:
            seen_urls.add(normalized_url)

        valid_leads.append({
            "row_index": row_idx,
            "business_name": business_name,
            "website_url": website_url,
            "country": country,
            "industry": industry,
            "source": source,
            "source_url": source_url,
            "evidence_notes": evidence_notes
        })

    return {
        "total_rows_processed": len(valid_leads) + len(skipped_errors),
        "valid_count": len(valid_leads),
        "error_count": len(skipped_errors),
        "valid_leads": valid_leads,
        "errors": skipped_errors
    }


def audit_website(url: str) -> Dict:
    """
    Ejecuta una auditoría HTTP segura y no invasiva sobre el sitio web del prospecto.
    """
    if not url:
        return {
            "is_accessible": False,
            "error_code": "NO_URL_PROVIDED",
            "commercial_hypotheses": [{"type": "NO_WEBSITE", "detail": "Prospecto sin presencia web declarada"}]
        }

    # Control SSRF previo
    is_safe, error_reason = is_ssrf_safe(url)
    if not is_safe:
        return {
            "initial_url": url,
            "is_accessible": False,
            "error_code": "SSRF_BLOCKED",
            "error_message": error_reason,
            "commercial_hypotheses": []
        }

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
    )

    start_time = time.time()
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_SECONDS) as response:
            latency_ms = int((time.time() - start_time) * 1000)
            http_status = response.getcode()
            final_url = response.geturl()
            content_type = response.headers.get("Content-Type", "")
            
            # Leer contenido respetando el límite de 2 MB
            raw_body = response.read(MAX_RESPONSE_BYTES)
            try:
                html_text = raw_body.decode("utf-8", errors="replace")
            except Exception:
                html_text = ""

            # Criterios de verificabilidad de HTML
            is_non_empty = bool(html_text.strip())
            content_type_lower = content_type.lower()
            has_html_content_type = "text/html" in content_type_lower or "application/xhtml" in content_type_lower
            has_html_markers = bool(re.search(r"<(?:!doctype\s+html|html|head|body)[\s>]", html_text, re.IGNORECASE))
            is_explicit_non_html = any(t in content_type_lower for t in ["application/json", "image/", "application/pdf"])
            is_html_response = (has_html_content_type or has_html_markers) and not is_explicit_non_html
            is_html_analyzable = is_non_empty and is_html_response

            viewport_status = "UNVERIFIABLE"
            meta_desc_status = "UNVERIFIABLE"
            title_status = "UNVERIFIABLE"
            has_viewport = False
            title = None
            meta_description = None

            if is_html_analyzable:
                viewport_match = re.search(r'<meta[^>]+name\s*=\s*[\'"]?viewport[\'"]?', html_text, re.IGNORECASE)
                if viewport_match:
                    viewport_status = "FOUND"
                    has_viewport = True
                else:
                    viewport_status = "PROVEN_ABSENT"
                    has_viewport = False

                title_match = re.search(r"<title[^>]*>(.*?)</title>", html_text, re.IGNORECASE | re.DOTALL)
                if title_match and title_match.group(1).strip():
                    title_status = "FOUND"
                    title = title_match.group(1).strip()
                else:
                    title_status = "PROVEN_ABSENT"
                    title = ""

                meta_desc_match = re.search(
                    r'<meta[^>]+name\s*=\s*[\'"]?description[\'"]?[^>]+content\s*=\s*[\'"](.*?)[\'"]',
                    html_text,
                    re.IGNORECASE
                ) or re.search(
                    r'<meta[^>]+content\s*=\s*[\'"](.*?)[\'"][^>]+name\s*=\s*[\'"]?description[\'"]?',
                    html_text,
                    re.IGNORECASE
                )
                if meta_desc_match and meta_desc_match.group(1).strip():
                    meta_desc_status = "FOUND"
                    meta_description = meta_desc_match.group(1).strip()
                else:
                    meta_desc_status = "PROVEN_ABSENT"
                    meta_description = ""

            ssl_active = final_url.startswith("https://")

            # Construir hipótesis comerciales basadas estrictamente en hechos comprobables
            hypotheses = []
            if not ssl_active:
                hypotheses.append({
                    "category": "SECURITY_SSL",
                    "evidence": "Sitio web no redirige a HTTPS o opera sobre HTTP plano",
                    "opportunity": "Servicio de securización web, migración a certificado SSL y confianza digital"
                })
            if is_html_analyzable and viewport_status == "PROVEN_ABSENT":
                hypotheses.append({
                    "category": "MOBILE_RESPONSIVE",
                    "evidence": "Falta etiqueta meta viewport para renderizado responsivo",
                    "opportunity": "Modernización de diseño y optimización de experiencia móvil (Responsive Web Design)"
                })
            if is_html_analyzable and meta_desc_status == "PROVEN_ABSENT":
                hypotheses.append({
                    "category": "SEO_ONPAGE",
                    "evidence": "Sitio web sin meta description declarada en HTML",
                    "opportunity": "Optimización SEO on-page y mejora de CTR en snippets de Google"
                })
            if latency_ms > 2500:
                hypotheses.append({
                    "category": "PERFORMANCE",
                    "evidence": f"Tiempo de respuesta inicial elevado ({latency_ms} ms)",
                    "opportunity": "Optimización de velocidad de carga, compresión y CDN"
                })

            unanalyzable_reason = None
            if not is_non_empty:
                unanalyzable_reason = "empty_body"
            elif not is_html_response:
                unanalyzable_reason = "non_html_response"

            return {
                "initial_url": url,
                "final_url": final_url,
                "http_status": http_status,
                "redirect_count": len(response.headers.get_all("Location", []) or []),
                "response_time_ms": latency_ms,
                "page_title": title,
                "meta_description": meta_description,
                "has_viewport": has_viewport,
                "ssl_active": ssl_active,
                "is_accessible": True,
                "error_code": None,
                "commercial_hypotheses": hypotheses,
                "raw_evidence": {
                    "content_type": content_type,
                    "body_size_bytes": len(raw_body),
                    "analysis_verifiable": is_html_analyzable,
                    "unverifiable_reason": unanalyzable_reason,
                    "feature_status": {
                        "viewport": viewport_status,
                        "meta_description": meta_desc_status,
                        "page_title": title_status
                    },
                    "headers_summary": {k: response.headers.get(k) for k in ["Server", "Content-Type", "Strict-Transport-Security"] if k in response.headers}
                }
            }

    except urllib.error.HTTPError as e:
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "initial_url": url,
            "final_url": getattr(e, "url", url),
            "http_status": e.code,
            "redirect_count": 0,
            "response_time_ms": latency_ms,
            "page_title": None,
            "meta_description": None,
            "has_viewport": False,
            "ssl_active": url.startswith("https://"),
            "is_accessible": False,
            "error_code": f"HTTP_ERROR_{e.code}",
            "commercial_hypotheses": [{
                "category": "SITE_HEALTH",
                "evidence": f"El servidor respondió con código de error HTTP {e.code}",
                "opportunity": "Auditoría de infraestructura y recuperación de disponibilidad web"
            }],
            "raw_evidence": {"error_reason": str(e.reason)}
        }
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "initial_url": url,
            "final_url": None,
            "http_status": None,
            "redirect_count": 0,
            "response_time_ms": latency_ms,
            "page_title": None,
            "meta_description": None,
            "has_viewport": False,
            "ssl_active": url.startswith("https://"),
            "is_accessible": False,
            "error_code": "NETWORK_TIMEOUT_OR_DNS_ERROR",
            "commercial_hypotheses": [{
                "category": "AVAILABILITY",
                "evidence": f"Error de conexión o timeout al acceder al dominio ({str(e)})",
                "opportunity": "Reactivación de dominio caído o migración de hosting"
            }],
            "raw_evidence": {"exception": str(e)}
        }
