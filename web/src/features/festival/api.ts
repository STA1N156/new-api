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
import { useEffect, useState } from 'react'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

export type FestivalPrize = { cookies: number; weight: number }
export type FestivalDraw = {
  id: number
  request_id: string
  number: number
  cookies: number
  created_at: number
}
export type FestivalStatus = {
  campaign: string
  starts_at: number
  ends_at: number
  server_time: number
  state: 'upcoming' | 'active' | 'ended'
  credited_cookies: number
  earned: number
  remaining: number
  won_cookies: number
  prizes: FestivalPrize[]
  milestones: { cookies: number; chances: number }[]
  records: FestivalDraw[]
}
type Response<T> = { success: boolean; message?: string; data: T }

export function useFestival() {
  const userId = useAuthStore((state) => state.auth.user?.id)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const query = useQuery({
    queryKey: ['festival', userId],
    queryFn: async () => {
      const { data } =
        await api.get<Response<FestivalStatus>>('/api/user/festival')
      if (!data.success) {
        throw new Error(data.message || 'Unable to load festival')
      }
      return data.data
    },
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
  if (!query.data) return query
  // Advance the last server timestamp so transitions do not wait for polling
  // or depend on the visitor's local clock/time zone.
  const serverTime =
    query.data.server_time +
    Math.max(0, Math.floor((now - query.dataUpdatedAt) / 1000))
  let state: FestivalStatus['state'] = 'active'
  if (serverTime < query.data.starts_at) state = 'upcoming'
  else if (serverTime >= query.data.ends_at) state = 'ended'
  return { ...query, data: { ...query.data, state, server_time: serverTime } }
}

export async function drawFestival(requestId: string) {
  const { data } = await api.post<Response<FestivalDraw>>(
    '/api/user/festival/draw',
    { request_id: requestId },
    { skipBusinessError: true }
  )
  return data
}
