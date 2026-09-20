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
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'

import { useFestival, type FestivalStatus } from '../api'
import { FestivalCard } from '../components/festival-card'
import { FestivalGate } from '../components/festival-gate'

const initialUser = useAuthStore.getState().auth.user
let client: QueryClient
let status: FestivalStatus

beforeEach(() => {
  vi.useFakeTimers()
  // The visitor's clock differs from the server; only elapsed time should matter.
  vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthStore.getState().auth.setUser({
    id: 42,
    username: 'festival-test',
    role: 1,
    group: 'default',
  })
  status = {
    campaign: 'autumn-2026',
    server_time: 100000,
    starts_at: 100002,
    ends_at: 100004,
    state: 'upcoming',
    credited_cookies: 0,
    earned: 0,
    remaining: 0,
    won_cookies: 0,
    records: [],
    milestones: [],
    prizes: [],
  }
})

afterEach(() => {
  cleanup()
  client.clear()
  useAuthStore.getState().auth.setUser(initialUser)
  vi.useRealTimers()
})

function Availability() {
  const { data } = useFestival()
  return (
    <>
      <FestivalGate data={data}>
        <button type='button'>Draw test</button>
      </FestivalGate>
      <FestivalCard />
    </>
  )
}

it('automatically unlocks the page and wallet entry at server opening time, then locks and hides them at closing', async () => {
  client.setQueryData(['festival', 42], status)
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <Availability />
      </QueryClientProvider>
    ),
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await act(async () => {
    render(<RouterProvider router={router} />)
    await router.load()
  })
  expect(
    screen.getByRole('heading', { name: 'The festival has not started' })
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Draw test' })
  ).not.toBeInTheDocument()
  expect(screen.getByText('Draw test').closest('[inert]')).toHaveAttribute(
    'aria-hidden',
    'true'
  )
  expect(screen.queryByText('View festival')).not.toBeInTheDocument()

  await act(async () => {
    vi.advanceTimersByTime(2000)
  })
  expect(screen.getByRole('button', { name: 'Draw test' })).toBeVisible()
  expect(screen.getByText('View festival')).toBeVisible()
  expect(screen.queryByRole('timer')).not.toBeInTheDocument()

  await act(async () => {
    vi.advanceTimersByTime(2000)
  })
  expect(
    screen.getByRole('heading', { name: 'The festival has ended' })
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Draw test' })
  ).not.toBeInTheDocument()
  expect(screen.queryByText('View festival')).not.toBeInTheDocument()
  expect(screen.queryByRole('timer')).not.toBeInTheDocument()
})

it('shows the opening countdown in whole days, hours and minutes', () => {
  status.starts_at = status.server_time + 86400 + 3600 + 61
  render(
    <FestivalGate data={status}>
      <button type='button'>Draw test</button>
    </FestivalGate>
  )
  expect(screen.getByRole('timer')).toHaveTextContent(
    'Opens in 1 days 1 hours 1 minutes'
  )
})
