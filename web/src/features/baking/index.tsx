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
import { LockKeyhole } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'

import '@/styles/baking.css'

import { BakingIcon } from './components/baking-icon'
import { BakingLevels, BakingHistory } from './components/levels-and-history'
import { BakingProgress } from './components/progress-card'
import { Workstation } from './components/workstation'
import { useBakingGame } from './lib/use-baking-game'
import { useEventClock } from './lib/use-event-clock'

export function Baking() {
  const { t } = useTranslation(undefined, { lng: 'zhCN' })
  const game = useBakingGame()
  const { view, query } = game
  const { data, refetch } = query
  const { now, phase } = useEventClock(query.data)
  const showActivity =
    !!view &&
    query.isFetchedAfterMount &&
    query.isSuccess &&
    (data?.phase === 'active' || data?.phase === 'ended') &&
    phase !== 'upcoming'
  const minutes = Math.max(
    0,
    Math.ceil(((data?.starts_at ?? now) - now) / 60000)
  )
  useEffect(() => {
    if (data && phase !== data.phase) void refetch()
  }, [phase, data, refetch])

  return (
    <SectionPageLayout headerClassName='baking-page-header'>
      <SectionPageLayout.Title>
        <span className='font-medium'>{t('Lucky Bakery')}</span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <span className='baking-date-badge text-muted-foreground border-border bg-card flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs'>
          <BakingIcon name='calendar' className='text-primary size-4' />
          {t('November 6 – November 12')}
        </span>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div
          ref={game.root}
          data-locked={!showActivity}
          className='baking-activity mx-auto w-full max-w-[1240px] py-2 sm:py-4'
        >
          {!showActivity && (
            <div className='event-notice' role='status'>
              <LockKeyhole aria-hidden='true' />
              {query.isError ? (
                <>
                  <span>{t('Unable to load event')}</span>
                  <Button variant='outline' onClick={() => query.refetch()}>
                    {t('Retry')}
                  </Button>
                </>
              ) : (
                <span>
                  {data && phase === 'upcoming'
                    ? t('Opens in {{days}}d {{hours}}h {{minutes}}m', {
                        days: Math.floor(minutes / 1440),
                        hours: Math.floor(minutes / 60) % 24,
                        minutes: minutes % 60,
                      })
                    : t('Loading…')}
                </span>
              )}
            </div>
          )}
          {showActivity && view ? (
            <>
              {phase === 'ended' && (
                <div className='event-notice' role='status'>
                  <BakingIcon name='calendar' />
                  <span>{t('This event has ended')}</span>
                </div>
              )}
              <section
                className='summary-grid'
                aria-label={t('My event stats')}
              >
                <div className='card stat-card'>
                  <p className='stat-label'>
                    <BakingIcon name='gift' />
                    {t('Cookies collected')}
                  </p>
                  <div className='stat-value'>
                    {view.claimed_cookies.toLocaleString()}
                    <span id='bank-cookie' className='cookie-currency'>
                      🍪
                    </span>
                  </div>
                </div>
                <div className='card stat-card'>
                  <p className='stat-label'>
                    <BakingIcon name='fire' />
                    {t('Available ingredients')}
                  </p>
                  <div className='stat-value'>
                    {view.available}
                    <small>{t('portions')}</small>
                  </div>
                </div>
              </section>
              <BakingProgress data={view} />
              <div className='main-layout'>
                <div className='side'>
                  <Workstation
                    data={view}
                    phase={phase}
                    busy={game.busy}
                    onAction={game.act}
                  />
                  <div className='history-desktop'>
                    <BakingHistory data={view} />
                  </div>
                </div>
                <aside className='side'>
                  <BakingLevels data={view} />
                  <div className='history-mobile'>
                    <BakingHistory data={view} />
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <div className='baking-locked-region' aria-hidden='true' inert>
              <div className='baking-locked-preview'>
                <div className='summary-grid'>
                  <div className='card' />
                  <div className='card' />
                </div>
                <div className='card preview-progress' />
                <div className='main-layout'>
                  <div className='card' />
                  <div className='card' />
                </div>
              </div>
            </div>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
