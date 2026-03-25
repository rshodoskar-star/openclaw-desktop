// ═══════════════════════════════════════════════════════════
// DateRangePicker — Quick preset buttons + custom date inputs
//
// UX:
//   • Clicking a preset changes the view immediately (volatile).
//   • Clicking "Apply" saves the current selection to localStorage.
//   • Apply is enabled whenever the current preset differs from
//     the saved preference, or when custom dates are entered.
//   • Works for ALL presets including "All Time" (no empty-date guard).
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import { Calendar, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '@/components/shared/GlassCard';
import clsx from 'clsx';
import { type DateRangePickerProps, type PresetId } from '../types';

/** Format a Date to YYYY-MM-DD */
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function DateRangePicker({
  activePreset,
  savedPreset,
  startDate,
  endDate,
  onPresetSelect,
  onApply,
}: DateRangePickerProps) {
  const { t } = useTranslation();
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd,   setCustomEnd]   = useState(endDate);

  const presets: {
    id: PresetId;
    label: string;
    getRange: () => { start: string; end: string };
  }[] = [
    {
      id: 'today',
      label: t('analytics.today'),
      getRange: () => {
        const d = fmtDate(new Date());
        return { start: d, end: d };
      },
    },
    {
      id: '7d',
      label: t('analytics.last7Days'),
      getRange: () => {
        const now   = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - 6);
        return { start: fmtDate(start), end: fmtDate(now) };
      },
    },
    {
      id: 'thisMonth',
      label: t('analytics.thisMonth'),
      getRange: () => {
        const now = new Date();
        return {
          start: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)),
          end:   fmtDate(now),
        };
      },
    },
    {
      id: '30d',
      label: t('analytics.last30Days'),
      getRange: () => {
        const now   = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - 29);
        return { start: fmtDate(start), end: fmtDate(now) };
      },
    },
    {
      id: '90d',
      label: t('analytics.last90Days'),
      getRange: () => {
        const now   = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - 89);
        return { start: fmtDate(start), end: fmtDate(now) };
      },
    },
    {
      id: 'all',
      label: t('analytics.allTime'),
      getRange: () => ({ start: '', end: '' }),
    },
  ];

  // ── Preset click: change view immediately ──
  const handlePreset = (preset: (typeof presets)[0]) => {
    const { start, end } = preset.getRange();
    setCustomStart(start);
    setCustomEnd(end);
    onPresetSelect(preset.id, start, end);
  };

  // ── Apply button logic ──
  // Enabled when: user entered custom dates OR selected a different preset than saved
  const hasCustomDates =
    !!(customStart && customEnd) &&
    (activePreset !== 'custom' ||
      customStart !== startDate ||
      customEnd !== endDate);

  const hasUnsavedPreset = activePreset !== savedPreset;

  const applyEnabled = hasCustomDates || hasUnsavedPreset;

  const handleApply = () => {
    if (hasCustomDates) {
      // Custom dates: apply view + save
      onApply(customStart, customEnd);
    } else {
      // Preset: just save the current selection
      onApply();
    }
  };

  return (
    <GlassCard delay={0}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Label */}
        <div className="flex items-center gap-2 text-aegis-text-muted shrink-0">
          <Calendar size={13} />
          <span className="text-[10px] uppercase tracking-widest font-bold">
            {t('analytics.dateRange')}
          </span>
        </div>

        {/* Quick preset buttons */}
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePreset(p)}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border',
                activePreset === p.id
                  ? 'bg-aegis-accent/15 border-aegis-accent/30 text-aegis-accent'
                  : 'bg-[rgb(var(--aegis-overlay)/0.03)] border-[rgb(var(--aegis-overlay)/0.06)] text-aegis-text-muted hover:text-aegis-text-secondary hover:bg-[rgb(var(--aegis-overlay)/0.05)]'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-[rgb(var(--aegis-overlay)/0.08)] shrink-0 hidden sm:block" />

        {/* Custom date inputs */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-2 py-1 rounded-lg bg-[rgb(var(--aegis-overlay)/0.04)] border border-[rgb(var(--aegis-overlay)/0.08)] text-[11px] text-aegis-text-secondary focus:outline-none focus:border-aegis-accent/40 focus:bg-[rgb(var(--aegis-overlay)/0.06)] transition-colors"
            style={{ colorScheme: 'dark' }}
          />
          <span className="text-aegis-text-dim text-[11px] shrink-0">→</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-2 py-1 rounded-lg bg-[rgb(var(--aegis-overlay)/0.04)] border border-[rgb(var(--aegis-overlay)/0.08)] text-[11px] text-aegis-text-secondary focus:outline-none focus:border-aegis-accent/40 focus:bg-[rgb(var(--aegis-overlay)/0.06)] transition-colors"
            style={{ colorScheme: 'dark' }}
          />

          {/* Apply — enabled for any unsaved change (preset or custom dates) */}
          <button
            onClick={handleApply}
            disabled={!applyEnabled}
            className={clsx(
              'px-3 py-1 rounded-lg text-[11px] font-semibold border transition-all shrink-0 flex items-center gap-1.5',
              applyEnabled
                ? 'bg-aegis-accent/15 border-aegis-accent/30 text-aegis-accent hover:bg-aegis-accent/25'
                : 'bg-[rgb(var(--aegis-overlay)/0.02)] border-[rgb(var(--aegis-overlay)/0.04)] text-aegis-text-dim cursor-not-allowed'
            )}
          >
            <Save size={11} />
            {t('analytics.apply')}
          </button>
        </div>

        {/* Active range label (shown when a range is selected) */}
        {activePreset !== 'all' && startDate && endDate && (
          <div className="ms-auto text-[10px] text-aegis-text-dim font-mono shrink-0">
            {startDate} → {endDate}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
