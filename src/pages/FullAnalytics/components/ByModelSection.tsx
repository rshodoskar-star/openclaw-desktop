// ═══════════════════════════════════════════════════════════
// ByModelSection — Per-model usage table with mini bars
// ═══════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { Cpu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '@/components/shared/GlassCard';
import { type ByModelEntry } from '../types';
import { formatTokens, formatUsd, shortModel, getModelColor } from '../helpers';

interface ByModelSectionProps {
  byModel: ByModelEntry[];
}

export function ByModelSection({ byModel }: ByModelSectionProps) {
  const { t } = useTranslation();
  if (!byModel?.length) return null;

  const maxCost = Math.max(...byModel.map((m) => m.totals.totalCost), 0.001);
  const sorted  = [...byModel].sort((a, b) => b.totals.totalCost - a.totals.totalCost);

  return (
    <GlassCard delay={0.3}>
      <div className="flex items-center gap-2 mb-4">
        <Cpu size={14} className="text-aegis-accent" />
        <span className="text-[10px] text-aegis-text-dim uppercase tracking-widest font-bold">
          {t('analytics.byModel')}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgb(var(--aegis-overlay)/0.06)]">
              <th className="text-start text-[9px] text-aegis-text-dim uppercase tracking-wider font-bold pb-2 ps-2">
                {t('analytics.tblModel')}
              </th>
              <th className="text-end text-[9px] text-aegis-text-dim uppercase tracking-wider font-bold pb-2">
                {t('analytics.calls')}
              </th>
              <th className="text-end text-[9px] text-aegis-text-dim uppercase tracking-wider font-bold pb-2">
                {t('analytics.labelInput')}
              </th>
              <th className="text-end text-[9px] text-aegis-text-dim uppercase tracking-wider font-bold pb-2">
                {t('analytics.labelOutput')}
              </th>
              <th className="text-end text-[9px] text-aegis-text-dim uppercase tracking-wider font-bold pb-2">
                {t('analytics.tblCache')}
              </th>
              <th className="text-end text-[9px] text-aegis-text-dim uppercase tracking-wider font-bold pb-2">
                {t('analytics.tblTotalTokens')}
              </th>
              <th className="text-end text-[9px] text-aegis-text-dim uppercase tracking-wider font-bold pb-2 pe-2">
                {t('analytics.tblCost')}
              </th>
              <th className="w-16 pb-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => {
              const name   = shortModel(entry.model);
              const color  = getModelColor(entry.model);
              const barPct = (entry.totals.totalCost / maxCost) * 100;

              return (
                <tr
                  key={`${entry.provider}-${entry.model}`}
                  className="border-b border-[rgb(var(--aegis-overlay)/0.02)] hover:bg-[rgb(var(--aegis-overlay)/0.02)] transition-colors"
                >
                  <td className="py-2.5 ps-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
                      <span className="text-[11px] font-medium text-aegis-text-secondary">{name}</span>
                      {entry.provider && (
                        <span className="text-[9px] text-aegis-text-dim">({entry.provider})</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 text-end text-[10px] text-aegis-text-muted font-mono">
                    {entry.count.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-end text-[10px] text-aegis-text-muted font-mono">
                    {formatTokens(entry.totals.input)}
                  </td>
                  <td className="py-2.5 text-end text-[10px] text-aegis-text-muted font-mono">
                    {formatTokens(entry.totals.output)}
                  </td>
                  <td className="py-2.5 text-end text-[10px] text-aegis-success/40 font-mono">
                    {entry.totals.cacheRead > 0 ? formatTokens(entry.totals.cacheRead) : '—'}
                  </td>
                  <td className="py-2.5 text-end text-[10px] text-aegis-text-muted font-mono">
                    {formatTokens(entry.totals.totalTokens)}
                  </td>
                  <td className="py-2.5 text-end pe-2">
                    <span className="text-[11px] font-mono font-bold" style={{ color }}>
                      {formatUsd(entry.totals.totalCost)}
                    </span>
                  </td>
                  <td className="py-2.5 pe-1">
                    <div className="w-16 h-[3px] rounded-full bg-[rgb(var(--aegis-overlay)/0.04)] overflow-hidden inline-block align-middle">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barPct}%` }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full"
                        style={{ background: color }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
