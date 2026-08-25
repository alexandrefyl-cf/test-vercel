'use client'

import {
  FlipHorizontalIcon,
  FlipVerticalIcon,
  RotateCwIcon,
  CropIcon,
  CheckIcon,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  ADJUSTMENT_SPECS,
  ASPECT_RATIOS,
  type AdjustmentKey,
  type Adjustments,
  type EditorState,
} from '@/lib/editor-types'
import { AdjustmentRow } from './adjustment-row'
import { PresetStrip } from './preset-strip'

type ControlRailProps = {
  state: EditorState
  source: ImageBitmap | null
  cropping: boolean
  aspectId: string
  onAdjust: (key: AdjustmentKey, value: number) => void
  onResetAdjustment: (key: AdjustmentKey) => void
  onResetAllAdjustments: () => void
  onPreset: (id: string) => void
  onRotate: () => void
  onFlip: (axis: 'h' | 'v') => void
  onAspect: (id: string) => void
  onStartCrop: () => void
  onApplyCrop: () => void
  onCancelCrop: () => void
}

export function ControlRail({
  state,
  source,
  cropping,
  aspectId,
  onAdjust,
  onResetAdjustment,
  onResetAllAdjustments,
  onPreset,
  onRotate,
  onFlip,
  onAspect,
  onStartCrop,
  onApplyCrop,
  onCancelCrop,
}: ControlRailProps) {
  const anyAdjusted = ADJUSTMENT_SPECS.some((s) => state.adjustments[s.key] !== 0)

  return (
    <Tabs defaultValue="develop" className="flex min-h-0 flex-1 flex-col gap-0">
      <div className="border-b border-border px-3 py-3">
        <TabsList className="w-full">
          <TabsTrigger value="develop" className="flex-1">
            Develop
          </TabsTrigger>
          <TabsTrigger value="geometry" className="flex-1">
            Geometry
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        value="develop"
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4"
      >
        <section className="flex flex-col gap-3">
          <h3 className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Film presets
          </h3>
          <PresetStrip activeId={state.presetId} onSelect={onPreset} source={source} />
        </section>

        <Separator />

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Adjustments
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetAllAdjustments}
              disabled={!anyAdjusted}
              className="h-6 px-2 font-mono text-[10px] tracking-wide uppercase"
            >
              Reset
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            {ADJUSTMENT_SPECS.map((spec) => (
              <AdjustmentRow
                key={spec.key}
                spec={spec}
                value={state.adjustments[spec.key as keyof Adjustments]}
                onChange={(value) => onAdjust(spec.key, value)}
                onReset={() => onResetAdjustment(spec.key)}
              />
            ))}
          </div>
        </section>
      </TabsContent>

      <TabsContent
        value="geometry"
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4"
      >
        <section className="flex flex-col gap-3">
          <h3 className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Crop
          </h3>

          {cropping ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={onApplyCrop} className="flex-1">
                <CheckIcon data-icon="inline-start" />
                Apply
              </Button>
              <Button size="sm" variant="outline" onClick={onCancelCrop} className="flex-1">
                <XIcon data-icon="inline-start" />
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={onStartCrop}>
              <CropIcon data-icon="inline-start" />
              Enter crop mode
            </Button>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">Aspect ratio</span>
            <ToggleGroup
              value={[aspectId]}
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value
                if (next) onAspect(next)
              }}
              variant="outline"
              size="sm"
              className="flex-wrap"
            >
              {ASPECT_RATIOS.map((ratio) => (
                <ToggleGroupItem
                  key={ratio.id}
                  value={ratio.id}
                  className="font-mono text-[11px]"
                >
                  {ratio.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <h3 className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Orientation
          </h3>
          <div className="flex flex-col gap-2">
            <Button variant="outline" size="sm" onClick={onRotate} className="justify-start">
              <RotateCwIcon data-icon="inline-start" />
              Rotate 90°
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                {state.rotation}°
              </span>
            </Button>
            <Button
              variant={state.flipH ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => onFlip('h')}
              className="justify-start"
            >
              <FlipHorizontalIcon data-icon="inline-start" />
              Flip horizontal
            </Button>
            <Button
              variant={state.flipV ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => onFlip('v')}
              className="justify-start"
            >
              <FlipVerticalIcon data-icon="inline-start" />
              Flip vertical
            </Button>
          </div>
        </section>
      </TabsContent>
    </Tabs>
  )
}
