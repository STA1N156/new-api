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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as renderUI, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import type { UserSubscriptionRecord } from '@/features/subscriptions/types'
import { SubscriptionPlansCard } from '@/features/wallet/components/subscription-plans-card'
import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

const i18n = createInstance()
await i18n.init({ lng: 'zh', resources: { zh } })
const initialConfig = useSystemConfigStore.getState().config
let subscriptions: UserSubscriptionRecord[] = []
let allowBalancePay: boolean | undefined
let allowedModels: string[] | undefined
let planUpgradeGroup: string | undefined
let pricingFails = false
let requestPrice = 20
let queryClient: QueryClient
const initialUser = useAuthStore.getState().auth.user

function render(ui: ReactElement) {
  return renderUI(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

beforeEach(() => {
  subscriptions = []
  allowBalancePay = undefined
  allowedModels = undefined
  planUpgradeGroup = undefined
  pricingFails = false
  requestPrice = 20
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  useAuthStore
    .getState()
    .auth.setUser({ id: 1, username: 'test', role: 1, group: 'default' })
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...DEFAULT_CURRENCY_CONFIG,
      quotaDisplayType: 'CUSTOM',
      customCurrencySymbol: '🍪',
      customCurrencyExchangeRate: 1,
    },
  })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/pricing') {
      if (pricingFails) throw new Error('offline')
      return {
        data: {
          success: true,
          data: [
            {
              model_name: 'model-a',
              quota_type: 0,
              enable_groups: ['default'],
            },
            {
              model_name: 'model-b',
              quota_type: 1,
              model_price: requestPrice,
              enable_groups: ['default', 'cheaper', 'premium'],
            },
          ],
          group_ratio: { default: 2, cheaper: 0.5, premium: 4 },
        },
      }
    }
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
                allow_balance_pay: allowBalancePay,
                allowed_models: allowedModels,
                upgrade_group: planUpgradeGroup,
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
  expect(
    await screen.findByRole('meter', { name: '每7天额度' })
  ).toHaveAttribute('aria-valuenow', '40')
  expect(screen.getByRole('meter', { name: '每5小时额度' })).toHaveAttribute(
    'aria-valuenow',
    '100'
  )
  expect(screen.getByText(i18n.t('Waiting for reset'))).toBeVisible()
  for (const region of screen.getAllByRole('region', {
    name: /^每(7天|5小时)额度$/,
  })) {
    expect(region).toHaveTextContent('🍪')
    expect(region).toHaveTextContent('%')
  }
})

afterEach(() => {
  queryClient.clear()
  useAuthStore.getState().auth.setUser(initialUser)
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
  expect(screen.getByText(/每7天额度:.*270/)).toBeVisible()
  expect(screen.getByText(/每5小时额度:.*50/)).toBeVisible()
  expect(screen.queryByText(/^总额度:/)).not.toBeInTheDocument()
  expect(
    screen
      .getAllByText(/^每(5小时|7天)额度:/)
      .map((element) => element.textContent?.split(':')[0])
  ).toEqual(['每5小时额度', '每7天额度'])
  await user.click(
    screen.getByRole('button', { name: i18n.t('Subscribe Now') })
  )
  const dialog = within(await screen.findByRole('dialog'))
  expect(dialog.getByText('¥28.00')).toBeVisible()
  expect(dialog.getByText('每7天额度')).toBeVisible()
  expect(dialog.getByText('每5小时额度')).toBeVisible()
  expect(
    dialog
      .getAllByText(/^每(5小时|7天)额度$/)
      .map((element) => element.textContent)
  ).toEqual(['每5小时额度', '每7天额度'])
  expect(
    dialog.getByRole('button', { name: i18n.t('Pay with Balance') })
  ).toBeDisabled()
})

