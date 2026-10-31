import { N8nClient } from './n8n-client';
import { Prospect, IncompleteFieldIndicator, PriorityClassification } from '@/types/prospect';
import { WebsiteAudit, CategorizedFinding } from '@/types/audit';
import { LeadQualification } from '@/types/qualification';
import { ErrorLogRecord } from '@/types/error-log';

export interface EnrichedProspect extends Prospect {
  audit?: WebsiteAudit;
  qualification?: LeadQualification;
  incompleteIndicators: IncompleteFieldIndicator[];
}

export interface OverviewMetrics {
  totalProspects: number;
  recentProspects: number;
  auditsCount: number;
  qualificationsCount: number;
  reviewRequiredCount: number;
  errorRecordsCount: number;
  isSyntheticMode: boolean;
  priorityDistribution: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    REVIEW: number;
    EXCLUDED: number;
  };
  recentActivity: Array<{
    id: string;
    type: 'prospect_intake' | 'audit_completed' | 'qualification_evaluated' | 'error_logged';
    title: string;
    description: string;
    timestamp: string;
    leadKey?: string;
  }>;
}

export interface InsightsData {
  isSyntheticMode: boolean;
  sampleSize: number;
  technicalIssues: Array<{
    code: string;
    label: string;
    serviceCode: string;
    count: number;
    percentage: number;
  }>;
  opportunityCategories: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  accessibilityBreakdown: {
    accessible: number;
    inaccessible: number;
    error: number;
  };
  priorityBreakdown: Array<{
    classification: PriorityClassification;
    label: string;
    count: number;
    percentage: number;
  }>;
}

export class DataService {
  public static checkIncompleteFields(prospect: Prospect): IncompleteFieldIndicator[] {
    const indicators: IncompleteFieldIndicator[] = [];

    if (!prospect.website_url || prospect.website_url.trim() === '') {
      indicators.push({
        field: 'website_url',
        label: 'URL no provista',
        severity: 'error',
      });
    }

    if (!prospect.business_name || prospect.business_name.trim() === '') {
      indicators.push({
        field: 'business_name',
        label: 'Nombre comercial ausente',
        severity: 'error',
      });
    }

    if (!prospect.country || prospect.country.trim() === '') {
      indicators.push({
        field: 'country',
        label: 'País no declarado',
        severity: 'warning',
      });
    }

    if (!prospect.industry || prospect.industry.trim() === '') {
      indicators.push({
        field: 'industry',
        label: 'Industria no especificada',
        severity: 'info',
      });
    }

    if (prospect.traceability_status === 'UNKNOWN_TRACEABILITY') {
      indicators.push({
        field: 'traceability_status',
        label: 'Trazabilidad no confirmada',
        severity: 'warning',
      });
    }

    return indicators;
  }

  public static async getEnrichedProspects(): Promise<EnrichedProspect[]> {
    const [prospects, audits, qualifications] = await Promise.all([
      N8nClient.getProspects(),
      N8nClient.getAudits(),
      N8nClient.getQualifications(),
    ]);

    const auditMap = new Map<string, WebsiteAudit>();
    audits.forEach((a) => {
      if (a.lead_key) auditMap.set(a.lead_key, a);
    });

    const qualMap = new Map<string, LeadQualification>();
    qualifications.forEach((q) => {
      if (q.lead_key) qualMap.set(q.lead_key, q);
    });

    return prospects.map((p) => {
      const audit = auditMap.get(p.lead_key);
      const qualification = qualMap.get(p.lead_key);
      const incompleteIndicators = this.checkIncompleteFields(p);

      return {
        ...p,
        audit,
        qualification,
        incompleteIndicators,
      };
    });
  }

  public static async getProspectById(idOrLeadKey: string): Promise<EnrichedProspect | null> {
    const enrichedList = await this.getEnrichedProspects();
    const found = enrichedList.find(
      (p) => p.id === idOrLeadKey || p.lead_key === idOrLeadKey
    );
    return found || null;
  }

