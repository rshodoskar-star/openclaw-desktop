import { useMemo } from 'react';
import { useChatStore } from '@/stores/chatStore';

export interface AgentState {
  id: number;
  isActive: boolean;
  currentTool: string | null;
}

export interface AgentAdapterResult {
  agents: AgentState[];
}

/**
 * Hook that bridges OpenClaw Station chat state to Pixel Agents game engine.
 * Watches isTyping and messages to determine agent activity state.
 */
export function useAgentAdapter(): AgentAdapterResult {
  const isTyping = useChatStore((s) => s.isTyping);
  const messages = useChatStore((s) => s.messages);

  const agents = useMemo<AgentState[]>(() => {
    // Determine current tool from last tool-call message
    let currentTool: string | null = null;
    if (isTyping) {
      // Look for the most recent running tool
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'tool' && msg.toolStatus === 'running' && msg.toolName) {
          currentTool = msg.toolName;
          break;
        }
      }
    }

    return [
      {
        id: 1,
        isActive: isTyping,
        currentTool,
      },
    ];
  }, [isTyping, messages]);

  return { agents };
}
