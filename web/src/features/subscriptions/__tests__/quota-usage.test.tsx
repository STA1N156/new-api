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
import { act, render, screen, within } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import zh from '@/i18n/locales/zh.json'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { SubscriptionQuotaUsage } from '../components/subscription-quota-usage'
import type { UserSubscription } from '../types'

const subscription: UserSubscription = {
  id: 1,
  user_id: 1,
  plan_id: 1,
  status: 'active',
  start_time: 1788678000,
  end_time: 1791097200,
  amount_total: 300,
  amount_used: 120,
  next_reset_time: 1789282800,
  quota_limits: [
    {
      period_seconds: 18000,
      amount_total: 50,
      amount_used: 50,
      last_reset_time: 1788678000,
    },
  ],
}

it('shows usage amounts and a plain percentage without a remaining quota summary', () => {
  const previous = useSystemConfigStore.getState().config
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...previous.currency,
      quotaDisplayType: 'CUSTOM',
      quotaPerUnit: 500000,
      customCurrencySymbol: '🍪',
      customCurrencyExchangeRate: 10,
    },
  })
  try {
    render(
      <SubscriptionQuotaUsage
        subscription={{
          ...subscription,
          amount_total: 15000000,
          amount_used: 6000000,
          quota_limits: null,
        }}
        plan={{ quota_reset_period: 'weekly' }}
        active
      />
    )
    expect(screen.getByText('Weekly Quota')).toBeVisible()
    expect(screen.queryByText('180🍪')).not.toBeInTheDocument()
    expect(screen.getByText('40%').parentElement?.className).not.toMatch(
      /bg-|rounded/
    )
    expect(screen.getByText('120🍪 / 300🍪')).toBeVisible()
    expect(screen.getByText('40%')).toBeVisible()
    const usageRow = screen.getByText('120🍪 / 300🍪').parentElement
    expect(usageRow).toHaveClass('flex', 'items-baseline', 'flex-wrap')
    expect(screen.getByText('Weekly Quota').parentElement).toBe(usageRow)
    expect(screen.getByText('Weekly Quota')).toHaveClass(
      'text-muted-foreground'
    )
    expect(screen.getByText('120🍪 / 300🍪')).toHaveClass(
      'text-muted-foreground'
    )
    expect(screen.getByText('40%').parentElement).toBe(usageRow?.parentElement)
    expect(screen.getByText('40%')).toHaveClass('shrink-0')
    expect(screen.queryByText('Used', { exact: true })).not.toBeInTheDocument()
  } finally {
    useSystemConfigStore.getState().setConfig(previous)
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(subscription.start_time * 1000)
})

it.each([86401, 86400, 1, 0])(
  'keeps expiry neutral and full-width with a wrapping countdown: %s seconds left',
  (seconds) => {
    render(
      <SubscriptionQuotaUsage
        subscription={{
          ...subscription,
          end_time: subscription.start_time + seconds,
        }}
        active
      />
    )
    const validity = screen.getByRole('region', {
      name: 'Subscription validity',
    })
    expect(validity).toHaveClass(
      'text-muted-foreground',
      'flex-wrap',
      'justify-between'
    )
    expect(validity.className).not.toMatch(/amber|border|bg-|\bpx-/)
    expect(validity.firstElementChild).toHaveClass('flex-1', 'min-w-0')
    expect(validity.lastElementChild).toHaveClass('text-muted-foreground')
    expect(validity.lastElementChild).not.toHaveClass('font-medium')
    expect(validity.lastElementChild).toHaveClass(
      'ml-auto',
      'max-w-full',
      'break-words'
    )
    expect(screen.queryByText('Expiring soon')).not.toBeInTheDocument()
  }
)

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it.each([
  [0, 0],
  [120, 40],
  [300, 100],
  [400, 100],
])('renders a continuous bar for %s used, clamped to %s%%', (used, percent) => {
  render(
    <SubscriptionQuotaUsage
      subscription={{ ...subscription, amount_used: used, quota_limits: [] }}
      active
    />
  )
  const meter = screen.getByRole('meter')
  expect(meter).toHaveAttribute('aria-valuenow', String(percent))
  expect(meter).toHaveClass('rounded-full', 'overflow-hidden', 'h-1.5')
  expect(meter.firstElementChild).toHaveStyle({ width: `${percent}%` })
  expect(meter.children).toHaveLength(1)
})

