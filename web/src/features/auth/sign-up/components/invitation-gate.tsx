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
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useCountdown } from '@/hooks/use-countdown'

import { getAffiliateCode, saveAffiliateCode } from '../../lib/storage'

export function InvitationGate(props: { children: ReactNode }) {
  const navigate = useNavigate()
  const linkCode = useLocation({
    select: (location) =>
      new URLSearchParams(location.searchStr).get('aff')?.trim() || '',
  })
  const invitationCode = linkCode || getAffiliateCode()
  const [confirmedCode, setConfirmedCode] = useState<string | null>(null)

  if (!invitationCode || confirmedCode === invitationCode) return props.children

  return (
    <InvitationConfirmation
      key={invitationCode}
      onConfirm={(useInvitation) => {
        const code = useInvitation ? invitationCode : ''
        saveAffiliateCode(code)
        setConfirmedCode(code)
        if (!useInvitation) {
          void navigate({ to: '/sign-up', search: {}, replace: true })
        }
      }}
    />
  )
}

function InvitationConfirmation(props: {
  onConfirm: (useInvitation: boolean) => void
}) {
  const { t } = useTranslation()
  const [friend, setFriend] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const { secondsLeft, isActive, start } = useCountdown({
    initialSeconds: 10,
    autoStart: true,
  })

  useEffect(() => start(), [start])

  const firstQuestion = t('Is the inviter a friend you know?')
  const secondQuestion = t(
    'If this invitation link is later found to have been shared by a stranger in comments, QQ groups or similar places, your account will be permanently banned. Do you confirm registering with this invitation link?'
  )

  return (
    <Dialog
      open
      showCloseButton={false}
      title={t('Confirm invitation registration')}
      description={t('Please answer both questions before continuing.')}
      contentClassName='sm:max-w-lg'
      bodyClassName='space-y-6'
      footer={
        <Button
          className='w-full'
          disabled={isActive || !friend || !confirmation}
          onClick={() => {
            if (isActive || !friend || !confirmation) return
            props.onConfirm(friend === 'yes' && confirmation === 'yes')
          }}
        >
          {isActive
            ? t('Confirm ({{seconds}}s)', { seconds: secondsLeft })
            : t('Confirm')}
        </Button>
      }
    >
      <fieldset className='space-y-3'>
        <legend className='text-sm leading-relaxed font-medium'>
          {firstQuestion}
        </legend>
        <RadioGroup
          value={friend}
          onValueChange={setFriend}
          aria-label={firstQuestion}
        >
          <label className='has-data-checked:border-primary/50 has-data-checked:bg-primary/5 flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm'>
            <RadioGroupItem value='yes' />
            {t('Yes')}
          </label>
          <label className='has-data-checked:border-primary/50 has-data-checked:bg-primary/5 flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm'>
            <RadioGroupItem value='no' />
            {t('Not someone I know')}
          </label>
        </RadioGroup>
      </fieldset>
      <fieldset className='space-y-3'>
        <legend className='text-sm leading-relaxed font-medium'>
          {secondQuestion}
        </legend>
        <RadioGroup
          value={confirmation}
          onValueChange={setConfirmation}
          aria-label={secondQuestion}
        >
          <label className='has-data-checked:border-primary/50 has-data-checked:bg-primary/5 flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm'>
            <RadioGroupItem value='yes' />
            {t('Confirm, the inviter is someone I know.')}
          </label>
          <label className='has-data-checked:border-primary/50 has-data-checked:bg-primary/5 flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm'>
            <RadioGroupItem value='no' />
            {t('Register on my own without an invitation code.')}
          </label>
        </RadioGroup>
      </fieldset>
    </Dialog>
  )
}
