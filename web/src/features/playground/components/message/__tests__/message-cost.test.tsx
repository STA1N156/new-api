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
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import type { Message } from '../../../types'
import { MessageMetadata } from '../message-metadata'

const initialUser = useAuthStore.getState().auth.user
const initialConfig = useSystemConfigStore.getState().config
let client: QueryClient
const message: Message = {
  key: 'reply',
  from: 'assistant',
  versions: [{ id: 'reply-v1', content: 'Hello' }],
  status: 'complete',
  durationMs: 4700,
  requestId: 'request-to-bill',
}

beforeEach(() => {
  client = new QueryClient()
  useAuthStore.getState().auth.setUser({
    id: 42,
    username: 'playground-test',
    role: 1,
    group: 'default',
  })
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...initialConfig.currency,
      displayInCurrency: true,
      quotaDisplayType: 'CUSTOM',
      quotaPerUnit: 500000,
      customCurrencySymbol: '🍪',
      customCurrencyExchangeRate: 10,
    },
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  useAuthStore.getState().auth.setUser(initialUser)
  useSystemConfigStore.getState().setConfig(initialConfig)
  vi.useRealTimers()
})

function renderMetadata(value: Message = message) {
  return render(
    <QueryClientProvider client={client}>
      <MessageMetadata alignment='left' message={value} />
    </QueryClientProvider>
  )
}

it.each([
  [235000, '🍪 4.7'],
  [0, '🍪 0'],
  [1, '🍪 0.00002'],
])(
  'shows the actual charge of %s quota instead of response time',
  async (quota, cost) => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        success: true,
        data: { items: [{ request_id: message.requestId, type: 2, quota }] },
      },
    })
    renderMetadata()
    expect(await screen.findByText(`Cost: ${cost}`)).toBeVisible()
    expect(screen.queryByText(/Response time/)).not.toBeInTheDocument()
    expect(get).toHaveBeenCalledWith(
      '/api/log/self',
      expect.objectContaining({
        params: { request_id: message.requestId, type: 2, page_size: 1 },
      })
    )
  }
)

it('does not invent a charge for legacy messages without a request ID', () => {
  const get = vi.spyOn(api, 'get')
  renderMetadata({ ...message, requestId: undefined })
  expect(screen.getByText('Cost: —')).toBeVisible()
  expect(get).not.toHaveBeenCalled()
})

it('waits for settlement and refreshes when the matching charge arrives', async () => {
  vi.useFakeTimers()
  vi.spyOn(api, 'get')
    .mockResolvedValueOnce({ data: { success: true, data: { items: [] } } })
    .mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          items: [{ request_id: message.requestId, type: 2, quota: 50000 }],
        },
      },
    })
  await act(async () => {
    renderMetadata()
  })
  expect(screen.getByText('Cost: —')).toBeVisible()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1100)
  })
  expect(screen.getByText('Cost: 🍪 1')).toBeVisible()
})

it('does not query or display a charge while the response is streaming', () => {
  const get = vi.spyOn(api, 'get')
  renderMetadata({ ...message, status: 'streaming' })
  expect(screen.queryByText(/Cost:/)).not.toBeInTheDocument()
  expect(get).not.toHaveBeenCalled()
})

it('keeps an unavailable charge blank and stops polling instead of using another request', async () => {
  vi.useFakeTimers()
  const get = vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        items: [{ request_id: 'another-request', type: 2, quota: 999999 }],
      },
    },
  })
  await act(async () => {
    renderMetadata()
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20000)
  })
  expect(screen.getByText('Cost: —')).toBeVisible()
  expect(get).toHaveBeenCalledTimes(10)
})
