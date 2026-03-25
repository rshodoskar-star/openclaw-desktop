import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { gateway } from '@/services/gateway/index';
import { APP_VERSION } from '@/hooks/useAppVersion';
import { ChevronDown, Check, Search, Command, Zap } from 'lucide-react';
import clsx from 'clsx';

// ═══════════════════════════════════════════════════════════
// Title Bar — Glass Pills window controls + OpenClaw Station branding
// ═══════════════════════════════════════════════════════════

/** Converts full model IDs to short display names.
 *  e.g. "anthropic/claude-sonnet-4-6" → "Sonnet 4.6"
 */
function formatModelName(model: string | null): string {
  if (!model) return '—';
  const m = model.toLowerCase();
  // Anthropic
  if (m.includes('claude-opus-4-6'))    return 'Opus 4.6';
  if (m.includes('claude-opus-4-5'))    return 'Opus 4.5';
  if (m.includes('claude-sonnet-4-6'))  return 'Sonnet 4.6';
  if (m.includes('claude-sonnet-4-5'))  return 'Sonnet 4.5';
  if (m.includes('claude-haiku-3-5'))   return 'Haiku 3.5';
  if (m.includes('claude-haiku'))       return 'Haiku';
  if (m.includes('claude-3-5'))         return 'Claude 3.5';
  // Google
  if (m.includes('gemini-2.5-pro'))     return 'Gemini 2.5 Pro';
  if (m.includes('gemini-2.0'))         return 'Gemini 2.0';
  if (m.includes('gemini'))             return 'Gemini';
  // OpenAI
  if (m.includes('gpt-4o'))             return 'GPT-4o';
  if (m.includes('gpt-4'))              return 'GPT-4';
  if (m.includes('o3'))                 return 'o3';
  if (m.includes('o1'))                 return 'o1';
  // Fallback: last segment after /
  const parts = model.split('/');
  return parts[parts.length - 1];
}

// ── Fallback model list — only shown when Gateway models.list is unavailable ──
const FALLBACK_MODELS = [
  { id: 'anthropic/claude-sonnet-4-6', alias: 'sonnet46', label: 'Sonnet 4.6' },
  { id: 'anthropic/claude-opus-4-6',   alias: 'opus',     label: 'Opus 4.6'   },
  { id: 'anthropic/claude-sonnet-4-5', alias: 'sonnet',   label: 'Sonnet 4.5' },
  { id: 'google/gemini-2.5-pro',       alias: 'gemini',   label: 'Gemini 2.5' },
];

