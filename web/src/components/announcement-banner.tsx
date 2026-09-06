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
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

export function AnnouncementBanner(props: {
  count: number
  onView: () => void
}) {
  const { t } = useTranslation()
  if (props.count <= 0) return null

  return (
    <div
      data-announcement-banner
      role='status'
      className='pointer-events-auto flex h-10 shrink-0 items-center justify-center gap-3 border-b border-blue-200 bg-blue-50 px-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100'
    >
      <Megaphone aria-hidden='true' className='size-4 shrink-0' />
      <span>
        {t('New system announcements ({{count}})', { count: props.count })}
      </span>
      <Button
        variant='ghost'
        size='sm'
        className='h-7 shrink-0 px-2 text-xs font-semibold underline underline-offset-4'
        onClick={props.onView}
      >
        {t('View')}
      </Button>
    </div>
  )
}
