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
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { getDailyStatistics } from './api'
import { HourlyChart } from './components/hourly-chart'

export function Statistics() {
  const { t } = useTranslation()
  const [date, setDate] = useState('')
  useSystemConfigStore((state) => state.config.currency)
  const query = useQuery({
    queryKey: ['daily-statistics', date],
    queryFn: ({ signal }) => getDailyStatistics(date, signal),
    staleTime: 30000,
    refetchInterval: date ? false : 30000,
    retry: false,
  })
  const today =
    query.data?.today ??
    new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
  const dates = Array.from({ length: 29 }, (_, index) =>
    new Date(Date.parse(`${today}T00:00:00Z`) - (index + 1) * 86400000)
      .toISOString()
      .slice(0, 10)
  )
  const hours = query.data?.hours ?? []
  const formatQuota = (value: number) =>
    formatQuotaWithCurrency(value, { abbreviate: false })
  const formatQuotaAxis = (value: number) =>
    formatQuotaWithCurrency(value, { showSymbol: false, compact: true })
  const formatMoney = (value: number) =>
    `¥${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const online = hours.reduce((sum, hour) => sum + hour.online_topup, 0)
  const subscriptions = hours.reduce(
    (sum, hour) => sum + hour.subscription_topup,
    0
  )

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Statistics')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Select value={date} onValueChange={(value) => setDate(value ?? '')}>
          <SelectTrigger className='w-52' aria-label={t('Statistics date')}>
            <SelectValue>{date || `${t('Today')} · ${today}`}</SelectValue>
          </SelectTrigger>
          <SelectContent
            align='end'
            alignItemWithTrigger={false}
            className='max-h-72'
          >
            <SelectGroup>
              <SelectItem value=''>
                {t('Today')} · {today}
              </SelectItem>
              {dates.map((day) => (
                <SelectItem key={day} value={day}>
                  {day}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          variant='outline'
          size='icon'
          aria-label={t('Refresh')}
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw className='size-4' />
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <p className='text-muted-foreground mb-4 text-sm'>
          {t(
            'Select a day in the last 30 days. Hourly totals use Beijing time (UTC+8).'
          )}
        </p>
        {query.isError ? (
          <ErrorState
            description={query.error.message}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <div className='grid grid-cols-1 gap-4'>
            {query.isPending ? (
              [0, 1, 2, 3].map((key) => (
                <Skeleton key={key} className='h-80 rounded-2xl' />
              ))
            ) : (
              <>
                <HourlyChart
                  title={t('Request count')}
                  wholeNumbers
                  values={hours.map((hour) => hour.requests)}
                  color='var(--chart-1)'
                  format={(value) =>
                    value.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })
                  }
                  formatAxis={(value) =>
                    value.toLocaleString(undefined, { notation: 'compact' })
                  }
                  detail={t(
                    'Recorded requests, including failures; retries count once.'
                  )}
                />
                <HourlyChart
                  title={t('Consumption')}
                  values={hours.map((hour) => hour.consumed_quota)}
                  color='var(--chart-3)'
                  format={formatQuota}
                  formatAxis={formatQuotaAxis}
                  detail={t(
                    'Actual usage charges from wallets and subscriptions.'
                  )}
                />
                <HourlyChart
                  title={t('Redemption')}
                  values={hours.map((hour) => hour.redeemed_quota)}
                  totalCount={hours.reduce(
                    (sum, hour) => sum + hour.redeemed_count,
                    0
                  )}
                  color='var(--chart-2)'
                  format={formatQuota}
                  formatAxis={formatQuotaAxis}
                  detail={t(
                    'Credits received from successfully redeemed codes.'
                  )}
                />
                <HourlyChart
                  title={t('Top-up')}
                  totalCount={hours.reduce(
                    (sum, hour) => sum + hour.topup_count,
                    0
                  )}
                  values={hours.map(
                    (hour) => hour.online_topup + hour.subscription_topup
                  )}
                  color='var(--chart-5)'
                  format={formatMoney}
                  formatAxis={(value) =>
                    value.toLocaleString(undefined, { notation: 'compact' })
                  }
                  detail={t(
                    'Direct {{online}} · Subscriptions {{subscriptions}}',
                    {
                      online: formatMoney(online),
                      subscriptions: formatMoney(subscriptions),
                    }
                  )}
                />
              </>
            )}
          </div>
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
