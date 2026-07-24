export type ModelId = string;

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  supportedParams: ('temperature' | 'maxTokens' | 'systemPrompt' | 'reasoningEffort' | 'webSearch')[];
}

export const KIE_MODELS: Record<string, ModelInfo> = {
  'gpt-5-6-sol': {
    id: 'gpt-5-6-sol',
    name: 'GPT 5.6 Sol',
    description: 'Флагманская высокоинтеллектуальная модель Sol серии GPT-5.6',
    endpoint: '/gpt-5-6-sol/v1/chat/completions',
    supportedParams: ['reasoningEffort', 'webSearch', 'systemPrompt']
  },
  'gpt-5-6-terra': {
    id: 'gpt-5-6-terra',
    name: 'GPT 5.6 Terra',
    description: 'Сбалансированная и производительная модель серии GPT-5.6',
    endpoint: '/gpt-5-6-terra/v1/chat/completions',
    supportedParams: ['reasoningEffort', 'webSearch', 'systemPrompt']
  },
  'gpt-5-6-luna': {
    id: 'gpt-5-6-luna',
    name: 'GPT 5.6 Luna',
    description: 'Легкая и быстрая модель серии GPT-5.6',
    endpoint: '/gpt-5-6-luna/v1/chat/completions',
    supportedParams: ['reasoningEffort', 'webSearch', 'systemPrompt']
  },
  'gpt-5-5': {
    id: 'gpt-5-5',
    name: 'GPT 5.5',
    description: 'Мощная модель предыдущего поколения с отличным пониманием контекста',
    endpoint: '/gpt-5-5/v1/chat/completions',
    supportedParams: ['reasoningEffort', 'webSearch', 'systemPrompt']
  },
  'gpt-5-4': {
    id: 'gpt-5-4',
    name: 'GPT 5.4',
    description: 'Быстрая и эффективная модель для стандартных задач',
    endpoint: '/gpt-5-4/v1/chat/completions',
    supportedParams: ['reasoningEffort', 'webSearch', 'systemPrompt']
  },
  'gpt-5-2': {
    id: 'gpt-5-2',
    name: 'GPT 5.2',
    description: 'Многоцелевая модель с возможностью гибкой настройки',
    endpoint: '/gpt-5-2/v1/chat/completions',
    supportedParams: ['temperature', 'maxTokens', 'webSearch', 'systemPrompt']
  },
  'cluade-sonnet-5': {
    id: 'cluade-sonnet-5',
    name: 'Claude Sonnet 5',
    description: 'Новейшая модель Sonnet 5 от Anthropic с глубоким анализом кода и текста',
    endpoint: '/cluade-sonnet-5/v1/chat/completions',
    supportedParams: ['temperature', 'maxTokens', 'systemPrompt']
  },
  'cluade-fable-5': {
    id: 'cluade-fable-5',
    name: 'Claude Fable 5',
    description: 'Креативная модель Fable 5, идеально подходящая для генерации текстов',
    endpoint: '/cluade-fable-5/v1/chat/completions',
    supportedParams: ['temperature', 'maxTokens', 'systemPrompt']
  },
  'claude-opus-4-8': {
    id: 'claude-opus-4-8',
    name: 'Claude Opus 4.8',
    description: 'Сверхмощная модель Opus 4.8 для сложнейших логических задач',
    endpoint: '/claude-opus-4-8/v1/chat/completions',
    supportedParams: ['temperature', 'maxTokens', 'systemPrompt']
  },
  'claude-sonnet-4-6': {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: 'Отличная модель для программирования и структурированных ответов',
    endpoint: '/claude-sonnet-4-6/v1/chat/completions',
    supportedParams: ['temperature', 'maxTokens', 'systemPrompt']
  },
  'claude-haiku-4-5': {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    description: 'Супер-быстрая и экономичная модель Haiku 4.5',
    endpoint: '/claude-haiku-4-5/v1/chat/completions',
    supportedParams: ['temperature', 'maxTokens', 'systemPrompt']
  },
  'gemini-3-5-flash': {
    id: 'gemini-3-5-flash',
    name: 'Gemini 3.5 Flash',
    description: 'Быстрая мультимодальная модель от Google с широким окном контекста',
    endpoint: '/gemini-3-5-flash/v1/chat/completions',
    supportedParams: ['temperature', 'maxTokens', 'systemPrompt']
  },
  'gemini-3-1-pro': {
    id: 'gemini-3-1-pro',
    name: 'Gemini 3.1 Pro',
    description: 'Высокоинтеллектуальная профессиональная модель от Google',
    endpoint: '/gemini-3-1-pro/v1/chat/completions',
    supportedParams: ['temperature', 'maxTokens', 'systemPrompt']
  },
  'gemini-2-5-pro': {
    id: 'gemini-2-5-pro',
    name: 'Gemini 2.5 Pro (openai)',
    description: 'Сбалансированная модель Pro-класса в совместимом OpenAI-формате',
    endpoint: '/gemini-2-5-pro/v1/chat/completions',
    supportedParams: ['temperature', 'maxTokens', 'systemPrompt']
  },
  'grok-4-5': {
    id: 'grok-4-5',
    name: 'Grok 4.5',
    description: 'Модель Grok 4.5 со встроенным поиском и высокой скоростью',
    endpoint: '/grok-4-5/v1/chat/completions',
    supportedParams: ['temperature', 'maxTokens', 'systemPrompt']
  },
  'grok-4-3': {
    id: 'grok-4-3',
    name: 'Grok 4.3',
    description: 'Многофункциональная и быстрая модель Grok 4.3',
    endpoint: '/grok-4-3/v1/chat/completions',
    supportedParams: ['temperature', 'maxTokens', 'systemPrompt']
  },
  'gpt-codex': {
    id: 'gpt-codex',
    name: 'GPT Codex',
    description: 'Специализированная модель для написания кода и технических задач',
    endpoint: '/gpt-codex/v1/chat/completions',
    supportedParams: ['temperature', 'maxTokens', 'systemPrompt']
  }
};

export interface ModelParameters {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
  webSearch?: boolean;
}

export type ChatMode = 'chat' | 'agent';

export interface MessageToolCall {
  id: string;
  tool: string;
  arguments: any;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_approval';
  output?: string;
  error?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isSystem?: boolean;
  toolCalls?: MessageToolCall[];
}

export interface Chat {
  id: string;
  title: string;
  modelId: ModelId;
  parameters: ModelParameters;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  mode?: ChatMode;
  workspacePath?: string;
  workspaceId?: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  updatedAt?: string;
  children?: FileNode[];
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  rootPath: string;
  status: 'available' | 'indexing' | 'error';
  settings: {
    shell: string;
    maxFileSizeBytes: number;
    ignoredPaths: string[];
    approvalPolicy: 'strict' | 'safe-auto' | 'full-auto';
  };
}

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'staged';
}

export interface GitInfo {
  branch: string;
  clean: boolean;
  files: GitFileStatus[];
  ahead: number;
  behind: number;
}

export interface PendingApproval {
  id: string;
  workspaceId: string;
  runId?: string;
  tool: string;
  arguments: any;
  reason: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

