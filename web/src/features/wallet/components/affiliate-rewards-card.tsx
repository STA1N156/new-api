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
import { ArrowUpRight, Gift, Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'

import type { UserWalletData } from '../types'

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  affiliateLink: string
  onTransfer: () => void
  complianceConfirmed?: boolean
  loading?: boolean
}

export function AffiliateRewardsCard(props: AffiliateRewardsCardProps) {
  const { t } = useTranslation()
  if (props.loading) {
    return (
      <Card data-card-hover='false' className='py-0'>
        <CardContent className='space-y-4 p-4 sm:p-5'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='h-24 w-full rounded-lg' />
          <Skeleton className='h-9 w-full rounded-lg' />
        </CardContent>
      </Card>
    )
  }

  const user = props.user
  const available = user?.aff_quota ?? 0
  const total = user?.aff_history_quota ?? 0
  const topUpIncome = user?.aff_topup_quota ?? 0
  const compliant = props.complianceConfirmed !== false

  return (
    <Card data-card-hover='false' className='py-0'>
      <CardContent className='space-y-5 p-4 sm:p-5'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-2.5'>
            <IconBadge tone='chart-3'>
              <Share2 aria-hidden='true' />
            </IconBadge>
            <h3 className='text-base font-semibold'>{t('Invite Program')}</h3>
          </div>
          <div
            role='group'
            aria-label={t('Available rewards')}
            className='flex items-baseline gap-2'
          >
            <span className='text-muted-foreground text-xs'>
              {t('Available rewards')}
            </span>
            <span className='text-lg font-semibold tabular-nums'>
              {formatQuota(available)}
            </span>
          </div>
        </div>

        <div className='grid gap-3 md:grid-cols-2'>
          <div className='bg-muted/35 rounded-xl p-3.5'>
            <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
              <Gift aria-hidden='true' className='size-3.5' />
              {t('When your friend signs up')}
            </div>
            <div className='mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium'>
              <span>
                {t('You receive {{amount}}', {
                  amount: formatQuota(user?.aff_inviter_reward ?? 0),
                })}
              </span>
              <span>
                {t('Your friend receives {{amount}}', {
                  amount: formatQuota(user?.aff_invitee_reward ?? 0),
                })}
              </span>
            </div>
          </div>
          <div className='bg-muted/35 rounded-xl p-3.5'>
            <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
              <ArrowUpRight aria-hidden='true' className='size-3.5' />
              {t(
                'Every time your friend tops up, subscribes or redeems a code'
              )}
            </div>
            <p className='mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400'>
              {t('Earn {{percent}}% of the amount as rewards', {
                percent: user?.aff_topup_reward_percent ?? 8,
              })}
            </p>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4'>
          {[
            [t('Top-up earnings'), formatQuota(topUpIncome)],
            [
              t('Signup earnings'),
              formatQuota(Math.max(0, total - topUpIncome)),
            ],
            [t('Invited Users'), String(user?.aff_count ?? 0)],
            [t('Total Earned'), formatQuota(total)],
          ].map(([label, value]) => (
            <div
              key={label}
              role='group'
              aria-label={label}
              className='min-w-0'
            >
              <div className='text-muted-foreground text-xs'>{label}</div>
              <div className='mt-1 text-sm font-semibold break-all tabular-nums'>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className='flex flex-wrap items-center gap-2 border-t pt-4'>
          <div className='flex min-w-0 flex-1 basis-60 gap-2'>
            <Input
              value={props.affiliateLink}
              readOnly
              aria-label={t('Invitation link')}
              className='h-9 min-w-0 flex-1 font-mono text-xs'
            />
            <CopyButton
              value={props.affiliateLink}
              variant='outline'
              className='size-9 shrink-0'
              iconClassName='size-4'
              tooltip={t('Copy invitation link')}
              aria-label={t('Copy invitation link')}
            />
          </div>
          <Button
            onClick={props.onTransfer}
            disabled={available <= 0 || !compliant}
            className='h-9 shrink-0 px-3'
            size='sm'
          >
            {t('Transfer to Balance')}
          </Button>
        </div>
        {!compliant && (
          <p className='text-muted-foreground text-xs leading-relaxed'>
            {t(
              'Invitation rewards are paused until payment compliance is confirmed.'
            )}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
