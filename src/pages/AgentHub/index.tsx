// ═══════════════════════════════════════════════════════════
// AgentHub v5.1 — Tree View + Grid + Activity Feed
// Dynamic from Gateway API with animated SVG connections
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, RotateCcw, ChevronDown, Zap, AlertCircle, Bot, Search, Code2, Brain, Plus, Trash2, Settings2 } from 'lucide-react';
import { AgentSettingsPanel } from './AgentSettingsPanel';
import { GlassCard } from '@/components/shared/GlassCard';
import { PageTransition } from '@/components/shared/PageTransition';
import { ProgressRing } from '@/components/shared/ProgressRing';
import { StatusDot } from '@/components/shared/StatusDot';
import { useChatStore } from '@/stores/chatStore';
import { useGatewayDataStore, refreshAll, refreshGroup } from '@/stores/gatewayDataStore';
import { gateway } from '@/services/gateway/index';
import clsx from 'clsx';
import { themeHex, themeAlpha, dataColor } from '@/utils/theme-colors';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface SessionInfo {
  key: string;
  label: string;
  type: 'main' | 'cron' | 'subagent';
  model: string;
  totalTokens: number;
  contextTokens: number;
  running: boolean;
  updatedAt: number;
  agentId: string;
}

interface AgentInfo {
  id: string;
  name?: string;
  configured: boolean;
  model?: string;
  workspace?: string;
  [k: string]: unknown;
}

type ViewMode = 'tree' | 'grid' | 'activity';

// ═══════════════════════════════════════════════════════════
// Worker classification
// ═══════════════════════════════════════════════════════════

interface WorkerMeta { icon: string; color: string; tag: string; }

/** Worker meta — called at render time so dataColor() reads current theme */
const getWorkerMeta = (label: string, type: string): WorkerMeta => {
  if (/sync/i.test(label))                     return { icon: '🔄', color: dataColor(9), tag: 'SYNC' };
  if (/embed/i.test(label))                    return { icon: '🧠', color: dataColor(3), tag: 'EMBED' };
  if (/maintenance|صيانة/i.test(label))        return { icon: '🧹', color: dataColor(3), tag: 'MAINTENANCE' };
  if (/backup|نسخ/i.test(label))              return { icon: '💾', color: dataColor(5), tag: 'BACKUP' };
  if (/stats|إحصائ/i.test(label))             return { icon: '📊', color: dataColor(6), tag: 'STATS' };
  if (/research|بحث|تقرير/i.test(label))      return { icon: '📰', color: dataColor(2), tag: 'RESEARCH' };
  if (/diary|يوميات|journal/i.test(label))    return { icon: '📔', color: dataColor(7), tag: 'DIARY' };
  if (/monitor|متابعة|price|سعر/i.test(label)) return { icon: '💰', color: dataColor(4), tag: 'MONITOR' };
  if (type === 'subagent') return { icon: '⚡', color: dataColor(2), tag: 'SUB-AGENT' };
  return { icon: '⏰', color: dataColor(1), tag: 'CRON' };
};

// ═══════════════════════════════════════════════════════════
// Agent display config
// ═══════════════════════════════════════════════════════════

interface AgentDisplay { icon: React.ReactNode; color: string; description: string; }

const AGENT_DISPLAY_PATTERNS: { match: RegExp; icon: React.ReactNode; colorIdx: number; description: string }[] = [
  { match: /research/i, icon: <Search size={20} />, colorIdx: 2, description: 'Search & Analysis' },
  { match: /cod(e|er|ing)/i, icon: <Code2 size={20} />, colorIdx: 5, description: 'Code & Development' },
  { match: /brain|memory|knowledge/i, icon: <Brain size={20} />, colorIdx: 3, description: 'Knowledge & Memory' },
];

/** Called at render time — dataColor() reads current theme */
const getAgentDisplay = (agent: AgentInfo): AgentDisplay => {
  const s = `${agent.id} ${agent.name || ''}`;
  for (const p of AGENT_DISPLAY_PATTERNS) {
    if (p.match.test(s)) return { icon: p.icon, color: dataColor(p.colorIdx), description: p.description };
  }
  return { icon: <Bot size={20} />, color: dataColor(1), description: 'General Agent' };
};

// ── Tree node config (emoji icons for visual tree) ──
/** Tree node config — called at render time so dataColor() reads current theme */
function getTreeNodeConfig(id: string): { icon: string; color: string } {
  if (/pipeline|pipe/i.test(id)) return { icon: '📦', color: dataColor(5) };
  if (/research/i.test(id))      return { icon: '🔍', color: dataColor(2) };
  if (/hilal/i.test(id))         return { icon: '⚽', color: dataColor(6) };
  if (/consult|advisor/i.test(id)) return { icon: '🧠', color: dataColor(3) };
  if (/code|dev/i.test(id))      return { icon: '💻', color: dataColor(5) };
  return { icon: '🤖', color: dataColor(1) };
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

/** Theme-aware primary color — call inside render, not at module scope */
const mainColor = () => themeHex('primary');
const formatTokens = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);

