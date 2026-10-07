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
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { UsageLog } from '../data/schema'
import { parseLogOther } from '../lib/format'
import { getCacheWriteTokens, getLogTokenCosts } from '../lib/token-costs'
import { useLogPriceDisplay } from './usage-logs-provider'

function TokenCharge({ quota }: { quota: number | undefined }) {
  const { formatTokenCharge } = useLogPriceDisplay()
  if (quota == null) return null
  return (
    <span className='text-muted-foreground font-normal whitespace-nowrap'>
      ({formatTokenCharge(quota)})
    </span>
  )
}

export function LogTokensCell({
  log,
  showCosts = false,
}: {
  log: UsageLog
  showCosts?: boolean
}) {
  const { t } = useTranslation()
  const other = parseLogOther(log.other)
  const cacheRead = other?.cache_tokens || 0
  const cacheWrite = getCacheWriteTokens(other)
  const costs = showCosts ? getLogTokenCosts(log, other) : null
  const hasCache = cacheRead > 0 || cacheWrite > 0
  const cacheUsage = (
    <>
      {cacheRead > 0 && (
        <span
          className='inline-flex items-center gap-1 whitespace-nowrap'
          title={t('Cache Read')}
        >
          <ArrowDown className='size-3 shrink-0' aria-hidden />
          {cacheRead.toLocaleString()}
        </span>
      )}
      {cacheWrite > 0 && (
        <span
          className='inline-flex items-center gap-1 whitespace-nowrap'
          title={t('Cache Write')}
        >
          <ArrowUp className='size-3 shrink-0' aria-hidden />
          {cacheWrite.toLocaleString()}
        </span>
      )}
      <TokenCharge
        quota={costs ? costs.cacheRead + costs.cacheWrite : undefined}
      />
    </>
  )

  if (!showCosts) {
    return (
      <div className='space-y-1 text-xs leading-5 tabular-nums'>
        <div className='font-mono whitespace-nowrap'>
          {log.prompt_tokens.toLocaleString()} /{' '}
          {log.completion_tokens.toLocaleString()}
        </div>
        {hasCache && (
          <div className='text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1'>
            {cacheUsage}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className='grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-[0.8125rem] leading-5 tabular-nums'>
      <span className='text-muted-foreground'>{t('Input')}</span>
      <div className='flex flex-wrap items-baseline justify-end gap-x-1.5 font-medium'>
        <span>{log.prompt_tokens.toLocaleString()}</span>
        <TokenCharge quota={costs?.input} />
      </div>
      {hasCache && (
        <>
          <span className='text-muted-foreground'>{t('Cache')}</span>
          <div className='text-muted-foreground flex flex-wrap items-center justify-end gap-x-3 gap-y-1'>
            {cacheUsage}
          </div>
        </>
      )}
      <span className='text-muted-foreground'>{t('Output')}</span>
      <div className='flex flex-wrap items-baseline justify-end gap-x-1.5 font-medium'>
        <span>{log.completion_tokens.toLocaleString()}</span>
        <TokenCharge quota={costs?.output} />
      </div>
    </div>
  )
}
