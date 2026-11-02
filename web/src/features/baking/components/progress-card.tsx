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
import { CircleHelp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

import type { BakingState } from '../api'
import { BakingIcon } from './baking-icon'

export function BakingProgress(props: { data: BakingState }) {
  const { t } = useTranslation(undefined, { lng: 'zhCN' })
  const { data } = props
  const max = data.milestones.at(-1)?.cookies ?? 7000
  return (
    <section className='card credit-card'>
      <div className='card-title'>
        <div className='flex items-center gap-1'>
          <h2>{t('Top-up progress')}</h2>
          <Popover>
            <PopoverTrigger
              type='button'
              openOnHover
              aria-label={t('Top-up progress')}
              className='text-muted-foreground hover:text-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full'
            >
              <CircleHelp aria-hidden='true' />
            </PopoverTrigger>
            <PopoverContent
              align='start'
              aria-label={t('Top-up progress')}
              className='w-auto max-w-[calc(100vw-2rem)] px-3 py-2 text-sm'
            >
              {t('Includes top-ups, redemptions, and subscriptions.')}
            </PopoverContent>
          </Popover>
        </div>
        <span className='mono'>
          {data.credited_cookies.toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}{' '}
          / {max.toLocaleString()} <span className='cookie-currency'>🍪</span>
        </span>
      </div>
      <div
        className='credit-track'
        role='progressbar'
        aria-label={t('Top-up progress')}
        aria-valuenow={Math.min(data.credited_cookies, max)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <i
          style={{
            width: `${Math.min(100, (data.credited_cookies / max) * 100)}%`,
          }}
        />
      </div>
      <div className='credit-milestones'>
        {data.milestones.map((milestone) => {
          const reached = data.credited_cookies >= milestone.cookies
          return (
            <div
              key={milestone.cookies}
              className={reached ? 'reached' : undefined}
            >
              <span className='mono'>
                {milestone.cookies.toLocaleString()}
                <span className='sr-only'> 🍪</span>
              </span>
              <span className='milestone-grant'>
                {reached && <BakingIcon name='check' />}
                <span>
                  {t('+{{count}} ingredients', { count: milestone.grants })}
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
