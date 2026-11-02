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
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useBakingState } from '../api'
import { useEventClock } from '../lib/use-event-clock'
import { BakingIcon } from './baking-icon'
import { CookieArt } from './cookie-art'

export function BakingWalletBanner() {
  const { t } = useTranslation(undefined, { lng: 'zhCN' })
  const query = useBakingState()
  const { data, refetch } = query
  const { phase } = useEventClock(data)
  useEffect(() => {
    if (data && phase !== data.phase) void refetch()
  }, [data, phase, refetch])
  if (
    !data ||
    !query.isFetchedAfterMount ||
    !query.isSuccess ||
    data.phase !== 'active' ||
    phase !== 'active'
  ) {
    return null
  }
  const description = t(
    'Top up to unlock baking ingredients · Up to {{count}} rounds',
    {
      count: data.milestones.reduce(
        (total, milestone) => total + milestone.grants,
        0
      ),
    }
  )
  return (
    <Link
      to='/baking'
      className='flex items-center gap-4 rounded-xl border border-[#e7d6a9] bg-[#fdf8eb] px-5 py-4 transition-colors hover:bg-[#faf3df] dark:border-[#605239] dark:bg-[#393326] dark:hover:bg-[#423a29]'
    >
      <CookieArt level={1} className='size-11 shrink-0 sm:size-14' />
      <div className='min-w-0 flex-1'>
        <div className='text-base font-medium'>{t('Lucky Bakery')}</div>
        <div className='text-muted-foreground mt-1 text-xs sm:text-sm'>
          {description}
        </div>
      </div>
      <div className='flex shrink-0 items-center gap-2 text-sm text-[#96712b] dark:text-[#e3c57a]'>
        <span className='hidden sm:inline'>{t('View event')}</span>
        <BakingIcon name='arrow' className='size-5' />
      </div>
    </Link>
  )
}
