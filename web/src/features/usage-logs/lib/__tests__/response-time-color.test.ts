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
import { expect, test } from 'vitest'

import { getLogTimingColors, getResponseTimeColor } from '../format'

test.each([
  { seconds: 9.999, color: 'success' },
  { seconds: 10, color: 'warning' },
  { seconds: 29.999, color: 'warning' },
  { seconds: 30, color: 'danger' },
])(
  'uses $color for 99 output tokens in $seconds seconds',
  ({ seconds, color }) => {
    expect(getResponseTimeColor(seconds, 99)).toBe(color)
  }
)

test.each([
  {
    name: 'normal streaming keeps first-token and duration colors independent',
    changes: { frtMs: 12000 },
    expected: { firstToken: 'warning', duration: 'danger' },
  },
  {
    name: 'anti-truncation uses duration for short output',
    changes: { modelName: '测试-抗截断-模型', frtMs: 1000 },
    expected: { firstToken: 'danger', duration: 'danger' },
  },
  {
    name: 'anti-truncation uses green throughput for long output',
    changes: {
      modelName: '测试-抗截断-模型',
      completionTokens: 100,
      useTimeSec: 5,
    },
    expected: { firstToken: 'success', duration: 'success' },
  },
  {
    name: 'anti-truncation uses yellow throughput for long output',
    changes: {
      modelName: '测试-抗截断-模型',
      completionTokens: 100,
      useTimeSec: 10,
    },
    expected: { firstToken: 'warning', duration: 'warning' },
  },
  {
    name: 'non-streaming is green despite slow timings',
    changes: { isStream: false, frtMs: 600000, useTimeSec: 600 },
    expected: { firstToken: 'success', duration: 'success' },
  },
  {
    name: 'non-streaming takes priority over anti-truncation',
    changes: { isStream: false, modelName: '抗截断', completionTokens: 100 },
    expected: { firstToken: 'success', duration: 'success' },
  },
  {
    name: 'normal streaming without a first token stays neutral',
    changes: { frtMs: undefined },
    expected: { firstToken: 'neutral', duration: 'danger' },
  },
  {
    name: 'anti-truncation follows duration even without a first token',
    changes: { modelName: '抗截断', frtMs: undefined },
    expected: { firstToken: 'danger', duration: 'danger' },
  },
])('$name', ({ changes, expected }) => {
  expect(
    getLogTimingColors({
      modelName: '普通模型',
      isStream: true,
      useTimeSec: 35,
      completionTokens: 99,
      frtMs: 20000,
      ...changes,
    })
  ).toEqual(expected)
})

test.each([
  { seconds: 5, color: 'success' },
  { seconds: 5.001, color: 'warning' },
  { seconds: 10, color: 'warning' },
  { seconds: 10.001, color: 'danger' },
])(
  'uses $color for 100 output tokens in $seconds seconds',
  ({ seconds, color }) => {
    expect(getResponseTimeColor(seconds, 100)).toBe(color)
  }
)
