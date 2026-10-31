'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import { SystemStatusData } from '@/types/system';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Server,
  Database,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Clock,
} from 'lucide-react';

export default function SystemStatusPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/system/status');
      const json = await res.json();
      if (json.data) {
        setStatus(json.data);
      }
    } catch (err) {
      console.error('Failed to load system status', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-zyrvae-900 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-zyrvae-900 rounded-xl animate-pulse" />
          <div className="h-64 bg-zyrvae-900 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const isConnected = status?.connection_status === 'CONNECTED';
  const isSynthetic = status?.is_synthetic_mode;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zyrvae-100">
            {t.system.title}
          </h1>
          <p className="text-xs sm:text-sm text-zyrvae-400 mt-1">
            {t.system.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={fetchStatus}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono bg-zyrvae-850 hover:bg-zyrvae-800 text-zyrvae-200 border border-zyrvae-750 transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-electric ${refreshing ? 'animate-spin' : ''}`} />
          {t.common.refresh}
        </button>
      </div>

      {/* Main Connection Status Card */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                isConnected
                  ? 'bg-emerald-950/50 border-emerald-800 text-emerald-400'
                  : isSynthetic
                  ? 'bg-blue-950/50 border-blue-800 text-blue-400'
                  : 'bg-rose-950/50 border-rose-800 text-rose-400'
              }`}
            >
              <Server className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-zyrvae-100">
                  {t.system.n8nConnection}
                </h3>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    CONECTADO
                  </span>
                ) : isSynthetic ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800">
                    <ShieldAlert className="w-3 h-3 text-blue-400" />
                    AISLAMIENTO SINTÉTICO (DEMO)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800">
                    <XCircle className="w-3 h-3 text-rose-400" />
                    SIN CONEXIÓN
                  </span>
                )}
              </div>

              <div className="text-xs text-zyrvae-400 font-mono">
                Instancia: <span className="text-zyrvae-200">{status?.base_url}</span>
              </div>

              <p className="text-xs text-zyrvae-400 leading-relaxed font-sans max-w-xl">
                {isSynthetic
                  ? 'El dashboard opera de forma totalmente aislada con datos sintéticos seguros. Para habilitar consultas a n8n Cloud en vivo, configure N8N_API_KEY en Vercel.'
                  : 'Backend seguro conectado a n8n Cloud mediante credenciales server-side.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 font-mono text-xs text-zyrvae-400 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-zyrvae-800">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-zyrvae-500" />
              <span>{t.system.lastCheck}:</span>
              <span className="text-zyrvae-200">
                {status ? new Date(status.last_checked).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
            {status?.response_time_ms !== undefined && (
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{t.system.responseTime}:</span>
                <span className="text-zyrvae-200">{status.response_time_ms} ms</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Grid: Workflows Status & Data Tables Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflows Status */}
        <Card
          title={t.system.workflowsTitle}
          subtitle={t.system.workflowsNotice}
        >
          <div className="space-y-3">
            {status?.workflows.map((wf) => (
              <div
                key={wf.id}
                className="p-3.5 rounded-lg bg-zyrvae-950 border border-zyrvae-800 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-zyrvae-200 bg-zyrvae-850 px-2 py-0.5 rounded border border-zyrvae-750">
                      {wf.code}
                    </span>
                    <span className="text-xs font-semibold text-zyrvae-100">
                      {wf.name}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/50">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Inactivo (Seguro)
                  </span>
                </div>

                <p className="text-xs text-zyrvae-400 font-sans">
                  {wf.description}
                </p>

                <div className="flex items-center justify-between text-[11px] font-mono text-zyrvae-500 pt-1 border-t border-zyrvae-850">
                  <span>ID: {wf.id}</span>
                  <span>Tabla: {wf.destination_table}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Data Tables Status */}
        <Card
          title={t.system.tablesTitle}
          subtitle="Estado de lectura de las 4 Data Tables nativas de n8n"
        >
          <div className="space-y-3">
            {status?.tables.map((tbl) => (
              <div
                key={tbl.id}
                className="p-3.5 rounded-lg bg-zyrvae-950 border border-zyrvae-800 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-electric shrink-0" />
                    <span className="font-mono text-xs font-bold text-zyrvae-100">
                      {tbl.name}
                    </span>
                  </div>

                  <span className="font-mono text-[11px] text-blue-300 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-800/40">
                    {tbl.read_status}
                  </span>
                </div>

                <p className="text-xs text-zyrvae-400 font-sans">
                  {tbl.purpose}
                </p>

                <div className="flex items-center justify-between text-[11px] font-mono text-zyrvae-500 pt-1 border-t border-zyrvae-850">
                  <span>Table ID: {tbl.id}</span>
                  <span>Registros: {tbl.rows_count ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Environment Variables Checklist & Vercel Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Variables Checklist */}
        <div className="lg:col-span-7">
          <Card
            title={t.system.envTitle}
            subtitle={t.system.envNotice}
          >
            <div className="space-y-2">
              {status?.env_variables.map((env) => (
                <div
                  key={env.name}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-zyrvae-950 border border-zyrvae-800 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-zyrvae-200">
                        {env.name}
                      </span>
                      {env.required_for_live && (
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-800/30">
                          Requerida para Live
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zyrvae-500">{env.description}</p>
                  </div>

                  <div>
                    {env.is_set ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Configurada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zyrvae-500">
                        <XCircle className="w-3.5 h-3.5 text-zyrvae-600" />
                        No configurada
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Step-by-Step Vercel Guide */}
        <div className="lg:col-span-5">
          <Card
            title={t.system.vercelGuideTitle}
            subtitle="Pasos para conectar n8n Cloud en producción"
          >
            <div className="space-y-3 text-xs text-zyrvae-300">
              <div className="p-3 rounded-lg bg-zyrvae-950 border border-zyrvae-800 space-y-1">
                <span className="font-mono font-bold text-electric block">
                  {t.system.vercelStep1}
                </span>
                <p className="text-zyrvae-400 text-[11px]">
                  Seleccione el repositorio conectado jerepe244-coder/my-project-4.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zyrvae-950 border border-zyrvae-800 space-y-1">
                <span className="font-mono font-bold text-electric block">
                  {t.system.vercelStep2}
                </span>
                <p className="text-zyrvae-400 text-[11px]">
                  Acceda a las opciones de configuración de variables server-side.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zyrvae-950 border border-zyrvae-800 space-y-1">
                <span className="font-mono font-bold text-electric block">
                  {t.system.vercelStep3}
                </span>
                <p className="text-zyrvae-400 text-[11px]">
                  Asegure que la clave se guarde de forma privada (nunca con prefijo NEXT_PUBLIC_).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zyrvae-950 border border-zyrvae-800 space-y-1">
                <span className="font-mono font-bold text-electric block">
                  {t.system.vercelStep4}
                </span>
                <p className="text-zyrvae-400 text-[11px]">
                  {t.system.vercelStep5}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