it('shows independent accessible meters with readable reset and usage summaries', () => {
  const { container } = render(
    <SubscriptionQuotaUsage
      subscription={subscription}
      active
      plan={{
        quota_reset_period: 'custom',
        quota_reset_custom_seconds: 604800,
      }}
    />
  )
  expect(
    screen.getByRole('meter', { name: 'Quota per 7 days' })
  ).toHaveAttribute('aria-valuenow', '40')
  expect(
    screen.getByRole('meter', { name: 'Quota per 5 hours' })
  ).toHaveAttribute('aria-valuenow', '100')
  expect(screen.getByText('40%')).toBeVisible()
  expect(screen.getByText('100%')).toBeVisible()
  for (const meter of screen.getAllByRole('meter')) {
    const cycle = meter.closest('section')
    expect(cycle).toHaveClass('min-w-0', 'space-y-3')
    expect(cycle?.className).not.toMatch(
      /(?:^|\s)(?:\S*:)?(?:border|bg-|p[xy]?-[\d])/
    )
  }
  expect(screen.getByText('Exhausted')).toBeVisible()
  expect(screen.getByText('Exhausted')).toHaveClass('text-muted-foreground')
  expect(screen.getAllByText('Reset')).toHaveLength(2)
  expect(screen.getByText('In 5h 0m').parentElement).not.toHaveClass(
    'text-foreground',
    'font-medium'
  )
  for (const label of screen.getAllByText('Reset')) {
    expect(label.parentElement).toHaveClass('flex-wrap')
    expect(label.parentElement?.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
  }
  expect(container).not.toHaveTextContent('🍪')
  expect(container).not.toHaveTextContent('120/300')
  expect(screen.queryByText('Remaining')).not.toBeInTheDocument()
})

it.each([
  [74.9, 'text-emerald-700'],
  [75, 'text-amber-700'],
  [89.9, 'text-amber-700'],
  [90, 'text-rose-700'],
  [100, 'text-rose-700'],
])('uses the requested warning color when usage is %s%%', (percent, color) => {
  render(
    <SubscriptionQuotaUsage
      subscription={{
        ...subscription,
        amount_total: 1000,
        amount_used: percent * 10,
        quota_limits: [],
      }}
      active
    />
  )
  expect(screen.getByRole('meter')).toHaveClass(color)
  expect(screen.getByText(`${percent}%`)).toHaveClass(color)
})

it('handles unlimited and expired subscriptions without misleading percentages or reset prompts', () => {
  render(
    <SubscriptionQuotaUsage
      subscription={{ ...subscription, amount_total: 0, quota_limits: null }}
      active={false}
    />
  )
  expect(screen.getByText('Unlimited')).toBeVisible()
  expect(screen.queryByRole('meter')).not.toBeInTheDocument()
  expect(screen.queryByText('Reset')).not.toBeInTheDocument()
  expect(screen.queryByText('Exhausted')).not.toBeInTheDocument()
})

it('shows three independent cycles with their own usage and reset times', () => {
  render(
    <SubscriptionQuotaUsage
      subscription={{
        ...subscription,
        amount_used: 180,
        quota_limits: [
          {
            period_seconds: 86400,
            amount_total: 100,
            amount_used: 85,
            last_reset_time: subscription.start_time,
          },
          ...(subscription.quota_limits || []),
        ],
      }}
      plan={{
        quota_reset_period: 'custom',
        quota_reset_custom_seconds: 604800,
      }}
      active
    />
  )
  expect(
    screen
      .getAllByRole('meter')
      .map((meter) => meter.getAttribute('aria-label'))
  ).toEqual(['Quota per 5 hours', 'Quota per 1 days', 'Quota per 7 days'])
  for (const [label, percent] of [
    ['Quota per 7 days', '60'],
    ['Quota per 1 days', '85'],
    ['Quota per 5 hours', '100'],
  ]) {
    const cycle = within(screen.getByRole('region', { name: label }))
    expect(cycle.getByRole('meter')).toHaveAttribute('aria-valuenow', percent)
    expect(cycle.getByText('Reset')).toBeVisible()
    expect(cycle.queryByText('Exhausted') !== null).toBe(percent === '100')
  }
})

it.each(['zhCN', 'zhTW'])(
  'renders reset times with the app language code %s',
  async (language) => {
    const i18n = createInstance()
    await i18n.init({ lng: language, resources: { [language]: zh } })
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <SubscriptionQuotaUsage subscription={subscription} active />
      </I18nextProvider>
    )
    expect(screen.getByText('40%')).toBeVisible()
    expect(screen.getAllByText('重置')).toHaveLength(2)
    expect(screen.queryByText('下一次重置')).not.toBeInTheDocument()
    const times = container.querySelectorAll('time')
    expect(times).toHaveLength(3)
    const mainTime = screen
      .getByRole('region', { name: i18n.t('Total Quota') })
      .querySelector('time')
    expect(mainTime).toHaveAttribute(
      'dateTime',
      new Date((subscription.next_reset_time || 0) * 1000).toISOString()
    )
    expect(mainTime).toHaveTextContent('7天0小时0分钟后')
    expect(
      screen
        .getByRole('region', { name: i18n.t('Total Quota') })
        .querySelectorAll('time')
    ).toHaveLength(1)
    expect(screen.getByText('剩余 28天0小时0分钟')).toBeVisible()
    expect(screen.getByText('已用尽')).toBeVisible()
  }
)

