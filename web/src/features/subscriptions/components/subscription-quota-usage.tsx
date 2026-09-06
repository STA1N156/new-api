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
import { Clock3 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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

function QuotaSegments(props: { percent: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      // Each square is 6px, with 2px between squares and no trailing gap.
      setCount(Math.max(0, Math.floor((entry.contentRect.width + 2) / 8)))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const used = Math.ceil((count * props.percent) / 100)
  return (
    <div
      ref={ref}
      aria-hidden='true'
      className='flex h-[6px] gap-[2px] overflow-hidden'
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={cn(
            'size-[6px] shrink-0',
            index < used ? 'bg-current' : 'bg-foreground/[0.08]'
          )}
        />
      ))}
    </div>
  )
}

function ResetCountdown(props: { resetTime: number }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const totalMinutes = Math.max(
    0,
    Math.floor((props.resetTime * 1000 - now) / 60000)
  )
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  let label = t('In {{minutes}}m', { minutes })
  if (days > 0) {
    label = t('In {{days}}d {{hours}}h {{minutes}}m', { days, hours, minutes })
  } else if (hours > 0) {
    label = t('In {{hours}}h {{minutes}}m', { hours, minutes })
  }

  return (
    <time
      dateTime={new Date(props.resetTime * 1000).toISOString()}
      className='tabular-nums'
    >
      {label}
    </time>
  )
}

export function SubscriptionQuotaUsage(props: Props) {
  const { t } = useTranslation()
  const { meta } = getCurrencyDisplay()
  const sub = props.subscription
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
      used: limit ? limit.amount_used || 0 : sub.amount_used,
      reset: limit
        ? (limit.last_reset_time || sub.start_time) + limit.period_seconds
        : sub.next_reset_time || 0,
    }
  })

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      {cycles.map((cycle) => {
        const unlimited = cycle.amount <= 0
        const ratio = unlimited
          ? 0
          : Math.max(0, Math.min(100, (cycle.used / cycle.amount) * 100))
        const percent = Math.round(ratio * 10) / 10
        const exhausted = ratio >= 100
        let tone = 'text-emerald-600/90 dark:text-emerald-400/90'
        if (percent >= 70) {
          tone = 'text-amber-600/90 dark:text-amber-400/90'
        }
        if (percent > 90) {
          tone = 'text-rose-600/90 dark:text-rose-400/90'
        }
        if (!props.active) {
          tone = 'text-muted-foreground'
        }
        const reset =
          props.active && cycle.reset > 0 && cycle.reset < sub.end_time

        return (
          <section
            key={cycle.key}
            aria-label={cycle.label}
            className='min-w-0 space-y-3 py-3'
          >
            <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1'>
              <div className='text-muted-foreground flex flex-wrap items-baseline gap-x-0.5 text-xs font-medium'>
                <span>{cycle.label}</span>
                {!unlimited && (
                  <>
                    <span aria-hidden='true'>·</span>
                    <span className='tabular-nums'>
                      {formatQuotaWithCurrency(cycle.amount, {
                        showSymbol: meta.kind !== 'custom',
                        abbreviate: false,
                      })}
                      {meta.kind === 'custom' ? meta.symbol : ''}
                    </span>
                  </>
                )}
              </div>
              <div className='flex items-baseline gap-1.5'>
                {!unlimited && (
                  <span className='text-muted-foreground text-xs'>
                    {t('Used')}
                  </span>
                )}
                <span
                  className={cn(
                    'text-xs font-semibold tracking-tight tabular-nums',
                    tone
                  )}
                >
                  {unlimited ? t('Unlimited') : `${percent}%`}
                </span>
              </div>
            </div>
            {!unlimited && (
              <div
                role='meter'
                aria-label={cycle.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-valuetext={t('{{percent}}% used', { percent })}
                className={tone}
              >
                <QuotaSegments percent={ratio} />
              </div>
            )}
            <div className='text-muted-foreground flex min-h-4 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] leading-relaxed'>
              {reset ? (
                <span className='flex flex-wrap items-center gap-x-1.5 text-[10px]'>
                  <Clock3 aria-hidden='true' className='size-3 shrink-0' />
                  <span>{t('Next reset')}</span>
                  <ResetCountdown resetTime={cycle.reset} />
                </span>
              ) : (
                <span>
                  {props.active
                    ? t('Valid until subscription expires')
                    : t('Ended')}
                </span>
              )}
              {exhausted && props.active && (
                <span className={cn('font-medium', tone)}>
                  {reset ? t('Waiting for reset') : t('Quota exhausted')}
                </span>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
