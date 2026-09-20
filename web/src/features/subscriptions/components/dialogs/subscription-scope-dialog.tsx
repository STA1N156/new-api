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
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { getPricing } from '@/features/pricing/api'
import { getDisplayGroupRatio } from '@/features/pricing/lib/model-helpers'
import { formatQuotaWithCurrency, getCurrencyDisplay } from '@/lib/currency'
import { useAuthStore } from '@/stores/auth-store'

import { formatQuotaPeriodLabel, getPlanQuotaRows } from '../../lib/format'
import type { SubscriptionPlan } from '../../types'

export function SubscriptionScopeDialog({
  plan,
  onOpenChange,
}: {
  plan: SubscriptionPlan
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const { config, meta } = getCurrencyDisplay()
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['pricing', 'subscription-scope', user?.id],
    queryFn: async () => {
      const result = await getPricing()
      if (!result.success) {
        throw new Error(result.message || 'Pricing unavailable')
      }
      return result
    },
    retry: false,
  })
  const restricted = !!plan.allowed_models?.length
  const models = new Map(
    (data?.data || []).map((model) => [model.model_name, model])
  )
  const names = restricted ? plan.allowed_models || [] : [...models.keys()]
  const cycles = getPlanQuotaRows(plan, t).map((cycle) => {
    let label = formatQuotaPeriodLabel(cycle.periodSeconds, t, 'available')
    if (!Number.isFinite(cycle.periodSeconds)) {
      label = t('Available during validity')
    } else if (
      cycle.key === 'primary' &&
      plan.quota_reset_period === 'monthly'
    ) {
      label = t('Available every month')
    }
    return { ...cycle, label }
  })

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title={t('Usage scope')}
      description={plan.title}
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'
      bodyClassName='space-y-3'
    >
      {!restricted && <p className='text-sm font-medium'>{t('All Models')}</p>}
      <p className='text-muted-foreground text-sm'>
        {t(
          restricted
            ? 'Only selected models can use this plan quota.'
            : 'This plan quota can be used with all models.'
        )}
      </p>
      <p className='text-muted-foreground text-sm'>
        {t('Models share the plan quota. Each cycle shows its full allowance.')}
      </p>
      {isError && (
        <div className='text-muted-foreground flex items-center justify-between gap-2 text-xs'>
          <span>
            {t('Pricing unavailable; showing quota instead of call counts.')}
          </span>
          <Button variant='ghost' size='sm' onClick={() => refetch()}>
            {t('Retry')}
          </Button>
        </div>
      )}
      {isPending && (
        <p className='text-muted-foreground text-xs' role='status'>
          {t('Loading...')}
        </p>
      )}
      <Accordion multiple aria-label={t('Available Models')}>
        {names.map((name) => {
          const model = models.get(name)
          const perRequest =
            model?.quota_type === 1 && model.billing_mode !== 'tiered_expr'
          const price =
            perRequest && typeof model.model_price === 'number'
              ? model.model_price *
                getDisplayGroupRatio(
                  { ...model, group_ratio: data?.group_ratio },
                  plan.upgrade_group || user?.group
                ) *
                config.quotaPerUnit
              : Number.NaN
          const showCalls = perRequest && Number.isFinite(price) && price >= 0
          return (
            <AccordionItem key={name} value={name}>
              <AccordionTrigger className='items-center gap-2 hover:no-underline'>
                <Check className='text-primary size-4 shrink-0' />
                <span className='min-w-0 flex-1 font-mono break-all'>
                  {name}
                </span>
              </AccordionTrigger>
              <AccordionContent className='pl-6'>
                {!isPending && (
                  <dl className='space-y-2 py-1 text-sm'>
                    {cycles.map((cycle) => {
                      let amount = t('Unlimited')
                      if (cycle.amount > 0 && !(showCalls && price === 0)) {
                        amount = showCalls
                          ? t('{{count}} calls', {
                              count: Math.round(cycle.amount / price),
                            })
                          : formatQuotaWithCurrency(cycle.amount, {
                              showSymbol: meta.kind !== 'custom',
                              abbreviate: false,
                            }) + (meta.kind === 'custom' ? meta.symbol : '')
                      }
                      return (
                        <div
                          key={cycle.key}
                          className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1'
                        >
                          <dt className='text-muted-foreground'>
                            {cycle.label}
                          </dt>
                          <dd className='font-medium tabular-nums'>{amount}</dd>
                        </div>
                      )
                    })}
                  </dl>
                )}
                {showCalls && (
                  <p className='text-muted-foreground mt-2 text-xs'>
                    {t(
                      'Call counts are estimated from current model and group prices, rounded to the nearest integer.'
                    )}
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </Dialog>
  )
}
