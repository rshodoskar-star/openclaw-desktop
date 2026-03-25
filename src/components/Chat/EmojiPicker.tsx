import { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';
import { getDirection } from '@/i18n';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import clsx from 'clsx';

// ═══════════════════════════════════════════════════════════
// Emoji Picker — premium floating emoji selector
// ═══════════════════════════════════════════════════════════

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiPicker({ onSelect, disabled }: EmojiPickerProps) {
  const { t } = useTranslation();
  const { language, theme } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className={clsx(
          'p-2 rounded-xl transition-colors',
          open
            ? 'bg-aegis-primary/20 text-aegis-primary'
            : 'hover:bg-[rgb(var(--aegis-overlay)/0.04)] text-aegis-text-dim hover:text-aegis-text-muted',
          'disabled:opacity-30'
        )}
        title={t('input.emoji')}
      >
        <Smile size={17} />
      </button>

      {/* Picker Popup */}
      {open && (
        <div className={clsx(
          "absolute bottom-full mb-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200",
          getDirection(language) === 'rtl' ? 'right-0' : 'left-0'
        )}>
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-aegis-menu-border bg-aegis-menu-bg">
            <Picker
              data={data}
              onEmojiSelect={(emoji: any) => {
                onSelect(emoji.native);
                setOpen(false);
              }}
              theme={theme === 'aegis-light' ? 'light' : 'dark'}
              locale={language === 'zh' ? 'zh' : language}
              previewPosition="none"
              skinTonePosition="search"
              maxFrequentRows={2}
              perLine={8}
              navPosition="bottom"
              set="native"
            />
          </div>
        </div>
      )}
    </div>
  );
}