const timeAgo = (ts?: number) => {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

const getSessionType = (key: string): 'main' | 'cron' | 'subagent' => {
  if (key.includes(':cron:')) return 'cron';
  if (key.includes(':subagent:')) return 'subagent';
  return 'main';
};

function parseSessions(raw: any[]): SessionInfo[] {
  return raw.map((s) => {
    const key = s.key || '';
    const type = getSessionType(key);
    const parts = key.split(':');
    const agentId = parts[1] || 'main';
    let label = s.label || '';
    if (!label) {
      if (type === 'main') label = 'Main Session';
      else if (type === 'cron') label = `Cron: ${parts[3]?.substring(0, 8) || '?'}`;
      else label = key;
    }
    return { key, label, type, model: s.model || '', totalTokens: s.totalTokens || 0, contextTokens: s.contextTokens || 200000, running: !!s.running, updatedAt: s.updatedAt || 0, agentId };
  }).sort((a, b) => {
    if (a.running && !b.running) return -1;
    if (!a.running && b.running) return 1;
    return b.updatedAt - a.updatedAt;
  });
}

// ═══════════════════════════════════════════════════════════
// Tree View — SVG connections + animated dots
// ═══════════════════════════════════════════════════════════

function TreeView({ mainSession, registeredAgents, workers, agents, onAgentClick }: {
  mainSession: SessionInfo | undefined;
  registeredAgents: AgentInfo[];
  workers: SessionInfo[];
  agents: AgentInfo[];
  onAgentClick?: (agent: AgentInfo) => void;
}) {
  const runningSubAgents = useGatewayDataStore((s) => s.runningSubAgents);
  const agentCount = registeredAgents.length;
  const mainName = agents.find(a => a.id === 'main')?.name || 'Main Agent';

  // Group workers by parent agent
  const workersByAgent = useMemo(() => {
    const map: Record<string, SessionInfo[]> = {};
    workers.forEach(w => {
      const pid = w.agentId || 'main';
      if (!map[pid]) map[pid] = [];
      map[pid].push(w);
    });
    return map;
  }, [workers]);

  // Count active children per agent (for spawn badges)
  const spawnCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    counts['main'] = registeredAgents.length;
    registeredAgents.forEach(a => {
      counts[a.id] = (workersByAgent[a.id] || []).length;
    });
    return counts;
  }, [registeredAgents, workersByAgent]);

  // Calculate child X positions for SVG (viewBox 0-1000)
  const agentPositions = useMemo(() =>
    registeredAgents.map((_, i) => Math.round(((i + 0.5) / Math.max(agentCount, 1)) * 1000)),
    [registeredAgents, agentCount]
  );

  // Flatten all depth-2 workers with their parent X
  const depth2Layout = useMemo(() => {
    const items: { worker: SessionInfo; parentX: number }[] = [];
    registeredAgents.forEach((agent, ai) => {
      const ws = workersByAgent[agent.id] || [];
      ws.forEach(w => items.push({ worker: w, parentX: agentPositions[ai] }));
    });
    // Also add workers under 'main' that aren't under a registered agent
    const mainWorkers = workersByAgent['main'] || [];
    mainWorkers.forEach(w => items.push({ worker: w, parentX: 500 }));
    return items;
  }, [registeredAgents, workersByAgent, agentPositions]);

  // X positions for depth-2 nodes
  const depth2Positions = useMemo(() => {
    if (depth2Layout.length === 0) return [];
    return depth2Layout.map((_, i) => Math.round(((i + 0.5) / depth2Layout.length) * 1000));
  }, [depth2Layout]);

  return (
    <div className="px-4 py-6 overflow-y-auto">

      {/* ── Depth 0: Main Agent ── */}
      <div className="text-center mb-2">
        <span className="text-[9px] uppercase tracking-[2px] font-bold text-aegis-text-muted">Depth 0 — Orchestrator</span>
      </div>
      <div className="flex justify-center mb-0">
        <div className="relative">
          {/* Spawn badge */}
          {(spawnCounts['main'] || 0) > 0 && (
            <div className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold border-2 border-[var(--aegis-bg-solid)] z-10"
              style={{ background: mainColor(), color: 'var(--aegis-bg-solid)' }}>
              {spawnCounts['main']}
            </div>
          )}
          <div className="relative rounded-2xl border-2 px-6 py-4 min-w-[280px] overflow-hidden transition-all hover:-translate-y-0.5"
            style={{ background: `linear-gradient(135deg, ${mainColor()}12, ${mainColor()}06)`, borderColor: `${mainColor()}40` }}>
            {/* Top accent */}
            <div className="absolute top-0 inset-x-0 h-[2px] opacity-60"
              style={{ background: `linear-gradient(90deg, transparent, ${mainColor()}, transparent)` }} />
            <div className="flex items-center gap-3">
              <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center text-[24px] border relative"
                style={{ background: `linear-gradient(135deg, ${mainColor()}20, ${mainColor()}05)`, borderColor: `${mainColor()}30` }}>
                Æ
                <div className="absolute -bottom-[2px] -end-[2px]">
                  <StatusDot status={mainSession?.running ? 'active' : 'idle'} size={12} glow beacon={mainSession?.running} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-extrabold" style={{ color: mainColor() }}>{mainName}</div>
                <div className="text-[10px] text-aegis-text-dim font-mono">{mainSession?.model.split('/').pop() || '—'}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] px-2 py-0.5 rounded-md font-bold uppercase"
                    style={{ background: `${mainColor()}15`, color: mainColor() }}>
                    {mainSession?.running ? 'Active' : 'Online'}
                  </span>
                  <span className="text-[10px] text-aegis-text-dim font-mono">
                    {mainSession ? `${formatTokens(mainSession.totalTokens)} / ${formatTokens(mainSession.contextTokens)}` : ''}
                  </span>
                </div>
                {/* Token bar */}
                {mainSession && (
                  <div className="w-full h-[3px] rounded-full bg-[rgb(var(--aegis-overlay)/0.06)] mt-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${Math.min(100, Math.round((mainSession.totalTokens / mainSession.contextTokens) * 100))}%`,
                      background: mainColor(),
                    }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SVG Connectors: Main → Agents ── */}
      {agentCount > 0 && (
        <div className="relative h-14">
          <svg viewBox="0 0 1000 56" preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <linearGradient id="grad-main-tree" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={mainColor()} stopOpacity={0.6} />
                <stop offset="100%" stopColor={mainColor()} stopOpacity={0.25} />
              </linearGradient>
            </defs>
            {agentPositions.map((cx, i) => (
              <g key={`mc${i}`}>
                <path d={`M 500,0 L 500,20 L ${cx},20 L ${cx},56`}
                  stroke="url(#grad-main-tree)" strokeWidth={1.5} fill="none" strokeDasharray="4,3" />
                {/* Animated dot (alternate to reduce clutter) */}
                {i % 2 === 0 && (
                  <circle r={3} fill={mainColor()} opacity={0.7}>
                    <animateMotion dur={`${3 + i * 0.5}s`} repeatCount="indefinite"
                      path={`M 500,0 L 500,20 L ${cx},20 L ${cx},56`} />
                  </circle>
                )}
              </g>
            ))}
          </svg>
        </div>
      )}

      {/* ── Depth 1: Specialist Agents ── */}
      {agentCount > 0 && (
        <>
          <div className="text-center mb-2">
            <span className="text-[9px] uppercase tracking-[2px] font-bold text-aegis-text-muted">Depth 1 — Specialists</span>
          </div>
          <div className="flex justify-center gap-4 flex-wrap">
            {registeredAgents.map((agent) => {
              const cfg = getTreeNodeConfig(agent.id);
              const childCount = spawnCounts[agent.id] || 0;
              const agentSessions = workers.filter(w => w.agentId === agent.id);
              const activeSessions = agentSessions.filter(s => s.running);
              const totalTok = agentSessions.reduce((s, sess) => s + sess.totalTokens, 0);
              const spawned = runningSubAgents.some(sa => sa.agentId === agent.id);
              const isRunning = activeSessions.length > 0 || spawned;

              return (
                <div key={agent.id} className="relative">
                  {/* Spawn badge */}
                  {childCount > 0 && (
                    <div className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold border-2 border-[var(--aegis-bg-solid)] z-10"
                      style={{ background: cfg.color, color: 'var(--aegis-bg-solid)' }}>
                      {childCount}
                    </div>
                  )}
                  <div className={clsx(
                    "relative rounded-2xl border px-5 py-3.5 min-w-[200px] max-w-[240px] overflow-hidden transition-all hover:-translate-y-0.5 cursor-pointer",
                    isRunning && "ring-1 ring-aegis-primary/30"
                  )}
                    onClick={() => onAgentClick?.(agent)}
                    style={{ background: `linear-gradient(135deg, ${cfg.color}10, ${cfg.color}04)`, borderColor: isRunning ? `${cfg.color}50` : `${cfg.color}30` }}>
                    <div className="absolute top-0 inset-x-0 h-[2px] opacity-40"
                      style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)` }} />
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[18px] border relative"
                        style={{ background: `linear-gradient(135deg, ${cfg.color}15, ${cfg.color}03)`, borderColor: `${cfg.color}20` }}>
                        {cfg.icon}
                        {isRunning && <div className="absolute -bottom-[2px] -end-[2px]"><StatusDot status="active" size={8} glow beacon /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold" style={{ color: cfg.color }}>{agent.name || agent.id}</div>
                        <div className="text-[9px] text-aegis-text-dim font-mono">
                          {(agent.model || agentSessions[0]?.model || '—').toString().split('/').pop()}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {isRunning ? (
                            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-bold"
                              style={{ background: `${cfg.color}12`, color: cfg.color }}>
                              <Loader2 size={9} className="animate-spin" /> Running
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgb(var(--aegis-overlay)/0.04)] text-aegis-text-dim font-bold">Idle</span>
                          )}
                          {totalTok > 0 && <span className="text-[9px] text-aegis-text-dim font-mono">{formatTokens(totalTok)}</span>}
                        </div>
                        {/* Token bar */}
                        <div className="w-full h-[3px] rounded-full bg-[rgb(var(--aegis-overlay)/0.06)] mt-2 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(100, agentSessions.length > 0 ? Math.round((agentSessions[0].totalTokens / agentSessions[0].contextTokens) * 100) : 0)}%`, background: cfg.color }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── SVG Connectors: Agents → Workers ── */}
      {depth2Layout.length > 0 && (
        <div className="relative h-12 mt-1">
          <svg viewBox="0 0 1000 48" preserveAspectRatio="none" className="w-full h-full">
            {depth2Layout.map((item, i) => {
              const childX = depth2Positions[i];
              const meta = getWorkerMeta(item.worker.label, item.worker.type);
              return (
                <g key={`wc${i}`}>
                  <path d={`M ${item.parentX},0 L ${item.parentX},18 L ${childX},18 L ${childX},48`}
                    stroke={meta.color} strokeOpacity={0.5} strokeWidth={1.2} fill="none" strokeDasharray="3,3" />
                  {i < 6 && (
                    <circle r={2.5} fill={meta.color} opacity={0.6}>
                      <animateMotion dur={`${2 + i * 0.6}s`} repeatCount="indefinite"
                        path={`M ${item.parentX},0 L ${item.parentX},18 L ${childX},18 L ${childX},48`} />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* ── Depth 2: Workers ── */}
      {depth2Layout.length > 0 && (
        <>
          <div className="text-center mb-2">
            <span className="text-[9px] uppercase tracking-[2px] font-bold text-aegis-text-muted">Depth 2 — Workers</span>
          </div>
          <div className="flex justify-center gap-3 flex-wrap">
            {depth2Layout.map(({ worker }) => {
              const meta = getWorkerMeta(worker.label, worker.type);
              return (
                <div key={worker.key}
                  className="relative rounded-xl border px-4 py-2.5 min-w-[170px] max-w-[200px] overflow-hidden transition-all hover:-translate-y-0.5"
                  style={{ background: `linear-gradient(135deg, ${meta.color}10, ${meta.color}04)`, borderColor: `${meta.color}30` }}>
                  <div className="absolute top-0 inset-x-0 h-[2px] opacity-30"
                    style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[14px] border"
                      style={{ background: `linear-gradient(135deg, ${meta.color}20, ${meta.color}08)`, borderColor: `${meta.color}30` }}>
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold truncate" style={{ color: meta.color }}>{worker.label}</div>
                      <div className="text-[9px] text-aegis-text-dim font-mono">{worker.model.split('/').pop() || '—'}</div>
                      <span className="flex items-center gap-1 text-[8px] mt-0.5 font-bold"
                        style={{ color: worker.running ? meta.color : 'rgb(var(--aegis-overlay) / 0.2)' }}>
                        <StatusDot status={worker.running ? 'active' : 'idle'} size={5} glow={worker.running} />
                        {worker.running ? 'Running' : 'Done'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Legend ── */}
      <div className="mt-8 flex items-center justify-center gap-5 flex-wrap px-4 py-3 rounded-xl bg-[rgb(var(--aegis-overlay)/0.02)] border border-[rgb(var(--aegis-overlay)/0.04)]">
        <div className="flex items-center gap-1.5 text-[10px] text-aegis-text-muted"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: mainColor() }} /> Main</div>
        {registeredAgents.slice(0, 5).map(a => {
          const cfg = getTreeNodeConfig(a.id);
          return <div key={a.id} className="flex items-center gap-1.5 text-[10px] text-aegis-text-muted"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: cfg.color }} /> {a.name || a.id}</div>;
        })}
        <div className="flex items-center gap-1.5 text-[10px] text-aegis-text-muted"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: dataColor(2) }} /> Sub-agent</div>
        <div className="flex items-center gap-1.5 text-[10px] text-aegis-text-muted"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: dataColor(7) }} /> Cron</div>
        <div className="flex items-center gap-1.5 text-[10px] text-aegis-text-dim ms-auto">
          <svg width={20} height={8}><line x1={0} y1={4} x2={20} y2={4} stroke="rgb(var(--aegis-overlay) / 0.2)" strokeWidth={1} strokeDasharray="3,2" /></svg>
          spawn
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-aegis-text-dim">
          <svg width={12} height={12}><circle cx={6} cy={6} r={4} fill={mainColor()} opacity={0.5} /></svg>
          data flow
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Activity Feed — Live event log built from sessions
// ═══════════════════════════════════════════════════════════

function ActivityFeed({ sessions, agents }: { sessions: SessionInfo[]; agents: AgentInfo[] }) {
  const { t } = useTranslation();

  // Build activity entries from session data
  const activities = useMemo(() => {
    return sessions
      .filter(s => s.totalTokens > 0 || s.running)
      .slice(0, 20)
      .map(s => {
        const agentName = agents.find(a => a.id === s.agentId)?.name || s.agentId;
        const cfg = s.agentId === 'main' ? { icon: 'Æ', color: mainColor() } : getTreeNodeConfig(s.agentId);
        const workerMeta = getWorkerMeta(s.label, s.type);

        let text = '';
        if (s.running && s.type === 'subagent') text = `spawned ${s.label}`;
        else if (s.running && s.type === 'cron') text = `cron running: ${s.label}`;
        else if (s.running && s.type === 'main') text = 'active session';
        else if (s.type === 'subagent') text = `completed ${s.label} (${formatTokens(s.totalTokens)} tokens)`;
        else if (s.type === 'cron') text = `cron finished: ${s.label}`;
        else text = `session active (${formatTokens(s.totalTokens)} tokens)`;

        return {
          key: s.key,
          agentName,
          agentColor: s.type === 'main' ? mainColor() : cfg.color,
          workerColor: workerMeta.color,
          text,
          time: timeAgo(s.updatedAt),
          running: s.running,
        };
      });
  }, [sessions, agents]);

  if (activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-aegis-text-dim text-[13px]">
        ⚡ No activity yet
      </div>
    );
  }

  return (
    <div className="px-6 py-4 overflow-y-auto max-h-[600px]">
      <div className="space-y-1">
        {activities.map((act, i) => (
          <motion.div key={act.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-[rgb(var(--aegis-overlay)/0.03)] transition-colors"
          >
            <span className="text-[9px] text-aegis-text-dim font-mono w-[55px] shrink-0 mt-0.5 text-end">{act.time}</span>
            <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: act.agentColor }} />
            <div className="text-[11px] text-aegis-text-muted leading-relaxed">
              <span className="font-bold" style={{ color: act.agentColor }}>{act.agentName}</span>
              {' → '}
              <span>{act.text}</span>
              {act.running && <span className="ms-1.5 text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: themeAlpha('warning', 0.1), color: themeHex('warning') }}>LIVE</span>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

export function AgentHubPage() {
  const { t } = useTranslation();
  const { connected } = useChatStore();
  const rawSessions = useGatewayDataStore((s) => s.sessions);
  const agents = useGatewayDataStore((s) => s.agents) as AgentInfo[];
  const runningSubAgents = useGatewayDataStore((s) => s.runningSubAgents);
  const loading = useGatewayDataStore((s) => s.loading.sessions || s.loading.agents);

  const sessions = useMemo(() => parseSessions(rawSessions as any[]), [rawSessions]);

  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);
  const [workerLogs, setWorkerLogs] = useState<Record<string, any[]>>({});
  const [loadingLog, setLoadingLog] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [newAgent, setNewAgent] = useState({ id: '', name: '', model: '', workspace: '' });
  const [settingsAgent, setSettingsAgent] = useState<AgentInfo | null>(null);

  // ── Stable model map from config.get (agents.list never returns models) ──
  // Stored in local state so polling refreshes of agents.list can't overwrite it.
  const [agentModels, setAgentModels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!connected) return;
    gateway.call('config.get', {}).then((snap: any) => {
      const cfgList: any[] = snap?.config?.agents?.list ?? [];
      const models: Record<string, string> = {};
      for (const cfg of cfgList) {
        if (!cfg?.id) continue;
        const raw = cfg.model;
        const m = typeof raw === 'string'
          ? raw
          : (raw && typeof raw === 'object' && 'primary' in raw)
            ? String(raw.primary ?? '')
            : '';
        if (m) models[cfg.id] = m;
      }
      setAgentModels(models);
    }).catch(() => { /* silent — cards just show '—' */ });
  }, [connected]);

  // Enrich agents with model data from config (merge at render time, not in store)
  const enrichedAgents = useMemo(() =>
    agents.map(a => agentModels[a.id] ? { ...a, model: agentModels[a.id] } : a),
    [agents, agentModels]
  );

  const handleCreateAgent = async () => {
    if (!newAgent.id.trim()) return;
    try {
      await gateway.createAgent(newAgent);
      setShowAddForm(false); setNewAgent({ id: '', name: '', model: '', workspace: '' });
      await refreshGroup('agents');
    } catch (err: any) { alert(`Failed: ${err?.message || err}`); }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (deletingAgentId === agentId) {
      try { await gateway.deleteAgent(agentId); setDeletingAgentId(null);
        await refreshGroup('agents');
      } catch (err: any) { alert(`Failed: ${err?.message || err}`); setDeletingAgentId(null); }
    } else {
      setDeletingAgentId(agentId);
      setTimeout(() => setDeletingAgentId(prev => prev === agentId ? null : prev), 3000);
    }
  };

  // ── Derived data ──
  const mainSession = sessions.find(s => s.agentId === 'main' && s.type === 'main');
  const workers = sessions.filter(s => s !== mainSession && (s.type === 'cron' || s.type === 'subagent'));
  const registeredAgents = enrichedAgents.filter(a => a.id !== 'main');
  const getAgentSessions = (agentId: string) => sessions.filter(s => s.agentId === agentId && s.type !== 'main');

  // Check if an agent has a running sub-agent (from real-time tool stream tracking)
  const isAgentSpawned = (agentId: string) => runningSubAgents.some(sa => sa.agentId === agentId);
  const getSpawnedLabel = (agentId: string) => runningSubAgents.find(sa => sa.agentId === agentId)?.label || '';

  // ── Expand worker → load history ──
  const handleWorkerClick = async (sessionKey: string) => {
    if (expandedWorker === sessionKey) { setExpandedWorker(null); return; }
    setExpandedWorker(sessionKey);
    if (!workerLogs[sessionKey]) {
      setLoadingLog(sessionKey);
      try {
        const result = await gateway.getHistory(sessionKey, 10);
        const msgs = (result?.messages || [])
          .filter((m: any) => m.role === 'assistant' || m.role === 'user').slice(-6)
          .map((m: any) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join(' ') : JSON.stringify(m.content) }));
        setWorkerLogs(prev => ({ ...prev, [sessionKey]: msgs }));
      } catch { /* silent */ }
      finally { setLoadingLog(null); }
    }
  };

  // ── Render worker card (Grid view) ──
  const renderWorkerCard = (w: SessionInfo, i: number) => {
    const meta = getWorkerMeta(w.label, w.type);
    const color = meta.color;
    const isExpanded = expandedWorker === w.key;
    const usagePct = Math.round((w.totalTokens / w.contextTokens) * 100);
    const logs = workerLogs[w.key] || [];
    const taskMsg = logs.find(l => l.role === 'user');
    const lastResponse = [...logs].reverse().find(l => l.role === 'assistant');

    return (
      <div key={w.key}>
        <GlassCard delay={i * 0.02} hover onClick={() => handleWorkerClick(w.key)} className="cursor-pointer">
          <div className="flex items-center gap-4">
            <StatusDot status={w.running ? 'active' : w.totalTokens > 0 ? 'idle' : 'sleeping'} size={10} glow={w.running} beacon={w.running} />
            <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0 border text-[16px]"
              style={{ background: `linear-gradient(135deg, ${color}15, ${color}05)`, borderColor: `${color}20` }}>
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-[1px] rounded text-[8px] font-bold uppercase tracking-wider border"
                  style={{ background: `${color}15`, color, borderColor: `${color}30` }}>{meta.tag}</span>
                <span className="text-[12px] font-semibold text-aegis-text truncate">{w.label}</span>
              </div>
              <div className="text-[10px] text-aegis-text-dim mt-0.5 font-mono truncate">{w.model.split('/').pop() || '—'}</div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <ProgressRing percentage={usagePct} size={28} strokeWidth={2} color={color} />
              <div className="text-end">
                <div className="text-[12px] font-semibold text-aegis-text">{formatTokens(w.totalTokens)}</div>
                <div className="text-[9px] text-aegis-text-dim">/ {formatTokens(w.contextTokens)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-aegis-text-dim w-[55px] text-end">{timeAgo(w.updatedAt)}</span>
              <ChevronDown size={14} className={clsx('text-aegis-text-dim transition-transform duration-300', isExpanded && 'rotate-180')} />
            </div>
          </div>
        </GlassCard>
        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
              <div className="mx-2 mt-1 mb-2 rounded-xl border p-4 bg-[rgb(var(--aegis-overlay)/0.02)] border-[rgb(var(--aegis-overlay)/0.06)]">
                {loadingLog === w.key ? (
                  <div className="flex items-center gap-2 py-3 text-[11px] text-aegis-text-muted"><Loader2 size={12} className="animate-spin" /> Loading...</div>
                ) : logs.length === 0 ? (
                  <div className="text-[11px] text-aegis-text-dim py-2">{t('agents.noActivity', 'No activity recorded yet')}</div>
                ) : (
                  <div className="space-y-3">
                    {taskMsg && (
                      <div>
                        <div className="text-[9px] text-aegis-text-muted uppercase tracking-wider font-semibold mb-1">{t('agents.task', 'Task')}</div>
                        <div className="text-[11px] text-aegis-text/70 leading-relaxed bg-[rgb(var(--aegis-overlay)/0.03)] rounded-lg p-2.5 border border-[rgb(var(--aegis-overlay)/0.05)]">
                          {taskMsg.content.length > 500 ? taskMsg.content.substring(0, 500) + '…' : taskMsg.content}
                        </div>
                      </div>
                    )}
                    {lastResponse && (
                      <div>
                        <div className="text-[9px] text-aegis-text-muted uppercase tracking-wider font-semibold mb-1">{w.running ? t('agents.doing', 'Currently doing') : t('agents.result', 'Result')}</div>
                        <div className="text-[11px] text-aegis-text/60 leading-relaxed bg-[rgb(var(--aegis-overlay)/0.03)] rounded-lg p-2.5 border border-[rgb(var(--aegis-overlay)/0.05)]">
                          {lastResponse.content.length > 600 ? lastResponse.content.substring(0, 600) + '…' : lastResponse.content}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-aegis-text-muted pt-1 border-t border-[rgb(var(--aegis-overlay)/0.05)]">
                      <span className={clsx('flex items-center gap-1', w.running ? 'text-aegis-primary' : 'text-aegis-text-muted')}>
                        {w.running ? <><Loader2 size={10} className="animate-spin" /> Running</> : <><AlertCircle size={10} /> Completed</>}
                      </span>
                      <span>·</span><span>{formatTokens(w.totalTokens)} tokens</span><span>·</span><span>{w.model.split('/').pop()}</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <PageTransition className="p-6 space-y-6 mx-auto">

      {/* ══ Header ══ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold text-aegis-text tracking-tight">{t('agents.title', 'Agent Hub')}</h1>
          <p className="text-[13px] text-aegis-text-dim mt-1">
            {t('agents.subtitle', 'Agents and active workers')}
            <span className="text-aegis-text-dim ms-2">— {registeredAgents.length} {t('agentHubExtra.agentsCount')} · {workers.length} {t('agentHubExtra.workersCount')}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Switcher */}
          <div className="flex gap-0.5 bg-[rgb(var(--aegis-overlay)/0.02)] border border-[rgb(var(--aegis-overlay)/0.06)] rounded-xl p-1">
            {([
              { key: 'tree' as const, label: t('agentHubExtra.treeView') },
              { key: 'grid' as const, label: t('agentHubExtra.gridView') },
              { key: 'activity' as const, label: '⚡ Activity' },
            ]).map(v => (
              <button key={v.key} onClick={() => setViewMode(v.key)}
                className={clsx(
                  'px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
                  viewMode === v.key ? 'bg-aegis-accent/15 text-aegis-accent' : 'text-aegis-text-muted hover:text-aegis-text-muted'
                )}>
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={() => refreshAll()} className="p-2 rounded-xl hover:bg-[rgb(var(--aegis-overlay)/0.05)] text-aegis-text-dim transition-colors">
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-aegis-primary" /></div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════ */}
          {/* TREE VIEW                                     */}
          {/* ══════════════════════════════════════════════ */}
          {viewMode === 'tree' && (
            <TreeView mainSession={mainSession} registeredAgents={registeredAgents} workers={workers} agents={enrichedAgents} onAgentClick={(a) => setSettingsAgent(a)} />
          )}

          {/* ══════════════════════════════════════════════ */}
          {/* ACTIVITY VIEW                                 */}
          {/* ══════════════════════════════════════════════ */}
          {viewMode === 'activity' && (
            <GlassCard delay={0}>
              <div className="text-[10px] text-aegis-text-dim uppercase tracking-widest font-bold mb-2 px-3 pt-2">Live Activity Feed</div>
              <ActivityFeed sessions={sessions} agents={enrichedAgents} />
            </GlassCard>
          )}

          {/* ══════════════════════════════════════════════ */}
          {/* GRID VIEW (original layout)                   */}
          {/* ══════════════════════════════════════════════ */}
          {viewMode === 'grid' && (
            <div className="space-y-8">
              {/* Section 1: Main Agent Hero */}
              <div>
                <div className="text-[11px] text-aegis-text-muted uppercase tracking-wider font-semibold mb-3">{t('agents.mainAgent', 'Main Agent')}</div>
                {mainSession ? (
                  <GlassCard delay={0} hover shimmer={mainSession.running}>
                    <div className="flex items-center gap-5">
                      <div className="w-[64px] h-[64px] rounded-2xl flex items-center justify-center shrink-0 text-[26px] font-extrabold border-2 relative"
                        style={{ background: `linear-gradient(135deg, ${mainColor()}25, ${mainColor()}08)`, borderColor: `${mainColor()}35`, color: mainColor() }}>
                        Æ
                        <div className="absolute -bottom-[3px] -right-[3px]"><StatusDot status="active" size={14} glow beacon={mainSession.running} /></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[18px] font-extrabold text-aegis-text">{enrichedAgents.find(a => a.id === 'main')?.name || 'Main Agent'}</div>
                        <div className="text-[11px] text-aegis-text-muted font-mono mt-0.5">{mainSession.model.split('/').pop() || '—'}</div>
                        <div className="text-[10px] text-aegis-text-dim mt-1">{t('agents.lastActive', 'Last active')}: {timeAgo(mainSession.updatedAt)}</div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <ProgressRing percentage={Math.round((mainSession.totalTokens / mainSession.contextTokens) * 100)} size={48} strokeWidth={3} color={mainColor()} />
                        <div className="text-end">
                          <div className="text-[18px] font-bold text-aegis-text">{formatTokens(mainSession.totalTokens)}</div>
                          <div className="text-[10px] text-aegis-text-dim">/ {formatTokens(mainSession.contextTokens)} tokens</div>
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shrink-0 bg-aegis-primary/10 text-aegis-primary border-aegis-primary/25">
                        {mainSession.running ? 'ACTIVE' : 'ONLINE'}
                      </div>
                    </div>
                  </GlassCard>
                ) : (
                  <GlassCard delay={0}>
                    <div className="flex items-center gap-5">
                      <div className="w-[64px] h-[64px] rounded-2xl flex items-center justify-center shrink-0 text-[26px] font-extrabold border-2 relative"
                        style={{ background: `linear-gradient(135deg, ${mainColor()}10, ${mainColor()}04)`, borderColor: `${mainColor()}15`, color: `${mainColor()}50` }}>
                        Æ<div className="absolute -bottom-[3px] -right-[3px]"><StatusDot status="sleeping" size={14} /></div>
                      </div>
                      <div className="flex-1"><div className="text-[18px] font-extrabold text-aegis-text-muted">{enrichedAgents.find(a => a.id === 'main')?.name || 'Main Agent'}</div><div className="text-[11px] text-aegis-text-dim mt-0.5">{t('agents.notConnected', 'Not connected')}</div></div>
                      <div className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-[rgb(var(--aegis-overlay)/0.04)] text-aegis-text-muted border-[rgb(var(--aegis-overlay)/0.08)]">OFFLINE</div>
                    </div>
                  </GlassCard>
                )}
              </div>

              {/* Section 2: Registered Agents */}
              {registeredAgents.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] text-aegis-text-muted uppercase tracking-wider font-semibold">
                      {t('agents.registeredAgents', 'Registered Agents')}<span className="text-aegis-text-dim ms-2">— {registeredAgents.length}</span>
                    </div>
                    <button onClick={() => setShowAddForm(!showAddForm)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-aegis-primary/10 border border-aegis-primary/25 text-aegis-primary text-[10px] font-semibold hover:bg-aegis-primary/20 transition-colors">
                      <Plus size={12} /> Add
                    </button>
                  </div>

                  {/* Add form */}
                  <AnimatePresence>
                    {showAddForm && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-3">
                        <GlassCard>
                          <div className="space-y-3">
                            <div className="text-[12px] font-semibold text-aegis-text">Add New Agent</div>
                            <div className="grid grid-cols-2 gap-3">
                              <input placeholder="Agent ID *" value={newAgent.id} onChange={e => setNewAgent(p => ({ ...p, id: e.target.value }))} className="w-full bg-[rgb(var(--aegis-overlay)/0.05)] border border-[rgb(var(--aegis-overlay)/0.1)] rounded-lg px-3 py-2 text-sm text-aegis-text placeholder:text-aegis-text-dim focus:border-aegis-primary/50 focus:outline-none" />
                              <input placeholder="Name" value={newAgent.name} onChange={e => setNewAgent(p => ({ ...p, name: e.target.value }))} className="w-full bg-[rgb(var(--aegis-overlay)/0.05)] border border-[rgb(var(--aegis-overlay)/0.1)] rounded-lg px-3 py-2 text-sm text-aegis-text placeholder:text-aegis-text-dim focus:border-aegis-primary/50 focus:outline-none" />
                              <input placeholder="Model" value={newAgent.model} onChange={e => setNewAgent(p => ({ ...p, model: e.target.value }))} className="w-full bg-[rgb(var(--aegis-overlay)/0.05)] border border-[rgb(var(--aegis-overlay)/0.1)] rounded-lg px-3 py-2 text-sm text-aegis-text placeholder:text-aegis-text-dim focus:border-aegis-primary/50 focus:outline-none" />
                              <input placeholder="Workspace" value={newAgent.workspace} onChange={e => setNewAgent(p => ({ ...p, workspace: e.target.value }))} className="w-full bg-[rgb(var(--aegis-overlay)/0.05)] border border-[rgb(var(--aegis-overlay)/0.1)] rounded-lg px-3 py-2 text-sm text-aegis-text placeholder:text-aegis-text-dim focus:border-aegis-primary/50 focus:outline-none" />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => { setShowAddForm(false); setNewAgent({ id: '', name: '', model: '', workspace: '' }); }} className="px-4 py-2 rounded-lg bg-[rgb(var(--aegis-overlay)/0.05)] border border-[rgb(var(--aegis-overlay)/0.1)] text-aegis-text-muted text-sm">Cancel</button>
                              <button onClick={handleCreateAgent} disabled={!newAgent.id.trim()} className="px-4 py-2 rounded-lg bg-aegis-primary/20 border border-aegis-primary/30 text-aegis-primary text-sm font-semibold disabled:opacity-30">Create</button>
                            </div>
                          </div>
                        </GlassCard>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {registeredAgents.map((agent, i) => {
                      const display = getAgentDisplay(agent);
                      const agentSessions = getAgentSessions(agent.id);
                      const activeSessions = agentSessions.filter(s => s.running);
                      const totalTokens = agentSessions.reduce((sum, s) => sum + s.totalTokens, 0);
                      const lastActive = agentSessions.length > 0 ? Math.max(...agentSessions.map(s => s.updatedAt)) : 0;
                      const spawned = isAgentSpawned(agent.id);
                      const spawnedLabel = getSpawnedLabel(agent.id);
                      const isRunning = activeSessions.length > 0 || spawned;

                      return (
                        <div key={agent.id}>
                          <GlassCard delay={i * 0.05} hover shimmer={isRunning}>
                            <div className="flex items-start gap-4">
                              <div className="w-[48px] h-[48px] rounded-xl flex items-center justify-center shrink-0 border relative"
                                style={{ background: `linear-gradient(135deg, ${display.color}20, ${display.color}05)`, borderColor: isRunning ? `${display.color}40` : `${display.color}25`, color: display.color }}>
                                {display.icon}
                                {isRunning && <div className="absolute -bottom-[2px] -right-[2px]"><StatusDot status="active" size={10} glow beacon /></div>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[14px] font-bold text-aegis-text">{agent.name || agent.id}</div>
                                <div className="text-[10px] text-aegis-text-dim font-mono mt-0.5">
                                  {(agent.model || '').toString().split('/').pop() || display.description}
                                </div>
                                <div className="flex items-center gap-3 mt-2 text-[10px] text-aegis-text-muted">
                                  {isRunning ? (
                                    <span className="flex items-center gap-1 text-aegis-primary">
                                      <Loader2 size={9} className="animate-spin" />
                                      {activeSessions.length > 0 ? `${activeSessions.length} running` : 'Working…'}
                                    </span>
                                  ) : <span className="text-aegis-text-dim">Idle</span>}
                                  {totalTokens > 0 && <><span className="text-aegis-text-dim">·</span><span>{formatTokens(totalTokens)} tokens</span></>}
                                  {lastActive > 0 && <><span className="text-aegis-text-dim">·</span><span>{timeAgo(lastActive)}</span></>}
                                </div>
                                {/* Task label when spawned */}
                                {spawned && spawnedLabel && (
                                  <div className="mt-1.5 text-[9px] text-aegis-primary/70 truncate max-w-[200px]" title={spawnedLabel}>
                                    📋 {spawnedLabel}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border"
                                  style={{
                                    background: isRunning ? themeAlpha('primary', 0.12) : agent.configured ? `${display.color}10` : 'rgb(var(--aegis-overlay) / 0.03)',
                                    color: isRunning ? themeHex('primary') : agent.configured ? display.color : 'rgb(var(--aegis-overlay) / 0.2)',
                                    borderColor: isRunning ? themeAlpha('primary', 0.25) : agent.configured ? `${display.color}20` : 'rgb(var(--aegis-overlay) / 0.06)',
                                  }}>
                                  {isRunning ? 'ACTIVE' : agent.configured ? 'READY' : 'SETUP'}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); setSettingsAgent(agent); }}
                                  className="p-1.5 rounded-lg bg-[rgb(var(--aegis-overlay)/0.04)] border border-[rgb(var(--aegis-overlay)/0.08)] text-aegis-text-muted hover:text-aegis-primary hover:border-aegis-primary/30 transition-colors"><Settings2 size={13} /></button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteAgent(agent.id); }}
                                  className={clsx('p-1.5 rounded-lg transition-colors', deletingAgentId === agent.id ? 'text-red-400 bg-red-500/10 border border-red-400/30' : 'text-aegis-text-muted hover:text-red-400 bg-[rgb(var(--aegis-overlay)/0.04)] border border-[rgb(var(--aegis-overlay)/0.08)]')}>
                                  {deletingAgentId === agent.id ? <span className="text-[10px] font-bold">Confirm?</span> : <Trash2 size={13} />}
                                </button>
                              </div>
                            </div>
                          </GlassCard>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 3: Workers */}
              <div>
                <div className="text-[11px] text-aegis-text-muted uppercase tracking-wider font-semibold mb-3">
                  {t('agents.workers', 'Active Workers')}
                  <span className="text-aegis-text-dim ms-2">— {workers.filter(w => w.running).length} {t('agentHubExtra.runningCount')} · {workers.length} {t('agentHubExtra.totalCount')}</span>
                </div>
                {workers.length === 0 ? (
                  <GlassCard>
                    <div className="text-center py-8 text-aegis-text-muted">
                      <Zap size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-[13px] font-semibold text-aegis-text/40">{t('agents.noWorkers', 'No active workers')}</p>
                      <p className="text-[11px] text-aegis-text-dim mt-1">{t('agents.noWorkersHint', 'Cron jobs and sub-agents will appear here when running')}</p>
                    </div>
                  </GlassCard>
                ) : (
                  <div className="space-y-2">{workers.map((w, i) => renderWorkerCard(w, i))}</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ Agent Settings Panel ══ */}
      <AgentSettingsPanel
        agent={settingsAgent}
        agentSessions={
          settingsAgent
            ? sessions.filter(s => s.agentId === settingsAgent.id && s.type !== 'main')
            : []
        }
        onClose={() => setSettingsAgent(null)}
        onSaved={() => refreshGroup('agents')}
      />
    </PageTransition>
  );
}
