// ═══════════════════════════════════════════════════════════
// Dashboard — OpenClaw Station (Cost-First Design)
// Sections: Top Bar → Hero Cards → Chart + Agents → Actions
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
// Note: useCallback still needed for handleRefresh/handleQuickAction
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Heart, Mail, Calendar, RefreshCw, BarChart3, FileText,
  Wifi, WifiOff, Bot, Shield, Activity, Zap, ChevronRight,
  TrendingUp, TrendingDown, DollarSign, Cpu,
} from 'lucide-react';
import { GlassCard } from '@/components/shared/GlassCard';
import { PageTransition } from '@/components/shared/PageTransition';
import { StatusDot } from '@/components/shared/StatusDot';
import { Sparkline } from '@/components/shared/Sparkline';
import { useChatStore } from '@/stores/chatStore';
import { useGatewayDataStore, refreshAll } from '@/stores/gatewayDataStore';
import clsx from 'clsx';
import { themeHex, themeAlpha, dataColor } from '@/utils/theme-colors';

import {
  ContextRing, QuickAction, SessionItem, FeedItem, AgentItem,
  fmtTokens, fmtCost, fmtCostShort, timeAgo, fmtUptime,
} from './components';

// ── Agent emoji + display name helpers ───────────────────────

const AGENT_EMOJIS: Record<string, string> = {
  main:       'Æ',
  hilali:     '⚽',
  pipeline:   '📦',
  researcher: '🔍',
  consultant: '💡',
  coder:      '💻',
};

const getAgentEmoji = (id: string) =>
  AGENT_EMOJIS[id.toLowerCase()] ?? '🤖';

const getAgentName = (id: string) => {
  const names: Record<string, string> = {
    main: 'Main Agent', hilali: 'Hilali', pipeline: 'Pipeline',
    researcher: 'Researcher', consultant: 'Consultant', coder: 'Coder',
  };
  return names[id.toLowerCase()] ?? id;
};

// ── Tooltip for recharts ─────────────────────────────────────

function CostTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const input  = payload.find((p: any) => p.dataKey === 'input')?.value  || 0;
  const output = payload.find((p: any) => p.dataKey === 'output')?.value || 0;
  return (
    <div className="bg-aegis-card border border-aegis-border rounded-xl p-2.5 text-[11px] shadow-lg">
      <div className="text-aegis-text-dim font-mono mb-1.5">{label}</div>
      <div className="flex items-center gap-1.5 text-aegis-accent">
        <span className="w-2 h-2 rounded-full bg-aegis-accent" />
        Input: {fmtCost(input)}
      </div>
      <div className="flex items-center gap-1.5 text-aegis-primary">
        <span className="w-2 h-2 rounded-full bg-aegis-primary" />
        Output: {fmtCost(output)}
      </div>
      <div className="text-aegis-text font-semibold mt-1.5 pt-1.5 border-t border-[rgb(var(--aegis-overlay)/0.06)]">
        Total: {fmtCost(input + output)}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// DashboardPage — Main component
// ════════════════════════════════════════════════════════════
export function DashboardPage() {
  const { t }      = useTranslation();
  const navigate   = useNavigate();
  const { connected, tokenUsage } = useChatStore();

  // ── Data from central store ─────────────────────────────────
  const sessions  = useGatewayDataStore((s) => s.sessions);
  const costData  = useGatewayDataStore((s) => s.costSummary);
  const usageData = useGatewayDataStore((s) => s.sessionsUsage);

  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const connectedSince = useRef<number | null>(null);

  // Track connection uptime
  useEffect(() => {
    if (connected && !connectedSince.current)  connectedSince.current = Date.now();
    if (!connected)                             connectedSince.current = null;
  }, [connected]);

  // Agent status derived from sessions
  const agentStatus: 'idle' | 'working' | 'offline' = useMemo(() => {
    if (!connected) return 'offline';
    const main = sessions.find((s: any) => s.key === 'agent:main:main');
    return main?.running ? 'working' : 'idle';
  }, [connected, sessions]);

  // ── Manual Refresh ──────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAll();
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // ── Quick Actions ────────────────────────────────────────────
  const handleQuickAction = (action: string) => {
    setQuickActionLoading(action);
    const messages: Record<string, string> = {
      heartbeat: 'Run a quick heartbeat check — emails, calendar, anything urgent?',
      emails:    'Check my unread emails and summarize anything important.',
      calendar:  "What's on my calendar today and tomorrow?",
      compact:   'Compact the main session context',
      status:    'Give me a full system status report',
      summary:   'Summarize what we discussed in this session',
    };
    if (messages[action]) {
      window.dispatchEvent(new CustomEvent('aegis:quick-action', {
        detail: { message: messages[action], autoSend: true },
      }));
    }
    setTimeout(() => setQuickActionLoading(null), 2000);
  };

  // ── Derived values ───────────────────────────────────────────

  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const monthKey  = today.slice(0, 7); // "YYYY-MM"

  const allDaily: any[] = useMemo(() => costData?.daily || [], [costData]);

  // Today's cost + change vs yesterday
  const todayCost = useMemo(
    () => allDaily.find((d: any) => d.date === today)?.totalCost || 0,
    [allDaily, today]
  );
  const yesterdayCost = useMemo(
    () => allDaily.find((d: any) => d.date === yesterday)?.totalCost || 0,
    [allDaily, yesterday]
  );
  const changePercent = yesterdayCost > 0
    ? ((todayCost - yesterdayCost) / yesterdayCost) * 100
    : 0;

  // This month's total cost
  const monthCost = useMemo(
    () => allDaily
      .filter((d: any) => d.date.startsWith(monthKey))
      .reduce((sum: number, d: any) => sum + d.totalCost, 0),
    [allDaily, monthKey]
  );

  // Sparklines: last 7 and last 30 days (oldest → newest)
  const spark7 = useMemo(() => {
    const sorted = [...allDaily].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-7).map((d: any) => d.totalCost);
  }, [allDaily]);

  const spark30 = useMemo(() => {
    const sorted = [...allDaily].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-30).map((d: any) => d.totalCost);
  }, [allDaily]);

  // Tokens today (from daily cost data)
  const todayEntry   = useMemo(() => allDaily.find((d: any) => d.date === today), [allDaily, today]);
  const tokensIn     = todayEntry?.input  || 0;
  const tokensOut    = todayEntry?.output || 0;
  const tokensToday  = tokensIn + tokensOut;

  // Context usage from main session
  const mainSession  = sessions.find((s: any) => s.key === 'agent:main:main');
  const mainModel    = mainSession?.model || '—';
  const shortModel   = mainModel.split('/').pop() || mainModel;
  const usagePct     = tokenUsage?.percentage || 0;
  const ctxUsed      = mainSession?.totalTokens   || 0;
  const ctxMax       = mainSession?.contextTokens || 200_000;

  // Active sessions + sub sessions
  const activeSessions = useMemo(
    () => sessions.filter((s: any) => (s.totalTokens || 0) > 0),
    [sessions]
  );
  const subSessions = useMemo(
    () => activeSessions
      .filter((s: any) => s.key !== 'agent:main:main')
      .sort((a: any, b: any) => (b.totalTokens || 0) - (a.totalTokens || 0))
      .slice(0, 4),
    [activeSessions]
  );

  // Chart data: last 14 days (oldest first)
  const chartData = useMemo(() => {
    const sorted = [...allDaily]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
    return sorted.map((d: any) => ({
      date:   d.date.slice(5),       // MM-DD
      input:  d.inputCost  || 0,
      output: d.outputCost || 0,
    }));
  }, [allDaily]);

  // Agent list from usageData
  const agentList = useMemo(() => {
    const raw: any[] = usageData?.aggregates?.byAgent || [];
    return raw
      .filter((a: any) => a.totals?.totalCost >= 0)
      .sort((a: any, b: any) => (b.totals?.totalCost || 0) - (a.totals?.totalCost || 0));
  }, [usageData]);

  const maxAgentCost = useMemo(
    () => Math.max(...agentList.map((a: any) => a.totals?.totalCost || 0), 0.01),
    [agentList]
  );

  // Uptime
  const uptime = connectedSince.current ? Date.now() - connectedSince.current : 0;

  // Activity feed items
  const feedItems = useMemo(() => {
    const items: { color: string; text: string; time: string }[] = [];
    activeSessions.slice(0, 6).forEach((s: any) => {
      const key    = s.key || 'unknown';
      const isMain = key === 'agent:main:main';
      const label  = isMain ? 'Main Session'
        : key.includes('#') ? `#${key.split('#')[1]}`
        : s.label || key.split(':').pop() || key;
      items.push({
        color: isMain ? themeHex('primary') : themeHex('accent'),
        text:  `${label} — ${fmtTokens(s.totalTokens || 0)} tokens`,
        time:  timeAgo(s.lastActive),
      });
    });
    const totalCompactions = sessions.reduce((n: number, s: any) => n + (s.compactions || 0), 0);
    if (totalCompactions > 0) {
      items.unshift({ color: themeHex('warning'), text: t('dashboardExtra.contextCompacted', { n: totalCompactions }), time: '—' });
    }
    return items;
  }, [activeSessions, sessions]);

  // ── Render ───────────────────────────────────────────────────
  return (
    <PageTransition className="p-5 space-y-4 mx-auto overflow-y-auto h-full">

      {/* ════ SECTION 1: TOP BAR ════ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ boxShadow: [
              `0 0 10px ${themeAlpha('primary', 0.1)}`,
              `0 0 22px ${themeAlpha('primary', 0.2)}`,
              `0 0 10px ${themeAlpha('primary', 0.1)}`,
            ]}}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-aegis-primary/15 to-aegis-primary/5 border border-aegis-primary/20 flex items-center justify-center"
          >
            <Shield size={20} className="text-aegis-primary" />
          </motion.div>
          <div>
            <h1 className="text-[18px] font-bold text-aegis-text tracking-tight">
              {t('dashboard.title')}
            </h1>
            <p className="text-[11px] text-aegis-text-dim">{t('dashboard.commandCenter')}</p>
          </div>
        </div>

        {/* Status + meta info */}
        <div className="flex items-center gap-3">
          {/* Uptime + version (desktop only) */}
          <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono text-aegis-text-muted">
            <span>{t('dashboard.uptime')}: <span className="text-aegis-text">{fmtUptime(uptime)}</span></span>
            <span className="opacity-30">·</span>
            <span>{shortModel !== '—' ? shortModel : t('dashboard.model')}</span>
          </div>

          {/* Status badge */}
          <div className={clsx(
            'flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[11px] font-semibold',
            connected
              ? 'bg-aegis-primary/[0.06] border-aegis-primary/20 text-aegis-primary'
              : 'bg-aegis-danger-surface border-aegis-danger/20 text-aegis-danger'
          )}>
            <StatusDot
              status={connected ? (agentStatus === 'working' ? 'active' : 'idle') : 'error'}
              size={6}
              beacon={agentStatus === 'working'}
            />
            {connected
              ? (agentStatus === 'working' ? t('dashboard.working') : t('dashboard.idle'))
              : t('dashboard.offline')
            }
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg hover:bg-[rgb(var(--aegis-overlay)/0.06)] transition-colors"
            title={t('dashboard.refresh', 'Refresh')}
          >
            <RefreshCw
              size={15}
              className={clsx(
                'text-aegis-text-muted hover:text-aegis-text transition-colors',
                refreshing && 'animate-spin text-aegis-primary'
              )}
            />
          </button>

          {/* Connectivity icon */}
          {connected
            ? <Wifi size={15} className="text-aegis-success" />
            : <WifiOff size={15} className="text-aegis-danger" />
          }
        </div>
      </div>

      {/* ════ SECTION 2: HERO CARDS (4 columns) ════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* 💰 Today's Cost */}
        <GlassCard delay={0.05} className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[10.5px] text-aegis-text-muted font-medium">
            <DollarSign size={13} className="text-aegis-primary" />
            {t('dashboard.todayCost')}
          </div>
          <div className="text-[22px] font-bold text-aegis-text leading-none tracking-tight">
            {fmtCostShort(todayCost)}
          </div>
          <div className={clsx(
            'flex items-center gap-1 text-[11px] font-semibold',
            changePercent <= 0 ? 'text-aegis-success' : 'text-aegis-danger'
          )}>
            {changePercent <= 0
              ? <TrendingDown size={12} />
              : <TrendingUp   size={12} />
            }
            {Math.abs(changePercent).toFixed(0)}% {t('dashboard.vsYesterday')}
          </div>
          {spark7.length > 0 && (
            <Sparkline data={spark7} color={themeHex('primary')} width={120} height={30} />
          )}
        </GlassCard>

        {/* 📅 This Month */}
        <GlassCard delay={0.08} className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[10.5px] text-aegis-text-muted font-medium">
            <BarChart3 size={13} className="text-aegis-accent" />
            {t('dashboard.thisMonth')}
          </div>
          <div className="text-[22px] font-bold text-aegis-text leading-none tracking-tight">
            {fmtCostShort(monthCost)}
          </div>
          <div className="text-[11px] text-aegis-text-dim">
            {t('dashboard.monthBudget')}
          </div>
          {spark30.length > 0 && (
            <Sparkline data={spark30} color={themeHex('accent')} width={120} height={30} />
          )}
        </GlassCard>

        {/* ⚡ Tokens Today */}
        <GlassCard delay={0.11} className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[10.5px] text-aegis-text-muted font-medium">
            <Zap size={13} className="text-aegis-warning" />
            {t('dashboard.tokensToday')}
          </div>
          <div className="text-[22px] font-bold text-aegis-text leading-none tracking-tight">
            {fmtTokens(tokensToday)}
          </div>
          <div className="text-[10px] text-aegis-text-muted font-mono space-y-0.5">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-aegis-accent" />
              {t('dashboard.tokensIn')}:  {fmtTokens(tokensIn)}
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-aegis-primary" />
              {t('dashboard.tokensOut')}: {fmtTokens(tokensOut)}
            </div>
          </div>
        </GlassCard>

        {/* 🧠 Context */}
        <GlassCard delay={0.14} className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[10.5px] text-aegis-text-muted font-medium">
            <Cpu size={13} className="text-aegis-danger" />
            {t('dashboard.contextCard')}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <ContextRing percentage={usagePct} />
            <div className="text-[10px] text-aegis-text-muted font-mono space-y-1">
              <div>{fmtTokens(ctxUsed)} used</div>
              <div className="text-aegis-text-dim">/ {fmtTokens(ctxMax)} max</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ════ SECTION 3: MIDDLE ROW (Chart + Agents) ════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-3">

        {/* Daily Cost Chart */}
        <GlassCard delay={0.16}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-aegis-primary" />
              <span className="text-[13px] font-semibold text-aegis-text">{t('dashboard.dailyCostChart')}</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-aegis-text-muted font-medium">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-aegis-accent" />{t('dashboard.inputCostLabel')}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-aegis-primary" />{t('dashboard.outputCostLabel')}</span>
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gInput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={themeHex('accent')} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={themeHex('accent')} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOutput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={themeHex('primary')} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={themeHex('primary')} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--aegis-overlay) / 0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgb(var(--aegis-text-dim))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'rgb(var(--aegis-text-dim))' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v === 0 ? '' : `$${v.toFixed(2)}`} />
                <Tooltip content={<CostTooltip />} cursor={{ stroke: 'rgb(var(--aegis-overlay) / 0.06)' }} />
                <Area type="monotone" dataKey="input"  stackId="1"
                  stroke={themeHex('accent')} strokeWidth={1.5} fill="url(#gInput)" />
                <Area type="monotone" dataKey="output" stackId="1"
                  stroke={themeHex('primary')} strokeWidth={1.5} fill="url(#gOutput)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[160px] flex items-center justify-center text-[12px] text-aegis-text-dim">
              {connected ? t('common.loading') : t('dashboard.notConnected')}
            </div>
          )}
        </GlassCard>

        {/* Active Agents */}
        <GlassCard delay={0.18}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bot size={15} className="text-aegis-accent" />
              <span className="text-[13px] font-semibold text-aegis-text">{t('dashboard.activeAgents')}</span>
            </div>
            <button
              onClick={() => navigate('/agents')}
              className="flex items-center gap-0.5 text-[10px] text-aegis-primary hover:underline"
            >
              {t('dashboard.viewAll')}
              <ChevronRight size={12} />
            </button>
          </div>

          <div className="space-y-0">
            {agentList.length > 0 ? (
              agentList.slice(0, 5).map((a: any) => {
                const id      = a.agentId || 'unknown';
                const cost    = a.totals?.totalCost || 0;
                const model   = (a.totals?.model || usageData?.aggregates?.byModel?.find(
                  (m: any) => m) ?.model || '').split('/').pop() || '—';
                return (
                  <AgentItem
                    key={id}
                    emoji={getAgentEmoji(id)}
                    name={getAgentName(id)}
                    model={model}
                    cost={fmtCost(cost)}
                    costToday={cost}
                    maxCost={maxAgentCost}
                    isFree={cost === 0}
                  />
                );
              })
            ) : (
              <div className="text-[11px] text-aegis-text-dim text-center py-8">
                {connected ? t('dashboard.noAgentData') : t('dashboard.notConnected')}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* ════ SECTION 4: BOTTOM ROW (3 columns) ════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* ── Quick Actions ── */}
        <GlassCard delay={0.20}>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={15} className="text-aegis-accent" />
            <span className="text-[13px] font-semibold text-aegis-text">{t('dashboard.quickActions')}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <QuickAction icon={Heart}    label={t('dashboard.runHeartbeat')}
              glowColor={themeAlpha('danger', 0.08)} bgColor={themeAlpha('danger', 0.1)} iconColor={themeHex('danger')}
              onClick={() => handleQuickAction('heartbeat')} loading={quickActionLoading === 'heartbeat'} />
            <QuickAction icon={Mail}     label={t('dashboard.checkEmails')}
              glowColor={themeAlpha('primary', 0.08)} bgColor={themeAlpha('primary', 0.1)} iconColor={themeHex('primary')}
              onClick={() => handleQuickAction('emails')}    loading={quickActionLoading === 'emails'} />
            <QuickAction icon={Calendar} label={t('dashboard.checkCalendar')}
              glowColor={themeAlpha('success', 0.08)} bgColor={themeAlpha('success', 0.1)} iconColor={themeHex('success')}
              onClick={() => handleQuickAction('calendar')}  loading={quickActionLoading === 'calendar'} />
            <QuickAction icon={RefreshCw} label={t('dashboard.compact')}
              glowColor={themeAlpha('warning', 0.08)} bgColor={themeAlpha('warning', 0.1)} iconColor={themeHex('warning')}
              onClick={() => handleQuickAction('compact')}   loading={quickActionLoading === 'compact'} />
            <QuickAction icon={BarChart3} label={t('dashboard.systemStatus')}
              glowColor={themeAlpha('accent', 0.08)} bgColor={themeAlpha('accent', 0.1)} iconColor={themeHex('accent')}
              onClick={() => handleQuickAction('status')}    loading={quickActionLoading === 'status'} />
            <QuickAction icon={FileText}  label={t('dashboard.sessionSummary')}
              glowColor="rgb(var(--aegis-overlay) / 0.03)" bgColor="rgb(var(--aegis-overlay) / 0.04)" iconColor="rgb(var(--aegis-text-dim))"
              onClick={() => handleQuickAction('summary')}   loading={quickActionLoading === 'summary'} />
          </div>
        </GlassCard>

        {/* ── Sessions ── */}
        <GlassCard delay={0.22}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bot size={15} className="text-aegis-accent" />
              <span className="text-[13px] font-semibold text-aegis-text">{t('dashboard.sessions')}</span>
            </div>
            <button
              onClick={() => navigate('/agents')}
              className="flex items-center gap-0.5 text-[10px] text-aegis-primary hover:underline"
            >
              {t('dashboard.viewAll')}
              <ChevronRight size={12} />
            </button>
          </div>

          <div className="space-y-1">
            {mainSession && (
              <SessionItem
                isMain
                name={t('dashboard.mainSession')}
                model={shortModel}
                detail={`${mainSession.compactions || 0} compact`}
                tokens={fmtTokens(mainSession.totalTokens || 0)}
                avatarBg={themeAlpha('primary', 0.12)}
                avatarColor={themeHex('primary')}
                icon={Shield}
              />
            )}
            {subSessions.map((s: any) => {
              const key   = s.key || 'unknown';
              const label = key.includes('#') ? `#${key.split('#')[1]}`
                : s.label || key.split(':').pop() || key;
              const sModel = (s.model || '').split('/').pop() || '—';
              return (
                <SessionItem
                  key={key}
                  name={label}
                  model={sModel}
                  detail={timeAgo(s.lastActive)}
                  tokens={fmtTokens(s.totalTokens || 0)}
                  avatarBg={themeAlpha('accent', 0.1)}
                  avatarColor={themeHex('accent')}
                  icon={Bot}
                />
              );
            })}
            {activeSessions.length === 0 && (
              <div className="text-[11px] text-aegis-text-dim text-center py-6">
                {connected ? t('dashboard.noActiveSessions') : t('dashboard.notConnected')}
              </div>
            )}
          </div>
        </GlassCard>

        {/* ── Activity Feed ── */}
        <GlassCard delay={0.24}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-aegis-primary" />
              <span className="text-[13px] font-semibold text-aegis-text">{t('dashboard.activity')}</span>
            </div>
            <span className="text-[8px] font-bold text-aegis-success bg-aegis-success-surface px-2 py-0.5 rounded-md tracking-wider animate-pulse-soft">
              LIVE
            </span>
          </div>

          <div className="max-h-[220px] overflow-y-auto scrollbar-hidden">
            {feedItems.length > 0 ? (
              feedItems.map((item, i) => (
                <FeedItem
                  key={i}
                  color={item.color}
                  text={item.text}
                  time={item.time}
                  isLast={i === feedItems.length - 1}
                />
              ))
            ) : (
              <div className="text-[11px] text-aegis-text-dim text-center py-6">
                {connected ? t('dashboard.noActiveSessions') : t('dashboard.notConnected')}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

    </PageTransition>
  );
}
