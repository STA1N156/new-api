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
import { LockKeyhole } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { FestivalStatus } from '../api'

export function FestivalGate(props: {
  data: FestivalStatus | undefined
  children: ReactNode
}) {
  const { t } = useTranslation()
  if (!props.data || props.data.state === 'active') return props.children
  const remaining = Math.max(0, props.data.starts_at - props.data.server_time)
  const upcoming = props.data.state === 'upcoming'
  return (
    <div className='relative mx-auto max-w-6xl overflow-hidden rounded-2xl border'>
      <div
        inert
        aria-hidden='true'
        className='pointer-events-none h-[min(640px,calc(100dvh-160px))] min-h-80 overflow-hidden opacity-30 blur-2xl select-none'
      >
        {props.children}
      </div>
      <div className='bg-background/60 absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center'>
        <div className='bg-muted/80 flex size-20 items-center justify-center rounded-full border'>
          <LockKeyhole
            className='text-muted-foreground size-9'
            aria-hidden='true'
          />
        </div>
        <h2 className='text-xl font-semibold sm:text-2xl'>
          {t(
            upcoming ? 'The festival has not started' : 'The festival has ended'
          )}
        </h2>
        {upcoming && (
          <p
            role='timer'
            className='text-muted-foreground text-lg font-medium tabular-nums sm:text-2xl'
          >
            {t('Opens in {{days}} days {{hours}} hours {{minutes}} minutes', {
              days: Math.floor(remaining / 86400),
              hours: Math.floor((remaining % 86400) / 3600),
              minutes: Math.floor((remaining % 3600) / 60),
            })}
          </p>
        )}
      </div>
    </div>
  )
}
