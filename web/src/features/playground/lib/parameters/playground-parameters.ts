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
import type { ParameterEnabled } from '../../types'

export type PlaygroundParameterKey = keyof ParameterEnabled

export type PlaygroundParameterControl = {
  key: PlaygroundParameterKey
  labelKey: string
  descriptionKey: string
  min: number
  max: number
  step: number
}

export const PLAYGROUND_PARAMETER_CONTROLS = [
  {
    key: 'max_tokens',
    labelKey: 'Max Tokens',
    descriptionKey: 'Caps the response length',
    min: 0,
    max: 200000,
    step: 1,
  },
] as const satisfies readonly PlaygroundParameterControl[]

export const PLAYGROUND_PARAMETER_PANEL_SCROLL_CLASS =
  'max-h-[min(28rem,calc(100vh-10rem))] overflow-y-auto pr-1'

export function normalizeParameterNumberValue(
  key: PlaygroundParameterKey,
  value: string | number
): number {
  if (value === '') {
    return 0
  }

  const control = PLAYGROUND_PARAMETER_CONTROLS.find((item) => item.key === key)
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)

  if (!control || Number.isNaN(parsed)) {
    return 0
  }

  const clamped = Math.min(control.max, Math.max(control.min, parsed))

  return Math.trunc(clamped)
}
