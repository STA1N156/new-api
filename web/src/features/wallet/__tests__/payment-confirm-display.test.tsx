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
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { PaymentConfirmDialog } from '../components/dialogs/payment-confirm-dialog'

const props = {
  open: true,
  onOpenChange: vi.fn(),
  onConfirm: vi.fn(),
  topupAmount: 500,
  paymentAmount: 425,
  paymentMethod: { name: 'Alipay', type: 'alipay' },
  calculating: false,
  processing: false,
  discountRate: 0.85,
}

it('shows the yuan payment, original price and savings', () => {
  render(<PaymentConfirmDialog {...props} />)
  expect(screen.getByText('¥425')).toBeVisible()
  expect(screen.getByText('¥500')).toBeVisible()
  expect(screen.getByText('¥75')).toBeVisible()
})

it('hides savings and the crossed-out price when there is no discount', () => {
  render(<PaymentConfirmDialog {...props} discountRate={1} />)
  expect(screen.getByText('¥425')).toBeVisible()
  expect(screen.queryByText('You save')).not.toBeInTheDocument()
  expect(screen.queryByText('¥500')).not.toBeInTheDocument()
})

it('hides stale payment and savings amounts while recalculating', () => {
  render(<PaymentConfirmDialog {...props} calculating />)
  expect(screen.queryByText('¥425')).not.toBeInTheDocument()
  expect(screen.queryByText('You save')).not.toBeInTheDocument()
})
