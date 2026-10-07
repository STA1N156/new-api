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
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'

import { removeCookie, setCookie } from '@/lib/cookies'
import { THEME_COOKIE_KEYS } from '@/lib/theme-customization'

import {
  ThemeCustomizationProvider,
  useThemeCustomization,
} from '../theme-customization-provider'

afterEach(() => {
  removeCookie('theme_preset')
  Object.values(THEME_COOKIE_KEYS).forEach(removeCookie)
  for (const name of document.body.getAttributeNames()) {
    if (name.startsWith('data-theme-')) {
      document.body.removeAttribute(name)
    }
  }
})

it.each([undefined, 'ocean-breeze', 'anthropic'])(
  'starts new and legacy visitors on Anthropic (previous choice: %s)',
  (previous) => {
    if (previous) setCookie('theme_preset', previous)
    setCookie(THEME_COOKIE_KEYS.font, 'sans')
    const { result } = renderHook(useThemeCustomization, {
      wrapper: ThemeCustomizationProvider,
    })
    expect(result.current.customization.preset).toBe('anthropic')
    expect(document.body).toHaveAttribute('data-theme-preset', 'anthropic')
    expect(result.current.customization.font).toBe('sans')
  }
)

it('keeps a new manual choice after reopening and resets to Anthropic on request', () => {
  const first = renderHook(useThemeCustomization, {
    wrapper: ThemeCustomizationProvider,
  })
  act(() => first.result.current.setPreset('default'))
  first.unmount()
  const second = renderHook(useThemeCustomization, {
    wrapper: ThemeCustomizationProvider,
  })
  expect(second.result.current.customization.preset).toBe('default')
  expect(document.body).toHaveAttribute('data-theme-preset', 'default')
  act(() => second.result.current.resetCustomization())
  expect(document.body).toHaveAttribute('data-theme-preset', 'anthropic')
})
