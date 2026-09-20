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
import { renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'

import { useSidebarData } from '../use-sidebar-data'

it('places Statistics immediately after Users and limits it to super administrators', () => {
  const { result } = renderHook(() => useSidebarData())
  const items =
    result.current.navGroups.find((group) => group.id === 'admin')?.items ?? []
  const usersIndex = items.findIndex(
    (item) => 'url' in item && item.url === '/users'
  )
  expect(items[usersIndex + 1]).toMatchObject({
    title: 'Statistics',
    url: '/statistics',
    requiredRole: 100,
  })
})

it('provides a Model Square link in General without requiring an administrator role', () => {
  const { result } = renderHook(() => useSidebarData())
  const general = result.current.navGroups.find(
    (group) => group.id === 'general'
  )
  expect(general?.items).toContainEqual(
    expect.objectContaining({ title: 'Model Square', url: '/pricing' })
  )
  const item = general?.items.find(
    (entry) => 'url' in entry && entry.url === '/pricing'
  )
  expect(item?.requiredRole).toBeUndefined()
  expect(general?.items).toContainEqual(
    expect.objectContaining({ title: 'Autumn Festival', url: '/festival' })
  )
})
