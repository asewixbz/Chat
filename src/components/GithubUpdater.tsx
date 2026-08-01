import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, CheckCircle2, AlertCircle, GitBranch, ArrowUpCircle, Check } from 'lucide-react';

interface GithubUpdateInfo {
  repo: string;
  branch: string;
  latestCommit?: {
    sha: string;
    shortSha: string;
    message: string;
    date: string;
    author: string;
  };
  currentCommitSha?: string;
  hasUpdate?: boolean;
}

interface GithubUpdaterProps {
  isAgentTheme?: boolean;
  compact?: boolean;
}

export default function GithubUpdater({ isAgentTheme = false, compact = false }: GithubUpdaterProps) {
  const [updateInfo, setUpdateInfo] = useState<GithubUpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateStep, setUpdateStep] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showDetails, setShowDetails] = useState<boolean>(false);

  // Check for updates on mount
  useEffect(() => {
    checkUpdate();
  }, []);

  const checkUpdate = async () => {
    setIsChecking(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/system/update/check');
      if (res.ok) {
        const data = await res.json();
        setUpdateInfo(data);
      } else {
        const err = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
        setStatusMessage(err.error || 'Не удалось проверить обновления');
      }
    } catch (err: any) {
      console.error('Check update error:', err);
      setStatusMessage('Ошибка подключения к серверу');
    } finally {
      setIsChecking(false);
    }
  };

  const applyUpdate = async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    setUpdateStatus('idle');
    setUpdateStep('Скачивание архива main из GitHub...');

    try {
      // Step 1: Wait a brief moment to show downloading state
      await new Promise((r) => setTimeout(r, 600));
      setUpdateStep('Распаковка и установка файлов...');

      const res = await fetch('/api/system/update/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        const data = await res.json();
        setUpdateStep('Завершение обновления...');
        await new Promise((r) => setTimeout(r, 500));

        setUpdateStatus('success');
        setStatusMessage(data.message || 'Обновление успешно установлено!');
        
        // Re-check update status to refresh SHA
        await checkUpdate();

        // Optionally refresh browser after 2 seconds
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        const err = await res.json().catch(() => ({ error: 'Ошибка установки' }));
        setUpdateStatus('error');
        setStatusMessage(err.error || 'Ошибка при установке обновления');
      }
    } catch (err: any) {
      console.error('Apply update error:', err);
      setUpdateStatus('error');
      setStatusMessage(err.message || 'Сбой подключения при автообновлении');
    } finally {
      setIsUpdating(false);
      setUpdateStep('');
    }
  };

  return (
    <div
      className={`rounded-xl border transition-all overflow-hidden ${
        isAgentTheme
          ? 'bg-slate-950/70 border-slate-800 text-slate-200'
          : 'bg-gradient-to-br from-sky-50/70 to-indigo-50/50 border-sky-100 text-slate-800 shadow-2xs'
      }`}
    >
      {/* Top Bar with Repo info & Main Action */}
      <div className="p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`p-1 rounded-md shrink-0 ${
                isAgentTheme ? 'bg-sky-950/80 text-sky-400' : 'bg-sky-100 text-sky-600'
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold tracking-tight truncate font-display">
                  asewixbz/Chat
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full font-semibold ${
                    isAgentTheme ? 'bg-sky-950 text-sky-300 border border-sky-800/60' : 'bg-sky-100 text-sky-700'
                  }`}
                >
                  main
                </span>
              </div>
              {updateInfo?.latestCommit?.shortSha && (
                <span className="text-[10px] text-slate-400 font-mono block truncate">
                  SHA: {updateInfo.latestCommit.shortSha}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={checkUpdate}
            disabled={isChecking || isUpdating}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
              isAgentTheme
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
            }`}
            title="Проверить обновления на GitHub"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin text-sky-500' : ''}`} />
          </button>
        </div>

        {/* Action Button: Install Update */}
        <button
          onClick={applyUpdate}
          disabled={isUpdating}
          className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98] ${
            isUpdating
              ? 'bg-slate-700 text-slate-300 cursor-wait opacity-90'
              : updateInfo?.hasUpdate
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/20'
              : isAgentTheme
              ? 'bg-sky-600 hover:bg-sky-500 text-white'
              : 'bg-sky-600 hover:bg-sky-700 text-white'
          }`}
        >
          {isUpdating ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin text-white shrink-0" />
              <span className="truncate">{updateStep || 'Установка...'}</span>
            </>
          ) : updateStatus === 'success' ? (
            <>
              <Check className="h-4 w-4 text-emerald-300 shrink-0" />
              <span>Обновлено! Перезагрузка...</span>
            </>
          ) : updateInfo?.hasUpdate ? (
            <>
              <ArrowUpCircle className="h-4 w-4 animate-bounce text-emerald-200 shrink-0" />
              <span>Установить новое обновление</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4 text-sky-200 shrink-0" />
              <span>Загрузить авто-обновление</span>
            </>
          )}
        </button>

        {/* Status Alert / Feedback */}
        {statusMessage && (
          <div
            className={`mt-2 p-2 rounded-lg text-[11px] flex items-start gap-1.5 ${
              updateStatus === 'success'
                ? isAgentTheme
                  ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : updateStatus === 'error'
                ? isAgentTheme
                  ? 'bg-rose-950/60 border border-rose-800/80 text-rose-300'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
                : isAgentTheme
                ? 'bg-slate-800/60 text-slate-300'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {updateStatus === 'success' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
            ) : updateStatus === 'error' ? (
              <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
            ) : (
              <GitBranch className="h-3.5 w-3.5 text-sky-500 shrink-0 mt-0.5" />
            )}
            <span className="leading-tight">{statusMessage}</span>
          </div>
        )}

        {/* Expandable Commit details */}
        {updateInfo?.latestCommit && (
          <div className="mt-2 pt-2 border-t border-slate-200/20 text-[10.5px]">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-slate-400 hover:text-slate-200 font-mono text-[10px] flex items-center gap-1 cursor-pointer"
            >
              <span>{showDetails ? 'Скрыть детали' : 'Информация о коммите main'}</span>
            </button>
            {showDetails && (
              <div className="mt-1 space-y-1 font-mono text-[10px] text-slate-400 bg-black/20 p-2 rounded-md">
                <p className="font-semibold text-slate-300 truncate">{updateInfo.latestCommit.message}</p>
                <p>Автор: {updateInfo.latestCommit.author}</p>
                <p>Дата: {new Date(updateInfo.latestCommit.date).toLocaleString('ru-RU')}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
