'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/context';
import { EnrichedProspect } from '@/lib/data-service';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { JsonViewer } from '@/components/ui/JsonViewer';
import {
  ArrowLeft,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
  FileText,
  Copy,
  Check,
} from 'lucide-react';

export default function ProspectDetailPage() {
  const { id } = useParams() as { id: string };
  const { t } = useTranslation();
  const [prospect, setProspect] = useState<EnrichedProspect | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    async function fetchDetail() {
      try {
        const res = await fetch(`/api/prospects/${id}`);
        const json = await res.json();
        if (json.data) {
          setProspect(json.data);
        }
      } catch (err) {
        console.error('Failed to load prospect detail', err);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchDetail();
  }, [id]);

  const copyLeadKey = () => {
    if (prospect?.lead_key) {
      navigator.clipboard.writeText(prospect.lead_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 bg-zyrvae-900 rounded animate-pulse" />
        <div className="h-12 w-80 bg-zyrvae-900 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-zyrvae-900 rounded-xl animate-pulse" />
          <div className="h-64 bg-zyrvae-900 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!prospect) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-xl font-bold text-zyrvae-200">Prospecto no encontrado</h2>
        <p className="text-xs text-zyrvae-400 mt-2">
          No se encontró ningún registro para el identificador solicitado ({id}).
        </p>
        <div className="mt-6">
          <Link
            href="/prospects"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zyrvae-800 text-zyrvae-200 border border-zyrvae-700 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.prospectDetail.backToList}
          </Link>
        </div>
      </div>
    );
  }

  const audit = prospect.audit;
  const qual = prospect.qualification;

  return (
    <div className="space-y-8">
      {/* Back button & Breadcrumb */}
      <div>
        <Link
          href="/prospects"
          className="inline-flex items-center gap-2 text-xs font-mono text-zyrvae-400 hover:text-zyrvae-200 transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t.prospectDetail.backToList}
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zyrvae-100">
                {prospect.business_name || '[Sin nombre comercial]'}
              </h1>
              {qual && (
                <Badge variant="priority" value={qual.classification} size="md" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs font-mono text-zyrvae-500">
                {prospect.lead_key}
              </span>
              <button
                type="button"
                onClick={copyLeadKey}
                className="text-zyrvae-500 hover:text-zyrvae-300 p-0.5 rounded transition-colors"
                title="Copiar lead_key"
              >
                {copiedKey ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="traceability" value={prospect.traceability_status} />
            <Badge variant="status" value={prospect.status} />
          </div>
        </div>
      </div>

      {/* Grid of the 10 Structured Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 01: Original Intake Data */}
        <Card
          title={t.prospectDetail.sectionOriginal}
          subtitle="Datos recopilados en el punto de entrada (WF-01)"
        >
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-zyrvae-800/60">
              <span className="text-zyrvae-500">{t.prospectDetail.sourceChannel}:</span>
              <span className="font-mono text-zyrvae-200">{prospect.source || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-zyrvae-800/60">
              <span className="text-zyrvae-500">{t.prospectDetail.sourceUrl}:</span>
              <span className="font-mono text-zyrvae-200 truncate max-w-[240px]">
                {prospect.source_url || 'N/A'}
              </span>
            </div>
            <div className="py-1.5">
              <span className="text-zyrvae-500 block mb-1">{t.prospectDetail.evidenceNotes}:</span>
              <p className="text-zyrvae-300 bg-zyrvae-950 p-2.5 rounded-lg border border-zyrvae-800 leading-relaxed font-sans text-xs">
                {prospect.evidence_notes || 'Sin notas adicionales ingresadas.'}
              </p>
            </div>
          </div>
        </Card>

        {/* Section 02: Normalized Data */}
        <Card
          title={t.prospectDetail.sectionNormalized}
          subtitle="Entidad comercial saneada y validada"
        >
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-zyrvae-800/60">
              <span className="text-zyrvae-500">Nombre Normalizado:</span>
              <span className="font-medium text-zyrvae-100">{prospect.business_name || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-zyrvae-800/60">
              <span className="text-zyrvae-500">Sitio Web:</span>
              <span className="font-mono text-zyrvae-200">
                {prospect.website_url ? (
                  <a
                    href={prospect.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-electric inline-flex items-center gap-1"
                  >
                    {prospect.website_url}
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                ) : (
                  <span className="text-rose-400 italic">No provisto</span>
                )}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-zyrvae-800/60">
              <span className="text-zyrvae-500">País / Jurisdicción:</span>
              <span className="font-mono text-zyrvae-200">{prospect.country || 'No declarado'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-zyrvae-500">Industria / Sector:</span>
              <span className="text-zyrvae-200">{prospect.industry || 'No especificada'}</span>
            </div>
          </div>
        </Card>

        {/* Section 03: Website Information */}
        <Card
          title={t.prospectDetail.sectionWebsite}
          subtitle="Redirecciones y latencia medidas durante la conexión HTTP"
        >
          {audit ? (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-zyrvae-800/60">
                <span className="text-zyrvae-500">{t.prospectDetail.initialUrl}:</span>
                <span className="font-mono text-zyrvae-200 truncate max-w-[240px]">
                  {audit.initial_url}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zyrvae-800/60">
                <span className="text-zyrvae-500">{t.prospectDetail.finalUrl}:</span>
                <span className="font-mono text-zyrvae-200 truncate max-w-[240px]">
                  {audit.final_url || audit.initial_url}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zyrvae-800/60">
                <span className="text-zyrvae-500">{t.prospectDetail.httpStatus}:</span>
                <span className="font-mono text-zyrvae-100 font-semibold">
                  HTTP {audit.http_status || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zyrvae-800/60">
                <span className="text-zyrvae-500">{t.prospectDetail.redirects}:</span>
                <span className="font-mono text-zyrvae-200">{audit.redirect_count}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-zyrvae-500">{t.prospectDetail.latency}:</span>
                <span className="font-mono text-zyrvae-200 font-medium">
                  {audit.response_time_ms ? `${audit.response_time_ms} ms` : 'N/A'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-zyrvae-500 py-4 text-center">
              {t.prospectDetail.noAuditMessage}
            </div>
          )}
        </Card>

        {/* Section 04: Technical Audit */}
        <Card
          title={t.prospectDetail.sectionAudit}
          subtitle="Evaluación objetiva de infraestructura web recopilada por WF-02"
        >
          {audit ? (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-zyrvae-800/60">
                <span className="text-zyrvae-500">{t.prospectDetail.sslStatus}:</span>
                {audit.ssl_active ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    HTTPS Activo (Seguro)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-400 font-medium">
                    <XCircle className="w-3.5 h-3.5" />
                    HTTP Inseguro (Sin cifrado)
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zyrvae-800/60">
                <span className="text-zyrvae-500">{t.prospectDetail.viewportStatus}:</span>
                {audit.has_viewport ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Viewport Móvil Detectado
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-400 font-medium">
                    <XCircle className="w-3.5 h-3.5" />
                    Sin Viewport Móvil
                  </span>
                )}
              </div>
              <div className="py-1.5 border-b border-zyrvae-800/60">
                <span className="text-zyrvae-500 block mb-1">{t.prospectDetail.pageTitle}:</span>
                <span className="text-zyrvae-200 font-medium">
                  {audit.page_title || (
                    <span className="text-zyrvae-500 italic">Sin etiqueta title encontrada</span>
                  )}
                </span>
              </div>
              <div className="py-1.5">
                <span className="text-zyrvae-500 block mb-1">{t.prospectDetail.metaDescription}:</span>
                <span className="text-zyrvae-200">
                  {audit.meta_description || (
                    <span className="text-zyrvae-500 italic">Sin meta description encontrada</span>
                  )}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-zyrvae-500 py-4 text-center">
              {t.prospectDetail.noAuditMessage}
            </div>
          )}
        </Card>

        {/* Section 05: Detected Technical Evidence */}
        <Card
          title={t.prospectDetail.sectionEvidence}
          subtitle="Inspección detallada del payload de evidencias (raw_evidence)"
          className="lg:col-span-2"
        >
          {audit?.raw_evidence ? (
            <JsonViewer
              data={audit.raw_evidence}
              title={`audit_id: ${audit.audit_id}`}
            />
          ) : (
            <div className="text-xs text-zyrvae-500 py-4 text-center">
              Sin evidencias crudas registradas.
            </div>
          )}
        </Card>

        {/* Section 06: Commercial Evaluation (WF-03) */}
        <Card
          title={t.prospectDetail.sectionQualification}
          subtitle="Desglose determinista de componentes de puntuación"
        >
          {qual ? (
            <div className="space-y-4 text-xs">
              <div className="flex items-baseline justify-between py-2 border-b border-zyrvae-800">
                <span className="text-zyrvae-400 font-medium">Puntuación Total Normalizada:</span>
                <div className="text-right">
                  {qual.score !== null ? (
                    <span className="text-2xl font-bold font-mono text-emerald-400">
                      {qual.score} <span className="text-xs text-zyrvae-400 font-sans">{t.prospectDetail.scorePoints}</span>
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-amber-400 font-medium">
                      {t.prospectDetail.scoreNull}
                    </span>
                  )}
                </div>
              </div>

              {/* Score breakdown if available */}
              {qual.score_components && typeof qual.score_components === 'object' && (
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between py-1 border-b border-zyrvae-800/40">
                    <span className="text-zyrvae-400">Componente Técnico (Máx. 40):</span>
                    <span className="font-mono text-zyrvae-200">
                      +{qual.score_components.technical} pts
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zyrvae-800/40">
                    <span className="text-zyrvae-400">Frescura & Coherencia Evidencia (Máx. 30):</span>
                    <span className="font-mono text-zyrvae-200">
                      +{qual.score_components.evidence} pts
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zyrvae-800/40">
                    <span className="text-zyrvae-400">Encaje de Servicios ZYRVAE (Máx. 20):</span>
                    <span className="font-mono text-zyrvae-200">
                      +{qual.score_components.services} pts
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zyrvae-400">Completitud de Información (Máx. 10):</span>
                    <span className="font-mono text-zyrvae-200">
                      +{qual.score_components.completeness} pts
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-zyrvae-500 py-4 text-center">
              {t.prospectDetail.noQualificationMessage}
            </div>
          )}
        </Card>

        {/* Section 07: Priority & Commercial Readiness */}
        <Card
          title={t.prospectDetail.sectionPriority}
          subtitle="Nivel comercial y autorización de prospección"
        >
          {qual ? (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-zyrvae-800/60">
                <span className="text-zyrvae-500">Clasificación Asignada:</span>
                <Badge variant="priority" value={qual.classification} />
              </div>
              <div className="flex justify-between py-1.5 border-b border-zyrvae-800/60">
                <span className="text-zyrvae-500">Etiqueta Legible:</span>
                <span className="font-medium text-zyrvae-200">{qual.priority_label}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-zyrvae-500">{t.prospectDetail.commercialUse}:</span>
                {qual.commercial_use_allowed ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {t.prospectDetail.commercialUseYes}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-400 font-medium">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {t.prospectDetail.commercialUseNo}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-zyrvae-500 py-4 text-center">
              {t.prospectDetail.noQualificationMessage}
            </div>
          )}
        </Card>

        {/* Section 08: Assessment Reasons */}
        <Card
          title={t.prospectDetail.sectionReasons}
          subtitle="Justificación y reglas desencadenadas por el motor WF-03"
          className="lg:col-span-2"
        >
          {qual ? (
            <div className="space-y-4 text-xs">
              {qual.explanation && (
                <div>
                  <span className="text-zyrvae-400 font-medium block mb-1">
                    Explicación de la Evaluación:
                  </span>
                  <p className="text-zyrvae-300 bg-zyrvae-950 p-3 rounded-lg border border-zyrvae-800 leading-relaxed font-sans">
                    {qual.explanation}
                  </p>
                </div>
              )}

              {qual.review_reasons && Array.isArray(qual.review_reasons) && qual.review_reasons.length > 0 && (
                <div>
                  <span className="text-amber-400 font-medium block mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Motivos de Derivación a Revisión Manual:
                  </span>
                  <div className="space-y-1.5">
                    {qual.review_reasons.map((r, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-200"
                      >
                        <span className="font-mono font-bold text-[11px] block">{r.code}</span>
                        <span className="text-xs text-amber-300 mt-0.5 block">{r.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {qual.exclusion_reason && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-200">
                  <span className="font-bold block text-xs">Motivo de Exclusión de Proceso Comercial:</span>
                  <span className="text-xs text-rose-300 mt-1 block">{qual.exclusion_reason}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-zyrvae-500 py-4 text-center">
              {t.prospectDetail.noQualificationMessage}
            </div>
          )}
        </Card>

        {/* Section 09: History & Traceability */}
        <Card
          title={t.prospectDetail.sectionHistory}
          subtitle="Metadatos criptográficos, huella digital de evidencia y versiones"
        >
          {qual ? (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-zyrvae-800/60">
                <span className="text-zyrvae-500">Qualification ID:</span>
                <span className="font-mono text-zyrvae-200 text-[11px]">{qual.qualification_id}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zyrvae-800/60">
                <span className="text-zyrvae-500">{t.prospectDetail.rulesVersion}:</span>
                <span className="font-mono text-zyrvae-200">{qual.rules_version}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zyrvae-800/60">
                <span className="text-zyrvae-500">{t.prospectDetail.evidenceFingerprint}:</span>
                <span className="font-mono text-zyrvae-300 text-[11px] truncate max-w-[200px]">
                  {qual.evidence_fingerprint}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-zyrvae-500">Fecha de Evaluación:</span>
                <span className="font-mono text-zyrvae-200">
                  {new Date(qual.evaluated_at).toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-zyrvae-500 py-4 text-center">
              Sin historial de calificación registrado.
            </div>
          )}
        </Card>

        {/* Section 10: Observations & Pending Items */}
        <Card
          title={t.prospectDetail.sectionPending}
          subtitle="Verificación de integridad y validaciones pendientes"
        >
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-zyrvae-800/60">
              <span className="text-zyrvae-500">Estado de Trazabilidad:</span>
              <Badge variant="traceability" value={prospect.traceability_status} />
            </div>

            <div className="py-1.5 border-b border-zyrvae-800/60">
              <span className="text-zyrvae-500 block mb-1">Indicadores de Datos Incompletos:</span>
              {prospect.incompleteIndicators.length > 0 ? (
                <div className="space-y-1">
                  {prospect.incompleteIndicators.map((ind, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-amber-300 bg-amber-950/30 px-2.5 py-1 rounded border border-amber-800/30 font-mono text-[11px]"
                    >
                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>{ind.label} ({ind.field})</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Todos los campos esenciales están completos
                </span>
              )}
            </div>

            <div className="py-1.5">
              <span className="text-zyrvae-500 block mb-1">Revisión Humana Obligatoria:</span>
              {prospect.requires_review ? (
                <span className="text-amber-400 font-medium">
                  Sí — Requiere validación manual antes de uso en producción.
                </span>
              ) : (
                <span className="text-zyrvae-400">
                  No — Registro apto y validado sin banderas pendientes.
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
