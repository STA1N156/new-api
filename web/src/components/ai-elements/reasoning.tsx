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
'use client'

import { BrainIcon, ChevronDownIcon } from 'lucide-react'
import {
  type ComponentProps,
  createContext,
  memo,
  useContext,
  useEffect,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useControllableState } from '@/lib/use-controllable-state'
import { cn } from '@/lib/utils'

import { Response } from './response'

type ReasoningContextValue = {
  isStreaming: boolean
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  duration: number
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null)

const useReasoning = () => {
  const context = useContext(ReasoningContext)
  if (!context) {
    throw new Error('Reasoning components must be used within Reasoning')
  }
  return context
}

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  duration?: number
}

const MS_IN_S = 1000

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = false,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    })
    const [duration, setDuration] = useControllableState({
      prop: durationProp,
      defaultProp: 0,
    })

    const [startTime, setStartTime] = useState<number | null>(null)

    // Track duration when streaming starts and ends
    useEffect(() => {
      if (isStreaming) {
        if (startTime === null) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setStartTime(Date.now())
        }
      } else if (startTime !== null) {
        setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S))
        setStartTime(null)
      }
    }, [isStreaming, startTime, setDuration])

    return (
      <ReasoningContext.Provider
        value={{ isStreaming, isOpen, setIsOpen, duration }}
      >
        <Collapsible
          className={cn('not-prose mb-3 w-full max-w-[78ch]', className)}
          onOpenChange={setIsOpen}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    )
  }
)

export type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger>

export const ReasoningTrigger = memo(
  ({ className, children, ...props }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning()
    const { t } = useTranslation()
    const thinkingText = t('Thought for {{duration}} seconds', {
      duration: duration ?? 0,
    })

    return (
      <CollapsibleTrigger
        className={cn(
          'group text-muted-foreground hover:text-foreground flex min-h-8 w-fit max-w-full items-center gap-2 rounded-lg px-1 py-1.5 text-sm leading-5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-primary/40 [&_p]:m-0',
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <span
              className={cn(
                'grid size-4 shrink-0 place-items-center',
                isStreaming
                  ? 'playground-thinking-mark text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <BrainIcon className='size-4' />
            </span>
            <span className='min-w-0 flex-1 truncate font-medium'>
              {isStreaming ? t('Thinking...') : thinkingText}
            </span>
            <span className='grid size-4 shrink-0 place-items-center'>
              <ChevronDownIcon
                className={cn(
                  'size-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                  isOpen ? 'rotate-180' : 'rotate-0'
                )}
              />
            </span>
          </>
        )}
      </CollapsibleTrigger>
    )
  }
)

export type ReasoningContentProps = ComponentProps<
  typeof CollapsibleContent
> & {
  children: string
}

export const ReasoningContent = memo(
  ({ className, children, ...props }: ReasoningContentProps) => {
    const { isStreaming } = useReasoning()

    return (
      <CollapsibleContent
        className={cn(
          'playground-reasoning-panel text-muted-foreground text-sm outline-none',
          className
        )}
        {...props}
      >
        <div className='pt-1 pb-2 pl-2.5'>
          <Response
            className='border-border/70 grid gap-1 border-l pl-4 [font-family:var(--font-body)] [&_li]:my-0.5 [&_ol]:my-1.5 [&_p]:my-1.5 [&_p]:leading-7 [&_ul]:my-1.5'
            final={!isStreaming}
            animate
            parserId='new-api-reasoning'
          >
            {children}
          </Response>
        </div>
      </CollapsibleContent>
    )
  }
)

Reasoning.displayName = 'Reasoning'
ReasoningTrigger.displayName = 'ReasoningTrigger'
ReasoningContent.displayName = 'ReasoningContent'