it.each([
  [-1, 'Reset pending'],
  [0, 'Reset pending'],
  [59, 'Less than a minute'],
  [60, 'In 1m'],
  [3599, 'In 59m'],
  [3600, 'In 1h 0m'],
  [86399, 'In 23h 59m'],
  [86400, 'In 1d 0h 0m'],
  [90061, 'In 1d 1h 1m'],
])(
  'shows an honest countdown or pending state when reset is %s seconds away',
  (seconds, expected) => {
    render(
      <SubscriptionQuotaUsage
        subscription={{
          ...subscription,
          quota_limits: [],
          next_reset_time: subscription.start_time + seconds,
        }}
        active
      />
    )
    expect(
      within(screen.getByRole('region', { name: 'Total Quota' })).getByText(
        expected
      )
    ).toBeVisible()
  }
)

it('updates the countdown without a reload and stops its timer when unmounted', () => {
  const { container, unmount } = render(
    <SubscriptionQuotaUsage
      subscription={{
        ...subscription,
        quota_limits: [],
        next_reset_time: subscription.start_time + 61,
      }}
      active
    />
  )
  expect(container.querySelector('time')).toHaveTextContent('In 1m')
  act(() => vi.advanceTimersByTime(2000))
  expect(container.querySelector('time')).toHaveTextContent(
    'Less than a minute'
  )
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('shows a pending reset without pretending the quota has already refreshed', () => {
  render(
    <SubscriptionQuotaUsage
      subscription={{
        ...subscription,
        quota_limits: [],
        next_reset_time: subscription.start_time - 1,
      }}
      active
    />
  )
  expect(screen.getByText('Reset pending')).toBeVisible()
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '40')
  expect(screen.queryByText('In 0m')).not.toBeInTheDocument()
})

it('switches to expired at the deadline and hides reset prompts even with stale active props', () => {
  render(
    <SubscriptionQuotaUsage
      subscription={{ ...subscription, end_time: subscription.start_time + 1 }}
      active
    />
  )
  act(() => vi.advanceTimersByTime(1000))
  expect(screen.getByText('Expired')).toBeVisible()
  expect(screen.queryByText('Reset')).not.toBeInTheDocument()
  expect(screen.queryByText('Exhausted')).not.toBeInTheDocument()
})

it('keeps a reset at or beyond expiry hidden and shows only an expiry label beside remaining time', () => {
  render(
    <SubscriptionQuotaUsage
      subscription={{
        ...subscription,
        quota_limits: [],
        next_reset_time: subscription.end_time,
      }}
      active
    />
  )
  expect(screen.queryByText('Reset')).not.toBeInTheDocument()
  expect(screen.getByText('Expires at')).toBeVisible()
  const validity = screen.getByRole('region', { name: 'Subscription validity' })
  expect(validity.firstElementChild).toHaveTextContent(/^Expires at$/)
  expect(validity.firstElementChild?.querySelector('svg')).toHaveAttribute(
    'aria-hidden',
    'true'
  )
  expect(validity.firstElementChild?.querySelector('time')).toBeNull()
  expect(validity.querySelectorAll('time')).toHaveLength(1)
  expect(validity).toHaveClass('text-xs', 'text-muted-foreground')
  expect(screen.getByText('Expires at')).not.toHaveClass(
    'font-medium',
    'font-semibold'
  )
  expect(validity.lastElementChild).not.toHaveClass(
    'font-medium',
    'font-semibold'
  )
  expect(
    screen
      .getByRole('region', { name: 'Subscription validity' })
      .querySelector('time')
  ).toHaveAttribute(
    'dateTime',
    new Date(subscription.end_time * 1000).toISOString()
  )
})

it.each([
  [0, '0'],
  [-10, '0'],
  [900, '100'],
  [1, '0.3'],
])(
  'keeps a safe readable percentage when used quota is %s',
  (used, expected) => {
    render(
      <SubscriptionQuotaUsage
        subscription={{ ...subscription, amount_used: used, quota_limits: [] }}
        active={false}
      />
    )
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', expected)
    expect(screen.getByText(`${expected}%`)).toBeVisible()
    expect(screen.queryByText('Exhausted')).not.toBeInTheDocument()
  }
)

it('preserves actual over-limit usage without a remaining quota summary', () => {
  render(
    <SubscriptionQuotaUsage
      subscription={{
        ...subscription,
        amount_used: 400,
        quota_limits: [],
        next_reset_time: 0,
      }}
      active
    />
  )
  expect(screen.queryByText('Remaining')).not.toBeInTheDocument()
  expect(
    screen.getByText(
      `${formatQuotaWithCurrency(400, { abbreviate: false })} / ${formatQuotaWithCurrency(300, { abbreviate: false })}`
    )
  ).toBeVisible()
  expect(screen.getByText('Exhausted')).toBeVisible()
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100')
})

it('shows the refreshed usage and countdown only after receiving updated subscription data', () => {
  const pending = {
    ...subscription,
    quota_limits: [],
    next_reset_time: subscription.start_time - 1,
  }
  const { rerender } = render(
    <SubscriptionQuotaUsage subscription={pending} active />
  )
  expect(screen.getByText('Reset pending')).toBeVisible()
  rerender(
    <SubscriptionQuotaUsage
      subscription={{
        ...pending,
        amount_used: 0,
        next_reset_time: subscription.start_time + 3600,
      }}
      active
    />
  )
  expect(screen.queryByText('Reset pending')).not.toBeInTheDocument()
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '0')
  expect(screen.getByText('In 1h 0m')).toBeVisible()
})

it('does not invent an expiry date when the timestamp is absent', () => {
  render(
    <SubscriptionQuotaUsage
      subscription={{ ...subscription, end_time: 0 }}
      active={false}
    />
  )
  expect(
    screen.queryByRole('region', { name: 'Subscription validity' })
  ).not.toBeInTheDocument()
  expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument()
})

it.each([
  [30, 'Less than a minute remaining'],
  [120, 'Remaining 2m'],
  [3720, 'Remaining 1h 2m'],
  [90120, 'Remaining 1d 1h 2m'],
])(
  'shows a remaining duration rather than a reset-style label with %s seconds until expiry',
  (seconds, label) => {
    render(
      <SubscriptionQuotaUsage
        subscription={{
          ...subscription,
          end_time: subscription.start_time + seconds,
          quota_limits: [],
          next_reset_time: 0,
        }}
        active
      />
    )
    const validity = within(
      screen.getByRole('region', { name: 'Subscription validity' })
    )
    expect(validity.getByText(label)).toBeVisible()
    expect(validity.queryByText('Expires in')).not.toBeInTheDocument()
  }
)
