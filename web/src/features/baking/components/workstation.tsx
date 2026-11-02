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
import { useEffect, useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { BakingAction, BakingState } from '../api'
import { BAKING_FX_COLORS, COOKIE_NAMES } from '../constants'
import { BakingIcon } from './baking-icon'
import { CookieArt } from './cookie-art'

interface Props {
  data: BakingState
  phase: BakingState['phase']
  busy: boolean
  onAction: (action: BakingAction) => void
}

export function Workstation(props: Props) {
  const { t } = useTranslation(undefined, { lng: 'zhCN' })
  const { round, rewards, chances } = props.data
  const stage = useRef<HTMLDivElement>(null)
  const level = round?.level ?? 0
  const baking = round?.status === 'baking'
  const visualLevel = Math.min(rewards.length - 1, level + (baking ? 1 : 0))
  const ready = round?.status === 'ready'
  const canStart = !ready && !baking
  const top = level === rewards.length - 1
  const active = props.phase === 'active'
  const value = rewards[level]
  let stateClass = ''
  let title = t(COOKIE_NAMES[level])
  let label = t('Starting reward')
  let displayedValue = value
  if (round) label = t('Ready to collect')
  if (ready && level > 0) {
    stateClass = 'success'
    title = t('{{name}} is ready!', { name: t(COOKIE_NAMES[level]) })
  }
  if (baking) {
    stateClass = 'baking'
    title = t('Baking…')
  }
  if (round?.status === 'burnt') {
    stateClass = 'burnt'
    title = t('Oops, burnt!')
    displayedValue = 0
    label = t('This round')
  }
  if (round?.status === 'claimed') {
    stateClass = 'claimed'
    title = t('Into the cookie jar!')
    label = t('Collected this round')
  }

  useEffect(() => {
    if (!baking) return
    const remaining = Math.max(
      0,
      (round?.ready_at ?? 0) - props.data.server_time
    )
    stage.current?.style.setProperty('--bake-duration', `${remaining}ms`)
    // Server polling must not restart an animation that is already running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baking, round?.id, round?.version])

  return (
    <section
      className='card game-card'
      aria-label={t('Baking station')}
      data-fx-level={visualLevel}
      style={
        {
          '--bake-accent': BAKING_FX_COLORS[visualLevel],
          '--bake-power': 0.35 + visualLevel * 0.12,
        } as CSSProperties
      }
    >
      <div className='game-heading'>
        <div>
          <p className='current-label'>{label}</p>
          <div className='current-value'>
            {displayedValue.toLocaleString()}
            <span className='cookie-currency'>🍪</span>
          </div>
        </div>
        <span className='stage-tag'>
          <b>{t('Level {{level}}', { level: level + 1 })}</b>
          {t(COOKIE_NAMES[level])}
        </span>
      </div>
      <div
        ref={stage}
        className={cn('oven-stage', stateClass)}
        id='oven-stage'
        data-door-open={ready || round?.status === 'burnt'}
      >
        {baking && (
          <div className='oven-motes' aria-hidden='true'>
            {Array.from({ length: 4 + visualLevel * 2 }, (_, index) => (
              <span
                key={index}
                style={
                  {
                    left: `${12 + ((index * 29) % 76)}%`,
                    '--drift': `${(index % 2 ? 1 : -1) * (12 + visualLevel * 4)}px`,
                    '--rise': `${65 + visualLevel * 9 + (index % 3) * 12}px`,
                    animationDelay: `${-index * 0.19}s`,
                  } as CSSProperties
                }
              >
                <BakingIcon name='spark' />
              </span>
            ))}
          </div>
        )}
        <div className='oven-smoke' aria-hidden='true'>
          <svg viewBox='0 0 100 66'>
            <g
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
            >
              <path d='M31 62c-20-17 20-26 0-47' />
              <path d='M50 58c-20-17 20-26 0-47' />
              <path d='M70 62c-20-17 20-26 0-47' />
            </g>
          </svg>
        </div>
        <div className='oven-machine' aria-hidden='true'>
          <div className='oven-top'>
            <span className='oven-brand'>STA1N</span>
            <span className='oven-display'>
              {t('Level {{level}}', { level: level + 1 })}
            </span>
            <i className='oven-dial' />
          </div>
          <div className='oven-chamber'>
            <div className='oven-window'>
              <div className='oven-glow' />
              <div className='oven-rack' />
              <div className='oven-cookie' id='oven-cookie'>
                <CookieArt level={level} />
              </div>
            </div>
            <div className='oven-door'>
              <div className='oven-door-glass'>
                <div className='oven-shine' />
              </div>
              <div className='oven-handle' />
            </div>
          </div>
        </div>
      </div>
      <div className={cn('state-message', stateClass)} role='status'>
        <h2>{title}</h2>
      </div>
      <div className='next-info'>
        <div className='next-item'>
          <span>{top ? t('Highest reward') : t('Next reward')}</span>
          <b>
            {(rewards[level + 1] ?? value).toLocaleString()}
            <span className='cookie-currency'>🍪</span>
          </b>
        </div>
        <div className='next-item rate'>
          <span>{t('Upgrade chance')}</span>
          <b>{top ? '—' : `${chances[level]}%`}</b>
        </div>
      </div>
      <div className='actions'>
        {canStart ? (
          <>
            <Link to='/wallet' className='button outline'>
              {t('Get ingredients')}
            </Link>
            <Button
              className='button primary'
              disabled={props.busy || !active || props.data.available < 1}
              onClick={() => props.onAction('start')}
            >
              <BakingIcon name='fire' />
              {t('Start baking')}
            </Button>
          </>
        ) : (
          <>
            <Button
              className='button outline'
              disabled={props.busy || !ready}
              onClick={() => props.onAction('claim')}
            >
              {!top && t('Take the win')}
              {top && (
                <span>
                  {t('Collect {{amount}}', { amount: value.toLocaleString() })}
                  <span className='cookie-currency'>🍪</span>
                </span>
              )}
            </Button>
            {!top && (
              <Button
                className='button primary'
                disabled={props.busy || !ready || !active}
                onClick={() => props.onAction('bake')}
              >
                <BakingIcon name='fire' />
                {t('Continue baking')}
              </Button>
            )}
          </>
        )}
      </div>
      <p className='risk-note'>
        <BakingIcon name='info' />
        <span>
          {canStart
            ? t('One ingredient starts one round.')
            : t('A failed upgrade loses this round’s unclaimed reward.')}
        </span>
      </p>
    </section>
  )
}
