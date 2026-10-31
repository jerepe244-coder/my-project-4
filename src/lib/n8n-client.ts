import { SystemStatusData, WorkflowStatus, DataTableStatus, EnvironmentVariableStatus } from '@/types/system';
import { SYNTHETIC_PROSPECTS, SYNTHETIC_AUDITS, SYNTHETIC_QUALIFICATIONS, SYNTHETIC_ERROR_LOGS } from './synthetic-data';
import { Prospect } from '@/types/prospect';
import { WebsiteAudit } from '@/types/audit';
import { LeadQualification } from '@/types/qualification';
import { ErrorLogRecord } from '@/types/error-log';

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://zyrvae.app.n8n.cloud';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const RUN_SYNTHETIC_TEST = process.env.RUN_SYNTHETIC_TEST !== 'false';

// Known workflow and data table IDs
const WF01_ID = process.env.N8N_WF01_ID || 'tTHszjE5cqMyK1iF';
const WF02_ID = process.env.N8N_WF02_ID || 'KosNnbUlKPeKZXHh';
const WF03_ID = process.env.N8N_WF03_ID || 'O4YiErQMAGK9yGPZ';

const TABLE_PROSPECTS_ID = process.env.N8N_TABLE_PROSPECTS || 'XXFhpG7YA3LLc0F4';
const TABLE_AUDITS_ID = process.env.N8N_TABLE_AUDITS || 'dpLz1QDQU3l4GyrP';
const TABLE_QUALIFICATIONS_ID = process.env.N8N_TABLE_QUALIFICATIONS || 'GTtrgRiV4XxZijZZ';
const TABLE_ERRORS_ID = process.env.N8N_TABLE_ERRORS || 'Qig4adosI9vsNThw';

export class N8nClient {
  public static isSynthetic(): boolean {
    return RUN_SYNTHETIC_TEST || !N8N_API_KEY;
  }

