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
import {
  BarChartIcon,
  CodeSquareIcon,
  GraduationCapIcon,
  NotepadTextIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

type PlaygroundEmptyStateProps = {
  onSelectPrompt: (prompt: string) => void
  disabled?: boolean
}

const starterPrompts = [
  { icon: BarChartIcon, text: 'Analyze data' },
  { icon: NotepadTextIcon, text: 'Summarize text' },
  { icon: CodeSquareIcon, text: 'Code' },
  { icon: GraduationCapIcon, text: 'Get advice' },
]

export function PlaygroundEmptyState({
  onSelectPrompt,
  disabled,
}: PlaygroundEmptyStateProps) {
  const { t } = useTranslation()

  return (
    <div className='playground-empty flex min-h-[min(480px,calc(100svh-20rem))] items-center justify-center px-1 py-8 sm:py-14'>
      <div className='grid w-full max-w-2xl gap-5 text-center'>
        <div className='grid gap-2'>
          <h2 className='text-2xl font-normal tracking-tight text-balance sm:text-4xl'>
            {t('What would you like to explore?')}
          </h2>
          <p className='text-muted-foreground mx-auto max-w-lg text-sm leading-6 text-balance'>
            {t('Choose a model. Start with an idea.')}
          </p>
        </div>

        <div className='flex flex-wrap justify-center gap-2'>
          {starterPrompts.map(({ icon: Icon, text }) => {
            const prompt = t(text)

            return (
              <Button
                className='playground-prompt border-border/70 bg-card/50 hover:bg-card h-10 gap-2 rounded-xl px-3.5 text-xs font-normal shadow-none hover:shadow-sm'
                key={text}
                disabled={disabled}
                onClick={() => onSelectPrompt(prompt)}
                variant='outline'
              >
                <Icon className='text-muted-foreground size-4' />
                <span>{prompt}</span>
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
