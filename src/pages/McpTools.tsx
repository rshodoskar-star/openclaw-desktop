// ═══════════════════════════════════════════════════════════
// McpTools — Tools & Integrations Page
// Shows active tools (from current session) + known catalog.
// MCP integration placeholder for future external tools.
// ═══════════════════════════════════════════════════════════

import { useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Wrench, Plug, Clock, CheckCircle, XCircle, Zap } from 'lucide-react';
import { PageTransition } from '@/components/shared/PageTransition';
import { useChatStore } from '@/stores/chatStore';
import type { ToolBlock } from '@/types/RenderBlock';
import clsx from 'clsx';

// ─── Known Tools Catalog ────────────────────────────────────

const KNOWN_TOOLS = [
  { name: 'exec',           icon: '⚡',  desc: 'Execute shell commands',           category: 'System'        },
  { name: 'process',        icon: '⚙️',  desc: 'Manage background processes',       category: 'System'        },
  { name: 'Read',           icon: '📄',  desc: 'Read file contents',               category: 'Files'         },
  { name: 'Write',          icon: '✍️',  desc: 'Write to files',                   category: 'Files'         },
  { name: 'Edit',           icon: '✏️',  desc: 'Edit files with precise replacements', category: 'Files'     },
  { name: 'web_search',     icon: '🔍',  desc: 'Search the web',                   category: 'Web'           },
  { name: 'web_fetch',      icon: '🌐',  desc: 'Fetch URL content',                category: 'Web'           },
  { name: 'browser',        icon: '🖥️',  desc: 'Browser automation',               category: 'Web'           },
  { name: 'memory_search',  icon: '🧠',  desc: 'Search agent memory',              category: 'Memory'        },
  { name: 'memory_get',     icon: '🧠',  desc: 'Get memory snippets',              category: 'Memory'        },
  { name: 'sessions_spawn', icon: '🤖',  desc: 'Spawn sub-agents',                 category: 'Agents'        },
  { name: 'sessions_send',  icon: '📨',  desc: 'Send to sessions',                 category: 'Agents'        },
  { name: 'session_status', icon: '📊',  desc: 'Session status',                   category: 'Agents'        },
  { name: 'image',          icon: '🖼️',  desc: 'Analyze images',                   category: 'Media'         },
  { name: 'tts',            icon: '🔊',  desc: 'Text to speech',                   category: 'Media'         },
  { name: 'message',        icon: '💬',  desc: 'Send messages',                    category: 'Communication' },
  { name: 'nodes',          icon: '📱',  desc: 'Control paired devices',           category: 'Devices'       },
  { name: 'canvas',         icon: '🎨',  desc: 'Canvas control',                   category: 'UI'            },
];

// ─── Category badge color map ───────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  System:        'bg-orange-500/10 text-orange-400',
  Files:         'bg-blue-500/10 text-blue-400',
  Web:           'bg-cyan-500/10 text-cyan-400',
  Memory:        'bg-purple-500/10 text-purple-400',
  Agents:        'bg-green-500/10 text-green-400',
  Media:         'bg-pink-500/10 text-pink-400',
  Communication: 'bg-yellow-500/10 text-yellow-400',
  Devices:       'bg-teal-500/10 text-teal-400',
  UI:            'bg-rose-500/10 text-rose-400',
  Other:         'bg-slate-500/10 text-slate-400',
};

// ─── ToolCard ───────────────────────────────────────────────

interface ToolCardProps {
  name: string;
  icon: string;
  desc: string;
  category: string;
  count?: number;
  errors?: number;
  totalMs?: number;
  dimmed?: boolean;
}

