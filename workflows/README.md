# ZYRVAE n8n Workflows

Este directorio contiene las definiciones exportadas de los flujos de automatización de ZYRVAE para su despliegue en n8n Cloud / self-hosted.

## Workflows Disponibles

### 1. ZYRVAE WF-01 Lead Intake & Data Quality
* **ID en n8n:** `tTHszjE5cqMyK1iF`
* **Función:** Validación, saneamiento, deduplicación y registro inicial de leads en la base central.
* **Estado:** Conservado sin modificaciones.

### 2. ZYRVAE WF-02 CSV Lead Import & Website Audit
* **Archivo:** [`ZYRVAE_WF-02_CSV_Lead_Import_Website_Audit.json`](file:///home/runner/work/my-project-4/my-project-4/workflows/ZYRVAE_WF-02_CSV_Lead_Import_Website_Audit.json)
* **Función:** Ingesta por CSV, control de concurrencia secuencial, delegación en WF-01, filtro SSRF, auditoría HTTP no invasiva y derivación de hipótesis comerciales.
* **Estado:** `active: false` (Inactivo).

## Cómo Importar en n8n
1. En la consola de n8n, dirigirse a **Workflows**.
2. Hacer clic en los tres puntos (`...`) del menú superior derecho y seleccionar **Import from File**.
3. Seleccionar el archivo [`ZYRVAE_WF-02_CSV_Lead_Import_Website_Audit.json`](file:///home/runner/work/my-project-4/my-project-4/workflows/ZYRVAE_WF-02_CSV_Lead_Import_Website_Audit.json).
4. El nodo `Call WF-01 (Intake & Dedup)` ya se encuentra vinculado al ID `tTHszjE5cqMyK1iF`.
