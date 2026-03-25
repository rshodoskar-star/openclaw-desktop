// ═══════════════════════════════════════════════════════════
// FullAnalytics — Complete OpenClaw usage statistics page
// Composition layer: wires useAnalyticsData hook to sections.
// ═══════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { PageTransition } from '@/components/shared/PageTransition';
import { useChatStore }   from '@/stores/chatStore';

import { useAnalyticsData }   from './useAnalyticsData';
import { downloadCSV, copyAnalyticsText } from './helpers';
import {
  TokenBreakdownSection,
  AgentBreakdownSection,
  ByModelSection,
  DailyBreakdownTable,
  ExportMenu,
  DateRangePicker,
  LoadingSkeleton,
  OverviewCards,
  ChartsSection,
} from './components';

// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────
export function FullAnalyticsPage() {
  const { t }         = useTranslation();
  const { connected } = useChatStore();

  const {
    costData,
    usageData,
    loading,
    error,
    activePreset,
    startDate,
    endDate,
    daily,
    totals,
    sessions,
    byAgent,
    byModel,
    periodInfo,
    totalApiCalls,
    chartData,
    donutData,
    isRefetching,
    savedPreset,
    handlePresetSelect,
    handleApply,
    refresh,
  } = useAnalyticsData();

  const hasData = !!(costData || usageData);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setManualRefreshing(true);
    await refresh();
    setTimeout(() => setManualRefreshing(false), 600);
  }, [refresh]);

  // ── Export action handlers (delegate to helpers.ts) ──
  const handleExportCSV = () => downloadCSV(daily, totals);

  const handleCopyText  = () =>
    copyAnalyticsText({
      periodInfo,
      totals,
      sessionsCount: sessions.length,
      totalApiCalls,
      byAgent,
      byModel,
    });

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  return (
    <PageTransition className="p-6 space-y-5 mx-auto">

      {/* ══ Header ══ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-extrabold text-aegis-text tracking-tight flex items-center gap-3">
            <Activity size={22} className="text-aegis-accent" />
            {t('analytics.title')}
          </h1>
          <p className="text-[12px] text-aegis-text-muted mt-1 flex items-center gap-2">
            {connected ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-aegis-success inline-block animate-pulse" />
                {activePreset === 'all'
                  ? t('analytics.liveData')
                  : t('analytics.liveDataFiltered')}
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-aegis-danger inline-block" />
                {t('analytics.disconnected')}
              </>
            )}
            {periodInfo.days > 0 && (
              <>
                <span className="text-aegis-text-dim">·</span>
                <span className="text-aegis-text-dim font-mono">
                  {t('analytics.daysCount', { count: periodInfo.days })}
                </span>
                <span className="text-aegis-text-dim">·</span>
                <span className="text-aegis-text-dim font-mono">{periodInfo.start}</span>
                <span className="text-aegis-text-dim">→</span>
                <span className="text-aegis-text-dim font-mono">{periodInfo.end}</span>
              </>
            )}
            {startDate && endDate && (
              <>
                <span className="text-aegis-text-dim">·</span>
                <span className="px-2 py-0.5 rounded-md bg-aegis-accent/10 border border-aegis-accent/20 text-aegis-accent/70 text-[10px] font-mono">
                  {startDate} → {endDate}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={manualRefreshing || isRefetching}
            className="p-1.5 rounded-lg hover:bg-[rgb(var(--aegis-overlay)/0.06)] transition-colors"
            title={t('analytics.refresh')}
          >
            <RefreshCw
              size={15}
              className={clsx(
                'text-aegis-text-muted hover:text-aegis-text-secondary transition-colors',
                (manualRefreshing || isRefetching) && 'animate-spin text-aegis-accent'
              )}
            />
          </button>
          <ExportMenu onExportCSV={handleExportCSV} onCopyText={handleCopyText} />
        </div>
      </div>

      {/* ══ Date Range Picker ══ */}
      <DateRangePicker
        activePreset={activePreset}
        savedPreset={savedPreset}
        startDate={startDate}
        endDate={endDate}
        onPresetSelect={handlePresetSelect}
        onApply={handleApply}
      />

      {/* ══ Error banner ══ */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-aegis-danger/15 bg-aegis-danger/[0.04] text-[11px] text-aegis-danger/70">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ══ Missing cost entries warning ══ */}
      {totals.missingCostEntries > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-aegis-warning/15 bg-aegis-warning/[0.04] text-[11px] text-aegis-warning/70">
          <AlertTriangle size={14} className="shrink-0" />
          {t('analytics.missingPricing', { count: totals.missingCostEntries })}
        </div>
      )}

      {/* ══ Loading skeleton (first load only) ══ */}
      {loading && !hasData && <LoadingSkeleton />}

      {/* ══ Main content ══ */}
      {hasData && (
        <>
          {/* ── Section 1: Overview Cards ── */}
          <OverviewCards
            totals={totals}
            sessionsCount={sessions.length}
            totalApiCalls={totalApiCalls}
            byModel={byModel}
            aggregates={usageData?.aggregates}
            periodInfo={periodInfo}
          />

          {/* ── Section 2: Token Breakdown ── */}
          <TokenBreakdownSection totals={totals} />

          {/* ── Section 3: Charts (Daily Cost + Agent Donut) ── */}
          <ChartsSection
            chartData={chartData}
            donutData={donutData}
            totalCost={totals.totalCost}
          />

          {/* ── Section 4: Per-Agent Breakdown ── */}
          <AgentBreakdownSection byAgent={byAgent} totalCost={totals.totalCost} />

          {/* ── Section 5: By Model ── */}
          <ByModelSection byModel={byModel} />

          {/* ── Section 6: Daily Breakdown Table ── */}
          <DailyBreakdownTable daily={daily} />
        </>
      )}

      {/* ── Empty state (connected but no data yet) ── */}
      {!loading && !hasData && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Activity size={40} className="text-aegis-text-dim mb-4" />
          <p className="text-aegis-text-dim text-[14px]">
            {connected
              ? t('analytics.noData')
              : t('analytics.connectFirst')}
          </p>
        </div>
      )}
    </PageTransition>
  );
}
