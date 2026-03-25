// ═══════════════════════════════════════════════════════════
// Integrated Terminal — Multi-tab xterm.js + node-pty
// Each tab = independent PTY process
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Terminal as TermIcon } from 'lucide-react';
import clsx from 'clsx';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface TermTab {
  id: string;        // PTY id from main process
  label: string;     // Display name
  pid: number;       // OS process id
  alive: boolean;    // PTY still running
}

// ═══════════════════════════════════════════════════════════
// xterm.js dynamic import (renderer-side only)
// Avoids SSR / build issues — loads at mount time
// ═══════════════════════════════════════════════════════════

// Import xterm CSS at module level — Vite bundles it
import '@xterm/xterm/css/xterm.css';

let Terminal: any = null;
let FitAddon: any = null;
let WebLinksAddon: any = null;
let xtermLoadFailed = false;

async function loadXterm() {
  if (Terminal || xtermLoadFailed) return;
  try {
    const [xtermMod, fitMod, linksMod] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
      import('@xterm/addon-web-links'),
    ]);
    Terminal = xtermMod.Terminal;
    FitAddon = fitMod.FitAddon;
    WebLinksAddon = linksMod.WebLinksAddon;
  } catch (err) {
    console.warn('[Terminal] xterm.js not installed. Run: npm install @xterm/xterm @xterm/addon-fit @xterm/addon-web-links');
    xtermLoadFailed = true;
  }
}

// ═══════════════════════════════════════════════════════════
// OpenClaw Station Terminal Theme (matches dark/light palette)
// ═══════════════════════════════════════════════════════════

function getTerminalTheme(): Record<string, string> {
  return {
    background:          '#0a0a14',
    foreground:          '#d4d4d8',
    cursor:              '#4EC9B0',
    cursorAccent:        '#0a0a14',
    selectionBackground: 'rgba(78,201,176,0.2)',
    selectionForeground: undefined as any,
    black:        '#1a1a2e',
    red:          '#f87171',
    green:        '#4ade80',
    yellow:       '#fbbf24',
    blue:         '#60a5fa',
    magenta:      '#c084fc',
    cyan:         '#4EC9B0',
    white:        '#d4d4d8',
    brightBlack:  '#52525b',
    brightRed:    '#fca5a5',
    brightGreen:  '#86efac',
    brightYellow: '#fde68a',
    brightBlue:   '#93bbfd',
    brightMagenta:'#d8b4fe',
    brightCyan:   '#67e8f9',
    brightWhite:  '#fafafa',
  };
}

// ═══════════════════════════════════════════════════════════
// Single Terminal Instance (per tab)
// ═══════════════════════════════════════════════════════════

