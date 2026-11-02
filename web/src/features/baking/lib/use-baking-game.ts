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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { handleServerError } from '@/lib/handle-server-error'

import {
  BAKING_QUERY_KEY,
  BakingError,
  sendBakingAction,
  useBakingState,
  type BakingAction,
  type BakingState,
} from '../api'
import { BakingEffects } from './effects'

export function useBakingGame() {
  const { t } = useTranslation(undefined, { lng: 'zhCN' })
  const query = useBakingState()
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({
      action,
      state,
    }: {
      action: BakingAction
      state: BakingState
    }) => sendBakingAction(action, state),
  })
  const root = useRef<HTMLDivElement>(null)
  const effects = useRef<BakingEffects | null>(null)
  const current = useRef<BakingState | undefined>(undefined)
  const pendingOutcome = useRef<{
    state: BakingState
    origin: NonNullable<ReturnType<BakingEffects['origin']>>
  } | null>(null)
  const locked = useRef(false)
  const mounted = useRef(true)
  const [view, setView] = useState<BakingState>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    mounted.current = true
    if (root.current) effects.current = new BakingEffects(root.current)
    return () => {
      mounted.current = false
      pendingOutcome.current = null
      effects.current?.dispose()
      effects.current = null
    }
  }, [])

  useLayoutEffect(() => {
    const next = query.data
    if (!next || locked.current || next === current.current) return
    const before = current.current?.round
    const finished =
      before?.status === 'baking' &&
      before.id === next.round?.id &&
      next.round.status !== 'baking'
    const origin = finished ? effects.current?.origin() : undefined
    current.current = next
    setView(next)
    if (finished && origin) {
      locked.current = true
      setBusy(true)
      effects.current?.reveal(next.round?.status === 'ready')
      pendingOutcome.current = { state: next, origin }
    }
  }, [query.data, busy])

  useLayoutEffect(() => {
    const pending = pendingOutcome.current
    const animation = effects.current
    if (!pending || pending.state !== view || !animation) return
    pendingOutcome.current = null
    // This layout commit contains the new SVG; a frame callback can run too early.
    void animation
      .outcome(
        pending.state.round?.status === 'ready',
        pending.origin,
        pending.state.round?.level ?? 0,
        pending.state.rewards[pending.state.round?.level ?? 0]
      )
      .finally(() => {
        animation.reveal(false)
        locked.current = false
        if (mounted.current) setBusy(false)
      })
  }, [view])

  async function act(action: BakingAction) {
    if (locked.current || !current.current) return
    locked.current = true
    setBusy(true)
    try {
      await client.cancelQueries({ queryKey: BAKING_QUERY_KEY })
      const next = await mutation.mutateAsync({
        action,
        state: current.current,
      })
      if (action === 'claim') {
        await effects.current?.collect(
          next.round?.claimed_cookies ?? 0,
          next.round?.level ?? 0
        )
      }
      client.setQueryData(BAKING_QUERY_KEY, next)
      if (mounted.current) {
        current.current = next
        setView(next)
      }
    } catch (error) {
      if (error instanceof BakingError) toast.error(t(error.message))
      else handleServerError(error)
      // Also recovers a successful action whose response was interrupted.
      await query.refetch()
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return { root, view, busy, act, query }
}
