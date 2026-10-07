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
import { StatusBadge } from '@/components/status-badge'
import { getLobeIcon } from '@/lib/lobe-icon'
import { resolveModelProvider } from '@/lib/model-provider'
import { cn } from '@/lib/utils'

interface ModelBadgeProps {
  modelName: string
  className?: string
}

export function ModelBadge(props: ModelBadgeProps) {
  const provider = resolveModelProvider(props.modelName)

  return (
    <StatusBadge
      copyText={props.modelName}
      size='sm'
      showDot={!provider}
      autoColor={provider ? undefined : props.modelName}
      className={cn(
        'h-auto min-h-6 max-w-full gap-1.5 rounded-md px-0 py-0 [font-family:var(--font-body)]',
        provider && 'text-foreground',
        props.className
      )}
    >
      <span className='flex max-w-full min-w-0 items-center gap-2'>
        {provider && (
          <span
            className='flex h-[18px] w-[18px] shrink-0 items-center justify-center'
            title={provider.label}
            aria-label={provider.label}
          >
            {getLobeIcon(provider.icon, 18)}
          </span>
        )}
        <span className='min-w-0 truncate font-semibold max-sm:line-clamp-2 max-sm:break-all max-sm:whitespace-normal'>
          {props.modelName}
        </span>
      </span>
    </StatusBadge>
  )
}
