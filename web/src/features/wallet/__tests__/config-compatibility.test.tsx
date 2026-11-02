import { render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { useSystemConfigStore } from '@/stores/system-config-store'

import { TransferDialog } from '../components/dialogs/transfer-dialog'

const initialState = useSystemConfigStore.getState()

afterEach(() => {
  useSystemConfigStore.setState(initialState, true)
  localStorage.removeItem('system-config-storage')
})

it.each([undefined, null])(
  'opens the wallet when saved currency config is %s',
  async (currency) => {
    localStorage.setItem(
      'system-config-storage',
      JSON.stringify({
        state: {
          config: { systemName: 'STA1N API', logo: '/logo.png', currency },
        },
        version: 0,
      })
    )
    await useSystemConfigStore.persist.rehydrate()

    expect(() =>
      render(
        <TransferDialog
          open={false}
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
          availableQuota={0}
          transferring={false}
        />
      )
    ).not.toThrow()
  }
)

it('keeps saved display settings and fills missing currency fields', async () => {
  localStorage.setItem(
    'system-config-storage',
    JSON.stringify({
      state: {
        config: {
          systemName: 'STA1N API',
          currency: {
            quotaDisplayType: 'CUSTOM',
            customCurrencySymbol: '🍪',
            customCurrencyExchangeRate: 10,
          },
        },
      },
      version: 0,
    })
  )
  await useSystemConfigStore.persist.rehydrate()

  const config = useSystemConfigStore.getState().config
  expect(config.systemName).toBe('STA1N API')
  expect(config.currency).toEqual({
    ...initialState.config.currency,
    quotaDisplayType: 'CUSTOM',
    customCurrencySymbol: '🍪',
    customCurrencyExchangeRate: 10,
  })
})
