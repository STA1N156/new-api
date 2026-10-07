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

it('fades new characters without remounting earlier text or splitting emoji', () => {
  const { container, rerender } = render(
    <Response animate final={false}>
      你好👩‍💻
    </Response>
  )
  const firstCharacter = container.querySelector('[data-stream-fade]')
  expect(firstCharacter).toHaveTextContent('你')
  expect(
    Array.from(
      container.querySelectorAll('[data-stream-fade]'),
      (node) => node.textContent
    )
  ).toEqual(['你', '好', '👩‍💻'])

  rerender(
    <Response animate final={false}>
      你好👩‍💻，继续输出。
    </Response>
  )
  expect(container).toHaveTextContent('你好👩‍💻，继续输出。')
  expect(container.querySelector('[data-stream-fade]')).toBe(firstCharacter)
  rerender(
    <Response animate final>
      你好👩‍💻，继续输出。
    </Response>
  )
  expect(container.querySelector('[data-stream-fade]')).toBe(firstCharacter)
})

it('does not replay animation when displaying saved completed messages', () => {
  const { container } = render(
    <Response animate final>
      Already finished
    </Response>
  )
  expect(container).toHaveTextContent('Already finished')
  expect(container.querySelector('[data-stream-fade]')).toBeNull()
})

it('reveals later streaming batches from left to right while earlier text stays still', () => {
  const prefix = '这是已经输出的第一段文字。'
  const { container, rerender } = render(
    <Response animate final={false}>
      {prefix}
    </Response>
  )
  const first = container.querySelector<HTMLElement>('[data-stream-fade]')
  const initialDelay = first?.style.animationDelay
  rerender(
    <Response animate final={false}>
      {`${prefix}继续生成`}
    </Response>
  )
  const added = [
    ...container.querySelectorAll<HTMLElement>('[data-stream-fade]'),
  ].slice(-4)
  const delays = added.map((node) =>
    Number.parseFloat(node.style.animationDelay)
  )
  expect(added).toHaveLength(4)
  expect(delays[0]).toBeLessThan(delays[1] ?? 0)
  expect(delays[1]).toBeLessThan(delays[2] ?? 0)
  expect(delays[2]).toBeLessThan(delays[3] ?? 0)
  expect(container.querySelector('[data-stream-fade]')).toBe(first)
  expect(first?.style.animationDelay).toBe(initialDelay)
})
