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
import i18next from 'i18next'
import { afterEach, expect, it, vi } from 'vitest'

import { useSystemConfigStore } from '@/stores/system-config-store'

import { ModelCard } from '../components/model-card'
import type { PricingModel } from '../types'

const model: PricingModel = {
  id: 1,
  model_name: 'example-model',
  quota_type: 0,
  model_ratio: 1,
  completion_ratio: 1,
  enable_groups: ['default'],
}

const initialConfig = useSystemConfigStore.getState().config
afterEach(async () => {
  useSystemConfigStore.getState().setConfig(initialConfig)
  await i18next.changeLanguage('en')
})

it.each([undefined, '', '   '])(
  'omits the description block when description is %s',
  (description) => {
    const { container } = render(
      <ModelCard model={{ ...model, description }} onClick={vi.fn()} />
    )
    expect(screen.getByRole('heading', { name: 'example-model' })).toBeVisible()
    expect(
      screen.queryByText('No description available.')
    ).not.toBeInTheDocument()
    expect(container.querySelector('p')).toBeNull()
  }
)

it('shows a supplied model description', () => {
  render(
    <ModelCard
      model={{ ...model, description: 'A useful description' }}
      onClick={vi.fn()}
    />
  )
  expect(screen.getByText('A useful description')).toBeVisible()
})

