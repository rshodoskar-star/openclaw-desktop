// ═══════════════════════════════════════════════════════════
// ThinkingBubble — Collapsible reasoning/thinking display
//
// Two modes:
//   1. Live streaming — expanded, shimmer border, text updating real-time
//   2. Finalized — collapsed by default, click to expand
//
// Matches OpenClaw Station design system (glass, subtle colors)
// ═══════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface ThinkingBubbleProps {
  /** Full thinking/reasoning text */
  content: string;
  /** Whether this is actively streaming (live mode) */
  isStreaming?: boolean;
}

export function ThinkingBubble({ content, isStreaming = false }: ThinkingBubbleProps) {
  const { t } = useTranslation();
  // Live mode: always expanded | Finalized: collapsed by default
  const [expanded, setExpanded] = useState(isStreaming);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-expand when streaming starts, auto-collapse when it ends
  useEffect(() => {
    if (isStreaming) setExpanded(true);
    else setExpanded(false);
  }, [isStreaming]);

  // Auto-scroll to bottom of thinking content while streaming
  useEffect(() => {
    if (isStreaming && expanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming, expanded]);

  if (!content) return null;

  const lineCount = content.split('\n').length;
  const charCount = content.length;

  // ── Finalized: tiny inline pill ──
  if (!isStreaming && !expanded) {
    return (
      <div className="px-14 mb-1">
        <button
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full
            bg-[rgb(var(--aegis-overlay)/0.03)] hover:bg-[rgb(var(--aegis-overlay)/0.06)]
            border border-[rgb(var(--aegis-overlay)/0.05)] hover:border-[rgb(var(--aegis-overlay)/0.10)]
            transition-all group"
        >
          <Brain size={10} className="text-aegis-text-dim/40 group-hover:text-aegis-text-dim/70 transition-colors" />
          <span className="text-[9px] text-aegis-text-dim/40 group-hover:text-aegis-text-dim/70 font-mono transition-colors">
            {lineCount}L · {charCount > 1000 ? `${(charCount / 1000).toFixed(1)}k` : charCount}c
          </span>
        </button>
      </div>
    );
  }

  // ── Streaming or Expanded ──
  return (
    <div className="px-14 mb-1">
      <div
        className={clsx(
          'rounded-xl border transition-all duration-300 overflow-hidden',
          isStreaming
            ? 'border-aegis-accent/20 bg-aegis-accent/[0.02] thinking-shimmer'
            : 'border-[rgb(var(--aegis-overlay)/0.06)] bg-[rgb(var(--aegis-overlay)/0.015)]',
        )}
      >
        {/* Header */}
        <button
          onClick={() => !isStreaming && setExpanded(false)}
          className={clsx(
            'w-full flex items-center gap-2 px-3.5 py-2 text-start transition-colors',
            !isStreaming && 'cursor-pointer hover:bg-[rgb(var(--aegis-overlay)/0.02)]',
            isStreaming && 'cursor-default',
          )}
        >
          <Brain
            size={13}
            className={clsx(
              'shrink-0 transition-colors',
              isStreaming ? 'text-aegis-accent animate-pulse' : 'text-aegis-text-dim',
            )}
          />
          <span className={clsx(
            'text-[11px] font-semibold tracking-wide',
            isStreaming ? 'text-aegis-accent/70' : 'text-aegis-text-dim',
          )}>
            {isStreaming ? t('thinking.thinking') : t('thinking.thoughtProcess')}
          </span>

          {isStreaming && (
            <span className="flex items-center gap-1 ms-auto">
              <span className="w-1 h-1 rounded-full bg-aegis-accent animate-pulse" />
              <span className="w-1 h-1 rounded-full bg-aegis-accent animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span className="w-1 h-1 rounded-full bg-aegis-accent animate-pulse" style={{ animationDelay: '0.4s' }} />
            </span>
          )}

          {!isStreaming && (
            <ChevronDown size={12} className="ms-auto shrink-0 text-aegis-text-dim/40 rotate-180" />
          )}
        </button>

        {/* Content */}
        <div className="border-t border-[rgb(var(--aegis-overlay)/0.04)]">
          <div
            ref={contentRef}
            className={clsx(
              'px-3.5 py-2.5 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words overflow-y-auto',
              isStreaming ? 'text-aegis-text-muted/70 max-h-[300px]' : 'text-aegis-text-dim/60 max-h-[400px]',
            )}
          >
            {content}
            {isStreaming && (
              <span className="inline-block w-[2px] h-[13px] bg-aegis-accent/50 ms-0.5 align-text-bottom animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
