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
import { useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import type { FestivalPrize } from '../api'

const colors = [
  '#fde5b7',
  '#fbd0b6',
  '#fff0d0',
  '#f3c5ae',
  '#ffe4b9',
  '#f5d6b8',
]

export function FestivalWheel(props: {
  prizes: FestivalPrize[]
  rotation: number
  spinning: boolean
  onFinished: () => void
}) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  useEffect(() => {
    if (!props.spinning) return
    const timer = window.setTimeout(props.onFinished, reduceMotion ? 0 : 3500)
    return () => window.clearTimeout(timer)
  }, [props.spinning, props.onFinished, reduceMotion])

  return (
    <div
      className='relative mx-auto aspect-square w-full max-w-[340px]'
      role='img'
      aria-label={t('Festival prize wheel')}
    >
      <div className='absolute -inset-3 rounded-full border border-amber-500/15' />
      <svg
        viewBox='0 0 320 320'
        className='size-full drop-shadow-xl'
        style={{
          transform: `rotate(${props.rotation}deg)`,
          transition: reduceMotion
            ? 'none'
            : 'transform 3.4s cubic-bezier(0.12,0.75,0.15,1)',
        }}
      >
        <circle cx='160' cy='160' r='157' fill='#a66f36' />
        {props.prizes.map((prize, index) => {
          const start = ((index * 60 - 90) * Math.PI) / 180
          const end = start + Math.PI / 3
          return (
            <g key={prize.cookies}>
              <path
                d={`M160 160 L${160 + 150 * Math.cos(start)} ${160 + 150 * Math.sin(start)} A150 150 0 0 1 ${160 + 150 * Math.cos(end)} ${160 + 150 * Math.sin(end)} Z`}
                fill={colors[index]}
                stroke='#fff4df'
                strokeWidth='1.5'
              />
              <g transform={`rotate(${index * 60 + 30} 160 160)`}>
                <text
                  x='160'
                  y='62'
                  textAnchor='middle'
                  dominantBaseline='middle'
                  fill='#70421f'
                  fontSize='18'
                  fontWeight='700'
                >
                  {prize.cookies}
                </text>
                <text
                  x='160'
                  y='37'
                  textAnchor='middle'
                  dominantBaseline='middle'
                  fontSize='14'
                >
                  🍪
                </text>
              </g>
            </g>
          )
        })}
      </svg>
      <div
        className='absolute -top-1 left-1/2 z-10 -translate-x-1/2 drop-shadow-md'
        aria-hidden='true'
      >
        <svg width='28' height='36' viewBox='0 0 28 36'>
          <path
            d='M2 2H26L14 33Z'
            fill='#b56432'
            stroke='#fff1d8'
            strokeWidth='3'
            strokeLinejoin='round'
          />
        </svg>
      </div>
      <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
        <div
          className='flex size-20 items-center justify-center rounded-full border-4 border-amber-200 bg-amber-50 text-4xl shadow-lg'
          aria-hidden='true'
        >
          🍪
        </div>
      </div>
    </div>
  )
}
