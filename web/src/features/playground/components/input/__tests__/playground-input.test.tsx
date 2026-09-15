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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../../../constants'
import { PlaygroundInput } from '../playground-input'

afterEach(() => vi.unstubAllGlobals())

test('uploads and sends an image without text, and clears the attachment after sending', async () => {
  const image = new File(['image'], 'photo.png', { type: 'image/png' })
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = () => 'blob:photo'
      static revokeObjectURL = vi.fn()
    }
  )
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: async () => image }))
  const onSubmit = vi.fn()
  const user = userEvent.setup()
  render(
    <PlaygroundInput
      config={DEFAULT_CONFIG}
      parameterEnabled={DEFAULT_PARAMETER_ENABLED}
      onSubmit={onSubmit}
      onConfigChange={vi.fn()}
      onParameterEnabledChange={vi.fn()}
      models={[{ value: 'vision', label: 'Vision' }]}
      modelValue='vision'
      onModelChange={vi.fn()}
      groups={[{ value: 'default', label: 'Default', ratio: 1 }]}
      groupValue='default'
      onGroupChange={vi.fn()}
    />
  )

  expect(screen.getAllByRole('button', { name: /Send/ })[0]).toBeDisabled()
  await user.upload(screen.getByLabelText('Upload files'), image)
  expect(screen.getAllByRole('button', { name: /Send/ })[0]).toBeEnabled()
  expect(
    screen.getByRole('button', { name: 'Remove attachment' })
  ).toBeInTheDocument()
  await user.click(screen.getAllByRole('button', { name: /Send/ })[0])
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith('', [
      'data:image/png;base64,aW1hZ2U=',
    ])
  )
  expect(
    screen.queryByRole('button', { name: 'Remove attachment' })
  ).not.toBeInTheDocument()
})

test('provides only photo actions and the simplified settings with a system prompt', async () => {
  const user = userEvent.setup()
  const onConfigChange = vi.fn()
  render(
    <PlaygroundInput
      config={DEFAULT_CONFIG}
      parameterEnabled={DEFAULT_PARAMETER_ENABLED}
      onSubmit={vi.fn()}
      onConfigChange={onConfigChange}
      onParameterEnabledChange={vi.fn()}
      models={[{ value: 'vision', label: 'Vision' }]}
      modelValue='vision'
      onModelChange={vi.fn()}
      groups={[{ value: 'default', label: 'Default', ratio: 1 }]}
      groupValue='default'
      onGroupChange={vi.fn()}
    />
  )

  expect(
    screen.queryByRole('button', { name: 'Search' })
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Attach' }))
  expect(
    screen.getAllByRole('menuitem').map((item) => item.textContent)
  ).toEqual(['Upload photo', 'Take photo'])
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'Parameters' }))
  expect(screen.queryByText('Temperature')).not.toBeInTheDocument()
  expect(screen.getAllByRole('switch')).toHaveLength(1)
  await user.type(screen.getByRole('textbox', { name: 'System prompt' }), 'A')
  expect(onConfigChange).toHaveBeenCalledWith('system_prompt', 'A')
})