  public static categorizeAuditFindings(audit: WebsiteAudit): CategorizedFinding[] {
    const findings: CategorizedFinding[] = [];

    // Parse raw evidence if string
    const rawEvidence = typeof audit.raw_evidence === 'string'
      ? JSON.parse(audit.raw_evidence)
      : audit.raw_evidence;

    const featureStatus = rawEvidence?.feature_status || {};

    if (!audit.is_accessible) {
      findings.push({
        code: 'SITE_INACCESSIBLE',
        title: 'Sitio Inaccesible',
        description: audit.error_code
          ? `Error detectado: ${audit.error_code}`
          : `HTTP Status ${audit.http_status || 'desconocido'}`,
        severity: 'audit_error',
        evidence: `HTTP ${audit.http_status || 'N/A'}`,
      });
    }

    if (audit.is_accessible && !audit.ssl_active) {
      findings.push({
        code: 'NO_HTTPS',
        title: 'Sin Protocolo HTTPS / SSL',
        description: 'Sitio servido sobre HTTP sin cifrar TLS.',
        severity: 'confirmed_problem',
        serviceCode: 'WEB_SECURITY_SSL',
        evidence: audit.initial_url,
      });
    }

    if (audit.is_accessible && !audit.has_viewport) {
      findings.push({
        code: 'NO_VIEWPORT',
        title: 'Diseño No Responsivo Móvil',
        description: 'Ausencia de etiqueta <meta name="viewport">.',
        severity: 'confirmed_problem',
        serviceCode: 'MOBILE_RESPONSIVE_UX',
        evidence: 'HTML head inspection',
      });
    }

    if (audit.is_accessible && audit.response_time_ms && audit.response_time_ms > 3000) {
      findings.push({
        code: 'SLOW_RESPONSE',
        title: 'Tiempo de Respuesta Elevado',
        description: `Latencia medida: ${audit.response_time_ms} ms (> 3.000 ms).`,
        severity: 'warning',
        serviceCode: 'WEB_PERFORMANCE',
        evidence: `${audit.response_time_ms} ms`,
      });
    }

    if (audit.is_accessible && (!audit.meta_description || audit.meta_description.trim() === '')) {
      findings.push({
        code: 'NO_META_DESCRIPTION',
        title: 'Meta Description Ausente',
        description: 'Falta descripción para buscadores en metadatos.',
        severity: 'missing_data',
        serviceCode: 'SEO_ONPAGE',
      });
    }

    if (audit.is_accessible && (!audit.page_title || audit.page_title.trim() === '')) {
      findings.push({
        code: 'NO_PAGE_TITLE',
        title: 'Título de Página Ausente',
        description: 'Etiqueta <title> vacía o ausente.',
        severity: 'missing_data',
        serviceCode: 'SEO_ONPAGE',
      });
    }

    if (featureStatus.viewport === 'NOT_VERIFIED') {
      findings.push({
        code: 'UNVERIFIED_VIEWPORT',
        title: 'Viewport no verificado',
        description: 'Análisis parcial impidió comprobación completa del viewport.',
        severity: 'unverified',
      });
    }

    return findings;
  }

