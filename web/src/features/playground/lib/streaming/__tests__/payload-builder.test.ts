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
import { assert, describe, expect, test } from 'vitest'

import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../../../constants'
import {
  appendUserMessagePair,
  applyMessageEdit,
  createRegeneratedMessages,
} from '../../message/conversation-message-utils'
import {
  playgroundConfigSchema,
  parameterEnabledSchema,
} from '../../storage/storage-schema'
import { buildChatCompletionPayload } from '../payload-builder'

describe('playground request content', () => {
  test('sends the system prompt first and images as image content', () => {
    const messages = appendUserMessagePair([], 'What is this?', [
      'data:image/png;base64,aGVsbG8=',
    ])
    const payload = buildChatCompletionPayload(
      messages,
      {
        ...DEFAULT_CONFIG,
        system_prompt: 'Answer in Chinese.',
      },
      DEFAULT_PARAMETER_ENABLED
    )

    expect(payload.messages).toEqual([
      { role: 'system', content: 'Answer in Chinese.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,aGVsbG8=' },
          },
        ],
      },
    ])
  })

  test('retains image-only messages when editing and regenerating', () => {
    const messages = appendUserMessagePair([], '', [
      'data:image/jpeg;base64,aGVsbG8=',
    ])
    const edited = applyMessageEdit(
      messages,
      messages[0].key,
      'Read this image',
      true
    )
    assert(edited)
    const regenerated = createRegeneratedMessages(
      edited.messages,
      edited.messages[1].key
    )
    assert(regenerated)
    const payload = buildChatCompletionPayload(
      regenerated,
      DEFAULT_CONFIG,
      DEFAULT_PARAMETER_ENABLED
    )

    expect(payload.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Read this image' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/jpeg;base64,aGVsbG8=' },
          },
        ],
      },
    ])
  })

  test.each([true, false])(
    'ignores old temperature settings and always sends 1 (previously enabled: %s)',
    (temperatureEnabled) => {
      const config = playgroundConfigSchema.parse({
        ...DEFAULT_CONFIG,
        temperature: 0.2,
        top_p: 0.4,
        frequency_penalty: 1,
        presence_penalty: 1,
        seed: 123,
      })
      const enabled = parameterEnabledSchema.parse({
        ...DEFAULT_PARAMETER_ENABLED,
        temperature: temperatureEnabled,
        top_p: true,
        frequency_penalty: true,
        presence_penalty: true,
        seed: true,
      })
      const payload = buildChatCompletionPayload(
        appendUserMessagePair([], 'Hi'),
        {
          ...DEFAULT_CONFIG,
          ...config,
        },
        { ...DEFAULT_PARAMETER_ENABLED, ...enabled }
      )

      expect(payload).toEqual({
        model: DEFAULT_CONFIG.model,
        group: DEFAULT_CONFIG.group,
        stream: true,
        messages: [{ role: 'user', content: 'Hi' }],
        temperature: 1,
      })
    }
  )
})
