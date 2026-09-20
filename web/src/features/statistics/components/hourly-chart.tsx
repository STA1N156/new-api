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
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

interface HourlyChartProps {
  title: string
  values: number[]
  color: string
  detail: string
  format: (value: number) => string
  formatAxis?: (value: number) => string
  wholeNumbers?: boolean
}

export function HourlyChart(props: HourlyChartProps) {
  const { t } = useTranslation()
  const total = props.values.reduce((sum, value) => sum + value, 0)
  return (
    <section
      aria-label={props.title}
      className='bg-card min-w-0 rounded-2xl border p-4 shadow-xs sm:p-5'
    >
      <h3 className='text-muted-foreground text-sm font-medium'>
        {props.title}
      </h3>
      <p className='mt-2 text-2xl font-semibold tabular-nums'>
        {props.format(total)}
      </p>
      <p className='text-muted-foreground mt-1 min-h-8 text-xs leading-relaxed'>
        {props.detail}
      </p>
      <div
        className='mt-4 -ml-3 overflow-x-auto overscroll-x-contain pb-2'
        role='region'
        tabIndex={0}
        aria-label={t('Hourly trend: {{metric}}', { metric: props.title })}
      >
        <ChartContainer
          className='aspect-auto h-52 w-full min-w-[760px] sm:h-60'
          config={{ value: { label: props.title, color: props.color } }}
        >
          <AreaChart
            data={props.values.map((value, hour) => ({ hour, value }))}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray='3 4' />
            <XAxis
              dataKey='hour'
              type='number'
              domain={[0, 23]}
              ticks={[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]}
              tickFormatter={(hour) => `${String(hour).padStart(2, '0')}:00`}
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
                    `${String(payload[0]?.payload.hour ?? 0).padStart(2, '0')}:00 – ${String((payload[0]?.payload.hour ?? 0) + 1).padStart(2, '0')}:00`
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
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </section>
  )
}
