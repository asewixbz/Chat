import { ModeStrategy } from './types';
import { chatModeStrategy } from './strategies/chatMode';
import { agentModeStrategy } from './strategies/agentMode';

class ModeRegistry {
  private strategies: Map<string, ModeStrategy> = new Map();

  constructor() {
    // Register standard default modes
    this.register(chatModeStrategy);
    this.register(agentModeStrategy);
  }

  /**
   * Registers a mode strategy.
   * Allows adding future modes (e.g., 'researcher', 'coder', 'translator')
   * seamlessly without modifying existing code!
   */
  public register(strategy: ModeStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  /**
   * Gets a mode strategy by ID.
   * Defaults to 'chat' if ID is unknown or undefined.
   */
  public get(modeId?: string): ModeStrategy {
    const id = modeId || 'chat';
    return this.strategies.get(id) || this.strategies.get('chat')!;
  }

  /**
   * Returns all registered mode strategies for UI selection.
   */
  public getAll(): ModeStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Checks if a mode ID exists.
   */
  public has(modeId: string): boolean {
    return this.strategies.has(modeId);
  }
}

export const modeRegistry = new ModeRegistry();
