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
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from 'react'

import { useIsAdmin } from '@/hooks/use-admin'
import { useStatus } from '@/hooks/use-status'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { createLogPriceDisplay } from '../lib/price-display'
import type { ChannelAffinityInfo } from '../types'

export type LogsViewScope = 'all' | 'self'

interface UsageLogsContextValue {
  selectedUserId: number | null
  setSelectedUserId: (userId: number | null) => void
  userInfoDialogOpen: boolean
  setUserInfoDialogOpen: (open: boolean) => void
  affinityTarget: ChannelAffinityInfo | null
  setAffinityTarget: (target: ChannelAffinityInfo | null) => void
  affinityDialogOpen: boolean
  setAffinityDialogOpen: (open: boolean) => void
  sensitiveVisible: boolean
  setSensitiveVisible: (visible: boolean) => void
  viewScope: LogsViewScope
  setViewScope: (scope: LogsViewScope) => void
  showRechargePrice: boolean
  setShowRechargePrice: (show: boolean) => void
  rechargePriceRate: number | undefined
  canViewResponseModel: boolean
  showResponseModel: boolean
  setShowResponseModel: (show: boolean) => void
}

const UsageLogsContext = createContext<UsageLogsContextValue | undefined>(
  undefined
)

const RESPONSE_MODEL_STORAGE_KEY = 'usage-logs:show-response-model'

export function UsageLogsProvider({ children }: { children: ReactNode }) {
  const canViewResponseModel = useAuthStore(
    (state) => (state.auth.user?.role ?? 0) >= ROLE.SUPER_ADMIN
  )
  const [showResponseModel, updateShowResponseModel] = useState(() => {
    try {
      return localStorage.getItem(RESPONSE_MODEL_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const setShowResponseModel = (show: boolean) => {
    updateShowResponseModel(show)
    try {
      localStorage.setItem(RESPONSE_MODEL_STORAGE_KEY, String(show))
    } catch {
      // Keep the switch usable when browser storage is unavailable.
    }
  }
  const { status } = useStatus()
  const [showRechargePrice, setShowRechargePrice] = useState(false)
  const rechargePriceRate = showRechargePrice
    ? Math.max(Number(status?.price) || 1, 0.001)
    : undefined
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [userInfoDialogOpen, setUserInfoDialogOpen] = useState(false)
  const [affinityTarget, setAffinityTarget] =
    useState<ChannelAffinityInfo | null>(null)
  const [affinityDialogOpen, setAffinityDialogOpen] = useState(false)
  const [sensitiveVisible, setSensitiveVisible] = useState(true)
  const [viewScope, setViewScope] = useState<LogsViewScope>('all')

  return (
    <UsageLogsContext.Provider
      value={{
        selectedUserId,
        setSelectedUserId,
        userInfoDialogOpen,
        setUserInfoDialogOpen,
        affinityTarget,
        setAffinityTarget,
        affinityDialogOpen,
        setAffinityDialogOpen,
        sensitiveVisible,
        setSensitiveVisible,
        viewScope,
        setViewScope,
        showRechargePrice,
        setShowRechargePrice,
        rechargePriceRate,
        canViewResponseModel,
        showResponseModel: canViewResponseModel && showResponseModel,
        setShowResponseModel,
      }}
    >
      {children}
    </UsageLogsContext.Provider>
  )
}

export function useUsageLogsContext() {
  const context = useContext(UsageLogsContext)
  if (!context) {
    throw new Error('useUsageLogsContext must be used within UsageLogsProvider')
  }
  return context
}

export function useLogPriceDisplay() {
  const rechargePriceRate = useContext(UsageLogsContext)?.rechargePriceRate
  useSystemConfigStore((state) => state.config.currency)
  return createLogPriceDisplay(rechargePriceRate)
}

/**
 * Resolves the effective admin scope for usage logs: whether the current
 * user is allowed to view all users' logs (`canManageScope`), and whether
 * their current view preference (`viewScope`) has that scope active
 * (`isAdminView`). Data fetching and admin-only UI should key off
 * `isAdminView` rather than raw role, so an admin who switches to "only
 * mine" is treated exactly like a regular user for that view.
 */
export function useLogsViewScope() {
  const canManageScope = useIsAdmin()
  const { viewScope, setViewScope } = useUsageLogsContext()

  return {
    canManageScope,
    viewScope,
    setViewScope,
    isAdminView: canManageScope && viewScope === 'all',
  }
}
