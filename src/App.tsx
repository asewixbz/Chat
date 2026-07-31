import React, { useState, useEffect, useRef } from 'react';
import { Menu, SendHorizontal, MessageSquare, AlertCircle, RefreshCw, Sparkles, ChevronDown, Copy, Check, Trash2, Clipboard, X, Search, TextCursor, FileText, FolderTree, Terminal, Code2, Bot, Activity } from 'lucide-react';
import { Chat, ChatMode, Message, ModelId, ModelParameters, KIE_MODELS } from './types';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import ModelSettings from './components/ModelSettings';
import Markdown from './components/Markdown';
import AgentDashboard from './components/AgentDashboard';
import ApiStatusIndicator, { ApiStatusType } from './components/ApiStatusIndicator';
import ApiDiagnosticModal, { DiagnosticResult } from './components/ApiDiagnosticModal';
import { copyToClipboard } from './utils/clipboard';
import { modeRegistry } from './modes/registry';

// Simple unique ID generator
const generateId = () => Math.random().toString(36).substring(2, 11);

// Standard prompt chips
const PROMPT_CHIPS = [
  { label: '💡 Объясни просто', prompt: 'Объясни простыми словами, как работают квантовые компьютеры и почему это важно.' },
  { label: '✍️ Напиши пост', prompt: 'Напиши короткий вовлекающий пост для Telegram про пользу и принципы минимализма в быту.' },
  { label: '🎨 Идеи подарков', prompt: 'Предложи 5 необычных и креативных идей для подарка лучшему другу на день рождения.' },
  { label: '✂️ Сократи текст', prompt: 'Сократи следующий текст до 2-3 ключевых предложений и выдели главное:\n\n[Вставьте ваш текст здесь]' }
];

