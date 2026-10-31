import {
  SystemStatusData,
  WorkflowStatus,
  DataTableStatus,
  EnvironmentVariableStatus,
  DashboardMode,
} from '@/types/system';
import {
  SYNTHETIC_PROSPECTS,
  SYNTHETIC_AUDITS,
  SYNTHETIC_QUALIFICATIONS,
  SYNTHETIC_ERROR_LOGS,
} from './synthetic-data';
import { Prospect, ProspectStatus, TraceabilityStatus, PriorityClassification } from '@/types/prospect';
import { WebsiteAudit, CommercialHypothesis, RawEvidence } from '@/types/audit';
import {
  LeadQualification,
  ScoreComponents,
  AppliedCap,
  ReviewReason,
  VerifiedFinding,
  ServiceFit,
  CommercialSignals,
} from '@/types/qualification';
import { ErrorLogRecord, WorkflowOrigin } from '@/types/error-log';

// Known workflow and data table IDs with fallback defaults
const DEFAULT_N8N_BASE_URL = 'https://zyrvae.app.n8n.cloud';
const DEFAULT_WF01_ID = 'tTHszjE5cqMyK1iF';
const DEFAULT_WF02_ID = 'KosNnbUlKPeKZXHh';
const DEFAULT_WF03_ID = 'O4YiErQMAGK9yGPZ';

const DEFAULT_TABLE_PROSPECTS = 'XXFhpG7YA3LLc0F4';
const DEFAULT_TABLE_AUDITS = 'dpLz1QDQU3l4GyrP';
const DEFAULT_TABLE_QUALIFICATIONS = 'GTtrgRiV4XxZijZZ';
const DEFAULT_TABLE_ERRORS = 'Qig4adosI9vsNThw';

export class N8nClient {
  /**
   * Safe mode check: DEMO is active whenever RUN_SYNTHETIC_TEST is not explicitly 'false'.
   * Having an API key present never automatically switches to LIVE mode.
   */
  public static isSynthetic(): boolean {
    return process.env.RUN_SYNTHETIC_TEST !== 'false';
  }

  public static getMode(): DashboardMode {
    return this.isSynthetic() ? 'DEMO' : 'LIVE_READ_ONLY';
  }

  public static getBaseUrl(): string {
    const raw = process.env.N8N_BASE_URL || DEFAULT_N8N_BASE_URL;
    return raw.trim().replace(/\/+$/, '');
  }

  private static getApiBaseUrl(): string {
    const base = this.getBaseUrl();
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  }

  private static getApiKey(): string {
    return (process.env.N8N_API_KEY || '').trim();
  }

  public static getTableIds() {
    return {
      prospects: process.env.N8N_TABLE_PROSPECTS || DEFAULT_TABLE_PROSPECTS,
      audits: process.env.N8N_TABLE_AUDITS || DEFAULT_TABLE_AUDITS,
      qualifications: process.env.N8N_TABLE_QUALIFICATIONS || DEFAULT_TABLE_QUALIFICATIONS,
      errors: process.env.N8N_TABLE_ERRORS || DEFAULT_TABLE_ERRORS,
    };
  }

  public static getWorkflowIds() {
    return {
      wf01: process.env.N8N_WF01_ID || DEFAULT_WF01_ID,
      wf02: process.env.N8N_WF02_ID || DEFAULT_WF02_ID,
      wf03: process.env.N8N_WF03_ID || DEFAULT_WF03_ID,
    };
  }

  private static getHeaders(): Record<string, string> {
    return {
      'X-N8N-API-KEY': this.getApiKey(),
      Accept: 'application/json',
    };
  }

