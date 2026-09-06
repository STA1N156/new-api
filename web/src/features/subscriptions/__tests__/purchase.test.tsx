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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import type { UserSubscriptionRecord } from '@/features/subscriptions/types'
import { SubscriptionPlansCard } from '@/features/wallet/components/subscription-plans-card'
import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

const i18n = createInstance()
await i18n.init({ lng: 'zh', resources: { zh } })
const initialConfig = useSystemConfigStore.getState().config
let subscriptions: UserSubscriptionRecord[] = []

beforeEach(() => {
  subscriptions = []
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...DEFAULT_CURRENCY_CONFIG,
      quotaDisplayType: 'CUSTOM',
      customCurrencySymbol: '🍪',
      customCurrencyExchangeRate: 1,
    },
  })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/subscription/plans') {
      return {
        data: {
          success: true,
          data: [
            {
              plan: {
                id: 1,
                title: '月度套餐',
                price_amount: 28,
                currency: 'USD',
                duration_unit: 'day',
                duration_value: 28,
                total_amount: 270 * 500000,
                quota_reset_period: 'custom',
                quota_reset_custom_seconds: 604800,
                quota_limits: [
                  { period_seconds: 18000, amount_total: 50 * 500000 },
                ],
              },
            },
          ],
        },
      }
    }
    if (url === '/api/subscription/self') {
      return {
        data: {
          success: true,
          data: {
            subscriptions,
            all_subscriptions: subscriptions,
            billing_preference: 'subscription_first',
          },
        },
      }
    }
    throw new Error(`Unexpected request: ${url}`)
  })
})

it('shows purchased subscription usage as separate cycle percentages', async () => {
  const now = Math.floor(Date.now() / 1000)
  subscriptions = [
    {
      subscription: {
        id: 9,
        user_id: 1,
        plan_id: 1,
        status: 'active',
        start_time: now,
        end_time: now + 28 * 86400,
        amount_total: 300 * 500000,
        amount_used: 120 * 500000,
        next_reset_time: now + 604800,
        quota_limits: [
          {
            period_seconds: 18000,
            amount_total: 50 * 500000,
            amount_used: 50 * 500000,
            last_reset_time: now,
          },
        ],
      },
    },
  ]
  render(
    <I18nextProvider i18n={i18n}>
      <SubscriptionPlansCard topupInfo={null} />
    </I18nextProvider>
  )
  expect(await screen.findByRole('meter', { name: '7天额度' })).toHaveAttribute(
    'aria-valuenow',
    '40'
  )
  expect(screen.getByRole('meter', { name: '5小时额度' })).toHaveAttribute(
    'aria-valuenow',
    '100'
  )
  expect(screen.getByText(i18n.t('Waiting for reset'))).toBeVisible()
  for (const region of screen.getAllByRole('region', {
    name: /^(7天|5小时)额度$/,
  })) {
    expect(region).toHaveTextContent('🍪')
    expect(region).toHaveTextContent('%')
  }
})

afterEach(() => {
  useSystemConfigStore.getState().setConfig(initialConfig)
  localStorage.clear()
})

it('shows yuan prices and both quota cycles on the card and purchase dialog', async () => {
  const user = userEvent.setup()
  render(
    <I18nextProvider i18n={i18n}>
      <SubscriptionPlansCard topupInfo={null} />
    </I18nextProvider>
  )
  expect(await screen.findByText('¥28.00')).toBeVisible()
  expect(screen.getByText(/7天额度:.*270/)).toBeVisible()
  expect(screen.getByText(/5小时额度:.*50/)).toBeVisible()
  expect(screen.queryByText(/^总额度:/)).not.toBeInTheDocument()
  expect(
    screen
      .getAllByText(/^(5小时|7天)额度:/)
      .map((element) => element.textContent?.split(':')[0])
  ).toEqual(['5小时额度', '7天额度'])
  await user.click(
    screen.getByRole('button', { name: i18n.t('Subscribe Now') })
  )
  const dialog = within(await screen.findByRole('dialog'))
  expect(dialog.getByText('¥28.00')).toBeVisible()
  expect(dialog.getByText('7天额度')).toBeVisible()
  expect(dialog.getByText('5小时额度')).toBeVisible()
  expect(
    dialog
      .getAllByText(/^(5小时|7天)额度$/)
      .map((element) => element.textContent)
  ).toEqual(['5小时额度', '7天额度'])
  expect(
    dialog.getByRole('button', { name: i18n.t('Pay with Balance') })
  ).toBeDisabled()
})
