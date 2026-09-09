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
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'

import { ModelCard } from '../components/model-card'
import {
  PricingToolbar,
  type PricingToolbarProps,
} from '../components/pricing-toolbar'

const props: PricingToolbarProps = {
  filteredCount: 1,
  totalCount: 1,
  sortBy: 'name',
  tokenUnit: 'M',
  viewMode: 'card',
  showRechargePrice: false,
  quotaTypeFilter: 'all',
  endpointTypeFilter: 'all',
  vendorFilter: 'all',
  groupFilter: 'all',
  tagFilter: 'all',
  vendors: [],
  groups: [],
  tags: [],
  models: [],
  hasActiveFilters: false,
  activeFilterCount: 0,
  onSortChange: vi.fn(),
  onTokenUnitChange: vi.fn(),
  onRechargePriceChange: vi.fn(),
  onViewModeChange: vi.fn(),
  onQuotaTypeChange: vi.fn(),
  onEndpointTypeChange: vi.fn(),
  onVendorChange: vi.fn(),
  onGroupChange: vi.fn(),
  onTagChange: vi.fn(),
  onClearFilters: vi.fn(),
}

function PricingPreview() {
  const [recharge, setRecharge] = useState(false)
  return (
    <>
      <PricingToolbar
        {...props}
        showRechargePrice={recharge}
        onRechargePriceChange={setRecharge}
      />
      <ModelCard
        model={{
          id: 1,
          model_name: 'test-model',
          quota_type: 0,
          model_ratio: 1,
          completion_ratio: 1,
          enable_groups: ['default'],
        }}
        priceRate={3}
        showRechargePrice={recharge}
        onClick={vi.fn()}
      />
    </>
  )
}

it('keeps one price mode control directly right of Filter on mobile and switches the displayed prices', () => {
  render(<PricingPreview />)
  const control = screen.getByRole('group', { name: 'Price display mode' })
  const filter = screen.getByRole('button', { name: 'Filter' })
  expect(control.previousElementSibling).toBe(filter)
  expect(control.parentElement).toHaveClass('flex', 'items-center')
  expect(control.closest('.hidden')).toBeNull()
  const standard = within(control).getByRole('button', { name: 'Standard' })
  const recharge = within(control).getByRole('button', { name: 'Recharge' })
  expect(standard).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getAllByText('$2')).toHaveLength(2)
  fireEvent.click(recharge)
  expect(recharge).toHaveAttribute('aria-pressed', 'true')
  expect(standard).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getAllByText('¥6')).toHaveLength(2)
  fireEvent.click(standard)
  expect(screen.getAllByText('$2')).toHaveLength(2)
})
