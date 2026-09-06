/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, HeartPulse, Timer } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { getPerfMetrics } from '@/features/performance-metrics/api'
import {
  formatThroughput,
  formatUptimePct,
  getSuccessRateTextClass,
} from '@/features/performance-metrics/lib/format'
import type { PerformanceGroup } from '@/features/performance-metrics/types'
import { cn } from '@/lib/utils'

import type { UptimeDayPoint } from '../lib/mock-stats'
import type { PricingModel } from '../types'
import { SuccessRateTrendChart } from './model-details-charts'

function StatCard(props: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  hint?: string
  valueClassName?: string
}) {
  const Icon = props.icon
  return (
    <div className='bg-background flex flex-col gap-1 rounded-lg border p-3'>
      <span className='text-muted-foreground inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase'>
        <Icon className='size-3' />
        {props.label}
      </span>
      <span
        className={cn(
          'text-foreground font-mono text-lg font-semibold tabular-nums',
          props.valueClassName
        )}
      >
        {props.value}
      </span>
      {props.hint && (
        <span className='text-muted-foreground/70 text-[11px]'>
          {props.hint}
        </span>
      )}
    </div>
  )
}

function toUptimePct(value: number): number {
  if (!Number.isFinite(value)) return 0
  const clamped = Math.min(100, Math.max(0, value))
  return Math.round(clamped * 100) / 100
}

function toUptimeSeries(groups: PerformanceGroup[]): UptimeDayPoint[] {
  const byTs = new Map<number, { rates: number[]; incidents: number }>()
  for (const group of groups) {
    for (const point of group.series) {
      const current = byTs.get(point.ts) ?? { rates: [], incidents: 0 }
      if (Number.isFinite(point.success_rate)) {
        const successRate = toUptimePct(point.success_rate)
        current.rates.push(successRate)
        if (successRate < 100) current.incidents += 1
      }
      byTs.set(point.ts, current)
    }
  }
  return [...byTs.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ts, value]) => {
      const uptime =
        value.rates.length > 0
          ? value.rates.reduce((sum, rate) => sum + rate, 0) /
            value.rates.length
          : 0
      return {
        date: new Date(ts * 1000).toISOString(),
        uptime_pct: toUptimePct(uptime),
        incidents: value.incidents,
        outage_minutes: 0,
      }
    })
}

export function ModelDetailsPerformance(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const metricsQuery = useQuery({
    queryKey: ['perf-metrics', props.model.model_name],
    queryFn: () => getPerfMetrics(props.model.model_name, 24),
    staleTime: 60 * 1000,
  })
  const groups = useMemo(
    () => metricsQuery.data?.data.groups ?? [],
    [metricsQuery.data]
  )
  const uptimeSeries = useMemo(() => toUptimeSeries(groups), [groups])

  if (metricsQuery.isLoading || groups.length === 0) {
    return (
      <div className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>
        {t('Performance data is not yet available for this model.')}
      </div>
    )
  }

  const tpsValues = groups.map((p) => p.avg_tps).filter((value) => value > 0)
  const avgTps =
    tpsValues.length > 0
      ? tpsValues.reduce((sum, value) => sum + value, 0) / tpsValues.length
      : 0
  const successRates = groups
    .map((perf) => perf.success_rate)
    .filter((value) => Number.isFinite(value))
  const successRate =
    successRates.length > 0
      ? successRates.reduce((sum, value) => sum + value, 0) /
        successRates.length
      : 0
  const incidentCount = uptimeSeries.reduce((s, p) => s + p.incidents, 0)

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <StatCard
          icon={Timer}
          label='TPS'
          value={formatThroughput(avgTps)}
          hint={t('Sustained tokens per second')}
        />
        <StatCard
          icon={HeartPulse}
          label={t('Success rate')}
          value={formatUptimePct(successRate)}
          hint={
            incidentCount > 0
              ? t('{{count}} incidents in the last 24 hours', {
                  count: incidentCount,
                })
              : t('No incidents in the last 24 hours')
          }
          valueClassName={getSuccessRateTextClass(successRate)}
        />
      </div>

      <section>
        <SectionHeader
          icon={HeartPulse}
          title={t('Success rate (last 24h)')}
          accent={
            incidentCount > 0 ? (
              <span className='inline-flex items-center gap-1 text-amber-600 dark:text-amber-400'>
                <AlertTriangle className='size-3.5' />
                {t('{{count}} incidents', {
                  count: incidentCount,
                })}
              </span>
            ) : null
          }
        />
        <SuccessRateTrendChart series={uptimeSeries} />
      </section>
    </div>
  )
}

function SectionHeader(props: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  accent?: React.ReactNode
}) {
  const Icon = props.icon
  return (
    <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
      <div className='flex min-w-0 items-center gap-2'>
        <Icon className='text-muted-foreground/70 size-3.5 shrink-0' />
        <div className='min-w-0'>
          <div className='text-foreground text-sm font-semibold'>
            {props.title}
          </div>
        </div>
      </div>
      {props.accent && (
        <div className='shrink-0 text-xs font-medium'>{props.accent}</div>
      )}
    </div>
  )
}
