'use client'

import { RotateCcwIcon } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { type AdjustmentSpec, formatAdjustment } from '@/lib/editor-types'
import { cn } from '@/lib/utils'

type AdjustmentRowProps = {
  spec: AdjustmentSpec
  value: number
  onChange: (value: number) => void
  onReset: () => void
}

export function AdjustmentRow({ spec, value, onChange, onReset }: AdjustmentRowProps) {
  const modified = value !== 0

  return (
    <div className="group/row flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={`adj-${spec.key}`}
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          {spec.label}
        </label>

        <div className="flex items-center gap-1">
          <span
            className={cn(
              'font-mono text-xs tabular-nums transition-colors',
              modified ? 'text-primary' : 'text-muted-foreground/60',
            )}
          >
            {formatAdjustment(spec, value)}
            {spec.unit ? <span className="ml-0.5 text-[10px] opacity-60">{spec.unit}</span> : null}
          </span>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={onReset}
                  disabled={!modified}
                  aria-label={`Reset ${spec.label}`}
                  className="flex size-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 disabled:pointer-events-none group-hover/row:opacity-100"
                />
              }
            >
              <RotateCcwIcon className="size-3" />
            </TooltipTrigger>
            <TooltipContent>Reset {spec.label.toLowerCase()}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="relative">
        <Slider
          id={`adj-${spec.key}`}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          onValueChange={(next) => onChange(typeof next === 'number' ? next : next[0])}
          // Bipolar sliders get a center-origin fill drawn below, so the
          // built-in left-origin indicator is hidden for them.
          className={cn(spec.signed && '[&_[data-slot=slider-range]]:opacity-0')}
        />

        {spec.signed ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full"
          >
            <div
              className="absolute h-full bg-primary"
              style={{
                left: `${(Math.min(0, value) / (spec.max - spec.min)) * 100 + 50}%`,
                width: `${(Math.abs(value) / (spec.max - spec.min)) * 100}%`,
              }}
            />
            {/* Center detent. */}
            <div className="absolute left-1/2 h-full w-px -translate-x-1/2 bg-muted-foreground/40" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
