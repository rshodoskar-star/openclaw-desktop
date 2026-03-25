import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Shield, MessageSquare, ChevronDown, Zap, RotateCcw, Bot } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useChatStore, Session } from '@/stores/chatStore';
import { useGatewayDataStore } from '@/stores/gatewayDataStore';
import { gateway } from '@/services/gateway/index';
import { themeHex, themeAlpha, dataColor } from '@/utils/theme-colors';
import clsx from 'clsx';

// ═══════════════════════════════════════════════════════════
// ChatHeader — Compact header replacing old tab bar
// Layout: O OpenClaw Station ∨       +  ●  165k / 200k
// ═══════════════════════════════════════════════════════════

const MAIN_SESSION = 'agent:main:main';

// ── Helpers ──────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/** Readable label for a session tab */
function sessionLabel(session: Session | undefined, key: string, t: TFunction): string {
  if (key === MAIN_SESSION) return t('app.clientName');
  if (session?.label) {
    const label = session.label;
    return label.length > 30 ? label.slice(0, 28) + '…' : label;
  }
  const parts = key.split(':');
  const last = parts[parts.length - 1];
  return last.length > 30 ? last.slice(0, 28) + '…' : last;
}

/** Classify session by key pattern */
function sessionType(key: string): 'main' | 'cron' | 'voice' | 'other' {
  // agent:X:cron:* → cron
  if (/:cron:/.test(key)) return 'cron';
  // agent:X:voice* → voice
  if (/:voice/.test(key)) return 'voice';
  // agent:X:main → main
  if (/:main$/.test(key) || key === 'agent:main:main') return 'main';
  return 'other';
}

function isMainSession(key: string): boolean {
  return sessionType(key) === 'main';
}

function isCronOrVoice(key: string): boolean {
  const t = sessionType(key);
  return t === 'cron' || t === 'voice';
}

// ═══════════════════════════════════════════════════════════
// Agent Status Tooltip — hover card on OpenClaw Station identity
// ═══════════════════════════════════════════════════════════

