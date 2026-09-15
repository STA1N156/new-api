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
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, assert, expect, test, vi } from 'vitest'

import { PlaygroundCamera } from '../playground-camera'

const originalMediaDevices = Object.getOwnPropertyDescriptor(
  navigator,
  'mediaDevices'
)
afterEach(() => {
  if (originalMediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices)
  } else {
    Reflect.deleteProperty(navigator, 'mediaDevices')
  }
})

test('releases camera access if the dialog closes while permission is pending', async () => {
  const stop = vi.fn()
  let grant!: (stream: MediaStream) => void
  const getUserMedia = vi.fn(
    () =>
      new Promise<MediaStream>((resolve) => {
        grant = resolve
      })
  )
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  })
  const { unmount } = render(
    <PlaygroundCamera onClose={vi.fn()} onCapture={vi.fn()} />
  )
  unmount()
  await act(async () =>
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream)
  )
  expect(stop).toHaveBeenCalledOnce()
})

test('captures a JPEG and releases the camera on unmount', async () => {
  const stop = vi.fn()
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }),
    },
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    (callback) => callback(new Blob(['photo'], { type: 'image/jpeg' }))
  )
  const onCapture = vi.fn()
  const { container, unmount } = render(
    <PlaygroundCamera onClose={vi.fn()} onCapture={onCapture} />
  )
  const video = container.ownerDocument.querySelector('video')
  assert(video)
  Object.defineProperties(video, {
    videoWidth: { value: 640 },
    videoHeight: { value: 480 },
  })
  fireEvent.loadedData(video)
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Take photo' }))
  await waitFor(() =>
    expect(onCapture).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'photo.jpg', type: 'image/jpeg' })
    )
  )
  unmount()
  expect(stop).toHaveBeenCalledOnce()
})

test('shows an actionable message when camera permission is denied', async () => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockRejectedValue(new Error('denied')) },
  })
  render(<PlaygroundCamera onClose={vi.fn()} onCapture={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Camera unavailable. Allow camera access or upload a photo.'
  )
  expect(screen.getByRole('button', { name: 'Take photo' })).toBeDisabled()
})
