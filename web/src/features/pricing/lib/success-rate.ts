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
import type { TFunction } from 'i18next'

export type SuccessRatePoint = {
  date: string
  uptime_pct: number
}

export function buildSuccessRateChartSpec(
  series: SuccessRatePoint[],
  textColor: string,
  gridColor: string,
  t: TFunction
) {
  const data = series
    .map((point) => ({
      timestamp: Date.parse(point.date),
      successRate: point.uptime_pct,
    }))
    .filter(
      (point) =>
        Number.isFinite(point.timestamp) && Number.isFinite(point.successRate)
    )
    .map((point) => ({
      ...point,
      successRate: Math.min(100, Math.max(0, point.successRate)),
    }))
    .sort((a, b) => a.timestamp - b.timestamp)
  const lastPoint = data.at(-1)
  if (!lastPoint) return null

  // Keep real timestamps so samples in the same hour cannot collapse together.
  const singlePointPadding = data.length === 1 ? 5 * 60 * 1000 : 0
  const tooltip = {
    title: {
      value: (point: { timestamp: number }) =>
        new Date(point.timestamp).toLocaleString(),
    },
    content: [
      {
        key: t('Success rate'),
        value: (point: { successRate: number }) =>
          `${point.successRate.toFixed(2)}%`,
      },
    ],
  }
  return {
    type: 'line' as const,
    data: [{ id: 'success-rate', values: data }],
    xField: 'timestamp',
    yField: 'successRate',
    line: {
      style: { stroke: '#10b981', lineWidth: 2, curveType: 'monotone' },
    },
    point: {
      visible: data.length === 1,
      style: { size: 5, fill: '#10b981', stroke: '#ffffff', lineWidth: 1.5 },
    },
    tooltip: { mark: tooltip, dimension: tooltip },
    crosshair: { xField: { visible: true, line: { type: 'line' } } },
    axes: [
      {
        orient: 'bottom',
        type: 'linear',
        zero: false,
        nice: false,
        min: data[0].timestamp - singlePointPadding,
        max: lastPoint.timestamp + singlePointPadding,
        tickCount: 5,
        label: {
          formatMethod: (value: number | string) =>
            new Date(Number(value)).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }),
          style: { fill: textColor, fontSize: 10 },
          autoHide: true,
        },
        tick: { visible: false },
        grid: { visible: false },
      },
      {
        orient: 'left',
        min: 0,
        max: 100,
        tickCount: 5,
        label: {
          formatMethod: (value: number | string) => `${value}%`,
          style: { fill: textColor, fontSize: 10 },
        },
        grid: {
          visible: true,
          style: { lineDash: [3, 3], stroke: gridColor },
        },
      },
    ],
  }
}
