'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';
import { LeadQualification } from '@/types/qualification';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Award,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  FilterX,
} from 'lucide-react';

export default function QualificationPage() {
  const { t } = useTranslation();
  const [qualifications, setQualifications] = useState<LeadQualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterReview, setFilterReview] = useState('ALL');

  useEffect(() => {
    async function loadQualifications() {
      try {
        const res = await fetch('/api/qualifications');
        const json = await res.json();
        if (json.data) {
          setQualifications(json.data);
        } else if (json.error) {
          setError(json.error);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al conectar con la API';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    loadQualifications();
  }, []);

  const filtered = useMemo(() => {
    return qualifications.filter((q) => {
      // Search
      const s = search.toLowerCase().trim();
      if (s) {
        const matchName = q.business_name?.toLowerCase().includes(s);
        const matchKey = q.lead_key?.toLowerCase().includes(s);
        const matchUrl = q.website_url?.toLowerCase().includes(s);
        if (!matchName && !matchKey && !matchUrl) return false;
      }

      // Priority filter
      if (filterPriority !== 'ALL') {
        if (q.classification !== filterPriority) return false;
      }

      // Review filter
      if (filterReview !== 'ALL') {
        if (filterReview === 'YES' && !q.requires_review) return false;
        if (filterReview === 'NO' && q.requires_review) return false;
      }

      return true;
    });
  }, [qualifications, search, filterPriority, filterReview]);

  const resetFilters = () => {
    setSearch('');
    setFilterPriority('ALL');
    setFilterReview('ALL');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zyrvae-100">
          {t.qualification.title}
        </h1>
        <p className="text-xs sm:text-sm text-zyrvae-400 mt-1">
          {t.qualification.subtitle}
        </p>
      </div>

      {/* Error Alert if query failed in LIVE mode */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start justify-between gap-3 shadow-subtle">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-rose-200">
                Error en consulta LIVE READ-ONLY de Data Table lead_qualifications
              </div>
              <p className="text-[11px] text-rose-300/80 mt-0.5">
                {error}
              </p>
            </div>
          </div>
          <Link
            href="/system"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-rose-400 hover:text-rose-300 transition-colors shrink-0"
          >
            Ver estado del sistema
          </Link>
        </div>
      )}

      {/* MANDATORY METHODOLOGY NOTICE CARD */}
      <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-800/70 shadow-subtle flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <h3 className="font-semibold text-blue-200">
            {t.qualification.methodologyTitle}
          </h3>
          <p className="text-blue-300/90 leading-relaxed font-sans">
            {t.qualification.methodologyBody}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por prospecto, dominio o lead_key..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <FilterDropdown
              label="Prioridad"
              value={filterPriority}
              onChange={setFilterPriority}
              options={[
                { label: 'Prioridad: Todas', value: 'ALL' },
                { label: 'Prioridad Alta', value: 'PRIORITY_HIGH' },
                { label: 'Prioridad Media', value: 'PRIORITY_MEDIUM' },
                { label: 'Prioridad Baja', value: 'PRIORITY_LOW' },
                { label: 'Revisión Requerida', value: 'REVIEW_REQUIRED' },
                { label: 'Excluido (Test)', value: 'EXCLUDED_TEST_DATA' },
              ]}
            />

            <FilterDropdown
              label="Revisión"
              value={filterReview}
              onChange={setFilterReview}
              options={[
                { label: 'Revisión: Todas', value: 'ALL' },
                { label: 'Requiere Revisión', value: 'YES' },
                { label: 'Sin Revisión Pendiente', value: 'NO' },
              ]}
            />

            {(search || filterPriority !== 'ALL' || filterReview !== 'ALL') && (
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

      {/* Qualifications List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-xs text-zyrvae-400">
            {t.common.loading}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={t.common.noResults}
            description="No se encontraron evaluaciones con los filtros seleccionados."
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
          filtered.map((qual) => {
            const scoreComponents = qual.score_components && typeof qual.score_components === 'object'
              ? qual.score_components
              : null;

            return (
              <Card key={qual.qualification_id} className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                  {/* Prospect & Evaluation Header */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/prospects/${qual.lead_key}`}
                        className="text-base font-bold text-zyrvae-100 hover:text-electric transition-colors"
                      >
                        {qual.business_name || qual.lead_key}
                      </Link>
                      <Badge variant="priority" value={qual.classification} size="md" />
                      {qual.commercial_use_allowed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
                          <ShieldCheck className="w-3 h-3" />
                          Apto Comercial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded border border-rose-800/40">
                          <ShieldAlert className="w-3 h-3" />
                          Uso Comercial Bloqueado
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-zyrvae-400 font-mono">
                      <span>lead_key: {qual.lead_key}</span>
                      {qual.website_url && (
                        <>
                          <span>•</span>
                          <a
                            href={qual.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-electric inline-flex items-center gap-1"
                          >
                            {qual.website_url}
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        </>
                      )}
                    </div>

                    {/* Explanation */}
                    {qual.explanation && (
                      <p className="text-xs text-zyrvae-300 bg-zyrvae-950/60 p-3 rounded-lg border border-zyrvae-800/80 leading-relaxed font-sans">
                        {qual.explanation}
                      </p>
                    )}

                    {/* Verified findings if any */}
                    {qual.verified_findings && Array.isArray(qual.verified_findings) && qual.verified_findings.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-2 items-center">
                        <span className="text-[11px] font-mono text-zyrvae-500 uppercase tracking-wider">
                          Hallazgos Verificados:
                        </span>
                        {qual.verified_findings.map((vf, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono bg-zyrvae-850 text-zyrvae-200 border border-zyrvae-750"
                          >
                            <span className="text-emerald-400 font-semibold">+{vf.points}</span>
                            <span>{vf.label}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Review Reasons Warning if any */}
                    {qual.review_reasons && Array.isArray(qual.review_reasons) && qual.review_reasons.length > 0 && (
                      <div className="pt-2 space-y-1">
                        {qual.review_reasons.map((r, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 p-2 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-200 text-xs"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-mono font-bold text-[11px] block">{r.code}</span>
                              <span className="text-amber-300/90 text-xs">{r.message}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Score & Evaluation Details */}
                  <div className="flex flex-col sm:items-end justify-between gap-4 shrink-0 lg:w-64 border-t lg:border-t-0 lg:border-l border-zyrvae-800 lg:pl-5 pt-4 lg:pt-0">
                    <div className="text-left sm:text-right">
                      <span className="text-[11px] font-mono text-zyrvae-500 uppercase tracking-wider block">
                        Puntuación (0-100)
                      </span>
                      {qual.score !== null ? (
                        <div className="text-3xl font-bold font-mono text-emerald-400 mt-0.5">
                          {qual.score}
                          <span className="text-xs text-zyrvae-500 font-sans ml-1">pts</span>
                        </div>
                      ) : (
                        <div className="text-xs font-mono text-amber-400 font-semibold mt-1">
                          Sin Puntuación
                        </div>
                      )}
                    </div>

                    {/* Score components breakdown */}
                    {scoreComponents && (
                      <div className="w-full space-y-1 text-[11px] font-mono text-zyrvae-400 pt-2 border-t border-zyrvae-800/60">
                        <div className="flex justify-between">
                          <span>Técnico:</span>
                          <span className="text-zyrvae-200">+{scoreComponents.technical}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Evidencia:</span>
                          <span className="text-zyrvae-200">+{scoreComponents.evidence}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Servicios:</span>
                          <span className="text-zyrvae-200">+{scoreComponents.services}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Completitud:</span>
                          <span className="text-zyrvae-200">+{scoreComponents.completeness}</span>
                        </div>
                      </div>
                    )}

                    <div className="w-full pt-2 text-[10px] font-mono text-zyrvae-500 flex items-center justify-between">
                      <span>Evaluado:</span>
                      <span>{new Date(qual.evaluated_at).toLocaleDateString()}</span>
                    </div>

                    <Link
                      href={`/prospects/${qual.lead_key}`}
                      className="inline-flex items-center gap-1 text-xs font-mono text-electric hover:text-blue-400 transition-colors"
                    >
                      Ver Ficha Completa
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
