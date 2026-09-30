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
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'

interface HourlyChartProps {
  title: string
  values: number[]
  color: string
  detail: string
  format: (value: number) => string
  formatAxis?: (value: number) => string
  wholeNumbers?: boolean
  totalCount?: number
  timestamps: number[]
  days: number
  asOf: number
  previousTotal: number
  comparisonLabel: string
  actions?: ReactNode
}

export function HourlyChart(props: HourlyChartProps) {
  const { t } = useTranslation()
  const total = props.values.reduce((sum, value) => sum + value, 0)
  const daily = props.days > 1
  const labels = props.timestamps.map((timestamp) =>
    new Date((timestamp + 8 * 3600) * 1000).toISOString().slice(0, 10)
  )
  const data = props.values.map((value, index) => {
    const timestamp = props.timestamps[index]
    const currentHour =
      !daily && props.asOf >= timestamp && props.asOf < timestamp + 3600
    let label = labels[index]
    if (!daily) {
      let endLabel = `${String(index + 1).padStart(2, '0')}:00`
      if (currentHour) {
        endLabel = new Date((props.asOf + 8 * 3600) * 1000)
          .toISOString()
          .slice(11, 16)
      }
      label = `${String(index).padStart(2, '0')}:00 – ${endLabel}`
    }
    return {
      index: currentHour ? (props.asOf - props.timestamps[0]) / 3600 : index,
      value,
      label,
    }
  })
  const ticks = daily
    ? props.values
        .map((_, index) => index)
        .filter(
          (index) =>
            index % Math.ceil(props.days / 10) === 0 || index === props.days - 1
        )
    : [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]
  const change =
    props.previousTotal > 0
      ? Math.round(
          ((total - props.previousTotal) / props.previousTotal) * 1000
        ) / 10
      : total - props.previousTotal
  const ChangeIcon = change < 0 ? ArrowDown : ArrowUp
  const changeText =
    props.previousTotal > 0
      ? `${Math.abs(change).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
      : props.format(Math.abs(change))
  return (
    <section
      aria-label={props.title}
      className='bg-card min-w-0 rounded-2xl border p-4 shadow-xs sm:p-5'
    >
      <div className='flex items-center justify-between gap-3'>
        <h3 className='text-muted-foreground text-sm font-medium'>
          {props.title}
        </h3>
        {props.actions}
      </div>
      <div className='mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1'>
        <p className='text-2xl font-semibold tabular-nums'>
          {props.format(total)}
          {props.totalCount !== undefined &&
            ` / ${t('{{count}} transactions', { count: props.totalCount })}`}
        </p>
        {change !== 0 && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium tabular-nums',
              change > 0 && 'text-emerald-600 dark:text-emerald-400',
              change < 0 && 'text-rose-600 dark:text-rose-400'
            )}
            title={`${props.comparisonLabel}: ${props.format(props.previousTotal)}`}
            aria-label={`${props.comparisonLabel}: ${change > 0 ? '+' : '-'}${changeText}`}
          >
            <ChangeIcon className='size-3.5' aria-hidden='true' />
            {changeText}
          </span>
        )}
      </div>
      <p className='text-muted-foreground mt-1 min-h-8 text-xs leading-relaxed'>
        {props.detail}
      </p>
      <div
        className='mt-4 -ml-3 overflow-x-auto overscroll-x-contain pb-2'
        role='region'
        tabIndex={0}
        aria-label={t('Trend: {{metric}}', { metric: props.title })}
      >
        <ChartContainer
          className='aspect-auto h-52 w-full min-w-[760px] sm:h-60'
          config={{ value: { label: props.title, color: props.color } }}
        >
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray='3 4' />
            <XAxis
              dataKey='index'
              type='number'
              domain={[0, daily ? props.days - 1 : 24]}
              ticks={ticks}
              tickFormatter={(index: number) =>
                daily
                  ? (labels[index]?.slice(5).replace('-', '/') ?? '')
                  : `${String(index).padStart(2, '0')}:00`
              }
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis
              width={32}
              tickMargin={4}
              tickFormatter={props.formatAxis ?? props.format}
              allowDecimals={!props.wholeNumbers}
              tickLine={false}
              axisLine={false}
              domain={[0, 'auto']}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    payload[0]?.payload.label ?? ''
                  }
                  formatter={(value) => props.format(Number(value))}
                />
              }
            />
            <Area
              type='monotone'
              dataKey='value'
              stroke='var(--color-value)'
              fill='var(--color-value)'
              fillOpacity={0.08}
              strokeWidth={2.5}
              dot={data.length === 1 ? { r: 3 } : false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </section>
  )
}
