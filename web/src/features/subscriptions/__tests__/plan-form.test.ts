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
import i18next from 'i18next'
import { afterEach, expect, it } from 'vitest'

import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import {
  formValuesToPlanPayload,
  getPlanFormSchema,
  PLAN_FORM_DEFAULTS,
  planToFormValues,
} from '../lib/plan-form'
import { subscriptionPlanSchema } from '../types'

const initialConfig = useSystemConfigStore.getState().config
afterEach(() => {
  useSystemConfigStore.getState().setConfig(initialConfig)
  localStorage.clear()
})

it('saves hours and displayed quota, then restores them when editing a plan', () => {
  useSystemConfigStore
    .getState()
    .setConfig({
      currency: {
        ...DEFAULT_CURRENCY_CONFIG,
        quotaDisplayType: 'CUSTOM',
        customCurrencySymbol: '🍪',
        customCurrencyExchangeRate: 2,
      },
    })
  const values = {
    ...PLAN_FORM_DEFAULTS,
    title: 'Plan',
    total_amount: 300,
    quota_limits: [{ period_hours: 5, amount_total: 50 }],
  }
  const payload = formValuesToPlanPayload(values)
  expect(payload.plan.quota_limits).toEqual([
    { period_seconds: 18000, amount_total: 12500000 },
  ])
  expect(payload.plan.allow_wallet_overflow).toBe(false)
  const plan = subscriptionPlanSchema.parse({ id: 1, ...payload.plan })
  expect(planToFormValues(plan).quota_limits).toEqual(values.quota_limits)
  expect(
    formValuesToPlanPayload({ ...values, quota_limits: [] }).plan.quota_limits
  ).toEqual([])
})

it('rejects duplicate cycles, zero quotas and fractional seconds', () => {
  const schema = getPlanFormSchema(i18next.t)
  for (const quota_limits of [
    [{ period_hours: 5, amount_total: 0 }],
    [{ period_hours: 0, amount_total: 50 }],
    [{ period_hours: 0.00001, amount_total: 50 }],
    [
      { period_hours: 5, amount_total: 50 },
      { period_hours: 5, amount_total: 100 },
    ],
  ]) {
    expect(
      schema.safeParse({ ...PLAN_FORM_DEFAULTS, title: 'Plan', quota_limits })
        .success
    ).toBe(false)
  }
})
