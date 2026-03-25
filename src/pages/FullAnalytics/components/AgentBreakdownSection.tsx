// ═══════════════════════════════════════════════════════════
// AgentBreakdownSection — Per-agent cost cards grid
// ═══════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '@/components/shared/GlassCard';
import { type ByAgentEntry } from '../types';
import { formatTokens, formatUsd, getAgentColor, getAgentIcon } from '../helpers';

interface AgentBreakdownSectionProps {
  byAgent: ByAgentEntry[];
  totalCost: number;
}

export function AgentBreakdownSection({ byAgent, totalCost }: AgentBreakdownSectionProps) {
  const { t } = useTranslation();
  if (!byAgent.length) return null;

  const maxCost = Math.max(...byAgent.map((a) => a.totals.totalCost), 0.001);
  const sorted  = [...byAgent].sort((a, b) => b.totals.totalCost - a.totals.totalCost);

  return (
    <div>
      <div className="text-[10px] text-aegis-text-dim uppercase tracking-widest font-bold mb-3">
        {t('analytics.perAgentBreakdown')}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {sorted.map((agent, i) => {
          const color    = getAgentColor(agent.agentId);
          const icon     = getAgentIcon(agent.agentId);
          const barPct   = maxCost > 0 ? Math.round((agent.totals.totalCost / maxCost) * 100) : 0;
          const sharePct = totalCost > 0
            ? ((agent.totals.totalCost / totalCost) * 100).toFixed(1)
            : '0';

          return (
            <GlassCard key={agent.agentId} delay={i * 0.05} hover>
              <div className="relative overflow-hidden">
                {/* Top accent line */}
                <div
                  className="absolute top-0 inset-x-0 h-[2px] opacity-50"
                  style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
                />

                {/* Agent header */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-8 h-8 rounded-[10px] flex items-center justify-center text-sm border"
                    style={{ background: `${color}15`, borderColor: `${color}25` }}
                  >
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold truncate" style={{ color }}>
                      {agent.agentId === 'main' ? t('analytics.mainAgent') : agent.agentId}
                    </div>
                    <div className="text-[9px] text-aegis-text-dim">
                      {t('analytics.percentOfTotal', { pct: sharePct })}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-aegis-text-muted">{t('analytics.tokens')}</span>
                    <span className="font-mono font-bold text-aegis-text-secondary">
                      {formatTokens(agent.totals.totalTokens)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-aegis-text-muted">{t('analytics.labelInput')}</span>
                    <span className="font-mono text-aegis-text-muted">{formatTokens(agent.totals.input)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-aegis-text-muted">{t('analytics.labelOutput')}</span>
                    <span className="font-mono text-aegis-text-muted">{formatTokens(agent.totals.output)}</span>
                  </div>
                  {agent.totals.cacheRead > 0 && (
                    <div className="flex justify-between">
                      <span className="text-aegis-text-muted">{t('analytics.labelCacheDown')}</span>
                      <span className="font-mono text-aegis-success/60">
                        {formatTokens(agent.totals.cacheRead)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-aegis-text-muted">{t('analytics.cost')}</span>
                    <span className="font-mono font-bold" style={{ color }}>
                      {formatUsd(agent.totals.totalCost)}
                    </span>
                  </div>
                </div>

                {/* Relative bar — width proportional to the top-cost agent */}
                <div className="w-full h-1 rounded-full bg-[rgb(var(--aegis-overlay)/0.04)] mt-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barPct}%` }}
                    transition={{
                      duration: 1,
                      delay: i * 0.05 + 0.3,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="h-full rounded-full"
                    style={{ background: color }}
                  />
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
