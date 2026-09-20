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
import { beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { sendChatCompletion } from '../../../api'
import { STORAGE_KEYS } from '../../../constants'
import { applyChatCompletionResponse } from '../../message/message-streaming-utils'
import {
  createLoadingAssistantMessage,
  createUserMessage,
} from '../../message/message-utils'
import { accessMessageStore } from '../message-store'
import { loadMessages, saveMessages } from '../storage'
import { MAX_STORED_MESSAGES_BYTES } from '../storage-schema'

vi.mock('../message-store', () => ({ accessMessageStore: vi.fn() }))

beforeEach(() => {
  localStorage.clear()
  let stored: unknown
  vi.mocked(accessMessageStore).mockImplementation(async (messages) => {
    if (messages) stored = structuredClone(messages)
    return structuredClone(stored)
  })
})

test('preserves image history larger than the legacy localStorage limit', async () => {
  const image = `data:image/jpeg;base64,${'a'.repeat(MAX_STORED_MESSAGES_BYTES)}`
  const messages = [createUserMessage('', 1, [image])]
  await saveMessages(messages)
  expect(await loadMessages()).toEqual(messages)
})

test('keeps the non-streaming server request ID after saving and reopening the conversation', async () => {
  vi.spyOn(api, 'post').mockResolvedValue({
    headers: { 'x-oneapi-request-id': 'server-request-id' },
    data: {
      id: 'upstream-completion-id',
      choices: [{ message: { content: 'Hello' } }],
    },
  })
  const response = await sendChatCompletion({
    model: 'test',
    messages: [],
    stream: false,
  })
  const message = applyChatCompletionResponse(
    createLoadingAssistantMessage(),
    response
  )
  expect(message).toMatchObject({
    requestId: 'server-request-id',
    status: 'complete',
  })
  if (!message) throw new Error('Missing response message')
  await saveMessages([message])
  expect(await loadMessages()).toEqual([message])
})

test('keeps legacy conversations and migrates them on the next save', async () => {
  const messages = [createUserMessage('Existing conversation', 1)]
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages))
  expect(await loadMessages()).toEqual(messages)
  await saveMessages(messages)
  expect(localStorage.getItem(STORAGE_KEYS.MESSAGES)).toBeNull()
  expect(await loadMessages()).toEqual(messages)
})

test('keeps the legacy copy if writing the new store fails', async () => {
  const messages = [createUserMessage('Existing conversation', 1)]
  const saved = JSON.stringify(messages)
  localStorage.setItem(STORAGE_KEYS.MESSAGES, saved)
  vi.mocked(accessMessageStore).mockRejectedValueOnce(new Error('Storage full'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await saveMessages(messages)
  expect(localStorage.getItem(STORAGE_KEYS.MESSAGES)).toBe(saved)
})
