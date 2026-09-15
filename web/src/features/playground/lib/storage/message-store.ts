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
import type { Message } from '../../types'

// Images exceed localStorage's small limit; keep chat history in IndexedDB.
export function accessMessageStore(messages?: Message[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('new-api-playground', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('messages')
    request.addEventListener('error', () => reject(request.error))
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction(
        'messages',
        messages ? 'readwrite' : 'readonly'
      )
      const store = transaction.objectStore('messages')
      const operation = messages
        ? store.put(messages, 'history')
        : store.get('history')
      transaction.addEventListener('complete', () => {
        database.close()
        resolve(operation.result)
      })
      transaction.addEventListener('abort', () => {
        database.close()
        reject(transaction.error)
      })
    }
  })
}
