// ═══════════════════════════════════════════════════════════
// OverviewCards — Five top-level stat cards for FullAnalytics
// (Total Cost, Total Tokens, Sessions, API Calls, Days of Data)
// ═══════════════════════════════════════════════════════════

import { useTranslation } from 'react-i18next';
import { type CostTotals, type UsageAggregates, type ByModelEntry } from '../types';
import { formatTokens, formatUsd } from '../helpers';
import { BigStatCard } from './BigStatCard';
import { themeHex, dataColor } from '@/utils/theme-colors';

interface OverviewCardsProps {
  totals:        CostTotals;
  sessionsCount: number;
  totalApiCalls: number;
  byModel:       ByModelEntry[];
  aggregates:    UsageAggregates | undefined;
  periodInfo:    { start: string; end: string; days: number };
}

export function OverviewCards({
  totals,
  sessionsCount,
  totalApiCalls,
  byModel,
  aggregates,
  periodInfo,
}: OverviewCardsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-5 gap-3">
      {/* Total Cost */}
      <BigStatCard
        iconEmoji="💰"
        value={totals.totalCost}
        label={t('analytics.totalCost')}
        color={themeHex('accent')}
        prefix="$"
        decimals={2}
        delay={0}
        sub={t('analytics.subInOutCost', {
          input: formatUsd(totals.inputCost),
          output: formatUsd(totals.outputCost),
        })}
        sub2={totals.cacheReadCost > 0
          ? t('analytics.subCacheUsd', {
              value: formatUsd(totals.cacheReadCost + totals.cacheWriteCost),
            })
          : undefined}
      />

      {/* Total Tokens */}
      <BigStatCard
        iconEmoji="⚡"
        value={formatTokens(totals.totalTokens)}
        label={t('analytics.totalTokens')}
        color={themeHex('warning')}
        decimals={0}
        delay={0.05}
        sub={t('analytics.subInOutTokens', {
          input: formatTokens(totals.input),
          output: formatTokens(totals.output),
        })}
        sub2={totals.cacheRead > 0
          ? t('analytics.subCacheTokens', { value: formatTokens(totals.cacheRead) })
          : undefined}
      />

      {/* Sessions */}
      <BigStatCard
        iconEmoji="📦"
        value={sessionsCount}
        label={t('analytics.sessions')}
        color={dataColor(4)}
        decimals={0}
        delay={0.1}
        sub={aggregates
          ? t('analytics.messagesCount', {
              count: aggregates.messages.total.toLocaleString(),
            })
          : undefined}
      />

      {/* API Calls */}
      <BigStatCard
        iconEmoji="💬"
        value={totalApiCalls}
        label={t('analytics.apiCalls')}
        color={themeHex('primary')}
        decimals={0}
        delay={0.15}
        sub={byModel.length > 0 ? t('analytics.modelsUsed', { count: byModel.length }) : undefined}
      />

      {/* Days of Data */}
      <BigStatCard
        iconEmoji="📅"
        value={periodInfo.days}
        label={t('analytics.periodDays')}
        color={dataColor(6)}
        decimals={0}
        delay={0.2}
        sub={periodInfo.start !== '—' ? periodInfo.start : undefined}
        sub2={periodInfo.end !== '—' ? t('analytics.periodToEnd', { end: periodInfo.end }) : undefined}
      />
    </div>
  );
}
