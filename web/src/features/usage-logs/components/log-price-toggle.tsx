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
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { useUsageLogsContext } from './usage-logs-provider'

export function LogPriceToggle() {
  const { t } = useTranslation()
  const { showRechargePrice, setShowRechargePrice } = useUsageLogsContext()
  return (
    <div
      role='group'
      aria-label={t('Price display mode')}
      className='bg-muted/60 inline-flex h-8 shrink-0 items-center rounded-lg border p-0.5'
    >
      {[false, true].map((recharge) => (
        <button
          key={String(recharge)}
          type='button'
          aria-pressed={showRechargePrice === recharge}
          onClick={() => setShowRechargePrice(recharge)}
          className={cn(
            'inline-flex h-full items-center justify-center rounded-md px-3 text-xs font-medium transition-colors',
            showRechargePrice === recharge
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {recharge ? t('Recharge') : t('Standard')}
        </button>
      ))}
    </div>
  )
}
