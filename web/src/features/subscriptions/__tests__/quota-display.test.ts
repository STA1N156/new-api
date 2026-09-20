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
import { createInstance } from 'i18next'
import { describe, expect, it } from 'vitest'

import zh from '@/i18n/locales/zh.json'

import { formatSubscriptionPrice, getPlanQuotaRows } from '../lib/format'

const i18n = createInstance()
await i18n.init({ lng: 'zh', resources: { zh } })

describe('subscription quota descriptions', () => {
  it('shows the price in yuan', () => {
    expect(formatSubscriptionPrice(28)).toBe('¥28.00')
  })

  it('labels each allowance with its own reset interval', () => {
    expect(
      getPlanQuotaRows(
        {
          total_amount: 270,
          quota_reset_period: 'custom',
          quota_reset_custom_seconds: 604800,
          quota_limits: [{ period_seconds: 18000, amount_total: 50 }],
        },
        i18n.t
      )
    ).toEqual([
      { key: '18000', label: '每5小时额度', amount: 50, periodSeconds: 18000 },
      {
        key: 'primary',
        label: '每7天额度',
        amount: 270,
        periodSeconds: 604800,
      },
    ])
  })

  it('retains total quota for a plan without resets', () => {
    expect(
      getPlanQuotaRows(
        { total_amount: 270, quota_reset_period: 'never' },
        i18n.t
      )
    ).toEqual([
      { key: 'primary', label: '总额度', amount: 270, periodSeconds: Infinity },
    ])
  })

  it('sorts unsorted cycles shortest first and keeps non-resetting quota last', () => {
    const limits = [
      { period_seconds: 604800, amount_total: 300 },
      { period_seconds: 18000, amount_total: 50 },
    ]
    expect(
      getPlanQuotaRows(
        {
          quota_reset_period: 'daily',
          total_amount: 100,
          quota_limits: limits,
        },
        i18n.t
      ).map((row) => row.label)
    ).toEqual(['每5小时额度', i18n.t('Daily Quota'), '每7天额度'])
    expect(
      getPlanQuotaRows(
        {
          quota_reset_period: 'never',
          total_amount: 100,
          quota_limits: limits,
        },
        i18n.t
      ).map((row) => row.key)
    ).toEqual(['18000', '604800', 'primary'])
    expect(limits.map((limit) => limit.period_seconds)).toEqual([604800, 18000])
  })
})
