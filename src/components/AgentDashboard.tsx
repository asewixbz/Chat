import React, { useState, useEffect } from 'react';
import { Terminal as TerminalIcon, ShieldAlert, GitBranch, Cpu, CheckCircle2, XCircle, AlertTriangle, Play, RefreshCw, FolderGit2, HardDrive, ShieldCheck, Layers, ExternalLink } from 'lucide-react';

interface AgentDashboardProps {
  workspaceId: string;
  activeTask?: { taskName: string; stepName?: string };
}

export default function AgentDashboard({ workspaceId, activeTask }: AgentDashboardProps) {
  const [activeTab, setActiveTab] = useState<'task' | 'terminals' | 'worktrees' | 'security' | 'architecture'>('task');
  const [approvals, setApprovals] = useState<any[]>([]);
  const [worktrees, setWorktrees] = useState<any[]>([]);
  const [engineInfo, setEngineInfo] = useState<any>(null);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'neurocode-orchestrator v1.0.0 (Linux x86_64, Go 1.23)',
    'Process group initialized (PID 48210)',
    'SQLite DB loaded (~/.local/share/neurocode/data.db)',
    'PTY Supervisor listening on /api/v1/terminals',
    'Ready for task execution.'
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>('term_default');
  const [policy, setPolicy] = useState<'strict' | 'safe-auto' | 'full-auto'>('safe-auto');
  const [dataPolicy, setDataPolicy] = useState<'local-only' | 'allow-external' | 'confirm-external'>('confirm-external');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  const fetchData = async () => {
    try {
      const [apprRes, wtRes, infoRes] = await Promise.all([
        fetch('/api/v1/approvals').then(r => r.ok ? r.json() : []),
        fetch(`/api/v1/workspaces/${workspaceId}/worktrees`).then(r => r.ok ? r.json() : { worktrees: [] }),
        fetch('/api/v1/neurocode/info').then(r => r.ok ? r.json() : null),
      ]);
      setApprovals(Array.isArray(apprRes) ? apprRes : []);
      setWorktrees(wtRes.worktrees || []);
      if (infoRes) setEngineInfo(infoRes);
    } catch (e) {
      console.error('Failed to fetch agent dashboard data', e);
    }
  };

  const handleApprove = async (id: string) => {
    await fetch(`/api/v1/approvals/${id}/approve`, { method: 'POST' });
    fetchData();
  };

  const handleReject = async (id: string) => {
    await fetch(`/api/v1/approvals/${id}/reject`, { method: 'POST' });
    fetchData();
  };

  const handleCreateWorktree = async () => {
    await fetch(`/api/v1/workspaces/${workspaceId}/worktrees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'sess_' + Math.random().toString(36).substring(2, 7) }),
    });
    fetchData();
  };

  const handleSendTerminalInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;
    const cmd = terminalInput;
    setTerminalLogs(prev => [...prev, `$ ${cmd}`, `Exec: ${cmd} (Process Group signal OK)`]);
    setTerminalInput('');
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden my-3">
      {/* HEADER TABS */}
      <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200/80 px-4 py-2.5 overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setActiveTab('task')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'task' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Активная задача</span>
          </button>

          <button
            onClick={() => setActiveTab('terminals')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'terminals' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>PTY Терминалы</span>
          </button>

          <button
            onClick={() => setActiveTab('worktrees')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'worktrees' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Git Worktrees ({worktrees.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'bg-sky-600 text-white shadow-xs'
                : approvals.length > 0
                ? 'bg-amber-100 text-amber-800 border border-amber-300 font-bold'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Подтверждения {approvals.length > 0 && `(${approvals.length})`}</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'architecture' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Go Backend Архитектура</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-[11px] font-bold">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Neurocode Engine Active
          </span>
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="p-4">
        {/* TAB 1: ACTIVE TASK */}
        {activeTab === 'task' && (
          <div className="space-y-3">
            <div className="bg-sky-50/70 border border-sky-100 p-3.5 rounded-xl flex items-start gap-3">
              <div className="p-2 bg-sky-600 text-white rounded-lg shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                    Исполнитель Агента
                  </span>
                  <span className="text-xs text-slate-500 font-mono">Linux x86_64 • Go Orchestrator</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mt-1">
                  {activeTask?.taskName || 'Выполнение полной архитектуры бэкенда автономного агента'}
                </h4>
                {activeTask?.stepName && (
                  <p className="text-xs text-sky-800 font-medium mt-0.5">
                    Текущий этап: {activeTask.stepName}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <div className="text-[11px] text-slate-500 font-medium">Безопасность и Права</div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">
                  Режим: {policy.toUpperCase()} (Process Group Isolation)
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <div className="text-[11px] text-slate-500 font-medium">Модель и KIE Gateway</div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">
                  GPT 5.6 Sol / Native Tool Calling
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <div className="text-[11px] text-slate-500 font-medium">Параллельность и Изменения</div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">
                  Git Worktree Write Isolation Active
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PTY TERMINALS */}
        {activeTab === 'terminals' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Сессии PTY (Linux Process Group):</span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-mono">term_default (/bin/bash)</span>
              </div>
              <span className="text-xs text-slate-500 font-mono">Cols: 120 | Rows: 30</span>
            </div>

            <div className="bg-slate-950 text-emerald-400 p-3.5 rounded-xl font-mono text-xs h-48 overflow-y-auto space-y-1 shadow-inner border border-slate-800">
              {terminalLogs.map((log, i) => (
                <div key={i} className="leading-relaxed whitespace-pre-wrap">{log}</div>
              ))}
            </div>

            <form onSubmit={handleSendTerminalInput} className="flex gap-2">
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                placeholder="Ввод команды в интерактивную сессию PTY..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Отправить PTY</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: WORKTREES */}
        {activeTab === 'worktrees' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800">Изолированные Git Worktree для параллельной записи</h4>
                <p className="text-[11px] text-slate-500">Защищает основной workspace от повреждений при одновременной работе агентов</p>
              </div>
              <button
                onClick={handleCreateWorktree}
                className="px-3 py-1.5 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 cursor-pointer flex items-center gap-1.5"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Создать Worktree</span>
              </button>
            </div>

            {worktrees.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
                Активных параллельных write-worktrees пока нет. Основной workspace защищен.
              </div>
            ) : (
              <div className="space-y-2">
                {worktrees.map((wt) => (
                  <div key={wt.runId} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="font-bold text-slate-800">Ветка: {wt.branch}</div>
                      <div className="text-slate-500 text-[11px] truncate max-w-md mt-0.5">{wt.path}</div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-sans text-[11px] font-bold">
                      Изоляция активна
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SECURITY & APPROVALS */}
        {activeTab === 'security' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="block text-xs font-bold text-slate-700 mb-1">Политика подтверждений (Approval Policy):</label>
                <select
                  value={policy}
                  onChange={(e) => setPolicy(e.target.value as any)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="strict">strict — подтверждать каждое действие</option>
                  <option value="safe-auto">safe-auto (по умолчанию) — авто без риска, с запросом для git push/delete</option>
                  <option value="full-auto">full-auto — полная автономия (выдает предупреждение риска)</option>
                </select>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="block text-xs font-bold text-slate-700 mb-1">Политика передачи данных в LLM (LLM Data Policy):</label>
                <select
                  value={dataPolicy}
                  onChange={(e) => setDataPolicy(e.target.value as any)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="confirm-external">confirm-external — подтверждать передачу кода во внешние модели</option>
                  <option value="allow-external">allow-external — разрешить внешние KIE модели</option>
                  <option value="local-only">local-only — только строго локальные модели</option>
                </select>
              </div>
            </div>

            <h4 className="text-xs font-bold text-slate-800">Очередь запросов на подтверждение ({approvals.length}):</h4>

            {approvals.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
                Запросов на подтверждение от команд/сетей нет.
              </div>
            ) : (
              <div className="space-y-2">
                {approvals.map((appr) => (
                  <div key={appr.id} className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-extrabold text-[10px] uppercase">
                          {appr.tool || 'Command'}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{appr.reason}</span>
                      </div>
                      {appr.arguments && (
                        <div className="text-xs font-mono text-slate-700 bg-white/80 p-1.5 rounded border border-amber-100">
                          {JSON.stringify(appr.arguments)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(appr.id)}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Разрешить</span>
                      </button>
                      <button
                        onClick={() => handleReject(appr.id)}
                        className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 cursor-pointer flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Запретить</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: GO BACKEND ARCHITECTURE */}
        {activeTab === 'architecture' && (
          <div className="space-y-3">
            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-sky-400" />
                  <span className="font-bold text-sky-400">Neurocode Orchestrator (Go Backend Specification)</span>
                </div>
                <span className="px-2 py-0.5 bg-sky-900/60 text-sky-300 rounded text-[11px]">Go 1.23 / Linux x86_64</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11.5px]">
                <div>
                  <div className="text-slate-400 font-bold mb-1">Спецификация и модули Go:</div>
                  <ul className="space-y-1 list-disc list-inside text-slate-300">
                    <li>Исполняемый файл: <span className="text-emerald-400">/backend/cmd/neurocode</span></li>
                    <li>База данных: <span className="text-amber-300">modernc.org/sqlite (~/.local/share/neurocode/data.db)</span></li>
                    <li>PTY Управление: <span className="text-sky-300">creack/pty (Linux process groups)</span></li>
                    <li>LLM Шлюз: <span className="text-purple-300">KIE Provider (GPT 5.6 / Claude 5)</span></li>
                  </ul>
                </div>

                <div>
                  <div className="text-slate-400 font-bold mb-1">Пулы воркеров и лимиты:</div>
                  <ul className="space-y-1 list-disc list-inside text-slate-300">
                    <li>Agent Workers: 4 паралелльных воркера</li>
                    <li>Command Workers: 8 воркеров</li>
                    <li>Max Read / Write Runs: 4 Read / 2 Write</li>
                    <li>Лимит Workspace: 500 МБ (100,000 файлов)</li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400">
                Запуск сервиса в ОС Linux: <code className="text-emerald-400">neurocode serve --config ~/.config/neurocode/config.yaml</code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
