'use client'

import * as React from 'react'
import { PRESETS, type Preset, INITIAL_EDITOR_STATE } from '@/lib/editor-types'
import { renderToCanvas } from '@/lib/image-pipeline'
import { cn } from '@/lib/utils'

const THUMB_EDGE = 96

function PresetThumb({ preset, source }: { preset: Preset; source: ImageBitmap | null }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !source) return
    // Thumbnails always show the preset on the untouched image so the strip
    // stays a stable reference while the user tweaks sliders.
    renderToCanvas(
      canvas,
      source,
      { ...INITIAL_EDITOR_STATE, presetId: preset.id },
      THUMB_EDGE,
    )
  }, [preset.id, source])

  return (
    <canvas
      ref={canvasRef}
      className="size-full object-cover"
      aria-hidden="true"
    />
  )
}

type PresetStripProps = {
  activeId: string
  onSelect: (id: string) => void
  source: ImageBitmap | null
}

export function PresetStrip({ activeId, onSelect, source }: PresetStripProps) {
  return (
    <div
      className="-mx-1 grid grid-cols-4 gap-1.5 px-1"
      role="radiogroup"
      aria-label="Film presets"
    >
      {PRESETS.map((preset) => {
        const active = preset.id === activeId
        return (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(preset.id)}
            className={cn(
              'group flex min-w-0 flex-col gap-1.5 rounded-lg p-1 text-left transition-colors',
              active ? 'bg-primary/10' : 'hover:bg-accent/60',
            )}
          >
            <div
              className={cn(
                'aspect-square w-full overflow-hidden rounded-md border bg-secondary transition-colors',
                active ? 'border-primary' : 'border-border group-hover:border-muted-foreground/40',
              )}
            >
              <PresetThumb preset={preset} source={source} />
            </div>
            <div className="flex flex-col px-0.5">
              <span
                className={cn(
                  'truncate text-[11px] font-medium leading-tight',
                  active ? 'text-primary' : 'text-foreground',
                )}
              >
                {preset.name}
              </span>
              <span className="truncate text-[10px] leading-tight text-muted-foreground">
                {preset.note}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
