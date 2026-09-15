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
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/context/theme-provider'
import * as perfApi from '@/features/performance-metrics/api'

import { ModelDetailsContent } from '../components/model-details'
import { ModelDetailsPerformance } from '../components/model-details-performance'

vi.hoisted(() => {
  // Charts probe canvas support on import; jsdom has no drawing context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

let client: QueryClient
const model = {
  id: 1,
  model_name: 'example-model',
  quota_type: 0,
  model_ratio: 1,
  completion_ratio: 2,
  enable_groups: ['default'],
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.spyOn(perfApi, 'getPerfMetrics').mockResolvedValue({
    success: true,
    data: {
      model_name: model.model_name,
      groups: [
        {
          group: 'default',
          avg_ttft_ms: 100,
          avg_latency_ms: 200,
          avg_tps: 30,
          success_rate: 100,
          series: [],
        },
      ],
    },
  })
})
afterEach(() => client.clear())

it('loads six-hour performance data without incident counts', async () => {
  render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <ModelDetailsPerformance model={model} />
      </QueryClientProvider>
    </ThemeProvider>
  )
  expect(await screen.findByText('Success rate (last 6h)')).toBeVisible()
  expect(perfApi.getPerfMetrics).toHaveBeenCalledWith(model.model_name, 6)
  expect(screen.queryByText('Availability (last 24h)')).not.toBeInTheDocument()
  expect(screen.queryByText('Per-group performance')).not.toBeInTheDocument()
  expect(screen.queryByText('Latency trend (last 24h)')).not.toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByText('TPS')).toBeVisible()
  expect(screen.getByText('Success rate')).toBeVisible()
  expect(screen.getByText('Last 6 hours')).toBeVisible()
  expect(screen.queryByText(/incidents/i)).not.toBeInTheDocument()
})

it('keeps the model-name copy button working inside Details', async () => {
  const user = userEvent.setup()
  render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <ModelDetailsContent
          model={model}
          groupRatio={{ default: 1 }}
          usableGroup={{ default: { desc: '', ratio: 1 } }}
          endpointMap={{}}
          autoGroups={[]}
          priceRate={1}
          tokenUnit='M'
        />
      </QueryClientProvider>
    </ThemeProvider>
  )
  await user.click(screen.getByRole('button', { name: 'Copy model name' }))
  expect(await navigator.clipboard.readText()).toBe('example-model')
  expect(screen.getByRole('button', { name: 'Copied' })).toBeVisible()
  fireEvent.click(screen.getByRole('tab', { name: 'Performance' }))
  expect(await screen.findByText('Success rate (last 6h)')).toBeVisible()
  expect(perfApi.getPerfMetrics).toHaveBeenCalledWith(model.model_name, 6)
})
