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
import { ArrowUpIcon, SquareIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  PromptInputButton,
  usePromptInputAttachments,
} from '@/components/ai-elements/prompt-input'
import { ModelGroupSelector } from '@/components/model-group-selector'

import { getInputControlState } from '../../lib'
import type { GroupOption, ModelOption } from '../../types'

type PlaygroundInputControlsProps = {
  disabled?: boolean
  groups: GroupOption[]
  groupValue: string
  isGenerating?: boolean
  isModelLoading?: boolean
  models: ModelOption[]
  modelValue: string
  onGroupChange: (value: string) => void
  onModelChange: (value: string) => void
  onStop?: () => void
  text: string
  tools: ReactNode
}

export function PlaygroundInputControls({
  disabled,
  groups,
  groupValue,
  isGenerating,
  isModelLoading = false,
  models,
  modelValue,
  onGroupChange,
  onModelChange,
  onStop,
  text,
  tools,
}: PlaygroundInputControlsProps) {
  const { t } = useTranslation()
  const attachments = usePromptInputAttachments()
  const { canSubmit, isSelectorDisabled, shouldShowStop } =
    getInputControlState({
      disabled,
      groups,
      hasStopHandler: Boolean(onStop),
      isGenerating,
      isModelLoading,
      models,
      text,
      hasAttachments: attachments.files.length > 0,
    })

  const renderSelector = () => (
    <ModelGroupSelector
      selectedModel={modelValue}
      models={models}
      onModelChange={onModelChange}
      selectedGroup={groupValue}
      groups={groups}
      onGroupChange={onGroupChange}
      disabled={isSelectorDisabled}
      loading={isModelLoading}
      className='w-full md:w-auto'
    />
  )

  const renderSubmitButton = () =>
    shouldShowStop ? (
      <PromptInputButton
        aria-label={t('Stop')}
        title={t('Stop')}
        className='playground-submit bg-foreground text-background hover:bg-foreground/85 size-9 rounded-full sm:size-10'
        onClick={onStop}
        size='icon-sm'
        variant='default'
      >
        <SquareIcon className='size-3.5 fill-current' />
      </PromptInputButton>
    ) : (
      <PromptInputButton
        aria-label={t('Send')}
        title={t('Send')}
        className='playground-submit bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground size-9 rounded-full disabled:opacity-70 sm:size-10'
        disabled={!canSubmit}
        size='icon-sm'
        type='submit'
        variant='default'
      >
        <ArrowUpIcon className='size-5' strokeWidth={2.2} />
      </PromptInputButton>
    )

  return (
    <div className='flex w-full items-center gap-1.5 sm:gap-2'>
      <div className='flex min-w-0 flex-1 items-center'>{renderSelector()}</div>
      <div className='shrink-0'>{tools}</div>
      <div className='shrink-0'>{renderSubmitButton()}</div>
    </div>
  )
}
