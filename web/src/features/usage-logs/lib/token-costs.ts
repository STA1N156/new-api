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
import { getCurrencyDisplay } from '@/lib/currency'
import { formatLogQuota, quotaUnitsToDollars } from '@/lib/format'

import { LOG_TYPE_ENUM } from '../constants'
import type { UsageLog } from '../data/schema'
import type { LogOtherData } from '../types'
import {
  decodeBillingExprB64,
  getTieredBillingSummary,
  isViolationFeeLog,
} from './format'
import { isPerCallBilling } from './utils'

const chargeFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
  roundingMode: 'trunc',
}
const chargeFormatter = new Intl.NumberFormat(undefined, chargeFormatOptions)

export function formatTokenCharge(
  quota: number,
  rechargePriceRate?: number
): string {
  const { config, meta } = getCurrencyDisplay()
  if (rechargePriceRate !== undefined) {
    return `¥${chargeFormatter.format((quota * rechargePriceRate) / config.quotaPerUnit)}`
  }
  if (meta.kind === 'tokens') return formatLogQuota(quota)
  return meta.symbol + chargeFormatter.format(quotaUnitsToDollars(quota))
}

export function getCacheWriteTokens(other: LogOtherData | null): number {
  return Math.max(
    other?.cache_creation_tokens || 0,
    (other?.cache_creation_tokens_5m || 0) +
      (other?.cache_creation_tokens_1h || 0)
  )
}

/** Reconstruct token charges from the log snapshot, never today's model prices. */
export function getLogTokenCosts(log: UsageLog, other: LogOtherData | null) {
  if (
    log.type !== LOG_TYPE_ENUM.CONSUME ||
    !other ||
    isViolationFeeLog(other) ||
    other.audio ||
    other.image ||
    other.audio_input_seperate_price ||
    (other.billing_mode !== 'tiered_expr' &&
      isPerCallBilling(other.model_price))
  ) {
    return null
  }

  if (log.quota === 0) {
    return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  }

  const read = other.cache_tokens || 0
  const write = getCacheWriteTokens(other)
  const write5m = other.cache_creation_tokens_5m || 0
  const write1h = other.cache_creation_tokens_1h || 0
  const claude = other.claude === true || other.usage_semantic === 'anthropic'
  const groupRatio = other.group_ratio ?? 1
  const { config } = getCurrencyDisplay()
  let inputTokens = log.prompt_tokens
  let inputRate: number
  let outputRate: number
  let readRate: number
  let writeCharge: number
  let multiplier: number

  if (other.billing_mode === 'tiered_expr') {
    const summary = getTieredBillingSummary(other)
    if (!summary) return null
    const tier = summary.tier
    const expr = decodeBillingExprB64(other.expr_b64)
    const uses = (variable: string) =>
      new RegExp(`\\b${variable}\\b`).test(expr)
    const create = claude ? write5m : write
    const create1h = claude ? write1h : 0
    if (!claude) {
      inputTokens -=
        (uses('cr') ? read : 0) +
        (uses('cc') ? create : 0) +
        (uses('cc1h') ? create1h : 0)
    }
    inputRate = Number(tier.inputPrice)
    outputRate = Number(tier.outputPrice)
    readRate = Number(tier.cacheReadPrice)
    writeCharge =
      create * Number(tier.cacheCreatePrice) +
      create1h * Number(tier.cacheCreate1hPrice)
    multiplier =
      (config.quotaPerUnit / 1_000_000) *
      groupRatio *
      (other.request_rules || []).reduce(
        (ratio, rule) => ratio * (rule.matched ? rule.multiplier : 1),
        1
      )
  } else {
    if (other.model_ratio == null || other.completion_ratio == null) return null
    if (!claude) inputTokens -= read + write
    inputRate = 1
    outputRate = other.completion_ratio
    readRate = other.cache_ratio ?? (read > 0 ? Number.NaN : 0)
    const writeRate = other.cache_creation_ratio ?? (write > 0 ? Number.NaN : 0)
    writeCharge =
      claude && (write5m > 0 || write1h > 0)
        ? Math.max(0, write - write5m - write1h) *
            (other.cache_creation_ratio ?? 0) +
          write5m * (other.cache_creation_ratio_5m ?? writeRate) +
          write1h * (other.cache_creation_ratio_1h ?? writeRate)
        : write * writeRate
    multiplier = other.model_ratio * groupRatio
  }

  const costs = {
    input: Math.max(0, inputTokens) * inputRate * multiplier,
    output: log.completion_tokens * outputRate * multiplier,
    cacheRead: read * readRate * multiplier,
    cacheWrite: writeCharge * multiplier,
  }
  const values = Object.values(costs)
  if (values.some((cost) => !Number.isFinite(cost) || cost < 0)) return null

  const toolUSD = other.tool_surcharges
    ? other.tool_surcharges.reduce(
        (sum, item) => sum + (item.count * item.price) / 1000,
        0
      )
    : (other.web_search
        ? ((other.web_search_call_count || 0) * (other.web_search_price || 0)) /
          1000
        : 0) +
      (other.file_search
        ? ((other.file_search_call_count || 0) *
            (other.file_search_price || 0)) /
          1000
        : 0) +
      (other.image_generation_call
        ? (other.image_generation_call_count || 1) *
          (other.image_generation_call_price || 0)
        : 0)
  const expectedQuota =
    values.reduce((sum, cost) => sum + cost, 0) +
    toolUSD * config.quotaPerUnit * groupRatio
  // Missing historical metadata or unsupported expressions must not invent costs.
  if (Math.abs(expectedQuota - log.quota) > 1) return null
  return costs
}
