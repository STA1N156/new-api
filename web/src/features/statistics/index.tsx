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

import { getDailyStatistics, type StatisticsHour } from './api'
import { HourlyChart } from './components/hourly-chart'

export function Statistics() {
  const { t } = useTranslation()
  const [date, setDate] = useState('')
  const [topupScope, setTopupScope] = useState('all')
  const [requestScope, setRequestScope] = useState('all')
  const [consumptionScope, setConsumptionScope] = useState('all')
  const showOnline = topupScope === 'all' || topupScope === 'online'
  const showSubscriptions =
    topupScope === 'all' || topupScope === 'subscription'
  const showRedemptions = topupScope === 'all' || topupScope === 'redemption'
  const usageOptions = [
    { value: 'all', label: t('All') },
    { value: 'wallet', label: t('Wallet only') },
    { value: 'subscription', label: t('Subscriptions only') },
  ]
  let days = 1
  if (date === '7d') days = 7
  else if (date === '30d') days = 30
  useSystemConfigStore((state) => state.config.currency)
  const query = useQuery({
    queryKey: ['daily-statistics', date],
    queryFn: ({ signal }) =>
      getDailyStatistics(days > 1 ? '' : date, signal, days),
    staleTime: 30000,
    refetchInterval: !date || days > 1 ? 30000 : false,
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
  const previous = query.data?.previous
  let selectionLabel = date || `${t('Today')} · ${today}`
  let comparisonLabel = date
    ? t('Compared with previous day')
    : t('Compared with yesterday at this time')
  if (days > 1) {
    selectionLabel = t('Last {{days}} days', { days })
    comparisonLabel = t('Compared with previous {{days}} days at this time', {
      days,
    })
  }
  const chartPeriod = {
    timestamps: hours.map((hour) => hour.timestamp),
    days,
    asOf: query.data?.as_of ?? 0,
    comparisonLabel,
  }
  const formatQuota = (value: number) =>
    formatQuotaWithCurrency(value, { abbreviate: false })
  const formatQuotaAxis = (value: number) =>
    formatQuotaWithCurrency(value, { showSymbol: false, compact: true })
  const formatMoney = (value: number) =>
    `¥${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const formatCount = (value: number) =>
    value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  const usageDetails = (
    metric: 'requests' | 'consumed_quota',
    source: string,
    format: (value: number) => string
  ) => {
    const parts: string[] = []
    if (source !== 'subscription') {
      const total = hours.reduce(
        (sum, hour) => sum + usageBySource(hour, metric, 'wallet'),
        0
      )
      parts.push(t('Wallet {{amount}}', { amount: format(total) }))
    }
    if (source !== 'wallet') {
      const total = hours.reduce(
        (sum, hour) => sum + usageBySource(hour, metric, 'subscription'),
        0
      )
      parts.push(t('Subscriptions {{amount}}', { amount: format(total) }))
    }
    return parts.join(' · ')
  }
  const online = hours.reduce((sum, hour) => sum + hour.online_topup, 0)
  const subscriptions = hours.reduce(
    (sum, hour) => sum + hour.subscription_topup,
    0
  )
  const redemptions = hours.reduce(
    (sum, hour) => sum + hour.redemption_topup,
    0
  )
  const topupDetails: string[] = []
  if (showOnline) {
    topupDetails.push(t('Direct {{amount}}', { amount: formatMoney(online) }))
  }
  if (showSubscriptions) {
    topupDetails.push(
      t('Subscriptions {{amount}}', { amount: formatMoney(subscriptions) })
    )
  }
  if (showRedemptions) {
    topupDetails.push(
      t('Redemptions {{amount}}', { amount: formatMoney(redemptions) })
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Statistics')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Select value={date} onValueChange={(value) => setDate(value ?? '')}>
          <SelectTrigger className='w-52' aria-label={t('Statistics date')}>
            <SelectValue>{selectionLabel}</SelectValue>
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
              <SelectItem value='7d'>
                {t('Last {{days}} days', { days: 7 })}
              </SelectItem>
              <SelectItem value='30d'>
                {t('Last {{days}} days', { days: 30 })}
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
            'Single days show hourly totals; 7/30-day summaries show daily totals. Beijing time (UTC+8).'
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
              [0, 1, 2].map((key) => (
                <Skeleton key={key} className='h-80 rounded-2xl' />
              ))
            ) : (
              <>
                <HourlyChart
                  {...chartPeriod}
                  title={t('Request count')}
                  actions={
                    <StatisticsFilter
                      label={t('Request count')}
                      value={requestScope}
                      onChange={setRequestScope}
                      options={usageOptions}
                    />
                  }
                  previousTotal={usageBySource(
                    previous,
                    'requests',
                    requestScope
                  )}
                  wholeNumbers
                  values={hours.map((hour) =>
                    usageBySource(hour, 'requests', requestScope)
                  )}
                  color='var(--chart-1)'
                  format={formatCount}
                  formatAxis={(value) =>
                    value.toLocaleString(undefined, { notation: 'compact' })
                  }
                  detail={usageDetails('requests', requestScope, formatCount)}
                />
                <HourlyChart
                  {...chartPeriod}
                  title={t('Consumption')}
                  actions={
                    <StatisticsFilter
                      label={t('Consumption')}
                      value={consumptionScope}
                      onChange={setConsumptionScope}
                      options={usageOptions}
                    />
                  }
                  previousTotal={usageBySource(
                    previous,
                    'consumed_quota',
                    consumptionScope
                  )}
                  values={hours.map((hour) =>
                    usageBySource(hour, 'consumed_quota', consumptionScope)
                  )}
                  color='var(--chart-3)'
                  format={formatQuota}
                  formatAxis={formatQuotaAxis}
                  detail={usageDetails(
                    'consumed_quota',
                    consumptionScope,
                    formatQuota
                  )}
                />
                <HourlyChart
                  {...chartPeriod}
                  title={t('Top-up')}
                  actions={
                    <StatisticsFilter
                      value={topupScope}
                      onChange={setTopupScope}
                      label={t('Top-up scope')}
                      options={[
                        { value: 'all', label: t('All') },
                        { value: 'online', label: t('Online only') },
                        {
                          value: 'subscription',
                          label: t('Subscriptions only'),
                        },
                        { value: 'redemption', label: t('Redemptions only') },
                      ]}
                    />
                  }
                  previousTotal={
                    (showOnline ? (previous?.online_topup ?? 0) : 0) +
                    (showSubscriptions
                      ? (previous?.subscription_topup ?? 0)
                      : 0) +
                    (showRedemptions ? (previous?.redemption_topup ?? 0) : 0)
                  }
                  totalCount={hours.reduce(
                    (sum, hour) =>
                      sum +
                      (showOnline ? hour.online_topup_count : 0) +
                      (showSubscriptions ? hour.subscription_topup_count : 0) +
                      (showRedemptions ? hour.redeemed_count : 0),
                    0
                  )}
                  values={hours.map(
                    (hour) =>
                      (showOnline ? hour.online_topup : 0) +
                      (showSubscriptions ? hour.subscription_topup : 0) +
                      (showRedemptions ? hour.redemption_topup : 0)
                  )}
                  color='var(--chart-5)'
                  format={formatMoney}
                  formatAxis={(value) =>
                    value.toLocaleString(undefined, { notation: 'compact' })
                  }
                  detail={topupDetails.join(' · ')}
                />
              </>
            )}
          </div>
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function usageBySource(
  row: StatisticsHour | undefined,
  metric: 'requests' | 'consumed_quota',
  source: string
) {
  if (!row) return 0
  const subscription =
    metric === 'requests'
      ? row.subscription_requests
      : row.subscription_consumed_quota
  if (source === 'subscription') return subscription
  if (source === 'wallet') return row[metric] - subscription
  return row[metric]
}

function StatisticsFilter(props: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <Select
      value={props.value}
      onValueChange={(value) => props.onChange(value ?? 'all')}
    >
      <SelectTrigger className='h-8 w-32 text-xs' aria-label={props.label}>
        <SelectValue>
          {props.options.find((option) => option.value === props.value)?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align='end' alignItemWithTrigger={false}>
        {props.options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
