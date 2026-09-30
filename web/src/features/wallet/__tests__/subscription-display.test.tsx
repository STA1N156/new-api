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
import { expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { SubscriptionPlansCard } from '../components/subscription-plans-card'

it('shows a wrapping title, expiry countdown without a warning label and independent quota progress', async () => {
  const now = Math.floor(Date.now() / 1000)
  const title = 'A very long subscription title '.repeat(6)
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: {
      success: true,
      data:
        url === '/api/subscription/plans'
          ? [
              {
                plan: {
                  id: 7,
                  title,
                  price_amount: 98,
                  total_amount: 15000000,
                  duration_unit: 'day',
                  duration_value: 30,
                  max_purchase_per_user: 1,
                },
              },
            ]
          : {
              billing_preference: 'subscription_first',
              all_subscriptions: [
                {
                  subscription: {
                    id: 42,
                    user_id: 1,
                    plan_id: 7,
                    status: 'active',
                    start_time: now - 3600,
                    end_time: now + 1800,
                    amount_total: 15000000,
                    amount_used: 6000000,
                    is_preferred: true,
                  },
                },
              ],
            },
    },
  }))
  render(<SubscriptionPlansCard topupInfo={null} />)
  const card = await screen.findByRole('article', { name: 'Subscription #42' })
  expect(card).not.toHaveClass('border-primary/25')
  expect(within(card).getByText(title.trim())).toHaveClass(
    'break-words',
    'min-w-0'
  )
  expect(within(card).queryByText('Expiring soon')).not.toBeInTheDocument()
  expect(within(card).getByText('Active')).toBeVisible()
  expect(within(card).getByText('Expires at')).toBeVisible()
  expect(within(card).getByRole('meter')).toHaveAttribute('aria-valuenow', '40')
  expect(
    within(card).getByRole('button', { name: 'Using first' })
  ).toBeDisabled()
  expect(within(card).queryByText('1 days remaining')).not.toBeInTheDocument()
})