  /**
   * Helper to extract row payload whether n8n returns flat columns or { json: { ... } } / { data: { ... } }
   */
  private static extractRowData(raw: unknown): Record<string, unknown> {
    if (!raw || typeof raw !== 'object') return {};
    const obj = raw as Record<string, unknown>;
    if (obj.json && typeof obj.json === 'object' && !Array.isArray(obj.json)) {
      return { ...(obj.json as Record<string, unknown>), id: obj.id || (obj.json as Record<string, unknown>).id };
    }
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      return { ...(obj.data as Record<string, unknown>), id: obj.id || (obj.data as Record<string, unknown>).id };
    }
    return obj;
  }

  /**
   * Safely parses JSON strings or returns fallback value.
   */
  private static safeParseJson<T>(value: unknown, fallback: T): T {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value as T;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return fallback;
      try {
        return JSON.parse(trimmed) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

  /**
   * Server-side read-only fetch of rows from an n8n Data Table.
   * Uses standard cursor-based pagination (/api/v1/data-tables/{tableId}/rows).
   * Strictly read-only; never mutates data. Never exposes secrets in errors.
   */
  private static async fetchTableRows(tableId: string): Promise<Record<string, unknown>[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(
        'N8N_API_KEY no configurada. Configure la variable en Vercel para el modo LIVE READ-ONLY.'
      );
    }

    const baseUrl = this.getApiBaseUrl();
    const allRows: Record<string, unknown>[] = [];
    let cursor: string | null = null;
    const maxPages = 10; // Up to 2,500 records defensive limit
    let pageCount = 0;

    do {
      pageCount++;
      const url = new URL(`${baseUrl}/data-tables/${tableId}/rows`);
      url.searchParams.set('limit', '250');
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }

      let res: Response;
      try {
        res = await fetch(url.toString(), {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(10000), // 10s timeout
          cache: 'no-store',
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error de red o timeout';
        throw new Error(`Error de conexión con n8n Cloud para la Data Table (${tableId}): ${msg}`);
      }

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error(
            `HTTP ${res.status}: Autenticación fallida o permisos insuficientes para la Data Table (${tableId})`
          );
        }
        if (res.status === 404) {
          throw new Error(`HTTP 404: Data Table (${tableId}) no encontrada en n8n`);
        }
        throw new Error(
          `HTTP ${res.status}: Error al consultar la Data Table (${tableId})`
        );
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new Error(`Respuesta inválida recibida de n8n para la tabla ${tableId} (JSON corrupto)`);
      }

      const rows = Array.isArray(json)
        ? json
        : (json && typeof json === 'object' && Array.isArray((json as { data?: unknown }).data)
            ? (json as { data: unknown[] }).data
            : []);

      for (const r of rows) {
        allRows.push(this.extractRowData(r));
      }

      const nextCursor =
        !Array.isArray(json) &&
        json &&
        typeof json === 'object' &&
        typeof (json as { nextCursor?: unknown }).nextCursor === 'string'
          ? (json as { nextCursor: string }).nextCursor
          : null;

      cursor = nextCursor;
    } while (cursor && pageCount < maxPages);

    return allRows;
  }

  /**
   * System Status diagnostic and health check.
   * Strictly distinguishes between:
   * 1. Credentials configured
   * 2. Authentication validated
   * 3. API accessible
   * 4. Data Tables queryable
   * 5. Real data loaded
   * Never reports CONNECTED if data tables have not been verified.
   */
  public static async getSystemStatus(): Promise<SystemStatusData> {
    const isSynthetic = this.isSynthetic();
    const mode = this.getMode();
    const baseUrl = this.getBaseUrl();
    const apiKey = this.getApiKey();
    const tableIds = this.getTableIds();
    const wfIds = this.getWorkflowIds();

    const envVars: EnvironmentVariableStatus[] = [
      {
        name: 'N8N_BASE_URL',
        is_set: Boolean(process.env.N8N_BASE_URL),
        required_for_live: true,
        description: 'URL base de la instancia n8n Cloud (ej. https://zyrvae.app.n8n.cloud)',
      },
      {
        name: 'N8N_API_KEY',
        is_set: Boolean(apiKey),
        required_for_live: true,
        description: 'API Key de n8n Cloud generada en Settings > n8n API (Server-side ONLY)',
      },
      {
        name: 'RUN_SYNTHETIC_TEST',
        is_set: Boolean(process.env.RUN_SYNTHETIC_TEST),
        required_for_live: false,
        description: 'Control de modo: true = DEMO sintético; false = LIVE READ-ONLY',
      },
      {
        name: 'N8N_PROJECT_ID',
        is_set: Boolean(process.env.N8N_PROJECT_ID),
        required_for_live: false,
        description: 'ID de proyecto n8n (gpI1QfU4f7fk1cv8)',
      },
      {
        name: 'N8N_TABLE_PROSPECTS',
        is_set: Boolean(process.env.N8N_TABLE_PROSPECTS),
        required_for_live: false,
        description: 'ID Data Table prospects (XXFhpG7YA3LLc0F4)',
      },
      {
        name: 'N8N_TABLE_AUDITS',
        is_set: Boolean(process.env.N8N_TABLE_AUDITS),
        required_for_live: false,
        description: 'ID Data Table website_audits (dpLz1QDQU3l4GyrP)',
      },
      {
        name: 'N8N_TABLE_QUALIFICATIONS',
        is_set: Boolean(process.env.N8N_TABLE_QUALIFICATIONS),
        required_for_live: false,
        description: 'ID Data Table lead_qualifications (GTtrgRiV4XxZijZZ)',
      },
      {
        name: 'N8N_TABLE_ERRORS',
        is_set: Boolean(process.env.N8N_TABLE_ERRORS),
        required_for_live: false,
        description: 'ID Data Table lead_intake_errors (Qig4adosI9vsNThw)',
      },
    ];

    const workflows: WorkflowStatus[] = [
      {
        id: wfIds.wf01,
        name: 'ZYRVAE WF-01 Lead Intake & Data Quality',
        code: 'WF-01',
        active: false,
        expected_state: 'INACTIVE_BY_DESIGN',
        mode: isSynthetic ? 'SYNTHETIC_SAFE' : 'LIVE_PRODUCTION',
        description: 'Ingesta, validación, saneamiento y deduplicación de prospectos.',
        destination_table: 'prospects',
        destination_table_id: tableIds.prospects,
      },
      {
        id: wfIds.wf02,
        name: 'ZYRVAE WF-02 CSV Lead Import & Website Audit',
        code: 'WF-02',
        active: false,
        expected_state: 'INACTIVE_BY_DESIGN',
        mode: isSynthetic ? 'SYNTHETIC_SAFE' : 'LIVE_PRODUCTION',
        description: 'Auditoría técnica web HTTP no invasiva con protección SSRF estricta.',
        destination_table: 'website_audits',
        destination_table_id: tableIds.audits,
      },
      {
        id: wfIds.wf03,
        name: 'ZYRVAE WF-03 Lead Qualification & Prioritization',
        code: 'WF-03',
        active: false,
        expected_state: 'INACTIVE_BY_DESIGN',
        mode: isSynthetic ? 'SYNTHETIC_SAFE' : 'LIVE_PRODUCTION',
        description: 'Motor de calificación comercial determinista (0-100) y scoring explicable.',
        destination_table: 'lead_qualifications',
        destination_table_id: tableIds.qualifications,
      },
    ];

    // DEMO mode: isolated synthetic execution
    if (isSynthetic) {
      const tables: DataTableStatus[] = [
        {
          id: tableIds.prospects,
          name: 'prospects',
          purpose: 'Directorio canónico de prospectos normalizados y deduplicados',
          read_status: 'SYNTHETIC_MOCK',
          rows_count: SYNTHETIC_PROSPECTS.length,
          last_queried: new Date().toISOString(),
        },
        {
          id: tableIds.audits,
          name: 'website_audits',
          purpose: 'Evidencias técnicas y mediciones de auditoría web no invasiva',
          read_status: 'SYNTHETIC_MOCK',
          rows_count: SYNTHETIC_AUDITS.length,
          last_queried: new Date().toISOString(),
        },
        {
          id: tableIds.qualifications,
          name: 'lead_qualifications',
          purpose: 'Evaluaciones comerciales de oportunidad técnica y niveles de prioridad',
          read_status: 'SYNTHETIC_MOCK',
          rows_count: SYNTHETIC_QUALIFICATIONS.length,
          last_queried: new Date().toISOString(),
        },
        {
          id: tableIds.errors,
          name: 'lead_intake_errors',
          purpose: 'Registro de incidencias de intake, fallos de conexión y SSRF',
          read_status: 'SYNTHETIC_MOCK',
          rows_count: SYNTHETIC_ERROR_LOGS.length,
          last_queried: new Date().toISOString(),
        },
      ];

      return {
        connection_status: 'SYNTHETIC_MODE',
        mode: 'DEMO',
        base_url: baseUrl,
        is_synthetic_mode: true,
        last_checked: new Date().toISOString(),
        credentials_configured: Boolean(apiKey),
        authentication_validated: false,
        api_accessible: false,
        tables_queryable: false,
        real_data_loaded: false,
        workflows,
        tables,
        env_variables: envVars,
      };
    }

    // LIVE READ-ONLY mode: check credentials first
    const credentialsConfigured = Boolean(apiKey && baseUrl);
    if (!credentialsConfigured) {
      const tables: DataTableStatus[] = [
        {
          id: tableIds.prospects,
          name: 'prospects',
          purpose: 'Directorio canónico de prospectos normalizados y deduplicados',
          read_status: 'CREDENTIALS_REQUIRED',
          rows_count: 0,
          error_message: 'N8N_API_KEY no configurada',
        },
        {
          id: tableIds.audits,
          name: 'website_audits',
          purpose: 'Evidencias técnicas y mediciones de auditoría web no invasiva',
          read_status: 'CREDENTIALS_REQUIRED',
          rows_count: 0,
          error_message: 'N8N_API_KEY no configurada',
        },
        {
          id: tableIds.qualifications,
          name: 'lead_qualifications',
          purpose: 'Evaluaciones comerciales de oportunidad técnica y niveles de prioridad',
          read_status: 'CREDENTIALS_REQUIRED',
          rows_count: 0,
          error_message: 'N8N_API_KEY no configurada',
        },
        {
          id: tableIds.errors,
          name: 'lead_intake_errors',
          purpose: 'Registro de incidencias de intake, fallos de conexión y SSRF',
          read_status: 'CREDENTIALS_REQUIRED',
          rows_count: 0,
          error_message: 'N8N_API_KEY no configurada',
        },
      ];

      return {
        connection_status: 'CREDENTIALS_MISSING',
        mode: 'LIVE_READ_ONLY',
        base_url: baseUrl,
        is_synthetic_mode: false,
        last_checked: new Date().toISOString(),
        error_message: 'N8N_API_KEY no configurada en las variables de entorno para el modo LIVE READ-ONLY.',
        credentials_configured: false,
        authentication_validated: false,
        api_accessible: false,
        tables_queryable: false,
        real_data_loaded: false,
        workflows,
        tables,
        env_variables: envVars,
      };
    }

    // LIVE READ-ONLY mode: test n8n API access & authentication
    const startTime = Date.now();
    const apiBaseUrl = this.getApiBaseUrl();
    let apiAccessible = false;
    let authValidated = false;

    try {
      const probeRes = await fetch(`${apiBaseUrl}/workflows/${wfIds.wf03}`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(6000),
        cache: 'no-store',
      });

      if (probeRes.status === 401 || probeRes.status === 403) {
        return {
          connection_status: 'ERROR',
          mode: 'LIVE_READ_ONLY',
          base_url: baseUrl,
          is_synthetic_mode: false,
          last_checked: new Date().toISOString(),
          response_time_ms: Date.now() - startTime,
          error_message: `HTTP ${probeRes.status}: Credenciales de n8n inválidas o API Key sin permisos suficientes.`,
          credentials_configured: true,
          authentication_validated: false,
          api_accessible: true,
          tables_queryable: false,
          real_data_loaded: false,
          workflows,
          tables: [
            {
              id: tableIds.prospects,
              name: 'prospects',
              purpose: 'Directorio canónico de prospectos normalizados y deduplicados',
              read_status: 'CREDENTIALS_REQUIRED',
              rows_count: 0,
              error_message: `HTTP ${probeRes.status}: Autenticación rechazada`,
            },
            {
              id: tableIds.audits,
              name: 'website_audits',
              purpose: 'Evidencias técnicas y mediciones de auditoría web no invasiva',
              read_status: 'CREDENTIALS_REQUIRED',
              rows_count: 0,
              error_message: `HTTP ${probeRes.status}: Autenticación rechazada`,
            },
            {
              id: tableIds.qualifications,
              name: 'lead_qualifications',
              purpose: 'Evaluaciones comerciales de oportunidad técnica y niveles de prioridad',
              read_status: 'CREDENTIALS_REQUIRED',
              rows_count: 0,
              error_message: `HTTP ${probeRes.status}: Autenticación rechazada`,
            },
            {
              id: tableIds.errors,
              name: 'lead_intake_errors',
              purpose: 'Registro de incidencias de intake, fallos de conexión y SSRF',
              read_status: 'CREDENTIALS_REQUIRED',
              rows_count: 0,
              error_message: `HTTP ${probeRes.status}: Autenticación rechazada`,
            },
          ],
          env_variables: envVars,
        };
      }

      if (!probeRes.ok) {
        return {
          connection_status: 'ERROR',
          mode: 'LIVE_READ_ONLY',
          base_url: baseUrl,
          is_synthetic_mode: false,
          last_checked: new Date().toISOString(),
          response_time_ms: Date.now() - startTime,
          error_message: `HTTP ${probeRes.status}: ${probeRes.statusText || 'Error al conectar con la API de n8n'}`,
          credentials_configured: true,
          authentication_validated: false,
          api_accessible: false,
          tables_queryable: false,
          real_data_loaded: false,
          workflows,
          tables: [
            {
              id: tableIds.prospects,
              name: 'prospects',
              purpose: 'Directorio canónico de prospectos normalizados y deduplicados',
              read_status: 'UNREACHABLE',
              rows_count: 0,
            },
            {
              id: tableIds.audits,
              name: 'website_audits',
              purpose: 'Evidencias técnicas y mediciones de auditoría web no invasiva',
              read_status: 'UNREACHABLE',
              rows_count: 0,
            },
            {
              id: tableIds.qualifications,
              name: 'lead_qualifications',
              purpose: 'Evaluaciones comerciales de oportunidad técnica y niveles de prioridad',
              read_status: 'UNREACHABLE',
              rows_count: 0,
            },
            {
              id: tableIds.errors,
              name: 'lead_intake_errors',
              purpose: 'Registro de incidencias de intake, fallos de conexión y SSRF',
              read_status: 'UNREACHABLE',
              rows_count: 0,
            },
          ],
          env_variables: envVars,
        };
      }

      apiAccessible = true;
      authValidated = true;

      const wfData = await probeRes.json().catch(() => null);
      if (wfData && typeof wfData === 'object' && typeof (wfData as { active?: unknown }).active === 'boolean') {
        const wf03 = workflows.find((w) => w.code === 'WF-03');
        if (wf03) wf03.active = (wfData as { active: boolean }).active;
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error de conexión desconocido';
      return {
        connection_status: 'ERROR',
        mode: 'LIVE_READ_ONLY',
        base_url: baseUrl,
        is_synthetic_mode: false,
        last_checked: new Date().toISOString(),
        response_time_ms: Date.now() - startTime,
        error_message: `Fallo al alcanzar la instancia n8n (${baseUrl}): ${errorMsg}`,
        credentials_configured: true,
        authentication_validated: false,
        api_accessible: false,
        tables_queryable: false,
        real_data_loaded: false,
        workflows,
        tables: [
          {
            id: tableIds.prospects,
            name: 'prospects',
            purpose: 'Directorio canónico de prospectos normalizados y deduplicados',
            read_status: 'UNREACHABLE',
            rows_count: 0,
            error_message: errorMsg,
          },
          {
            id: tableIds.audits,
            name: 'website_audits',
            purpose: 'Evidencias técnicas y mediciones de auditoría web no invasiva',
            read_status: 'UNREACHABLE',
            rows_count: 0,
            error_message: errorMsg,
          },
          {
            id: tableIds.qualifications,
            name: 'lead_qualifications',
            purpose: 'Evaluaciones comerciales de oportunidad técnica y niveles de prioridad',
            read_status: 'UNREACHABLE',
            rows_count: 0,
            error_message: errorMsg,
          },
          {
            id: tableIds.errors,
            name: 'lead_intake_errors',
            purpose: 'Registro de incidencias de intake, fallos de conexión y SSRF',
            read_status: 'UNREACHABLE',
            rows_count: 0,
            error_message: errorMsg,
          },
        ],
        env_variables: envVars,
      };
    }

    // LIVE READ-ONLY: probe each of the four Data Tables individually
    const tableConfigs = [
      {
        id: tableIds.prospects,
        name: 'prospects',
        purpose: 'Directorio canónico de prospectos normalizados y deduplicados',
      },
      {
        id: tableIds.audits,
        name: 'website_audits',
        purpose: 'Evidencias técnicas y mediciones de auditoría web no invasiva',
      },
      {
        id: tableIds.qualifications,
        name: 'lead_qualifications',
        purpose: 'Evaluaciones comerciales de oportunidad técnica y niveles de prioridad',
      },
      {
        id: tableIds.errors,
        name: 'lead_intake_errors',
        purpose: 'Registro de incidencias de intake, fallos de conexión y SSRF',
      },
    ];

    const tablesStatus: DataTableStatus[] = [];
    let queryableCount = 0;

    for (const tbl of tableConfigs) {
      try {
        const tblRes = await fetch(`${apiBaseUrl}/data-tables/${tbl.id}/rows?limit=1`, {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(6000),
          cache: 'no-store',
        });

        if (tblRes.ok) {
          queryableCount++;
          const tblJson = await tblRes.json().catch(() => null);
          const count =
            tblJson && typeof tblJson === 'object' && Array.isArray((tblJson as { data?: unknown }).data)
              ? (tblJson as { data: unknown[] }).data.length
              : (Array.isArray(tblJson) ? tblJson.length : 0);

          tablesStatus.push({
            id: tbl.id,
            name: tbl.name,
            purpose: tbl.purpose,
            read_status: 'AVAILABLE',
            rows_count: count,
            last_queried: new Date().toISOString(),
          });
        } else if (tblRes.status === 404) {
          tablesStatus.push({
            id: tbl.id,
            name: tbl.name,
            purpose: tbl.purpose,
            read_status: 'NOT_FOUND',
            rows_count: 0,
            error_message: `HTTP 404: Data Table ${tbl.id} no existe en n8n`,
            last_queried: new Date().toISOString(),
          });
        } else if (tblRes.status === 401 || tblRes.status === 403) {
          tablesStatus.push({
            id: tbl.id,
            name: tbl.name,
            purpose: tbl.purpose,
            read_status: 'PERMISSION_DENIED',
            rows_count: 0,
            error_message: `HTTP ${tblRes.status}: Permiso denegado para consultar la Data Table`,
            last_queried: new Date().toISOString(),
          });
        } else {
          tablesStatus.push({
            id: tbl.id,
            name: tbl.name,
            purpose: tbl.purpose,
            read_status: 'UNREACHABLE',
            rows_count: 0,
            error_message: `HTTP ${tblRes.status}: ${tblRes.statusText}`,
            last_queried: new Date().toISOString(),
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al consultar la tabla';
        tablesStatus.push({
          id: tbl.id,
          name: tbl.name,
          purpose: tbl.purpose,
          read_status: 'UNREACHABLE',
          rows_count: 0,
          error_message: msg,
          last_queried: new Date().toISOString(),
        });
      }
    }

    const allTablesQueryable = queryableCount === tableConfigs.length;
    const responseTime = Date.now() - startTime;

    return {
      connection_status: allTablesQueryable ? 'CONNECTED' : queryableCount > 0 ? 'PARTIAL' : 'ERROR',
      mode: 'LIVE_READ_ONLY',
      base_url: baseUrl,
      is_synthetic_mode: false,
      last_checked: new Date().toISOString(),
      response_time_ms: responseTime,
      error_message: allTablesQueryable
        ? undefined
        : `Autenticación validada, pero solo ${queryableCount} de 4 Data Tables son consultables.`,
      credentials_configured: true,
      authentication_validated: authValidated,
      api_accessible: apiAccessible,
      tables_queryable: allTablesQueryable,
      real_data_loaded: allTablesQueryable,
      workflows,
      tables: tablesStatus,
      env_variables: envVars,
    };
  }

  /**
   * Reads prospects table (XXFhpG7YA3LLc0F4)
   */
  public static async getProspects(): Promise<Prospect[]> {
    if (this.isSynthetic()) {
      return SYNTHETIC_PROSPECTS;
    }

    const tableId = this.getTableIds().prospects;
    const rawRows = await this.fetchTableRows(tableId);

    const seenKeys = new Set<string>();
    const prospects: Prospect[] = [];

    for (const row of rawRows) {
      const leadKey = String(row.lead_key || row.id || '').trim();
      if (!leadKey || seenKeys.has(leadKey)) continue;
      seenKeys.add(leadKey);

      const isTestData =
        row.is_test_data === true || row.is_test_data === 'true' || row.is_test_data === 1
          ? true
          : row.is_test_data === false || row.is_test_data === 'false' || row.is_test_data === 0
          ? false
          : null;

      const rawTrace = String(row.traceability_status || '').trim();
      const traceability: TraceabilityStatus =
        rawTrace === 'CONFIRMED_REAL' ||
        rawTrace === 'TEST_DATA' ||
        rawTrace === 'UNKNOWN_TRACEABILITY' ||
        rawTrace === 'CONTRADICTORY_TRACEABILITY'
          ? (rawTrace as TraceabilityStatus)
          : isTestData === true
          ? 'TEST_DATA'
          : isTestData === false
          ? 'CONFIRMED_REAL'
          : 'UNKNOWN_TRACEABILITY';

      const rawStatus = String(row.status || '').trim();
      const status: ProspectStatus = [
        'validated',
        'pending_review',
        'rejected',
        'imported',
      ].includes(rawStatus)
        ? (rawStatus as ProspectStatus)
        : 'pending_review';

      const createdAtStr = row.created_at || row.createdAt;
      const updatedAtStr = row.updated_at || row.updatedAt;

      const prospect: Prospect = {
        id: String(row.id || leadKey),
        lead_key: leadKey,
        business_name: String(row.business_name || '').trim(),
        website_url: String(row.website_url || '').trim(),
        country: row.country ? String(row.country).trim() : undefined,
        industry: row.industry ? String(row.industry).trim() : undefined,
        status,
        source: row.source ? String(row.source) : undefined,
        source_url: row.source_url ? String(row.source_url) : undefined,
        evidence_notes: row.evidence_notes ? String(row.evidence_notes) : undefined,
        is_test_data: isTestData,
        is_synthetic_test: Boolean(
          row.is_synthetic_test === true ||
            row.is_synthetic_test === 'true' ||
            row.is_synthetic_test === 1
        ),
        traceability_status: traceability,
        requires_review: Boolean(
          row.requires_review === true ||
            row.requires_review === 'true' ||
            row.requires_review === 1
        ),
        created_at: createdAtStr ? new Date(String(createdAtStr)).toISOString() : new Date().toISOString(),
        updated_at: updatedAtStr ? new Date(String(updatedAtStr)).toISOString() : undefined,
      };

      prospects.push(prospect);
    }

    return prospects;
  }

  /**
   * Reads website_audits table (dpLz1QDQU3l4GyrP)
   */
  public static async getAudits(): Promise<WebsiteAudit[]> {
    if (this.isSynthetic()) {
      return SYNTHETIC_AUDITS;
    }

    const tableId = this.getTableIds().audits;
    const rawRows = await this.fetchTableRows(tableId);

    const seenIds = new Set<string>();
    const audits: WebsiteAudit[] = [];

    for (const row of rawRows) {
      const auditId = String(row.audit_id || row.id || '').trim();
      if (!auditId || seenIds.has(auditId)) continue;
      seenIds.add(auditId);

      const isTestData =
        row.is_test_data === true || row.is_test_data === 'true' || row.is_test_data === 1
          ? true
          : row.is_test_data === false || row.is_test_data === 'false' || row.is_test_data === 0
          ? false
          : null;

      const rawTrace = String(row.traceability_status || '').trim();
      const traceability: TraceabilityStatus =
        rawTrace === 'CONFIRMED_REAL' ||
        rawTrace === 'TEST_DATA' ||
        rawTrace === 'UNKNOWN_TRACEABILITY' ||
        rawTrace === 'CONTRADICTORY_TRACEABILITY'
          ? (rawTrace as TraceabilityStatus)
          : isTestData === true
          ? 'TEST_DATA'
          : isTestData === false
          ? 'CONFIRMED_REAL'
          : 'UNKNOWN_TRACEABILITY';

      const commercialHypotheses = this.safeParseJson<CommercialHypothesis[]>(
        row.commercial_hypotheses,
        []
      );
      const rawEvidence = this.safeParseJson<RawEvidence>(row.raw_evidence, {});

      const auditDateStr = row.audit_date || row.created_at || row.createdAt;

      const audit: WebsiteAudit = {
        id: String(row.id || auditId),
        audit_id: auditId,
        prospect_id: String(row.prospect_id || ''),
        lead_key: String(row.lead_key || ''),
        audit_date: auditDateStr ? new Date(String(auditDateStr)).toISOString() : new Date().toISOString(),
        initial_url: String(row.initial_url || ''),
        final_url: row.final_url ? String(row.final_url) : undefined,
        http_status:
          row.http_status !== undefined && row.http_status !== null && !isNaN(Number(row.http_status))
            ? Number(row.http_status)
            : undefined,
        redirect_count: Number(row.redirect_count || 0),
        response_time_ms:
          row.response_time_ms !== undefined &&
          row.response_time_ms !== null &&
          !isNaN(Number(row.response_time_ms))
            ? Number(row.response_time_ms)
            : undefined,
        page_title: row.page_title ? String(row.page_title) : undefined,
        meta_description: row.meta_description ? String(row.meta_description) : undefined,
        has_viewport: Boolean(
          row.has_viewport === true || row.has_viewport === 'true' || row.has_viewport === 1
        ),
        ssl_active: Boolean(
          row.ssl_active === true || row.ssl_active === 'true' || row.ssl_active === 1
        ),
        is_accessible: Boolean(
          row.is_accessible === true || row.is_accessible === 'true' || row.is_accessible === 1
        ),
        error_code: row.error_code ? String(row.error_code) : undefined,
        commercial_hypotheses: commercialHypotheses,
        raw_evidence: rawEvidence,
        is_synthetic_test: Boolean(
          row.is_synthetic_test === true ||
            row.is_synthetic_test === 'true' ||
            row.is_synthetic_test === 1
        ),
        is_test_data: isTestData,
        traceability_status: traceability,
        requires_review: Boolean(
          row.requires_review === true ||
            row.requires_review === 'true' ||
            row.requires_review === 1
        ),
        created_at: row.created_at
          ? new Date(String(row.created_at)).toISOString()
          : new Date().toISOString(),
      };

      audits.push(audit);
    }

    return audits;
  }

  /**
   * Reads lead_qualifications table (GTtrgRiV4XxZijZZ)
   */
  public static async getQualifications(): Promise<LeadQualification[]> {
    if (this.isSynthetic()) {
      return SYNTHETIC_QUALIFICATIONS;
    }

    const tableId = this.getTableIds().qualifications;
    const rawRows = await this.fetchTableRows(tableId);

    const seenIds = new Set<string>();
    const qualifications: LeadQualification[] = [];

    for (const row of rawRows) {
      const qualId = String(row.qualification_id || row.id || '').trim();
      if (!qualId || seenIds.has(qualId)) continue;
      seenIds.add(qualId);

      const isTestData =
        row.is_test_data === true || row.is_test_data === 'true' || row.is_test_data === 1
          ? true
          : row.is_test_data === false || row.is_test_data === 'false' || row.is_test_data === 0
          ? false
          : null;

      const rawClass = String(row.classification || '').trim();
      const classification: PriorityClassification = [
        'PRIORITY_HIGH',
        'PRIORITY_MEDIUM',
        'PRIORITY_LOW',
        'REVIEW_REQUIRED',
        'EXCLUDED_TEST_DATA',
      ].includes(rawClass)
        ? (rawClass as PriorityClassification)
        : 'REVIEW_REQUIRED';

      const rawTrace = String(row.traceability_status || '').trim();
      const traceability: TraceabilityStatus = [
        'CONFIRMED_REAL',
        'TEST_DATA',
        'UNKNOWN_TRACEABILITY',
        'CONTRADICTORY_TRACEABILITY',
      ].includes(rawTrace)
        ? (rawTrace as TraceabilityStatus)
        : 'UNKNOWN_TRACEABILITY';

      const evaluatedAtStr = row.evaluated_at || row.created_at || row.createdAt;

      const qual: LeadQualification = {
        qualification_id: qualId,
        lead_key: String(row.lead_key || ''),
        prospect_row_ids: this.safeParseJson(row.prospect_row_ids, []),
        business_name: row.business_name ? String(row.business_name) : undefined,
        website_url: row.website_url ? String(row.website_url) : undefined,
        evaluated_at: evaluatedAtStr
          ? new Date(String(evaluatedAtStr)).toISOString()
          : new Date().toISOString(),
        rules_version: String(row.rules_version || '1.0.0'),
        rules_digest: String(row.rules_digest || ''),
        evidence_fingerprint: String(row.evidence_fingerprint || ''),
        run_mode: row.run_mode === 'PRODUCTION' ? 'PRODUCTION' : 'SYNTHETIC_TEST',
        classification,
        priority_label: String(row.priority_label || classification),
        score:
          row.score !== undefined && row.score !== null && !isNaN(Number(row.score))
            ? Number(row.score)
            : null,
        score_components: this.safeParseJson<ScoreComponents>(row.score_components, {
          technical: 0,
          evidence: 0,
          services: 0,
          completeness: 0,
        }),
        caps_applied: this.safeParseJson<AppliedCap[]>(row.caps_applied, []),
        traceability_status: traceability,
        is_test_data: isTestData,
        requires_review: Boolean(
          row.requires_review === true ||
            row.requires_review === 'true' ||
            row.requires_review === 1
        ),
        review_reasons: this.safeParseJson<ReviewReason[]>(row.review_reasons, []),
        exclusion_reason: row.exclusion_reason ? String(row.exclusion_reason) : null,
        verified_findings: this.safeParseJson<VerifiedFinding[]>(row.verified_findings, []),
        hypotheses_assessment: this.safeParseJson(row.hypotheses_assessment, {}),
        service_fit: this.safeParseJson<ServiceFit[]>(row.service_fit, []),
        warnings: this.safeParseJson<string[]>(row.warnings, []),
        commercial_signals: this.safeParseJson<CommercialSignals>(row.commercial_signals, {
          has_budget_signal: false,
          has_intent_signal: false,
          has_urgency_signal: false,
          has_decision_maker_signal: false,
          technical_opportunity_only: true,
          disclaimer: 'Evaluación técnica preliminar',
        }),
        commercial_use_allowed: Boolean(
          row.commercial_use_allowed === true ||
            row.commercial_use_allowed === 'true' ||
            row.commercial_use_allowed === 1
        ),
        primary_audit_id: row.primary_audit_id ? String(row.primary_audit_id) : undefined,
        source_audit_ids: this.safeParseJson(row.source_audit_ids, []),
        evidence_refs: this.safeParseJson(row.evidence_refs, {}),
        input_snapshot: this.safeParseJson(row.input_snapshot, {}),
        explanation: row.explanation ? String(row.explanation) : undefined,
        supersedes_qualification_id: row.supersedes_qualification_id
          ? String(row.supersedes_qualification_id)
          : null,
        previous_classification: row.previous_classification
          ? String(row.previous_classification)
          : null,
        workflow_execution_id: row.workflow_execution_id
          ? String(row.workflow_execution_id)
          : undefined,
        created_at: row.created_at
          ? new Date(String(row.created_at)).toISOString()
          : new Date().toISOString(),
      };

      qualifications.push(qual);
    }

    return qualifications;
  }

  /**
   * Reads lead_intake_errors table (Qig4adosI9vsNThw)
   */
  public static async getErrorLogs(): Promise<ErrorLogRecord[]> {
    if (this.isSynthetic()) {
      return SYNTHETIC_ERROR_LOGS;
    }

    const tableId = this.getTableIds().errors;
    const rawRows = await this.fetchTableRows(tableId);

    const seenIds = new Set<string>();
    const errorLogs: ErrorLogRecord[] = [];

    for (const row of rawRows) {
      const errorId = String(row.id || `err-${errorLogs.length + 1}`).trim();
      if (!errorId || seenIds.has(errorId)) continue;
      seenIds.add(errorId);

      const rawWf = String(row.workflow || '').trim();
      const workflow: WorkflowOrigin = ['WF-01', 'WF-02', 'WF-03', 'SYSTEM', 'API'].includes(
        rawWf
      )
        ? (rawWf as WorkflowOrigin)
        : 'SYSTEM';

      const rawStatus = String(row.status || '').trim();
      const status: ErrorLogRecord['status'] = [
        'logged',
        'pending_investigation',
        'resolved',
        'acknowledged',
      ].includes(rawStatus)
        ? (rawStatus as ErrorLogRecord['status'])
        : 'logged';

      const timestampStr = row.timestamp || row.created_at || row.createdAt;

      const log: ErrorLogRecord = {
        id: errorId,
        timestamp: timestampStr
          ? new Date(String(timestampStr)).toISOString()
          : new Date().toISOString(),
        workflow,
        lead_key: row.lead_key ? String(row.lead_key) : undefined,
        record_id: row.record_id ? String(row.record_id) : undefined,
        error_type: String(row.error_type || 'UNKNOWN_ERROR'),
        error_message: String(row.error_message || 'Error sin mensaje detallado'),
        status,
        raw_payload: this.safeParseJson(row.raw_payload, undefined),
        stack_trace: row.stack_trace ? String(row.stack_trace) : undefined,
      };

      errorLogs.push(log);
    }

    return errorLogs;
  }
}
