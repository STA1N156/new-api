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
import { describe, expect, test } from 'vitest'

import { usageLogSchema } from '../../data/schema'
import type { LogOtherData } from '../../types'
import {
  formatTokenCostPercentages,
  getCacheWriteTokens,
  getLogTokenCosts,
} from '../token-costs'

function costs(
  quota: number,
  other: LogOtherData,
  prompt = 1000,
  completion = 100
) {
  const log = usageLogSchema.parse({
    id: 1,
    user_id: 1,
    created_at: 0,
    type: 2,
    content: '',
    quota,
    prompt_tokens: prompt,
    completion_tokens: completion,
  })
  return getLogTokenCosts(log, other)
}

describe('token cost percentages', () => {
  test.each([
    {
      name: 'equal charges with a rounding remainder',
      charges: { input: 1, output: 1, cacheRead: 0.4, cacheWrite: 0.6 },
      expected: { input: '33.34%', output: '33.33%', cache: '33.33%' },
    },
    {
      name: 'decimal charges',
      charges: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite: 0 },
      expected: { input: '16.67%', output: '33.33%', cache: '50.00%' },
    },
    {
      name: 'no cache usage',
      charges: { input: 1, output: 7, cacheRead: 0, cacheWrite: 0 },
      expected: { input: '12.50%', output: '87.50%', cache: '0.00%' },
    },
    {
      name: 'combined cache-only charges',
      charges: { input: 0, output: 0, cacheRead: 4, cacheWrite: 6 },
      expected: { input: '0.00%', output: '0.00%', cache: '100.00%' },
    },
  ])(
    'keeps $name at exactly 100.00% with two decimal places',
    ({ charges, expected }) => {
      expect(formatTokenCostPercentages(charges)).toEqual(expected)
    }
  )

  test('does not invent a percentage for a free request', () => {
    expect(
      formatTokenCostPercentages({
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      })
    ).toBeNull()
  })
})

describe('token charge breakdown', () => {
  test('separates cached input and applies the recorded model and group ratios', () => {
    expect(
      costs(760, {
        model_ratio: 2,
        completion_ratio: 3,
        group_ratio: 0.5,
        cache_tokens: 600,
        cache_ratio: 0.1,
      })
    ).toEqual({ input: 400, output: 300, cacheRead: 60, cacheWrite: 0 })
  })

  test('keeps Anthropic input separate and includes generic plus timed cache creation', () => {
    const other = {
      claude: true,
      model_ratio: 2,
      completion_ratio: 3,
      group_ratio: 0.5,
      cache_tokens: 500,
      cache_ratio: 0.1,
      cache_creation_tokens: 300,
      cache_creation_tokens_5m: 100,
      cache_creation_tokens_1h: 100,
      cache_creation_ratio: 1.25,
      cache_creation_ratio_5m: 1.25,
      cache_creation_ratio_1h: 2,
    }
    expect(getCacheWriteTokens(other)).toBe(300)
    expect(costs(1200, other, 100, 200)).toEqual({
      input: 100,
      output: 600,
      cacheRead: 50,
      cacheWrite: 450,
    })
  })

  test('uses the matched expression tier and only matched request multipliers', () => {
    expect(
      costs(2280, {
        billing_mode: 'tiered_expr',
        matched_tier: 'base',
        group_ratio: 1.5,
        expr_b64: btoa('v1:tier("base", p * 2 + c * 6 + cr * 0.2) / 1000000'),
        cache_tokens: 600,
        request_rules: [
          { cond: 'a', multiplier: 2, matched: true },
          { cond: 'b', multiplier: 3, matched: false },
        ],
      })
    ).toEqual({ input: 1200, output: 900, cacheRead: 180, cacheWrite: 0 })
  })

  test('does not allocate tool-call surcharges to token usage', () => {
    expect(
      costs(5760, {
        model_ratio: 2,
        completion_ratio: 3,
        group_ratio: 0.5,
        cache_tokens: 600,
        cache_ratio: 0.1,
        tool_surcharges: [{ name: 'web_search', count: 2, price: 10 }],
      })
    ).toEqual({ input: 400, output: 300, cacheRead: 60, cacheWrite: 0 })
  })

  test('does not invent per-token costs for per-call billing or incomplete historical records', () => {
    expect(costs(1000, { model_price: 0.002 })).toBeNull()
    expect(costs(1000, { model_ratio: 2 })).toBeNull()
    expect(costs(1000, { model_ratio: 2, completion_ratio: 3 })).toBeNull()
    expect(costs(0, { model_ratio: 2, completion_ratio: 3 })).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    })
  })
})
