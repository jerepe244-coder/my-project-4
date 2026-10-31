'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';
import { EnrichedProspect } from '@/lib/data-service';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Eye,
  FilterX,
} from 'lucide-react';

export default function ProspectsPage() {
  const { t } = useTranslation();
  const [prospects, setProspects] = useState<EnrichedProspect[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterAudit, setFilterAudit] = useState('ALL');
  const [filterTraceability, setFilterTraceability] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    async function fetchProspects() {
      try {
        const res = await fetch('/api/prospects');
        const json = await res.json();
        if (json.data) {
          setProspects(json.data);
        }
      } catch (err) {
        console.error('Failed to load prospects', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProspects();
  }, []);

  // Filtered & Searched Data
  const filtered = useMemo(() => {
    return prospects.filter((p) => {
      // Search
      const s = search.toLowerCase().trim();
      if (s) {
        const matchName = p.business_name?.toLowerCase().includes(s);
        const matchUrl = p.website_url?.toLowerCase().includes(s);
        const matchKey = p.lead_key?.toLowerCase().includes(s);
        const matchCountry = p.country?.toLowerCase().includes(s);
        if (!matchName && !matchUrl && !matchKey && !matchCountry) return false;
      }

      // Priority Filter
      if (filterPriority !== 'ALL') {
        const qualClassification = p.qualification?.classification;
        if (qualClassification !== filterPriority) return false;
      }

      // Audit Filter
      if (filterAudit !== 'ALL') {
        if (filterAudit === 'AUDITED' && (!p.audit || !p.audit.is_accessible)) return false;
        if (filterAudit === 'NOT_AUDITED' && p.audit) return false;
        if (filterAudit === 'AUDIT_FAILED' && (!p.audit || p.audit.is_accessible)) return false;
      }

      // Traceability Filter
      if (filterTraceability !== 'ALL') {
        if (p.traceability_status !== filterTraceability) return false;
      }

      // Status Filter
      if (filterStatus !== 'ALL') {
        if (p.status !== filterStatus) return false;
      }

      return true;
    });
  }, [prospects, search, filterPriority, filterAudit, filterTraceability, filterStatus]);

  // Pagination calculation
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const resetFilters = () => {
    setSearch('');
    setFilterPriority('ALL');
    setFilterAudit('ALL');
    setFilterTraceability('ALL');
    setFilterStatus('ALL');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zyrvae-100">
          {t.prospects.title}
        </h1>
        <p className="text-xs sm:text-sm text-zyrvae-400 mt-1">
          {t.prospects.subtitle}
        </p>
      </div>

      {/* Control Bar: Search & Filter Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="w-full">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder={t.prospects.searchPlaceholder}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zyrvae-800/60">
            <div className="flex flex-wrap items-center gap-2">
              <FilterDropdown
                label={t.prospects.filterPriority}
                value={filterPriority}
                onChange={(v) => {
                  setFilterPriority(v);
                  setPage(1);
                }}
                options={[
                  { label: `${t.prospects.filterPriority}: ${t.common.all}`, value: 'ALL' },
                  { label: 'Prioridad Alta', value: 'PRIORITY_HIGH' },
                  { label: 'Prioridad Media', value: 'PRIORITY_MEDIUM' },
                  { label: 'Prioridad Baja', value: 'PRIORITY_LOW' },
                  { label: 'Revisión Requerida', value: 'REVIEW_REQUIRED' },
                  { label: 'Excluido (Test)', value: 'EXCLUDED_TEST_DATA' },
                ]}
              />

              <FilterDropdown
                label={t.prospects.filterAudit}
                value={filterAudit}
                onChange={(v) => {
                  setFilterAudit(v);
                  setPage(1);
                }}
                options={[
                  { label: `${t.prospects.filterAudit}: ${t.common.all}`, value: 'ALL' },
                  { label: 'Auditado Exitoso', value: 'AUDITED' },
                  { label: 'Sin Auditar', value: 'NOT_AUDITED' },
                  { label: 'Fallo Auditoría', value: 'AUDIT_FAILED' },
                ]}
              />

              <FilterDropdown
                label={t.prospects.filterTraceability}
                value={filterTraceability}
                onChange={(v) => {
                  setFilterTraceability(v);
                  setPage(1);
                }}
                options={[
                  { label: `${t.prospects.filterTraceability}: ${t.common.all}`, value: 'ALL' },
                  { label: 'Real Confirmado', value: 'CONFIRMED_REAL' },
                  { label: 'Dato de Prueba', value: 'TEST_DATA' },
                  { label: 'Trazabilidad Desconocida', value: 'UNKNOWN_TRACEABILITY' },
                ]}
              />

              <FilterDropdown
                label={t.prospects.filterStatus}
                value={filterStatus}
                onChange={(v) => {
                  setFilterStatus(v);
                  setPage(1);
                }}
                options={[
                  { label: `${t.prospects.filterStatus}: ${t.common.all}`, value: 'ALL' },
                  { label: 'Validado (validated)', value: 'validated' },
                  { label: 'Pendiente (pending_review)', value: 'pending_review' },
                  { label: 'Rechazado (rejected)', value: 'rejected' },
                ]}
              />
            </div>

            {(search || filterPriority !== 'ALL' || filterAudit !== 'ALL' || filterTraceability !== 'ALL' || filterStatus !== 'ALL') && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1.5 text-xs text-zyrvae-400 hover:text-zyrvae-200 transition-colors py-1 px-2.5 rounded-lg bg-zyrvae-850 border border-zyrvae-750"
              >
                <FilterX className="w-3.5 h-3.5 text-zyrvae-500" />
                {t.common.clearFilters}
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Prospects Table / Directory */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-xs text-zyrvae-400">
            {t.common.loading}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={t.common.noResults}
            description="Ningún prospecto coincide con los filtros o parámetros de búsqueda aplicados."
            action={
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-zyrvae-800 text-zyrvae-200 border border-zyrvae-700 hover:bg-zyrvae-750 transition-colors"
              >
                {t.common.clearFilters}
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto -mx-5 -my-5">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zyrvae-800/80 bg-zyrvae-950/60 text-zyrvae-400 uppercase tracking-wider text-[10px] font-mono">
                  <th className="py-3 px-4 font-medium">{t.prospects.colBusinessName}</th>
                  <th className="py-3 px-4 font-medium">{t.prospects.colWebsite}</th>
                  <th className="py-3 px-4 font-medium">{t.prospects.colLocation}</th>
                  <th className="py-3 px-4 font-medium">{t.prospects.colDate}</th>
                  <th className="py-3 px-4 font-medium">{t.prospects.colStatus}</th>
                  <th className="py-3 px-4 font-medium">{t.prospects.colAudit}</th>
                  <th className="py-3 px-4 font-medium">{t.prospects.colPriority}</th>
                  <th className="py-3 px-4 font-medium text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zyrvae-800/50">
                {paginated.map((p) => {
                  const hasAudit = Boolean(p.audit);
                  const auditAccessible = p.audit?.is_accessible;
                  const qual = p.qualification;

                  return (
                    <tr
                      key={p.lead_key}
                      className="hover:bg-zyrvae-850/40 transition-colors group"
                    >
                      {/* Business Name */}
                      <td className="py-3.5 px-4 font-medium text-zyrvae-100 max-w-xs">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/prospects/${p.lead_key}`}
                            className="hover:text-blue-400 transition-colors font-medium truncate block"
                          >
                            {p.business_name || (
                              <span className="text-zyrvae-500 italic">
                                [Sin nombre comercial]
                              </span>
                            )}
                          </Link>
                          {p.incompleteIndicators.length > 0 && (
                            <span
                              className="shrink-0 text-amber-400"
                              title={`${t.prospects.incompleteNotice}: ${p.incompleteIndicators.map((i) => i.label).join(', ')}`}
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-zyrvae-500 block truncate mt-0.5">
                          {p.lead_key}
                        </span>
                      </td>

                      {/* Website */}
                      <td className="py-3.5 px-4 max-w-[200px] truncate">
                        {p.website_url ? (
                          <a
                            href={p.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zyrvae-300 hover:text-electric inline-flex items-center gap-1 font-mono text-[11px] truncate"
                          >
                            <span className="truncate">{p.website_url.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                          </a>
                        ) : (
                          <span className="text-zyrvae-600 italic font-mono text-[11px]">
                            {t.prospects.missingWebsite}
                          </span>
                        )}
                      </td>

                      {/* Location / Country */}
                      <td className="py-3.5 px-4 text-zyrvae-400 whitespace-nowrap">
                        <span className="font-mono text-[11px] bg-zyrvae-850 px-1.5 py-0.5 rounded border border-zyrvae-750">
                          {p.country || 'N/A'}
                        </span>
                      </td>

                      {/* Intake Date */}
                      <td className="py-3.5 px-4 text-zyrvae-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>

                      {/* Record Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge variant="status" value={p.status} size="sm" />
                      </td>

                      {/* Audit Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {hasAudit ? (
                          auditAccessible ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              {t.prospects.audited}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-950/60 text-rose-300 border border-rose-800/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              {t.prospects.auditFailed}
                            </span>
                          )
                        ) : (
                          <span className="text-zyrvae-500 text-[11px]">
                            {t.prospects.notAudited}
                          </span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {qual ? (
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="priority"
                              value={qual.classification}
                              size="sm"
                            />
                            {qual.score !== null && (
                              <span className="text-[11px] font-mono text-zyrvae-300 font-semibold">
                                {qual.score}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zyrvae-600 text-[11px] font-mono">
                            Pendiente
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/prospects/${p.lead_key}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-zyrvae-300 hover:text-zyrvae-100 bg-zyrvae-850 hover:bg-zyrvae-800 border border-zyrvae-750 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-zyrvae-400" />
                          <span className="hidden sm:inline">{t.common.details}</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {!loading && filtered.length > 0 && (
          <div className="pt-4 mt-2 border-t border-zyrvae-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zyrvae-400">
            <div>
              Mostrando <span className="text-zyrvae-200 font-mono font-medium">{paginated.length}</span> de{' '}
              <span className="text-zyrvae-200 font-mono font-medium">{filtered.length}</span> prospectos
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-zyrvae-750 bg-zyrvae-850 text-zyrvae-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zyrvae-800 transition-colors"
                aria-label={t.common.previous}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-xs px-2">
                {t.common.page} <span className="text-zyrvae-200 font-bold">{page}</span> {t.common.of}{' '}
                <span className="text-zyrvae-200">{totalPages}</span>
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-zyrvae-750 bg-zyrvae-850 text-zyrvae-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zyrvae-800 transition-colors"
                aria-label={t.common.next}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
