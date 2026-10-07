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

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { useUsageLogsContext } from './usage-logs-provider'

export function LogPriceToggle() {
  const { t } = useTranslation()
  const { showRechargePrice, setShowRechargePrice } = useUsageLogsContext()
  return (
    <Tabs
      value={showRechargePrice ? 'recharge' : 'standard'}
      onValueChange={(value) => setShowRechargePrice(value === 'recharge')}
    >
      <TabsList aria-label={t('Price display mode')}>
        <TabsTrigger value='standard'>{t('Standard')}</TabsTrigger>
        <TabsTrigger value='recharge'>{t('Recharge')}</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
