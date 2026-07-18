import React, { useState, useEffect } from 'react';
import { Chat, KIE_MODELS } from '../types';
import { Plus, MessageSquare, Trash2, X, AlertCircle, Key, Coins, RefreshCw, Eye, EyeOff, Check, Settings } from 'lucide-react';

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
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

  // Synchronize tempKey with external prop updates
  useEffect(() => {
    setTempKey(kieApiKey || '');
  }, [kieApiKey]);

  const handleSaveKey = () => {
    onSaveKieApiKey(tempKey);
    setShowSettings(false);
  };

  const handleDeleteClick = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation(); // Avoid selecting the chat
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

  return (
    <>
      {/* 1. Transparent Backdrop Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* 2. Slide-out Drawer Menu */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-[82%] max-w-[340px] bg-white border-r border-slate-100 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <h2 className="text-sm font-bold text-slate-800 tracking-tight font-display flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
            Ваши диалоги
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Kie Settings & Balance Panel */}
        <div className="bg-slate-50 border-b border-slate-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[10.5px] uppercase tracking-wider">
              <Coins className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>Баланс KIE</span>
            </div>
            <button
              onClick={onCheckBalance}
              disabled={isCheckingBalance || !kieApiKey.trim()}
              className={`p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-all cursor-pointer ${
                isCheckingBalance ? 'animate-spin text-sky-500' : ''
              }`}
              title="Обновить баланс"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-baseline gap-1.5">
            {isCheckingBalance && kieBalance === null ? (
              <span className="text-sm text-slate-400 font-medium animate-pulse">Загрузка...</span>
            ) : kieBalance !== null ? (
              <span className="text-xl font-bold font-mono text-slate-800 tracking-tight">
                {kieBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                <span className="text-[11px] font-semibold text-slate-500 font-sans">{kieCurrency}</span>
              </span>
            ) : balanceError ? (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                Ошибка загрузки
              </span>
            ) : !kieApiKey.trim() ? (
              <span className="text-xs text-slate-400 font-medium">Ключ не настроен</span>
            ) : (
              <span className="text-xs text-slate-400 font-medium">Загрузите баланс</span>
            )}
          </div>

          {/* Collapsible Key input / toggle */}
          <div className="pt-1">
            {showSettings ? (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="sk-kie-..."
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg pl-8 pr-8 py-2 focus:outline-hidden focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                  />
                  <Key className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {balanceError && (
                  <p className="text-[10px] text-red-500 leading-tight">
                    {balanceError}
                  </p>
                )}
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={handleSaveKey}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-1.5 px-2.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 min-h-[28px]"
                  >
                    <Check className="h-3 w-3 text-sky-400" />
                    Сохранить
                  </button>
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      setTempKey(kieApiKey);
                    }}
                    className="bg-slate-200/60 hover:bg-slate-200 text-slate-700 font-medium py-1.5 px-2.5 rounded-lg text-xs transition-colors cursor-pointer min-h-[28px]"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowSettings(true)}
                className="text-xs font-medium text-sky-600 hover:text-sky-700 hover:underline flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Settings className="h-3.5 w-3.5" />
                {kieApiKey.trim() ? "Изменить ключ Kie" : "Настроить ключ Kie"}
              </button>
            )}
          </div>
        </div>

        {/* Big Create New Chat Button */}
        <div className="p-4">
          <button
            onClick={() => {
              onCreateChat();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-850 text-white font-medium py-3 px-4 rounded-xl shadow-xs transition-colors cursor-pointer text-sm font-display touch-manipulation min-h-[44px]"
          >
            <Plus className="h-4.5 w-4.5 text-sky-400" />
            Новый чат
          </button>
        </div>

        {/* Scrollable List of Chats */}
        <div className="flex-1 overflow-y-auto px-2 pb-6 space-y-1">
          {chats.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400 space-y-1">
              <MessageSquare className="h-8 w-8 mx-auto stroke-[1.5]" />
              <p className="text-xs">Диалогов пока нет</p>
            </div>
          ) : (
            chats.map((chat) => {
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
                  className={`group relative flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition-all duration-200 touch-manipulation min-h-[44px] ${
                    isActive
                      ? 'bg-slate-100 border-l-4 border-sky-600 pl-2.5'
                      : 'hover:bg-slate-50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1 pr-2">
                    {/* Chat title */}
                    <span
                      className={`text-[13.5px] font-medium truncate ${
                        isActive ? 'text-slate-900 font-semibold' : 'text-slate-700'
                      }`}
                    >
                      {chat.title}
                    </span>
                    {/* Subtitle / Model badge */}
                    <span className="text-[10.5px] text-slate-400 font-mono">
                      {modelInfo?.name || 'Kie model'}
                    </span>
                  </div>

                  {/* Right hand action: Delete */}
                  {isDeleting ? (
                    <div className="flex items-center gap-1 shrink-0 animate-fade-in z-10">
                      <button
                        onClick={(e) => handleConfirmDelete(e, chat.id)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Да
                      </button>
                      <button
                        onClick={handleCancelDelete}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Нет
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => handleDeleteClick(e, chat.id)}
                      className="p-1.5 rounded-lg text-slate-350 hover:text-red-500 hover:bg-red-50 transition-all shrink-0 cursor-pointer md:opacity-0 group-hover:opacity-100"
                      title="Удалить диалог"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer / Info */}
        <div className="p-4 border-t border-slate-50 text-[11.5px] text-slate-400 bg-slate-50/50">
          <div className="flex items-center gap-1 text-slate-500 font-medium">
            <AlertCircle className="h-3.5 w-3.5 text-sky-500 shrink-0" />
            <span>Без авторизации</span>
          </div>
          <p className="mt-1 leading-snug">Данные сохраняются локально в вашем браузере.</p>
        </div>
      </aside>
    </>
  );
}