it('expands each model separately and shows every cycle allowance without starting a purchase', async () => {
  allowedModels = ['model-a', 'model-b']
  const user = userEvent.setup()
  render(
    <I18nextProvider i18n={i18n}>
      <SubscriptionPlansCard topupInfo={null} />
    </I18nextProvider>
  )
  await user.click(
    await screen.findByRole('button', { name: i18n.t('Usage scope') })
  )
  const dialog = within(
    await screen.findByRole('dialog', { name: i18n.t('Usage scope') })
  )
  const first = dialog.getByRole('button', { name: 'model-a' })
  const second = dialog.getByRole('button', { name: 'model-b' })
  expect(first).toHaveAttribute('aria-expanded', 'false')
  expect(second).toHaveAttribute('aria-expanded', 'false')
  await user.click(first)
  const panel = within(await dialog.findByRole('region', { name: 'model-a' }))
  expect(await panel.findByText('50🍪')).toBeVisible()
  expect(panel.getByText('270🍪')).toBeVisible()
  expect(panel.getAllByRole('term').map((item) => item.textContent)).toEqual([
    '每5小时总可用',
    '每7天总可用',
  ])
  expect(second).toHaveAttribute('aria-expanded', 'false')
  await user.click(second)
  expect(first).toHaveAttribute('aria-expanded', 'true')
  expect(second).toHaveAttribute('aria-expanded', 'true')
  expect(
    dialog.queryByRole('button', { name: i18n.t('Pay with Balance') })
  ).not.toBeInTheDocument()
})

it.each([
  { upgrade: undefined, price: 20, counts: ['1 次', '7 次'] },
  { upgrade: 'premium', price: 20, counts: ['1 次', '3 次'] },
  { upgrade: undefined, price: 10, counts: ['3 次', '14 次'] },
])(
  'rounds per-request counts using the applicable group ($upgrade)',
  async ({ upgrade, price, counts }) => {
    allowedModels = ['model-b']
    planUpgradeGroup = upgrade
    requestPrice = price
    useSystemConfigStore.getState().setConfig({
      currency: {
        ...useSystemConfigStore.getState().config.currency,
        customCurrencyExchangeRate: 10,
      },
    })
    const user = userEvent.setup()
    render(
      <I18nextProvider i18n={i18n}>
        <SubscriptionPlansCard topupInfo={null} />
      </I18nextProvider>
    )
    await user.click(
      await screen.findByRole('button', { name: i18n.t('Usage scope') })
    )
    await user.click(await screen.findByRole('button', { name: 'model-b' }))
    const panel = within(await screen.findByRole('region', { name: 'model-b' }))
    for (const count of counts) {
      expect(await panel.findByText(count)).toBeVisible()
    }
    expect(panel.queryByText(/🍪/)).not.toBeInTheDocument()
  }
)

it('keeps cycle quotas visible when model pricing cannot be loaded', async () => {
  allowedModels = ['model-b']
  pricingFails = true
  const user = userEvent.setup()
  render(
    <I18nextProvider i18n={i18n}>
      <SubscriptionPlansCard topupInfo={null} />
    </I18nextProvider>
  )
  await user.click(
    await screen.findByRole('button', { name: i18n.t('Usage scope') })
  )
  await user.click(await screen.findByRole('button', { name: 'model-b' }))
  expect(
    await screen.findByText(
      i18n.t('Pricing unavailable; showing quota instead of call counts.')
    )
  ).toBeVisible()
  const panel = within(await screen.findByRole('region', { name: 'model-b' }))
  expect(await panel.findByText('50🍪')).toBeVisible()
  expect(panel.getByText('270🍪')).toBeVisible()
  expect(panel.queryByText(/次$/)).not.toBeInTheDocument()
})

it('shows unrestricted scope for legacy plans without a model list', async () => {
  const user = userEvent.setup()
  render(
    <I18nextProvider i18n={i18n}>
      <SubscriptionPlansCard topupInfo={null} />
    </I18nextProvider>
  )
  await user.click(
    await screen.findByRole('button', { name: i18n.t('Usage scope') })
  )
  const dialog = within(await screen.findByRole('dialog'))
  expect(dialog.getByText(i18n.t('All Models'))).toBeVisible()
})

it('hides the entire balance payment section when the plan disallows balance purchases', async () => {
  allowBalancePay = false
  const user = userEvent.setup()
  render(
    <I18nextProvider i18n={i18n}>
      <SubscriptionPlansCard topupInfo={null} />
    </I18nextProvider>
  )
  await user.click(
    await screen.findByRole('button', { name: i18n.t('Subscribe Now') })
  )
  const dialog = within(await screen.findByRole('dialog'))
  expect(dialog.getByText('¥28.00')).toBeVisible()
  expect(dialog.queryByText(i18n.t('Required'))).not.toBeInTheDocument()
  expect(dialog.queryByText(i18n.t('Available'))).not.toBeInTheDocument()
  expect(
    dialog.queryByText(i18n.t('This plan does not allow balance redemption'))
  ).not.toBeInTheDocument()
  expect(
    dialog.queryByRole('button', { name: i18n.t('Pay with Balance') })
  ).not.toBeInTheDocument()
})
