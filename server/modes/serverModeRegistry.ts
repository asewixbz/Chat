export interface ServerModeContext {
  messages: any[];
  config: any;
  workspaceId?: string;
  workspacesMap: Record<string, any>;
  defaultWorkspace: any;
  buildFileTree: (dirPath: string, rootPath: string, depth?: number, maxDepth?: number) => any[];
}

export interface ServerModeStrategy {
  modeId: string;
  prepareSystemPrompt: (ctx: ServerModeContext) => string;
  prepareWorkspaceId: (workspaceId?: string) => string | undefined;
}

// 1. Regular Chat Mode Strategy (ABSOLUTE ISOLATION)
const serverChatStrategy: ServerModeStrategy = {
  modeId: 'chat',
  prepareSystemPrompt: ({ config }) => {
    let basePrompt = (config?.systemPrompt || '').trim();

    // Strip any leaked workspace tree or agent instructions
    if (basePrompt.includes('=== РАБОЧЕЕ ПРОСТРАНСТВО ПРОЕКТА')) {
      basePrompt = basePrompt.split('=== РАБОЧЕЕ ПРОСТРАНСТВО ПРОЕКТА')[0].trim();
    }
    if (basePrompt.includes('Инструкция для Автономного Агента Разработки')) {
      basePrompt = basePrompt.split('Инструкция для Автономного Агента Разработки')[0].trim();
    }
    if (basePrompt.includes('Вы — ИИ Агент-разработчик')) {
      basePrompt = basePrompt.split('Вы — ИИ Агент-разработчик')[0].trim();
    }

    return basePrompt;
  },
  prepareWorkspaceId: () => undefined, // No workspace for standard chat mode
};

// 2. Agent Mode Strategy
const serverAgentStrategy: ServerModeStrategy = {
  modeId: 'agent',
  prepareSystemPrompt: ({ config, workspaceId, workspacesMap, defaultWorkspace, buildFileTree }) => {
    let basePrompt = (config?.systemPrompt || '').trim();
    const targetWsId = workspaceId || "ws_default";
    const wsStore = workspacesMap[targetWsId] || defaultWorkspace;
    const wsFileTree = buildFileTree(wsStore.rootPath, wsStore.rootPath, 0, 4);

    function renderTree(nodes: any[], indent = ''): string {
      let text = '';
      for (const node of nodes) {
        if (node.type === 'directory') {
          text += `${indent}📁 ${node.name}/\n`;
          if (node.children && node.children.length > 0) {
            text += renderTree(node.children, indent + '  ');
          }
        } else {
          const sizeKb = node.size ? ` (${Math.round(node.size / 1024)} KB)` : '';
          text += `${indent}📄 ${node.name}${sizeKb}\n`;
        }
      }
      return text;
    }

    const fileTreeText = renderTree(wsFileTree);
    const workspaceContextString = `\n\n=== РАБОЧЕЕ ПРОСТРАНСТВО ПРОЕКТА (${wsStore.name}) ===\nКаталог: ${wsStore.rootPath}\n\nСтруктура файлов проекта:\n${fileTreeText || '(файлы не найдены)'}\n================================================`;

    if (!basePrompt.includes('=== РАБОЧЕЕ ПРОСТРАНСТВО ПРОЕКТА')) {
      basePrompt = basePrompt ? `${basePrompt}\n${workspaceContextString}` : workspaceContextString;
    }

    if (!basePrompt.includes('[TASK:')) {
      basePrompt += `\n\nИнструкция для Автономного Агента Разработки:
1. Вы работаете в режиме автономного исполнителя (Agent Orchestrator).
2. Вы ОБЯЗАНЫ формировать ответ с обязательной структурированной разметкой выполнения:
   [TASK: Название решаемой задачи]
   [STEP: Текущий активный шаг]
3. Вы не просто рассказываете, а ВЫПОЛНЯЕТЕ задачу: создаете и изменяете файлы, приводите готовый рабочий код с указанием путей, конфигурации и точных bash-команд для запуска и проверки.
4. Внимательно анализируйте предоставленное выше РАБОЧЕЕ ПРОСТРАНСТВО ПРОЕКТА и его файловую структуру.`;
    }

    return basePrompt;
  },
  prepareWorkspaceId: (wsId) => wsId || "ws_default",
};

class ServerModeRegistry {
  private strategies = new Map<string, ServerModeStrategy>();

  constructor() {
    this.register(serverChatStrategy);
    this.register(serverAgentStrategy);
  }

  /**
   * Register a new server mode strategy.
   * Enables adding future modes cleanly on the backend.
   */
  public register(strategy: ServerModeStrategy) {
    this.strategies.set(strategy.modeId, strategy);
  }

  /**
   * Retrieves server strategy for the given mode ID.
   * Defaults to 'chat' if unknown.
   */
  public get(modeId?: string): ServerModeStrategy {
    const id = modeId || 'chat';
    return this.strategies.get(id) || serverChatStrategy;
  }
}

export const serverModeRegistry = new ServerModeRegistry();
