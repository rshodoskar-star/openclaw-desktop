// ═══════════════════════════════════════════════════════════
// DailyBreakdownTable — Sortable daily usage table
// FIX: maxDaily now computed once before the map (was recomputed per row)
// FIX: removed unused `topAgent` dead code
// ═══════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '@/components/shared/GlassCard';
import { dataColor } from '@/utils/theme-colors';
import { type DailyEntry } from '../types';
import { formatTokens, formatUsd } from '../helpers';

interface DailyBreakdownTableProps {
  daily: DailyEntry[];
}

export function DailyBreakdownTable({ daily }: DailyBreakdownTableProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);

  // Show last 14 by default, all when expanded
  const sorted = useMemo(() => {
    const list = [...daily].sort((a, b) =>
      sortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
    );
    return expanded ? list : list.slice(0, 14);
  }, [daily, expanded, sortDesc]);

  if (daily.length === 0) return null;

  // Compute maxDaily once — used to colour-code cost cells (high/mid/low)
  const maxDaily = Math.max(...daily.map((d) => d.totalCost), 0.001);

  return (
    <GlassCard delay={0.35}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-aegis-warning" />
          <span className="text-[10px] text-aegis-text-dim uppercase tracking-widest font-bold">
            {t('analytics.dailyBreakdown')}
          </span>
          <span className="text-[9px] text-aegis-text-dim font-mono">
            {t('analytics.dailyDaysParen', { count: daily.length })}
          </span>
        </div>
        {/* Sort toggle */}
        <button
          onClick={() => setSortDesc(!sortDesc)}
          className="flex items-center gap-1 text-[10px] text-aegis-text-muted hover:text-aegis-text-secondary transition-colors"
        >
          {sortDesc ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          {sortDesc ? t('analytics.newest') : t('analytics.oldest')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgb(var(--aegis-overlay)/0.06)]">
              <th className="text-start text-[9px] text-aegis-text-dim uppercase tracking-wider font-bold pb-2 ps-2">
                {t('analytics.tblDate')}
              </th>
              <th className="text-end text-[9px] text-aegis-text-dim uppercase tracking-wider font-bold pb-2">
                {t('analytics.labelInput')}
              </th>
              <th className="text-end text-[9px] text-aegis-text-dim uppercase tracking-wider font-bold pb-2">
                {t('analytics.labelOutput')}
              </th>
              <th className="text-end text-[9px] text-aegis-text-dim uppercase tracking-wider font-bold pb-2">
                {t('analytics.cacheRead')}
              </th>
              <th className="text-end text-[9px] text-aegis-text-dim uppercase tracking-wider font-bold pb-2">
                {t('analytics.cacheWrite')}
              </th>
              <th className="text-end text-[9px] text-aegis-text-dim uppercase tracking-wider font-bold pb-2">
                {t('analytics.tblTotalTokens')}
              </th>
              <th className="text-end text-[9px] text-aegis-text-dim uppercase tracking-wider font-bold pb-2 pe-2">
                {t('analytics.tblCost')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((day) => {
              // Color-scale: higher cost = more intense colour (maxDaily computed outside)
              const intensity = day.totalCost / maxDaily;
              const costColor =
                intensity > 0.7 ? dataColor(4) :
                intensity > 0.4 ? dataColor(2) :
                dataColor(0);

              return (
                <tr
                  key={day.date}
                  className="border-b border-[rgb(var(--aegis-overlay)/0.02)] hover:bg-[rgb(var(--aegis-overlay)/0.02)] transition-colors"
                >
                  <td className="py-2.5 ps-2">
                    <span className="text-[11px] font-mono text-aegis-text-secondary">{day.date}</span>
                  </td>
                  <td className="py-2.5 text-end text-[10px] text-aegis-accent/60 font-mono">
                    {formatTokens(day.input)}
                  </td>
                  <td className="py-2.5 text-end text-[10px] text-aegis-primary/60 font-mono">
                    {formatTokens(day.output)}
                  </td>
                  <td className="py-2.5 text-end text-[10px] text-aegis-success/50 font-mono">
                    {day.cacheRead > 0 ? formatTokens(day.cacheRead) : '—'}
                  </td>
                  <td className="py-2.5 text-end text-[10px] text-aegis-warning/40 font-mono">
                    {day.cacheWrite > 0 ? formatTokens(day.cacheWrite) : '—'}
                  </td>
                  <td className="py-2.5 text-end text-[10px] text-aegis-text-muted font-mono">
                    {formatTokens(day.totalTokens)}
                  </td>
                  <td className="py-2.5 text-end pe-2">
                    <span className="text-[11px] font-mono font-bold" style={{ color: costColor }}>
                      {formatUsd(day.totalCost)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Footer totals row */}
          <tfoot>
            <tr className="border-t border-[rgb(var(--aegis-overlay)/0.06)]">
              <td className="py-2.5 ps-2 text-[10px] font-bold text-aegis-text-muted">
                {t('analytics.totalWithDays', { count: daily.length })}
              </td>
              <td className="py-2.5 text-end text-[10px] font-mono font-bold text-aegis-accent/70">
                {formatTokens(daily.reduce((s, d) => s + d.input, 0))}
              </td>
              <td className="py-2.5 text-end text-[10px] font-mono font-bold text-aegis-primary/70">
                {formatTokens(daily.reduce((s, d) => s + d.output, 0))}
              </td>
              <td className="py-2.5 text-end text-[10px] font-mono font-bold text-aegis-success/60">
                {formatTokens(daily.reduce((s, d) => s + d.cacheRead, 0))}
              </td>
              <td className="py-2.5 text-end text-[10px] font-mono font-bold text-aegis-warning/50">
                {formatTokens(daily.reduce((s, d) => s + d.cacheWrite, 0))}
              </td>
              <td className="py-2.5 text-end text-[10px] font-mono font-bold text-aegis-text-secondary">
                {formatTokens(daily.reduce((s, d) => s + d.totalTokens, 0))}
              </td>
              <td className="py-2.5 text-end pe-2 text-[11px] font-mono font-bold text-aegis-text">
                {formatUsd(daily.reduce((s, d) => s + d.totalCost, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Show more / less toggle */}
      {daily.length > 14 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 py-2 text-[11px] text-aegis-text-dim hover:text-aegis-text-muted transition-colors border-t border-[rgb(var(--aegis-overlay)/0.04)] flex items-center justify-center gap-1"
        >
          {expanded ? (
            <><ChevronUp size={12} /> {t('analytics.showLess')}</>
          ) : (
            <>
              <ChevronDown size={12} />
              {t('analytics.showAll', { count: daily.length })}
            </>
          )}
        </button>
      )}
    </GlassCard>
  );
}
