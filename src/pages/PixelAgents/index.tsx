import { useEffect, useRef } from 'react';
import { OfficeState } from './engine/officeState';
import { PixelCanvas } from './PixelCanvas';
import { useAgentAdapter } from './useAgentAdapter';
import { loadPixelAssets } from './assetLoader';

// ──────────────────────────────────────────────────────────────
// PixelAgentsPage — Virtual pixel-art office for OpenClaw Station
// Characters react to chat state (typing, waiting, tools).
// ──────────────────────────────────────────────────────────────

export function PixelAgentsPage() {
  const { agents } = useAgentAdapter();

  // OfficeState is stable across renders — stored in a ref
  const officeStateRef = useRef<OfficeState | null>(null);
  if (!officeStateRef.current) {
    officeStateRef.current = new OfficeState();
    // Add one character by default (main agent, id=1)
    officeStateRef.current.addAgent(1);
  }
  const officeState = officeStateRef.current;

  // Load all pixel assets + upgrade to the full default layout once ready
  useEffect(() => {
    loadPixelAssets().then((layout) => {
      if (layout && officeStateRef.current) {
        officeStateRef.current.rebuildFromLayout(layout);
      }
    });
  }, []);

  // Sync agent activity state from chat store
  useEffect(() => {
    for (const agent of agents) {
      if (officeState.characters.has(agent.id)) {
        officeState.setAgentActive(agent.id, agent.isActive);
        officeState.setAgentTool(agent.id, agent.currentTool);
      } else {
        // Agent appeared — add them
        officeState.addAgent(agent.id);
        officeState.setAgentActive(agent.id, agent.isActive);
        officeState.setAgentTool(agent.id, agent.currentTool);
      }
    }

    // Remove agents that are no longer tracked
    const trackedIds = new Set(agents.map((a) => a.id));
    for (const id of officeState.characters.keys()) {
      if (id > 0 && !trackedIds.has(id)) {
        officeState.removeAgent(id);
      }
    }
  }, [agents, officeState]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a14',
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 18 }}>🏢</span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.85)',
            letterSpacing: '0.02em',
          }}
        >
          Pixel Office
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.35)',
            marginLeft: 4,
          }}
        >
          {agents.some((a) => a.isActive) ? '⚡ Active' : '💤 Idle'}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.2)',
            marginLeft: 'auto',
          }}
        >
          Auto-fit
        </span>
      </div>

      {/* Canvas fills remaining space */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <PixelCanvas officeState={officeState} />
      </div>
    </div>
  );
}

export default PixelAgentsPage;