function AgentStatusTooltip({ visible, tokenUsage, connected }: {
  visible: boolean;
  tokenUsage: any;
  connected: boolean;
}) {
  const { t } = useTranslation();
  const statusBadge = connected ? t('chat.tooltipActive') : t('chat.tooltipOffline');

  // Get session info from gateway data store (has model field)
  const gatewaySessions = useGatewayDataStore((s) => s.sessions);
  const mainSession = gatewaySessions.find((s) =>
    (s.key || '').includes('agent:main:main')
  );

  const contextTokens = tokenUsage?.contextTokens || 0;
  const maxTokens = tokenUsage?.maxTokens || 200000;
  const usagePct = maxTokens > 0 ? Math.round((contextTokens / maxTokens) * 100) : 0;
  const compactions = tokenUsage?.compactions || 0;

  const model = mainSession?.model || '';
  const modelShort = model ? model.split('/').pop()! : '—';

  const sessionStart = mainSession?.createdAt || mainSession?.updatedAt;
  const sessionAge = sessionStart ? formatDuration(Date.now() - new Date(sessionStart).getTime()) : '—';

  const compactAt = Math.round(maxTokens * 0.8);
  const compactPct = maxTokens > 0 ? Math.round((contextTokens / compactAt) * 100) : 0;

  const usageColor = usagePct > 70 ? themeHex('danger') : usagePct > 40 ? themeHex('warning') : themeHex('primary');

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="absolute top-full start-0 mt-2 w-[300px] rounded-2xl border border-[rgb(var(--aegis-overlay)/0.1)] z-[100] overflow-hidden"
          style={{ background: 'var(--aegis-bg-frosted)', backdropFilter: 'blur(40px)', boxShadow: '0 16px 48px rgb(var(--aegis-overlay) / 0.2)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-[rgb(var(--aegis-overlay)/0.06)]">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aegis-primary/20 to-aegis-primary/5 border border-aegis-primary/25 flex items-center justify-center text-lg">
              O
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-aegis-primary">{t('app.clientName')}</div>
              <div className="text-[9px] text-aegis-text-dim font-mono">{modelShort}</div>
            </div>
            <div className={clsx(
              'px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border',
              connected
                ? 'bg-aegis-primary/10 text-aegis-primary border-aegis-primary/20'
                : 'bg-[rgb(var(--aegis-overlay)/0.04)] text-aegis-text-muted border-[rgb(var(--aegis-overlay)/0.08)]'
            )}>
              {statusBadge}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 p-3">
            <div className="bg-[rgb(var(--aegis-overlay)/0.02)] border border-[rgb(var(--aegis-overlay)/0.04)] rounded-xl p-2.5 text-center">
              <div className="text-base font-extrabold" style={{ color: 'rgb(var(--aegis-accent))' }}>{compactions}</div>
              <div className="text-[8px] text-aegis-text-dim uppercase tracking-wider mt-0.5">{t('chat.compactions')}</div>
            </div>
            <div className="bg-[rgb(var(--aegis-overlay)/0.02)] border border-[rgb(var(--aegis-overlay)/0.04)] rounded-xl p-2.5 text-center">
              <div className="text-base font-extrabold" style={{ color: dataColor(3) }}>{sessionAge}</div>
              <div className="text-[8px] text-aegis-text-dim uppercase tracking-wider mt-0.5">{t('chat.sessionAge')}</div>
            </div>
          </div>

          {/* Context Usage Bar */}
          <div className="px-4 pb-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] text-aegis-text-muted flex items-center gap-1">
                <Zap size={10} /> {t('chat.contextUsage')}
              </span>
              <span className="text-[10px] font-semibold font-mono" style={{ color: usageColor }}>
                {formatTokens(contextTokens)} / {formatTokens(maxTokens)}
              </span>
            </div>
            <div className="w-full h-[5px] rounded-full bg-[rgb(var(--aegis-overlay)/0.04)] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usagePct}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${themeHex('primary')}, ${usageColor})` }}
              />
            </div>
          </div>

          {/* Info Rows */}
          <div className="px-4 pb-3 space-y-0">
            <div className="flex items-center gap-2 py-1.5 border-t border-[rgb(var(--aegis-overlay)/0.03)]">
              <span className="text-xs">🗜️</span>
              <span className="text-[10px] text-aegis-text-muted flex-1">{t('chat.compactsAt')}</span>
              <span className={clsx('text-[10px] font-bold font-mono', compactPct > 80 ? 'text-aegis-danger' : compactPct > 50 ? 'text-aegis-warning' : 'text-aegis-primary')}>
                ~{formatTokens(compactAt)}
              </span>
            </div>
            <div className="flex items-center gap-2 py-1.5 border-t border-[rgb(var(--aegis-overlay)/0.03)]">
              <span className="text-xs">💓</span>
              <span className="text-[10px] text-aegis-text-muted flex-1">{t('chat.heartbeat')}</span>
              <span className="text-[10px] font-bold font-mono text-aegis-primary">{t('chat.heartbeatInterval')}</span>
            </div>
            <div className="flex items-center gap-2 py-1.5 border-t border-[rgb(var(--aegis-overlay)/0.03)]">
              <span className="text-xs">🧠</span>
              <span className="text-[10px] text-aegis-text-muted flex-1">{t('chat.thinking')}</span>
              <span className="text-[10px] font-bold font-mono" style={{ color: dataColor(3) }}>{t('chat.thinkingLevelHigh')}</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════
// Session Switcher Dropdown
// ═══════════════════════════════════════════════════════════

function SessionDropdown({ open, onClose, onSelect, openTabs, sessions, activeKey }: {
  open: boolean;
  onClose: () => void;
  onSelect: (key: string) => void;
  openTabs: string[];
  sessions: Session[];
  activeKey: string;
}) {
  const { t } = useTranslation();
  const [availableSessions, setAvailableSessions] = useState<Session[]>([]);
  const [groupedSessions, setGroupedSessions] = useState<Record<string, Session[]>>({});
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  // Load all available sessions when opened
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    gateway.getSessions()
      .then((result: any) => {
        const list: Session[] = (result?.sessions || []).map((s: any) => ({
          key: s.key || s.sessionKey,
          label: s.label || '',
          kind: s.kind,
          agentId: s.agentId || (s.key?.split(':')[1]) || 'unknown',
          agentName: s.agentName || s.agent?.name || '',
          lastMessage: s.lastMessage,
          lastTimestamp: s.lastTimestamp,
        }));
        // Sessions not already in open tabs
        const available = list.filter((s) => !openTabs.includes(s.key));
        setAvailableSessions(available.filter((s) => isMainSession(s.key)));

        // Group all sessions by agent
        const groups: Record<string, Session[]> = {};
        for (const s of available) {
          const agent = (s as any).agentId || s.key.split(':')[1] || 'other';
          if (!groups[agent]) groups[agent] = [];
          groups[agent].push(s);
        }
        setGroupedSessions(groups);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, openTabs]);

  const getSession = (key: string) => sessions.find((s) => s.key === key);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12 }}
          className="absolute top-full start-0 mt-1.5 w-72 max-h-80 overflow-y-auto rounded-2xl border border-[rgb(var(--aegis-overlay)/0.1)] z-[100]"
          style={{ background: 'var(--aegis-bg-frosted)', backdropFilter: 'blur(40px)', boxShadow: '0 16px 48px rgb(var(--aegis-overlay) / 0.25)' }}
        >
          {/* Open tabs section */}
          {openTabs.length > 0 && (
            <div className="p-2">
              <div className="text-[9px] text-aegis-text-dim uppercase tracking-wider px-2 py-1 mb-0.5">
                {t('chat.openSessions')}
              </div>
              {openTabs.filter(isMainSession).map((key) => {
                const session = getSession(key);
                const isActive = key === activeKey;
                const isMain = key === MAIN_SESSION;
                return (
                  <button
                    key={key}
                    onClick={() => { onSelect(key); onClose(); }}
                    className={clsx(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-start transition-colors',
                      isActive
                        ? 'bg-aegis-primary/10 border border-aegis-primary/15'
                        : 'hover:bg-[rgb(var(--aegis-overlay)/0.05)] border border-transparent',
                    )}
                  >
                    {isMain ? (
                      <Shield size={14} className="text-aegis-primary shrink-0" />
                    ) : (
                      <MessageSquare size={14} className="text-aegis-text-muted shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={clsx(
                        'text-[12px] font-medium truncate',
                        isActive ? 'text-aegis-primary' : 'text-aegis-text',
                      )}>
                        {sessionLabel(session, key, t)}
                      </div>
                      {session?.kind && !isMain && (
                        <div className="text-[9px] text-aegis-text-dim font-mono mt-0.5">{session.kind}</div>
                      )}
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-aegis-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Divider + sessions grouped by agent (Control UI style) */}
          {Object.keys(groupedSessions).length > 0 && (
            <>
              <div className="mx-3 border-t border-[rgb(var(--aegis-overlay)/0.06)]" />
              <div className="py-1">
                {Object.entries(groupedSessions).map(([agentId, agentSessions]) => {
                  // Derive display name: use agentName from first session, or capitalize agentId
                  const agentDisplayName = (agentSessions[0] as any)?.agentName
                    || agentId.charAt(0).toUpperCase() + agentId.slice(1);
                  return (
                    <div key={agentId} className="mb-0.5">
                      {/* Agent group header — like Control UI: "OpenClaw Station (main)" */}
                      <div className="px-3 py-1.5 text-[11px] font-bold text-aegis-text">
                        {agentDisplayName} <span className="text-aegis-text-dim font-normal">({agentId})</span>
                      </div>
                      {/* Sessions under this agent */}
                      {agentSessions.map((session) => {
                        // Format session key: extract readable part after agent:id:
                        const keyParts = session.key.split(':');
                        const sessionPart = keyParts.slice(2).join(':') || session.key;
                        const displayLabel = session.label || sessionPart;
                        return (
                          <button
                            key={session.key}
                            onClick={() => { onSelect(session.key); onClose(); }}
                            className="w-full flex items-center gap-2 px-4 py-1.5 text-start hover:bg-[rgb(var(--aegis-overlay)/0.05)] transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] text-aegis-text-muted font-mono truncate">
                                {displayLabel}
                              </div>
                            </div>
                            {session.kind && (
                              <span className="text-[9px] text-aegis-text-dim shrink-0">{session.kind}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Loading state */}
          {loading && (
            <div className="text-center py-3 text-[11px] text-aegis-text-dim">
              {t('common.loading')}
            </div>
          )}

          {/* Empty state (no other sessions) */}
          {!loading && availableSessions.length === 0 && openTabs.length <= 1 && (
            <div className="text-center py-4 text-[11px] text-aegis-text-dim px-4">
              {t('chat.noOtherSessions')}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════
// ChatTabs (ChatHeader) — Main export
// ═══════════════════════════════════════════════════════════

export function ChatTabs() {
  const { t } = useTranslation();
  const {
    openTabs,
    activeSessionKey,
    sessions,
    openTab,
    setActiveSession,
    connected,
    connecting,
    tokenUsage,
  } = useChatStore();

  const [showSessions, setShowSessions] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout>>();
  const identityRef = useRef<HTMLDivElement>(null);

  // ── Refresh ──
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    window.dispatchEvent(new Event('aegis:refresh'));
    setTimeout(() => setIsRefreshing(false), 800);
  }, [isRefreshing]);

  // ── New session picker (+ button) ──
  const [showNewPicker, setShowNewPicker] = useState(false);
  const [newSessions, setNewSessions] = useState<Session[]>([]);
  const [loadingNew, setLoadingNew] = useState(false);
  const newPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showNewPicker) return;
    const handler = (e: MouseEvent) => {
      if (newPickerRef.current && !newPickerRef.current.contains(e.target as Node)) {
        setShowNewPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNewPicker]);

  const handleOpenNewPicker = useCallback(() => {
    setShowNewPicker((v) => !v);
    if (!showNewPicker) {
      setLoadingNew(true);
      gateway.getSessions()
        .then((result: any) => {
          const list: Session[] = (result?.sessions || []).map((s: any) => ({
            key: s.key || s.sessionKey,
            label: s.label || s.key || '',
            kind: s.kind,
          }));
          setNewSessions(list.filter((s) => !openTabs.includes(s.key) && isCronOrVoice(s.key)));
        })
        .catch(() => {})
        .finally(() => setLoadingNew(false));
    }
  }, [showNewPicker, openTabs]);

  // ── Tooltip hover logic ──
  const handleIdentityEnter = useCallback(() => {
    tooltipTimeout.current = setTimeout(() => setShowTooltip(true), 400);
  }, []);

  const handleIdentityLeave = useCallback(() => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setShowTooltip(false);
  }, []);

  // ── Session select from dropdown ──
  const handleSessionSelect = useCallback((key: string) => {
    if (openTabs.includes(key)) {
      setActiveSession(key);
    } else {
      openTab(key);
    }
  }, [openTabs, setActiveSession, openTab]);

  // ── Active session info ──
  const activeSession = sessions.find((s) => s.key === activeSessionKey);
  const activeLabel = sessionLabel(activeSession, activeSessionKey, t);
  const isMain = activeSessionKey === MAIN_SESSION;

  // ── Status dot color ──
  const statusDotClass = connected
    ? 'bg-aegis-success'
    : connecting
      ? 'bg-aegis-warning animate-pulse'
      : 'bg-aegis-danger';

  const statusLabel = connected
    ? t('connection.connected')
    : connecting
      ? t('connection.connecting')
      : t('connection.disconnected');

  return (
    <div
      className="shrink-0 flex items-center h-[40px] bg-[var(--aegis-bg-frosted-60)] backdrop-blur-xl border-b border-[rgb(var(--aegis-overlay)/0.04)] relative z-20 px-3"
      role="banner"
    >
      {/* ── Left: Identity + Status + Tokens + Session Switcher ── */}
      <div className="relative flex items-center gap-2.5 min-w-0">
        {/* OpenClaw Station identity block — hover for tooltip */}
        <div
          ref={identityRef}
          className="flex items-center gap-2.5 cursor-default select-none"
          onMouseEnter={handleIdentityEnter}
          onMouseLeave={handleIdentityLeave}
        >
          {/* Icon */}
          {isMain ? (
            <span className="text-[15px] leading-none">O</span>
          ) : (
            <MessageSquare size={14} className="text-aegis-text-muted" />
          )}

          {/* Status dot + Name */}
          <div className="flex items-center gap-1.5">
            <div className={clsx('w-[7px] h-[7px] rounded-full shrink-0', statusDotClass)} title={statusLabel} />
            <span className="text-[13px] font-semibold text-aegis-text tracking-tight">
              {activeLabel}
            </span>
          </div>
        </div>

        {/* ∨ Session dropdown toggle */}
        <button
          onClick={() => { setShowSessions((v) => !v); setShowTooltip(false); }}
          className={clsx(
            'p-1 rounded-md transition-colors',
            'text-aegis-text-dim hover:text-aegis-text-muted hover:bg-[rgb(var(--aegis-overlay)/0.05)]',
            showSessions && 'bg-[rgb(var(--aegis-overlay)/0.06)] text-aegis-text-muted',
          )}
          aria-label={t('chat.switchSession')}
        >
          <ChevronDown size={12} className={clsx('transition-transform', showSessions && 'rotate-180')} />
        </button>

        {/* Tooltip (on hover) */}
        <AgentStatusTooltip
          visible={showTooltip && !showSessions}
          tokenUsage={tokenUsage}
          connected={connected}
        />

        {/* Session switcher dropdown (on click) */}
        <SessionDropdown
          open={showSessions}
          onClose={() => setShowSessions(false)}
          onSelect={handleSessionSelect}
          openTabs={openTabs}
          sessions={sessions}
          activeKey={activeSessionKey}
        />
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Right: Refresh + New session ── */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={clsx(
            'p-1.5 rounded-lg transition-colors',
            'text-aegis-text-dim hover:text-aegis-text-muted hover:bg-[rgb(var(--aegis-overlay)/0.05)]',
            isRefreshing && 'opacity-50 cursor-wait',
          )}
          title={t('chat.refreshChat')}
        >
          <RotateCcw size={13} className={clsx('transition-transform', isRefreshing && 'animate-spin')} />
        </button>

        <div className="relative" ref={newPickerRef}>
          <button
            onClick={handleOpenNewPicker}
            className={clsx(
              'p-1.5 rounded-lg transition-colors',
              'text-aegis-text-dim hover:text-aegis-text-muted hover:bg-[rgb(var(--aegis-overlay)/0.05)]',
              showNewPicker && 'bg-[rgb(var(--aegis-overlay)/0.06)] text-aegis-text-muted',
            )}
            title={t('chat.openSessionPicker')}
          >
            <Plus size={14} />
          </button>

          {/* New session picker dropdown */}
          <AnimatePresence>
            {showNewPicker && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute top-full end-0 mt-1.5 w-64 max-h-64 overflow-y-auto rounded-xl border border-[rgb(var(--aegis-overlay)/0.1)] z-[100]"
                style={{ background: 'var(--aegis-bg-frosted)', backdropFilter: 'blur(40px)', boxShadow: '0 16px 48px rgb(var(--aegis-overlay) / 0.25)' }}
              >
                <div className="p-2">
                  <div className="text-[9px] text-aegis-text-dim uppercase tracking-wider px-2 py-1 mb-1">
                    {t('chat.cronAndVoice')}
                  </div>
                  {loadingNew ? (
                    <div className="text-center py-4 text-[11px] text-aegis-text-dim">
                      {t('common.loading')}
                    </div>
                  ) : newSessions.length === 0 ? (
                    <div className="text-center py-4 text-[11px] text-aegis-text-dim">
                      {t('chat.noCronSessions')}
                    </div>
                  ) : (
                    newSessions.map((session) => (
                      <button
                        key={session.key}
                        onClick={() => { openTab(session.key); setShowNewPicker(false); }}
                        className="w-full flex flex-col gap-0.5 px-3 py-2 rounded-lg text-start hover:bg-[rgb(var(--aegis-overlay)/0.05)] transition-colors"
                      >
                        <span className="text-[12px] text-aegis-text font-medium truncate">
                          {session.label || session.key}
                        </span>
                        {session.kind && (
                          <span className="text-[10px] text-aegis-text-dim font-mono">{session.kind}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

