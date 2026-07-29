import React, { useState, useEffect } from 'react';
import { Chat, ChatMode, KIE_MODELS } from '../types';
import { Plus, MessageSquare, Trash2, X, AlertCircle, Key, Coins, RefreshCw, Eye, EyeOff, Check, Settings, Bot, Terminal, Code2 } from 'lucide-react';
import { modeRegistry } from '../modes/registry';

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  activeMode: ChatMode;
  onSelectMode: (mode: ChatMode) => void;
  onSelectChat: (chatId: string) => void;
  onCreateChat: (mode?: ChatMode) => void;
  onDeleteChat: (chatId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  kieApiKey: string;
  onSaveKieApiKey: (key: string) => void;
  kieBalance: number | null;
  kieCurrency: string;
  isCheckingBalance: boolean;
  balanceError: string | null;
  onCheckBalance: () => void;
}

export default function Sidebar({
  chats,
  activeChatId,
  activeMode,
  onSelectMode,
  onSelectChat,
  onCreateChat,
  onDeleteChat,
  isOpen,
  onClose,
  kieApiKey,
  onSaveKieApiKey,
  kieBalance,
  kieCurrency,
  isCheckingBalance,
  balanceError,
  onCheckBalance
}: SidebarProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [tempKey, setTempKey] = useState(kieApiKey || '');

  const allModes = modeRegistry.getAll();

  // Filter chats by mode
  const filteredChats = chats.filter(c => {
    const chatMode = c.mode || 'chat';
    return chatMode === activeMode;
  });

  useEffect(() => {
    setTempKey(kieApiKey || '');
  }, [kieApiKey]);

  const handleSaveKey = () => {
    onSaveKieApiKey(tempKey);
    setShowSettings(false);
  };

  const handleDeleteClick = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setDeleteConfirmId(chatId);
  };

  const handleConfirmDelete = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    onDeleteChat(chatId);
    setDeleteConfirmId(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
  };

  const isAgentTheme = activeMode === 'agent';

  return (
    <>
      {/* 1. Backdrop Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* 2. Slide-out Sidebar Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-[85%] max-w-[340px] shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${
          isAgentTheme 
            ? 'bg-slate-900 border-r border-slate-800 text-slate-200' 
            : 'bg-white border-r border-slate-100 text-slate-800'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Drawer Header */}
        <div className={`flex items-center justify-between px-4 py-3.5 border-b ${
          isAgentTheme ? 'border-slate-800 bg-slate-950/80' : 'border-slate-50 bg-slate-50/50'
        }`}>
          <h2 className="text-xs font-bold tracking-tight font-display flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${isAgentTheme ? 'bg-sky-400' : 'bg-sky-500'}`} />
            {isAgentTheme ? 'Агентские проекты' : 'Ваши диалоги'}
          </h2>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isAgentTheme ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* --- DYNAMIC MODE SWITCHER --- */}
        <div className={`p-3 border-b ${isAgentTheme ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/70'}`}>
          <div className={`p-1 rounded-xl flex gap-1 ${isAgentTheme ? 'bg-slate-950 border border-slate-800' : 'bg-slate-200/70'}`}>
            {allModes.map((mode) => {
              const isActive = activeMode === mode.id;
              const IconComp = mode.iconName === 'Terminal' ? Terminal : MessageSquare;
              return (
                <button
                  key={mode.id}
                  onClick={() => onSelectMode(mode.id as ChatMode)}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isActive
                      ? mode.id === 'agent' 
                        ? 'bg-sky-600 text-white shadow-sm font-semibold' 
                        : 'bg-white text-slate-900 shadow-sm font-semibold'
                      : isAgentTheme ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <IconComp className={`h-3.5 w-3.5 ${isActive && mode.id === 'agent' ? 'text-sky-200' : 'text-sky-500'}`} />
                  <span>{mode.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Kie Settings & Balance Panel */}
        <div className={`border-b p-3.5 space-y-2.5 ${
          isAgentTheme ? 'border-slate-800 bg-slate-950/30' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider ${
              isAgentTheme ? 'text-slate-400' : 'text-slate-500'
            }`}>
              <Coins className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>Баланс KIE</span>
            </div>
            <button
              onClick={onCheckBalance}
              disabled={isCheckingBalance || !kieApiKey.trim()}
              className={`p-1 rounded-md transition-all cursor-pointer ${
                isAgentTheme ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'
              } ${isCheckingBalance ? 'animate-spin text-sky-500' : ''}`}
              title="Обновить баланс"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-baseline gap-1.5">
            {isCheckingBalance && kieBalance === null ? (
              <span className="text-xs text-slate-400 font-medium animate-pulse">Загрузка...</span>
            ) : kieBalance !== null ? (
              <span className={`text-lg font-bold font-mono tracking-tight ${isAgentTheme ? 'text-white' : 'text-slate-800'}`}>
                {kieBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                <span className="text-[10px] font-semibold text-slate-400 font-sans">{kieCurrency}</span>
              </span>
            ) : balanceError ? (
              <span className="text-xs text-red-400 font-medium flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                Ошибка
              </span>
            ) : !kieApiKey.trim() ? (
              <span className="text-xs text-slate-400 font-medium">Ключ не настроен</span>
            ) : (
              <span className="text-xs text-slate-400 font-medium">Загрузите баланс</span>
            )}
          </div>

          {/* Collapsible Key input */}
          <div className="pt-0.5">
            {showSettings ? (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="sk-kie-..."
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    className={`w-full text-xs font-mono rounded-lg pl-8 pr-8 py-1.5 focus:outline-hidden ${
                      isAgentTheme
                        ? 'bg-slate-950 border border-slate-700 text-white focus:border-sky-500'
                        : 'bg-white border border-slate-200 text-slate-800 focus:border-sky-500'
                    }`}
                  />
                  <Key className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="flex gap-1.5 pt-0.5">
                  <button
                    onClick={handleSaveKey}
                    className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-medium py-1 px-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Check className="h-3 w-3" />
                    Сохранить
                  </button>
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      setTempKey(kieApiKey);
                    }}
                    className={`py-1 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isAgentTheme ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200/60 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowSettings(true)}
                className="text-[11.5px] font-medium text-sky-400 hover:underline flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Settings className="h-3 w-3" />
                {kieApiKey.trim() ? "Изменить ключ Kie" : "Настроить ключ Kie"}
              </button>
            )}
          </div>
        </div>

        {/* Big Create New Chat/Project Button */}
        <div className="p-3">
          <button
            onClick={() => {
              onCreateChat(activeMode);
              onClose();
            }}
            className={`w-full flex items-center justify-center gap-2 font-medium py-2.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer text-xs font-display touch-manipulation min-h-[40px] ${
              isAgentTheme
                ? 'bg-sky-600 hover:bg-sky-500 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            <Plus className="h-4 w-4" />
            {isAgentTheme ? 'Новый проект (Агент)' : 'Новый обычный чат'}
          </button>
        </div>

        {/* Scrollable List of Chats */}
        <div className="flex-1 overflow-y-auto px-2 pb-6 space-y-1">
          {filteredChats.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400 space-y-1.5">
              {isAgentTheme ? (
                <>
                  <Code2 className="h-8 w-8 mx-auto stroke-[1.5] text-slate-500" />
                  <p className="text-xs font-medium">Нет агентских проектов</p>
                  <p className="text-[11px] text-slate-500">Создайте проект для работы с кодом</p>
                </>
              ) : (
                <>
                  <MessageSquare className="h-8 w-8 mx-auto stroke-[1.5] text-slate-400" />
                  <p className="text-xs font-medium">Диалогов пока нет</p>
                </>
              )}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isActive = chat.id === activeChatId;
              const modelInfo = KIE_MODELS[chat.modelId];
              const isDeleting = deleteConfirmId === chat.id;

              return (
                <div
                  key={chat.id}
                  onClick={() => {
                    onSelectChat(chat.id);
                    onClose();
                  }}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 touch-manipulation min-h-[40px] ${
                    isActive
                      ? isAgentTheme
                        ? 'bg-slate-800 border-l-4 border-sky-400 text-white font-semibold pl-2'
                        : 'bg-slate-100 border-l-4 border-sky-600 pl-2 text-slate-900 font-semibold'
                      : isAgentTheme
                        ? 'hover:bg-slate-850 text-slate-300 border-l-4 border-transparent'
                        : 'hover:bg-slate-50 text-slate-700 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      {chat.mode === 'agent' && <Code2 className="h-3.5 w-3.5 text-sky-400 shrink-0" />}
                      <span className="text-xs truncate font-medium">{chat.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {modelInfo?.name || 'Kie model'}
                    </span>
                  </div>

                  {/* Delete action */}
                  {isDeleting ? (
                    <div className="flex items-center gap-1 shrink-0 z-10">
                      <button
                        onClick={(e) => handleConfirmDelete(e, chat.id)}
                        className="bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-bold"
                      >
                        Да
                      </button>
                      <button
                        onClick={handleCancelDelete}
                        className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold"
                      >
                        Нет
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => handleDeleteClick(e, chat.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-all shrink-0 cursor-pointer md:opacity-0 group-hover:opacity-100"
                      title="Удалить"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className={`p-3 border-t text-[11px] ${
          isAgentTheme ? 'border-slate-800 bg-slate-950 text-slate-400' : 'border-slate-50 bg-slate-50/50 text-slate-400'
        }`}>
          <div className="flex items-center gap-1 font-medium">
            <Bot className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            <span>Kie Code Agent System</span>
          </div>
        </div>
      </aside>
    </>
  );
}

