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
import { Crown, RefreshCw, Check } from 'lucide-react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  StatusBadge,
  dotColorMap,
  textColorMap,
} from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  getPublicPlans,
  getSelfSubscriptionFull,
  updateBillingPreference,
  updateSubscriptionPriority,
} from '@/features/subscriptions/api'
import { SubscriptionPurchaseDialog } from '@/features/subscriptions/components/dialogs/subscription-purchase-dialog'
import { SubscriptionScopeDialog } from '@/features/subscriptions/components/dialogs/subscription-scope-dialog'
import { SubscriptionQuotaUsage } from '@/features/subscriptions/components/subscription-quota-usage'
import {
  formatDuration,
  formatSubscriptionPrice,
  getPlanQuotaRows,
} from '@/features/subscriptions/lib'
import type {
  PlanRecord,
  UserSubscriptionRecord,
} from '@/features/subscriptions/types'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { PaymentMethod, TopupInfo } from '../types'

interface SubscriptionPlansCardProps {
  topupInfo: TopupInfo | null
  onAvailabilityChange?: (available: boolean) => void
  userQuota?: number
  onPurchaseSuccess?: () => void | Promise<void>
}

function getEpayMethods(payMethods: PaymentMethod[] = []): PaymentMethod[] {
  return payMethods.filter(
    (m) => m?.type && m.type !== 'stripe' && m.type !== 'creem'
  )
}

function getBillingPreferenceLabel(
  preference: string,
  t: (key: string) => string
): string {
  switch (preference) {
    case 'subscription_first':
      return t('Subscription First')
    case 'wallet_first':
      return t('Wallet First')
    case 'subscription_only':
      return t('Subscription Only')
    case 'wallet_only':
      return t('Wallet Only')
    default:
      return preference
  }
}

