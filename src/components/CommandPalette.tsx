// ═══════════════════════════════════════════════════════════
// CommandPalette — Ctrl+K quick action launcher
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FilePlus, RotateCcw, StopCircle, RefreshCw, Layers, Zap, Lightbulb, Eraser,
  Wifi, WifiOff, Heart, Mail, Calendar,
  Globe, Bell, BellOff, Command, Maximize, Terminal, BarChart3, Info, Download
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';
import { useChatStore } from '@/stores/chatStore';
import { gateway } from '@/services/gateway/index';
import { changeLanguage } from '@/i18n';

/** Send a slash command to the gateway via the chat quick-action bridge */
function sendSlashCommand(cmd: string) {
  window.dispatchEvent(new CustomEvent('aegis:quick-action', { detail: { message: cmd, autoSend: true } }));
}
import clsx from 'clsx';

interface PaletteCommand {
  id: string;
  icon: any;
  name: string;
  description?: string;
  shortcut?: string;
  keywords: string[];
  action: () => void;
}

const TOGGLE_LANGUAGES = ['en', 'zh', 'ar', 'es'] as const;

export function CommandPalette() {
  const { t } = useTranslation();
  const { commandPaletteOpen, setCommandPaletteOpen, language, setLanguage, notificationsEnabled, setNotificationsEnabled } = useSettingsStore();
  const { connected } = useChatStore();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Define commands
  const commands: PaletteCommand[] = [
    // ── OpenClaw Slash Commands ──
    { id: 'cmd-new', icon: FilePlus, name: '/new — New Session', keywords: ['new', 'جديد', 'جلسة', 'session'], action: () => sendSlashCommand('/new') },
    { id: 'cmd-reset', icon: RotateCcw, name: '/reset — Reset Session', keywords: ['reset', 'إعادة', 'تعيين', 'ريسيت'], action: () => sendSlashCommand('/reset') },
    { id: 'cmd-stop', icon: StopCircle, name: '/stop — Stop Generation', keywords: ['stop', 'إيقاف', 'وقف', 'توقف'], action: () => sendSlashCommand('/stop') },
    { id: 'cmd-compact', icon: RefreshCw, name: '/compact — Compact Context', keywords: ['compact', 'ضغط', 'سياق', 'context'], action: () => sendSlashCommand('/compact') },
    { id: 'cmd-model', icon: Layers, name: '/model — Change Model', keywords: ['model', 'موديل', 'نموذج', 'تغيير'], action: () => sendSlashCommand('/model') },
    { id: 'cmd-fast', icon: Zap, name: '/fast — Toggle Fast Mode', keywords: ['fast', 'سريع', 'سرعة', 'speed'], action: () => sendSlashCommand('/fast') },
    { id: 'cmd-think', icon: Lightbulb, name: '/think — Toggle Thinking', keywords: ['think', 'تفكير', 'thinking', 'reasoning'], action: () => sendSlashCommand('/think') },
    { id: 'cmd-clear', icon: Eraser, name: '/clear — Clear Display', keywords: ['clear', 'مسح', 'تنظيف', 'شاشة'], action: () => {
      useChatStore.getState().clearMessages();
    }},
    { id: 'cmd-focus', icon: Maximize, name: '/focus — Focus Mode', shortcut: 'Ctrl+Shift+F', keywords: ['focus', 'تركيز', 'fullscreen', 'كامل', 'شاشة'], action: () => {
      useSettingsStore.getState().toggleFocusMode();
    }},
    { id: 'cmd-verbose', icon: Terminal, name: '/verbose — Toggle Verbose', keywords: ['verbose', 'تفصيل', 'مفصل', 'detailed'], action: () => sendSlashCommand('/verbose') },
    { id: 'cmd-usage', icon: BarChart3, name: '/usage — Token Usage', keywords: ['usage', 'استهلاك', 'توكنز', 'tokens', 'cost'], action: () => sendSlashCommand('/usage') },
    { id: 'cmd-status', icon: Info, name: '/status — Session Status', keywords: ['status', 'حالة', 'جلسة', 'معلومات'], action: () => sendSlashCommand('/status') },
    { id: 'cmd-export', icon: Download, name: '/export — Export Chat', keywords: ['export', 'تصدير', 'حفظ', 'markdown'], action: () => sendSlashCommand('/export') },

    // ── Quick Actions ──
    { id: 'act-heartbeat', icon: Heart, name: t('palette.heartbeat'), keywords: ['heartbeat', 'فحص', 'check'], action: () => sendSlashCommand('Run a quick heartbeat check — emails, calendar, anything urgent?') },
    { id: 'act-emails', icon: Mail, name: t('palette.checkEmails'), keywords: ['email', 'إيميل', 'بريد'], action: () => sendSlashCommand('Check my unread emails and summarize anything important.') },
    { id: 'act-calendar', icon: Calendar, name: t('palette.checkCalendar'), keywords: ['calendar', 'تقويم', 'مواعيد'], action: () => sendSlashCommand("What's on my calendar today and tomorrow?") },

    // ── Connection ──
    { id: 'conn-reconnect', icon: connected ? Wifi : WifiOff, name: connected ? t('palette.reconnect') : t('palette.connectGateway'), keywords: ['connect', 'reconnect', 'اتصال', 'gateway'], action: async () => {
      const config = await window.aegis?.config?.get();
      gateway.connect(config?.gatewayUrl || 'ws://127.0.0.1:18789', config?.gatewayToken || '');
    }},

    // ── Settings ──
    { id: 'set-lang', icon: Globe, name: t('palette.toggleLanguage'), keywords: ['language', 'لغة', 'english', 'عربي'], action: () => {
      const currentIndex = TOGGLE_LANGUAGES.indexOf(language);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % TOGGLE_LANGUAGES.length;
      const newLang = TOGGLE_LANGUAGES[nextIndex];
      setLanguage(newLang);
      changeLanguage(newLang);
    }},
    { id: 'set-notif', icon: notificationsEnabled ? BellOff : Bell, name: t('palette.toggleNotifications'), keywords: ['notifications', 'إشعارات'], action: () => {
      setNotificationsEnabled(!notificationsEnabled);
    }},
  ];

  // Filter
  const filtered = query.trim()
    ? commands.filter((cmd) => {
        const q = query.toLowerCase();
        return cmd.name.toLowerCase().includes(q) ||
          cmd.keywords.some((k) => k.includes(q)) ||
          (cmd.description || '').toLowerCase().includes(q);
      })
    : commands;

  // Reset on open
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Keyboard nav
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault();
      filtered[selectedIdx].action();
      setCommandPaletteOpen(false);
    } else if (e.key === 'Escape') {
      setCommandPaletteOpen(false);
    }
  }, [filtered, selectedIdx, setCommandPaletteOpen]);

  // Keep selection in bounds
  useEffect(() => {
    setSelectedIdx((prev) => Math.min(prev, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  if (!commandPaletteOpen) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
        onClick={() => setCommandPaletteOpen(false)}>
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.12 }}
          onClick={(e) => e.stopPropagation()}
          className="w-[520px] rounded-2xl bg-aegis-bg border border-aegis-border/30 shadow-2xl overflow-hidden"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-aegis-border/20">
            <Command size={16} className="text-aegis-text-dim shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('palette.searchPlaceholder')}
              className="flex-1 bg-transparent text-[15px] text-aegis-text placeholder:text-aegis-text-dim/40 focus:outline-none"
              dir="auto"
            />
            <kbd className="text-[10px] text-aegis-text-dim bg-aegis-surface/40 px-1.5 py-0.5 rounded border border-aegis-border/20">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[360px] overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="text-center py-8 text-[13px] text-aegis-text-dim">{t('commandPaletteFooter.noResults')}</div>
            )}
            {filtered.slice(0, 12).map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => { cmd.action(); setCommandPaletteOpen(false); }}
                onMouseEnter={() => setSelectedIdx(i)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors',
                  i === selectedIdx ? 'bg-aegis-primary/10' : 'hover:bg-[rgb(var(--aegis-overlay)/0.03)]'
                )}
              >
                <cmd.icon size={16} className={clsx(i === selectedIdx ? 'text-aegis-primary' : 'text-aegis-text-dim')} />
                <div className="flex-1 min-w-0">
                  <span className={clsx('text-[13px]', i === selectedIdx ? 'text-aegis-text' : 'text-aegis-text-muted')}>
                    {cmd.name}
                  </span>
                </div>
                {cmd.shortcut && (
                  <kbd className="text-[10px] text-aegis-text-dim/60 bg-aegis-surface/30 px-1.5 py-0.5 rounded border border-aegis-border/15">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-3 px-4 py-2 border-t border-aegis-border/15 text-[10px] text-aegis-text-dim/50">
            <span>↑↓ {t('commandPaletteFooter.navigate')}</span>
            <span>↵ {t('commandPaletteFooter.execute')}</span>
            <span>ESC {t('commandPaletteFooter.close')}</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
