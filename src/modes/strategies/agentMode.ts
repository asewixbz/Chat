import { ModeStrategy } from '../types';

export const agentModeStrategy: ModeStrategy = {
  id: 'agent',
  name: 'Агентская среда',
  description: 'Автономный агент с доступом к файловой системе проекта и терминалу',
  iconName: 'Terminal',
  badgeText: 'Агент',
  theme: {
    badgeBg: 'bg-purple-500/10 dark:bg-purple-400/10',
    badgeText: 'text-purple-600 dark:text-purple-400',
    activeBorder: 'border-purple-500/20',
    bgAccent: 'bg-slate-950/20',
    headerAccent: 'from-purple-500/10',
    inputBorder: 'focus-within:border-purple-500/50',
    buttonColor: 'bg-sky-600 hover:bg-sky-500 text-white',
  },
  capabilities: {
    requiresWorkspace: true,
    supportsTools: true,
    showAgentDashboard: true,
    showSidebarWorkspaces: true,
  },
  buildSystemPrompt: ({ userPrompt, chatTitle, workspaceInfo, fileTreeText }) => {
    let base = (userPrompt || '').trim();
    const wsName = workspaceInfo?.name || 'Проект';
    const wsPath = workspaceInfo?.rootPath || '';

    const agentHeader = `Вы — ИИ Агент-разработчик (Coding Agent) локального проекта "${chatTitle || wsName}".`;

    const workspaceBlock = fileTreeText !== undefined
      ? `\n\n=== РАБОЧЕЕ ПРОСТРАНСТВО ПРОЕКТА (${wsName}) ===\nКаталог: ${wsPath}\n\nСтруктура файлов проекта:\n${fileTreeText || '(файлы не найдены)'}\n================================================`
      : '';

    const agentInstructions = `\n\nИнструкция для Автономного Агента Разработки:
1. Вы работаете в режиме автономного исполнителя (Agent Orchestrator).
2. Вы ОБЯЗАНЫ формировать ответ с обязательной структурированной разметкой выполнения:
   [TASK: Название решаемой задачи]
   [STEP: Текущий активный шаг]
3. Вы не просто рассказываете, а ВЫПОЛНЯЕТЕ задачу: создаете и изменяете файлы, приводите готовый рабочий код с указанием путей, конфигурации и точных bash-команд для запуска и проверки.
4. Внимательно анализируйте предоставленное выше РАБОЧЕЕ ПРОСТРАНСТВО ПРОЕКТА и его файловую структуру.`;

    if (!base.includes('Вы — ИИ Агент-разработчик')) {
      base = base ? `${base}\n\n${agentHeader}` : agentHeader;
    }
    if (workspaceBlock && !base.includes('=== РАБОЧЕЕ ПРОСТРАНСТВО ПРОЕКТА')) {
      base += workspaceBlock;
    }
    if (!base.includes('[TASK:')) {
      base += agentInstructions;
    }

    return base;
  },
  decorateRequestPayload: ({ config, workspaceId, chatTitle }) => {
    const agentHeader = `Вы — ИИ Агент-разработчик (Coding Agent) локального проекта "${chatTitle || 'Проект'}".`;
    let prompt = (config?.systemPrompt || '').trim();

    if (!prompt.includes('Вы — ИИ Агент-разработчик')) {
      prompt = prompt ? `${prompt}\n\n${agentHeader}` : agentHeader;
    }

    return {
      config: {
        ...config,
        systemPrompt: prompt,
      },
      workspaceId: workspaceId || 'ws_default',
    };
  },
};
