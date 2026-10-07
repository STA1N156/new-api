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
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import type { Message } from '../../../types'
import { PlaygroundMessageContent } from '../playground-message-content'

it.each(['user', 'assistant'] as const)(
  'shows %s content without a timestamp or cost footer',
  (from) => {
    const { container } = render(
      <PlaygroundMessageContent
        actions={null}
        alignment='left'
        versionContent='Hello'
        message={{
          key: 'message',
          from,
          versions: [{ id: 'v1', content: 'Hello' }],
          status: 'complete',
          createdAt: 1791388800000,
          requestId: 'request-1',
        }}
      />
    )
    expect(container.textContent).toBe('Hello')
    expect(container.querySelector('time')).toBeNull()
  }
)

it('keeps live thinking collapsed until clicked and preserves the manual choice', () => {
  const message: Message = {
    key: 'thinking-message',
    from: 'assistant',
    versions: [{ id: 'v1', content: '' }],
    status: 'streaming',
    reasoning: { content: 'Thinking details', duration: 1 },
    isReasoningStreaming: true,
  }
  const { rerender } = render(
    <PlaygroundMessageContent
      actions={null}
      alignment='left'
      versionContent=''
      message={message}
    />
  )
  const trigger = screen.getByRole('button', { name: 'Thinking...' })
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(trigger)
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  rerender(
    <PlaygroundMessageContent
      actions={null}
      alignment='left'
      versionContent='Answer'
      message={{ ...message, status: 'complete', isReasoningStreaming: false }}
    />
  )
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
})
