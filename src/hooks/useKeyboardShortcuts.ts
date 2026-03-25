import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/stores/settingsStore';
import { useChatStore } from '@/stores/chatStore';

// ═══════════════════════════════════════════════════════════
// Keyboard Shortcuts — Global hotkeys for OpenClaw Station
// ═══════════════════════════════════════════════════════════

const NAV_ROUTES = ['/', '/chat', '/workshop', '/costs', '/cron', '/agents', '/memory', '/settings'];

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { setCommandPaletteOpen, commandPaletteOpen } = useSettingsStore();
  const { openTabs, activeSessionKey, openTab, closeTab } = useChatStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      // ── Always active (even in inputs) ──

      // Ctrl+K → Command Palette
      if (ctrl && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
        return;
      }

      // Ctrl+Shift+F → Focus Mode
      if (ctrl && shift && e.key === 'F') {
        e.preventDefault();
        useSettingsStore.getState().toggleFocusMode();
        return;
      }

      // Escape → close palette / modals / exit focus mode
      if (e.key === 'Escape') {
        if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
          e.preventDefault();
          return;
        }
        // Exit focus mode on Escape
        const { focusMode } = useSettingsStore.getState();
        if (focusMode) {
          useSettingsStore.getState().toggleFocusMode();
          e.preventDefault();
          return;
        }
        window.dispatchEvent(new CustomEvent('aegis:escape'));
        return;
      }

      // ── Only when NOT in text inputs ──
      if (isInput) return;

      // Ctrl+1-8 → Navigate pages
      if (ctrl && !shift) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 8 && NAV_ROUTES[num - 1]) {
          e.preventDefault();
          navigate(NAV_ROUTES[num - 1]);
          return;
        }
      }

      // Ctrl+, → Settings
      if (ctrl && e.key === ',') {
        e.preventDefault();
        navigate('/settings');
        return;
      }

      // Ctrl+N → New chat tab (navigate to chat + open picker)
      if (ctrl && e.key === 'n') {
        e.preventDefault();
        navigate('/chat');
        return;
      }

      // Ctrl+W → Close current chat tab
      if (ctrl && e.key === 'w') {
        e.preventDefault();
        if (activeSessionKey !== 'agent:main:main') {
          closeTab(activeSessionKey);
        }
        return;
      }

      // Ctrl+Tab / Ctrl+Shift+Tab → Cycle tabs
      if (ctrl && e.key === 'Tab') {
        e.preventDefault();
        const idx = openTabs.indexOf(activeSessionKey);
        if (shift) {
          const prev = idx > 0 ? openTabs[idx - 1] : openTabs[openTabs.length - 1];
          openTab(prev);
        } else {
          const next = idx < openTabs.length - 1 ? openTabs[idx + 1] : openTabs[0];
          openTab(next);
        }
        return;
      }

      // Ctrl+R → Refresh
      if (ctrl && e.key === 'r') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('aegis:refresh'));
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, setCommandPaletteOpen, commandPaletteOpen, openTabs, activeSessionKey, openTab, closeTab]);
}
