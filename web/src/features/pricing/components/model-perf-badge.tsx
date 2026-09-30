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
import { memo, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  formatThroughput,
  formatUptimePct,
} from '@/features/performance-metrics/lib/format'
import { cn } from '@/lib/utils'

/* oxlint-disable react/no-array-index-key -- Bars represent fixed chronological slots, not reorderable items. */

export type ModelPerfBadgeData = {
  avg_latency_ms: number
  success_rate: number
  avg_tps: number
  recent_success_rates?: number[]
  history_only?: boolean
}

export interface ModelPerfBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  perf: ModelPerfBadgeData | undefined
}

export const ModelPerfBadge = memo(function ModelPerfBadge(
  props: ModelPerfBadgeProps
) {
  const { t } = useTranslation()
  const barsRef = useRef<HTMLDivElement>(null)
  const [barCount, setBarCount] = useState(24)

  useLayoutEffect(() => {
    const element = barsRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      // Each line is 3px wide with a fixed 2px gap.
      setBarCount(Math.max(1, Math.floor((entry.contentRect.width + 2) / 5)))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const successRate = props.perf?.history_only
    ? Number.NaN
    : (props.perf?.success_rate ?? Number.NaN)
  const recentRates =
    props.perf?.recent_success_rates?.filter(Number.isFinite) ?? []
  const statusRates =
    recentRates.length > 0
      ? recentRates.slice(-barCount)
      : [successRate].filter(Number.isFinite)
  const statusBars = [
    ...Array<number>(Math.max(0, barCount - statusRates.length)).fill(100),
    ...statusRates,
  ]
  const statusLabel = Number.isFinite(successRate)
    ? `${t('Success rate')}: ${formatUptimePct(successRate)}`
    : t('No data')

  return (
    <div
      className={cn(
        'grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-end gap-4 tabular-nums',
        props.className
      )}
    >
      <div className='min-w-0'>
        <div
          title={`${t('Last 6 hours')} · ${statusLabel}`}
          className='text-muted-foreground mb-1 flex items-baseline justify-between gap-2 text-xs leading-4'
        >
          <span>{t('Status short')}</span>
          <span className='font-mono'>{formatUptimePct(successRate)}</span>
        </div>
        <div
          ref={barsRef}
          role='img'
          title={t(
            'Recent status includes earlier history; missing records are filled in green'
          )}
          aria-label={t(
            'Recent status includes earlier history; missing records are filled in green'
          )}
          className='flex h-5 items-center gap-[2px] overflow-hidden'
        >
          {statusBars.map((rate, index) => {
            let colorClass = 'bg-emerald-500'
            if (rate < 60) colorClass = 'bg-red-500'
            else if (rate < 80) colorClass = 'bg-amber-500'
            return (
              <span
                key={index}
                className={cn('h-4 w-[3px] shrink-0 rounded-[1px]', colorClass)}
              />
            )
          })}
        </div>
      </div>
      <div title={t('Sustained tokens per second')} className='text-right'>
        <div className='text-muted-foreground mb-1 text-xs leading-4'>
          {t('Speed')}
        </div>
        <div className='text-foreground font-mono text-xs leading-5 font-medium whitespace-nowrap'>
          {formatThroughput(props.perf?.avg_tps ?? 0)}
        </div>
      </div>
    </div>
  )
})