export function SubscriptionPlansCard({
  topupInfo,
  onAvailabilityChange,
  userQuota,
  onPurchaseSuccess,
}: SubscriptionPlansCardProps) {
  const { t } = useTranslation()

  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [allSubscriptions, setAllSubscriptions] = useState<
    UserSubscriptionRecord[]
  >([])
  const [billingPreference, setBillingPreference] =
    useState('subscription_first')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingPriority, setSavingPriority] = useState(false)
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const activeSubscriptions = useMemo(
    () =>
      allSubscriptions
        .filter(
          ({ subscription }) =>
            subscription.status === 'active' &&
            subscription.end_time * 1000 > now
        )
        .sort(
          (a, b) =>
            Number(!!b.subscription.is_preferred) -
            Number(!!a.subscription.is_preferred)
        ),
    [allSubscriptions, now]
  )

  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanRecord | null>(null)
  const [scopePlan, setScopePlan] = useState<PlanRecord | null>(null)

  const enableStripe = !!topupInfo?.enable_stripe_topup
  const enableCreem = !!topupInfo?.enable_creem_topup
  const enableWaffoPancake = !!topupInfo?.enable_waffo_pancake_topup
  const enableOnlineTopUp = !!topupInfo?.enable_online_topup
  const epayMethods = useMemo(
    () => getEpayMethods(topupInfo?.pay_methods),
    [topupInfo?.pay_methods]
  )

  const fetchPlans = useCallback(async () => {
    try {
      const res = await getPublicPlans()
      if (res.success) {
        setPlans(res.data || [])
      }
    } catch {
      setPlans([])
    }
  }, [])

  const fetchSelfSubscription = useCallback(async () => {
    try {
      const res = await getSelfSubscriptionFull()
      if (res.success && res.data) {
        setBillingPreference(
          res.data.billing_preference || 'subscription_first'
        )
        setAllSubscriptions(res.data.all_subscriptions || [])
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchPlans(), fetchSelfSubscription()])
      setLoading(false)
    }
    init()
  }, [fetchPlans, fetchSelfSubscription])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchSelfSubscription()
    } finally {
      setRefreshing(false)
    }
  }

  const handlePreferenceChange = async (pref: string) => {
    const previous = billingPreference
    setBillingPreference(pref)
    try {
      const res = await updateBillingPreference(pref)
      if (res.success) {
        toast.success(t('Updated successfully'))
        const normalized = res.data?.billing_preference || pref
        setBillingPreference(normalized)
      } else {
        toast.error(res.message || t('Update failed'))
        setBillingPreference(previous)
      }
    } catch {
      toast.error(t('Request failed'))
      setBillingPreference(previous)
    }
  }

  const hasActive = activeSubscriptions.length > 0
  const isAvailable = loading || plans.length > 0 || hasActive
  const disablePref = !hasActive
  const isSubPref =
    billingPreference === 'subscription_first' ||
    billingPreference === 'subscription_only'
  const displayPref =
    disablePref && isSubPref ? 'wallet_first' : billingPreference

  const handlePriorityChange = async (id: number) => {
    setSavingPriority(true)
    try {
      const res = await updateSubscriptionPriority(id)
      if (!res.success) {
        toast.error(res.message || t('Update failed'))
        return
      }
      setAllSubscriptions((items) =>
        items.map((item) => ({
          ...item,
          subscription: {
            ...item.subscription,
            is_preferred: item.subscription.id === id,
          },
        }))
      )
    } catch {
      toast.error(t('Request failed'))
    } finally {
      setSavingPriority(false)
    }
  }

  const planPurchaseCountMap = useMemo(() => {
    const map = new Map<number, number>()
    for (const sub of allSubscriptions) {
      const planId = sub?.subscription?.plan_id
      if (!planId) continue
      map.set(planId, (map.get(planId) || 0) + 1)
    }
    return map
  }, [allSubscriptions])

  useEffect(() => {
    onAvailabilityChange?.(isAvailable)
  }, [isAvailable, onAvailabilityChange])

  const planTitleMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const p of plans) {
      if (p?.plan?.id) {
        map.set(p.plan.id, p.plan.title || '')
      }
    }
    return map
  }, [plans])

  const getRemainingDays = (sub: UserSubscriptionRecord) => {
    const endTime = sub?.subscription?.end_time || 0
    if (!endTime) return 0
    return Math.max(0, Math.ceil((endTime - now / 1000) / 86400))
  }

  if (loading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <CardHeader className='border-b p-3 !pb-3 sm:p-5 sm:!pb-5'>
          <Skeleton className='h-6 w-32' />
        </CardHeader>
        <CardContent className='space-y-4 p-3 sm:p-5'>
          <Skeleton className='h-20 w-full' />
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
            {['first', 'second', 'third'].map((key) => (
              <Skeleton key={key} className='h-48 w-full' />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (plans.length === 0 && !hasActive) {
    return null
  }

  return (
    <>
      <TitledCard
        title={
          <>
            <span>{t('Subscription Plans')}</span>
            <span className='flex items-center gap-1.5 text-xs font-medium tracking-normal'>
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  hasActive ? dotColorMap.success : dotColorMap.neutral
                )}
                aria-hidden='true'
              />
              <span
                className={
                  hasActive ? textColorMap.success : 'text-muted-foreground'
                }
              >
                {activeSubscriptions.length} {t('active')}
              </span>
            </span>
          </>
        }
        titleClassName='flex flex-wrap items-center gap-2'
        icon={<Crown className='h-4 w-4' />}
        iconTone='warning'
        disableHoverEffect
        action={
          <div className='flex w-full items-center gap-2 sm:w-auto'>
            <Select
              items={[
                {
                  value: 'subscription_first',
                  label: (
                    <>
                      {getBillingPreferenceLabel('subscription_first', t)}
                      {disablePref ? ` (${t('No Active')})` : ''}
                    </>
                  ),
                },
                {
                  value: 'wallet_first',
                  label: getBillingPreferenceLabel('wallet_first', t),
                },
                {
                  value: 'subscription_only',
                  label: (
                    <>
                      {getBillingPreferenceLabel('subscription_only', t)}
                      {disablePref ? ` (${t('No Active')})` : ''}
                    </>
                  ),
                },
                {
                  value: 'wallet_only',
                  label: getBillingPreferenceLabel('wallet_only', t),
                },
              ]}
              value={displayPref}
              onValueChange={(v) => v !== null && handlePreferenceChange(v)}
            >
              <SelectTrigger
                aria-label={t('Manage subscription behavior')}
                className='h-8 flex-1 text-xs sm:w-[140px] sm:flex-none'
              >
                <SelectValue>
                  {getBillingPreferenceLabel(displayPref, t)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  <SelectItem value='subscription_first' disabled={disablePref}>
                    {getBillingPreferenceLabel('subscription_first', t)}
                    {disablePref ? ` (${t('No Active')})` : ''}
                  </SelectItem>
                  <SelectItem value='wallet_first'>
                    {getBillingPreferenceLabel('wallet_first', t)}
                  </SelectItem>
                  <SelectItem value='subscription_only' disabled={disablePref}>
                    {getBillingPreferenceLabel('subscription_only', t)}
                    {disablePref ? ` (${t('No Active')})` : ''}
                  </SelectItem>
                  <SelectItem value='wallet_only'>
                    {getBillingPreferenceLabel('wallet_only', t)}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              aria-label={t('Refresh')}
              variant='ghost'
              size='icon'
              className='h-8 w-8'
              onClick={handleRefresh}
              disabled={refreshing || savingPriority}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>
        }
        contentClassName='space-y-4 sm:space-y-5'
      >
        {/* My subscriptions */}
        <div className='space-y-3'>
          {disablePref && isSubPref && (
            <p className='text-muted-foreground mt-2 text-xs'>
              {t(
                'Preference saved as {{pref}}, but no active subscription. Wallet will be used automatically.',
                {
                  pref:
                    billingPreference === 'subscription_only'
                      ? t('Subscription Only')
                      : t('Subscription First'),
                }
              )}
            </p>
          )}

          {hasActive && (
            <div className='max-h-[32rem] space-y-4 overflow-y-auto pr-1'>
              {activeSubscriptions.map((sub) => {
                const subscription = sub.subscription
                const planTitle = planTitleMap.get(subscription?.plan_id) || ''
                const remainDays = getRemainingDays(sub)

                return (
                  <article
                    key={subscription?.id}
                    aria-label={`${t('Subscription')} #${subscription.id}`}
                    className='bg-background space-y-3 rounded-2xl border p-3.5 text-xs sm:p-4'
                  >
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <div className='flex min-w-0 flex-wrap items-center gap-2'>
                        <span className='text-sm font-semibold'>
                          {planTitle || t('Subscription')}
                        </span>
                        <StatusBadge
                          label={t('Active')}
                          variant='success'
                          copyable={false}
                        />
                      </div>
                      <div className='flex items-center gap-3'>
                        <span className='text-muted-foreground'>
                          {t('{{count}} days remaining', {
                            count: remainDays,
                          })}
                        </span>
                        <Button
                          variant='outline'
                          size='sm'
                          className={cn(
                            'h-7 rounded-full px-3 text-xs',
                            subscription.is_preferred &&
                              'text-muted-foreground disabled:opacity-100'
                          )}
                          aria-pressed={!!subscription.is_preferred}
                          disabled={
                            savingPriority ||
                            refreshing ||
                            subscription.is_preferred
                          }
                          onClick={() => handlePriorityChange(subscription.id)}
                        >
                          {t(
                            subscription.is_preferred
                              ? 'Using first'
                              : 'Use first'
                          )}
                        </Button>
                      </div>
                    </div>
                    <SubscriptionQuotaUsage
                      subscription={subscription}
                      plan={
                        plans.find((p) => p.plan.id === subscription.plan_id)
                          ?.plan
                      }
                      active
                    />
                  </article>
                )
              })}
            </div>
          )}

          {!hasActive && (
            <p className='text-muted-foreground mt-2 text-xs'>
              {t('No active subscriptions')}
            </p>
          )}
        </div>

        {/* Available plans grid */}
        {plans.length > 0 ? (
          <div className='grid grid-cols-1 gap-3 2xl:grid-cols-2 2xl:gap-4'>
            {plans.map((p) => {
              const plan = p?.plan
              if (!plan) return null
              const price = formatSubscriptionPrice(plan.price_amount)
              const limit = Number(plan.max_purchase_per_user || 0)
              const count = planPurchaseCountMap.get(plan.id) || 0
              const reached = limit > 0 && count >= limit

              const benefits = [
                `${t('Validity Period')}: ${formatDuration(plan, t)}`,
                ...getPlanQuotaRows(plan, t).map(
                  (row) =>
                    `${row.label}: ${row.amount > 0 ? formatQuota(row.amount) : t('Unlimited')}`
                ),
                limit > 0 ? `${t('Purchase Limit')}: ${limit}` : null,
                plan.upgrade_group
                  ? `${t('Upgrade Group')}: ${plan.upgrade_group}`
                  : null,
              ].filter(Boolean) as string[]

              return (
                <Card key={plan.id} data-card-hover='false'>
                  <CardContent className='flex h-full flex-col p-3.5 sm:p-4'>
                    <div className='mb-2 min-w-0'>
                      <h4 className='truncate font-semibold'>
                        {plan.title || t('Subscription Plans')}
                      </h4>
                      {plan.subtitle && (
                        <p className='text-muted-foreground truncate text-xs'>
                          {plan.subtitle}
                        </p>
                      )}
                    </div>

                    <div className='py-2'>
                      <span className='text-primary text-2xl font-bold'>
                        {price}
                      </span>
                    </div>

                    <div className='flex-1 space-y-1.5 pb-3'>
                      {benefits.map((label) => (
                        <div
                          key={label}
                          className='text-muted-foreground flex items-center gap-2 text-xs'
                        >
                          <Check className='text-primary h-3 w-3 shrink-0' />
                          <span>{label}</span>
                        </div>
                      ))}
                    </div>

                    <Separator className='mb-3' />

                    <Button
                      variant='outline'
                      className='mb-2 w-full'
                      onClick={() => setScopePlan(p)}
                    >
                      {t('Usage scope')}
                    </Button>
                    {reached ? (
                      <Tooltip>
                        <TooltipTrigger render={<div />}>
                          <Button variant='outline' className='w-full' disabled>
                            {t('Limit Reached')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('Purchase limit reached')} ({count}/{limit})
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        variant='outline'
                        className='w-full'
                        onClick={() => {
                          setSelectedPlan(p)
                          setPurchaseOpen(true)
                        }}
                      >
                        {t('Subscribe Now')}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <p className='text-muted-foreground py-4 text-center text-sm'>
            {t('No plans available')}
          </p>
        )}
      </TitledCard>

      {scopePlan && (
        <SubscriptionScopeDialog
          plan={scopePlan.plan}
          onOpenChange={(open) => {
            if (!open) setScopePlan(null)
          }}
        />
      )}

      <SubscriptionPurchaseDialog
        open={purchaseOpen}
        onOpenChange={(open) => {
          setPurchaseOpen(open)
          if (!open) {
            fetchSelfSubscription()
          }
        }}
        plan={selectedPlan}
        enableStripe={enableStripe}
        enableCreem={enableCreem}
        enableWaffoPancake={enableWaffoPancake}
        enableOnlineTopUp={enableOnlineTopUp}
        epayMethods={epayMethods}
        userQuota={userQuota}
        onPurchaseSuccess={onPurchaseSuccess}
        purchaseLimit={
          selectedPlan?.plan?.max_purchase_per_user
            ? Number(selectedPlan.plan.max_purchase_per_user)
            : undefined
        }
        purchaseCount={
          selectedPlan?.plan?.id
            ? planPurchaseCountMap.get(selectedPlan.plan.id)
            : undefined
        }
      />
    </>
  )
}