it('gives a long model name the header row beside its icon and Details without a copy action', () => {
  const onDetails = vi.fn()
  const name = 'provider/model-with-a-long-name-and-version-2026-09'
  render(
    <ModelCard model={{ ...model, model_name: name }} onClick={onDetails} />
  )
  const heading = screen.getByRole('heading', { name })
  expect(heading).toHaveClass('min-w-0', 'flex-1', 'truncate')
  expect(heading).toHaveAttribute('title', name)
  const header = heading.parentElement
  expect(header).toHaveClass('flex', 'items-center')
  if (!header) throw new Error('Missing model header')
  expect(within(header).getByRole('button', { name: 'Details' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Details' }))
  expect(onDetails).toHaveBeenCalledOnce()
})

it.each([
  {
    name: 'token prices',
    pricing: { cache_ratio: 0.25 },
    labels: ['Input', 'Output', 'Cached'],
  },
  {
    name: 'dynamic prices',
    pricing: {
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("default", p * 2 + c * 4 + cr * 0.5)',
    },
    labels: ['Input', 'Output', 'Cache Read'],
  },
])(
  'places $name below the header, one left-aligned row per price',
  ({ pricing, labels }) => {
    render(<ModelCard model={{ ...model, ...pricing }} onClick={vi.fn()} />)
    const rows = labels.map((label) => screen.getByText(label))
    const priceList = rows[0].parentElement
    expect(priceList).toHaveClass('flex-col', 'items-start', 'text-left')
    if (!priceList) throw new Error('Missing price list')
    for (const row of rows) expect(row.parentElement).toBe(priceList)
    expect([...priceList.children]).toEqual(rows)
    expect(screen.getByRole('heading').parentElement).not.toContainElement(
      rows[0]
    )
  }
)

it('keeps a request price on its own row without inventing token prices', () => {
  render(
    <ModelCard
      model={{ ...model, quota_type: 1, model_price: 0.5 }}
      onClick={vi.fn()}
    />
  )
  const unit = screen.getByText('/ request')
  expect(unit.parentElement?.parentElement).toHaveClass(
    'flex-col',
    'items-start',
    'text-left'
  )
  expect(screen.queryByText('Input')).not.toBeInTheDocument()
  expect(screen.queryByText('Output')).not.toBeInTheDocument()
})

it.each([
  {
    kind: 'token',
    pricing: { completion_ratio: 2, cache_ratio: 0.25 },
    cacheLabel: 'Cached',
  },
  {
    kind: 'dynamic',
    pricing: {
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("default", p * 2 + c * 4 + cr * 0.5)',
    },
    cacheLabel: 'Cache Read',
  },
])(
  'shows $kind prices with a token unit without a secondary yuan price',
  ({ pricing, cacheLabel }) => {
    useSystemConfigStore.getState().setConfig({
      currency: {
        ...initialConfig.currency,
        quotaDisplayType: 'CUSTOM',
        customCurrencySymbol: '🍪',
        customCurrencyExchangeRate: 20,
        usdExchangeRate: 10,
      },
    })
    const props = {
      model: {
        ...model,
        ...pricing,
        enable_groups: ['default', 'premium'],
        group_ratio: { default: 1, premium: 2 },
      },
      priceRate: 3,
      selectedGroup: 'premium',
      onClick: vi.fn(),
    }
    const { rerender } = render(<ModelCard {...props} />)
    for (const [label, quota, yuan] of [
      ['Input', '🍪 80', '¥12'],
      ['Output', '🍪 160', '¥24'],
      [cacheLabel, '🍪 20', '¥3'],
    ]) {
      const row = screen.getByText(label)
      expect(row).toHaveClass('whitespace-nowrap')
      expect(within(row).getByText(quota)).toBeVisible()
      expect(within(row).getByText('/ million')).toBeVisible()
      expect(within(row).queryByText(yuan)).not.toBeInTheDocument()
    }
    rerender(<ModelCard {...props} tokenUnit='K' />)
    for (const [label, quota, yuan] of [
      ['Input', '🍪 0.08', '¥0.012'],
      ['Output', '🍪 0.16', '¥0.024'],
      [cacheLabel, '🍪 0.02', '¥0.003'],
    ]) {
      const row = screen.getByText(label)
      expect(within(row).getByText(quota)).toBeVisible()
      expect(within(row).getByText('/ thousand')).toBeVisible()
      expect(within(row).queryByText(yuan)).not.toBeInTheDocument()
    }
    rerender(<ModelCard {...props} showRechargePrice />)
    expect(screen.queryByText(/🍪/)).not.toBeInTheDocument()
    expect(screen.getAllByText('¥12')).toHaveLength(1)
  }
)

it('shows a configured zero cache price without a secondary yuan price', () => {
  render(
    <ModelCard
      model={{ ...model, cache_ratio: 0 }}
      priceRate={3}
      onClick={vi.fn()}
    />
  )
  expect(within(screen.getByText('Cached')).getByText('$0')).toBeVisible()
  expect(screen.queryByText(/¥/)).not.toBeInTheDocument()
  expect(
    within(screen.getByText('Cached')).getByText('/ million')
  ).toBeVisible()
})

it('shows a green configured token discount instead of group names or group overflow', () => {
  render(
    <ModelCard
      model={{
        ...model,
        model_discount: 5.5,
        enable_groups: ['default', 'premium'],
      }}
      onClick={vi.fn()}
    />
  )
  expect(screen.getByText('45% off official price')).toHaveClass(
    'text-emerald-600'
  )
  expect(screen.queryByText('default')).not.toBeInTheDocument()
  expect(screen.queryByText('premium')).not.toBeInTheDocument()
  expect(screen.queryByText('+1')).not.toBeInTheDocument()
})

it.each([
  { quota_type: 0 },
  { quota_type: 1, model_price: 0.5, model_discount: 5.5 },
])(
  'omits both group and discount when the token discount is unset or the model uses requests',
  (pricing) => {
    render(<ModelCard model={{ ...model, ...pricing }} onClick={vi.fn()} />)
    expect(screen.queryByText('default')).not.toBeInTheDocument()
    expect(screen.queryByText(/off official price$/)).not.toBeInTheDocument()
  }
)

it('shows the Chinese discount scale as 官方价5.5折', async () => {
  const locale = await import('@/i18n/locales/zh.json')
  i18next.addResourceBundle('zh', 'translation', locale.default.translation)
  await i18next.changeLanguage('zh')
  render(
    <ModelCard model={{ ...model, model_discount: 5.5 }} onClick={vi.fn()} />
  )
  expect(screen.getByText('官方价5.5折')).toBeVisible()
})
