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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import type { BakingState } from '../api'
import { COOKIE_NAMES } from '../constants'
import { BakingIcon } from './baking-icon'
import { CookieArt } from './cookie-art'

export function BakingLevels(props: { data: BakingState }) {
  const { t } = useTranslation(undefined, { lng: 'zhCN' })
  const { data } = props
  return (
    <section className='card'>
      <div className='card-title'>
        <h2>{t('Baking levels')}</h2>
      </div>
      <table className='level-table'>
        <thead>
          <tr>
            <th scope='col'>{t('Level')}</th>
            <th scope='col'>{t('Reward')}</th>
            <th scope='col'>{t('Upgrade chance')}</th>
          </tr>
        </thead>
        <tbody>
          {data.rewards.map((reward, level) => (
            <tr
              key={reward}
              className={data.round?.level === level ? 'current' : undefined}
            >
              <td>
                <div className='level-name'>
                  <CookieArt level={level} />
                  <div>
                    <strong>{t(COOKIE_NAMES[level])}</strong>
                    <small>{t('Level {{level}}', { level: level + 1 })}</small>
                  </div>
                </div>
              </td>
              <td>{reward.toLocaleString()}</td>
              <td>{level > 0 ? `${data.chances[level - 1]}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className='rules'>
        <h3>{t('Event rules')}</h3>
        <ul>
          <li>
            {t(
              'One ingredient starts a round with {{amount}} cookies. Collect now or try upgrading.',
              { amount: data.rewards[0].toLocaleString() }
            )}
          </li>
          <li>
            {t(
              'Each successful bake upgrades one level. A failure loses all unclaimed cookies in that round.'
            )}
          </li>
          <li>
            {t(
              'Each upgrade is independent. The maximum reward is {{amount}} cookies per round.',
              { amount: data.rewards.at(-1)?.toLocaleString() }
            )}
          </li>
          <li>
            {t(
              'Online top-ups and redemption codes count by cookies received. Subscription purchases count at ¥1 = 10 cookies.'
            )}
          </li>
          <li>
            {t(
              'Milestone ingredients are added together, up to {{count}}. Only payments credited during the event count.',
              {
                count: data.milestones.reduce(
                  (total, milestone) => total + milestone.grants,
                  0
                ),
              }
            )}
          </li>
          <li>
            {t(
              'Event time: November 6, 00:00 – November 12, 23:59 (Hong Kong). Unused ingredients expire when the event ends; an existing reward can still be collected.'
            )}
          </li>
        </ul>
      </section>
    </section>
  )
}

export function BakingHistory(props: { data: BakingState }) {
  const { t } = useTranslation(undefined, { lng: 'zhCN' })
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(props.data.history.length / 10))
  const currentPage = Math.min(page, pageCount)
  const records = props.data.history.slice(
    (currentPage - 1) * 10,
    currentPage * 10
  )
  return (
    <section className='card'>
      <div className='card-title history-title'>
        <h2>
          <span data-baking-spark aria-hidden='true'>
            <BakingIcon name='spark' />
          </span>
          {t('Baking history')}
        </h2>
      </div>
      <ul className='record-list'>
        {props.data.history.length === 0 && (
          <li className='empty-record'>{t('Your first cookie is waiting.')}</li>
        )}
        {records.map((round) => (
          <li key={round.id}>
            <span
              className={`record-icon ${round.status === 'claimed' ? 'positive' : 'burnt'}`}
              aria-hidden='true'
            >
              <CookieArt level={round.level} />
            </span>
            <div className='record-copy'>
              <strong className='record-name'>
                {round.status === 'claimed'
                  ? t(COOKIE_NAMES[round.level])
                  : t('Oops, burnt!')}
              </strong>
              <div className='record-meta'>
                <span>{t('Round {{number}}', { number: round.serial })}</span>
                <span>{t('Level {{level}}', { level: round.level + 1 })}</span>
              </div>
            </div>
            <b
              className={`record-amount ${round.status === 'claimed' ? 'positive' : ''}`}
            >
              {round.claimed_cookies > 0
                ? `+${round.claimed_cookies.toLocaleString()}`
                : '0'}
              <span className='cookie-currency'>🍪</span>
            </b>
          </li>
        ))}
      </ul>
      {pageCount > 1 && (
        <nav className='history-pagination' aria-label={t('Baking history')}>
          <Button
            variant='outline'
            size='sm'
            className='size-8 p-0'
            aria-label={t('Previous page')}
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            <BakingIcon name='arrow' className='rotate-180' />
          </Button>
          <span
            className='mono'
            role='status'
            aria-label={t('Page {{current}} of {{total}}', {
              current: currentPage,
              total: pageCount,
            })}
          >
            {currentPage} / {pageCount}
          </span>
          <Button
            variant='outline'
            size='sm'
            className='size-8 p-0'
            aria-label={t('Next page')}
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            <BakingIcon name='arrow' />
          </Button>
        </nav>
      )}
    </section>
  )
}