  public static async getOverviewMetrics(): Promise<OverviewMetrics> {
    const isSyntheticMode = N8nClient.isSynthetic();
    const [prospects, audits, qualifications, errors] = await Promise.all([
      N8nClient.getProspects(),
      N8nClient.getAudits(),
      N8nClient.getQualifications(),
      N8nClient.getErrorLogs(),
    ]);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentProspects = prospects.filter((p) => p.created_at >= sevenDaysAgo).length;

    const reviewRequiredCount = prospects.filter(
      (p) => p.requires_review || p.traceability_status === 'UNKNOWN_TRACEABILITY'
    ).length;

    const priorityCounts = {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      REVIEW: 0,
      EXCLUDED: 0,
    };

    qualifications.forEach((q) => {
      if (q.classification === 'PRIORITY_HIGH') priorityCounts.HIGH++;
      else if (q.classification === 'PRIORITY_MEDIUM') priorityCounts.MEDIUM++;
      else if (q.classification === 'PRIORITY_LOW') priorityCounts.LOW++;
      else if (q.classification === 'REVIEW_REQUIRED') priorityCounts.REVIEW++;
      else if (q.classification === 'EXCLUDED_TEST_DATA') priorityCounts.EXCLUDED++;
    });

    const recentActivity: OverviewMetrics['recentActivity'] = [];

    // Combine recent events
    qualifications.slice(0, 3).forEach((q) => {
      recentActivity.push({
        id: `act-qual-${q.qualification_id}`,
        type: 'qualification_evaluated',
        title: `Calificación WF-03: ${q.business_name || q.lead_key}`,
        description: `Asignado: ${q.priority_label} (${q.score !== null ? `${q.score} pts` : 'Sin score'})`,
        timestamp: q.evaluated_at,
        leadKey: q.lead_key,
      });
    });

    audits.slice(0, 3).forEach((a) => {
      recentActivity.push({
        id: `act-aud-${a.audit_id}`,
        type: 'audit_completed',
        title: `Auditoría WF-02 completada`,
        description: `${a.initial_url} — HTTP ${a.http_status || 'N/A'} (${a.is_accessible ? 'Accesible' : 'Inaccesible'})`,
        timestamp: a.audit_date,
        leadKey: a.lead_key,
      });
    });

    errors.slice(0, 2).forEach((e) => {
      recentActivity.push({
        id: `act-err-${e.id}`,
        type: 'error_logged',
        title: `Error en ${e.workflow}: ${e.error_type}`,
        description: e.error_message,
        timestamp: e.timestamp,
        leadKey: e.lead_key,
      });
    });

    recentActivity.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));

    return {
      totalProspects: prospects.length,
      recentProspects,
      auditsCount: audits.length,
      qualificationsCount: qualifications.length,
      reviewRequiredCount,
      errorRecordsCount: errors.length,
      isSyntheticMode,
      priorityDistribution: priorityCounts,
      recentActivity: recentActivity.slice(0, 8),
    };
  }

  public static async getInsightsData(): Promise<InsightsData> {
    const isSyntheticMode = N8nClient.isSynthetic();
    const [audits, qualifications] = await Promise.all([
      N8nClient.getAudits(),
      N8nClient.getQualifications(),
    ]);

    const totalAudits = audits.length || 1;
    let accessible = 0;
    let inaccessible = 0;
    let errorCount = 0;

    let noHttps = 0;
    let noViewport = 0;
    let slowResponse = 0;
    let noMetaDesc = 0;

    audits.forEach((a) => {
      if (a.is_accessible) {
        accessible++;
        if (!a.ssl_active) noHttps++;
        if (!a.has_viewport) noViewport++;
        if (a.response_time_ms && a.response_time_ms > 3000) slowResponse++;
        if (!a.meta_description) noMetaDesc++;
      } else {
        inaccessible++;
        if (a.error_code) errorCount++;
      }
    });

    const technicalIssues = [
      {
        code: 'NO_HTTPS',
        label: 'Sin protocolo HTTPS / SSL',
        serviceCode: 'WEB_SECURITY_SSL',
        count: noHttps,
        percentage: Math.round((noHttps / totalAudits) * 100),
      },
      {
        code: 'NO_VIEWPORT',
        label: 'Ausencia de meta viewport responsivo',
        serviceCode: 'MOBILE_RESPONSIVE_UX',
        count: noViewport,
        percentage: Math.round((noViewport / totalAudits) * 100),
      },
      {
        code: 'NO_META_DESCRIPTION',
        label: 'Metadatos SEO description ausentes',
        serviceCode: 'SEO_ONPAGE',
        count: noMetaDesc,
        percentage: Math.round((noMetaDesc / totalAudits) * 100),
      },
      {
        code: 'SLOW_RESPONSE',
        label: 'Latencia de servidor elevada (> 3s)',
        serviceCode: 'WEB_PERFORMANCE',
        count: slowResponse,
        percentage: Math.round((slowResponse / totalAudits) * 100),
      },
    ];

    const opportunityCategories = [
      {
        category: 'Seguridad Web & SSL (WEB_SECURITY_SSL)',
        count: noHttps,
        percentage: Math.round((noHttps / totalAudits) * 100),
      },
      {
        category: 'Experiencia Móvil & UI/UX (MOBILE_RESPONSIVE_UX)',
        count: noViewport,
        percentage: Math.round((noViewport / totalAudits) * 100),
      },
      {
        category: 'SEO On-Page & Metadatos (SEO_ONPAGE)',
        count: noMetaDesc,
        percentage: Math.round((noMetaDesc / totalAudits) * 100),
      },
      {
        category: 'Optimización de Rendimiento (WEB_PERFORMANCE)',
        count: slowResponse,
        percentage: Math.round((slowResponse / totalAudits) * 100),
      },
    ];

    const totalQuals = qualifications.length || 1;
    const priorityMap: Record<PriorityClassification, number> = {
      PRIORITY_HIGH: 0,
      PRIORITY_MEDIUM: 0,
      PRIORITY_LOW: 0,
      REVIEW_REQUIRED: 0,
      EXCLUDED_TEST_DATA: 0,
    };

    qualifications.forEach((q) => {
      priorityMap[q.classification] = (priorityMap[q.classification] || 0) + 1;
    });

    const priorityBreakdown = [
      {
        classification: 'PRIORITY_HIGH' as PriorityClassification,
        label: 'Prioridad Alta',
        count: priorityMap.PRIORITY_HIGH,
        percentage: Math.round((priorityMap.PRIORITY_HIGH / totalQuals) * 100),
      },
      {
        classification: 'PRIORITY_MEDIUM' as PriorityClassification,
        label: 'Prioridad Media',
        count: priorityMap.PRIORITY_MEDIUM,
        percentage: Math.round((priorityMap.PRIORITY_MEDIUM / totalQuals) * 100),
      },
      {
        classification: 'PRIORITY_LOW' as PriorityClassification,
        label: 'Prioridad Baja',
        count: priorityMap.PRIORITY_LOW,
        percentage: Math.round((priorityMap.PRIORITY_LOW / totalQuals) * 100),
      },
      {
        classification: 'REVIEW_REQUIRED' as PriorityClassification,
        label: 'Revisión Requerida',
        count: priorityMap.REVIEW_REQUIRED,
        percentage: Math.round((priorityMap.REVIEW_REQUIRED / totalQuals) * 100),
      },
      {
        classification: 'EXCLUDED_TEST_DATA' as PriorityClassification,
        label: 'Excluido (Test)',
        count: priorityMap.EXCLUDED_TEST_DATA,
        percentage: Math.round((priorityMap.EXCLUDED_TEST_DATA / totalQuals) * 100),
      },
    ];

    return {
      isSyntheticMode,
      sampleSize: totalAudits,
      technicalIssues,
      opportunityCategories,
      accessibilityBreakdown: {
        accessible,
        inaccessible,
        error: errorCount,
      },
      priorityBreakdown,
    };
  }
}
