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
  formatBillingCurrencyFromUSD,
  formatRechargePrice,
  getCurrencyDisplay,
} from '@/lib/currency'
import { formatLogQuota } from '@/lib/format'

const priceOptions = { digitsLarge: 4, digitsSmall: 6, abbreviate: false }

/** Only the display changes; recorded quota and unit prices stay untouched. */
export function createLogPriceDisplay(rechargePriceRate?: number) {
  const { config } = getCurrencyDisplay()
  return {
    rechargePriceRate,
    formatQuota: (quota: number) =>
      rechargePriceRate === undefined
        ? formatLogQuota(quota)
        : formatRechargePrice(
            quota / config.quotaPerUnit,
            rechargePriceRate,
            priceOptions
          ),
    formatPrice: (usd: number) =>
      rechargePriceRate === undefined
        ? formatBillingCurrencyFromUSD(usd, priceOptions)
        : formatRechargePrice(usd, rechargePriceRate, priceOptions),
  }
}

export type LogPriceDisplay = ReturnType<typeof createLogPriceDisplay>
