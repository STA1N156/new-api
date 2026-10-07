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
  ChevronDown,
  ChevronsUpDown,
  Check,
  CpuIcon,
  LayersIcon,
  LoaderCircle,
} from 'lucide-react'
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useIsMobile } from '@/hooks/use-mobile'
import { getLobeIcon } from '@/lib/lobe-icon'
import { resolveModelProvider } from '@/lib/model-provider'
import { cn } from '@/lib/utils'

import {
  modelGroupSelectorLayoutClasses,
  scrollSelectedOptionIntoView,
} from './model-group-selector/layout'

interface ModelOption {
  label: string
  value: string
  category?: string
  description?: string
}

interface GroupOption {
  label: string
  value: string
  ratio?: number
  desc?: string
  description?: string
}

interface ModelSelectorProps {
  selectedModel: string
  models: ModelOption[]
  onModelChange: (value: string) => void
  className?: string
  disabled?: boolean
}

interface GroupSelectorProps {
  selectedGroup: string
  groups: GroupOption[]
  onGroupChange: (value: string) => void
  className?: string
  disabled?: boolean
}

const ModelTriggerButton = React.forwardRef<
  React.ComponentRef<typeof Button>,
  React.ComponentPropsWithoutRef<typeof Button> & {
    currentLabel: string
    triggerClassName?: string
    isDisabled?: boolean
  }
>(({ currentLabel, triggerClassName, isDisabled, ...props }, ref) => (
  <Button
    ref={ref}
    variant='outline'
    role='combobox'
    size='sm'
    disabled={isDisabled}
    className={cn(
      'flex h-8 items-center gap-2 border px-3 font-medium',
      'justify-center p-0 sm:w-auto sm:justify-start sm:px-3',
      'w-8',
      'bg-background text-foreground',
      'hover:bg-accent transition-colors',
      'focus:!ring-0 focus:!outline-none',
      'shadow-none',
      triggerClassName
    )}
    {...props}
  >
    <CpuIcon className='text-muted-foreground block size-4 sm:hidden' />
    <span className='text-muted-foreground sm:text-foreground hidden truncate text-xs sm:block'>
      {currentLabel}
    </span>
    <ChevronsUpDown className='text-muted-foreground hidden h-4 w-4 opacity-50 sm:block' />
  </Button>
))

ModelTriggerButton.displayName = 'ModelTriggerButton'

const GroupTriggerButton = React.forwardRef<
  React.ComponentRef<typeof Button>,
  React.ComponentPropsWithoutRef<typeof Button> & {
    currentLabel: string
    triggerClassName?: string
    isDisabled?: boolean
  }
>(({ currentLabel, triggerClassName, isDisabled, ...props }, ref) => (
  <Button
    ref={ref}
    variant='outline'
    role='combobox'
    size='sm'
    disabled={isDisabled}
    className={cn(
      'flex h-8 items-center gap-2 border px-3 font-medium',
      'justify-center p-0 sm:w-auto sm:justify-start sm:px-3',
      'w-8',
      'bg-background text-foreground',
      'hover:bg-accent transition-colors',
      'focus:!ring-0 focus:!outline-none',
      'shadow-none',
      triggerClassName
    )}
    {...props}
  >
    <LayersIcon className='text-muted-foreground block size-4 sm:hidden' />
    <span className='text-muted-foreground sm:text-foreground hidden truncate text-xs sm:block'>
      {currentLabel}
    </span>
    <ChevronsUpDown className='text-muted-foreground hidden h-4 w-4 opacity-50 sm:block' />
  </Button>
))

GroupTriggerButton.displayName = 'GroupTriggerButton'

/**
 * Model Selector Component
 * Styled following Scira's form-component design patterns
 */
