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
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { PublicLayout } from '@/components/layout/components/public-layout'
import * as api from '@/lib/api'
import { useNotificationStore } from '@/stores/notification-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

const initialConfig = useSystemConfigStore.getState().config
let client: QueryClient

beforeEach(() => {
  localStorage.clear()
  useNotificationStore.setState({
    lastReadNotice: '',
    readAnnouncementKeys: [],
    viewedBannerAnnouncementKeys: [],
    closedUntilDate: null,
  })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.spyOn(api, 'getNotice').mockResolvedValue({ success: true, data: '' })
  vi.spyOn(api, 'getStatus').mockResolvedValue({
    announcements_enabled: true,
    announcements: [
      {
        id: 1,
        content: 'New timeline update',
        publishDate: '2026-09-06',
        type: 'info',
      },
    ],
  })
})

afterEach(() => {
  client.clear()
  useSystemConfigStore.getState().setConfig(initialConfig)
  localStorage.clear()
})

it('keeps notifications accessible with compact navigation and reserves room for the banner', async () => {
  const routeTree = createRootRoute({
    component: () => (
      <PublicLayout
        showAuthButtons={false}
        showThemeSwitch={false}
        headerProps={{ showLanguageSwitcher: false }}
      >
        Page content
      </PublicLayout>
    ),
  })
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )

  const banner = await screen.findByRole('status')
  expect(banner.closest('header')).toHaveClass('fixed', 'top-0')
  const menuButton = screen.getByRole('button', {
    name: 'Toggle navigation menu',
  })
  expect(menuButton.parentElement).toHaveClass('md:hidden')
  expect(
    screen.getAllByRole('link', { name: 'Home' })[0].parentElement
  ).toHaveClass('hidden', 'md:flex')
  expect(screen.getByRole('main').parentElement).toHaveClass(
    'has-data-[announcement-banner]:[&>main]:pt-30'
  )
  fireEvent.click(menuButton)
  expect(
    screen.getAllByRole('link', { name: 'Home' })[1].closest('nav')
      ?.parentElement
  ).toHaveClass('pt-30')
  fireEvent.click(menuButton)
  fireEvent.click(screen.getByRole('button', { name: 'View' }))
  expect(await screen.findByRole('tab', { name: 'Timeline' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(screen.getByText('New timeline update')).toBeVisible()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