export default function App() {
  // --- States ---
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<ChatMode>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingChatId, setGeneratingChatId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  
  // --- Copy & Delete Features States ---
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [msgToDelete, setMsgToDelete] = useState<string | null>(null);
  const [historyCopied, setHistoryCopied] = useState(false);

  // --- Convenient Selection Feature States ---
  const [selectedSelectionMsg, setSelectedSelectionMsg] = useState<Message | null>(null);
  const [selectionSearch, setSelectionSearch] = useState('');
  const [selectionTab, setSelectionTab] = useState<'plain' | 'paragraphs' | 'markdown'>('plain');
  const [selectionCopiedIndex, setSelectionCopiedIndex] = useState<number | null>(null);
  const [selectionAllCopied, setSelectionAllCopied] = useState(false);

  // --- Kie API Key & Balance States ---
  const [kieApiKey, setKieApiKey] = useState<string>(() => {
    return localStorage.getItem('kie_api_key') || '';
  });
  const [kieBalance, setKieBalance] = useState<number | null>(null);
  const [kieCurrency, setKieCurrency] = useState<string>('USD');
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // --- Kie API Status & Diagnostic States ---
  const [apiStatus, setApiStatus] = useState<ApiStatusType>('unknown');
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);

  // --- Run API Diagnostic Function ---
  const runApiDiagnostic = async (keyToTest = kieApiKey, modelToTest?: ModelId) => {
    setIsDiagnosing(true);
    try {
      const response = await fetch('/api/kie/diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: keyToTest,
          modelId: modelToTest || (activeChat ? activeChat.modelId : 'gpt-5-6-sol')
        })
      });

      if (response.ok) {
        const data: DiagnosticResult = await response.json();
        setDiagnosticResult(data);
        setApiLatency(data.totalLatencyMs || data.modelCheck?.latencyMs || null);
        if (data.overallStatus === 'ok') {
          setApiStatus('connected');
        } else if (data.overallStatus === 'warning') {
          setApiStatus('degraded');
        } else if (data.overallStatus === 'error') {
          setApiStatus('error');
        } else {
          setApiStatus('unconfigured');
        }
      } else {
        setApiStatus('error');
      }
    } catch (err) {
      console.error('Diagnostic call failed:', err);
      setApiStatus('error');
    } finally {
      setIsDiagnosing(false);
    }
  };

  // --- Check Kie balance function ---
  const checkKieBalance = async (keyToUse = kieApiKey) => {
    if (!keyToUse.trim()) {
      setKieBalance(null);
      setBalanceError(null);
      return;
    }

    setIsCheckingBalance(true);
    setBalanceError(null);

    try {
      const response = await fetch('/api/kie/balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: keyToUse.trim() }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Не удалось получить баланс');
      }

      const data = await response.json();
      setKieBalance(data.balance);
      setKieCurrency(data.currency || 'USD');
    } catch (err: any) {
      console.error('Error checking balance:', err);
      setBalanceError(err.message || 'Ошибка подключения к серверу');
      setKieBalance(null);
    } finally {
      setIsCheckingBalance(false);
    }
  };

  // --- Save API key function ---
  const saveKieApiKey = (newKey: string) => {
    setKieApiKey(newKey);
    localStorage.setItem('kie_api_key', newKey);
    if (newKey.trim()) {
      checkKieBalance(newKey);
      runApiDiagnostic(newKey);
    } else {
      setKieBalance(null);
      setBalanceError(null);
      setApiStatus('unconfigured');
      setDiagnosticResult(null);
    }
  };

  // --- Refs ---
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userAtBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Load Chats from LocalStorage ---
  useEffect(() => {
    const savedChats = localStorage.getItem('kie_neurochat_chats');
    if (savedChats) {
      try {
        const parsed = JSON.parse(savedChats) as Chat[];
        setChats(parsed);
        if (parsed.length > 0) {
          setActiveChatId(parsed[0].id);
        }
      } catch (e) {
        console.error('Failed to parse chats', e);
        createNewChat();
      }
    } else {
      createNewChat();
    }
  }, []);

  // --- Initial Diagnostic & Balance check on mount ---
  useEffect(() => {
    if (kieApiKey.trim()) {
      checkKieBalance(kieApiKey);
      runApiDiagnostic(kieApiKey);
    } else {
      runApiDiagnostic(''); // Check env key fallback
    }
  }, []);

  // --- Save Chats to LocalStorage ---
  const saveChatsToStorage = (updatedChats: Chat[]) => {
    setChats(updatedChats);
    localStorage.setItem('kie_neurochat_chats', JSON.stringify(updatedChats));
  };

  // --- Monitor Internet Connection ---
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- Manage Keyboard / Textarea Height ---
  useEffect(() => {
    if (textareaRef.current) {
      // Auto-grow heights
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputMessage]);

  // --- Handle AutoScroll logic ---
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    // Check if user is within 100px from the bottom
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    userAtBottomRef.current = isNearBottom;
  };

  // Trigger scroll on new message or during active stream if user wants it
  useEffect(() => {
    if (userAtBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [streamingText]);

  // --- Helper to highlight text search matches ---
  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return text;
    const escapedSearch = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedSearch})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === search.toLowerCase() ? (
            <mark key={i} className="bg-yellow-100 text-slate-900 font-semibold px-0.5 rounded-sm">{part}</mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // --- Active Chat Helper ---
  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  // Sync activeMode with activeChat mode when activeChatId changes
  useEffect(() => {
    if (activeChat?.mode) {
      setActiveMode(activeChat.mode);
    }
  }, [activeChatId, activeChat?.mode]);

  // Force scroll when active chat switches
  useEffect(() => {
    userAtBottomRef.current = true;
    setTimeout(() => scrollToBottom('auto'), 50);
  }, [activeChatId]);

  // --- Helper to get default parameters for a model ---
  const getDefaultParamsForModel = (modelId: ModelId): ModelParameters => {
    const model = KIE_MODELS[modelId] || KIE_MODELS['gpt-5-6-sol'];
    const params: ModelParameters = {};
    if (model.supportedParams.includes('temperature')) params.temperature = 0.7;
    if (model.supportedParams.includes('maxTokens')) params.maxTokens = 1000;
    if (model.supportedParams.includes('systemPrompt')) params.systemPrompt = '';
    if (model.supportedParams.includes('reasoningEffort')) params.reasoningEffort = 'low';
    if (model.supportedParams.includes('webSearch')) params.webSearch = false;
    return params;
  };

  // --- Mode Switching Handler ---
  const handleSelectMode = (newMode: ChatMode) => {
    setActiveMode(newMode);
    // Find existing chat in new mode
    const matchingChat = chats.find(c => {
      if (newMode === 'agent') return c.mode === 'agent';
      return !c.mode || c.mode === 'chat';
    });

    if (matchingChat) {
      setActiveChatId(matchingChat.id);
    } else {
      createNewChat('gpt-5-6-sol', newMode);
    }
  };

  // --- Create Chat Action ---
  const createNewChat = (modelId: ModelId = 'gpt-5-6-sol', mode: ChatMode = activeMode) => {
    const defaultParams = getDefaultParamsForModel(modelId);
    const isAgent = mode === 'agent';

    const agentCount = chats.filter(c => c.mode === 'agent').length + 1;
    const newChat: Chat = {
      id: generateId(),
      title: isAgent ? `Проект #${agentCount}` : 'Новый диалог',
      modelId,
      parameters: defaultParams,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode,
      workspaceId: 'ws_default'
    };

    const updatedChats = [newChat, ...chats];
    saveChatsToStorage(updatedChats);
    setActiveChatId(newChat.id);
    setError(null);
  };

  // --- Delete Chat Action ---
  const deleteChat = (chatId: string) => {
    const updatedChats = chats.filter((c) => c.id !== chatId);
    saveChatsToStorage(updatedChats);

    if (activeChatId === chatId) {
      if (updatedChats.length > 0) {
        setActiveChatId(updatedChats[0].id);
      } else {
        createNewChat();
      }
    }
  };

  // --- Update Model ID & Auto Reset Parameters ---
  const changeActiveChatModel = (modelId: ModelId) => {
    if (!activeChat) return;

    // Reset parameters to defaults
    const defaultParams = getDefaultParamsForModel(modelId);

    const updated = chats.map((c) => {
      if (c.id === activeChat.id) {
        return {
          ...c,
          modelId,
          parameters: defaultParams,
          updatedAt: Date.now(),
        };
      }
      return c;
    });

    saveChatsToStorage(updated);
  };

  // --- Update Active Parameters ---
  const updateActiveChatParams = (params: Partial<ModelParameters>) => {
    if (!activeChat) return;

    const updated = chats.map((c) => {
      if (c.id === activeChat.id) {
        return {
          ...c,
          parameters: {
            ...c.parameters,
            ...params,
          },
          updatedAt: Date.now(),
        };
      }
      return c;
    });

    saveChatsToStorage(updated);
  };

  // --- Reset Model Parameters ---
  const resetActiveChatParams = () => {
    if (!activeChat) return;
    changeActiveChatModel(activeChat.modelId);
  };

  // --- Select Chat ---
  const selectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setError(null);
  };

  // --- Clear / Reset Current Dialog ---
  const clearCurrentChatMessages = () => {
    if (!activeChat) return;

    const updated = chats.map((c) => {
      if (c.id === activeChat.id) {
        return {
          ...c,
          title: 'Новый диалог',
          messages: [],
          updatedAt: Date.now(),
        };
      }
      return c;
    });

    saveChatsToStorage(updated);
    setError(null);
    setStreamingText('');
  };

  // Helper to resolve executing task details dynamically
  const getActiveTaskTitle = (chat: Chat | null, streaming: string) => {
    if (!chat) return { taskName: 'Выполнение запроса', stepName: 'Инициализация' };

    const taskMatch = streaming.match(/\[TASK:\s*([^\]]+)\]/i);
    const stepMatch = streaming.match(/\[STEP:\s*([^\]]+)\]/i);
    if (taskMatch) {
      return {
        taskName: taskMatch[1].trim(),
        stepName: stepMatch ? stepMatch[1].trim() : undefined,
      };
    }

    const lastUserMsg = [...chat.messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      const text = lastUserMsg.content.toLowerCase();
      if (text.includes('структур') || text.includes('дерево') || text.includes('файлы') || text.includes('анализ проекта') || text.includes('прочита')) {
        return { taskName: 'Анализ файловой структуры и файлов проекта', stepName: 'Сканирование workspace' };
      }
      if (text.includes('git') || text.includes('коммит') || text.includes('ветка') || text.includes('worktree')) {
        return { taskName: 'Инспекция состояния Git-репозитория', stepName: 'Запрос статуса Git' };
      }
      if (text.includes('код') || text.includes('функция') || text.includes('ошибк') || text.includes('исправ')) {
        return { taskName: 'Анализ исходного кода и построение решений', stepName: 'Обработка логики' };
      }
      if (text.includes('тест') || text.includes('сборк') || text.includes('build') || text.includes('запуск')) {
        return { taskName: 'Выполнение процессов сборки и проверки', stepName: 'Проверка компиляции' };
      }
      if (lastUserMsg.content.length > 0) {
        const shortTitle = lastUserMsg.content.length > 45 ? `${lastUserMsg.content.substring(0, 45)}...` : lastUserMsg.content;
        return { taskName: `Выполнение задачи: "${shortTitle}"`, stepName: 'Обработка в процессе' };
      }
    }

    return {
      taskName: chat.mode === 'agent' ? 'Выполнение агентской задачи' : 'Обработка и генерация ответа',
      stepName: 'Формирование ответа'
    };
  };

  // --- Copy individual message ---
  const handleCopyMessage = async (messageId: string, content: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
  };

  // --- Confirm delete message ---
  const confirmDeleteMessage = (messageId: string) => {
    if (!activeChat) return;

    const updatedMessages = activeChat.messages.filter((m) => m.id !== messageId);

    const updatedChats = chats.map((c) => {
      if (c.id === activeChat.id) {
        return {
          ...c,
          messages: updatedMessages,
          updatedAt: Date.now(),
        };
      }
      return c;
    });

    saveChatsToStorage(updatedChats);
    setMsgToDelete(null);
  };

  // --- Copy full chat history ---
  const copyChatHistory = async () => {
    if (!activeChat || activeChat.messages.length === 0) return;

    const formattedHistory = activeChat.messages
      .filter((m) => !m.isSystem)
      .map((m) => {
        const sender = m.role === 'user' ? 'Вы' : 'Нейросеть';
        return `[${sender}]: ${m.content}`;
      })
      .join('\n\n');

    const success = await copyToClipboard(formattedHistory);
    if (success) {
      setHistoryCopied(true);
      setTimeout(() => setHistoryCopied(false), 2000);
    }
  };

  // --- Send Message and Call API ---
  const sendMessage = async (textToSend?: string) => {
    const rawText = textToSend !== undefined ? textToSend : inputMessage;
    const cleanText = rawText.trim();
    if (!cleanText || isGenerating || !activeChat) return;

    const chatIdAtStart = activeChat.id;

    // Reset state before sending
    setInputMessage('');
    setError(null);
    setStreamingText('');
    setGeneratingChatId(chatIdAtStart);
    setIsGenerating(true);

    // Create user message object
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: cleanText,
      timestamp: Date.now(),
    };

    // Update active chat with the user's message
    // Auto-update title if it was "Новый диалог" using first 24 characters of prompt
    let chatTitle = activeChat.title;
    if (chatTitle === 'Новый диалог' && activeChat.messages.length === 0) {
      chatTitle = cleanText.length > 24 ? `${cleanText.substring(0, 24)}...` : cleanText;
    }

    const updatedMessages = [...activeChat.messages, userMessage];

    const updatedChatsWithUser = chats.map((c) => {
      if (c.id === chatIdAtStart) {
        return {
          ...c,
          title: chatTitle,
          messages: updatedMessages,
          updatedAt: Date.now(),
        };
      }
      return c;
    });

    saveChatsToStorage(updatedChatsWithUser);

    // Trigger instant scroll to bottom
    userAtBottomRef.current = true;
    setTimeout(() => scrollToBottom('smooth'), 10);

    // Stop execution if offline
    if (!navigator.onLine) {
      setError('Ошибка сети: Устройство отключено от Интернета.');
      setIsGenerating(false);
      setGeneratingChatId(null);
      return;
    }

    try {
      const activeStrategy = modeRegistry.get(activeMode);
      const decorated = activeStrategy.decorateRequestPayload({
        messages: updatedMessages,
        config: activeChat.parameters,
        workspaceId: activeChat.workspaceId,
        chatTitle: activeChat.title,
      });

      // Send chat context to full-stack backend Express endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages
            .filter((m) => !m.isSystem)
            .map((m) => ({ role: m.role, content: m.content })),
          modelId: activeChat.modelId,
          config: decorated.config,
          apiKey: kieApiKey,
          workspaceId: decorated.workspaceId,
          mode: activeMode,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Не удалось связаться с сервером нейросети.');
      }

      // Handle raw body chunks reading
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (!reader) {
        throw new Error('Поток вывода недоступен.');
      }

      let done = false;
      let accumulatedResponse = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          accumulatedResponse += chunk;
          setStreamingText(accumulatedResponse);
        }
      }

      // Finalize: save generated message
      const trimmedResponse = accumulatedResponse.trim();
      const modelMessage: Message = {
        id: generateId(),
        role: 'model',
        content: trimmedResponse || 'Извините, ответ от модели пуст.',
        timestamp: Date.now(),
        isSystem: !trimmedResponse,
      };

      setChats((prevChats) => {
        const finalChats = prevChats.map((c) => {
          if (c.id === chatIdAtStart) {
            return {
              ...c,
              messages: [...c.messages, modelMessage],
              updatedAt: Date.now(),
            };
          }
          return c;
        });
        localStorage.setItem('kie_neurochat_chats', JSON.stringify(finalChats));
        return finalChats;
      });

      setStreamingText('');

    } catch (err: any) {
      console.error('Error generating chat response:', err);
      setError(err.message || 'Произошла непредвиденная ошибка генерации ответа.');
    } finally {
      setIsGenerating(false);
      setGeneratingChatId(null);
    }
  };

  // --- Key events inside Composer Textarea ---
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter, unless Shift is held down (for multi-line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const currentStrategy = modeRegistry.get(activeMode);
  const isAgentTheme = currentStrategy.capabilities.showAgentDashboard;

  return (
    <div className={`relative h-[100dvh] flex flex-col justify-between mx-auto border-x shadow-xl overflow-hidden transition-all duration-200 ${
      isAgentTheme 
        ? 'max-w-5xl bg-slate-900 border-slate-800 text-slate-200' 
        : 'max-w-lg bg-white border-slate-100 text-slate-800'
    }`}>
      
      {/* 1. TOP HEADER / TRIGGER BAR */}
      {isAgentTheme ? (
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between z-30 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all cursor-pointer"
              title="Список диалогов / Проектов"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <Code2 className="h-4 w-4 text-sky-400 shrink-0" />
                <span className="text-xs font-bold text-white font-display truncate max-w-[180px] sm:max-w-xs">
                  {activeChat?.title || 'Агентский проект'}
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-mono border border-sky-500/30 font-semibold">
                  ⚡ Агентская среда
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ApiStatusIndicator
              status={apiStatus}
              latencyMs={apiLatency}
              onOpenDiagnostics={() => setIsDiagnosticModalOpen(true)}
              isAgentTheme={true}
            />
            {activeChat && activeChat.messages.length > 0 && (
              <button
                onClick={clearCurrentChatMessages}
                disabled={isGenerating}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                title="Очистить проект"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
              title="Открыть каталог файлов проекта"
            >
              <FolderTree className="h-4 w-4" />
              <span className="hidden sm:inline">Каталог проекта</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 shadow-md border border-slate-100 rounded-full h-11 w-11 transition-all focus:outline-hidden cursor-pointer touch-manipulation active:scale-95"
            title="Открыть список диалогов"
          >
            <Menu className="h-5 w-5" />
          </button>
          <ApiStatusIndicator
            status={apiStatus}
            latencyMs={apiLatency}
            onOpenDiagnostics={() => setIsDiagnosticModalOpen(true)}
            isAgentTheme={false}
          />
        </div>
      )}

      {/* Floating Action Buttons for Chat mode */}
      {!isAgentTheme && activeChat && activeChat.messages.length > 0 && (
        <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 animate-fade-in">
          <button
            onClick={copyChatHistory}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white/95 hover:bg-white text-slate-600 hover:text-sky-600 shadow-md border border-slate-100 rounded-xl text-[11px] font-semibold font-display transition-all cursor-pointer touch-manipulation active:scale-95"
            title="Скопировать историю переписки"
          >
            {historyCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
            <span>{historyCopied ? 'Скопировано!' : 'Копировать'}</span>
          </button>
          
          <button
            onClick={clearCurrentChatMessages}
            disabled={isGenerating}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white/95 hover:bg-white text-slate-600 hover:text-red-500 disabled:opacity-50 shadow-md border border-slate-100 rounded-xl text-[11px] font-semibold font-display transition-all cursor-pointer touch-manipulation active:scale-95"
            title="Очистить текущий диалог"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Очистить</span>
          </button>
        </div>
      )}

      {/* 2. MAIN DIALOGUE AREA (With vertical scroll) */}
      <main
        ref={chatContainerRef}
        onScroll={handleContainerScroll}
        className={`flex-1 overflow-y-auto px-4 pt-16 pb-4 space-y-5 transition-colors duration-200 ${
          isAgentTheme ? 'bg-white text-slate-900' : 'bg-slate-50/40 text-slate-800'
        }`}
      >
        {isOffline && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3.5 py-2.5 rounded-xl shadow-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Вы работаете в офлайн-режиме. Отправка сообщений временно заблокирована.</span>
          </div>
        )}

        {/* EMPTY STATE */}
        {activeChat && activeChat.messages.length === 0 && !streamingText && (
          <div className="flex flex-col justify-center py-8 space-y-6 animate-fade-in">
            {/* Minimal Greeting */}
            <div className="space-y-2 text-center max-w-[85%] mx-auto mt-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-sky-50 rounded-2xl mb-1 text-sky-600">
                {isAgentTheme ? <Code2 className="h-6 w-6 stroke-[1.5]" /> : <Sparkles className="h-6 w-6 stroke-[1.5] animate-pulse" />}
              </div>
              <h3 className="text-lg font-bold font-display text-slate-950">
                {isAgentTheme ? 'Агентская среда разработки' : 'Минималистичный нейрочат'}
              </h3>
              <p className="text-slate-500 text-xs leading-normal">
                {isAgentTheme 
                  ? 'Каждый чат равен отдельному проекту. Используйте панель «Каталог проекта» справа для просмотра и работы с файлами.' 
                  : 'Напишите ваше сообщение, чтобы начать диалог. Настройки модели доступны прямо на нижней панели ввода.'}
              </p>
            </div>

            {/* Quick Prompt Chips */}
            <div className="space-y-2 px-1 max-w-lg mx-auto w-full">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1.5 font-display">
                {isAgentTheme ? 'Примеры задач агенту' : 'Примеры запросов'}
              </span>
              <div className="grid grid-cols-1 gap-2">
                {(isAgentTheme ? [
                  { label: '📂 Проанализировать структуру проекта', prompt: 'Покажи структуру каталога проекта и кратко опиши назначение ключевых модулей.' },
                  { label: '🔍 Найти возможные ошибки в коде', prompt: 'Проверь код в проекте на потенциальные баги, утечки памяти или некорректную обработку ошибок.' },
                  { label: '⚡ Предложить оптимизацию', prompt: 'Изучи модули приложения и предложи улучшения производительности и структуры.' }
                ] : PROMPT_CHIPS).map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputMessage(chip.prompt);
                      textareaRef.current?.focus();
                    }}
                    className="w-full text-left bg-slate-50 hover:bg-slate-100 text-[13px] text-slate-700 font-medium p-3.5 rounded-xl border border-slate-200/60 shadow-xs transition-all cursor-pointer min-h-[44px] touch-manipulation active:bg-slate-200"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AGENT ORCHESTRATOR DASHBOARD (Only visible in Agent Mode) */}
        {activeChat && isAgentTheme && (
          <AgentDashboard
            workspaceId={activeChat.workspaceId || 'ws_default'}
            activeTask={getActiveTaskTitle(activeChat, streamingText)}
          />
        )}

        {/* DIALOG MESSAGES */}
        {activeChat && activeChat.messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSys = msg.isSystem;
          
          return (
            <div
              key={msg.id}
              className={`flex w-full animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`group relative max-w-[88%] px-4 py-3 rounded-2xl shadow-xs transition-all duration-200 ${
                  isSys
                    ? 'bg-amber-50/50 text-amber-900 border border-amber-200 rounded-2xl w-full'
                    : isUser
                    ? 'bg-sky-50 text-slate-900 border border-sky-100/60 rounded-br-none'
                    : 'bg-white text-slate-800 border border-slate-100/80 rounded-bl-none'
                }`}
              >
                {isSys ? (
                  <div className="flex items-start gap-2.5 text-xs text-amber-800">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                    <div className="space-y-1 w-full">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-bold">Уведомление системы</span>
                        <button
                          onClick={() => setMsgToDelete(msg.id)}
                          className="text-amber-500 hover:text-red-500 p-1 rounded-md transition-colors cursor-pointer"
                          title="Удалить уведомление"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="leading-normal">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {isUser ? (
                      <p className="text-[12px] whitespace-pre-wrap leading-relaxed text-slate-800 pb-1">
                        {msg.content}
                      </p>
                    ) : (
                      <div className="pb-1">
                        <Markdown content={msg.content} />
                      </div>
                    )}
                    
                    {/* Controls at the bottom right of the message bubble */}
                    <div className="mt-1 pt-1 border-t border-slate-100/60 flex items-center justify-end gap-2.5 text-slate-400 opacity-60 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="inline-flex items-center gap-1 text-[11px] hover:text-sky-600 text-slate-400 font-medium transition-colors cursor-pointer touch-manipulation"
                        title="Копировать текст"
                      >
                        {copiedMessageId === msg.id ? (
                          <>
                            <Check className="h-3 w-3 text-green-500" />
                            <span className="text-green-600">Скопировано</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Копировать</span>
                          </>
                        )}
                      </button>
                      
                      <span className="text-slate-200 text-[10px] select-none">|</span>
                      
                      <button
                        onClick={() => {
                          setSelectedSelectionMsg(msg);
                          setSelectionSearch('');
                          setSelectionTab('plain');
                        }}
                        className="inline-flex items-center gap-1 text-[11px] hover:text-sky-600 text-slate-400 font-medium transition-colors cursor-pointer touch-manipulation"
                        title="Удобное выделение и поиск текста"
                      >
                        <TextCursor className="h-3 w-3" />
                        <span>Выделить</span>
                      </button>
                      
                      <span className="text-slate-200 text-[10px] select-none">|</span>
                      
                      <button
                        onClick={() => setMsgToDelete(msg.id)}
                        className="inline-flex items-center gap-1 text-[11px] hover:text-red-500 text-slate-400 font-medium transition-colors cursor-pointer touch-manipulation"
                        title="Удалить сообщение"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Удалить</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* ACTIVE STREAMING RESPONSE CHUNK */}
        {activeChat && generatingChatId === activeChat.id && streamingText && (
          <div className="flex w-full justify-start animate-fade-in flex-col gap-2">
            {currentStrategy.capabilities.hasTaskExecutionStatus && (
              <div className="self-start bg-purple-50/80 border border-purple-100/80 px-3 py-1.5 rounded-xl flex items-center gap-2 text-purple-700 text-[11px] font-semibold">
                <Activity className="h-3.5 w-3.5 animate-spin text-purple-500" />
                <span>Выполняется: {getActiveTaskTitle(activeChat, streamingText).taskName}</span>
              </div>
            )}
            <div className={`max-w-[88%] px-4 py-3 bg-white text-slate-800 border ${currentStrategy.theme.activeBorder || 'border-slate-100/80'} rounded-2xl rounded-bl-none shadow-xs`}>
              <Markdown content={streamingText} />
            </div>
          </div>
        )}

        {/* GENERATION INDICATOR / EXECUTING TASK LOADER */}
        {activeChat && generatingChatId === activeChat.id && isGenerating && !streamingText && (
          <div className="flex w-full justify-start animate-fade-in">
            {currentStrategy.capabilities.hasTaskExecutionStatus ? (
              /* AGENT MODE: TASK & STEP LOADER */
              <div className="bg-white border border-purple-100/90 px-4 py-3.5 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-3 max-w-[88%]">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl shrink-0">
                  <Activity className="h-4.5 w-4.5 animate-spin" />
                </div>
                <div className="text-left space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                      Агентная задача
                    </span>
                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping" />
                  </div>
                  <p className="text-[12.5px] font-bold text-slate-900 font-display">
                    {getActiveTaskTitle(activeChat, streamingText).taskName}
                  </p>
                  {getActiveTaskTitle(activeChat, streamingText).stepName && (
                    <p className="text-[11px] text-slate-400 font-medium">
                      Текущий шаг: {getActiveTaskTitle(activeChat, streamingText).stepName}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* REGULAR CHAT MODE: CLEAN RESPONSE GENERATION INDICATOR */
              <div className="bg-white border border-sky-100/90 px-4 py-3 rounded-2xl rounded-bl-none shadow-xs flex items-center gap-3 max-w-[88%]">
                <div className="p-2 bg-sky-50 text-sky-600 rounded-xl shrink-0">
                  <Sparkles className="h-4 w-4 animate-pulse text-sky-500" />
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <span>{currentStrategy.capabilities.loadingText || 'Идет генерация ответа'}</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-bounce"></span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl shadow-xs space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <div className="space-y-1 leading-normal">
                <span className="font-bold">Упс, что-то пошло не так:</span>
                <p>{error}</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (activeChat && activeChat.messages.length > 0) {
                  sendMessage(activeChat.messages[activeChat.messages.length - 1].content);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1.5 px-3 rounded-lg text-[11px] transition-colors cursor-pointer"
            >
              Повторить запрос
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* 3. COMPOSER ZONE (Pinned to Bottom) */}
      <footer className="shrink-0 border-t border-slate-150/75 bg-white shadow-lg relative z-20">
        
        {/* Model parameters collapsible drawer built directly into composer */}
        {activeChat && (
          <ModelSettings
            selectedModelId={activeChat.modelId}
            onModelChange={changeActiveChatModel}
            parameters={activeChat.parameters}
            onParamChange={updateActiveChatParams}
            isOpen={settingsOpen}
            onToggleOpen={() => setSettingsOpen(!settingsOpen)}
            onResetParams={resetActiveChatParams}
            apiStatus={apiStatus}
            apiLatency={apiLatency}
            onOpenDiagnostics={() => setIsDiagnosticModalOpen(true)}
          />
        )}

        {/* Input Textbox Composer Panel */}
        <div className="px-3 py-3 bg-white flex items-end gap-2 max-w-full">
          <div className="flex-1 bg-slate-100 hover:bg-slate-100/90 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 border border-transparent rounded-2xl transition-all duration-200 flex items-end px-3 py-1.5">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating || isOffline}
              placeholder={isOffline ? 'Нет подключения...' : 'Напишите сообщение...'}
              className="flex-1 max-h-32 text-[14px] bg-transparent border-0 focus:outline-hidden focus:ring-0 p-1 placeholder-slate-400 font-sans leading-snug resize-none align-bottom min-h-[24px]"
              style={{ height: 'auto' }}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={() => sendMessage()}
            disabled={!inputMessage.trim() || isGenerating || isOffline}
            className="flex items-center justify-center h-10 w-10 shrink-0 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-150 disabled:text-slate-400 text-white shadow-md hover:shadow-lg disabled:shadow-none rounded-xl transition-all duration-200 cursor-pointer touch-manipulation min-h-[40px] min-w-[40px] active:scale-95 disabled:active:scale-100"
            title="Отправить сообщение"
          >
            <SendHorizontal className="h-4.5 w-4.5" />
          </button>
        </div>
      </footer>

      {/* 4. CHATS LIST SIDEBAR DRAWER */}
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        activeMode={activeMode}
        onSelectMode={handleSelectMode}
        onSelectChat={selectChat}
        onCreateChat={createNewChat}
        onDeleteChat={deleteChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        kieApiKey={kieApiKey}
        onSaveKieApiKey={saveKieApiKey}
        kieBalance={kieBalance}
        kieCurrency={kieCurrency}
        isCheckingBalance={isCheckingBalance}
        balanceError={balanceError}
        onCheckBalance={() => checkKieBalance()}
        apiStatus={apiStatus}
        apiLatency={apiLatency}
        onOpenDiagnostics={() => setIsDiagnosticModalOpen(true)}
      />

      {/* 5. RIGHT SIDEBAR - PROJECT FILES & AGENT WORKSPACE */}
      <RightSidebar
        isOpen={rightSidebarOpen}
        onClose={() => setRightSidebarOpen(false)}
        workspaceId={activeChat?.workspaceId || 'ws_default'}
        chatTitle={activeChat?.title || 'Агентский проект'}
      />

      {/* 5. CONFIRM DELETE MODAL */}
      {msgToDelete && (
        <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-[85%] w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="space-y-2 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-red-50 text-red-500 rounded-full">
                <Trash2 className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 font-display">Удалить сообщение?</h4>
              <p className="text-slate-500 text-xs leading-normal">
                Вы уверены, что хотите удалить это сообщение? Это действие нельзя отменить, и это изменит контекст беседы.
              </p>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setMsgToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  if (msgToDelete) {
                    confirmDeleteMessage(msgToDelete);
                  }
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs shadow-md transition-colors cursor-pointer"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. CONVENIENT TEXT SELECTION & READER MODAL */}
      {selectedSelectionMsg && (
        <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-sky-50 text-sky-600 rounded-xl">
                  <TextCursor className="h-4.5 w-4.5" />
                </div>
                <div className="text-left">
                  <h4 className="text-[13.5px] font-bold text-slate-950 font-display">Выделение и поиск текста</h4>
                  <p className="text-[10.5px] text-slate-400">Удобное выделение длинных фрагментов без прокрутки всей страницы</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedSelectionMsg(null);
                  setSelectionSearch('');
                  setSelectionTab('plain');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                title="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Toolbar: Search and Tabs */}
            <div className="p-4 border-b border-slate-100 bg-white space-y-3.5 shrink-0">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Быстрый поиск ключевых слов..."
                  value={selectionSearch}
                  onChange={(e) => setSelectionSearch(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs pl-9 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-left placeholder:text-slate-400 text-slate-800"
                />
                {selectionSearch && (
                  <button
                    onClick={() => setSelectionSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
                <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/50 self-start">
                  <button
                    onClick={() => setSelectionTab('plain')}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectionTab === 'plain'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5 text-slate-500" />
                    <span>Весь текст</span>
                  </button>
                  <button
                    onClick={() => setSelectionTab('paragraphs')}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectionTab === 'paragraphs'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Menu className="h-3.5 w-3.5 text-slate-500 rotate-90" />
                    <span>По абзацам</span>
                  </button>
                  <button
                    onClick={() => setSelectionTab('markdown')}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectionTab === 'markdown'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-slate-500" />
                    <span>Разметка</span>
                  </button>
                </div>

                {/* Copy whole message */}
                <button
                  onClick={async () => {
                    const success = await copyToClipboard(selectedSelectionMsg.content);
                    if (success) {
                      setSelectionAllCopied(true);
                      setTimeout(() => setSelectionAllCopied(false), 2000);
                    }
                  }}
                  className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs border border-sky-100"
                >
                  {selectionAllCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-green-700">Скопировано всё!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Копировать всё</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
              {selectionTab === 'plain' && (
                <div className="h-full flex flex-col space-y-2">
                  <div className="text-[10px] text-slate-400 font-mono flex justify-between px-1">
                    <span>Выделите нужный фрагмент курсором или нажмите Ctrl+A</span>
                    <span>Символов: {selectedSelectionMsg.content.length}</span>
                  </div>
                  <textarea
                    readOnly
                    value={selectedSelectionMsg.content}
                    className="flex-1 w-full p-4 font-mono text-[12px] leading-relaxed text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-0 resize-none selection:bg-sky-100 selection:text-slate-950 shadow-xs"
                    placeholder="Пустое сообщение"
                  />
                </div>
              )}

              {selectionTab === 'paragraphs' && (() => {
                const rawParagraphs = selectedSelectionMsg.content.split(/\n\n+/);
                const filtered = rawParagraphs
                  .map((p, idx) => ({ text: p.trim(), originalIndex: idx }))
                  .filter(item => item.text.length > 0 && 
                    (!selectionSearch || item.text.toLowerCase().includes(selectionSearch.toLowerCase()))
                  );

                if (filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                      <Search className="h-8 w-8 stroke-[1.2] text-slate-300" />
                      <p className="text-xs font-medium">Ничего не найдено по этому поисковому слову</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3 text-left">
                    {filtered.map((item, index) => {
                      const isCopied = selectionCopiedIndex === item.originalIndex;
                      
                      return (
                        <div 
                          key={index}
                          className="bg-white border border-slate-200/60 rounded-xl p-3.5 hover:shadow-xs hover:border-slate-300 transition-all group/para relative"
                        >
                          <div className="flex justify-between items-center gap-3 mb-2">
                            <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                              Блок #{item.originalIndex + 1}
                            </span>
                            <button
                              onClick={async () => {
                                const success = await copyToClipboard(item.text);
                                if (success) {
                                  setSelectionCopiedIndex(item.originalIndex);
                                  setTimeout(() => setSelectionCopiedIndex(null), 2000);
                                }
                              }}
                              className="px-2 py-1 bg-slate-50 hover:bg-sky-50 text-slate-500 hover:text-sky-600 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border border-slate-100"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="h-3 w-3 text-green-500" />
                                  <span className="text-green-600">Скопировано</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Скопировать блок</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-[12px] text-slate-800 leading-relaxed whitespace-pre-wrap selection:bg-sky-100 selection:text-slate-950">
                            {highlightText(item.text, selectionSearch)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {selectionTab === 'markdown' && (
                <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs max-w-full overflow-x-hidden selection:bg-sky-100 selection:text-slate-950 text-left">
                  <Markdown content={selectedSelectionMsg.content} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 flex justify-between items-center shrink-0 text-[10.5px] text-slate-400 font-medium">
              <span>💡 В режиме «Весь текст» можно использовать стандартный выбор мышью.</span>
              <button
                onClick={() => {
                  setSelectedSelectionMsg(null);
                  setSelectionSearch('');
                  setSelectionTab('plain');
                }}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
              >
                Закрыть
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 6. API DIAGNOSTIC MODAL */}
      <ApiDiagnosticModal
        isOpen={isDiagnosticModalOpen}
        onClose={() => setIsDiagnosticModalOpen(false)}
        diagnosticResult={diagnosticResult}
        isDiagnosing={isDiagnosing}
        onRunDiagnostic={() => runApiDiagnostic()}
        selectedModelId={activeChat ? activeChat.modelId : 'gpt-5-6-sol'}
        kieApiKey={kieApiKey}
        onOpenKeySettings={() => setSidebarOpen(true)}
      />

    </div>
  );
}
