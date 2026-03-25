// ═══════════════════════════════════════════════════════════
// ChartsSection — Daily Cost AreaChart + Agent Donut PieChart
// ═══════════════════════════════════════════════════════════

import { useTranslation }      from 'react-i18next';
import { TrendingUp, Package, BarChart3 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { GlassCard }  from '@/components/shared/GlassCard';
import { ChartTooltip } from './ChartTooltip';
import { themeHex } from '@/utils/theme-colors';
import { formatUsd, formatTokens } from '../helpers';

interface ChartDataPoint {
  date:   string;
  cost:   number;
  input:  number;
  output: number;
}

interface DonutDataPoint {
  name:       string;
  value:      number;
  color:      string;
  tokens:     number;
  actualCost: number;
}

interface ChartsSectionProps {
  chartData: ChartDataPoint[];
  donutData: DonutDataPoint[];
  totalCost: number;
}

export function ChartsSection({ chartData, donutData, totalCost }: ChartsSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-5 gap-4">
      {/* ── Daily Cost AreaChart — 3 columns ── */}
      <div className="col-span-3">
        <GlassCard delay={0.22}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={13} className="text-aegis-accent" />
            <span className="text-[10px] text-aegis-text-dim uppercase tracking-widest font-bold">
              {t('analytics.dailyCost')}
            </span>
            <span className="text-[9px] text-aegis-text-dim ms-auto font-mono">
              {t('analytics.dataPoints', { count: chartData.length })}
            </span>
          </div>

          {chartData.length >= 2 ? (
            <div dir="ltr" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="gradFull" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={themeHex('accent')} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={themeHex('accent')} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={themeHex('primary')} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={themeHex('primary')} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--aegis-overlay) / 0.03)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'rgb(var(--aegis-overlay) / 0.15)', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    interval={Math.floor(chartData.length / 8)}
                  />
                  <YAxis
                    tick={{ fill: 'rgb(var(--aegis-overlay) / 0.15)', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                    width={45}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="output"
                    name={t('analytics.chartSeriesOutputCost')}
                    stroke={themeHex('primary')}
                    strokeWidth={1.5}
                    fill="url(#gradOut)"
                    dot={false}
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="input"
                    name={t('analytics.chartSeriesInputCost')}
                    stroke={themeHex('accent')}
                    strokeWidth={1.5}
                    fill="url(#gradFull)"
                    dot={false}
                    stackId="1"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-aegis-text-dim text-[12px]">
              <BarChart3 size={20} className="me-2 opacity-30" />
              {t('analytics.notEnoughData')}
            </div>
          )}

          {/* Chart legend */}
          <div className="flex justify-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-[10px] text-aegis-text-muted">
              <div className="w-2 h-2 rounded-sm" style={{ background: 'rgb(var(--aegis-accent))' }} />
              {t('analytics.legendInputCost')}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-aegis-text-muted">
              <div className="w-2 h-2 rounded-sm" style={{ background: 'rgb(var(--aegis-primary))' }} />
              {t('analytics.legendOutputCost')}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ── Cost by Agent Donut — 2 columns ── */}
      <div className="col-span-2">
        <GlassCard delay={0.27}>
          <div className="flex items-center gap-2 mb-4">
            <Package size={13} className="text-[var(--aegis-data-5)]" />
            <span className="text-[10px] text-aegis-text-dim uppercase tracking-widest font-bold">
              {t('analytics.costByAgent')}
            </span>
          </div>

          {donutData.length > 0 ? (
            <>
              <div dir="ltr" className="flex justify-center" style={{ height: 160 }}>
                <PieChart width={160} height={160}>
                  <Pie
                    data={donutData}
                    cx={80} cy={80}
                    innerRadius={45} outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    animationBegin={400}
                    animationDuration={800}
                    stroke="var(--aegis-bg-solid)"
                    strokeWidth={2}
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} opacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div
                          className="border border-[rgb(var(--aegis-overlay)/0.1)] rounded-lg px-3 py-2 text-[11px]"
                          style={{ background: 'var(--aegis-bg-frosted)' }}
                        >
                          <div className="font-bold" style={{ color: d.color }}>{d.name}</div>
                          <div className="text-aegis-text-muted">
                            {formatUsd(d.actualCost)} · {formatTokens(d.tokens)}
                          </div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </div>

              {/* Agent legend — show top 6 */}
              <div className="space-y-1.5 mt-1">
                {donutData.slice(0, 6).map((d) => {
                  const pct =
                    totalCost > 0
                      ? Math.round((d.actualCost / totalCost) * 100)
                      : 0;
                  return (
                    <div key={d.name} className="flex items-center gap-2 text-[11px]">
                      <div
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ background: d.color }}
                      />
                      <span className="text-aegis-text-muted flex-1 truncate">{d.name}</span>
                      <span className="font-mono font-bold text-aegis-text-secondary">
                        {formatUsd(d.actualCost)}
                      </span>
                      <span className="text-aegis-text-dim w-8 text-end font-mono text-[10px]">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
                {donutData.length > 6 && (
                  <div className="text-[9px] text-aegis-text-dim text-center">
                    {t('analytics.moreAgents', { count: donutData.length - 6 })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-aegis-text-dim text-[12px]">
              {t('analytics.noAgentData')}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
