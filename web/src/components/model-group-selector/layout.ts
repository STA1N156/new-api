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
export const modelGroupSelectorLayoutClasses = {
  desktopPanel: 'max-h-[min(60vh,30rem)] overflow-hidden',
  desktopContent:
    'grid h-[min(60vh,30rem)] min-h-0 grid-cols-[9rem_minmax(0,1fr)]',
  groupColumn:
    'flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r border-border/60 bg-muted/25 p-2',
  groupScroll:
    'relative grid min-h-0 flex-1 auto-rows-[2rem] content-start gap-1.5 overflow-y-auto px-px py-1 [scrollbar-width:thin]',
  modelCommand:
    'min-h-0 min-w-0 flex-1 rounded-none! border-0 bg-transparent p-0',
  modelList:
    'min-h-0 flex-1 max-h-none [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent',
  modelItem:
    'relative mb-1 flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 transition-colors',
  selectedModelItem: 'border-primary/15 bg-primary/5 text-foreground',
  unselectedModelItem: 'text-foreground/85 hover:bg-muted/60',
  selectedModelText: 'font-semibold text-foreground',
  unselectedModelText: 'font-medium',
} as const

type ScrollableOption = {
  offsetHeight?: number
  offsetTop?: number
  scrollIntoView: (options?: ScrollIntoViewOptions) => void
}

type ScrollableOptionContainer = {
  clientHeight: number
  scrollTo?: (options: ScrollToOptions) => void
  scrollTop: number
}

export function scrollSelectedOptionIntoView(
  selectedOption: ScrollableOption | null,
  scrollContainer?: ScrollableOptionContainer | null
): void {
  if (
    scrollContainer &&
    selectedOption?.offsetTop !== undefined &&
    selectedOption.offsetHeight !== undefined
  ) {
    const scrollTop = Math.max(
      0,
      selectedOption.offsetTop -
        (scrollContainer.clientHeight - selectedOption.offsetHeight) / 2
    )
    if (scrollContainer.scrollTo) {
      scrollContainer.scrollTo({ top: scrollTop, behavior: 'auto' })
    } else {
      scrollContainer.scrollTop = scrollTop
    }
    return
  }

  selectedOption?.scrollIntoView({
    block: 'center',
    inline: 'nearest',
  })
}
