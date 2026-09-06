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
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { Response } from '../response'

it('shows every streaming update immediately without fade wrappers', () => {
  const { container, rerender } = render(
    <Response final={false}>Hello</Response>
  )
  expect(screen.getByText('Hello')).toBeVisible()
  expect(container.querySelector('[data-stream-fade]')).toBeNull()
  rerender(<Response final={false}>Hello world</Response>)
  expect(screen.getByText('Hello world')).toBeVisible()
  expect(container.querySelector('[data-stream-fade]')).toBeNull()
  rerender(<Response final>Hello world</Response>)
  expect(screen.getByText('Hello world')).toBeVisible()
})

it('keeps markdown formatting as an incomplete streaming token becomes complete', () => {
  const { container, rerender } = render(
    <Response final={false}>**fin</Response>
  )
  expect(screen.getByText('fin')).toBeVisible()
  rerender(
    <Response final={false}>
      **final** with `code` and [a link](https://example.com)
    </Response>
  )
  expect(container.querySelector('strong')).toHaveTextContent('final')
  expect(container.querySelector('code')).toHaveTextContent('code')
  expect(screen.getByRole('link', { name: 'a link' })).toHaveAttribute(
    'href',
    'https://example.com'
  )
  expect(container.querySelector('[data-stream-fade]')).toBeNull()
})
