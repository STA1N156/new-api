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
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { useModelsColumns } from '../components/models-columns'
import type { Model, Vendor } from '../types'

function ModelDisplay(props: { model: Model; vendors?: Vendor[] }) {
  const columns = useModelsColumns(props.vendors).filter(
    (column) =>
      'accessorKey' in column &&
      ['model_name', 'vendor_id'].includes(String(column.accessorKey))
  )
  const table = useReactTable({
    data: [props.model],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })
  return table
    .getRowModel()
    .rows[0].getVisibleCells()
    .map((cell) => (
      <div key={cell.id} data-testid={cell.column.id}>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </div>
    ))
}

const model: Model = {
  id: 1,
  model_name: '[Cloud]MiMo-V2.5-Pro',
  status: 1,
  sync_official: 1,
  created_time: 0,
  updated_time: 0,
  name_rule: 0,
}

it.each([
  ['[Cloud]MiMo-V2.5-Pro', '小米'],
  ['StepFun/STEP-3.5-flash', '阶跃星辰'],
  ['[AN]NAI-diffusion-4.5-full', 'NovelAI'],
])(
  'shows %s with its brand name and icons when no vendor is configured',
  (name, vendor) => {
    render(<ModelDisplay model={{ ...model, model_name: name }} />)
    expect(screen.getByText(vendor, { selector: 'span' })).toBeVisible()
    expect(screen.getByTestId('model_name').querySelector('svg')).not.toBeNull()
    expect(screen.getByTestId('vendor_id').querySelector('svg')).not.toBeNull()
    expect(screen.queryByText('?')).not.toBeInTheDocument()
  }
)

it('keeps an explicitly configured vendor for a MiMo model', () => {
  const vendor: Vendor = {
    id: 8,
    name: 'Private provider',
    icon: 'OpenAI',
    status: 1,
    created_time: 0,
    updated_time: 0,
  }
  render(<ModelDisplay model={{ ...model, vendor_id: 8 }} vendors={[vendor]} />)
  expect(screen.getByText('Private provider')).toBeVisible()
  expect(screen.queryByText('小米')).not.toBeInTheDocument()
})
