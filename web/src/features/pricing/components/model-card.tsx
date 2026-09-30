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
import { ChevronRight } from 'lucide-react'
import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
} from '../lib/dynamic-price'
import { parseTags } from '../lib/filters'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice, formatRequestPrice } from '../lib/price'
import type { PricingModel, TokenUnit, PriceType } from '../types'
import { ModelBillingModeBadge } from './model-billing-mode-badge'
import { ModelPerfBadge, type ModelPerfBadgeData } from './model-perf-badge'

export interface ModelCardProps {
  model: PricingModel
  onClick: () => void
  priceRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
  perf?: ModelPerfBadgeData
}

function ModelPriceRow(props: { label?: string; price: string; unit: string }) {
  return (
    <span className='text-muted-foreground flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5'>
      {props.label && <span>{props.label}</span>}
      <span className='inline-flex flex-wrap items-baseline gap-x-1'>
        <span className='text-foreground font-mono font-semibold break-all'>
          {props.price}
        </span>
        <span className='whitespace-nowrap'>/ {props.unit}</span>
      </span>
    </span>
  )
}

export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t } = useTranslation()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const showRechargePrice = props.showRechargePrice ?? false
  const isTokenBased = isTokenBasedModel(props.model)
  const tokenUnitLabel = tokenUnit === 'K' ? t('thousand') : t('million')
  const tags = parseTags(props.model.tags)
  const modelIconKey = props.model.icon || props.model.vendor_icon
  const modelIcon = modelIconKey ? getLobeIcon(modelIconKey, 28) : null
  const initial = props.model.model_name?.charAt(0).toUpperCase() || '?'
  const isDynamicPricing =
    props.model.billing_mode === 'tiered_expr' &&
    Boolean(props.model.billing_expr)
  const hasCachedPrice = isTokenBased && props.model.cache_ratio != null
  const dynamicSummary = isDynamicPricing
    ? getDynamicPricingSummary(props.model, {
        tokenUnit,
        showRechargePrice,
        priceRate,
        groupRatioMultiplier: getDynamicDisplayGroupRatio(
          props.model,
          props.selectedGroup
        ),
      })
    : null

  const discount = props.model.model_discount
  const bottomTags = tags.slice(0, 2)
  const hiddenCount = Math.max(tags.length - 2, 0)

  let priceSummary: ReactNode
  if (dynamicSummary) {
    const entries = dynamicSummary.entries.filter(
      (entry) => entry.variable.isBase || entry.variable.group === 'cache'
    )
    if (dynamicSummary.isSpecialExpression) {
      priceSummary = (
        <span className='min-w-0'>
          <span className='text-amber-700 dark:text-amber-300'>
            {t('Special billing expression')}
          </span>
          <code className='text-muted-foreground/70 mt-0.5 line-clamp-1 block font-mono text-[11px] break-all'>
            {dynamicSummary.rawExpression}
          </code>
        </span>
      )
    } else if (entries.length > 0) {
      priceSummary = (
        <>
          {entries.map((entry) => (
            <ModelPriceRow
              key={entry.key}
              label={t(entry.shortLabel)}
              price={entry.formatted}
              unit={tokenUnitLabel}
            />
          ))}
        </>
      )
    } else {
      priceSummary = (
        <span className='text-muted-foreground text-sm'>
          {t('Dynamic Pricing')}
        </span>
      )
    }
  } else if (isTokenBased) {
    const prices: { type: PriceType; label: string }[] = [
      { type: 'input', label: t('Input') },
      { type: 'output', label: t('Output') },
    ]
    if (hasCachedPrice) prices.push({ type: 'cache', label: t('Cached') })
    priceSummary = prices.map(({ type, label }) => (
      <ModelPriceRow
        key={type}
        label={label}
        price={formatPrice(
          props.model,
          type,
          tokenUnit,
          showRechargePrice,
          priceRate,
          props.selectedGroup
        )}
        unit={tokenUnitLabel}
      />
    ))
  } else {
    priceSummary = (
      <ModelPriceRow
        price={formatRequestPrice(
          props.model,
          showRechargePrice,
          priceRate,
          props.selectedGroup
        )}
        unit={t('request')}
      />
    )
  }

  return (
    <div
      className={cn(
        'bg-card group relative flex min-w-0 flex-col rounded-2xl border px-4 py-3.5 transition-colors sm:px-5 sm:py-4',
        'hover:border-primary/30'
      )}
    >
      <div className='flex items-start gap-3'>
        <div className='bg-muted/40 flex size-10 shrink-0 items-center justify-center rounded-xl'>
          {modelIcon || (
            <span className='text-muted-foreground text-sm font-bold'>
              {initial}
            </span>
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <h3
            className='text-foreground line-clamp-2 font-mono text-[15px] leading-6 font-bold [overflow-wrap:anywhere]'
            title={props.model.model_name}
          >
            {props.model.model_name}
          </h3>
          {props.model.vendor_name && (
            <p className='text-muted-foreground mt-0.5 truncate text-xs'>
              {props.model.vendor_name}
            </p>
          )}
        </div>
        <button
          type='button'
          onClick={props.onClick}
          className='text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring -mt-0.5 inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none'
        >
          {t('Details')}
          <ChevronRight className='size-3.5' aria-hidden='true' />
        </button>
      </div>

      {/* Description */}
      {props.model.description?.trim() && (
        <p className='text-muted-foreground mt-2.5 line-clamp-2 text-xs leading-relaxed'>
          {props.model.description}
        </p>
      )}

      <div className='mt-2.5 flex flex-wrap items-center gap-2'>
        <ModelBillingModeBadge
          model={props.model}
          className='h-5 px-0 text-sm leading-5'
        />
        {(isTokenBased || isDynamicPricing) &&
          discount != null &&
          discount > 0 &&
          discount <= 10 && (
            <span className='inline-flex h-5 items-center text-sm leading-5 font-medium text-emerald-600 dark:text-emerald-400'>
              {discount === 10
                ? t('Official list price')
                : t('{{percent}}% off official price', {
                    discount,
                    percent: Number(((10 - discount) * 10).toFixed(2)),
                  })}
            </span>
          )}
      </div>
      <div className='mt-2.5 flex flex-col gap-1.5 px-3 py-2 text-[13px] leading-5'>
        {priceSummary}
      </div>
      {bottomTags.length > 0 && (
        <div className='mt-2.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1'>
          {bottomTags.map((item) => (
            <span
              key={item}
              className='text-muted-foreground text-xs break-all'
            >
              {item}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className='text-muted-foreground/40 text-xs'>
              +{hiddenCount}
            </span>
          )}
        </div>
      )}
      <div className='flex-1' />
      <div className='mt-3 border-t pt-2.5'>
        <ModelPerfBadge perf={props.perf} />
      </div>
    </div>
  )
})
