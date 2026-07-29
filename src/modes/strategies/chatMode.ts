import { ModeStrategy } from '../types';

export const chatModeStrategy: ModeStrategy = {
  id: 'chat',
  name: 'Обычный чат',
  description: 'Классический диалог с ИИ без доступа к файлам проекта',
  iconName: 'MessageSquare',
  badgeText: 'Чат',
  theme: {
    badgeBg: 'bg-sky-500/10 dark:bg-sky-400/10',
    badgeText: 'text-sky-600 dark:text-sky-400',
    activeBorder: 'border-sky-500/20',
    bgAccent: 'bg-background',
    headerAccent: 'from-sky-500/10',
    inputBorder: 'focus-within:border-sky-500/50',
    buttonColor: 'bg-sky-600 hover:bg-sky-500 text-white',
  },
  capabilities: {
    requiresWorkspace: false,
    supportsTools: false,
    showAgentDashboard: false,
    showSidebarWorkspaces: false,
  },
  buildSystemPrompt: ({ userPrompt }) => {
    // Pure, untainted user prompt
    return (userPrompt || '').trim();
  },
  decorateRequestPayload: ({ config }) => {
    let cleanPrompt = (config?.systemPrompt || '').trim();
    
    // Safety guard against any previous mode leaks
    if (cleanPrompt.includes('=== РАБОЧЕЕ ПРОСТРАНСТВО ПРОЕКТА')) {
      cleanPrompt = cleanPrompt.split('=== РАБОЧЕЕ ПРОСТРАНСТВО ПРОЕКТА')[0].trim();
    }
    if (cleanPrompt.includes('Инструкция для Автономного Агента Разработки')) {
      cleanPrompt = cleanPrompt.split('Инструкция для Автономного Агента Разработки')[0].trim();
    }
    if (cleanPrompt.includes('Вы — ИИ Агент-разработчик')) {
      cleanPrompt = cleanPrompt.split('Вы — ИИ Агент-разработчик')[0].trim();
    }

    return {
      config: {
        ...config,
        systemPrompt: cleanPrompt,
      },
      workspaceId: undefined, // Absolute separation: no workspace for standard chat
    };
  },
};
