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
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { SettingsCard } from '../components/settings-card'
import { useUpdateOption } from '../hooks/use-update-option'

export function ScrollingAnnouncementSection(props: { defaultValue: string }) {
  const { t } = useTranslation()
  const id = useId()
  const [content, setContent] = useState(props.defaultValue ?? '')
  const updateOption = useUpdateOption()
  useEffect(() => {
    setContent(props.defaultValue ?? '')
  }, [props.defaultValue])

  return (
    <SettingsCard title={t('Scrolling announcement')}>
      <form
        className='space-y-4'
        onSubmit={(event) => {
          event.preventDefault()
          updateOption.mutate({
            key: 'console_setting.scrolling_announcement',
            value: content.trim(),
          })
        }}
      >
        <Label htmlFor={id} className='sr-only'>
          {t('Scrolling announcement content')}
        </Label>
        <Textarea
          id={id}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder={t(
            'Enter an announcement. Save an empty message to stop broadcasting.'
          )}
        />
        <div className='flex justify-end'>
          <Button
            type='submit'
            disabled={
              updateOption.isPending ||
              content.trim() === (props.defaultValue ?? '')
            }
          >
            {t('Save scrolling announcement')}
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}
