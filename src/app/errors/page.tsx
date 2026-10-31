'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';
import { ErrorLogRecord, WorkflowOrigin } from '@/types/error-log';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { JsonViewer } from '@/components/ui/JsonViewer';
import {
  AlertTriangle,
  Shield,
  Info,
  FilterX,
  Code2,
  X,
} from 'lucide-react';

export default function ErrorsPage() {
  const { t } = useTranslation();
  const [errors, setErrors] = useState<ErrorLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterWorkflow, setFilterWorkflow] = useState('ALL');
  const [inspectError, setInspectError] = useState<ErrorLogRecord | null>(null);

  useEffect(() => {
    async function loadErrors() {
      try {
        const res = await fetch('/api/errors');
        const json = await res.json();
        if (json.data) {
          setErrors(json.data);
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
    loadErrors();
  }, []);

  const filtered = useMemo(() => {
    return errors.filter((err) => {
      // Search
      const s = search.toLowerCase().trim();
      if (s) {
        const matchType = err.error_type?.toLowerCase().includes(s);
        const matchMsg = err.error_message?.toLowerCase().includes(s);
        const matchKey = err.lead_key?.toLowerCase().includes(s);
        const matchRec = err.record_id?.toLowerCase().includes(s);
        if (!matchType && !matchMsg && !matchKey && !matchRec) return false;
      }

      // Workflow filter
      if (filterWorkflow !== 'ALL') {
        if (err.workflow !== filterWorkflow) return false;
      }

      return true;
    });
  }, [errors, search, filterWorkflow]);

  const resetFilters = () => {
    setSearch('');
    setFilterWorkflow('ALL');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zyrvae-100">
          {t.errors.title}
        </h1>
        <p className="text-xs sm:text-sm text-zyrvae-400 mt-1">
          {t.errors.subtitle}
        </p>
      </div>

      {/* Error Alert if query failed in LIVE mode */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start justify-between gap-3 shadow-subtle">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-rose-200">
                Error en consulta LIVE READ-ONLY de Data Table lead_intake_errors
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

      {/* STRICT READ-ONLY AUDIT NOTICE */}
      <div className="p-4 rounded-xl bg-zyrvae-900 border border-zyrvae-750 flex items-start gap-3">
        <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-semibold text-zyrvae-200">
            {t.common.readOnlyMode} — Sin Operaciones de Escritura
          </span>
          <p className="text-zyrvae-400 leading-relaxed font-sans">
            {t.errors.readOnlyNotice}
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
              placeholder={t.errors.searchPlaceholder}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <FilterDropdown
              label={t.errors.filterWorkflow}
              value={filterWorkflow}
              onChange={setFilterWorkflow}
              options={[
                { label: `${t.errors.filterWorkflow}: ${t.common.all}`, value: 'ALL' },
                { label: 'WF-01 (Lead Intake)', value: 'WF-01' },
                { label: 'WF-02 (Website Audit)', value: 'WF-02' },
                { label: 'WF-03 (Qualification)', value: 'WF-03' },
              ]}
            />

            {(search || filterWorkflow !== 'ALL') && (
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

      {/* Errors Table */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-xs text-zyrvae-400">
            {t.common.loading}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={t.errors.emptyErrors}
            description="No existen errores registrados que coincidan con la búsqueda."
          />
        ) : (
          <div className="overflow-x-auto -mx-5 -my-5">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zyrvae-800/80 bg-zyrvae-950/60 text-zyrvae-400 uppercase tracking-wider text-[10px] font-mono">
                  <th className="py-3 px-4 font-medium">{t.errors.colTimestamp}</th>
                  <th className="py-3 px-4 font-medium">{t.errors.colWorkflow}</th>
                  <th className="py-3 px-4 font-medium">{t.errors.colLeadKey}</th>
                  <th className="py-3 px-4 font-medium">{t.errors.colErrorType}</th>
                  <th className="py-3 px-4 font-medium">{t.errors.colMessage}</th>
                  <th className="py-3 px-4 font-medium">{t.errors.colStatus}</th>
                  <th className="py-3 px-4 font-medium text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zyrvae-800/50">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-zyrvae-850/40 transition-colors"
                  >
                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono text-[11px] text-zyrvae-400 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>

                    {/* Workflow Origin */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono text-[11px] font-bold text-zyrvae-200 bg-zyrvae-850 px-2 py-0.5 rounded border border-zyrvae-750">
                        {item.workflow}
                      </span>
                    </td>

                    {/* Lead Key */}
                    <td className="py-3 px-4 font-mono text-[11px] text-zyrvae-300 max-w-[160px] truncate">
                      {item.lead_key || item.record_id || 'N/A'}
                    </td>

                    {/* Error Type */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono text-[11px] text-rose-300 bg-rose-950/50 px-2 py-0.5 rounded border border-rose-800/50">
                        {item.error_type}
                      </span>
                    </td>

                    {/* Error Message */}
                    <td className="py-3 px-4 text-zyrvae-300 max-w-sm font-sans text-xs">
                      {item.error_message}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zyrvae-850 text-zyrvae-400 border border-zyrvae-750">
                        {item.status}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {item.raw_payload ? (
                        <button
                          type="button"
                          onClick={() => setInspectError(item)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono text-zyrvae-300 hover:text-zyrvae-100 bg-zyrvae-850 hover:bg-zyrvae-800 border border-zyrvae-750 transition-colors"
                        >
                          <Code2 className="w-3 h-3 text-electric" />
                          Payload
                        </button>
                      ) : (
                        <span className="text-zyrvae-600 font-mono text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Error Raw Payload Modal */}
      {inspectError && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zyrvae-900 border border-zyrvae-750 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-card">
            <div className="p-4 border-b border-zyrvae-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zyrvae-100 font-mono">
                  Detalle Técnico del Error ({inspectError.error_type})
                </h3>
                <span className="text-xs text-zyrvae-400 font-mono">
                  {inspectError.id} • {inspectError.workflow}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectError(null)}
                className="p-1 rounded-lg text-zyrvae-400 hover:text-zyrvae-100 hover:bg-zyrvae-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300">
                {inspectError.error_message}
              </div>

              {inspectError.raw_payload && (
                <JsonViewer
                  data={inspectError.raw_payload}
                  title="raw_payload"
                />
              )}
            </div>

            <div className="p-4 border-t border-zyrvae-800 flex justify-end bg-zyrvae-950/60">
              <button
                type="button"
                onClick={() => setInspectError(null)}
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
