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
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { AnnouncementBanner } from '@/components/announcement-banner'
import { NotificationPopover } from '@/components/notification-popover'
import * as api from '@/lib/api'
import { useNotificationStore } from '@/stores/notification-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { useNotifications } from '../use-notifications'

let client: QueryClient
const initialConfig = useSystemConfigStore.getState().config
const first = {
  id: 1,
  content: 'First timeline update',
  publishDate: '2026-09-06',
  type: 'info',
}
const second = {
  id: 2,
  content: 'Second timeline update',
  publishDate: '2026-09-07',
  type: 'info',
}

function NotificationCenter() {
  const notifications = useNotifications()
  return (
    <>
      <AnnouncementBanner
        count={notifications.pendingAnnouncementCount}
        onView={notifications.viewAnnouncementBanner}
      />
      <NotificationPopover
        open={notifications.popoverOpen}
        onOpenChange={notifications.setPopoverOpen}
        unreadCount={notifications.unreadCount}
        activeTab={notifications.activeTab}
        onTabChange={notifications.setActiveTab}
        notice={notifications.notice}
        announcements={notifications.announcements}
        loading={notifications.loading}
      />
    </>
  )
}

function renderNotifications() {
  return render(
    <QueryClientProvider client={client}>
      <NotificationCenter />
    </QueryClientProvider>
  )
}

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
    announcements: [first],
  })
})

afterEach(() => {
  client.clear()
  useSystemConfigStore.getState().setConfig(initialConfig)
  localStorage.clear()
})

it('keeps the banner through bell viewing and remount, and dismisses only after View opens the timeline', async () => {
  const page = renderNotifications()
  expect(await screen.findByRole('status')).toHaveTextContent(
    'New system announcements (1)'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
  fireEvent.click(await screen.findByRole('tab', { name: 'Timeline' }))
  expect(await screen.findByText('First timeline update')).toBeVisible()
  expect(screen.getByRole('status')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  page.unmount()

  const nextPage = renderNotifications()
  expect(await screen.findByRole('status')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'View' }))
  expect(await screen.findByRole('tab', { name: 'Timeline' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(screen.getByText('First timeline update')).toBeVisible()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  nextPage.unmount()
  renderNotifications()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(
    JSON.parse(localStorage.getItem('notification-storage') ?? '{}').state
      .viewedBannerAnnouncementKeys
  ).toEqual(['id:1'])
})

it('shows the banner again when a later update arrives after viewing the previous one', async () => {
  useNotificationStore.setState({
    viewedBannerAnnouncementKeys: ['id:1'],
    readAnnouncementKeys: ['id:1'],
  })
  renderNotifications()
  await waitFor(() => expect(api.getStatus).toHaveBeenCalled())
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  vi.mocked(api.getStatus).mockResolvedValue({
    announcements_enabled: true,
    announcements: [second, first],
  })
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['status'] })
  })
  expect(await screen.findByRole('status')).toHaveTextContent(
    'New system announcements (1)'
  )
})

it.each([false, true])(
  'does not show a timeline banner for plain notices when announcements enabled is %s',
  async (enabled) => {
    vi.mocked(api.getStatus).mockResolvedValue({
      announcements_enabled: enabled,
      announcements: enabled ? [] : [first],
    })
    vi.mocked(api.getNotice).mockResolvedValue({
      success: true,
      data: 'A plain notice',
    })
    renderNotifications()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Notifications' })
      ).toHaveTextContent('1')
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  }
)

it('migrates previously read announcements without showing them as new', async () => {
  localStorage.setItem(
    'notification-storage',
    JSON.stringify({
      version: 0,
      state: {
        readAnnouncementKeys: ['id:1'],
        lastReadNotice: '',
        closedUntilDate: null,
      },
    })
  )
  await useNotificationStore.persist.rehydrate()
  renderNotifications()
  await waitFor(() => expect(api.getStatus).toHaveBeenCalled())
  expect(useNotificationStore.getState().viewedBannerAnnouncementKeys).toEqual([
    'id:1',
  ])
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
