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
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import zh from '@/i18n/locales/zh.json'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { RechargeFormCard } from '../components/recharge-form-card'

const initialConfig = useSystemConfigStore.getState().config
beforeEach(() =>
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...initialConfig.currency,
      quotaDisplayType: 'CUSTOM',
      customCurrencySymbol: '🍪',
      customCurrencyExchangeRate: 10,
    },
  })
)
afterEach(() => useSystemConfigStore.getState().setConfig(initialConfig))

const props = {
  topupInfo: {
    enable_online_topup: true,
    enable_stripe_topup: false,
    pay_methods: [],
    min_topup: 1,
    stripe_min_topup: 1,
    amount_options: [10, 30],
    discount: {},
  },
  presetAmounts: [{ value: 10 }, { value: 30, discount: 0.99 }],
  selectedPreset: 30,
  onSelectPreset: vi.fn(),
  topupAmount: 30,
  onTopupAmountChange: vi.fn(),
  paymentAmount: 29.7,
  calculating: false,
  onPaymentMethodSelect: vi.fn(),
  paymentLoading: null,
  redemptionCode: '',
  onRedemptionCodeChange: vi.fn(),
  onRedeem: vi.fn(),
  redeeming: false,
  priceRatio: 1,
  usdExchangeRate: 10,
}

it('shows credited currency, compact discount and yuan savings without changing the selected value', async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'zh', resources: { zh } })
  render(
    <I18nextProvider i18n={i18n}>
      <RechargeFormCard {...props} />
    </I18nextProvider>
  )
  const discounted = screen.getByRole('button', { name: /300🍪/ })
  expect(screen.queryByText(/1¥ =/)).not.toBeInTheDocument()
  expect(within(discounted).getByText('-1%')).toHaveClass(
    'text-[13px]',
    'sm:text-[15px]'
  )
  expect(within(discounted).getByText('¥29.7')).toBeVisible()
  expect(within(discounted).getByText('立省 ¥0.3')).toBeVisible()
  expect(within(discounted).getByText('¥29.7').parentElement).toHaveClass(
    'gap-x-0.5',
    'text-[13px]'
  )
  expect(within(discounted).queryByText(/立减/)).not.toBeInTheDocument()
  const regular = screen.getByRole('button', { name: /100🍪/ })
  expect(within(regular).getByText('¥10')).toBeVisible()
  expect(within(regular).queryByText(/立省|%/)).not.toBeInTheDocument()
  fireEvent.click(discounted)
  expect(props.onSelectPreset).toHaveBeenCalledWith({
    value: 30,
    discount: 0.99,
  })
})

it('uses the configured currency symbol rather than hardcoding cookies on credited amounts', () => {
  useSystemConfigStore.getState().setConfig({
    currency: { ...initialConfig.currency, quotaDisplayType: 'USD' },
  })
  render(<RechargeFormCard {...props} usdExchangeRate={1} />)
  expect(screen.getByRole('button', { name: /30\$/ })).toBeVisible()
  expect(screen.queryByText(/🍪/)).not.toBeInTheDocument()
})

it('shows grouped thousands and keeps each discount beside its credited amount', () => {
  render(
    <RechargeFormCard
      {...props}
      presetAmounts={[
        { value: 300, discount: 0.9 },
        { value: 500, discount: 0.85 },
      ]}
    />
  )
  const presetGrid = screen.getByRole('button', {
    name: /3,000🍪/,
  }).parentElement
  expect(presetGrid).toHaveClass(
    'grid-cols-2',
    '@lg:grid-cols-3',
    '@2xl:grid-cols-4'
  )
  expect(presetGrid).not.toHaveClass('md:grid-cols-4')
  expect(presetGrid?.parentElement).toHaveClass('@container')
  for (const [amount, discount] of [
    ['3,000🍪', '-10%'],
    ['5,000🍪', '-15%'],
  ]) {
    const card = screen.getByRole('button', { name: new RegExp(amount) })
    expect(card).toHaveClass('gap-1.5', 'sm:p-3')
    const label = within(card).getByText(amount)
    expect(label).toHaveClass('whitespace-nowrap')
    expect(label.parentElement).toHaveClass('flex', 'flex-nowrap', 'gap-x-1')
    expect(label.parentElement).toContainElement(
      within(card).getByText(discount)
    )
    expect(within(card).getByText(discount)).toHaveClass('shrink-0')
  }
  expect(screen.queryByText('3000🍪')).not.toBeInTheDocument()
  expect(screen.queryByText('5000🍪')).not.toBeInTheDocument()
})

it('keeps the redemption prompt as plain text with a separate purchase link', () => {
  const { rerender } = render(
    <RechargeFormCard {...props} topupLink='https://example.com/redeem' />
  )
  const link = screen.getByRole('link', {
    name: 'Get one here',
  })
  expect(link).toHaveAttribute('href', 'https://example.com/redeem')
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  expect(link.parentElement?.tagName).toBe('P')
  expect(link.parentElement).toHaveClass('text-muted-foreground', 'text-xs')
  expect(
    within(link).queryByText('Need a redemption code?')
  ).not.toBeInTheDocument()
  expect(link).not.toHaveClass('border', 'bg-gradient-to-r')
  rerender(<RechargeFormCard {...props} />)
  expect(
    screen.queryByRole('link', { name: /Get one here/ })
  ).not.toBeInTheDocument()
  rerender(
    <RechargeFormCard
      {...props}
      topupLink='https://example.com/redeem'
      topupInfo={{ ...props.topupInfo, enable_redemption: false }}
    />
  )
  expect(
    screen.queryByRole('link', { name: /Get one here/ })
  ).not.toBeInTheDocument()
})
