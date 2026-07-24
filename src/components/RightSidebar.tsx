import React, { useState, useEffect } from 'react';
import { 
  X, Folder, FileText, ChevronRight, ChevronDown, RefreshCw, Plus, 
  Search, Terminal, GitBranch, Shield, Code2, Edit3, Trash2, Check, 
  Copy, Play, AlertTriangle, FileCode, CheckCircle2, CornerDownLeft
} from 'lucide-react';
import { FileNode, WorkspaceInfo, GitInfo, PendingApproval } from '../types';

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  chatTitle: string;
}

export default function RightSidebar({
  isOpen,
  onClose,
  workspaceId,
  chatTitle
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<'files' | 'search' | 'terminal' | 'git' | 'approvals'>('files');
  
  // Workspace state
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ '': true });
  
  // Selected file modal/preview state
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>('');
  const [isEditingFile, setIsEditingFile] = useState(false);
  const [editFileBuffer, setEditFileBuffer] = useState('');
  const [loadingFileContent, setLoadingFileContent] = useState(false);
  const [fileSaveSuccess, setFileSaveSuccess] = useState(false);

  // New file creation state
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');

  // Search tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ path: string; line?: number; text?: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Git state
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const [gitDiff, setGitDiff] = useState<string>('');
  const [loadingGit, setLoadingGit] = useState(false);

  // Terminal state
  const [cmdInput, setCmdInput] = useState('');
  const [cmdLogs, setCmdLogs] = useState<{ command: string; stdout: string; stderr: string; exitCode: number; durationMs: number }[]>([]);
  const [isRunningCmd, setIsRunningCmd] = useState(false);

  // Approvals state
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);

  // Fetch file tree and workspace info
  const fetchTree = async () => {
    setLoadingTree(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/tree`);
      if (res.ok) {
        const data = await res.json();
        setWorkspace(data.workspace);
        setFileTree(data.tree || []);
      }
    } catch (e) {
      console.error('Failed to fetch tree:', e);
    } finally {
      setLoadingTree(false);
    }
  };

  // Fetch Git info
  const fetchGit = async () => {
    setLoadingGit(true);
    try {
      const statusRes = await fetch(`/api/v1/workspaces/${workspaceId}/git/status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setGitInfo(statusData);
      }
      const diffRes = await fetch(`/api/v1/workspaces/${workspaceId}/git/diff`);
      if (diffRes.ok) {
        const diffData = await diffRes.json();
        setGitDiff(diffData.diff || '');
      }
    } catch (e) {
      console.error('Failed to fetch git:', e);
    } finally {
      setLoadingGit(false);
    }
  };

  // Fetch approvals
  const fetchApprovals = async () => {
    try {
      const res = await fetch('/api/v1/approvals');
      if (res.ok) {
        const data = await res.json();
        setApprovals(data || []);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchTree();
      fetchGit();
      fetchApprovals();
    }
  }, [isOpen, workspaceId]);

  // Open file content
  const handleOpenFile = async (path: string) => {
    setSelectedFilePath(path);
    setLoadingFileContent(true);
    setIsEditingFile(false);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/files/content?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedFileContent(data.content || '');
        setEditFileBuffer(data.content || '');
      } else {
        setSelectedFileContent('Ошибка чтения файла');
      }
    } catch (e) {
      setSelectedFileContent('Ошибка загрузки файла');
    } finally {
      setLoadingFileContent(false);
    }
  };

  // Save file content
  const handleSaveFile = async () => {
    if (!selectedFilePath) return;
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/files/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFilePath, content: editFileBuffer })
      });
      if (res.ok) {
        setSelectedFileContent(editFileBuffer);
        setIsEditingFile(false);
        setFileSaveSuccess(true);
        setTimeout(() => setFileSaveSuccess(false), 2000);
        fetchTree();
      }
    } catch (e) {
      alert('Ошибка при сохранении файла');
    }
  };

  // Create new file
  const handleCreateFile = async () => {
    if (!newFilePath.trim()) return;
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/files/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newFilePath.trim(), content: '' })
      });
      if (res.ok) {
        setNewFilePath('');
        setShowNewFileInput(false);
        fetchTree();
      }
    } catch (e) {
      alert('Ошибка при создании файла');
    }
  };

  // Search text in project
  const handleSearchText = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/search/text?query=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.matches || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  // Execute shell command
  const handleRunCommand = async (cmdToRun?: string) => {
    const targetCmd = cmdToRun || cmdInput;
    if (!targetCmd.trim()) return;

    setIsRunningCmd(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/shell/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: targetCmd })
      });
      if (res.ok) {
        const data = await res.json();
        setCmdLogs(prev => [data, ...prev]);
        if (!cmdToRun) setCmdInput('');
        fetchGit();
      }
    } catch (e) {
      console.error('Command execution failed:', e);
    } finally {
      setIsRunningCmd(false);
    }
  };

  // Toggle tree node expansion
  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  // Recursive Tree Component
  const renderTreeNodes = (nodes: FileNode[]) => {
    return nodes.map((node) => {
      const isFolder = node.type === 'directory';
      const isExpanded = !!expandedFolders[node.path];

      return (
        <div key={node.path} className="select-none text-xs">
          <div
            onClick={() => {
              if (isFolder) {
                toggleFolder(node.path);
              } else {
                handleOpenFile(node.path);
              }
            }}
            className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors hover:bg-slate-800 ${
              selectedFilePath === node.path ? 'bg-sky-950/80 text-sky-300 font-semibold border-l-2 border-sky-400 pl-1.5' : 'text-slate-300'
            }`}
          >
            {isFolder ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                )}
                <Folder className="h-4 w-4 text-sky-400 shrink-0" />
                <span className="truncate font-medium">{node.name}</span>
              </>
            ) : (
              <>
                <span className="w-3.5 shrink-0" />
                <FileCode className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="truncate">{node.name}</span>
                {node.size !== undefined && (
                  <span className="ml-auto text-[10px] text-slate-500 font-mono">
                    {Math.round(node.size / 1024 * 10) / 10}KB
                  </span>
                )}
              </>
            )}
          </div>

          {isFolder && isExpanded && node.children && (
            <div className="pl-3.5 border-l border-slate-800/80 ml-2 mt-0.5 space-y-0.5">
              {renderTreeNodes(node.children)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      {/* Backdrop overlay for mobile */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Right Drawer / Catalog Panel */}
      <aside
        className={`fixed top-0 bottom-0 right-0 w-full max-w-[420px] bg-slate-900 text-slate-200 border-l border-slate-800 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20 shrink-0">
              <Code2 className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 text-left">
              <h3 className="text-xs font-bold text-white truncate font-display">
                {workspace?.name || chatTitle || 'Проект'}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                {workspace?.rootPath || '/workspace'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchTree}
              className={`p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ${
                loadingTree ? 'animate-spin text-sky-400' : ''
              }`}
              title="Обновить структуру"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Закрыть панель"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-950 border-b border-slate-800 p-1 shrink-0 text-xs font-medium">
          <button
            onClick={() => setActiveTab('files')}
            className={`flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'files' ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Folder className="h-3.5 w-3.5" />
            <span>Каталог</span>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'search' ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Поиск</span>
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'terminal' ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Консоль</span>
          </button>
          <button
            onClick={() => setActiveTab('git')}
            className={`flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'git' ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span>Git</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          
          {/* TAB 1: FILES CATALOG */}
          {activeTab === 'files' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Структура файлов</span>
                <button
                  onClick={() => setShowNewFileInput(!showNewFileInput)}
                  className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Новый файл
                </button>
              </div>

              {/* Create new file form */}
              {showNewFileInput && (
                <div className="flex gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800">
                  <input
                    type="text"
                    placeholder="src/utils/helper.ts"
                    value={newFilePath}
                    onChange={(e) => setNewFilePath(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-sky-500 font-mono"
                  />
                  <button
                    onClick={handleCreateFile}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    ОК
                  </button>
                </div>
              )}

              {/* File Tree List */}
              {loadingTree ? (
                <div className="py-8 text-center text-xs text-slate-500 animate-pulse">Загрузка структуры...</div>
              ) : fileTree.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">Файлы проекта не найдены</div>
              ) : (
                <div className="space-y-0.5">
                  {renderTreeNodes(fileTree)}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SEARCH */}
          {activeTab === 'search' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Поиск кода по проекту..."
                  value={searchQuery}
                  onChange={(e) => handleSearchText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-sky-500 font-sans"
                />
              </div>

              {isSearching ? (
                <div className="py-8 text-center text-xs text-slate-500 animate-pulse">Поиск...</div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  {searchQuery ? 'Совпадений не найдено' : 'Введите текст для поиска по файлам'}
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-[10.5px] text-slate-400 font-mono">Найдено строк: {searchResults.length}</span>
                  <div className="space-y-1.5">
                    {searchResults.map((m, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleOpenFile(m.path)}
                        className="bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 text-left cursor-pointer hover:border-slate-700 transition-all group"
                      >
                        <div className="flex justify-between items-center text-[10.5px] font-mono text-sky-400 font-semibold mb-1">
                          <span className="truncate">{m.path}</span>
                          {m.line && <span className="text-slate-500 shrink-0">стр. {m.line}</span>}
                        </div>
                        {m.text && (
                          <p className="text-[11px] text-slate-300 font-mono truncate leading-snug">
                            {m.text}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TERMINAL / SHELL EXEC */}
          {activeTab === 'terminal' && (
            <div className="space-y-3 text-left">
              {/* Presets */}
              <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-800">
                <button
                  onClick={() => handleRunCommand('npm test')}
                  disabled={isRunningCmd}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg text-[11px] font-mono font-medium transition-colors cursor-pointer border border-slate-700"
                >
                  npm test
                </button>
                <button
                  onClick={() => handleRunCommand('git status')}
                  disabled={isRunningCmd}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg text-[11px] font-mono font-medium transition-colors cursor-pointer border border-slate-700"
                >
                  git status
                </button>
                <button
                  onClick={() => handleRunCommand('ls -la')}
                  disabled={isRunningCmd}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg text-[11px] font-mono font-medium transition-colors cursor-pointer border border-slate-700"
                >
                  ls -la
                </button>
              </div>

              {/* Input Form */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Выполнить shell-команду..."
                  value={cmdInput}
                  onChange={(e) => setCmdInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRunCommand()}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-sky-500"
                />
                <button
                  onClick={() => handleRunCommand()}
                  disabled={isRunningCmd || !cmdInput.trim()}
                  className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white p-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                >
                  <Play className="h-4 w-4" />
                </button>
              </div>

              {/* Logs */}
              <div className="space-y-2 pt-2">
                {cmdLogs.map((log, i) => (
                  <div key={i} className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] space-y-1.5">
                    <div className="flex justify-between items-center text-slate-400 border-b border-slate-900 pb-1">
                      <span className="text-sky-400 font-bold">$ {log.command}</span>
                      <span className={log.exitCode === 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {log.exitCode === 0 ? 'OK' : `Exit ${log.exitCode}`} ({log.durationMs}ms)
                      </span>
                    </div>
                    {log.stdout && (
                      <pre className="text-slate-300 whitespace-pre-wrap overflow-x-auto max-h-40 leading-relaxed text-[10.5px]">
                        {log.stdout}
                      </pre>
                    )}
                    {log.stderr && (
                      <pre className="text-red-300 whitespace-pre-wrap overflow-x-auto max-h-32 leading-relaxed text-[10.5px]">
                        {log.stderr}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: GIT STATUS & DIFF */}
          {activeTab === 'git' && (
            <div className="space-y-3.5 text-left">
              {loadingGit ? (
                <div className="py-8 text-center text-xs text-slate-500 animate-pulse">Загрузка Git...</div>
              ) : (
                <>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-sky-400" />
                      <span className="text-xs font-bold text-slate-200 font-mono">{gitInfo?.branch || 'main'}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      gitInfo?.clean ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {gitInfo?.clean ? 'Репозиторий чист' : 'Есть изменения'}
                    </span>
                  </div>

                  {gitInfo?.files && gitInfo.files.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Измененные файлы</span>
                      <div className="space-y-1">
                        {gitInfo.files.map((f, i) => (
                          <div key={i} className="flex justify-between items-center bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800/60 text-[11px] font-mono">
                            <span className="text-slate-300 truncate">{f.path}</span>
                            <span className="text-amber-400 font-bold uppercase text-[9.5px]">{f.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {gitDiff && (
                    <div className="space-y-1.5">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Git Diff</span>
                      <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[10.5px] font-mono text-slate-300 overflow-x-auto max-h-60 leading-relaxed whitespace-pre-wrap">
                        {gitDiff}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>

        {/* Footer: Workspace Status */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 text-[10.5px] text-slate-400 flex items-center justify-between font-mono shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Агентская среда готова
          </span>
          <span>Безопасный доступ</span>
        </div>
      </aside>

      {/* File Editor Modal / Drawer */}
      {selectedFilePath && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="h-4 w-4 text-sky-400 shrink-0" />
                <span className="text-xs font-bold font-mono text-slate-100 truncate">{selectedFilePath}</span>
              </div>
              <div className="flex items-center gap-2">
                {fileSaveSuccess && (
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Сохранено!
                  </span>
                )}
                <button
                  onClick={() => setIsEditingFile(!isEditingFile)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isEditingFile ? 'bg-sky-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  {isEditingFile ? 'Просмотр' : 'Редактировать'}
                </button>
                <button
                  onClick={() => setSelectedFilePath(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950/60 font-mono text-xs leading-relaxed">
              {loadingFileContent ? (
                <div className="py-12 text-center text-slate-500 animate-pulse">Загрузка содержимого файла...</div>
              ) : isEditingFile ? (
                <textarea
                  value={editFileBuffer}
                  onChange={(e) => setEditFileBuffer(e.target.value)}
                  className="w-full h-full min-h-[400px] bg-slate-950 text-slate-200 border border-slate-800 rounded-xl p-4 focus:outline-hidden focus:border-sky-500 font-mono text-xs leading-relaxed resize-none"
                />
              ) : (
                <pre className="whitespace-pre-wrap text-slate-300 selection:bg-sky-900 selection:text-white text-left">
                  {selectedFileContent}
                </pre>
              )}
            </div>

            {/* Modal Footer */}
            {isEditingFile && (
              <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end gap-2 shrink-0">
                <button
                  onClick={() => setIsEditingFile(false)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveFile}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" /> Сохранить изменения
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
