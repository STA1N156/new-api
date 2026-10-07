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
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it } from 'vitest'

import { useSystemConfigStore } from '@/stores/system-config-store'

import { usageLogSchema } from '../../data/schema'
import { DetailsDialog } from '../dialogs/details-dialog'
import { LogCostDisplay } from '../log-cost-display'
import { LogPriceToggle } from '../log-price-toggle'
import { LogTokensCell } from '../log-tokens-cell'
import { UsageLogsProvider } from '../usage-logs-provider'

const initialConfig = useSystemConfigStore.getState().config
const other = {
  model_ratio: 1000,
  completion_ratio: 4,
  group_ratio: 1,
  cache_tokens: 400,
  cache_ratio: 0.25,
}
const log = usageLogSchema.parse({
  id: 1,
  user_id: 1,
  created_at: 0,
  type: 2,
  content: '',
  quota: 1900000,
  prompt_tokens: 1000,
  completion_tokens: 300,
  other: JSON.stringify(other),
})
afterEach(() => useSystemConfigStore.setState({ config: initialConfig }))

function PricePreview() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <LogPriceToggle />
      <section aria-label='Total'>
        <LogCostDisplay quota={log.quota} other={other} />
      </section>
      <section aria-label='Tokens'>
        <LogTokensCell log={log} showCosts />
      </section>
      <button type='button' onClick={() => setOpen(true)}>
        Open details
      </button>
      <DetailsDialog
        log={log}
        isAdmin={false}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

it('switches totals, input/output/cache charges and detail prices to yuan using the recharge rate', () => {
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...initialConfig.currency,
      quotaDisplayType: 'CUSTOM',
      quotaPerUnit: 500000,
      customCurrencySymbol: '🍪',
      customCurrencyExchangeRate: 10,
      usdExchangeRate: 7,
    },
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], { price: 3 })
  const view = render(
    <QueryClientProvider client={client}>
      <UsageLogsProvider>
        <PricePreview />
      </UsageLogsProvider>
    </QueryClientProvider>
  )
  expect(
    screen
      .getByRole('region', { name: 'Total' })
      .textContent?.replaceAll(/\s/g, '')
  ).toBe('🍪38')
  fireEvent.click(screen.getByRole('tab', { name: 'Recharge' }))
  expect(screen.getByRole('tab', { name: 'Recharge' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(
    screen
      .getByRole('region', { name: 'Total' })
      .textContent?.replaceAll(/\s/g, '')
  ).toBe('¥11.4')
  const tokens = within(screen.getByRole('region', { name: 'Tokens' }))
  expect(tokens.getByText('(¥3.6)')).toBeVisible()
  expect(tokens.getByText('(¥7.2)')).toBeVisible()
  expect(tokens.getByText('(¥0.6)')).toBeVisible()
  fireEvent.click(screen.getByRole('tab', { name: 'Standard' }))
  expect(tokens.getByText('(🍪12)')).toBeVisible()
  fireEvent.click(screen.getByRole('tab', { name: 'Recharge' }))
  fireEvent.click(screen.getByRole('button', { name: 'Open details' }))
  const details = within(screen.getByRole('dialog'))
  expect(details.getByText('¥6,000/M')).toBeVisible()
  expect(details.getByText('¥24,000/M')).toBeVisible()
  expect(details.getByText('¥11.4')).toBeVisible()
  view.unmount()
  client.clear()
})
