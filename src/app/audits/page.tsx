'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import { WebsiteAudit, CategorizedFinding } from '@/types/audit';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { JsonViewer } from '@/components/ui/JsonViewer';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Globe,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Code2,
  X,
  FilterX,
} from 'lucide-react';

interface EnrichedAudit extends WebsiteAudit {
  categorizedFindings: CategorizedFinding[];
}

export default function AuditsPage() {
  const { t } = useTranslation();
  const [audits, setAudits] = useState<EnrichedAudit[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterAccessible, setFilterAccessible] = useState('ALL');
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  // Modal for raw evidence inspector
  const [inspectAudit, setInspectAudit] = useState<EnrichedAudit | null>(null);

  useEffect(() => {
    async function loadAudits() {
      try {
        const res = await fetch('/api/audits');
        const json = await res.json();
        if (json.data) {
          setAudits(json.data);
        }
      } catch (err) {
        console.error('Failed to load audits', err);
      } finally {
        setLoading(false);
      }
    }
    loadAudits();
  }, []);

  const filtered = useMemo(() => {
    return audits.filter((a) => {
      // Search
      const s = search.toLowerCase().trim();
      if (s) {
        const matchUrl = a.initial_url?.toLowerCase().includes(s) || a.final_url?.toLowerCase().includes(s);
        const matchId = a.audit_id?.toLowerCase().includes(s) || a.lead_key?.toLowerCase().includes(s);
        const matchTitle = a.page_title?.toLowerCase().includes(s);
        if (!matchUrl && !matchId && !matchTitle) return false;
      }

      // Accessible filter
      if (filterAccessible !== 'ALL') {
        if (filterAccessible === 'YES' && !a.is_accessible) return false;
        if (filterAccessible === 'NO' && a.is_accessible) return false;
      }

      // Severity filter
      if (filterSeverity !== 'ALL') {
        const hasSev = a.categorizedFindings?.some((f) => f.severity === filterSeverity);
        if (!hasSev) return false;
      }

      return true;
    });
  }, [audits, search, filterAccessible, filterSeverity]);

  const resetFilters = () => {
    setSearch('');
    setFilterAccessible('ALL');
    setFilterSeverity('ALL');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zyrvae-100">
          {t.audits.title}
        </h1>
        <p className="text-xs sm:text-sm text-zyrvae-400 mt-1">
          {t.audits.subtitle}
        </p>
      </div>

      {/* Distinction Guide Card */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl bg-zyrvae-900 border border-zyrvae-800 text-xs font-mono">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-zyrvae-950/70 border border-zyrvae-800">
          <Badge variant="severity" value="confirmed_problem" size="sm" />
          <span className="text-[11px] text-zyrvae-300">Problema Confirmado</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-zyrvae-950/70 border border-zyrvae-800">
          <Badge variant="severity" value="warning" size="sm" />
          <span className="text-[11px] text-zyrvae-300">Advertencia</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-zyrvae-950/70 border border-zyrvae-800">
          <Badge variant="severity" value="unverified" size="sm" />
          <span className="text-[11px] text-zyrvae-300">Dato no Verificado</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-zyrvae-950/70 border border-zyrvae-800">
          <Badge variant="severity" value="missing_data" size="sm" />
          <span className="text-[11px] text-zyrvae-300">Dato Ausente</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-zyrvae-950/70 border border-zyrvae-800 col-span-2 sm:col-span-1">
          <Badge variant="severity" value="audit_error" size="sm" />
          <span className="text-[11px] text-zyrvae-300">Error de Auditoría</span>
        </div>
      </div>

      {/* Search & Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t.audits.searchPlaceholder}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <FilterDropdown
              label={t.audits.filterAccessible}
              value={filterAccessible}
              onChange={setFilterAccessible}
              options={[
                { label: `${t.audits.filterAccessible}: ${t.common.all}`, value: 'ALL' },
                { label: t.audits.accessibleYes, value: 'YES' },
                { label: t.audits.accessibleNo, value: 'NO' },
              ]}
            />

            <FilterDropdown
              label={t.audits.filterSeverity}
              value={filterSeverity}
              onChange={setFilterSeverity}
              options={[
                { label: `${t.audits.filterSeverity}: ${t.common.all}`, value: 'ALL' },
                { label: 'Problema Confirmado', value: 'confirmed_problem' },
                { label: 'Advertencia', value: 'warning' },
                { label: 'Dato no Verificado', value: 'unverified' },
                { label: 'Dato Ausente', value: 'missing_data' },
                { label: 'Error de Auditoría', value: 'audit_error' },
              ]}
            />

            {(search || filterAccessible !== 'ALL' || filterSeverity !== 'ALL') && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1.5 text-xs text-zyrvae-400 hover:text-zyrvae-200 transition-colors py-1.5 px-2.5 rounded-lg bg-zyrvae-850 border border-zyrvae-750"
              >
                <FilterX className="w-3.5 h-3.5 text-zyrvae-500" />
                {t.common.clearFilters}
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Audits List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-xs text-zyrvae-400">
            {t.common.loading}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={t.common.noResults}
            description="No se encontraron auditorías con los criterios de búsqueda seleccionados."
            action={
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-zyrvae-800 text-zyrvae-200 border border-zyrvae-700"
              >
                {t.common.clearFilters}
              </button>
            }
          />
        ) : (
          filtered.map((audit) => (
            <Card key={audit.audit_id} className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                {/* Site info and status */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={audit.final_url || audit.initial_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold font-mono text-zyrvae-100 hover:text-electric inline-flex items-center gap-1.5 transition-colors truncate"
                    >
                      {audit.initial_url}
                      <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                    </a>
                    {audit.is_accessible ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        HTTP {audit.http_status || 200} OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-950/60 text-rose-300 border border-rose-800/50">
                        <XCircle className="w-3 h-3 text-rose-400" />
                        {audit.error_code || `HTTP ${audit.http_status || 500}`}
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-zyrvae-400 bg-zyrvae-850 px-2 py-0.5 rounded border border-zyrvae-750">
                      {audit.response_time_ms ? `${audit.response_time_ms} ms` : 'N/A'}
                    </span>
                  </div>

                  <div className="text-xs text-zyrvae-300 font-medium">
                    {audit.page_title || (
                      <span className="text-zyrvae-500 italic">Sin etiqueta title detectada</span>
                    )}
                  </div>

                  <div className="text-xs text-zyrvae-400 line-clamp-2">
                    {audit.meta_description || (
                      <span className="text-zyrvae-500 italic">Meta description ausente en el documento</span>
                    )}
                  </div>

                  {/* Core Technical Checks */}
                  <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] font-mono">
                    <span className="flex items-center gap-1 text-zyrvae-300">
                      SSL/HTTPS:{' '}
                      {audit.ssl_active ? (
                        <span className="text-emerald-400 font-semibold">ACTIVO</span>
                      ) : (
                        <span className="text-rose-400 font-semibold">INACTIVO</span>
                      )}
                    </span>
                    <span className="text-zyrvae-600">•</span>
                    <span className="flex items-center gap-1 text-zyrvae-300">
                      Viewport Móvil:{' '}
                      {audit.has_viewport ? (
                        <span className="text-emerald-400 font-semibold">DETECTADO</span>
                      ) : (
                        <span className="text-rose-400 font-semibold">FALTANTE</span>
                      )}
                    </span>
                    <span className="text-zyrvae-600">•</span>
                    <span className="flex items-center gap-1 text-zyrvae-300">
                      Redirecciones:{' '}
                      <span className="text-zyrvae-100 font-semibold">{audit.redirect_count}</span>
                    </span>
                  </div>
                </div>

                {/* Right Column: Categorized Findings & Raw JSON Trigger */}
                <div className="flex flex-col sm:items-end justify-between gap-3 shrink-0 lg:max-w-xs">
                  <div className="text-[11px] font-mono text-zyrvae-500">
                    Fecha: {new Date(audit.audit_date).toLocaleDateString()}
                  </div>

                  <button
                    type="button"
                    onClick={() => setInspectAudit(audit)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-zyrvae-850 hover:bg-zyrvae-800 text-zyrvae-300 hover:text-zyrvae-100 border border-zyrvae-750 transition-colors"
                  >
                    <Code2 className="w-3.5 h-3.5 text-electric" />
                    Inspeccionar Evidencias
                  </button>
                </div>
              </div>

              {/* Categorized Findings Pills */}
              {audit.categorizedFindings && audit.categorizedFindings.length > 0 && (
                <div className="mt-4 pt-3 border-t border-zyrvae-800/80 flex flex-wrap gap-2 items-center">
                  <span className="text-[11px] font-mono text-zyrvae-500 uppercase tracking-wider mr-1">
                    Hallazgos:
                  </span>
                  {audit.categorizedFindings.map((f, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-zyrvae-950 border border-zyrvae-800"
                    >
                      <Badge variant="severity" value={f.severity} size="sm" />
                      <span className="text-zyrvae-200 font-medium">{f.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Raw Evidence Modal */}
      {inspectAudit && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zyrvae-900 border border-zyrvae-750 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-card">
            <div className="p-4 border-b border-zyrvae-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zyrvae-100 font-mono">
                  {t.audits.rawEvidenceModalTitle}
                </h3>
                <span className="text-xs text-zyrvae-400 font-mono">
                  {inspectAudit.audit_id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectAudit(null)}
                className="p-1 rounded-lg text-zyrvae-400 hover:text-zyrvae-100 hover:bg-zyrvae-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* Commercial Hypotheses */}
              {inspectAudit.commercial_hypotheses && (
                <div>
                  <h4 className="text-xs font-semibold text-zyrvae-300 uppercase tracking-wider mb-2 font-mono">
                    {t.audits.hypothesesTitle}
                  </h4>
                  <JsonViewer data={inspectAudit.commercial_hypotheses} title="commercial_hypotheses" />
                </div>
              )}

              {/* Raw Evidence Payload */}
              <div>
                <h4 className="text-xs font-semibold text-zyrvae-300 uppercase tracking-wider mb-2 font-mono">
                  Evidencia Técnica Cruda
                </h4>
                <JsonViewer data={inspectAudit.raw_evidence} title="raw_evidence" />
              </div>
            </div>

            <div className="p-4 border-t border-zyrvae-800 flex justify-end bg-zyrvae-950/60">
              <button
                type="button"
                onClick={() => setInspectAudit(null)}
                className="px-4 py-2 rounded-lg bg-zyrvae-800 hover:bg-zyrvae-750 text-zyrvae-200 text-xs font-medium border border-zyrvae-700 transition-colors"
              >
                {t.common.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
