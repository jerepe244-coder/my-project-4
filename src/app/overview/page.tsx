'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';
import { OverviewMetrics } from '@/lib/data-service';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Users,
  Globe,
  Award,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Server,
  Activity,
} from 'lucide-react';

export default function OverviewPage() {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await fetch('/api/overview');
        const json = await res.json();
        if (json.data) {
          setMetrics(json.data);
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
    loadMetrics();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-zyrvae-900 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-zyrvae-900 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const priorityTotal =
    (metrics?.priorityDistribution?.HIGH || 0) +
    (metrics?.priorityDistribution?.MEDIUM || 0) +
    (metrics?.priorityDistribution?.LOW || 0) +
    (metrics?.priorityDistribution?.REVIEW || 0) +
    (metrics?.priorityDistribution?.EXCLUDED || 0) || 1;

  return (
    <div className="space-y-8">
      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zyrvae-100">
          {t.overview.title}
        </h1>
        <p className="text-xs sm:text-sm text-zyrvae-400 mt-1">
          {t.overview.subtitle}
        </p>
      </div>

      {/* Error Alert if query failed in LIVE mode */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start justify-between gap-3 shadow-subtle">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-rose-200">
                Error en consulta LIVE READ-ONLY
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
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Mode & Health Alert Banner */}
      <div className="p-4 rounded-xl bg-zyrvae-900/90 border border-zyrvae-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-zyrvae-850 border border-zyrvae-750 flex items-center justify-center shrink-0">
            {metrics?.isSyntheticMode ? (
              <ShieldAlert className="w-5 h-5 text-blue-400" />
            ) : (
              <Server className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-zyrvae-200">
              {metrics?.isSyntheticMode
                ? t.overview.systemHealthSynthetic
                : t.overview.systemHealthLive}
            </div>
            <p className="text-[11px] text-zyrvae-500 mt-0.5">
              {metrics?.isSyntheticMode
                ? 'Los datos visualizados provienen del lote sintético aislado. Cero modificaciones en base de datos real.'
                : 'Conectado de forma segura con la API del backend n8n Cloud.'}
            </p>
          </div>
        </div>
        <Link
          href="/system"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-electric hover:text-blue-400 transition-colors shrink-0"
        >
          {t.common.learnMore}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Core Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title={t.overview.totalProspects}
          value={metrics?.totalProspects ?? 0}
          description={t.overview.totalProspectsDesc}
          icon={<Users className="w-4 h-4" />}
          variant="default"
        />
        <MetricCard
          title={t.overview.recentProspects}
          value={metrics?.recentProspects ?? 0}
          description={t.overview.recentProspectsDesc}
          icon={<Clock className="w-4 h-4" />}
          variant="accent"
        />
        <MetricCard
          title={t.overview.auditsCompleted}
          value={metrics?.auditsCount ?? 0}
          description={t.overview.auditsCompletedDesc}
          icon={<Globe className="w-4 h-4" />}
          variant="default"
        />
        <MetricCard
          title={t.overview.evaluationsPerformed}
          value={metrics?.qualificationsCount ?? 0}
          description={t.overview.evaluationsPerformedDesc}
          icon={<Award className="w-4 h-4" />}
          variant="default"
        />
        <MetricCard
          title={t.overview.reviewRequired}
          value={metrics?.reviewRequiredCount ?? 0}
          description={t.overview.reviewRequiredDesc}
          icon={<AlertTriangle className="w-4 h-4" />}
          variant="warning"
        />
        <MetricCard
          title={t.overview.errorRecords}
          value={metrics?.errorRecordsCount ?? 0}
          description={t.overview.errorRecordsDesc}
          icon={<AlertTriangle className="w-4 h-4" />}
          variant="error"
        />
      </div>

      {/* Grid: Priority Breakdown & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Priority Distribution Chart Card */}
        <div className="lg:col-span-5">
          <Card
            title={t.overview.priorityDistribution}
            subtitle="Clasificación determinista generada por el motor WF-03"
            action={
              <Link
                href="/qualification"
                className="text-xs text-electric hover:text-blue-400 flex items-center gap-1 font-mono"
              >
                {t.common.details}
                <ArrowRight className="w-3 h-3" />
              </Link>
            }
          >
            <div className="space-y-4">
              {/* Stacked Progress Bar */}
              <div className="h-3 w-full bg-zyrvae-950 rounded-full overflow-hidden flex border border-zyrvae-800">
                <div
                  style={{
                    width: `${((metrics?.priorityDistribution.HIGH || 0) / priorityTotal) * 100}%`,
                  }}
                  className="bg-emerald-500 transition-all duration-500"
                  title="Prioridad Alta"
                />
                <div
                  style={{
                    width: `${((metrics?.priorityDistribution.MEDIUM || 0) / priorityTotal) * 100}%`,
                  }}
                  className="bg-amber-500 transition-all duration-500"
                  title="Prioridad Media"
                />
                <div
                  style={{
                    width: `${((metrics?.priorityDistribution.LOW || 0) / priorityTotal) * 100}%`,
                  }}
                  className="bg-slate-500 transition-all duration-500"
                  title="Prioridad Baja"
                />
                <div
                  style={{
                    width: `${((metrics?.priorityDistribution.REVIEW || 0) / priorityTotal) * 100}%`,
                  }}
                  className="bg-purple-500 transition-all duration-500"
                  title="Revisión Requerida"
                />
                <div
                  style={{
                    width: `${((metrics?.priorityDistribution.EXCLUDED || 0) / priorityTotal) * 100}%`,
                  }}
                  className="bg-rose-500 transition-all duration-500"
                  title="Excluido Test"
                />
              </div>

              {/* Priority Legend Rows */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-zyrvae-800/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-zyrvae-300">Prioridad Alta (≥ 70 pts)</span>
                  </div>
                  <div className="font-mono font-medium text-zyrvae-100">
                    {metrics?.priorityDistribution.HIGH || 0}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs py-1.5 border-b border-zyrvae-800/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-zyrvae-300">Prioridad Media (45-69 pts)</span>
                  </div>
                  <div className="font-mono font-medium text-zyrvae-100">
                    {metrics?.priorityDistribution.MEDIUM || 0}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs py-1.5 border-b border-zyrvae-800/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                    <span className="text-zyrvae-300">Prioridad Baja (&lt; 45 pts)</span>
                  </div>
                  <div className="font-mono font-medium text-zyrvae-100">
                    {metrics?.priorityDistribution.LOW || 0}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs py-1.5 border-b border-zyrvae-800/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="text-zyrvae-300">Revisión Requerida</span>
                  </div>
                  <div className="font-mono font-medium text-zyrvae-100">
                    {metrics?.priorityDistribution.REVIEW || 0}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-zyrvae-300">Excluidos (Test Data)</span>
                  </div>
                  <div className="font-mono font-medium text-zyrvae-100">
                    {metrics?.priorityDistribution.EXCLUDED || 0}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Activity List Card */}
        <div className="lg:col-span-7">
          <Card
            title={t.overview.recentActivity}
            subtitle={t.overview.recentActivityDesc}
            action={
              <Link
                href="/prospects"
                className="text-xs text-electric hover:text-blue-400 flex items-center gap-1 font-mono"
              >
                Ver todos
                <ArrowRight className="w-3 h-3" />
              </Link>
            }
          >
            {metrics?.recentActivity && metrics.recentActivity.length > 0 ? (
              <div className="divide-y divide-zyrvae-800/60">
                {metrics.recentActivity.map((act) => (
                  <div key={act.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-zyrvae-850 border border-zyrvae-750 flex items-center justify-center shrink-0 mt-0.5">
                      <Activity className="w-3.5 h-3.5 text-zyrvae-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-zyrvae-200 truncate">
                          {act.title}
                        </span>
                        <span className="text-[10px] font-mono text-zyrvae-500 shrink-0">
                          {new Date(act.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-zyrvae-400 mt-0.5 truncate">
                        {act.description}
                      </p>
                      {act.leadKey && (
                        <div className="mt-1">
                          <Badge variant="custom" size="sm" className="font-mono text-[10px]">
                            {act.leadKey}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-zyrvae-500 py-6 text-center">
                {t.overview.noRecentActivity}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
