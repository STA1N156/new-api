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
import { render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'

import { useSystemConfigStore } from '@/stores/system-config-store'

import { DynamicPricingBreakdown } from '../components/dynamic-pricing-breakdown'
import { formatDynamicUnitPrice } from '../lib/dynamic-price'
import {
  formatFixedPrice,
  formatGroupPrice,
  formatPrice,
  formatRequestPrice,
} from '../lib/price'
import type { PricingModel } from '../types'

const initialConfig = useSystemConfigStore.getState().config
afterEach(() => useSystemConfigStore.getState().setConfig(initialConfig))

const model: PricingModel = {
  id: 1,
  model_name: 'test-model',
  quota_type: 0,
  model_ratio: 1,
  completion_ratio: 3,
  cache_ratio: 0.2,
  enable_groups: ['default', 'premium'],
  group_ratio: { default: 1, premium: 2 },
}
const fixedModel: PricingModel = {
  ...model,
  quota_type: 1,
  model_price: 0.5,
}

it.each(['USD', 'CNY', 'CUSTOM', 'TOKENS'] as const)(
  'uses yuan for recharge prices when quota display is %s',
  (quotaDisplayType) => {
    useSystemConfigStore.getState().setConfig({
      currency: {
        ...initialConfig.currency,
        quotaDisplayType,
        usdExchangeRate: 10,
        customCurrencySymbol: '🍪',
        customCurrencyExchangeRate: 20,
      },
    })

    expect(formatPrice(model, 'input', 'M', true, 3)).toBe('¥6')
    expect(formatPrice(model, 'output', 'K', true, 3)).toBe('¥0.018')
    expect(formatPrice(model, 'cache', 'M', true, 3)).toBe('¥1.2')
    expect(formatPrice(model, 'input', 'M', true, 3, 'premium')).toBe('¥12')
    expect(
      formatGroupPrice(model, 'premium', 'input', 'M', true, 3, {
        premium: 2,
      })
    ).toBe('¥12')
    expect(formatRequestPrice(fixedModel, true, 3)).toBe('¥1.5')
    expect(
      formatFixedPrice(fixedModel, 'premium', true, 3, { premium: 2 })
    ).toBe('¥3')
    expect(
      formatDynamicUnitPrice(2, {
        tokenUnit: 'M',
        showRechargePrice: true,
        priceRate: 3,
        groupRatioMultiplier: 2,
      })
    ).toBe('¥12')
  }
)

it('keeps custom quota units in standard mode and uses yuan in the tier table', () => {
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...initialConfig.currency,
      quotaDisplayType: 'CUSTOM',
      customCurrencySymbol: '🍪',
      customCurrencyExchangeRate: 20,
    },
  })

  expect(formatPrice(model, 'input', 'M')).toBe('🍪 40')
  expect(formatRequestPrice(fixedModel)).toBe('🍪 10')
  expect(formatDynamicUnitPrice(2, { tokenUnit: 'M' })).toBe('🍪 40')

  render(
    <DynamicPricingBreakdown
      billingExpr='tier("default", p * 2 + c * 4)'
      rechargePriceRate={3}
    />
  )
  expect(screen.getAllByText('¥6.0000').length).toBeGreaterThan(0)
  expect(screen.getAllByText('¥12.0000').length).toBeGreaterThan(0)
  expect(screen.queryByText(/🍪/)).not.toBeInTheDocument()
})
