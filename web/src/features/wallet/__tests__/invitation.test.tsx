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
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { formatQuota } from '@/lib/format'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { AffiliateRewardsCard } from '../components/affiliate-rewards-card'
import type { UserWalletData } from '../types'

const initialConfig = useSystemConfigStore.getState().config
beforeEach(() => {
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...initialConfig.currency,
      quotaDisplayType: 'CUSTOM',
      quotaPerUnit: 500000,
      customCurrencySymbol: '🍪',
      customCurrencyExchangeRate: 10,
    },
  })
})
afterEach(() => useSystemConfigStore.getState().setConfig(initialConfig))

const user: UserWalletData = {
  id: 1,
  username: 'sender',
  quota: 0,
  used_quota: 0,
  request_count: 0,
  aff_quota: 500000,
  aff_history_quota: 1500000,
  aff_count: 3,
  group: 'default',
}

it('separates signup earnings, top-up commission and available rewards', () => {
  const transfer = vi.fn()
  const rewardedUser = {
    ...user,
    aff_topup_quota: 1000000,
    aff_inviter_reward: 50000,
    aff_invitee_reward: 100000,
    aff_topup_reward_percent: 8,
  }
  render(
    <AffiliateRewardsCard
      user={rewardedUser}
      affiliateLink='https://example.com/register?aff=sender'
      onTransfer={transfer}
    />
  )
  expect(screen.getByRole('heading', { name: 'Invite Program' })).toBeVisible()
  expect(
    within(screen.getByRole('group', { name: 'Signup earnings' })).getByText(
      formatQuota(500000)
    )
  ).toBeVisible()
  expect(
    within(screen.getByRole('group', { name: 'Top-up earnings' })).getByText(
      formatQuota(1000000)
    )
  ).toBeVisible()
  expect(
    within(screen.getByRole('group', { name: 'Available rewards' })).getByText(
      formatQuota(500000)
    )
  ).toBeVisible()
  expect(screen.getByText('Earn 8% of the amount as rewards')).toBeVisible()
  expect(
    screen.getByText(
      'Every time your friend tops up, subscribes or redeems a code'
    ).parentElement
  ).toHaveClass('bg-muted/35')
  expect(
    screen.queryByText(
      'Rewards are added after successful payment. Existing paid orders are not rewarded again; subscription purchases and redemption codes are excluded.'
    )
  ).not.toBeInTheDocument()
  expect(
    screen.queryByText(
      'One-time invitation bonuses, in addition to the standard signup balance.'
    )
  ).not.toBeInTheDocument()
  expect(
    screen.queryByText(
      'Based on credited top-up balance. Your friend keeps the full amount; your reward is extra.'
    )
  ).not.toBeInTheDocument()
  expect(
    screen
      .getAllByRole('group')
      .map((group) => group.getAttribute('aria-label'))
  ).toEqual([
    'Available rewards',
    'Top-up earnings',
    'Signup earnings',
    'Invited Users',
    'Total Earned',
  ])
  expect(screen.getByText(`You receive ${formatQuota(50000)}`)).toBeVisible()
  expect(
    screen.getByText(`Your friend receives ${formatQuota(100000)}`)
  ).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Invitation link' })).toHaveValue(
    'https://example.com/register?aff=sender'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Transfer to Balance' }))
  expect(transfer).toHaveBeenCalledOnce()
})

it('preserves old signup income when there is no top-up commission yet', () => {
  render(
    <AffiliateRewardsCard user={user} affiliateLink='' onTransfer={vi.fn()} />
  )
  expect(
    within(screen.getByRole('group', { name: 'Signup earnings' })).getByText(
      formatQuota(1500000)
    )
  ).toBeVisible()
  expect(
    within(screen.getByRole('group', { name: 'Top-up earnings' })).getByText(
      formatQuota(0)
    )
  ).toBeVisible()
})

it('disables transfer for an empty account', () => {
  render(
    <AffiliateRewardsCard user={null} affiliateLink='' onTransfer={vi.fn()} />
  )
  expect(
    screen.getByRole('button', { name: 'Transfer to Balance' })
  ).toBeDisabled()
  expect(screen.getByText('Earn 8% of the amount as rewards')).toBeVisible()
})

it('disables transfer when the existing payment compliance gate is closed', () => {
  render(
    <AffiliateRewardsCard
      user={user}
      affiliateLink=''
      onTransfer={vi.fn()}
      complianceConfirmed={false}
    />
  )
  expect(
    screen.getByRole('button', { name: 'Transfer to Balance' })
  ).toBeDisabled()
  expect(
    screen.getByText(
      'Invitation rewards are paused until payment compliance is confirmed.'
    )
  ).toBeVisible()
})
