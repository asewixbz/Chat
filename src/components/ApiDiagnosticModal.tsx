import React from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  RefreshCw,
  Key,
  CreditCard,
  Cpu,
  ShieldCheck,
  Zap,
  HelpCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { ModelId } from '../types';

export interface DiagnosticResult {
  timestamp: string;
  overallStatus: 'ok' | 'warning' | 'error' | 'unconfigured';
  totalLatencyMs: number;
  keyInfo: {
    configured: boolean;
    source: 'user' | 'env' | 'none';
    maskedKey: string;
    formatValid: boolean;
  };
  creditCheck: {
    status: 'ok' | 'error' | 'unconfigured';
    httpCode: number | null;
    latencyMs: number;
    balance: number | null;
    currency: string;
    error: string | null;
  };
  modelCheck: {
    testedModel: string;
    endpoint: string;
    status: 'ok' | 'warning' | 'error' | 'unconfigured';
    httpCode: number | null;
    latencyMs: number;
    hasContent: boolean;
    message: string;
    error: string | null;
  };
  recommendations: string[];
}

interface ApiDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnosticResult: DiagnosticResult | null;
  isDiagnosing: boolean;
  onRunDiagnostic: () => void;
  selectedModelId: ModelId;
  kieApiKey: string;
  onOpenKeySettings?: () => void;
  isAgentTheme?: boolean;
}

