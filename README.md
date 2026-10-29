# ZYRVAE Lead Automation Suite

Repositorio de flujos de trabajo n8n y componentes de automatización para prospección, validación de calidad de datos y auditoría técnica web.

## Estructura del Proyecto

* **[`workflows/`](file:///home/runner/work/my-project-4/my-project-4/workflows/):** Definiciones JSON de los workflows para n8n.
  * [`ZYRVAE_WF-02_CSV_Lead_Import_Website_Audit.json`](file:///home/runner/work/my-project-4/my-project-4/workflows/ZYRVAE_WF-02_CSV_Lead_Import_Website_Audit.json): Workflow de importación CSV, integración con WF-01 y auditoría web no invasiva.
* **[`sql/`](file:///home/runner/work/my-project-4/my-project-4/sql/):** Esquemas y scripts DDL para base de datos.
  * [`002_create_website_audits_table.sql`](file:///home/runner/work/my-project-4/my-project-4/sql/002_create_website_audits_table.sql): Definición de la tabla `website_audits`.
* **[`scripts/`](file:///home/runner/work/my-project-4/my-project-4/scripts/):** Motor de auditoría, filtros SSRF y validaciones.
  * [`audit_engine.py`](file:///home/runner/work/my-project-4/my-project-4/scripts/audit_engine.py): Lógica de saneamiento CSV, auditoría HTTP y clasificación objetiva de hipótesis comerciales.
* **[`tests/`](file:///home/runner/work/my-project-4/my-project-4/tests/):** Suite de pruebas unitarias y de integración con datos sintéticos.
  * [`test_wf02_pipeline.py`](file:///home/runner/work/my-project-4/my-project-4/tests/test_wf02_pipeline.py): Pruebas automatizadas de extremo a extremo.
  * [`fixtures/synthetic_leads_test.csv`](file:///home/runner/work/my-project-4/my-project-4/tests/fixtures/synthetic_leads_test.csv): Lote sintético con casos borde (válido, error HTTP, sintaxis errónea, duplicado, SSRF y fila vacía).
* **[`docs/`](file:///home/runner/work/my-project-4/my-project-4/docs/):** Documentación técnica de arquitectura.
  * [`ARCHITECTURE_WF-02.md`](file:///home/runner/work/my-project-4/my-project-4/docs/ARCHITECTURE_WF-02.md): Especificación detallada de nodos, flujo y controles de seguridad.
