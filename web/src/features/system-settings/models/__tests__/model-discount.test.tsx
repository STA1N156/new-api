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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { expect, it, vi } from 'vitest'

import { ModelRatioForm } from '../model-ratio-form'

const defaults = {
  ModelPrice: '{"request-model":0.5}',
  ModelRatio: '{"中文模型":1,"other":2}',
  ModelDiscount: '{"中文模型":5.5,"other":8}',
  CompletionRatio: '{"中文模型":2}',
  CacheRatio: '{}',
  CreateCacheRatio: '{}',
  ImageRatio: '{}',
  AudioRatio: '{}',
  AudioCompletionRatio: '{}',
  ExposeRatioEnabled: false,
  BillingMode: '{}',
  BillingExpr: '{}',
}

function PricingForm(props: {
  onSave: (values: typeof defaults) => Promise<void>
  initialValues?: typeof defaults
}) {
  const initialValues = props.initialValues ?? defaults
  const form = useForm({ defaultValues: initialValues })
  return (
    <ModelRatioForm
      form={form}
      savedValues={initialValues}
      onSave={props.onSave}
      onReset={vi.fn()}
      isSaving={false}
      isResetting={false}
    />
  )
}

it('edits and clears one model display discount without changing its prices or other models', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined)
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <PricingForm onSave={onSave} />
    </QueryClientProvider>
  )
  fireEvent.click(screen.getByText('中文模型'))
  const discount = screen.getByRole('textbox', {
    name: 'Display discount (out of 10)',
  })
  expect(discount).toHaveValue('5.5')
  fireEvent.change(discount, { target: { value: '6.5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save model prices' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  let saved = onSave.mock.calls[0][0]
  expect(JSON.parse(saved.ModelDiscount)).toEqual({ 中文模型: 6.5, other: 8 })
  for (const key of ['ModelPrice', 'ModelRatio', 'CompletionRatio'] as const) {
    expect(JSON.parse(saved[key])).toEqual(JSON.parse(defaults[key]))
  }
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Display discount (out of 10)' }),
    { target: { value: '' } }
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save model prices' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
  saved = onSave.mock.calls[1][0]
  expect(JSON.parse(saved.ModelDiscount)).toEqual({ other: 8 })
  fireEvent.click(screen.getByText('request-model'))
  await waitFor(() =>
    expect(
      screen.queryByRole('textbox', { name: 'Display discount (out of 10)' })
    ).not.toBeInTheDocument()
  )
  client.clear()
})

it('blocks an out-of-range discount before saving', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined)
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <PricingForm onSave={onSave} />
    </QueryClientProvider>
  )
  fireEvent.click(screen.getByText('中文模型'))
  const discount = screen.getByRole('textbox', {
    name: 'Display discount (out of 10)',
  })
  fireEvent.change(discount, { target: { value: '11' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save model prices' }))
  expect(
    await screen.findByText(
      'Enter a discount greater than 0 and no more than 10'
    )
  ).toBeVisible()
  expect(discount).toHaveAttribute('aria-invalid', 'true')
  expect(onSave).not.toHaveBeenCalled()
  client.clear()
})

it('saves a dynamic model discount without altering its expression or other models', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined)
  const client = new QueryClient()
  const initialValues = {
    ...defaults,
    BillingMode: '{"中文模型":"tiered_expr"}',
    BillingExpr: JSON.stringify({ 中文模型: 'tier("base", p * 2 + c * 4)' }),
  }
  render(
    <QueryClientProvider client={client}>
      <PricingForm initialValues={initialValues} onSave={onSave} />
    </QueryClientProvider>
  )
  fireEvent.click(screen.getByText('中文模型'))
  const discount = screen.getByRole('textbox', {
    name: 'Display discount (out of 10)',
  })
  expect(discount).toHaveValue('5.5')
  fireEvent.change(discount, { target: { value: '10' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save model prices' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  const saved = onSave.mock.calls[0][0]
  expect(JSON.parse(saved.ModelDiscount)).toEqual({ 中文模型: 10, other: 8 })
  expect(JSON.parse(saved.BillingMode)).toEqual(
    JSON.parse(initialValues.BillingMode)
  )
  expect(JSON.parse(saved.BillingExpr)).toEqual(
    JSON.parse(initialValues.BillingExpr)
  )
  expect(JSON.parse(saved.ModelPrice)).toEqual(JSON.parse(defaults.ModelPrice))
  expect(JSON.parse(saved.ModelRatio).other).toBe(2)
  client.clear()
})

it('preserves the discount between token and expression modes and hides it for request pricing', () => {
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <PricingForm onSave={vi.fn()} />
    </QueryClientProvider>
  )
  fireEvent.click(screen.getByText('中文模型'))
  fireEvent.click(screen.getByRole('tab', { name: 'Expression' }))
  expect(
    screen.getByRole('textbox', { name: 'Display discount (out of 10)' })
  ).toHaveValue('5.5')
  fireEvent.click(screen.getByRole('tab', { name: 'Per-token' }))
  expect(
    screen.getByRole('textbox', { name: 'Display discount (out of 10)' })
  ).toHaveValue('5.5')
  fireEvent.click(screen.getByRole('tab', { name: 'Per-request' }))
  expect(
    screen.queryByRole('textbox', { name: 'Display discount (out of 10)' })
  ).not.toBeInTheDocument()
  client.clear()
})
