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

it('shows the full cycle allowance next to its label while keeping percentage usage', () => {
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
    expect(screen.getByText('·').parentElement).toHaveClass('gap-x-0.5')
    expect(screen.getByText('40%')).toHaveClass('text-xs')
    expect(screen.getByText('300🍪')).toBeVisible()
    expect(screen.getByText('40%')).toBeVisible()
  } finally {
    useSystemConfigStore.getState().setConfig(previous)
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(subscription.start_time * 1000)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('adjusts complete square counts to the container width while preserving the usage percentage', () => {
  let resize = (_width: number): void => {
    throw new Error('ResizeObserver was not attached')
  }
  const disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      callback: ResizeObserverCallback
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }
      observe(target: Element) {
        resize = (width: number) =>
          this.callback(
            [
              {
                target,
                contentRect: new DOMRect(0, 0, width, 6),
                borderBoxSize: [],
                contentBoxSize: [],
                devicePixelContentBoxSize: [],
              },
            ],
            this
          )
      }
      unobserve() {}
      disconnect = disconnect
    }
  )

  const { unmount } = render(
    <SubscriptionQuotaUsage
      subscription={{ ...subscription, quota_limits: [] }}
      active={false}
    />
  )
  const meter = screen.getByRole('meter')
  for (const [width, expectedCount, expectedUsed] of [
    [0, 0, 0],
    [5.9, 0, 0],
    [6, 1, 1],
    [197.9, 24, 10],
    [198, 25, 10],
    [428.67, 53, 22],
    [798, 100, 40],
    [198, 25, 10],
  ]) {
    act(() => resize(width))
    expect(meter.querySelectorAll('span')).toHaveLength(expectedCount)
    expect(meter.querySelectorAll('.bg-current')).toHaveLength(expectedUsed)
    expect(meter).toHaveAttribute('aria-valuenow', '40')
  }
  unmount()
  expect(disconnect).toHaveBeenCalledOnce()
})

it('shows each cycle as an accessible percentage meter without raw quota amounts', () => {
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
  expect(screen.getByText('Waiting for reset')).toBeVisible()
  expect(screen.getByText('Waiting for reset')).toHaveClass('text-rose-600/90')
  expect(screen.getAllByText('Next reset')).toHaveLength(2)
  for (const label of screen.getAllByText('Next reset')) {
    expect(label.parentElement).toHaveClass('text-[10px]')
    expect(label.parentElement?.querySelector('svg')).toHaveClass('size-3')
  }
  expect(container).not.toHaveTextContent('🍪')
  expect(container).not.toHaveTextContent('120/300')
  expect(container).not.toHaveTextContent('Remaining')
})

it.each([
  [69.9, 'text-emerald-600/90'],
  [70, 'text-amber-600/90'],
  [90, 'text-amber-600/90'],
  [90.1, 'text-rose-600/90'],
  [100, 'text-rose-600/90'],
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
  expect(screen.queryByText('Next reset')).not.toBeInTheDocument()
  expect(screen.queryByText('Waiting for reset')).not.toBeInTheDocument()
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
    expect(cycle.getByText('Next reset')).toBeVisible()
    expect(cycle.queryByText('Waiting for reset') !== null).toBe(
      percent === '100'
    )
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
    expect(screen.getAllByText('下一次重置')).toHaveLength(2)
    const times = container.querySelectorAll('time')
    expect(times).toHaveLength(2)
    const mainTime = screen
      .getByRole('region', { name: i18n.t('Total Quota') })
      .querySelector('time')
    expect(mainTime).toHaveAttribute(
      'dateTime',
      new Date((subscription.next_reset_time || 0) * 1000).toISOString()
    )
    expect(mainTime).toHaveTextContent('7天0小时0分钟后')
  }
)

it.each([
  [-1, 'In 0m'],
  [0, 'In 0m'],
  [59, 'In 0m'],
  [60, 'In 1m'],
  [3599, 'In 59m'],
  [3600, 'In 1h 0m'],
  [86399, 'In 23h 59m'],
  [86400, 'In 1d 0h 0m'],
  [90061, 'In 1d 1h 1m'],
])(
  'shows a floored countdown when reset is %s seconds away',
  (seconds, expected) => {
    const { container } = render(
      <SubscriptionQuotaUsage
        subscription={{
          ...subscription,
          quota_limits: [],
          next_reset_time: subscription.start_time + seconds,
        }}
        active
      />
    )
    expect(container.querySelector('time')).toHaveTextContent(expected)
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
  expect(container.querySelector('time')).toHaveTextContent('In 0m')
  unmount()
  expect(vi.getTimerCount()).toBe(0)
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
    expect(screen.queryByText('Waiting for reset')).not.toBeInTheDocument()
  }
)
