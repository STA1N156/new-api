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
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { Festival } from '..'
import type { FestivalStatus } from '../api'
import { FestivalDrawPanel } from '../components/festival-draw-panel'
import { FestivalProgress } from '../components/festival-progress'

const initialUser = useAuthStore.getState().auth.user
let client: QueryClient
let status: FestivalStatus
const refresh = vi.fn()

beforeEach(() => {
  sessionStorage.clear()
  refresh.mockReset()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthStore.getState().auth.setUser({
    id: 42,
    username: 'festival-test',
    role: 1,
    group: 'default',
  })
  status = {
    campaign: 'autumn-2026',
    starts_at: 1790265600,
    ends_at: 1791388800,
    server_time: 1790500000,
    state: 'active',
    credited_cookies: 1000,
    earned: 3,
    remaining: 3,
    won_cookies: 0,
    records: [],
    milestones: [
      { cookies: 500, chances: 1 },
      { cookies: 1000, chances: 2 },
      { cookies: 2000, chances: 2 },
      { cookies: 3000, chances: 3 },
      { cookies: 4000, chances: 3 },
      { cookies: 5000, chances: 4 },
    ],
    prizes: [
      { cookies: 50, weight: 5500 },
      { cookies: 100, weight: 3500 },
      { cookies: 200, weight: 500 },
      { cookies: 300, weight: 250 },
      { cookies: 500, weight: 150 },
      { cookies: 1000, weight: 100 },
    ],
  }
})
afterEach(() => {
  client.clear()
  useAuthStore.getState().auth.setUser(initialUser)
  sessionStorage.clear()
  vi.useRealTimers()
})

async function renderPanel(content?: ReactNode) {
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        {content ?? <FestivalDrawPanel data={status} onRefresh={refresh} />}
      </QueryClientProvider>
    ),
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
  return screen.findByRole('button', { name: /Draw now|Retry last draw/ })
}

it('blocks draws before opening and has no preview entry', async () => {
  status.state = 'upcoming'
  const post = vi.spyOn(api, 'post')
  const draw = await renderPanel()
  expect(draw).toBeDisabled()
  fireEvent.click(draw)
  expect(
    screen.queryByRole('button', { name: 'Try the wheel · no rewards' })
  ).not.toBeInTheDocument()
  expect(post).not.toHaveBeenCalled()
})

it('uses the server prize, blocks another draw during animation, and shows the credited result', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({
    data: {
      success: true,
      data: {
        id: 1,
        request_id: 'saved',
        number: 1,
        cookies: 300,
        created_at: 1790500000,
      },
    },
  })
  const button = await renderPanel()
  vi.useFakeTimers()
  await act(async () => {
    fireEvent.click(button)
  })
  await act(async () => {
    vi.advanceTimersByTime(0)
  })
  expect(screen.getByRole('button', { name: 'Drawing…' })).toBeDisabled()
  expect(post).toHaveBeenCalledTimes(1)
  await act(async () => {
    vi.advanceTimersByTime(3500)
  })
  expect(screen.getByText('You won 300🍪!')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Draw now' })).toBeEnabled()
  expect(sessionStorage.getItem('festival-draw:autumn-2026:42')).toBeNull()
})

it('reveals the updated total and history only after the wheel stops, even when status refreshes during the spin', async () => {
  status.won_cookies = 50
  status.remaining = 2
  const previous = {
    id: 1,
    request_id: 'previous-draw',
    number: 1,
    cookies: 50,
    created_at: status.server_time - 60,
  }
  const prize = {
    id: 2,
    request_id: 'current-draw',
    number: 2,
    cookies: 300,
    created_at: status.server_time,
  }
  status.records = [previous]
  client.setQueryData(['festival', 42], status)
  vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, data: prize },
  })
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        ...status,
        won_cookies: 350,
        remaining: 1,
        records: [prize, previous],
      },
    },
  })
  const button = await renderPanel(<Festival />)
  vi.useFakeTimers()
  await act(async () => {
    fireEvent.click(button)
  })
  await act(async () => {
    vi.advanceTimersByTime(0)
    await client.refetchQueries({ queryKey: ['festival', 42] })
  })
  await act(async () => {
    vi.advanceTimersByTime(3000)
  })
  expect(screen.getByRole('button', { name: 'Drawing…' })).toBeDisabled()
  expect(screen.queryByText('350🍪')).not.toBeInTheDocument()
  expect(screen.queryByText('+300🍪')).not.toBeInTheDocument()
  await act(async () => {
    vi.advanceTimersByTime(500)
  })
  expect(screen.getByText('You won 300🍪!')).toBeVisible()
  expect(screen.getByText('350🍪')).toBeVisible()
  expect(screen.getByText('+300🍪')).toBeVisible()
})

it('retries an uncertain network result with the same request ID instead of spending twice', async () => {
  const post = vi
    .spyOn(api, 'post')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({
      data: {
        success: true,
        data: { id: 2, number: 1, cookies: 50, created_at: 1790500000 },
      },
    })
  const button = await renderPanel()
  fireEvent.click(button)
  const retry = await screen.findByRole('button', { name: 'Retry last draw' })
  await waitFor(() => expect(retry).toBeEnabled())
  fireEvent.click(retry)
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
  expect(post.mock.calls[0][1]).toEqual(post.mock.calls[1][1])
})

it.each([
  {
    credited: 300,
    granted: 0,
    next: '200🍪 more to unlock 1 additional draws',
  },
  {
    credited: 999.5,
    granted: 1,
    next: '0.5🍪 more to unlock 2 additional draws',
  },
  {
    credited: 2000,
    granted: 3,
    next: '1,000🍪 more to unlock 3 additional draws',
  },
  {
    credited: 4000,
    granted: 5,
    next: '1,000🍪 more to unlock 4 additional draws',
  },
])(
  'shows earned milestones and the next target after $credited cookies',
  ({ credited, granted, next }) => {
    status.credited_cookies = credited
    render(<FestivalProgress data={status} />)
    const progress = screen.getByRole('progressbar', {
      name: 'Cumulative progress',
    })
    expect(progress).toHaveAttribute('aria-valuenow', String(credited))
    expect(progress).toHaveAttribute('aria-valuemax', '5000')
    expect(screen.queryAllByText('Granted')).toHaveLength(granted)
    expect(screen.getByText(next)).toBeVisible()
  }
)

it('caps the progress bar at the last milestone while retaining the actual credited amount', () => {
  status.credited_cookies = 9000
  render(<FestivalProgress data={status} />)
  expect(screen.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '5000'
  )
  expect(screen.getByText('9,000🍪')).toBeVisible()
  expect(screen.getAllByText('Granted')).toHaveLength(6)
  expect(
    screen.getByText('All 15 bonus draws have been unlocked.')
  ).toBeVisible()
})
