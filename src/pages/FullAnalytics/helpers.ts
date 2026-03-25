// ═══════════════════════════════════════════════════════════
// FullAnalytics — Formatting utilities, color/icon helpers,
// and export functions (CSV download + clipboard copy)
// ═══════════════════════════════════════════════════════════

import type { DailyEntry, CostTotals, ByAgentEntry, ByModelEntry } from './types';
import { dataColor } from '@/utils/theme-colors';
import i18n from '@/i18n';

/** Format a token count to a human-readable string (k / M / B) */
export function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${Math.round(n / 1_000)}k`;
  return String(n);
}

/** Format a dollar amount to a human-readable string */
export function formatUsd(n: number): string {
  if (n >= 1000) return `$${n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  if (n >= 100)  return `$${n.toFixed(0)}`;
  if (n >= 1)    return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  if (n > 0)     return `$${n.toFixed(4)}`;
  return '$0.00';
}

/** Extract the short model name from a full path like "provider/model-name" */
export function shortModel(model?: string): string {
  return (model || '—').split('/').pop() || '—';
}

/** Map a model name to a distinct color for charts and tables (theme-aware) */
export function getModelColor(model?: string): string {
  const m = (model || '').toLowerCase();
  if (m.includes('opus'))     return dataColor(0);  // primary teal
  if (m.includes('sonnet'))   return dataColor(1);  // blue
  if (m.includes('gemini'))   return dataColor(2);  // yellow
  if (m.includes('flash'))    return dataColor(4);  // orange
  if (m.includes('haiku'))    return dataColor(2);  // yellow
  if (m.includes('gpt'))      return dataColor(5);  // green
  if (m.includes('deepseek')) return dataColor(3);  // purple
  return dataColor(9);                               // grey-teal
}

/** Deterministic color per agent (hash-based, theme-aware) */
export function getAgentColor(agentId: string): string {
  if (agentId === 'main') return dataColor(0);
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) - hash + agentId.charCodeAt(i)) | 0;
  }
  return dataColor(Math.abs(hash) % 10);
}

/** Deterministic emoji icon per agent (hash-based) */
export function getAgentIcon(agentId: string): string {
  if (agentId === 'main') return 'Æ';
  const icons = ['🤖', '🔍', '📦', '⚽', '🧠', '🎯', '📊', '🔧', '🚀', '💡'];
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) - hash + agentId.charCodeAt(i)) | 0;
  }
  return icons[Math.abs(hash) % icons.length];
}

// ─────────────────────────────────────────────────────────────
// Export helpers — CSV download & clipboard copy
// ─────────────────────────────────────────────────────────────

/** Build a CSV string from the filtered daily entries */
export function buildCSV(daily: DailyEntry[], totals: CostTotals): string {
  const header = [
    i18n.t('analytics.csvColDate'),
    i18n.t('analytics.csvColInputTokens'),
    i18n.t('analytics.csvColOutputTokens'),
    i18n.t('analytics.csvColCacheRead'),
    i18n.t('analytics.csvColCacheWrite'),
    i18n.t('analytics.csvColTotalTokens'),
    i18n.t('analytics.csvColCostUsd'),
  ].join(',');
  const rows = [header];
  [...daily]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((d) => {
      rows.push(
        `${d.date},${d.input},${d.output},${d.cacheRead},${d.cacheWrite},${d.totalTokens},${d.totalCost.toFixed(4)}`
      );
    });
  rows.push(
    `${i18n.t('analytics.csvTotal')},-,-,-,-,${totals.totalTokens},${totals.totalCost.toFixed(4)}`
  );
  return rows.join('\n');
}

/** Download the filtered daily data as a .csv file */
export function downloadCSV(daily: DailyEntry[], totals: CostTotals): void {
  const blob = new Blob([buildCSV(daily, totals)], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `full-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface CopyTextParams {
  periodInfo:    { start: string; end: string; days: number };
  totals:        CostTotals;
  sessionsCount: number;
  totalApiCalls: number;
  byAgent:       ByAgentEntry[];
  byModel:       ByModelEntry[];
}

/** Copy a human-readable analytics summary to the clipboard */
export async function copyAnalyticsText({
  periodInfo,
  totals,
  sessionsCount,
  totalApiCalls,
  byAgent,
  byModel,
}: CopyTextParams): Promise<void> {
  const lines = [
    i18n.t('analytics.copyReportTitle', { date: new Date().toLocaleDateString() }),
    i18n.t('analytics.copyPeriod', {
      start: periodInfo.start,
      end: periodInfo.end,
      count: periodInfo.days,
    }),
    '',
    i18n.t('analytics.copyTotalCost', { value: formatUsd(totals.totalCost) }),
    i18n.t('analytics.copyTotalTokens', { value: formatTokens(totals.totalTokens) }),
    i18n.t('analytics.copyInputLine', {
      tokens: formatTokens(totals.input),
      cost: formatUsd(totals.inputCost),
    }),
    i18n.t('analytics.copyOutputLine', {
      tokens: formatTokens(totals.output),
      cost: formatUsd(totals.outputCost),
    }),
    i18n.t('analytics.copyCacheReadLine', {
      tokens: formatTokens(totals.cacheRead),
      cost: formatUsd(totals.cacheReadCost),
    }),
    i18n.t('analytics.copyCacheWriteLine', {
      tokens: formatTokens(totals.cacheWrite),
      cost: formatUsd(totals.cacheWriteCost),
    }),
    i18n.t('analytics.copySessions', { value: sessionsCount.toLocaleString() }),
    i18n.t('analytics.copyApiCalls', { value: totalApiCalls.toLocaleString() }),
    '',
  ];

  if (byAgent.length > 0) {
    lines.push(i18n.t('analytics.copyByAgent'));
    [...byAgent]
      .sort((a, b) => b.totals.totalCost - a.totals.totalCost)
      .forEach((a) => {
        const id = a.agentId === 'main' ? i18n.t('analytics.mainAgent') : a.agentId;
        lines.push(
          i18n.t('analytics.copyAgentLine', {
            id,
            tokens: formatTokens(a.totals.totalTokens),
            cost: formatUsd(a.totals.totalCost),
          })
        );
      });
    lines.push('');
  }

  if (byModel.length > 0) {
    lines.push(i18n.t('analytics.copyByModel'));
    [...byModel]
      .sort((a, b) => b.totals.totalCost - a.totals.totalCost)
      .forEach((m) => {
        const callsLabel = `${m.count} ${i18n.t('analytics.calls')}`;
        lines.push(
          i18n.t('analytics.copyModelLine', {
            model: shortModel(m.model),
            callsLabel,
            tokens: formatTokens(m.totals.totalTokens),
            cost: formatUsd(m.totals.totalCost),
          })
        );
      });
  }

  await navigator.clipboard.writeText(lines.join('\n'));
}
