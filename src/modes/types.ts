import { Message, ModelParameters } from '../types';

export interface ModeTheme {
  badgeBg: string;
  badgeText: string;
  activeBorder: string;
  bgAccent: string;
  headerAccent: string;
  inputBorder: string;
  buttonColor: string;
}

export interface ModeCapabilities {
  requiresWorkspace: boolean;
  supportsTools: boolean;
  showAgentDashboard: boolean;
  showSidebarWorkspaces: boolean;
}

export interface SystemPromptContext {
  userPrompt?: string;
  chatTitle?: string;
  workspaceInfo?: { name: string; rootPath: string };
  fileTreeText?: string;
}

export interface RequestDecoratorContext {
  messages: Message[];
  config: ModelParameters;
  workspaceId?: string;
  chatTitle?: string;
}

export interface DecoratedRequestPayload {
  config: ModelParameters;
  workspaceId?: string;
  extraMeta?: Record<string, any>;
}

export interface ModeStrategy {
  id: string;
  name: string;
  description: string;
  iconName: string;
  badgeText?: string;
  
  theme: ModeTheme;
  capabilities: ModeCapabilities;

  /**
   * Builds the system prompt for this mode.
   * Isolates mode-specific instructions completely.
   */
  buildSystemPrompt: (ctx: SystemPromptContext) => string;

  /**
   * Prepares and decorates request payload before sending to backend.
   */
  decorateRequestPayload: (ctx: RequestDecoratorContext) => DecoratedRequestPayload;
}
