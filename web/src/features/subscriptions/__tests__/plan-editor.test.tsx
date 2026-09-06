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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { SubscriptionsMutateDrawer } from '../components/subscriptions-mutate-drawer'
import { SubscriptionsProvider } from '../components/subscriptions-provider'

it('adds and removes cycles, rejects duplicates and saves distinct cycle limits', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data: [] } })
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true } })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={client}>
      <SubscriptionsProvider>
        <SubscriptionsMutateDrawer open onOpenChange={() => undefined} />
      </SubscriptionsProvider>
    </QueryClientProvider>
  )
  await user.type(screen.getByLabelText('Plan Title'), 'Multi-cycle plan')
  await user.click(screen.getByRole('button', { name: 'Add quota cycle' }))
  const overflow = screen.getByRole('switch', {
    name: 'Allow wallet balance after quota used up',
  })
  expect(overflow).toHaveAttribute('aria-disabled', 'true')
  expect(overflow).not.toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Remove' }))
  expect(screen.queryByLabelText('Cycle (hours)')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Add quota cycle' }))
  await user.click(screen.getByRole('button', { name: 'Add quota cycle' }))
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Reset cycles must not repeat')).toBeVisible()
  expect(post).not.toHaveBeenCalled()
  const secondCycle = screen.getAllByLabelText('Cycle (hours)')[1]
  await user.clear(secondCycle)
  await user.type(secondCycle, '24')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/api/subscription/admin/plans',
      expect.objectContaining({
        plan: expect.objectContaining({
          quota_limits: [
            { period_seconds: 18000, amount_total: 25000000 },
            { period_seconds: 86400, amount_total: 25000000 },
          ],
          allow_wallet_overflow: false,
        }),
      })
    )
  )
  client.clear()
})