function ToolCard({ name, icon, desc, category, count, errors, totalMs, dimmed }: ToolCardProps) {
  const successRate = count && count > 0
    ? Math.round(((count - (errors ?? 0)) / count) * 100)
    : null;

  const avgMs = count && count > 0 && totalMs
    ? Math.round(totalMs / count)
    : null;

  const catColor = CATEGORY_COLORS[category] ?? 'bg-aegis-border/20 text-aegis-text-muted';

  return (
    <div
      className={clsx(
        'rounded-xl border border-aegis-border p-4 flex flex-col gap-3 transition-opacity',
        'bg-[rgb(var(--aegis-overlay)/0.04)] hover:bg-[rgb(var(--aegis-overlay)/0.07)]',
        dimmed && 'opacity-40 hover:opacity-70',
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl leading-none flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-aegis-text-primary truncate">{name}</p>
            <p className="text-[11px] text-aegis-text-dim truncate">{desc}</p>
          </div>
        </div>
        <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0', catColor)}>
          {category}
        </span>
      </div>

      {/* Stats row — only shown for active tools */}
      {count != null && (
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-aegis-border/40">
          {/* Usage count */}
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1 text-aegis-text-muted">
              <Zap size={11} />
              <span className="text-[10px]">Calls</span>
            </div>
            <span className="text-[13px] font-bold text-aegis-text-primary">{count}</span>
          </div>

          {/* Success rate */}
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1 text-aegis-text-muted">
              {(errors ?? 0) > 0
                ? <XCircle size={11} className="text-aegis-danger" />
                : <CheckCircle size={11} className="text-aegis-success" />}
              <span className="text-[10px]">Success</span>
            </div>
            <span className={clsx(
              'text-[13px] font-bold',
              successRate === 100 ? 'text-aegis-success' :
              (successRate ?? 100) >= 80 ? 'text-aegis-warning' : 'text-aegis-danger',
            )}>
              {successRate ?? 100}%
            </span>
          </div>

          {/* Avg duration */}
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1 text-aegis-text-muted">
              <Clock size={11} />
              <span className="text-[10px]">Avg</span>
            </div>
            <span className="text-[13px] font-bold text-aegis-text-primary">
              {avgMs != null ? (avgMs >= 1000 ? `${(avgMs / 1000).toFixed(1)}s` : `${avgMs}ms`) : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section header ─────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h2 className="text-[13px] font-semibold text-aegis-text-secondary uppercase tracking-widest">
        {title}
      </h2>
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-aegis-border/30 text-aegis-text-muted">
        {count}
      </span>
      <div className="flex-1 h-px bg-aegis-border/30" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// McpToolsPage
// ═══════════════════════════════════════════════════════════

export function McpToolsPage() {
  const { t } = useTranslation();

  // Ensure history is loaded (may not have visited Chat page first)
  const messages = useChatStore((s) => s.messages);
  const connected = useChatStore((s) => s.connected);
  const loadSessionHistory = useChatStore((s) => s.loadSessionHistory);
  useEffect(() => {
    if (connected && messages.length === 0) {
      loadSessionHistory();
    }
  }, [connected, messages.length, loadSessionHistory]);

  // Get tool blocks with toolIntent forced on (always shows tools here)
  const getToolBlocks = useChatStore((s) => s.getToolBlocks);
  const toolBlocks = useMemo(() => getToolBlocks(), [messages, getToolBlocks]);

  // ── Aggregate per-tool stats ────────────────────────────
  const toolStats = useMemo(() => {
    const stats: Record<string, { count: number; errors: number; totalMs: number }> = {};
    for (const t of toolBlocks) {
      if (!stats[t.toolName]) stats[t.toolName] = { count: 0, errors: 0, totalMs: 0 };
      stats[t.toolName].count++;
      if (t.status === 'error') stats[t.toolName].errors++;
      if (t.durationMs) stats[t.toolName].totalMs += t.durationMs;
    }
    return stats;
  }, [toolBlocks]);

  // ── Known tool names for quick lookup ────────────────────
  const knownNames = useMemo(() => new Set(KNOWN_TOOLS.map((t) => t.name)), []);

  // ── Active known tools (appeared in session + in catalog) ──
  const activeTools = useMemo(() => {
    const activeNames = new Set(Object.keys(toolStats));
    return KNOWN_TOOLS.filter((tool) => activeNames.has(tool.name));
  }, [toolStats]);

  // ── Unknown active tools (appeared in session but NOT in catalog) ──
  const unknownActiveTools = useMemo(() => {
    return Object.keys(toolStats)
      .filter((name) => !knownNames.has(name))
      .map((name) => ({
        name,
        icon: '🔧',
        desc: 'Discovered tool (not in catalog)',
        category: 'Other',
      }));
  }, [toolStats, knownNames]);

  // ── Available tools (in catalog, never used in this session) ──
  const availableTools = useMemo(() => {
    const activeNames = new Set(Object.keys(toolStats));
    return KNOWN_TOOLS.filter((tool) => !activeNames.has(tool.name));
  }, [toolStats]);

  const totalToolCount = KNOWN_TOOLS.length + unknownActiveTools.length;

  return (
    <PageTransition className="h-full overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto">

        {/* ── Page Header ─────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-aegis-accent/10 text-aegis-accent">
            <Wrench size={20} />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-aegis-text-primary">
              {t('mcpTools.title', 'Tools & Integrations')}
            </h1>
            <p className="text-[12px] text-aegis-text-muted mt-0.5">
              {t('mcpTools.subtitle', '{{count}} tools available · {{active}} active this session', {
                count: totalToolCount,
                active: activeTools.length,
              })}
            </p>
          </div>
        </div>

        {/* ── Active Tools ────────────────────────────────── */}
        {activeTools.length > 0 && (
          <section className="mb-8">
            <SectionHeader title={t('mcpTools.activeTools', 'Active Tools')} count={activeTools.length} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeTools.map((tool) => {
                const s = toolStats[tool.name];
                return (
                  <ToolCard
                    key={tool.name}
                    {...tool}
                    count={s?.count}
                    errors={s?.errors}
                    totalMs={s?.totalMs}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* ── Unknown Active Tools (not in catalog) ────────── */}
        {unknownActiveTools.length > 0 && (
          <section className="mb-8">
            <SectionHeader
              title={t('mcpTools.otherActiveTools', 'Other Active Tools')}
              count={unknownActiveTools.length}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {unknownActiveTools.map((tool) => {
                const s = toolStats[tool.name];
                return (
                  <ToolCard
                    key={tool.name}
                    {...tool}
                    count={s?.count}
                    errors={s?.errors}
                    totalMs={s?.totalMs}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* ── Empty state when no tools used yet ─────────── */}
        {activeTools.length === 0 && unknownActiveTools.length === 0 && (
          <div className="mb-8 p-6 rounded-xl border border-dashed border-aegis-border text-center">
            <Zap size={28} className="mx-auto mb-2 text-aegis-text-dim opacity-50" />
            <p className="text-[13px] text-aegis-text-muted">
              {t('mcpTools.noActive', 'No tools used in the current session yet.')}
            </p>
          </div>
        )}

        {/* ── Available Tools Catalog ──────────────────────── */}
        <section className="mb-6">
          <SectionHeader
            title={t('mcpTools.availableTools', 'Available Tools')}
            count={availableTools.length}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableTools.map((tool) => (
              <ToolCard key={tool.name} {...tool} dimmed />
            ))}
          </div>
        </section>

        {/* ── MCP Coming Soon ──────────────────────────────── */}
        <div className="mt-6 p-4 rounded-xl border border-dashed border-aegis-border bg-[rgb(var(--aegis-overlay)/0.02)]">
          <div className="flex items-center gap-2 text-aegis-text-muted">
            <Plug size={16} />
            <span className="text-[13px] font-semibold">MCP Integration — Coming Soon</span>
          </div>
          <p className="text-[11px] text-aegis-text-dim mt-1.5">
            Connect external tools via Model Context Protocol (MCP). GitHub, Slack, Google,
            databases, and more — directly from openmcp.cn.
          </p>
        </div>

      </div>
    </PageTransition>
  );
}
