# ZYRVAE Lead Automation Suite

Repositorio de flujos de trabajo n8n y componentes de automatización para prospección, validación de calidad de datos y auditoría técnica web.

## Estructura del Proyecto

* **[`workflows/`](file:///home/runner/work/my-project-4/my-project-4/workflows/):** Definiciones JSON de los workflows para n8n.
  * [`ZYRVAE_WF-02_CSV_Lead_Import_Website_Audit.json`](file:///home/runner/work/my-project-4/my-project-4/workflows/ZYRVAE_WF-02_CSV_Lead_Import_Website_Audit.json): Workflow de importación CSV, integración con WF-01 y auditoría web no invasiva.
  * [`ZYRVAE_WF-03_Lead_Qualification_Prioritization.json`](file:///home/runner/work/my-project-4/my-project-4/workflows/ZYRVAE_WF-03_Lead_Qualification_Prioritization.json): Workflow de calificación comercial y priorización de prospectos con trazabilidad estricta.
* **[`sql/`](file:///home/runner/work/my-project-4/my-project-4/sql/):** Esquemas y scripts DDL para base de datos.
  * [`002_create_website_audits_table.sql`](file:///home/runner/work/my-project-4/my-project-4/sql/002_create_website_audits_table.sql): Definición de la tabla `website_audits`.
  * [`003_create_lead_qualifications_table.sql`](file:///home/runner/work/my-project-4/my-project-4/sql/003_create_lead_qualifications_table.sql): Definición de la tabla `lead_qualifications`.
* **[`scripts/`](file:///home/runner/work/my-project-4/my-project-4/scripts/):** Motor de auditoría, motor de calificación, filtros SSRF y validaciones.
  * [`audit_engine.py`](file:///home/runner/work/my-project-4/my-project-4/scripts/audit_engine.py): Lógica de saneamiento CSV, auditoría HTTP y clasificación objetiva de hipótesis comerciales (WF-02).
  * [`wf03/qualification_engine.js`](file:///home/runner/work/my-project-4/my-project-4/scripts/wf03/qualification_engine.js): Motor de reglas determinista de calificación comercial, scoring (0-100), resolución de trazabilidad e idempotencia (WF-03).
  * [`wf03/build_workflow.js`](file:///home/runner/work/my-project-4/my-project-4/scripts/wf03/build_workflow.js): Compilador del workflow n8n WF-03 que embebe el motor de calificación.
  * [`wf03/test_qualification_engine.js`](file:///home/runner/work/my-project-4/my-project-4/scripts/wf03/test_qualification_engine.js): Suite Node.js de pruebas unitarias integrales de WF-03.
* **[`tests/`](file:///home/runner/work/my-project-4/my-project-4/tests/):** Suite de pruebas unitarias y de integración con datos sintéticos.
  * [`test_wf02_pipeline.py`](file:///home/runner/work/my-project-4/my-project-4/tests/test_wf02_pipeline.py): Pruebas automatizadas de extremo a extremo de WF-02.
  * [`test_wf03_qualification_engine.py`](file:///home/runner/work/my-project-4/my-project-4/tests/test_wf03_qualification_engine.py): Pruebas automatizadas de calificación, contratos, topología y trazabilidad de WF-03.
  * [`fixtures/synthetic_leads_test.csv`](file:///home/runner/work/my-project-4/my-project-4/tests/fixtures/synthetic_leads_test.csv): Lote sintético con casos borde (válido, error HTTP, sintaxis errónea, duplicado, SSRF y fila vacía).
* **[`docs/`](file:///home/runner/work/my-project-4/my-project-4/docs/):** Documentación técnica de arquitectura.
  * [`ARCHITECTURE_WF-02.md`](file:///home/runner/work/my-project-4/my-project-4/docs/ARCHITECTURE_WF-02.md): Especificación detallada de nodos, flujo y controles de seguridad de WF-02.
  * [`ARCHITECTURE_WF-03.md`](file:///home/runner/work/my-project-4/my-project-4/docs/ARCHITECTURE_WF-03.md): Especificación detallada de arquitectura, scoring, trazabilidad, contratos y persistencia de WF-03.
