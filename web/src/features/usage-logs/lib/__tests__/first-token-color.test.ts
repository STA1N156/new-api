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

import { getFirstResponseTimeColor } from '../format'

test.each([
  { seconds: 7.999, color: 'success' },
  { seconds: 8, color: 'warning' },
  { seconds: 12.999, color: 'warning' },
  { seconds: 13, color: 'danger' },
])(
  'uses $color for a first-token latency of $seconds seconds',
  ({ seconds, color }) => {
    expect(getFirstResponseTimeColor(seconds)).toBe(color)
  }
)