export default function ApiDiagnosticModal({
  isOpen,
  onClose,
  diagnosticResult,
  isDiagnosing,
  onRunDiagnostic,
  selectedModelId,
  kieApiKey,
  onOpenKeySettings,
  isAgentTheme = false
}: ApiDiagnosticModalProps) {
  if (!isOpen) return null;

  const getStatusBadge = (status: 'ok' | 'warning' | 'error' | 'unconfigured' | undefined) => {
    switch (status) {
      case 'ok':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold font-display">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Kie API Активен (200 OK)</span>
          </div>
        );
      case 'warning':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold font-display">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>Частичный отклики / Пустой ответ</span>
          </div>
        );
      case 'error':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold font-display">
            <XCircle className="h-4 w-4 text-rose-500" />
            <span>Ошибка соединения</span>
          </div>
        );
      case 'unconfigured':
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 text-xs font-semibold font-display">
            <Key className="h-4 w-4 text-slate-500" />
            <span>Ключ не настроен</span>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
      <div
        className={`w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border transition-all ${
          isAgentTheme
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-100 text-slate-900'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isAgentTheme ? 'border-slate-800 bg-slate-950/60' : 'border-slate-100 bg-slate-50/70'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display leading-snug">
                Диагностика и статус Kie API
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Мониторинг сети, авторизация и проверка отклика эндпоинтов
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Main Status Hero */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              isAgentTheme ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200/80'
            }`}
          >
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-display">
                Текущее состояние
              </span>
              <div>{getStatusBadge(diagnosticResult?.overallStatus)}</div>
              {diagnosticResult?.timestamp && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    Проверено:{' '}
                    {new Date(diagnosticResult.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                  {diagnosticResult.totalLatencyMs > 0 && (
                    <span className="font-mono text-sky-500 font-medium">
                      • {diagnosticResult.totalLatencyMs} мс
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={onRunDiagnostic}
              disabled={isDiagnosing}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0 font-display active:scale-95"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
              <span>{isDiagnosing ? 'Тестирование...' : 'Запустить тест'}</span>
            </button>
          </div>

          {/* Diagnostic Steps Checklist */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-display">
              Детали проверки
            </h4>

            <div className="grid grid-cols-1 gap-3">
              {/* Step 1: Key Check */}
              <div
                className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                  isAgentTheme ? 'bg-slate-950/50 border-slate-800' : 'bg-white border-slate-200/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500 shrink-0 mt-0.5">
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-xs font-bold font-display">Формат и источник API-ключа</h5>
                      <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-semibold">
                        {diagnosticResult?.keyInfo?.source === 'user'
                          ? 'Пользователь'
                          : diagnosticResult?.keyInfo?.source === 'env'
                          ? 'KIE_API_KEY (.env)'
                          : 'Отсутствует'}
                      </span>
                    </div>
                    <p className="text-[12px] text-slate-400 font-mono mt-0.5">
                      Ключ: {diagnosticResult?.keyInfo?.maskedKey || (kieApiKey ? `${kieApiKey.slice(0, 6)}...` : '(не задан)')}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 mt-0.5">
                  {diagnosticResult?.keyInfo?.configured ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-500" />
                  )}
                </div>
              </div>

              {/* Step 2: Auth & Balance Endpoint */}
              <div
                className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                  isAgentTheme ? 'bg-slate-950/50 border-slate-800' : 'bg-white border-slate-200/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 shrink-0 mt-0.5">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h5 className="text-xs font-bold font-display">Авторизация и эндпоинт баланса</h5>
                      {diagnosticResult?.creditCheck?.httpCode && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                            diagnosticResult.creditCheck.httpCode === 200
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-rose-500/10 text-rose-500'
                          }`}
                        >
                          HTTP {diagnosticResult.creditCheck.httpCode}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-slate-400">
                      Эндпоинт: <code className="font-mono text-[11px] text-slate-300">/api/v1/chat/credit</code>
                    </p>
                    {diagnosticResult?.creditCheck?.balance !== null &&
                      diagnosticResult?.creditCheck?.balance !== undefined && (
                        <p className="text-[12px] text-emerald-500 font-semibold font-mono">
                          Доступный баланс: {diagnosticResult.creditCheck.balance} {diagnosticResult.creditCheck.currency}
                        </p>
                      )}
                    {diagnosticResult?.creditCheck?.error && (
                      <p className="text-[11px] text-rose-400 leading-snug pt-0.5">
                        {diagnosticResult.creditCheck.error}
                      </p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 mt-0.5 flex items-center gap-1.5">
                  {diagnosticResult?.creditCheck?.latencyMs ? (
                    <span className="text-[11px] font-mono text-slate-400">
                      {diagnosticResult.creditCheck.latencyMs} мс
                    </span>
                  ) : null}
                  {diagnosticResult?.creditCheck?.status === 'ok' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : diagnosticResult?.creditCheck?.status === 'error' ? (
                    <XCircle className="h-4 w-4 text-rose-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Step 3: Model Completion Endpoint */}
              <div
                className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                  isAgentTheme ? 'bg-slate-950/50 border-slate-800' : 'bg-white border-slate-200/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 shrink-0 mt-0.5">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h5 className="text-xs font-bold font-display">Тест отклика модели ({selectedModelId})</h5>
                      {diagnosticResult?.modelCheck?.httpCode && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                            diagnosticResult.modelCheck.httpCode === 200
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-rose-500/10 text-rose-500'
                          }`}
                        >
                          HTTP {diagnosticResult.modelCheck.httpCode}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-slate-400">
                      {diagnosticResult?.modelCheck?.message || `Тестирование ${selectedModelId}`}
                    </p>
                    {diagnosticResult?.modelCheck?.error && (
                      <p className="text-[11px] text-rose-400 leading-snug pt-0.5">
                        {diagnosticResult.modelCheck.error}
                      </p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 mt-0.5 flex items-center gap-1.5">
                  {diagnosticResult?.modelCheck?.latencyMs ? (
                    <span className="text-[11px] font-mono text-slate-400">
                      {diagnosticResult.modelCheck.latencyMs} мс
                    </span>
                  ) : null}
                  {diagnosticResult?.modelCheck?.status === 'ok' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : diagnosticResult?.modelCheck?.status === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : diagnosticResult?.modelCheck?.status === 'error' ? (
                    <XCircle className="h-4 w-4 text-rose-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations & Tips Section */}
          {diagnosticResult?.recommendations && diagnosticResult.recommendations.length > 0 && (
            <div
              className={`p-4 rounded-xl border space-y-2 ${
                isAgentTheme
                  ? 'bg-sky-950/20 border-sky-900/50 text-sky-200'
                  : 'bg-sky-50/70 border-sky-200/80 text-sky-900'
              }`}
            >
              <h4 className="text-xs font-bold font-display flex items-center gap-1.5 text-sky-400">
                <ShieldCheck className="h-4 w-4" />
                <span>Рекомендации по устранению неполадок</span>
              </h4>
              <ul className="space-y-1.5 text-[12px]">
                {diagnosticResult.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-sky-500 shrink-0 font-bold">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Change Key Shortcut Footer */}
          {onOpenKeySettings && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">Нужно обновить API-ключ?</span>
              <button
                onClick={() => {
                  onClose();
                  onOpenKeySettings();
                }}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Key className="h-3.5 w-3.5" />
                Открыть настройки ключа
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
