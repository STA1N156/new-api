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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import zhCN from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'

import { BAKING_QUERY_KEY, sendBakingAction, type BakingState } from '../api'
import { BakingHistory, BakingLevels } from '../components/levels-and-history'
import { BakingWalletBanner } from '../components/wallet-banner'
import { Workstation } from '../components/workstation'
import { Baking } from '../index'
import { BakingEffects } from '../lib/effects'
import { useBakingGame } from '../lib/use-baking-game'

const state: BakingState = {
  server_time: 1793923200000,
  starts_at: 1793894400000,
  ends_at: 1794499200000,
  phase: 'active',
  credited_cookies: 1000,
  granted: 8,
  available: 7,
  used: 1,
  claimed_cookies: 0,
  best_level: 1,
  milestones: [
    { cookies: 500, grants: 3 },
    { cookies: 1000, grants: 5 },
  ],
  rewards: [10, 20, 40, 60, 100, 200, 1111],
  chances: [85, 65, 50, 35, 20, 10],
  history: [],
  round: {
    id: 21,
    serial: 1,
    level: 1,
    status: 'ready',
    version: 2,
    ready_at: 0,
    claimed_cookies: 0,
    created_at: 1793923200000,
  },
}

function GameHarness() {
  const game = useBakingGame()
  return (
    <div ref={game.root} data-testid='baking-game'>
      <span id='bank-cookie' />
      <div id='oven-stage'>
        <div id='oven-cookie'>
          <svg>
            <title>{game.view?.round?.level}</title>
          </svg>
        </div>
      </div>
      <output aria-label='Collected'>{game.view?.claimed_cookies ?? 0}</output>
      <button
        type='button'
        disabled={game.busy || !game.view}
        onClick={() => game.act('claim')}
      >
        Collect
      </button>
    </div>
  )
}

afterEach(() => vi.restoreAllMocks())

