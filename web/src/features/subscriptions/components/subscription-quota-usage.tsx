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
import { CalendarClock, Clock3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatQuotaWithCurrency, getCurrencyDisplay } from '@/lib/currency'
import { cn } from '@/lib/utils'

import { getPlanQuotaRows } from '../lib/format'
import type { SubscriptionPlan, UserSubscription } from '../types'

interface Props {
  subscription: UserSubscription
  plan?: Partial<SubscriptionPlan>
  active: boolean
}

function SubscriptionCountdown(props: {
  timestamp: number
  now: number
  remaining?: boolean
}) {
  const { t } = useTranslation()
  const totalMinutes = Math.max(
    0,
    Math.floor((props.timestamp * 1000 - props.now) / 60000)
  )
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  let label = props.remaining
    ? t('Remaining {{minutes}}m', { minutes })
    : t('In {{minutes}}m', { minutes })
  if (totalMinutes === 0) {
    label = props.remaining
      ? t('Less than a minute remaining')
      : t('Less than a minute')
  } else if (days > 0) {
    label = props.remaining
      ? t('Remaining {{days}}d {{hours}}h {{minutes}}m', {
          days,
          hours,
          minutes,
        })
      : t('In {{days}}d {{hours}}h {{minutes}}m', { days, hours, minutes })
  } else if (hours > 0) {
    label = props.remaining
      ? t('Remaining {{hours}}h {{minutes}}m', { hours, minutes })
      : t('In {{hours}}h {{minutes}}m', { hours, minutes })
  }

  return (
    <time
      dateTime={new Date(props.timestamp * 1000).toISOString()}
      className='tabular-nums'
    >
      {label}
    </time>
  )
}

export function SubscriptionQuotaUsage(props: Props) {
  const { t } = useTranslation()
  const { meta } = getCurrencyDisplay()
  const [now, setNow] = useState(Date.now)
  const sub = props.subscription
  const expired = sub.end_time > 0 && sub.end_time * 1000 <= now
  const active = props.active && sub.status === 'active' && !expired

  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [active])

  const cycles = getPlanQuotaRows(
    {
      ...props.plan,
      total_amount: sub.amount_total,
      quota_limits: sub.quota_limits,
    },
    t
  ).map((row) => {
    const limit = sub.quota_limits?.find(
      (item) => String(item.period_seconds) === row.key
    )
    return {
      ...row,
      used: Math.max(0, limit ? limit.amount_used || 0 : sub.amount_used),
      reset: limit
        ? (limit.last_reset_time || sub.start_time) + limit.period_seconds
        : sub.next_reset_time || 0,
    }
  })

  return (
    <div className='min-w-0 space-y-3'>
      <div className='grid min-w-0 gap-5'>
        {cycles.map((cycle) => {
          const unlimited = cycle.amount <= 0
          const ratio = unlimited
            ? 0
            : Math.max(0, Math.min(100, (cycle.used / cycle.amount) * 100))
          const percent = Math.round(ratio * 10) / 10
          const exhausted = ratio >= 100
          let tone = 'text-emerald-700 dark:text-emerald-400'
          if (percent >= 75) tone = 'text-amber-700 dark:text-amber-400'
          if (percent >= 90) tone = 'text-rose-700 dark:text-rose-400'
          if (!active) tone = 'text-muted-foreground'
          const reset = active && cycle.reset > 0 && cycle.reset < sub.end_time
          const pending = reset && cycle.reset * 1000 <= now
          const [used, total] = [cycle.used, cycle.amount].map(
            (amount) =>
              formatQuotaWithCurrency(amount, {
                showSymbol: meta.kind !== 'custom',
                abbreviate: false,
              }) + (meta.kind === 'custom' ? meta.symbol : '')
          )

          return (
            <section
              key={cycle.key}
              aria-label={cycle.label}
              className='min-w-0 space-y-3'
            >
              <div className='flex items-baseline justify-between gap-2'>
                <div className='flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1'>
                  <span className='text-muted-foreground text-xs font-medium'>
                    {cycle.label}
                  </span>
                  <span className='text-muted-foreground min-w-0 text-xs break-all tabular-nums'>
                    {unlimited ? t('Unlimited') : `${used} / ${total}`}
                  </span>
                </div>
                {!unlimited && (
                  <span
                    className={cn(
                      'shrink-0 text-xs font-semibold tabular-nums',
                      tone
                    )}
                  >
                    {percent}%
                  </span>
                )}
              </div>
              {!unlimited && (
                <div
                  role='meter'
                  aria-label={cycle.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  aria-valuetext={t('{{percent}}% used', { percent })}
                  className={cn(
                    'bg-foreground/[0.07] h-1.5 overflow-hidden rounded-full ring-1 ring-inset ring-foreground/[0.04]',
                    tone
                  )}
                >
                  <div
                    aria-hidden='true'
                    className='h-full rounded-full bg-current bg-gradient-to-r from-white/25 to-transparent transition-[width] duration-500 ease-out motion-reduce:transition-none'
                    style={{ width: `${ratio}%` }}
                  />
                </div>
              )}
              <div className='text-muted-foreground flex flex-wrap items-start justify-between gap-2 text-xs leading-relaxed'>
                {reset ? (
                  <div className='min-w-0 space-y-0.5'>
                    <div className='flex flex-wrap items-center gap-x-1.5'>
                      <Clock3
                        aria-hidden='true'
                        className='size-3.5 shrink-0'
                      />
                      <span>{t('Reset')}</span>
                      <span>
                        {pending ? (
                          t('Reset pending')
                        ) : (
                          <SubscriptionCountdown
                            timestamp={cycle.reset}
                            now={now}
                          />
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span>
                    {active
                      ? t('Valid until subscription expires')
                      : t('Ended')}
                  </span>
                )}
                {exhausted && active && (
                  <span className='text-muted-foreground'>
                    {t('Exhausted')}
                  </span>
                )}
              </div>
            </section>
          )
        })}
      </div>
      {sub.end_time > 0 && (
        <section
          aria-label={t('Subscription validity')}
          className='text-muted-foreground flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-2 text-xs'
        >
          <div className='flex min-w-0 flex-1 basis-36 items-center gap-2'>
            <CalendarClock aria-hidden='true' className='size-4 shrink-0' />
            <span>{t('Expires at')}</span>
          </div>
          <span className='text-muted-foreground ml-auto max-w-full min-w-0 text-right break-words'>
            {active ? (
              <SubscriptionCountdown
                timestamp={sub.end_time}
                now={now}
                remaining
              />
            ) : (
              <span>{expired ? t('Expired') : t('Ended')}</span>
            )}
          </span>
        </section>
      )}
    </div>
  )
}
