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
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { createOAuthFlow } from '../../api'
import { SignUp } from '../index'

let client: QueryClient
const initialConfig = useSystemConfigStore.getState().config
const firstQuestion = 'Is the inviter a friend you know?'
const secondQuestion =
  'If this invitation link is later found to have been shared by a stranger in comments, QQ groups or similar places, your account will be permanently banned. Do you confirm registering with this invitation link?'

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  localStorage.clear()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['status'], {
    email_verification: false,
    turnstile_check: false,
  })
  vi.spyOn(api, 'post').mockImplementation(async (url) => ({
    data:
      url === '/api/oauth/state'
        ? { success: true, data: 'test-flow' }
        : { success: false },
  }))
})

afterEach(() => {
  cleanup()
  client.clear()
  localStorage.clear()
  useSystemConfigStore.getState().setConfig(initialConfig)
  vi.useRealTimers()
})

async function openSignUp(entry = '/sign-up?aff=friend-code') {
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <Outlet />
      </QueryClientProvider>
    ),
  })
  const route = createRoute({
    getParentRoute: () => root,
    path: '/sign-up',
    component: SignUp,
  })
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: [entry] }),
  })
  await act(async () => {
    await router.load()
    render(<RouterProvider router={router} />)
  })
  return router
}

function choose(first: 'yes' | 'no', second: 'yes' | 'no') {
  fireEvent.click(
    within(screen.getByRole('radiogroup', { name: firstQuestion })).getByRole(
      'radio',
      { name: first === 'yes' ? 'Yes' : 'Not someone I know' }
    )
  )
  fireEvent.click(
    within(screen.getByRole('radiogroup', { name: secondQuestion })).getByRole(
      'radio',
      {
        name:
          second === 'yes'
            ? 'Confirm, the inviter is someone I know.'
            : 'Register on my own without an invitation code.',
      }
    )
  )
}

async function submitRegistration() {
  fireEvent.change(screen.getByLabelText('Username'), {
    target: { value: 'new-user' },
  })
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), {
    target: { value: 'test-password' },
  })
  fireEvent.change(screen.getByLabelText('Confirm password', { exact: true }), {
    target: { value: 'test-password' },
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  })
}

it('blocks confirmation and registration for the full ten seconds even when both first answers are selected', async () => {
  await openSignUp()
  expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
  expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0)
  choose('yes', 'yes')
  expect(screen.getByRole('button', { name: 'Confirm (10s)' })).toBeDisabled()
  await act(async () => vi.advanceTimersByTime(9999))
  expect(screen.getByRole('button', { name: 'Confirm (1s)' })).toBeDisabled()
  await act(async () => vi.advanceTimersByTime(1))
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled()
})

it('requires an answer to both questions after the countdown and cannot be bypassed with Escape', async () => {
  await openSignUp()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  await act(async () => vi.advanceTimersByTime(10000))
  expect(screen.getByRole('dialog')).toBeVisible()
  expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  fireEvent.click(screen.getByRole('radio', { name: 'Yes' }))
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
})

it('uses the link invitation for registration and OAuth only after both first answers are confirmed', async () => {
  localStorage.setItem('aff', 'older-code')
  const router = await openSignUp()
  choose('yes', 'yes')
  await act(async () => vi.advanceTimersByTime(10000))
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  )
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(router.state.location.searchStr).toBe('?aff=friend-code')
  expect(localStorage.getItem('aff')).toBe('friend-code')
  await submitRegistration()
  expect(api.post).toHaveBeenCalledWith(
    '/api/user/register',
    expect.objectContaining({ aff_code: 'friend-code' }),
    expect.anything()
  )
  await createOAuthFlow('github', 'login')
  expect(api.post).toHaveBeenCalledWith(
    '/api/oauth/state',
    expect.objectContaining({ aff: 'friend-code' }),
    expect.anything()
  )
})

it.each([
  ['no', 'yes'],
  ['yes', 'no'],
  ['no', 'no'],
] as const)(
  'removes URL and saved invitations when the answers are %s / %s',
  async (first, second) => {
    localStorage.setItem('aff', 'older-code')
    const router = await openSignUp()
    choose(first, second)
    await act(async () => vi.advanceTimersByTime(10000))
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    )
    expect(router.state.location.href).toBe('/sign-up')
    expect(localStorage.getItem('aff')).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await submitRegistration()
    expect(api.post).toHaveBeenCalledWith(
      '/api/user/register',
      expect.objectContaining({ aff_code: '' }),
      expect.anything()
    )
    await createOAuthFlow('github', 'login')
    expect(api.post).toHaveBeenCalledWith(
      '/api/oauth/state',
      expect.objectContaining({ aff: undefined }),
      expect.anything()
    )
  }
)

it('opens ordinary registration immediately when there is no invitation', async () => {
  await openSignUp('/sign-up')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Username')).toBeVisible()
})

it('also asks for confirmation when an invitation was saved by a previous landing page', async () => {
  localStorage.setItem('aff', 'saved-code')
  await openSignUp('/sign-up')
  expect(screen.getByRole('dialog')).toBeVisible()
  expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
})

it('resets answers and the countdown when another invitation link is opened', async () => {
  const router = await openSignUp()
  choose('yes', 'yes')
  await act(async () => vi.advanceTimersByTime(10000))
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  )
  await act(async () => {
    await router.navigate({ to: '/sign-up', search: { aff: 'another-friend' } })
  })
  expect(screen.getByRole('button', { name: 'Confirm (10s)' })).toBeDisabled()
  expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0)
  expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
})
