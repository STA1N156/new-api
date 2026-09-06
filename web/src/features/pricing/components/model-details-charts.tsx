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
import { VChart } from '@visactor/react-vchart'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useChartTheme } from '@/lib/use-chart-theme'
import { cn } from '@/lib/utils'
import { VCHART_OPTION } from '@/lib/vchart'

import type { UptimeDayPoint } from '../lib/mock-stats'
import { buildSuccessRateChartSpec } from '../lib/success-rate'

function getChartThemeTokens(resolvedTheme: string) {
  return {
    textColor:
      resolvedTheme === 'dark'
        ? 'rgba(255, 255, 255, 0.68)'
        : 'rgba(15, 23, 42, 0.58)',
    gridColor:
      resolvedTheme === 'dark'
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(15, 23, 42, 0.12)',
  }
}

// ---------------------------------------------------------------------------
// Success rate over the last 24 hours.
// ---------------------------------------------------------------------------

export function SuccessRateTrendChart(props: {
  series: UptimeDayPoint[]
  className?: string
}) {
  const { t } = useTranslation()
  const { resolvedTheme, themeReady } = useChartTheme()
  const { textColor, gridColor } = getChartThemeTokens(resolvedTheme)

  const spec = useMemo(
    () => buildSuccessRateChartSpec(props.series, textColor, gridColor, t),
    [gridColor, props.series, t, textColor]
  )

  if (!spec) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex h-48 items-center justify-center rounded-lg border text-xs',
          props.className
        )}
      >
        {t('No success rate data available')}
      </div>
    )
  }

  return (
    <div className={cn('h-56 sm:h-64', props.className)}>
      {themeReady && (
        <VChart
          key={`success-rate-trend-${resolvedTheme}`}
          spec={{
            ...spec,
            theme: resolvedTheme === 'dark' ? 'dark' : 'light',
            background: 'transparent',
          }}
          option={VCHART_OPTION}
        />
      )}
    </div>
  )
}
