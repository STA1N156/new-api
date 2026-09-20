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
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Gift } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { useFestival } from '../api'

export function FestivalCard() {
  const { t } = useTranslation()
  const { data } = useFestival()
  if (data?.state !== 'active') return null
  return (
    <section
      aria-label={t('Autumn Festival')}
      className='via-background relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-5 sm:p-6'
    >
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <div className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400'>
            <Gift className='size-6' />
          </div>
          <div>
            <h3 className='text-base font-semibold'>{t('Autumn Festival')}</h3>
            <p className='text-muted-foreground mt-1 text-sm'>
              {t('September 25 – October 7 · Top up or redeem to earn draws')}
            </p>
          </div>
        </div>
        <Button variant='outline' render={<Link to='/festival' />}>
          {t('View festival')}
          <ArrowUpRight className='size-4' />
        </Button>
      </div>
      <p className='text-muted-foreground mt-4 text-sm'>
        {t('Credited {{cookies}}🍪 · {{count}} draws remaining', {
          cookies: data.credited_cookies.toLocaleString(),
          count: data.remaining,
        })}
      </p>
    </section>
  )
}
