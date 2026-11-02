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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { ScrollingAnnouncementSection } from '../scrolling-announcement-section'

it('saves a broadcast and allows clearing its content to stop it', async () => {
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  const page = render(
    <QueryClientProvider client={client}>
      <ScrollingAnnouncementSection defaultValue='' />
    </QueryClientProvider>
  )
  try {
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '  双十一活动通知  ' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Save scrolling announcement' })
    )
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/api/option/', {
        key: 'console_setting.scrolling_announcement',
        value: '双十一活动通知',
      })
    )
    page.rerender(
      <QueryClientProvider client={client}>
        <ScrollingAnnouncementSection defaultValue='双十一活动通知' />
      </QueryClientProvider>
    )
    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled())
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Save scrolling announcement' })
    )
    await waitFor(() =>
      expect(put).toHaveBeenLastCalledWith('/api/option/', {
        key: 'console_setting.scrolling_announcement',
        value: '',
      })
    )
  } finally {
    page.unmount()
    client.clear()
    vi.restoreAllMocks()
  }
})
