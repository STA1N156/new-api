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
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

import type { FestivalStatus } from '../api'

export function FestivalProgress({ data }: { data: FestivalStatus }) {
  const { t } = useTranslation()
  const next = data.milestones.find(
    (item) => data.credited_cookies < item.cookies
  )
  const goal = data.milestones.at(-1)?.cookies
  if (!goal) return null
  return (
    <section
      className='rounded-2xl border p-5 sm:p-6'
      aria-label={t('Cumulative progress')}
    >
      <div className='flex items-center justify-between gap-3'>
        <h3 className='font-semibold'>{t('Cumulative progress')}</h3>
        <span className='text-sm font-semibold tabular-nums'>
          {data.credited_cookies.toLocaleString()}🍪
          <span className='text-muted-foreground font-normal'>
            {' / '}
            {goal.toLocaleString()}🍪
          </span>
        </span>
      </div>
      <p className='text-muted-foreground mt-2 text-sm'>
        {t('Online top-ups and redemption codes both count toward progress.')}
      </p>
      <div className='relative mx-2 mt-6'>
        <Progress
          aria-label={t('Cumulative progress')}
          value={Math.min(data.credited_cookies, goal)}
          max={goal}
          className='[&_[data-slot=progress-indicator]]:bg-amber-500 [&_[data-slot=progress-track]]:h-2'
        />
        {data.milestones.map((milestone) => (
          <span
            key={milestone.cookies}
            aria-hidden='true'
            style={{ left: `${(milestone.cookies / goal) * 100}%` }}
            className={cn(
              'bg-muted-foreground/40 absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full',
              data.credited_cookies >= milestone.cookies && 'bg-amber-500'
            )}
          />
        ))}
      </div>
      <div className='mt-5 grid grid-cols-2 gap-3'>
        {data.milestones.map((milestone) => {
          const reached = data.credited_cookies >= milestone.cookies
          return (
            <div
              key={milestone.cookies}
              className={cn(
                'rounded-xl bg-muted/40 p-3',
                reached && 'bg-amber-500/10'
              )}
            >
              <div className='flex flex-wrap items-center justify-between gap-1'>
                <span className='text-sm font-medium'>
                  {milestone.cookies.toLocaleString()}🍪
                </span>
                {reached && (
                  <span className='inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300'>
                    <Check className='size-3' aria-hidden='true' />
                    {t('Granted')}
                  </span>
                )}
              </div>
              <p className='text-muted-foreground mt-1 text-sm'>
                {t('+{{count}} draws', { count: milestone.chances })}
              </p>
            </div>
          )
        })}
      </div>
      <p className='mt-4 text-sm'>
        {next
          ? t('{{cookies}}🍪 more to unlock {{count}} additional draws', {
              cookies: Number(
                (next.cookies - data.credited_cookies).toFixed(2)
              ).toLocaleString(),
              count: next.chances,
            })
          : t('All 20 bonus draws have been unlocked.')}
      </p>
    </section>
  )
}