export const ModelSelector: React.FC<ModelSelectorProps> = React.memo(
  ({ selectedModel, models, onModelChange, className, disabled = false }) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const isMobile = useIsMobile()

    const currentModel = useMemo(
      () => models.find((m) => m.value === selectedModel),
      [models, selectedModel]
    )

    // Group models by category
    const groupedModels = useMemo(
      () =>
        models.reduce(
          (acc, model) => {
            const category = model.category || t('Other')
            if (!acc[category]) {
              acc[category] = []
            }
            acc[category].push(model)
            return acc
          },
          {} as Record<string, ModelOption[]>
        ),
      [models, t]
    )

    // Filter models by search query
    const filteredModels = useMemo(() => {
      if (!searchQuery.trim()) return groupedModels

      const query = searchQuery.toLowerCase()
      const filtered: Record<string, ModelOption[]> = {}

      Object.entries(groupedModels).forEach(([category, categoryModels]) => {
        const matches = categoryModels.filter(
          (m) =>
            m.label.toLowerCase().includes(query) ||
            m.value.toLowerCase().includes(query) ||
            m.description?.toLowerCase().includes(query)
        )
        if (matches.length > 0) {
          filtered[category] = matches
        }
      })

      return filtered
    }, [groupedModels, searchQuery])

    const handleModelChange = useCallback(
      (value: string) => {
        onModelChange(value)
        setOpen(false)
        setSearchQuery('')
      },
      [onModelChange]
    )

    // Shared command content
    const renderModelCommandContent = () => (
      <Command
        className={cn(
          isMobile
            ? 'h-full flex-1 rounded-lg border-0 bg-transparent'
            : 'rounded-lg'
        )}
        filter={() => 1}
        shouldFilter={false}
      >
        {!isMobile && (
          <CommandInput
            placeholder={t('Search models...')}
            className='h-9'
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
        )}
        <CommandEmpty>{t('No model found.')}</CommandEmpty>
        <CommandList
          className={isMobile ? '!max-h-full flex-1 p-2' : 'max-h-[300px]'}
        >
          {Object.keys(filteredModels).length === 0 ? (
            <div className='text-muted-foreground px-3 py-6 text-xs'>
              {t('No model found.')}
            </div>
          ) : (
            Object.entries(filteredModels).map(
              ([category, categoryModels], categoryIndex) => (
                <CommandGroup key={category}>
                  {categoryIndex > 0 && (
                    <div className='border-border my-1 border-t' />
                  )}
                  <div
                    className={cn(
                      'text-muted-foreground px-2 py-1 font-medium',
                      isMobile ? 'text-xs' : 'text-[10px]'
                    )}
                  >
                    {t('{{category}} Models', { category })}
                  </div>
                  {categoryModels.map((model) => (
                    <CommandItem
                      key={model.value}
                      value={model.value}
                      onSelect={handleModelChange}
                      className={cn(
                        'mb-0.5 flex items-center justify-between rounded-lg px-2 py-1.5 text-xs',
                        'transition-all duration-200',
                        'hover:bg-accent',
                        'data-[selected=true]:bg-accent'
                      )}
                    >
                      <div className='flex min-w-0 flex-1 items-center gap-1'>
                        <div
                          className={cn(
                            'truncate font-medium',
                            isMobile ? 'text-sm' : 'text-[11px]'
                          )}
                        >
                          <span className='inline'>{model.label}</span>
                        </div>
                        <Check
                          className={cn(
                            'h-4 w-4 flex-shrink-0',
                            selectedModel === model.value
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            )
          )}
        </CommandList>
      </Command>
    )

    return isMobile ? (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <ModelTriggerButton
            currentLabel={currentModel?.label || t('Model')}
            triggerClassName={className}
            isDisabled={disabled}
            aria-expanded={open}
          />
        </DrawerTrigger>
        <DrawerContent className='flex max-h-[80vh] min-h-[60vh] flex-col'>
          <DrawerHeader className='flex-shrink-0 pb-4'>
            <DrawerTitle className='flex items-center gap-2 text-left text-lg font-medium'>
              {t('Select Model')}
            </DrawerTitle>
          </DrawerHeader>
          <div className='flex min-h-0 flex-1 flex-col'>
            {renderModelCommandContent()}
          </div>
        </DrawerContent>
      </Drawer>
    ) : (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <ModelTriggerButton
              currentLabel={currentModel?.label || t('Model')}
              triggerClassName={className}
              isDisabled={disabled}
              aria-expanded={open}
            />
          }
        />
        <PopoverContent
          className='bg-popover z-40 w-[90vw] max-w-[20em] rounded-lg border p-0 !shadow-none sm:w-[20em]'
          align='start'
          side='bottom'
          sideOffset={4}
          collisionPadding={8}
        >
          {renderModelCommandContent()}
        </PopoverContent>
      </Popover>
    )
  }
)

ModelSelector.displayName = 'ModelSelector'

/**
 * Group Selector Component
 * Styled following Scira's form-component design patterns
 */
export const GroupSelector: React.FC<GroupSelectorProps> = React.memo(
  ({ selectedGroup, groups, onGroupChange, className, disabled = false }) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const isMobile = useIsMobile()

    const currentGroup = useMemo(
      () => groups.find((g) => g.value === selectedGroup),
      [groups, selectedGroup]
    )

    const handleGroupChange = useCallback(
      (value: string) => {
        onGroupChange(value)
        setOpen(false)
      },
      [onGroupChange]
    )

    // Shared command content
    const renderGroupCommandContent = () => (
      <Command
        className={cn(
          isMobile
            ? 'h-full flex-1 rounded-lg border-0 bg-transparent'
            : 'rounded-lg'
        )}
        filter={(value, search) => {
          const group = groups.find((g) => g.value === value)
          if (!group || !search) return 1

          const searchTerm = search.toLowerCase()
          const searchableFields = [
            group.label,
            group.description || '',
            group.value,
          ]
            .join(' ')
            .toLowerCase()

          return searchableFields.includes(searchTerm) ? 1 : 0
        }}
      >
        <CommandInput placeholder={t('Search groups...')} className='h-9' />
        <CommandEmpty>{t('No group found.')}</CommandEmpty>
        <CommandList
          className={isMobile ? '!max-h-full flex-1 p-2' : 'max-h-[240px]'}
        >
          <CommandGroup>
            <div className='text-muted-foreground px-2 py-1 text-[10px] font-medium'>
              {t('Model Group')}
            </div>
            {groups.map((group) => (
              <CommandItem
                key={group.value}
                value={group.value}
                onSelect={handleGroupChange}
                className={cn(
                  'mb-0.5 flex items-center justify-between rounded-lg px-2 py-2 text-xs',
                  'transition-all duration-200',
                  'hover:bg-accent',
                  'data-[selected=true]:bg-accent'
                )}
              >
                <div className='flex min-w-0 flex-1 items-center gap-2 pr-4'>
                  <div className='flex min-w-0 flex-1 flex-col'>
                    <span className='text-foreground truncate text-[11px] font-medium'>
                      {group.label}
                    </span>
                    {(group.desc || group.description) && (
                      <div className='text-muted-foreground truncate text-[9px] leading-tight'>
                        {group.desc || group.description}
                        {group.ratio && (
                          <>
                            {' · '}
                            {t('Ratio: {{value}}', { value: group.ratio })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <Check
                  className={cn(
                    'ml-auto h-4 w-4',
                    selectedGroup === group.value ? 'opacity-100' : 'opacity-0'
                  )}
                />
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    )

    return isMobile ? (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <GroupTriggerButton
            currentLabel={currentGroup?.label || t('Group')}
            triggerClassName={className}
            isDisabled={disabled}
            aria-expanded={open}
          />
        </DrawerTrigger>
        <DrawerContent className='max-h-[80vh]'>
          <DrawerHeader className='pb-4 text-left'>
            <DrawerTitle>{t('Choose Group')}</DrawerTitle>
          </DrawerHeader>
          <div className='max-h-[calc(80vh-100px)] overflow-y-auto px-4 pb-6'>
            <div className='space-y-2'>
              {groups.map((group) => (
                <Button
                  key={group.value}
                  variant='outline'
                  onClick={() => handleGroupChange(group.value)}
                  className={cn(
                    'flex h-auto w-full items-center justify-between rounded-lg p-4 text-left whitespace-normal',
                    'border-border hover:bg-accent',
                    selectedGroup === group.value
                      ? 'bg-accent border-primary/20'
                      : 'bg-background'
                  )}
                >
                  <div className='flex min-w-0 flex-1 items-center gap-3'>
                    <div className='flex min-w-0 flex-1 flex-col'>
                      <span className='text-foreground text-sm font-medium'>
                        {group.label}
                      </span>
                      {(group.desc || group.description) && (
                        <div className='text-muted-foreground mt-0.5 text-xs'>
                          {group.desc || group.description}
                          {group.ratio && (
                            <>
                              {' · '}
                              {t('Ratio: {{value}}', {
                                value: group.ratio,
                              })}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Check
                    className={cn(
                      'ml-3 h-5 w-5 shrink-0',
                      selectedGroup === group.value
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                </Button>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    ) : (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <GroupTriggerButton
              currentLabel={currentGroup?.label || t('Group')}
              triggerClassName={className}
              isDisabled={disabled}
              aria-expanded={open}
            />
          }
        />
        <PopoverContent
          className='bg-popover z-50 w-[90vw] max-w-[14em] rounded-lg border p-0 !shadow-none sm:w-[14em]'
          align='start'
          side='bottom'
          sideOffset={4}
          collisionPadding={8}
        >
          {renderGroupCommandContent()}
        </PopoverContent>
      </Popover>
    )
  }
)

GroupSelector.displayName = 'GroupSelector'

export interface ModelGroupSelectorProps {
  selectedModel: string
  models: ModelOption[]
  onModelChange: (value: string) => void
  selectedGroup: string
  groups: GroupOption[]
  onGroupChange: (value: string) => void
  className?: string
  disabled?: boolean
  loading?: boolean
}

export function ModelGroupSelector({
  selectedModel,
  models,
  onModelChange,
  selectedGroup,
  groups,
  onGroupChange,
  className,
  disabled = false,
  loading = false,
}: ModelGroupSelectorProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const isMobile = useIsMobile()
  const groupScrollContainerRef = useRef<HTMLDivElement | null>(null)
  const selectedGroupOptionRef = useRef<HTMLButtonElement | null>(null)
  const selectedModelOptionRef = useRef<HTMLDivElement | null>(null)
  const currentModel = models.find((model) => model.value === selectedModel)
  const currentGroup = groups.find((group) => group.value === selectedGroup)
  const filteredModels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return models
      .filter((model) =>
        [model.label, model.value, model.description, model.category]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      )
  }, [models, searchQuery])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) setSearchQuery('')
  }
  const handleModelChange = (value: string) => {
    onModelChange(value)
    handleOpenChange(false)
  }

  useEffect(() => {
    if (!open) return
    let secondFrameId = 0
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        scrollSelectedOptionIntoView(
          selectedGroupOptionRef.current,
          groupScrollContainerRef.current
        )
        scrollSelectedOptionIntoView(selectedModelOptionRef.current)
      })
    })
    return () => {
      window.cancelAnimationFrame(firstFrameId)
      window.cancelAnimationFrame(secondFrameId)
    }
  }, [open, selectedGroup, selectedModel])

  const trigger = (
    <Button
      aria-label={t('Select Model')}
      aria-expanded={open}
      className={cn(
        'group h-9 min-w-0 max-w-full justify-start gap-2 rounded-full border-transparent bg-transparent px-3 text-foreground shadow-none transition-colors hover:bg-transparent focus-visible:ring-2 focus-visible:ring-primary/30 md:max-w-[26rem]',
        className
      )}
      disabled={disabled}
      role='combobox'
      size='sm'
      variant='ghost'
    >
      <span className='min-w-0 truncate text-xs font-medium'>
        {currentModel?.label || selectedModel || t('Select Model')}
      </span>
      <span className='text-muted-foreground border-border/80 ml-1 hidden max-w-24 truncate border-l pl-2 text-[11px] sm:block'>
        {currentGroup?.label || t('Group')}
      </span>
      <ChevronDown
        className={cn(
          'text-muted-foreground size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none',
          open && 'rotate-180'
        )}
      />
    </Button>
  )

  const content = (
    <div
      className={
        isMobile
          ? 'grid max-h-[min(60dvh,32rem)] min-h-0 grid-cols-[6.5rem_minmax(0,1fr)]'
          : modelGroupSelectorLayoutClasses.desktopContent
      }
    >
      <div
        className={cn(
          modelGroupSelectorLayoutClasses.groupColumn,
          isMobile && 'h-auto max-h-[min(60dvh,32rem)]'
        )}
      >
        <div
          className={modelGroupSelectorLayoutClasses.groupScroll}
          ref={groupScrollContainerRef}
        >
          {groups.map((group) => {
            const selected = selectedGroup === group.value
            return (
              <button
                key={group.value}
                type='button'
                aria-pressed={selected}
                title={group.desc || group.description || group.label}
                disabled={disabled}
                onClick={() => onGroupChange(group.value)}
                ref={selected ? selectedGroupOptionRef : undefined}
                className={cn(
                  'flex min-w-0 items-center justify-between gap-1 rounded-lg px-2.5 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary/50 disabled:opacity-50',
                  selected
                    ? 'bg-card text-foreground shadow-xs ring-1 ring-border/70'
                    : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
                )}
              >
                <span className='truncate'>{group.label}</span>
                {selected && (
                  <span
                    className='bg-primary size-1.5 shrink-0 rounded-full'
                    aria-hidden
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
      <Command
        className={cn(
          modelGroupSelectorLayoutClasses.modelCommand,
          isMobile && 'h-auto max-h-[min(60dvh,32rem)]'
        )}
        shouldFilter={false}
      >
        <CommandInput
          aria-label={t('Search models...')}
          className='h-9 text-sm'
          onValueChange={setSearchQuery}
          placeholder={t('Search models...')}
          value={searchQuery}
        />
        <CommandList className={modelGroupSelectorLayoutClasses.modelList}>
          {loading && (
            <div
              className='text-muted-foreground flex items-center justify-center gap-2 px-3 py-12 text-xs'
              role='status'
            >
              <LoaderCircle className='size-4 motion-safe:animate-spin' />
              {t('Loading...')}
            </div>
          )}
          {!loading && filteredModels.length === 0 && (
            <div className='text-muted-foreground px-4 py-12 text-center text-xs'>
              {t('No model found.')}
            </div>
          )}
          {!loading && filteredModels.length > 0 && (
            <CommandGroup className='p-2'>
              {filteredModels.map((model) => {
                const provider = resolveModelProvider(model.value)
                return (
                  <CommandItem
                    key={model.value}
                    value={model.value}
                    onSelect={handleModelChange}
                    disabled={disabled}
                    data-checked={selectedModel === model.value}
                    ref={
                      selectedModel === model.value
                        ? selectedModelOptionRef
                        : undefined
                    }
                    className={cn(
                      modelGroupSelectorLayoutClasses.modelItem,
                      selectedModel === model.value
                        ? modelGroupSelectorLayoutClasses.selectedModelItem
                        : modelGroupSelectorLayoutClasses.unselectedModelItem
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5!',
                        selectedModel === model.value
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted/50 text-muted-foreground'
                      )}
                    >
                      {provider ? (
                        getLobeIcon(provider.icon, 20)
                      ) : (
                        <CpuIcon className='size-3.5' />
                      )}
                    </span>
                    <span className='min-w-0 flex-1'>
                      <span
                        className={cn(
                          'block break-all text-[13px] leading-5',
                          selectedModel === model.value
                            ? modelGroupSelectorLayoutClasses.selectedModelText
                            : modelGroupSelectorLayoutClasses.unselectedModelText
                        )}
                      >
                        {model.label}
                      </span>
                      {model.description && (
                        <span className='text-muted-foreground mt-0.5 line-clamp-1 block text-[11px] leading-4'>
                          {model.description}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  )

  return isMobile ? (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className='flex max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl'>
        <DrawerHeader className='px-5 pt-3 pb-4 text-left'>
          <DrawerTitle className='text-base font-medium'>
            {t('Select Model')}
          </DrawerTitle>
        </DrawerHeader>
        <div className='border-border/60 min-h-0 overflow-hidden border-t pb-[env(safe-area-inset-bottom)]'>
          {content}
        </div>
      </DrawerContent>
    </Drawer>
  ) : (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align='start'
        side='top'
        sideOffset={12}
        collisionPadding={12}
        className={cn(
          'w-[36rem] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-2xl border border-border/70 p-0 shadow-xl shadow-black/10 ring-0 duration-200 motion-reduce:animate-none',
          modelGroupSelectorLayoutClasses.desktopPanel
        )}
      >
        {content}
      </PopoverContent>
    </Popover>
  )
}
