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
import type { TFunction } from 'i18next'

import dayjs from '@/lib/dayjs'

import type { SubscriptionPlan } from '../types'

export function formatSubscriptionPrice(amount: number): string {
  return `¥${Number(amount || 0).toFixed(2)}`
}

export function formatQuotaPeriodLabel(seconds: number, t: TFunction): string {
  if (seconds % 86400 === 0) {
    return t('Quota per {{count}} days', { count: seconds / 86400 })
  }
  if (seconds % 3600 === 0) {
    return t('Quota per {{count}} hours', { count: seconds / 3600 })
  }
  if (seconds % 60 === 0) {
    return t('Quota per {{count}} minutes', { count: seconds / 60 })
  }
  return t('Quota per {{count}} seconds', { count: seconds })
}

export function getPlanQuotaRows(
  plan: Partial<SubscriptionPlan>,
  t: TFunction
): { key: string; label: string; amount: number; periodSeconds: number }[] {
  let label = t('Total Quota')
  let periodSeconds = Infinity
  switch (plan.quota_reset_period) {
    case 'daily':
      label = t('Daily Quota')
      periodSeconds = 86400
      break
    case 'weekly':
      label = t('Weekly Quota')
      periodSeconds = 7 * 86400
      break
    case 'monthly':
      label = t('Monthly Quota')
      periodSeconds = 30 * 86400
      break
    case 'custom':
      label = formatQuotaPeriodLabel(plan.quota_reset_custom_seconds || 0, t)
      periodSeconds = plan.quota_reset_custom_seconds || Infinity
      break
  }
  return [
    { key: 'primary', label, amount: plan.total_amount || 0, periodSeconds },
    ...(plan.quota_limits || []).map((limit) => ({
      key: String(limit.period_seconds),
      label: formatQuotaPeriodLabel(limit.period_seconds, t),
      amount: limit.amount_total,
      periodSeconds: limit.period_seconds,
    })),
  ].sort((a, b) => a.periodSeconds - b.periodSeconds)
}

export function formatDuration(
  plan: Partial<SubscriptionPlan>,
  t: TFunction
): string {
  const unit = plan?.duration_unit || 'month'
  const value = plan?.duration_value || 1
  const unitLabels: Record<string, string> = {
    year: t('years'),
    month: t('months'),
    day: t('days'),
    hour: t('hours'),
    custom: t('Custom (seconds)'),
  }
  if (unit === 'custom') {
    const seconds = plan?.custom_seconds || 0
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)} ${t('days')}`
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)} ${t('hours')}`
    return `${seconds} ${t('seconds')}`
  }
  return `${value} ${unitLabels[unit] || unit}`
}

export function formatResetPeriod(
  plan: Partial<SubscriptionPlan>,
  t: TFunction
): string {
  const period = plan?.quota_reset_period || 'never'
  if (period === 'daily') return t('Daily')
  if (period === 'weekly') return t('Weekly')
  if (period === 'monthly') return t('Monthly')
  if (period === 'custom') {
    const seconds = Number(plan?.quota_reset_custom_seconds || 0)
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)} ${t('days')}`
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)} ${t('hours')}`
    if (seconds >= 60) return `${Math.floor(seconds / 60)} ${t('minutes')}`
    return `${seconds} ${t('seconds')}`
  }
  return t('No Reset')
}

export function formatTimestamp(ts: number): string {
  if (!ts) return '-'
  return dayjs(ts * 1000).format('YYYY-MM-DD HH:mm:ss')
}