// ── Model Picker Dropdown ─────────────────────────────────
function ModelPicker({ currentModel }: { currentModel: string | null }) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { setManualModelOverride, availableModels } = useChatStore();

  // Only show models that have an alias — these are explicitly configured by the user
  // in agents.defaults.models. This filters out regional variants and unconfigured models.
  const configuredModels = availableModels.filter((m) => m.alias);
  const modelList = configuredModels.length > 0 ? configuredModels : FALLBACK_MODELS;

  // Group by provider for cleaner display
  const grouped = modelList.reduce<Record<string, typeof modelList>>((acc, m) => {
    const provider = m.id.split('/')[0] || 'other';
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(m);
    return acc;
  }, {});
  const providers = Object.keys(grouped);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = async (modelId: string) => {
    if (switching) return;
    setOpen(false);
    setSwitching(true);
    try {
      await gateway.setSessionModel(modelId);
      // Set manual override — prevents polling from overwriting the selection
      setManualModelOverride(modelId);
      // Notify App to refresh session metadata (maxTokens may change with new model)
      setTimeout(() => window.dispatchEvent(new Event('aegis:model-changed')), 500);
    } catch (err) {
      console.error('[ModelPicker] Failed to switch model:', err);
    } finally {
      setSwitching(false);
    }
  };

  // Manual override takes priority over polled model
  const { manualModelOverride } = useChatStore();
  const effectiveModel = manualModelOverride ?? currentModel;
  // Match by exact model ID only — avoids "sonnet" matching inside "sonnet46"
  const activeModel = modelList.find((m) => effectiveModel === m.id);
  const displayLabel = activeModel?.alias || activeModel?.label || formatModelName(effectiveModel);

  return (
    <div ref={ref} className="relative no-drag">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className={clsx(
          'flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono transition-all duration-150',
          'text-aegis-text-muted hover:text-aegis-text-secondary',
          'hover:bg-[rgb(var(--aegis-overlay)/0.06)]',
          open && 'bg-[rgb(var(--aegis-overlay)/0.08)] text-aegis-text-secondary',
          switching && 'opacity-60 cursor-wait'
        )}
      >
        <span>{switching ? '…' : displayLabel}</span>
        <ChevronDown
          size={10}
          className={clsx('transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 min-w-[200px] max-w-[280px] rounded-xl overflow-hidden bg-aegis-menu-bg border border-aegis-menu-border"
          style={{
            boxShadow: 'var(--aegis-menu-shadow)',
          }}
        >
          {/* Scrollable model list — max 7 rows visible */}
          <div className="overflow-y-auto max-h-[252px] py-1">
            {providers.map((provider, pi) => (
              <div key={provider}>
                {/* Provider label — only show if multiple providers */}
                {providers.length > 1 && (
                  <div className={clsx(
                    'px-3 py-1 text-[9px] font-semibold uppercase tracking-widest text-aegis-text-dim',
                    pi > 0 && 'mt-1 border-t border-[rgb(var(--aegis-overlay)/0.07)] pt-2'
                  )}>
                    {provider === 'anthropic' ? 'Anthropic' :
                     provider === 'google'    ? 'Google'    :
                     provider === 'openai'    ? 'OpenAI'    : provider}
                  </div>
                )}
                {grouped[provider].map((m) => {
                  const isActive = effectiveModel === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleSelect(m.id)}
                      className={clsx(
                        'w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-start transition-colors',
                        isActive
                          ? 'text-aegis-primary bg-[rgb(var(--aegis-primary)/0.08)]'
                          : 'text-aegis-text-secondary hover:bg-[rgb(var(--aegis-overlay)/0.06)]'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-mono truncate block">{m.alias || formatModelName(m.id)}</span>
                        {m.alias && (
                          <span className="text-[9px] text-aegis-text-dim font-mono truncate block">
                            {formatModelName(m.id)}
                          </span>
                        )}
                      </div>
                      {isActive && <Check size={11} className="text-aegis-primary shrink-0 ms-2" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Thinking Levels ───────────────────────────────────────
const THINKING_LEVELS = [
  { id: 'high',    label: 'Think: High',    icon: '🧠' },
  { id: 'medium',  label: 'Think: Medium',  icon: '💡' },
  { id: 'low',     label: 'Think: Low',     icon: '⚡' },
  { id: 'minimal', label: 'Think: Minimal', icon: '🔹' },
  { id: 'off',     label: 'Think: Off',     icon: '○'  },
];

function ThinkingPicker({ currentThinking }: { currentThinking: string | null }) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { setCurrentThinking } = useChatStore();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = async (level: string) => {
    if (switching) return;
    setOpen(false);
    setSwitching(true);
    try {
      await gateway.setSessionThinking(level === 'off' ? null : level);
      setCurrentThinking(level === 'off' ? null : level);
    } catch (err) {
      console.error('[ThinkingPicker] Failed to switch thinking:', err);
    } finally {
      setSwitching(false);
    }
  };

  const active = THINKING_LEVELS.find((t) => t.id === (currentThinking ?? 'high'));
  const displayLabel = active?.icon ?? '🧠';

  return (
    <div ref={ref} className="relative no-drag">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        title={active?.label ?? 'Thinking level'}
        className={clsx(
          'flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] transition-all duration-150',
          'text-aegis-text-muted hover:text-aegis-text-secondary',
          'hover:bg-[rgb(var(--aegis-overlay)/0.06)]',
          open && 'bg-[rgb(var(--aegis-overlay)/0.08)]',
          switching && 'opacity-60 cursor-wait'
        )}
      >
        <span>{switching ? '…' : displayLabel}</span>
        <ChevronDown size={9} className={clsx('transition-transform duration-150', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[150px] rounded-xl overflow-hidden bg-aegis-menu-bg border border-aegis-menu-border"
          style={{
            boxShadow: 'var(--aegis-menu-shadow)',
          }}
        >
          {THINKING_LEVELS.map((t) => {
            const isActive = (currentThinking ?? 'high') === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleSelect(t.id)}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 text-[12px] text-start transition-colors',
                  isActive
                    ? 'text-aegis-primary bg-[rgb(var(--aegis-primary)/0.08)]'
                    : 'text-aegis-text-secondary hover:bg-[rgb(var(--aegis-overlay)/0.06)]'
                )}
              >
                <span className="flex items-center gap-2">
                  <span>{t.icon}</span>
                  <span className="font-mono">{t.label.replace('Think: ', '')}</span>
                </span>
                {isActive && <Check size={11} className="text-aegis-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// showUpdateToast — Simple toast helper for update events
// ═══════════════════════════════════════════════════════════

// Simple toast helper — uses the ToastContainer's global store if available,
// otherwise falls back to a simple DOM notification
function showUpdateToast(title: string, message: string, variant: 'info' | 'success' | 'warning' = 'info') {
  // Try global toast API
  if (typeof window !== 'undefined' && (window as any).__aegisToast) {
    (window as any).__aegisToast({ title, message, variant });
    return;
  }
  // Fallback: Electron notification
  if (window.aegis?.notify) {
    window.aegis.notify(title, message);
  }
}

// ═══════════════════════════════════════════════════════════
// useAutoUpdate — Tracks electron-updater state
// ═══════════════════════════════════════════════════════════

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

function useAutoUpdate() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [downloadPercent, setDownloadPercent] = useState(0);

  useEffect(() => {
    const api = window.aegis?.update;
    if (!api) return;

    const unsubs = [
      api.onAvailable((info) => {
        setUpdateVersion(info.version ?? null);
        setStatus('available');
        showUpdateToast(
          '🔄 Update Available',
          `Version ${info.version} is ready to download`,
          'info'
        );
      }),
      api.onUpToDate(() => setStatus('idle')),
      api.onProgress((p) => {
        setDownloadPercent(Math.round(p.percent ?? 0));
        setStatus('downloading');
      }),
      api.onDownloaded(() => {
        setStatus('ready');
        showUpdateToast(
          '✅ Update Ready',
          'Restart to apply the update',
          'success'
        );
      }),
      api.onError(() => {
        setStatus('error');
        showUpdateToast(
          '⚠️ Update Error',
          'Failed to check for updates',
          'warning'
        );
      }),
    ];

    return () => unsubs.forEach(fn => fn());
  }, []);

  const check = async () => {
    const api = window.aegis?.update;
    if (!api) return;
    setStatus('checking');
    try {
      await api.check();
    } catch {
      setStatus('error');
    }
  };

  const download = async () => {
    const api = window.aegis?.update;
    if (!api) return;
    try {
      await api.download();
    } catch {
      setStatus('error');
    }
  };

  const install = () => window.aegis?.update.install();

  return { status, updateVersion, downloadPercent, check, download, install };
}

// ── VersionBadge — Colored pill showing version + update state ────────────
function VersionBadge() {
  const { status, updateVersion, downloadPercent, check, download, install } = useAutoUpdate();

  // Dev mode — static green badge, no update checks
  if (APP_VERSION === 'dev') {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold font-mono bg-aegis-success/15 text-aegis-success border border-aegis-success/30 transition-colors duration-300">
        Version dev
      </span>
    );
  }

  const handleClick = () => {
    if (status === 'idle' || status === 'error') check();
    else if (status === 'available') download();
    else if (status === 'ready') install();
  };

  const isClickable = ['idle', 'error', 'available', 'ready'].includes(status);
  const isYellow = ['available', 'downloading', 'ready'].includes(status);
  const isPulsing = status === 'checking' || status === 'downloading';

  let label: string;
  switch (status) {
    case 'checking':    label = `v${APP_VERSION}`; break;
    case 'available':   label = `Update v${updateVersion ?? ''}`; break;
    case 'downloading': label = `Downloading ${downloadPercent}%`; break;
    case 'ready':       label = 'Restart to update'; break;
    case 'error':       label = `v${APP_VERSION}`; break;
    default:            label = `v${APP_VERSION} ✓`; break;
  }

  return (
    <button
      onClick={isClickable ? handleClick : undefined}
      title={
        status === 'idle'      ? 'Click to check for updates' :
        status === 'available' ? `Update to v${updateVersion} — click to download` :
        status === 'ready'     ? 'Update downloaded — click to restart' :
        status === 'error'     ? 'Update check failed — click to retry' :
        undefined
      }
      className={clsx(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold font-mono transition-colors duration-300',
        isYellow
          ? 'bg-aegis-warning/15 text-aegis-warning border border-aegis-warning/30'
          : 'bg-aegis-success/15 text-aegis-success border border-aegis-success/30',
        isPulsing && 'animate-pulse',
        isClickable ? 'cursor-pointer' : 'cursor-default'
      )}
    >
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════
export function TitleBar() {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);
  const { connected, connecting, tokenUsage, currentModel, currentThinking, currentFastMode, setCurrentFastMode } = useChatStore();

  useEffect(() => {
    window.aegis?.window.isMaximized().then(setIsMaximized);
  }, []);

  const handleMinimize = () => window.aegis?.window.minimize();
  const handleMaximize = async () => {
    const result = await window.aegis?.window.maximize();
    setIsMaximized(!!result);
  };
  const handleClose = () => window.aegis?.window.close();

  const usedTokens = tokenUsage?.contextTokens || 0;
  const maxTokens = tokenUsage?.maxTokens || 200000;
  const usedK = Math.round(usedTokens / 1000);
  // Display maxTokens as "1M" when >= 1,000,000 or "200K" etc.
  const maxLabel = maxTokens >= 1_000_000
    ? `${(maxTokens / 1_000_000).toFixed(maxTokens % 1_000_000 === 0 ? 0 : 1)}M`
    : `${Math.round(maxTokens / 1000)}K`;

  return (
    <div dir="ltr" className="drag-region h-[38px] flex items-center justify-between chrome-bg border-b border-aegis-border select-none shrink-0 relative z-10">

      {/* ── Left: Brand + Model + Tokens + Status ── */}
      <div className="flex items-center gap-4 px-4">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-aegis-text-secondary tracking-[2px]">
            OpenClaw
          </span>
          <span className="text-[10px] text-aegis-text-dim tracking-[1px]">
            Station
          </span>
          <VersionBadge />
        </div>

        {/* Model + Tokens + Status */}
        <div className="flex items-center gap-3 text-[11px] text-aegis-text-muted font-mono">
        <ModelPicker currentModel={currentModel} />
        <span className="text-aegis-text-dim opacity-40">·</span>
        <ThinkingPicker currentThinking={currentThinking} />
        <span className="text-aegis-text-dim opacity-40">·</span>
        <button
          onClick={async () => {
            const next = !currentFastMode;
            setCurrentFastMode(next);
            try { await gateway.setSessionFast(next); } catch {}
          }}
          title={currentFastMode ? 'Fast Mode: ON — click to disable' : 'Fast Mode: OFF — click to enable'}
          className={clsx(
            'no-drag flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] transition-all duration-150',
            'hover:bg-[rgb(var(--aegis-overlay)/0.06)]',
            currentFastMode
              ? 'text-amber-400 bg-amber-400/10'
              : 'text-aegis-text-muted hover:text-aegis-text-secondary'
          )}
        >
          <Zap size={11} className={currentFastMode ? 'fill-amber-400' : ''} />
          <span className="font-mono">{currentFastMode ? 'fast' : 'fast'}</span>
        </button>
        <span className="text-aegis-text-dim">·</span>
        <span>{usedK}K / {maxLabel}</span>
        <span className="text-aegis-text-dim">·</span>
        <span className={clsx(
          'flex items-center gap-[6px]',
          connected ? 'text-aegis-success' : connecting ? 'text-aegis-warning' : 'text-aegis-text-dim'
        )}>
          <span className={clsx(
            'w-[6px] h-[6px] rounded-full',
            connected ? 'bg-aegis-success connected-glow' : connecting ? 'bg-aegis-warning animate-pulse' : 'bg-aegis-text-dim'
          )} />
          {connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}
        </span>
        </div>
      </div>

      {/* ── Center: Search / Command Palette trigger (absolute centered) ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <button
          onClick={() => useSettingsStore.getState().setCommandPaletteOpen(true)}
          className="no-drag pointer-events-auto flex items-center gap-2 px-3 py-1 rounded-lg
            bg-[rgb(var(--aegis-overlay)/0.04)] border border-[rgb(var(--aegis-overlay)/0.08)]
            text-aegis-text-dim text-[11px] cursor-pointer
            hover:bg-[rgb(var(--aegis-overlay)/0.08)] hover:border-[rgb(var(--aegis-overlay)/0.15)] transition-colors"
        >
          <Search size={12} className="text-aegis-text-dim/50 shrink-0" />
          <span className="opacity-40 min-w-[60px]">{t('palette.searchBarHint')}</span>
          <kbd className="flex items-center gap-0.5 text-[9px] text-aegis-text-dim/40 bg-[rgb(var(--aegis-overlay)/0.06)] px-1 py-0.5 rounded border border-[rgb(var(--aegis-overlay)/0.08)]">
            <Command size={8} />K
          </kbd>
        </button>
      </div>

      {/* ── Right: Window Controls (Windows style: ─ □ ✕) ── */}
      <div className="no-drag flex items-center gap-1 px-4">
        <button
          onClick={handleMinimize}
          className="w-[32px] h-[22px] rounded-[11px] flex items-center justify-center text-[12px] leading-none transition-all duration-[250ms]"
          style={{
            background: 'rgb(var(--aegis-overlay) / 0.04)',
            border: '1px solid rgb(var(--aegis-overlay) / 0.08)',
            color: 'rgb(var(--aegis-text-dim))',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgb(var(--aegis-overlay) / 0.08)'; e.currentTarget.style.borderColor = 'rgb(var(--aegis-overlay) / 0.15)'; e.currentTarget.style.color = 'rgb(var(--aegis-text-secondary))'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgb(var(--aegis-overlay) / 0.04)'; e.currentTarget.style.borderColor = 'rgb(var(--aegis-overlay) / 0.08)'; e.currentTarget.style.color = 'rgb(var(--aegis-text-dim))'; }}
          title={t('titlebar.minimize')}
        >─</button>
        <button
          onClick={handleMaximize}
          className="w-[32px] h-[22px] rounded-[11px] flex items-center justify-center text-[10px] leading-none transition-all duration-[250ms]"
          style={{
            background: 'rgb(var(--aegis-overlay) / 0.04)',
            border: '1px solid rgb(var(--aegis-overlay) / 0.08)',
            color: 'rgb(var(--aegis-text-dim))',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgb(var(--aegis-primary) / 0.15)'; e.currentTarget.style.borderColor = 'rgb(var(--aegis-primary) / 0.3)'; e.currentTarget.style.color = 'rgb(var(--aegis-primary))'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgb(var(--aegis-overlay) / 0.04)'; e.currentTarget.style.borderColor = 'rgb(var(--aegis-overlay) / 0.08)'; e.currentTarget.style.color = 'rgb(var(--aegis-text-dim))'; }}
          title={isMaximized ? t('titlebar.restore') : t('titlebar.maximize')}
        >□</button>
        <button
          onClick={handleClose}
          className="w-[32px] h-[22px] rounded-[11px] flex items-center justify-center text-[12px] leading-none transition-all duration-[250ms]"
          style={{
            background: 'rgb(var(--aegis-overlay) / 0.04)',
            border: '1px solid rgb(var(--aegis-overlay) / 0.08)',
            color: 'rgb(var(--aegis-text-dim))',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgb(var(--aegis-danger) / 0.2)'; e.currentTarget.style.borderColor = 'rgb(var(--aegis-danger) / 0.3)'; e.currentTarget.style.color = 'rgb(var(--aegis-danger))'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgb(var(--aegis-overlay) / 0.04)'; e.currentTarget.style.borderColor = 'rgb(var(--aegis-overlay) / 0.08)'; e.currentTarget.style.color = 'rgb(var(--aegis-text-dim))'; }}
          title={t('titlebar.close')}
        >✕</button>
      </div>
    </div>
  );
}
