import React from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Key, RefreshCw } from 'lucide-react';

export type ApiStatusType = 'unknown' | 'checking' | 'connected' | 'degraded' | 'error' | 'unconfigured';

interface ApiStatusIndicatorProps {
  status: ApiStatusType;
  latencyMs?: number | null;
  onOpenDiagnostics: () => void;
  compact?: boolean;
  isAgentTheme?: boolean;
  showLabel?: boolean;
}

export default function ApiStatusIndicator({
  status,
  latencyMs,
  onOpenDiagnostics,
  compact = false,
  isAgentTheme = false,
  showLabel = true
}: ApiStatusIndicatorProps) {
  const renderIndicator = () => {
    switch (status) {
      case 'connected':
        return (
          <div
            onClick={onOpenDiagnostics}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all cursor-pointer group active:scale-95 ${
              isAgentTheme
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/50 hover:border-emerald-700'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100 hover:border-emerald-300'
            }`}
            title="Kie API Подключено. Нажмите для проведения диагностики"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {showLabel && (
              <span className="text-[11px] font-semibold font-display tracking-tight flex items-center gap-1">
                Kie API: OK
                {typeof latencyMs === 'number' && latencyMs > 0 && (
                  <span className="font-mono text-[10px] opacity-80">({latencyMs}мс)</span>
                )}
              </span>
            )}
          </div>
        );

      case 'degraded':
        return (
          <div
            onClick={onOpenDiagnostics}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all cursor-pointer group active:scale-95 ${
              isAgentTheme
                ? 'bg-amber-950/40 text-amber-400 border-amber-800/60 hover:bg-amber-900/50'
                : 'bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-100'
            }`}
            title="Kie API работает с ограничениями или нестабильно. Нажмите для проведения диагностики"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            {showLabel && (
              <span className="text-[11px] font-semibold font-display tracking-tight">
                Kie API: Предупреждение
              </span>
            )}
          </div>
        );

      case 'error':
        return (
          <div
            onClick={onOpenDiagnostics}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all cursor-pointer group active:scale-95 ${
              isAgentTheme
                ? 'bg-rose-950/40 text-rose-400 border-rose-800/60 hover:bg-rose-900/50'
                : 'bg-rose-50 text-rose-700 border-rose-200/80 hover:bg-rose-100'
            }`}
            title="Ошибка подключения к Kie API. Нажмите для проведения диагностики"
          >
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            {showLabel && (
              <span className="text-[11px] font-semibold font-display tracking-tight">
                Kie API: Ошибка
              </span>
            )}
          </div>
        );

      case 'checking':
        return (
          <div
            onClick={onOpenDiagnostics}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
              isAgentTheme
                ? 'bg-sky-950/40 text-sky-400 border-sky-800/60'
                : 'bg-sky-50 text-sky-700 border-sky-200/80'
            }`}
            title="Выполняется проверка соединения с Kie API..."
          >
            <RefreshCw className="h-3 w-3 animate-spin text-sky-500 shrink-0" />
            {showLabel && (
              <span className="text-[11px] font-semibold font-display tracking-tight">
                Проверка API...
              </span>
            )}
          </div>
        );

      case 'unconfigured':
      case 'unknown':
      default:
        return (
          <div
            onClick={onOpenDiagnostics}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all cursor-pointer group active:scale-95 ${
              isAgentTheme
                ? 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
            title="Ключ Kie API не настроен. Нажмите для настройки и диагностики"
          >
            <Key className="h-3 w-3 text-slate-400 shrink-0" />
            {showLabel && (
              <span className="text-[11px] font-semibold font-display tracking-tight">
                API не настроен
              </span>
            )}
          </div>
        );
    }
  };

  return renderIndicator();
}
