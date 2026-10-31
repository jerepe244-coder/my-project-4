'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';
import { InsightsData } from '@/lib/data-service';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  TrendingUp,
  AlertCircle,
  ShieldCheck,
  Smartphone,
  Search,
  Zap,
  Info,
} from 'lucide-react';

export default function InsightsPage() {
  const { t } = useTranslation();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInsights() {
      try {
        const res = await fetch('/api/insights');
        const json = await res.json();
        if (json.data) {
          setInsights(json.data);
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
    loadInsights();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-zyrvae-900 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-72 bg-zyrvae-900 rounded-xl animate-pulse" />
          <div className="h-72 bg-zyrvae-900 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const categoryIcons: Record<string, React.ReactNode> = {
    WEB_SECURITY_SSL: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
    MOBILE_RESPONSIVE_UX: <Smartphone className="w-4 h-4 text-amber-400" />,
    SEO_ONPAGE: <Search className="w-4 h-4 text-blue-400" />,
    WEB_PERFORMANCE: <Zap className="w-4 h-4 text-purple-400" />,
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zyrvae-100">
          {t.insights.title}
        </h1>
        <p className="text-xs sm:text-sm text-zyrvae-400 mt-1">
          {t.insights.subtitle}
        </p>
      </div>

      {/* Error Alert if query failed in LIVE mode */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start justify-between gap-3 shadow-subtle">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-rose-200">
                Error en consulta LIVE READ-ONLY de Insights
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

      {/* Methodological Notice */}
      <div className="p-4 rounded-xl bg-zyrvae-900 border border-zyrvae-750 flex items-start gap-3">
        <Info className="w-5 h-5 text-zyrvae-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-semibold text-zyrvae-200">
            Diferenciación de Patrones Descriptivos vs Conclusiones Comerciales
          </span>
          <p className="text-zyrvae-400 leading-relaxed font-sans">
            {t.insights.methodologyNotice}
          </p>
        </div>
      </div>

      {/* Small sample alert if synthetic */}
      {insights?.isSyntheticMode && (
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 flex items-center gap-2.5 text-xs text-amber-300">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{t.insights.smallSampleWarning}</span>
        </div>
      )}

      {/* Grid: Technical Issues & Opportunity Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Frequent Technical Issues */}
        <Card
          title={t.insights.frequentIssuesTitle}
          subtitle={t.insights.frequentIssuesSubtitle}
        >
          <div className="space-y-4">
            {insights?.technicalIssues.map((issue) => (
              <div key={issue.code} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {categoryIcons[issue.serviceCode] || <TrendingUp className="w-4 h-4 text-zyrvae-400" />}
                    <span className="font-medium text-zyrvae-200">{issue.label}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-zyrvae-100 font-semibold">{issue.count} sitios</span>
                    <span className="text-zyrvae-400 text-[11px]">({issue.percentage}%)</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full bg-zyrvae-950 rounded-full overflow-hidden border border-zyrvae-800">
                  <div
                    style={{ width: `${Math.min(100, Math.max(8, issue.percentage))}%` }}
                    className="h-full bg-gradient-to-r from-electric to-blue-500 rounded-full transition-all duration-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Opportunity Categories */}
        <Card
          title={t.insights.opportunityCategoriesTitle}
          subtitle={t.insights.opportunityCategoriesSubtitle}
        >
          <div className="space-y-4">
            {insights?.opportunityCategories.map((cat, idx) => (
              <div key={idx} className="p-3.5 rounded-lg bg-zyrvae-950 border border-zyrvae-800 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-zyrvae-200 block">
                    {cat.category}
                  </span>
                  <span className="text-[11px] font-mono text-zyrvae-500">
                    {cat.count} prospectos identificados
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-base font-bold font-mono text-electric">
                    {cat.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Accessibility & Web Status Distribution */}
        <Card
          title={t.insights.auditDistributionTitle}
          subtitle="Proporción de disponibilidad y conectividad HTTP observada"
        >
          {insights && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-zyrvae-950 border border-zyrvae-800 text-center">
                  <span className="text-[10px] font-mono text-zyrvae-500 uppercase block">Accesibles</span>
                  <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                    {insights.accessibilityBreakdown.accessible}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-zyrvae-950 border border-zyrvae-800 text-center">
                  <span className="text-[10px] font-mono text-zyrvae-500 uppercase block">Inaccesibles</span>
                  <span className="text-xl font-bold font-mono text-rose-400 mt-1 block">
                    {insights.accessibilityBreakdown.inaccessible}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-zyrvae-950 border border-zyrvae-800 text-center">
                  <span className="text-[10px] font-mono text-zyrvae-500 uppercase block">Errores</span>
                  <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
                    {insights.accessibilityBreakdown.error}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zyrvae-950/60 border border-zyrvae-800/80 text-[11px] text-zyrvae-400 leading-relaxed font-sans">
                Los sitios inaccesibles no se interpretan como baja calidad técnica del sitio, sino como indisponibilidad transitoria que requiere reauditoría técnica para evitar clasificaciones erróneas.
              </div>
            </div>
          )}
        </Card>

        {/* Priority Breakdown */}
        <Card
          title={t.insights.priorityBreakdownTitle}
          subtitle="Distribución observada en las evaluaciones deterministas de WF-03"
        >
          <div className="space-y-3">
            {insights?.priorityBreakdown.map((item) => (
              <div key={item.classification} className="flex items-center justify-between text-xs py-1.5 border-b border-zyrvae-800/60 last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant="priority" value={item.classification} size="sm" />
                  <span className="text-zyrvae-300 font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-zyrvae-100 font-semibold">{item.count}</span>
                  <span className="text-zyrvae-500 text-[11px]">({item.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
