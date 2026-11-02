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
import { Megaphone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

import '@/styles/scrolling-announcement.css'

export function ScrollingAnnouncement(props: { text: string }) {
  const { t } = useTranslation()
  const viewport = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const firstCopy = useRef<HTMLSpanElement>(null)
  const message = useRef<HTMLSpanElement>(null)
  const [scrolling, setScrolling] = useState(false)
  const text = props.text.replaceAll(/\s+/g, ' ').trim()

  useEffect(() => {
    const container = viewport.current
    const line = track.current
    const copy = firstCopy.current
    const content = message.current
    if (!text || !container || !line || !copy || !content) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animation: Animation | undefined
    let distance = 0
    let duration = 0
    let disposed = false

    const measure = () => {
      if (disposed) return
      const width = copy.getBoundingClientRect().width
      if (!width || !container.clientWidth) return
      const shouldScroll =
        content.getBoundingClientRect().width > container.clientWidth &&
        !reducedMotion.matches
      setScrolling(shouldScroll)
      if (!shouldScroll) {
        animation?.cancel()
        animation = undefined
        return
      }
      if (animation && width === distance) return
      const progress = duration
        ? (Number(animation?.currentTime ?? 0) % duration) / duration
        : 0
      animation?.cancel()
      distance = width
      // Fixed pixels per second, so short and long announcements move equally fast.
      duration = (width / 36) * 1000
      animation = line.animate(
        [
          { transform: 'translateX(0)' },
          { transform: `translateX(-${width}px)` },
        ],
        { duration, iterations: Infinity, easing: 'linear' }
      )
      animation.currentTime = progress * duration
    }

    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(copy)
    reducedMotion.addEventListener('change', measure)
    void document.fonts?.ready.then(measure)
    measure()
    return () => {
      disposed = true
      observer.disconnect()
      reducedMotion.removeEventListener('change', measure)
      animation?.cancel()
    }
  }, [text])

  if (!text) return null
  return (
    <section
      data-scrolling-announcement
      data-scrolling={scrolling}
      aria-label={t('Scrolling announcement')}
      className='scrolling-announcement border-border/50 text-muted-foreground pointer-events-auto flex h-8 shrink-0 items-center gap-1.5 border-b px-2 sm:gap-2 sm:px-3'
    >
      <span className='flex w-8 shrink-0 items-center justify-center'>
        <Megaphone
          aria-hidden='true'
          className='size-3.5 opacity-75'
          strokeWidth={1.6}
        />
      </span>
      <span className='sr-only'>{text}</span>
      <div
        ref={viewport}
        className='scrolling-announcement-viewport min-w-0 flex-1 overflow-hidden'
        title={text}
      >
        <div
          ref={track}
          aria-hidden='true'
          className='scrolling-announcement-track flex w-max text-sm leading-8 font-normal'
        >
          {Array.from({ length: scrolling ? 2 : 1 }, (_, index) => (
            <span
              key={index}
              ref={index === 0 ? firstCopy : undefined}
              className='scrolling-announcement-copy inline-flex shrink-0 items-center whitespace-nowrap'
            >
              <span ref={index === 0 ? message : undefined}>{text}</span>
              <span
                className='scrolling-announcement-separator text-muted-foreground/40 mx-6'
                aria-hidden='true'
              >
                ·
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

export function GlobalScrollingAnnouncement() {
  // The header's existing status polling supplies updates without another endpoint.
  const { status } = useStatus()
  return (
    <ScrollingAnnouncement
      text={
        typeof status?.scrolling_announcement === 'string'
          ? status.scrolling_announcement
          : ''
      }
    />
  )
}
