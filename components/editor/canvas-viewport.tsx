'use client'

import * as React from 'react'
import { type Crop, type EditorState, INITIAL_EDITOR_STATE } from '@/lib/editor-types'
import { renderToCanvas } from '@/lib/image-pipeline'
import { CropOverlay } from './crop-overlay'
import { cn } from '@/lib/utils'

const PREVIEW_MAX_EDGE = 1600

type CanvasViewportProps = {
  source: ImageBitmap
  state: EditorState
  cropping: boolean
  onCropChange: (crop: Crop) => void
  aspect: number | null
  comparing: boolean
}

export function CanvasViewport({
  source,
  state,
  cropping,
  onCropChange,
  aspect,
  comparing,
}: CanvasViewportProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const frameRef = React.useRef<number | null>(null)

  // While cropping we render the *uncropped* frame so the user can see the
  // material they are cutting away and drag the window over it.
  const renderState: EditorState = React.useMemo(() => {
    if (cropping) {
      return { ...state, crop: { x: 0, y: 0, width: 1, height: 1 } }
    }
    return state
  }, [state, cropping])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Coalesce rapid slider updates into one paint per animation frame.
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      const effective = comparing
        ? { ...INITIAL_EDITOR_STATE, crop: renderState.crop, rotation: renderState.rotation, flipH: renderState.flipH, flipV: renderState.flipV }
        : renderState
      renderToCanvas(canvas, source, effective, PREVIEW_MAX_EDGE)
      frameRef.current = null
    })

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [source, renderState, comparing])

  const displayAspect = React.useMemo(() => {
    const swap = renderState.rotation === 90 || renderState.rotation === 270
    const w = swap ? source.height : source.width
    const h = swap ? source.width : source.height
    return w / h
  }, [source, renderState.rotation])

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 sm:p-8">
      {/* Contact-sheet backdrop. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in oklch, var(--border), transparent 40%) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--border), transparent 40%) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div
        className="relative max-h-full max-w-full"
        style={{ aspectRatio: displayAspect }}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            'block h-full max-h-full w-full max-w-full rounded-sm object-contain shadow-2xl shadow-black/60 transition-opacity',
          )}
          style={{ imageRendering: 'auto' }}
        />

        {cropping ? (
          <CropOverlay
            crop={state.crop}
            onChange={onCropChange}
            aspect={aspect}
            displayAspect={displayAspect}
          />
        ) : null}

        {comparing ? (
          <div className="pointer-events-none absolute top-3 left-3 rounded-sm bg-background/85 px-2 py-1 font-mono text-[10px] tracking-widest text-primary uppercase">
            Before
          </div>
        ) : null}
      </div>
    </div>
  )
}
