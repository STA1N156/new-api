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
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Gift, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'

import { drawFestival, type FestivalStatus } from '../api'
import { FestivalWheel } from './festival-wheel'

export function FestivalDrawPanel(props: {
  data: FestivalStatus
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const storageKey = `festival-draw:${props.data.campaign}:${userId}`
  const [pendingId, setPendingId] = useState(() =>
    sessionStorage.getItem(storageKey)
  )
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const finishSpin = useCallback(() => setSpinning(false), [])

  function clearPending() {
    sessionStorage.removeItem(storageKey)
    setPendingId(null)
  }

  function spin(cookies: number) {
    const index = props.data.prizes.findIndex(
      (prize) => prize.cookies === cookies
    )
    const target = (360 - (index * 60 + 30)) % 360
    setResult(cookies)
    setSpinning(true)
    setRotation(
      (current) => current + 1800 + ((target - (current % 360) + 360) % 360)
    )
  }

  useEffect(() => {
    if (!pendingId) return
    const recovered = props.data.records.find(
      (record) => record.request_id === pendingId
    )
    if (recovered) {
      sessionStorage.removeItem(storageKey)
      setPendingId(null)
      setResult(recovered.cookies)
    }
  }, [pendingId, props.data.records, storageKey])

  const draw = useMutation({
    mutationFn: drawFestival,
    retry: false,
    onSuccess: (response) => {
      clearPending()
      if (!response.success) {
        toast.error(t(response.message || 'Draw failed'))
        props.onRefresh()
        return
      }
      spin(response.data.cookies)
      props.onRefresh()
    },
    onError: () => {
      toast.error(
        t(
          'The result could not be confirmed. Retry safely; the same draw will not be charged twice.'
        )
      )
      props.onRefresh()
    },
  })
  const busy = draw.isPending || spinning
  const canDraw = props.data.state === 'active' && props.data.remaining > 0

  return (
    <section
      className='via-background to-background relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/10 p-5 sm:p-8'
      aria-label={t('Festival draw')}
    >
      <FestivalWheel
        prizes={props.data.prizes}
        rotation={rotation}
        spinning={spinning}
        onFinished={finishSpin}
      />
      <div className='mt-8 space-y-3 text-center'>
        <p className='text-muted-foreground text-sm'>
          {t('{{count}} draws remaining', { count: props.data.remaining })}
        </p>
        <Button
          className='h-11 w-full max-w-xs text-base'
          disabled={busy || (!canDraw && !pendingId)}
          onClick={() => {
            const id = pendingId || crypto.randomUUID()
            sessionStorage.setItem(storageKey, id)
            setPendingId(id)
            draw.mutate(id)
          }}
        >
          {busy ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <Gift className='size-4' />
          )}
          {busy ? t('Drawing…') : t(pendingId ? 'Retry last draw' : 'Draw now')}
        </Button>
        {!canDraw && props.data.state === 'active' && (
          <p>
            <Button variant='link' render={<Link to='/wallet' />}>
              {t('Top up or redeem to earn chances')}
            </Button>
          </p>
        )}
        <div aria-live='polite' aria-atomic='true'>
          {result !== null && !spinning && (
            <div className='rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3'>
              <p className='text-lg font-semibold'>
                {t('You won {{cookies}}🍪!', { cookies: result })}
              </p>
              <p className='text-muted-foreground mt-1 text-xs'>
                {t(
                  'The reward has been added to your wallet. You can also find it in your draw history.'
                )}
              </p>
            </div>
          )}
        </div>
        <p className='text-muted-foreground text-xs'>
          {t(
            'Wheel segments show prizes, not odds. Exact probabilities are listed below.'
          )}
        </p>
      </div>
    </section>
  )
}
