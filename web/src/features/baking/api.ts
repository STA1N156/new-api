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

import { api } from '@/lib/api'

export interface BakingRound {
  id: number
  serial: number
  level: number
  status: 'ready' | 'baking' | 'burnt' | 'claimed'
  version: number
  ready_at: number
  claimed_cookies: number
  created_at: number
}

export interface BakingState {
  server_time: number
  starts_at: number
  ends_at: number
  phase: 'upcoming' | 'active' | 'ended'
  credited_cookies: number
  granted: number
  available: number
  used: number
  claimed_cookies: number
  best_level: number
  milestones: { cookies: number; grants: number }[]
  rewards: number[]
  chances: number[]
  round: BakingRound | null
  history: BakingRound[]
}

export type BakingAction = 'start' | 'bake' | 'claim'
export class BakingError extends Error {}
interface Response {
  success: boolean
  message: string
  data: BakingState
}
export const BAKING_QUERY_KEY = ['baking-state'] as const

export async function getBakingState(
  signal?: AbortSignal
): Promise<BakingState> {
  const response = await api.get<Response>('/api/baking/state', { signal })
  if (!response.data.success) throw new BakingError(response.data.message)
  return response.data.data
}

export async function sendBakingAction(
  action: BakingAction,
  state: BakingState
): Promise<BakingState> {
  let version = state.round?.version ?? 0
  if (action === 'start') version = state.used
  const response = await api.post<Response>(
    `/api/baking/${action}`,
    {
      round_id: state.round?.id ?? 0,
      version,
    },
    { skipBusinessError: true, skipErrorHandler: true }
  )
  if (!response.data.success) throw new BakingError(response.data.message)
  return response.data.data
}

export function useBakingState() {
  return useQuery({
    queryKey: BAKING_QUERY_KEY,
    queryFn: ({ signal }) => getBakingState(signal),
    staleTime: 5000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      if (query.state.data?.round?.status === 'baking') return 500
      if (query.state.data?.phase === 'ended') return false
      return 60000
    },
  })
}
