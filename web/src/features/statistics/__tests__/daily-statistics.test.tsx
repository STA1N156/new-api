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
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { Statistics } from '..'
import type { DailyStatistics } from '../api'

const initialConfig = useSystemConfigStore.getState().config
let client: QueryClient

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...initialConfig.currency,
      displayInCurrency: true,
      quotaDisplayType: 'CUSTOM',
      quotaPerUnit: 500000,
      customCurrencySymbol: '🍪',
      customCurrencyExchangeRate: 10,
    },
  })
})

afterEach(async () => {
  cleanup()
  client.clear()
  useSystemConfigStore.getState().setConfig(initialConfig)
  await i18next.changeLanguage('en')
  i18next.removeResourceBundle('zh', 'translation')
})

const statistics: DailyStatistics = {
  date: '2026-09-21',
  today: '2026-09-21',
  hours: Array.from({ length: 24 }, (_, hour) => ({
    timestamp: 1790006400 + hour * 3600,
    requests: hour === 12 ? 12 : 0,
    consumed_quota: hour === 12 ? 235000 : 0,
    redeemed_quota: hour === 12 ? 50000000 : 0,
    redeemed_count: hour === 12 ? 3 : Number(hour === 11) * 2,
    online_topup: hour === 12 ? 88.5 : 0,
    subscription_topup: hour === 12 ? 600 : 0,
    topup_count: hour === 12 ? 2 : Number(hour === 11),
  })),
}

function renderStatistics() {
  return render(
    <QueryClientProvider client={client}>
      <Statistics />
    </QueryClientProvider>
  )
}

it('shows all four daily totals and switches to a selected day from the last 30 days', async () => {
  const user = userEvent.setup()
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { success: true, data: statistics } })
  renderStatistics()
  const requests = await screen.findByRole('region', { name: 'Request count' })
  expect(within(requests).getByText('12')).toBeVisible()
  expect(
    within(screen.getByRole('region', { name: 'Consumption' })).getByText(
      '🍪 4.7'
    )
  ).toBeVisible()
  expect(
    within(screen.getByRole('region', { name: 'Redemption' })).getByText(
      '🍪 1,000 / 5 transactions'
    )
  ).toBeVisible()
  expect(
    within(screen.getByRole('region', { name: 'Top-up' })).getByText(
      '¥688.50 / 3 transactions'
    )
  ).toBeVisible()
  expect(
    screen.getByText('Direct ¥88.50 · Subscriptions ¥600.00')
  ).toBeVisible()
  const selector = screen.getByRole('combobox', { name: 'Statistics date' })
  await user.click(selector)
  const options = within(await screen.findByRole('listbox'))
  expect(options.getAllByRole('option')).toHaveLength(30)
  expect(
    options.getByRole('option', { name: '2026-08-23' })
  ).toBeInTheDocument()
  expect(
    options.queryByRole('option', { name: '2026-08-22' })
  ).not.toBeInTheDocument()
  get.mockResolvedValueOnce({
    data: {
      success: true,
      data: {
        ...statistics,
        date: '2026-09-14',
        hours: statistics.hours.map((hour) => ({
          ...hour,
          requests: 0,
          redeemed_quota: 0,
          redeemed_count: 0,
          online_topup: 0,
          subscription_topup: 0,
          topup_count: 0,
        })),
      },
    },
  })
  await user.click(options.getByRole('option', { name: '2026-09-14' }))
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      '/api/data/statistics',
      expect.objectContaining({ params: { date: '2026-09-14' } })
    )
  )
  await screen.findByRole('region', { name: 'Request count' })
  expect(selector).toHaveTextContent('2026-09-14')
  expect(
    within(screen.getByRole('region', { name: 'Request count' })).getAllByText(
      '0'
    ).length
  ).toBeGreaterThan(0)
  expect(
    within(screen.getByRole('region', { name: 'Redemption' })).getByText(
      '🍪 0 / 0 transactions'
    )
  ).toBeVisible()
  expect(
    within(screen.getByRole('region', { name: 'Top-up' })).getByText(
      '¥0.00 / 0 transactions'
    )
  ).toBeVisible()
})

it('uses 笔 for transaction totals and 直充/订阅 labels in Chinese', async () => {
  i18next.addResourceBundle('zh', 'translation', zh.translation)
  await i18next.changeLanguage('zh')
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: statistics },
  })
  renderStatistics()
  const redemption = await screen.findByRole('region', { name: '兑换' })
  expect(within(redemption).getByText('🍪 1,000 / 5 笔')).toBeVisible()
  const topup = screen.getByRole('region', { name: '充值' })
  expect(within(topup).getByText('¥688.50 / 3 笔')).toBeVisible()
  expect(within(topup).getByText('直充 ¥88.50 · 订阅 ¥600.00')).toBeVisible()
})

it('shows a retry action instead of misleading zero totals when statistics fail to load', async () => {
  vi.spyOn(api, 'get').mockRejectedValue(new Error('Statistics unavailable'))
  renderStatistics()
  expect(await screen.findByText('Statistics unavailable')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
  expect(
    screen.queryByRole('region', { name: 'Request count' })
  ).not.toBeInTheDocument()
})