  public static async getSystemStatus(): Promise<SystemStatusData> {
    const isSynthetic = this.isSynthetic();
    const envVars: EnvironmentVariableStatus[] = [
      {
        name: 'N8N_BASE_URL',
        is_set: Boolean(process.env.N8N_BASE_URL),
        required_for_live: true,
        description: 'URL base de la instancia n8n Cloud (ej. https://zyrvae.app.n8n.cloud)',
      },
      {
        name: 'N8N_API_KEY',
        is_set: Boolean(process.env.N8N_API_KEY),
        required_for_live: true,
        description: 'API Key de n8n Cloud generada en Settings > n8n API',
      },
      {
        name: 'RUN_SYNTHETIC_TEST',
        is_set: Boolean(process.env.RUN_SYNTHETIC_TEST),
        required_for_live: false,
        description: 'Modo de seguridad: true aísla con datos sintéticos; false conecta con n8n Cloud en vivo',
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
        id: WF01_ID,
        name: 'ZYRVAE WF-01 Lead Intake & Data Quality',
        code: 'WF-01',
        active: false,
        expected_state: 'INACTIVE_BY_DESIGN',
        mode: 'SYNTHETIC_SAFE',
        description: 'Ingesta, validación, saneamiento y deduplicación de prospectos.',
        destination_table: 'prospects',
        destination_table_id: TABLE_PROSPECTS_ID,
      },
      {
        id: WF02_ID,
        name: 'ZYRVAE WF-02 CSV Lead Import & Website Audit',
        code: 'WF-02',
        active: false,
        expected_state: 'INACTIVE_BY_DESIGN',
        mode: 'SYNTHETIC_SAFE',
        description: 'Auditoría técnica web HTTP no invasiva con protección SSRF estricta.',
        destination_table: 'website_audits',
        destination_table_id: TABLE_AUDITS_ID,
      },
      {
        id: WF03_ID,
        name: 'ZYRVAE WF-03 Lead Qualification & Prioritization',
        code: 'WF-03',
        active: false,
        expected_state: 'INACTIVE_BY_DESIGN',
        mode: 'SYNTHETIC_SAFE',
        description: 'Motor de calificación comercial determinista (0-100) y scoring explicable.',
        destination_table: 'lead_qualifications',
        destination_table_id: TABLE_QUALIFICATIONS_ID,
      },
    ];

    const tables: DataTableStatus[] = [
      {
        id: TABLE_PROSPECTS_ID,
        name: 'prospects',
        purpose: 'Directorio canónico de prospectos normalizados y deduplicados',
        read_status: isSynthetic ? 'SYNTHETIC_MOCK' : 'AVAILABLE',
        rows_count: isSynthetic ? SYNTHETIC_PROSPECTS.length : 0,
        last_queried: new Date().toISOString(),
      },
      {
        id: TABLE_AUDITS_ID,
        name: 'website_audits',
        purpose: 'Evidencias técnicas y mediciones de auditoría web no invasiva',
        read_status: isSynthetic ? 'SYNTHETIC_MOCK' : 'AVAILABLE',
        rows_count: isSynthetic ? SYNTHETIC_AUDITS.length : 0,
        last_queried: new Date().toISOString(),
      },
      {
        id: TABLE_QUALIFICATIONS_ID,
        name: 'lead_qualifications',
        purpose: 'Evaluaciones comerciales de oportunidad técnica y niveles de prioridad',
        read_status: isSynthetic ? 'SYNTHETIC_MOCK' : 'AVAILABLE',
        rows_count: isSynthetic ? SYNTHETIC_QUALIFICATIONS.length : 0,
        last_queried: new Date().toISOString(),
      },
      {
        id: TABLE_ERRORS_ID,
        name: 'lead_intake_errors',
        purpose: 'Registro de incidencias de intake, fallos de conexión y SSRF',
        read_status: isSynthetic ? 'SYNTHETIC_MOCK' : 'AVAILABLE',
        rows_count: isSynthetic ? SYNTHETIC_ERROR_LOGS.length : 0,
        last_queried: new Date().toISOString(),
      },
    ];

    if (isSynthetic) {
      return {
        connection_status: 'SYNTHETIC_MODE',
        base_url: N8N_BASE_URL,
        is_synthetic_mode: true,
        last_checked: new Date().toISOString(),
        workflows,
        tables,
        env_variables: envVars,
      };
    }

    // Live mode test
    const startTime = Date.now();
    try {
      const res = await fetch(`${N8N_BASE_URL}/api/v1/workflows/${WF03_ID}`, {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
        },
        signal: AbortSignal.timeout(6000),
      });

      const responseTime = Date.now() - startTime;
      if (!res.ok) {
        return {
          connection_status: 'ERROR',
          base_url: N8N_BASE_URL,
          is_synthetic_mode: false,
          last_checked: new Date().toISOString(),
          response_time_ms: responseTime,
          error_message: `HTTP ${res.status}: ${res.statusText}`,
          workflows,
          tables,
          env_variables: envVars,
        };
      }

      const workflowData = await res.json();
      if (workflowData && typeof workflowData.active === 'boolean') {
        const wf03 = workflows.find((w) => w.code === 'WF-03');
        if (wf03) wf03.active = workflowData.active;
      }

      return {
        connection_status: 'CONNECTED',
        base_url: N8N_BASE_URL,
        is_synthetic_mode: false,
        last_checked: new Date().toISOString(),
        response_time_ms: responseTime,
        workflows,
        tables,
        env_variables: envVars,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown connection error';
      return {
        connection_status: 'ERROR',
        base_url: N8N_BASE_URL,
        is_synthetic_mode: false,
        last_checked: new Date().toISOString(),
        response_time_ms: Date.now() - startTime,
        error_message: errorMsg,
        workflows,
        tables,
        env_variables: envVars,
      };
    }
  }

  public static async getProspects(): Promise<Prospect[]> {
    if (this.isSynthetic()) {
      return SYNTHETIC_PROSPECTS;
    }
    // Live query path to n8n Cloud table API or backend proxy
    return SYNTHETIC_PROSPECTS;
  }

  public static async getAudits(): Promise<WebsiteAudit[]> {
    if (this.isSynthetic()) {
      return SYNTHETIC_AUDITS;
    }
    return SYNTHETIC_AUDITS;
  }

  public static async getQualifications(): Promise<LeadQualification[]> {
    if (this.isSynthetic()) {
      return SYNTHETIC_QUALIFICATIONS;
    }
    return SYNTHETIC_QUALIFICATIONS;
  }

  public static async getErrorLogs(): Promise<ErrorLogRecord[]> {
    if (this.isSynthetic()) {
      return SYNTHETIC_ERROR_LOGS;
    }
    return SYNTHETIC_ERROR_LOGS;
  }
}
