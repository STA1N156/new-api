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
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { SubscriptionPlansCard } from '@/features/wallet/components/subscription-plans-card'
import { api } from '@/lib/api'

import type { UserSubscriptionRecord } from '../types'

let subscriptions: UserSubscriptionRecord[]
let queryClient: QueryClient

beforeEach(() => {
  const now = Math.floor(Date.now() / 1000)
  subscriptions = [1, 2].map((id) => ({
    subscription: {
      id,
      user_id: 1,
      plan_id: 1,
      status: 'active',
      start_time: now - 100,
      end_time: now + 86400,
      amount_total: 100,
      amount_used: 25,
    },
  }))
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: {
      success: true,
      data:
        url === '/api/subscription/plans'
          ? [
              {
                plan: {
                  id: 1,
                  title: 'Monthly',
                  price_amount: 10,
                  max_purchase_per_user: 2,
                  duration_unit: 'month',
                  duration_value: 1,
                },
              },
            ]
          : {
              billing_preference: 'subscription_first',
              all_subscriptions: subscriptions,
              subscriptions,
            },
    },
  }))
})

afterEach(() => {
  queryClient.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function renderSubscriptions() {
  return render(
    <QueryClientProvider client={queryClient}>
      <SubscriptionPlansCard topupInfo={null} />
    </QueryClientProvider>
  )
}

it('persists a selected subscription, pins it first and keeps the selection after refresh', async () => {
  const put = vi.spyOn(api, 'put').mockImplementation(async () => {
    subscriptions = subscriptions.map((item) => ({
      subscription: {
        ...item.subscription,
        is_preferred: item.subscription.id === 2,
      },
    }))
    return { data: { success: true } }
  })
  const user = userEvent.setup()
  renderSubscriptions()
  const second = await screen.findByRole('article', {
    name: 'Subscription #2',
  })
  await user.click(within(second).getByRole('button', { name: 'Use first' }))
  expect(put).toHaveBeenCalledWith('/api/subscription/self/2/priority')
  expect(
    await screen.findByRole('button', { name: 'Using first' })
  ).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getAllByRole('article')[0]).toHaveAccessibleName(
    'Subscription #2'
  )
  await user.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(screen.getAllByRole('article')[0]).toHaveAccessibleName(
    'Subscription #2'
  )
})

it('keeps the existing order when saving priority fails', async () => {
  vi.spyOn(api, 'put').mockResolvedValue({
    data: { success: false, message: 'Unavailable' },
  })
  const user = userEvent.setup()
  renderSubscriptions()
  const second = await screen.findByRole('article', {
    name: 'Subscription #2',
  })
  await user.click(within(second).getByRole('button', { name: 'Use first' }))
  expect(screen.getAllByRole('article')[0]).toHaveAccessibleName(
    'Subscription #1'
  )
  expect(
    screen.queryByRole('button', { name: 'Using first' })
  ).not.toBeInTheDocument()
  expect(
    within(second).getByRole('button', { name: 'Use first' })
  ).toBeEnabled()
})

it('hides expired and cancelled subscriptions but still counts them toward the purchase limit', async () => {
  subscriptions[0].subscription.end_time = Math.floor(Date.now() / 1000)
  subscriptions[1].subscription.status = 'cancelled'
  renderSubscriptions()
  expect(await screen.findByText('No active subscriptions')).toBeVisible()
  expect(screen.queryByRole('meter')).not.toBeInTheDocument()
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Limit Reached' })).toBeDisabled()
  expect(screen.queryByText('Expired')).not.toBeInTheDocument()
})

it('removes a subscription when it expires while the wallet remains open', async () => {
  vi.useFakeTimers()
  subscriptions = [subscriptions[0]]
  subscriptions[0].subscription.end_time = Math.floor(Date.now() / 1000) + 2
  await act(async () => {
    renderSubscriptions()
  })
  expect(screen.getByRole('article')).toBeVisible()
  await act(async () => vi.advanceTimersByTime(3000))
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.getByText('No active subscriptions')).toBeVisible()
})