function TerminalInstance({ tabId, active }: { tabId: string; active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const cleanupDataRef = useRef<(() => void) | null>(null);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    (async () => {
      await loadXterm();
      if (cancelled || !containerRef.current || !Terminal) return;

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      const term = new Terminal({
        fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
        fontSize: 13,
        lineHeight: 1.35,
        cursorBlink: true,
        cursorStyle: 'bar' as const,
        scrollback: 5000,
        theme: getTerminalTheme(),
        allowProposedApi: true,
      });

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.open(containerRef.current!);

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      // Fit after a tick (DOM needs to settle)
      requestAnimationFrame(() => {
        try { fitAddon.fit(); } catch {}
      });

      // Forward keystrokes → PTY
      term.onData((data: string) => {
        window.aegis?.terminal?.write(tabId, data);
      });

      // Receive PTY output → terminal
      cleanupDataRef.current = window.aegis?.terminal?.onData((id: string, data: string) => {
        if (id === tabId) term.write(data);
      }) || null;

      // Resize PTY when terminal resizes
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        window.aegis?.terminal?.resize(tabId, cols, rows);
      });
    })();

    return () => {
      cancelled = true;
      cleanupDataRef.current?.();
      cleanupDataRef.current = null;
      termRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [tabId]);

  // Fit on visibility change or container resize
  useEffect(() => {
    if (!active) return;

    const fitTimer = setTimeout(() => {
      try { fitAddonRef.current?.fit(); } catch {}
    }, 50);

    const resizeObserver = new ResizeObserver(() => {
      try { fitAddonRef.current?.fit(); } catch {}
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    // Also fit on window resize
    const handleResize = () => {
      try { fitAddonRef.current?.fit(); } catch {}
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(fitTimer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [active]);

  // Update theme when it changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (termRef.current) {
        termRef.current.options.theme = getTerminalTheme();
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={clsx(
        'absolute inset-0',
        active ? 'visible' : 'invisible h-0 overflow-hidden',
      )}
      style={{ padding: '8px 4px 4px 8px' }}
    />
  );
}

// ═══════════════════════════════════════════════════════════
// Terminal Page (Multi-tab)
// ═══════════════════════════════════════════════════════════

export function TerminalPage() {
  const { t } = useTranslation();
  const [tabs, setTabs] = useState<TermTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const tabCounterRef = useRef(0);

  // Check if terminal API is available (Electron only)
  const hasTerminal = !!window.aegis?.terminal;

  // Listen for PTY exits
  useEffect(() => {
    if (!hasTerminal) return;
    const cleanup = window.aegis.terminal.onExit((id: string) => {
      setTabs(prev => prev.map(tab =>
        tab.id === id ? { ...tab, alive: false, label: `${tab.label} (exited)` } : tab
      ));
    });
    return cleanup;
  }, [hasTerminal]);

  // Create first tab on mount
  useEffect(() => {
    if (hasTerminal && tabs.length === 0) {
      createTab();
    }
  }, [hasTerminal]); // eslint-disable-line

  // Create new tab
  const createTab = useCallback(async () => {
    if (!hasTerminal) return;
    try {
      const result = await window.aegis.terminal.create({ cols: 80, rows: 24 });
      if (!result?.id) return;

      const num = ++tabCounterRef.current;
      const newTab: TermTab = {
        id: result.id,
        label: `Terminal ${num}`,
        pid: result.pid || 0,
        alive: true,
      };

      setTabs(prev => [...prev, newTab]);
      setActiveTabId(result.id);
    } catch (err) {
      console.error('[Terminal] Failed to create tab:', err);
    }
  }, [hasTerminal]);

  // Close tab
  const closeTab = useCallback(async (id: string) => {
    if (!hasTerminal) return;
    const tab = tabs.find(t => t.id === id);
    if (tab?.alive) {
      await window.aegis.terminal.kill(id);
    }

    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      // Switch to adjacent tab
      if (activeTabId === id && next.length > 0) {
        const idx = prev.findIndex(t => t.id === id);
        const newActive = next[Math.min(idx, next.length - 1)];
        setActiveTabId(newActive.id);
      }
      return next;
    });
  }, [hasTerminal, tabs, activeTabId]);

  // ═══ No Electron → show placeholder ═══
  if (!hasTerminal) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-[40px] mb-4">💻</div>
          <h2 className="text-[16px] font-bold text-aegis-text mb-2">{t('terminal.title')}</h2>
          <p className="text-[12px] text-aegis-text-dim max-w-[300px]">
            {t('terminal.notAvailable')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ═══ Tab Bar ═══ */}
      <div className="shrink-0 flex items-center gap-0 px-2 pt-2 pb-0
        border-b border-[rgb(var(--aegis-overlay)/0.06)] bg-aegis-bg">

        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-2 rounded-t-lg cursor-pointer transition-all text-[12px] group',
              'border border-b-0',
              activeTabId === tab.id
                ? 'bg-[rgb(var(--aegis-overlay)/0.04)] border-[rgb(var(--aegis-overlay)/0.08)] text-aegis-text font-medium'
                : 'border-transparent text-aegis-text-muted hover:text-aegis-text-secondary',
            )}
          >
            <TermIcon size={12} className={clsx(
              activeTabId === tab.id ? 'text-aegis-primary' : 'text-aegis-text-dim',
            )} />
            <span className="truncate max-w-[120px]">{tab.label}</span>
            {!tab.alive && (
              <span className="w-1.5 h-1.5 rounded-full bg-aegis-danger/60 shrink-0" />
            )}
            {tabs.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="w-4 h-4 rounded flex items-center justify-center
                  text-aegis-text-dim hover:text-aegis-danger hover:bg-aegis-danger/10
                  opacity-0 group-hover:opacity-100 transition-all"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}

        {/* New tab button */}
        <button
          onClick={createTab}
          className="w-7 h-7 rounded-lg flex items-center justify-center ms-1
            text-aegis-text-dim hover:text-aegis-primary hover:bg-aegis-primary/[0.06]
            transition-all"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* ═══ Terminal Area ═══ */}
      <div className="flex-1 min-h-0 relative overflow-hidden bg-[#0a0a14]">
        {tabs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-[32px] mb-3">💻</div>
              <p className="text-[12px] text-aegis-text-dim">{t('terminal.empty')}</p>
              <button
                onClick={createTab}
                className="mt-3 px-4 py-2 rounded-lg text-[12px] font-medium
                  bg-aegis-primary/10 text-aegis-primary border border-aegis-primary/20
                  hover:bg-aegis-primary/15 transition-colors"
              >
                <Plus size={12} className="inline me-1" />
                {t('terminal.newTab')}
              </button>
            </div>
          </div>
        ) : (
          tabs.map(tab => (
            <TerminalInstance
              key={tab.id}
              tabId={tab.id}
              active={activeTabId === tab.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
