# ZYRVAE Intelligence Dashboard & Lead Automation Suite

Centro interno de inteligencia comercial, operaciones y análisis técnico de **ZYRVAE Digital Studio**, conectado a workflows de automatización en n8n Cloud y desplegado en Vercel.

---

## 1. Visión General del Proyecto

ZYRVAE combina automatizaciones de prospección y análisis técnico en n8n Cloud con una aplicación web privada en Next.js para visualizar prospectos, evaluar auditorías técnicas objetivas y priorizar oportunidades comerciales de forma determinista y auditable.

* **Frontend & Backend Web:** Next.js 14 (App Router) + TypeScript + Tailwind CSS.
* **Hosting:** Vercel (despliegue continuo desde GitHub).
* **Identidad Visual:** Grafito oscuro, negro suave, blanco frío y acento azul eléctrico (`electric`).
* **Soporte Multilingüe:** Español (predeterminado / fallback) e Inglés (EN) con selector manual y persistencia local.
* **Modo de Seguridad:** `RUN_SYNTHETIC_TEST = true` (aislamiento con cero escrituras hacia n8n).

---

## 2. Componentes del Ecosistema

### 2.1. Workflows en n8n Cloud (`https://zyrvae.app.n8n.cloud`)
* **WF-01 — Lead Intake & Data Quality (`tTHszjE5cqMyK1iF`):** Ingesta, saneamiento y deduplicación. Tablas: `prospects` (`XXFhpG7YA3LLc0F4`) y `lead_intake_errors` (`Qig4adosI9vsNThw`).
* **WF-02 — CSV Lead Import & Website Audit (`KosNnbUlKPeKZXHh`):** Auditoría web HTTP no invasiva con filtro anti-SSRF. Tabla: `website_audits` (`dpLz1QDQU3l4GyrP`).
* **WF-03 — Lead Qualification & Prioritization (`O4YiErQMAGK9yGPZ`):** Scoring comercial determinista (0-100) y trazabilidad estricta. Tabla: `lead_qualifications` (`GTtrgRiV4XxZijZZ`).
* *Nota:* WF-01, WF-02 y WF-03 permanecen configurados como `active: false` por diseño de seguridad.

### 2.2. Vistas del Dashboard
1. **01 — Overview (`/overview`):** Métricas clave, distribución de prioridades y actividad reciente.
2. **02 — Prospects (`/prospects`):** Directorio central de prospectos con búsqueda, filtros, ordenamiento y paginación.
3. **03 — Prospect Detail (`/prospects/[id]`):** Ficha técnica con 10 secciones estructuradas de trazabilidad.
4. **04 — Website Audits (`/audits`):** Consulta de auditorías con distinción de severidad de hallazgos e inspector JSON.
5. **05 — Qualification (`/qualification`):** Evaluaciones del motor WF-03 con aviso de alcance metodológico.
6. **06 — Insights (`/insights`):** Análisis de problemas frecuentes y distribución de oportunidades.
7. **07 — Errors & Logs (`/errors`):** Centro de diagnóstico y auditoría de incidencias (solo lectura).
8. **08 — System Status (`/system`):** Monitor de salud de n8n Cloud, Data Tables y checklist de variables.

---

## 3. Estructura del Repositorio

* **`src/`:** Código fuente del dashboard web (Next.js 14, React, Tailwind CSS, TypeScript).
* **`workflows/`:** Exportaciones JSON de los workflows para n8n.
* **`sql/`:** Esquemas DDL PostgreSQL/n8n para `website_audits` y `lead_qualifications`.
* **`scripts/`:** Motores de auditoría (`audit_engine.py`) y calificación determinista (`qualification_engine.js`).
* **`tests/`:** Suite de pruebas automatizadas (Python y Node.js).
* **`docs/`:** Documentación técnica de arquitectura ([`DASHBOARD_ARCHITECTURE.md`](docs/DASHBOARD_ARCHITECTURE.md), [`ARCHITECTURE_WF-02.md`](docs/ARCHITECTURE_WF-02.md), [`ARCHITECTURE_WF-03.md`](docs/ARCHITECTURE_WF-03.md)).

---

## 4. Puesta en Marcha Local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno (copiar de plantilla)
cp .env.example .env.local

# 3. Ejecutar pruebas integrales
npm test

# 4. Validar linting y types
npm run lint

# 5. Compilar para producción
npm run build

# 6. Iniciar servidor de desarrollo
npm run dev
```

---

## 5. Licencia y Confidencialidad

Propiedad privada de **ZYRVAE Digital Studio**. Uso interno exclusivo.
