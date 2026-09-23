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
import {
  ArrowUpRight,
  CalendarDays,
  Gift,
  RefreshCw,
  Ticket,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'

import { useFestival, type FestivalStatus } from './api'
import { FestivalDrawPanel } from './components/festival-draw-panel'
import { FestivalGate } from './components/festival-gate'
import { FestivalProgress } from './components/festival-progress'

export function Festival() {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useFestival()
  const [drawSnapshot, setDrawSnapshot] = useState<FestivalStatus | null>(null)
  const wonCookies = drawSnapshot?.won_cookies ?? data?.won_cookies ?? 0
  const records = drawSnapshot?.records ?? data?.records ?? []
  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Autumn Festival')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='ghost'
          size='icon'
          aria-label={t('Refresh')}
          onClick={() => void refetch()}
        >
          <RefreshCw className='size-4' />
        </Button>
        <Button variant='outline' render={<Link to='/wallet' />}>
          {t('Go to wallet')}
          <ArrowUpRight className='size-4' />
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <FestivalGate data={data}>
          <div className='mx-auto max-w-6xl space-y-5 pb-6'>
            <div className='via-background relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/15 to-orange-500/10 p-6 sm:p-8'>
              <p className='text-sm font-medium tracking-widest text-amber-700 dark:text-amber-300'>
                {t('MID-AUTUMN × NATIONAL DAY')}
              </p>
              <h1 className='mt-3 text-2xl font-bold tracking-tight sm:text-3xl'>
                {t('Festival gifts, lucky wheel')}
              </h1>
              <p className='text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed'>
                {t(
                  'Top up, subscribe or redeem during the festival. Reach milestones, unlock free draws, and receive your prize instantly.'
                )}
              </p>
              <p className='text-muted-foreground mt-4 flex items-center gap-2 text-sm'>
                <CalendarDays className='size-4' />
                {t('September 25, 2026 00:00 – October 7 23:59:59 (UTC+8)')}
              </p>
              {data && data.state !== 'upcoming' && (
                <p
                  role='status'
                  className='bg-background/60 mt-4 inline-flex rounded-full border border-amber-500/20 px-3 py-1 text-xs font-medium'
                >
                  {t(
                    {
                      active: 'Festival is live',
                      ended:
                        'Festival ended · Your credited rewards remain available',
                    }[data.state]
                  )}
                </p>
              )}
            </div>
            {isPending && (
              <p
                role='status'
                className='text-muted-foreground py-12 text-center'
              >
                {t('Loading...')}
              </p>
            )}
            {isError && (
              <div className='rounded-xl border p-6 text-center'>
                <p>{t('Unable to load festival')}</p>
                <Button
                  className='mt-3'
                  variant='outline'
                  onClick={() => void refetch()}
                >
                  {t('Retry')}
                </Button>
              </div>
            )}
            {data && (
              <>
                <div className='grid grid-cols-3 gap-3'>
                  {[
                    {
                      label: t('Credited during festival'),
                      value: `${data.credited_cookies.toLocaleString()}🍪`,
                      icon: Gift,
                    },
                    {
                      label: t('Draw chances earned'),
                      value: data.earned,
                      icon: Ticket,
                    },
                    {
                      label: t('Total prizes received'),
                      value: `${wonCookies.toLocaleString()}🍪`,
                      icon: Gift,
                    },
                  ].map(({ label, value, icon: Icon }) => (
                    <div
                      key={label}
                      className='bg-card rounded-xl border p-3 sm:p-4'
                    >
                      <div className='text-muted-foreground flex items-center gap-2 text-xs sm:text-sm'>
                        <Icon className='hidden size-4 sm:block' />
                        {label}
                      </div>
                      <p className='mt-2 text-lg font-semibold tabular-nums sm:text-2xl'>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className='grid items-start gap-5 lg:grid-cols-2'>
                  <div className='contents lg:block lg:space-y-5'>
                    <FestivalDrawPanel
                      data={data}
                      onRefresh={() => void refetch()}
                      onDrawSnapshotChange={setDrawSnapshot}
                    />
                    <section className='order-2 rounded-2xl border p-5 sm:p-6 lg:order-none'>
                      <h3 className='font-semibold'>{t('My draw history')}</h3>
                      {records.length === 0 ? (
                        <p className='text-muted-foreground py-7 text-center text-sm'>
                          {t(
                            'Your first festival prize is waiting. Earn a chance to get started.'
                          )}
                        </p>
                      ) : (
                        <ul className='mt-3 divide-y'>
                          {records.map((record) => (
                            <li
                              key={record.id}
                              className='flex flex-wrap items-center justify-between gap-2 py-3 text-sm'
                            >
                              <span className='text-muted-foreground'>
                                {new Date(
                                  record.created_at * 1000
                                ).toLocaleString(undefined, {
                                  timeZone: 'Asia/Shanghai',
                                })}
                              </span>
                              <span className='font-semibold'>
                                +{record.cookies}🍪
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                  <div className='order-1 space-y-5 lg:order-none'>
                    <FestivalProgress data={data} />
                    <section className='rounded-2xl border p-5 sm:p-6'>
                      <h3 className='font-semibold'>
                        {t('Prize probabilities')}
                      </h3>
                      <div className='mt-3 grid grid-cols-1 gap-1'>
                        {data.prizes.map((prize) => (
                          <div
                            key={prize.cookies}
                            className='bg-muted/40 flex items-center justify-between gap-3 rounded-lg px-3 py-2'
                          >
                            <p className='font-semibold'>{prize.cookies}🍪</p>
                            <p className='text-muted-foreground text-sm tabular-nums'>
                              {(prize.weight / 100).toFixed(1)}%
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className='text-muted-foreground mt-3 text-xs'>
                        {t(
                          'Each draw is independent. A 1% chance does not guarantee a win within 100 draws.'
                        )}
                      </p>
                    </section>
                  </div>
                </div>
                <section className='rounded-2xl border p-5 sm:p-6'>
                  <h3 className='font-semibold'>{t('How to participate')}</h3>
                  <ol className='text-muted-foreground mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed'>
                    <li>
                      {t(
                        'Only online top-ups and code redemptions completed during the event count. Progress uses the actual credited cookies, not the payment price.'
                      )}
                    </li>
                    <li>
                      {t(
                        'Reach 500 / 1000 / 2000 / 3000 / 4000 / 5000 / 6000 / 7000🍪 to receive 1 / 2 / 2 / 3 / 3 / 3 / 3 / 3 additional draws. Each milestone is granted once, for up to 20 draws in total.'
                      )}
                    </li>
                    <li>
                      {t(
                        'One payment can unlock several milestones. Existing balances, balance subscription purchases, invitation transfers and festival prizes do not add progress.'
                      )}
                    </li>
                    <li>
                      {t(
                        'Use your chances before October 7 at 23:59:59 (UTC+8). Unused chances expire; credited prizes stay in your wallet.'
                      )}
                    </li>
                    <li>
                      {t(
                        'Prizes are usage credits, cannot be withdrawn, and do not generate invitation rewards or further draw chances.'
                      )}
                    </li>
                  </ol>
                </section>
              </>
            )}
          </div>
        </FestivalGate>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
