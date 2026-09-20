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
import { useTranslation } from 'react-i18next'

import { formatQuotaWithCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { getChatCompletionQuota } from '../../api'
import { isAssistantMessagePending, type MessageAlignment } from '../../lib'
import type { Message } from '../../types'

type MessageMetadataProps = {
  alignment: MessageAlignment
  message: Message
}

function formatMessageTime(timestamp?: number): string | undefined {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return undefined
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

export function MessageMetadata(props: MessageMetadataProps) {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.auth.user?.id)
  useSystemConfigStore((state) => state.config.currency)
  const messageTime = formatMessageTime(props.message.createdAt)
  const showCost =
    props.message.from === 'assistant' &&
    !isAssistantMessagePending(props.message)
  const requestId = props.message.requestId ?? ''
  const quotaQuery = useQuery({
    queryKey: ['playground-cost', userId, requestId],
    queryFn: () => getChatCompletionQuota(requestId).catch(() => null),
    enabled: showCost && Boolean(userId && requestId),
    staleTime: Infinity,
    // Settlement can finish shortly after the final stream chunk arrives.
    refetchInterval: (query) =>
      query.state.data == null && query.state.dataUpdateCount < 10
        ? 1000
        : false,
  })
  const cost =
    quotaQuery.data == null
      ? '—'
      : formatQuotaWithCurrency(quotaQuery.data, {
          digitsSmall: 6,
          abbreviate: false,
        })

  if (!messageTime && !showCost) {
    return null
  }

  return (
    <div
      className={cn(
        'text-muted-foreground mt-1 flex min-h-4 items-center gap-1.5 text-[11px] leading-none',
        props.alignment === 'right' && 'justify-end'
      )}
    >
      {messageTime && <time>{messageTime}</time>}
      {showCost && (
        <>
          {messageTime && <span aria-hidden='true'>·</span>}
          <span>{t('Cost: {{cost}}', { cost })}</span>
        </>
      )}
    </div>
  )
}
