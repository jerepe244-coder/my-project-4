'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import { SystemStatusData, DataTableStatus } from '@/types/system';
import { Card } from '@/components/ui/Card';
import {
  Server,
  Database,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Layers,
  KeyRound,
  FileCheck2,
  Lock,
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
  const isPartial = status?.connection_status === 'PARTIAL';
  const isCredentialsMissing = status?.connection_status === 'CREDENTIALS_MISSING';
  const isSynthetic = status?.is_synthetic_mode || status?.mode === 'DEMO';
  const isLive = status?.mode === 'LIVE_READ_ONLY';

  const getTableStatusBadge = (readStatus: DataTableStatus['read_status']) => {
    switch (readStatus) {
      case 'AVAILABLE':
        return (
          <span className="font-mono text-[11px] text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            CONSULTABLE
          </span>
        );
      case 'SYNTHETIC_MOCK':
        return (
          <span className="font-mono text-[11px] text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/40 inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-blue-400" />
            DEMO MOCK
          </span>
        );
      case 'CREDENTIALS_REQUIRED':
        return (
          <span className="font-mono text-[11px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40 inline-flex items-center gap-1">
            <KeyRound className="w-3 h-3 text-amber-400" />
            CREDENCIALES REQUERIDAS
          </span>
        );
      case 'PERMISSION_DENIED':
        return (
          <span className="font-mono text-[11px] text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/50 inline-flex items-center gap-1">
            <Lock className="w-3 h-3 text-rose-400" />
            PERMISO DENEGADO
          </span>
        );
      case 'NOT_FOUND':
        return (
          <span className="font-mono text-[11px] text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/50 inline-flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-400" />
            NO ENCONTRADA
          </span>
        );
      default:
        return (
          <span className="font-mono text-[11px] text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/50 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            INACCESIBLE
          </span>
        );
    }
  };

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
                  : isPartial || isCredentialsMissing
                  ? 'bg-amber-950/50 border-amber-800 text-amber-400'
                  : 'bg-rose-950/50 border-rose-800 text-rose-400'
              }`}
            >
              <Server className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-base font-bold text-zyrvae-100">
                  {t.system.n8nConnection}
                </h3>

                {/* Connection Status Badge */}
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    CONNECTED (TABLAS VALIDADAS)
                  </span>
                ) : isSynthetic ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800">
                    <ShieldCheck className="w-3 h-3 text-blue-400" />
                    MODO DEMO (SINTÉTICO AISLADO)
                  </span>
                ) : isCredentialsMissing ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800">
                    <KeyRound className="w-3 h-3 text-amber-400" />
                    LIVE: CREDENCIALES PENDIENTES
                  </span>
                ) : isPartial ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    LIVE: ACCESO PARCIAL A TABLAS
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800">
                    <XCircle className="w-3 h-3 text-rose-400" />
                    LIVE: ERROR DE CONEXIÓN
                  </span>
                )}

                {/* Mode Pill */}
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zyrvae-850 text-zyrvae-300 border border-zyrvae-750">
                  MODO: {status?.mode || (isSynthetic ? 'DEMO' : 'LIVE_READ_ONLY')}
                </span>
              </div>

              <div className="text-xs text-zyrvae-400 font-mono">
                Instancia: <span className="text-zyrvae-200">{status?.base_url}</span>
              </div>

              <p className="text-xs text-zyrvae-400 leading-relaxed font-sans max-w-xl">
                {isSynthetic
                  ? 'El dashboard opera en modo DEMO con datos sintéticos aislados. Para activar LIVE READ-ONLY configure N8N_API_KEY y RUN_SYNTHETIC_TEST=false en Vercel.'
                  : isConnected
                  ? 'Conexión validada con n8n Cloud en modo estrictamente LIVE READ-ONLY. Las cuatro Data Tables fueron verificadas exitosamente.'
                  : status?.error_message ||
                    'Operando en modo LIVE READ-ONLY. No se utilizarán datos sintéticos como fallback silencioso.'}
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

      {/* 5-Level Health Inspection Breakdown */}
      <Card
        title="Validación de Capas de Integración (Criterios de Conexión)"
        subtitle="Distinción estricta de los 5 estados de disponibilidad exigidos"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Credenciales configuradas */}
          <div className="p-3.5 rounded-lg bg-zyrvae-950 border border-zyrvae-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-medium text-zyrvae-400">1. Credenciales</span>
              {status?.credentials_configured ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-zyrvae-500" />
              )}
            </div>
            <div className="text-xs font-semibold text-zyrvae-200">
              {status?.credentials_configured ? 'Configuradas' : 'Pendientes'}
            </div>
            <p className="text-[10px] text-zyrvae-500">
              {status?.credentials_configured
                ? 'N8N_BASE_URL y N8N_API_KEY presentes'
                : 'Falta N8N_API_KEY'}
            </p>
          </div>

          {/* 2. Autenticación validada */}
          <div className="p-3.5 rounded-lg bg-zyrvae-950 border border-zyrvae-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-medium text-zyrvae-400">2. Autenticación</span>
              {status?.authentication_validated ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : isSynthetic ? (
                <ShieldCheck className="w-4 h-4 text-blue-400" />
              ) : (
                <XCircle className="w-4 h-4 text-zyrvae-500" />
              )}
            </div>
            <div className="text-xs font-semibold text-zyrvae-200">
              {isSynthetic
                ? 'No requerida (Demo)'
                : status?.authentication_validated
                ? 'Validada HTTP 200'
                : 'No validada'}
            </div>
            <p className="text-[10px] text-zyrvae-500">
              {isSynthetic
                ? 'Modo demo aislado'
                : status?.authentication_validated
                ? 'API Key aceptada por n8n'
                : 'Sin token o rechazada'}
            </p>
          </div>

          {/* 3. API accesible */}
          <div className="p-3.5 rounded-lg bg-zyrvae-950 border border-zyrvae-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-medium text-zyrvae-400">3. API Accesible</span>
              {status?.api_accessible ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : isSynthetic ? (
                <ShieldCheck className="w-4 h-4 text-blue-400" />
              ) : (
                <XCircle className="w-4 h-4 text-zyrvae-500" />
              )}
            </div>
            <div className="text-xs font-semibold text-zyrvae-200">
              {isSynthetic
                ? 'Aislada (Demo)'
                : status?.api_accessible
                ? 'Accesible'
                : 'Inaccesible'}
            </div>
            <p className="text-[10px] text-zyrvae-500">
              {isSynthetic
                ? 'Cero peticiones de red'
                : status?.api_accessible
                ? 'Servidor n8n respondiendo'
                : 'Timeout o fallo de red'}
            </p>
          </div>

          {/* 4. Data Tables consultables */}
          <div className="p-3.5 rounded-lg bg-zyrvae-950 border border-zyrvae-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-medium text-zyrvae-400">4. Data Tables</span>
              {status?.tables_queryable ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : isSynthetic ? (
                <ShieldCheck className="w-4 h-4 text-blue-400" />
              ) : (
                <XCircle className="w-4 h-4 text-zyrvae-500" />
              )}
            </div>
            <div className="text-xs font-semibold text-zyrvae-200">
              {isSynthetic
                ? 'Mocks Activos'
                : status?.tables_queryable
                ? '4/4 Consultables'
                : 'Incompletas / No'}
            </div>
            <p className="text-[10px] text-zyrvae-500">
              {isSynthetic
                ? 'Lote sintético preparado'
                : status?.tables_queryable
                ? 'Las 4 tablas verificadas'
                : 'Pendiente de prueba'}
            </p>
          </div>

          {/* 5. Datos reales cargados */}
          <div className="p-3.5 rounded-lg bg-zyrvae-950 border border-zyrvae-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-medium text-zyrvae-400">5. Datos Reales</span>
              {status?.real_data_loaded ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : isSynthetic ? (
                <ShieldCheck className="w-4 h-4 text-blue-400" />
              ) : (
                <XCircle className="w-4 h-4 text-zyrvae-500" />
              )}
            </div>
            <div className="text-xs font-semibold text-zyrvae-200">
              {isSynthetic
                ? 'Cero Datos Reales'
                : status?.real_data_loaded
                ? 'Cargados'
                : 'Sin Cargar'}
            </div>
            <p className="text-[10px] text-zyrvae-500">
              {isSynthetic
                ? 'Modo seguro sin mezclas'
                : status?.real_data_loaded
                ? 'Directo de n8n Data Tables'
                : 'Pendiente de consulta'}
            </p>
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
          subtitle="Estado de lectura individual de las 4 Data Tables nativas de n8n"
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

                  <div>{getTableStatusBadge(tbl.read_status)}</div>
                </div>

                <p className="text-xs text-zyrvae-400 font-sans">
                  {tbl.purpose}
                </p>

                {tbl.error_message && (
                  <div className="text-[11px] font-mono text-rose-400 bg-rose-950/30 p-2 rounded border border-rose-900/50">
                    {tbl.error_message}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-zyrvae-500 pt-1 border-t border-zyrvae-850 gap-2">
                  <span>Table ID: {tbl.id}</span>
                  <span>Registros: {tbl.rows_count ?? 0}</span>
                  {tbl.last_queried && (
                    <span>Consulta: {new Date(tbl.last_queried).toLocaleTimeString()}</span>
                  )}
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
            subtitle="Variables configuradas vs pendientes (los valores reales nunca se exponen al cliente)"
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
                        Pendiente
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
            subtitle="Procedimiento para pasar de DEMO a LIVE READ-ONLY en Vercel"
          >
            <div className="space-y-3 text-xs text-zyrvae-300">
              <div className="p-3 rounded-lg bg-zyrvae-950 border border-zyrvae-800 space-y-1">
                <span className="font-mono font-bold text-electric block">
                  1. Obtener API Key en n8n Cloud
                </span>
                <p className="text-zyrvae-400 text-[11px]">
                  En su consola n8n Cloud, ingrese a <strong>Settings &gt; n8n API</strong> y genere una API Key con permisos de lectura para Data Tables (`dataTable:read`, `dataTableRow:read`).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zyrvae-950 border border-zyrvae-800 space-y-1">
                <span className="font-mono font-bold text-electric block">
                  2. Cargar Variables en Vercel
                </span>
                <p className="text-zyrvae-400 text-[11px]">
                  En Vercel Project Settings &gt; Environment Variables, cree:
                  <br />• <code className="text-zyrvae-200">N8N_API_KEY</code> = [su clave de n8n] (Server-side ONLY, sin NEXT_PUBLIC_).
                  <br />• <code className="text-zyrvae-200">RUN_SYNTHETIC_TEST</code> = <code className="text-amber-300">false</code> (para activar LIVE READ-ONLY).
                  <br />• <code className="text-zyrvae-200">N8N_BASE_URL</code> = <code className="text-zyrvae-300">https://zyrvae.app.n8n.cloud</code>
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zyrvae-950 border border-zyrvae-800 space-y-1">
                <span className="font-mono font-bold text-electric block">
                  3. Re-desplegar (Redeploy)
                </span>
                <p className="text-zyrvae-400 text-[11px]">
                  Dispare un Redeploy en Vercel para que las nuevas variables tomen efecto en runtime.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zyrvae-950 border border-zyrvae-800 space-y-1">
                <span className="font-mono font-bold text-electric block">
                  4. Verificar en System Status
                </span>
                <p className="text-zyrvae-400 text-[11px]">
                  Vuelva a esta vista. El estado pasará a CONNECTED únicamente tras comprobar exitosamente el acceso de solo lectura a las 4 Data Tables.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
