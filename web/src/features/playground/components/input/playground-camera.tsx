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
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

export function PlaygroundCamera(props: {
  onClose: () => void
  onCapture: (file: File) => void
}) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | undefined

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }

    void startCamera()
    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const capture = () => {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob && videoRef.current) {
          props.onCapture(new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
        }
      },
      'image/jpeg',
      0.9
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <DialogContent className='sm:max-w-lg' aria-describedby={undefined}>
        <DialogTitle>{t('Take photo')}</DialogTitle>
        {error && (
          <p className='text-destructive text-sm' role='alert'>
            {t('Camera unavailable. Allow camera access or upload a photo.')}
          </p>
        )}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onLoadedData={() => setReady(true)}
          className='aspect-video w-full rounded-lg bg-black object-contain'
        />
        <Button type='button' disabled={!ready || error} onClick={capture}>
          {t('Take photo')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