describe('baking actions', () => {
  it.each(['page', 'wallet'])(
    'automatically opens the %s at server midnight without waiting for the polling interval',
    async (surface) => {
      vi.useFakeTimers({
        toFake: [
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'Date',
          'performance',
        ],
      })
      vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
      const starts = Date.parse('2026-11-06T00:00:00+08:00')
      const upcoming = {
        ...state,
        starts_at: starts,
        server_time: starts - 1000,
        phase: 'upcoming' as const,
      }
      const active = {
        ...upcoming,
        phase: 'active' as const,
        server_time: starts,
      }
      const get = vi
        .spyOn(api, 'get')
        .mockResolvedValueOnce({ data: { success: true, data: upcoming } })
        .mockResolvedValue({ data: { success: true, data: active } })
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
      })
      const router = createRouter({
        routeTree: createRootRoute({
          component: () =>
            surface === 'wallet' ? <BakingWalletBanner /> : <Baking />,
        }),
        history: createMemoryHistory({ initialEntries: ['/'] }),
      })
      await router.load()
      const page = render(
        <QueryClientProvider client={client}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      )
      const activity = () =>
        surface === 'wallet'
          ? screen.queryByRole('link', { name: /Lucky Bakery/ })
          : screen.queryByRole('region', { name: 'Baking station' })
      try {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1)
        })
        expect(get).toHaveBeenCalledTimes(1)
        expect(activity()).not.toBeInTheDocument()
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000)
        })
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1)
        })
        expect(get).toHaveBeenCalledTimes(2)
        expect(activity()).toBeVisible()
      } finally {
        page.unmount()
        client.clear()
        vi.useRealTimers()
      }
    }
  )

  it('keeps cached activity hidden through loading, pre-opening and errors until the server confirms opening', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    client.setQueryData(BAKING_QUERY_KEY, state)
    let resolveInitial: (value: {
      data: { success: boolean; data: BakingState }
    }) => void = () => {}
    const get = vi.spyOn(api, 'get').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInitial = resolve
        })
    )
    vi.spyOn(Date, 'now').mockReturnValue(state.ends_at + 86400000)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const page = render(
      <QueryClientProvider client={client}>
        <Baking />
      </QueryClientProvider>
    )
    try {
      expect(
        screen.queryByRole('region', { name: 'Baking station' })
      ).not.toBeInTheDocument()
      await act(async () =>
        resolveInitial({
          data: {
            success: true,
            data: {
              ...state,
              phase: 'upcoming',
              server_time: state.starts_at - 3600000,
            },
          },
        })
      )
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent('Opens in')
      )
      expect(
        screen.queryByRole('region', { name: 'Baking station' })
      ).not.toBeInTheDocument()
      get.mockRejectedValueOnce(new Error('Network unavailable'))
      await act(async () => {
        await client.refetchQueries({ queryKey: BAKING_QUERY_KEY })
      })
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Unable to load event'
        )
      )
      expect(
        screen.queryByRole('region', { name: 'Baking station' })
      ).not.toBeInTheDocument()
      get.mockResolvedValueOnce({ data: { success: true, data: state } })
      await act(async () => {
        await client.refetchQueries({ queryKey: BAKING_QUERY_KEY })
      })
      expect(
        await screen.findByRole('region', { name: 'Baking station' })
      ).toBeVisible()
      get.mockRejectedValueOnce(new Error('Connection lost'))
      await act(async () => {
        await client.refetchQueries({ queryKey: BAKING_QUERY_KEY })
      })
      await waitFor(() =>
        expect(
          screen.queryByRole('region', { name: 'Baking station' })
        ).not.toBeInTheDocument()
      )
    } finally {
      page.unmount()
      client.clear()
    }
  })

  it('shows ten history records per page and stops at the last page', async () => {
    const round = state.round
    if (!round) throw new Error('Missing baking fixture')
    const i18n = createInstance()
    await i18n.init({ lng: 'zhCN', resources: { zhCN } })
    const history = Array.from({ length: 25 }, (_, index) => ({
      ...round,
      id: 25 - index,
      serial: 25 - index,
      status: 'claimed' as const,
      claimed_cookies: 20,
    }))
    render(
      <I18nextProvider i18n={i18n}>
        <BakingHistory data={{ ...state, history }} />
      </I18nextProvider>
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    expect(screen.getByText('第25炉')).toBeVisible()
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    expect(screen.getByText('第15炉')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText('第1炉')).toBeVisible()
    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled()
  })

  it('commits the upgraded cookie before starting its reveal, even when a frame callback runs immediately', async () => {
    if (!state.round) throw new Error('Missing baking fixture')
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    client.setQueryData(BAKING_QUERY_KEY, {
      ...state,
      round: { ...state.round, status: 'baking' },
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(
      (callback) => {
        callback(0)
        return 1
      }
    )
    let renderedLevel = ''
    const outcome = vi
      .spyOn(BakingEffects.prototype, 'outcome')
      .mockImplementation(async () => {
        renderedLevel =
          screen.getByTestId('baking-game').querySelector('#oven-cookie title')
            ?.textContent ?? ''
      })
    const page = render(
      <QueryClientProvider client={client}>
        <GameHarness />
      </QueryClientProvider>
    )
    try {
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Collect' })).toBeEnabled()
      )
      await act(async () => {
        client.setQueryData(BAKING_QUERY_KEY, {
          ...state,
          round: { ...state.round, level: 2, status: 'ready', version: 3 },
        })
      })
      await waitFor(() => expect(outcome).toHaveBeenCalledTimes(1))
      expect(renderedLevel).toBe('2')
    } finally {
      page.unmount()
      client.clear()
    }
  })

  it('shows the chance of reaching each level and keeps rules visible without expansion', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'zhCN', resources: { zhCN } })
    render(
      <I18nextProvider i18n={i18n}>
        <BakingLevels data={state} />
      </I18nextProvider>
    )
    const chances = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[2].textContent)
    expect(chances).toEqual(['—', '85%', '65%', '50%', '35%', '20%', '10%'])
    expect(screen.getByRole('heading', { name: '活动规则' })).toBeVisible()
    expect(
      screen.getByText('每次升级独立判定概率，每炉最高可领取1,111🍪。')
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: '活动规则' })
    ).not.toBeInTheDocument()
  })
  it('shows Chinese baking names and buttons even when the site language is English', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', fallbackLng: 'en', resources: { zhCN } })
    render(
      <I18nextProvider i18n={i18n}>
        <Workstation
          data={state}
          phase='active'
          busy={false}
          onAction={vi.fn()}
        />
      </I18nextProvider>
    )
    expect(
      screen.getByRole('heading', { name: '奶霜云朵出炉啦！' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '见好就收' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '继续烘焙' })).toBeEnabled()
    expect(i18n.t('Lucky Bakery', { lng: 'zhCN' })).toBe('双十一 · 幸运烘焙坊')
  })

  it('sends the server version and round ID instead of a client-selected reward', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ data: { success: true, data: state } })
    await sendBakingAction('bake', state)
    expect(post).toHaveBeenCalledWith(
      '/api/baking/bake',
      { round_id: 21, version: 2 },
      expect.any(Object)
    )
    await sendBakingAction('start', state)
    expect(post).toHaveBeenLastCalledWith(
      '/api/baking/start',
      { round_id: 21, version: 1 },
      expect.any(Object)
    )
  })

  it('keeps the collected total unchanged until the claim animation ends and blocks repeated clicks', async () => {
    let finishAnimation: (animation: Animation) => void = () => {}
    const animationFinished = new Promise<Animation>((resolve) => {
      finishAnimation = resolve
    })
    const original = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'animate'
    )
    const animate = vi
      .fn()
      .mockReturnValue({ finished: animationFinished, cancel: vi.fn() })
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: animate,
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: state },
    })
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        success: true,
        data: {
          ...state,
          claimed_cookies: 20,
          round: {
            ...state.round,
            status: 'claimed',
            version: 3,
            claimed_cookies: 20,
          },
        },
      },
    })
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const page = render(
      <QueryClientProvider client={client}>
        <GameHarness />
      </QueryClientProvider>
    )
    try {
      const collect = screen.getByRole('button', { name: 'Collect' })
      await waitFor(() => expect(collect).toBeEnabled())
      fireEvent.click(collect)
      await waitFor(() => expect(animate).toHaveBeenCalled())
      expect(screen.getByLabelText('Collected')).toHaveTextContent('0')
      expect(collect).toBeDisabled()
      fireEvent.click(collect)
      expect(post).toHaveBeenCalledTimes(1)
      await act(async () => finishAnimation({} as Animation))
      await waitFor(() =>
        expect(screen.getByLabelText('Collected')).toHaveTextContent('20')
      )
    } finally {
      page.unmount()
      client.clear()
      if (original) {
        Object.defineProperty(HTMLElement.prototype, 'animate', original)
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'animate')
      }
    }
  })

  it('disables upgrades after the event ends but leaves earned rewards claimable', () => {
    const onAction = vi.fn()
    render(
      <Workstation
        data={state}
        phase='ended'
        busy={false}
        onAction={onAction}
      />
    )
    expect(
      screen.getByRole('button', { name: 'Continue baking' })
    ).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Take the win' }))
    expect(onAction).toHaveBeenCalledWith('claim')
  })
})
