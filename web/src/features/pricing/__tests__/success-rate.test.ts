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
import { t } from 'i18next'
import { expect, it } from 'vitest'

import { buildSuccessRateChartSpec } from '../lib/success-rate'

const first = {
  date: '2026-09-06T08:05:00Z',
  uptime_pct: 98,
}
const later = { ...first, date: '2026-09-06T08:45:00Z', uptime_pct: 100 }

it('keeps distinct times within the same hour on a continuous time axis', () => {
  const spec = buildSuccessRateChartSpec([later, first], '#999', '#333', t)
  expect(spec?.xField).toBe('timestamp')
  expect(spec?.yField).toBe('successRate')
  expect(spec?.data[0].values).toEqual([
    { timestamp: Date.parse(first.date), successRate: 98 },
    { timestamp: Date.parse(later.date), successRate: 100 },
  ])
  expect(spec?.axes[0]).toMatchObject({
    type: 'linear',
    zero: false,
    grid: { visible: false },
  })
  expect(spec?.line.style).toMatchObject({ curveType: 'monotone' })
  expect(spec?.point.visible).toBe(false)
  expect(spec?.axes[1]).toMatchObject({ min: 0, max: 100 })
})

it('shows one real sample as one point without inventing a second time', () => {
  const spec = buildSuccessRateChartSpec([first], '#999', '#333', t)
  expect(spec?.data[0].values).toHaveLength(1)
  expect(spec?.point.visible).toBe(true)
})

it('omits invalid samples and keeps the displayed success rate within zero to one hundred', () => {
  const spec = buildSuccessRateChartSpec(
    [
      { ...first, date: 'invalid' },
      { ...first, uptime_pct: Number.NaN },
      { ...first, uptime_pct: -2 },
      { ...later, uptime_pct: 105 },
    ],
    '#999',
    '#333',
    t
  )
  expect(spec?.data[0].values).toEqual([
    { timestamp: Date.parse(first.date), successRate: 0 },
    { timestamp: Date.parse(later.date), successRate: 100 },
  ])
  expect(buildSuccessRateChartSpec([], '#999', '#333', t)).toBeNull()
})
