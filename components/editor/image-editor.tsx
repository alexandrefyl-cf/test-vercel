'use client'

import * as React from 'react'
import {
  ApertureIcon,
  DownloadIcon,
  EyeIcon,
  RedoIcon,
  UndoIcon,
  ImagePlusIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ASPECT_RATIOS,
  DEFAULT_ADJUSTMENTS,
  FULL_CROP,
  INITIAL_EDITOR_STATE,
  type AdjustmentKey,
  type Crop,
  type EditorState,
} from '@/lib/editor-types'
import { cropFromAspect, outputSize, renderToCanvas } from '@/lib/image-pipeline'
import { CanvasViewport } from './canvas-viewport'
import { ControlRail } from './control-rail'
import { DropZone } from './drop-zone'

type LoadedImage = {
  bitmap: ImageBitmap
  name: string
}

export function ImageEditor() {
  const [image, setImage] = React.useState<LoadedImage | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [comparing, setComparing] = React.useState(false)
  const [cropping, setCropping] = React.useState(false)
  const [aspectId, setAspectId] = React.useState('free')
  const [draftCrop, setDraftCrop] = React.useState<Crop>(FULL_CROP)

  // Undo/redo: a single piece of state so the stack and cursor always move
  // together in one atomic update.
  const [timeline, setTimeline] = React.useState<{
    past: EditorState[]
    present: EditorState
    future: EditorState[]
  }>({ past: [], present: INITIAL_EDITOR_STATE, future: [] })

  const state = timeline.present

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const commit = React.useCallback(
    (next: EditorState | ((prev: EditorState) => EditorState)) => {
      setTimeline((prev) => {
        const resolved = typeof next === 'function' ? next(prev.present) : next
        if (resolved === prev.present) return prev
        return {
          // Cap the past so long sessions don't grow unbounded.
          past: [...prev.past, prev.present].slice(-60),
          present: resolved,
          // Any new edit discards the redo branch.
          future: [],
        }
      })
    },
    [],
  )

  const resetTimeline = React.useCallback(() => {
    setTimeline({ past: [], present: INITIAL_EDITOR_STATE, future: [] })
  }, [])

  const canUndo = timeline.past.length > 0
  const canRedo = timeline.future.length > 0

  const undo = React.useCallback(() => {
    setTimeline((prev) => {
      if (prev.past.length === 0) return prev
      const past = [...prev.past]
      const present = past.pop() as EditorState
      return { past, present, future: [prev.present, ...prev.future] }
    })
  }, [])

  const redo = React.useCallback(() => {
    setTimeline((prev) => {
      if (prev.future.length === 0) return prev
      const [present, ...future] = prev.future
      return { past: [...prev.past, prev.present], present, future }
    })
  }, [])

  const loadFile = React.useCallback(async (file: File) => {
    setLoading(true)
    try {
      const bitmap = await createImageBitmap(file)
      setImage({ bitmap, name: file.name })
      resetTimeline()
      setCropping(false)
      setAspectId('free')
      setDraftCrop(FULL_CROP)
      toast.success('Image loaded', {
        description: `${bitmap.width} × ${bitmap.height} px`,
      })
    } catch {
      toast.error('Could not read that image', {
        description: 'Try a JPG, PNG, WEBP or AVIF file.',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const handleAdjust = (key: AdjustmentKey, value: number) => {
    commit((prev) => ({ ...prev, adjustments: { ...prev.adjustments, [key]: value } }))
  }

  const handleResetAdjustment = (key: AdjustmentKey) => {
    commit((prev) => ({
      ...prev,
      adjustments: { ...prev.adjustments, [key]: DEFAULT_ADJUSTMENTS[key] },
    }))
  }

  const handleResetAllAdjustments = () => {
    commit((prev) => ({ ...prev, adjustments: DEFAULT_ADJUSTMENTS }))
  }

  const handleRotate = () => {
    commit((prev) => ({ ...prev, rotation: (prev.rotation + 90) % 360 }))
  }

  const handleFlip = (axis: 'h' | 'v') => {
    commit((prev) =>
      axis === 'h' ? { ...prev, flipH: !prev.flipH } : { ...prev, flipV: !prev.flipV },
    )
  }

  const activeAspect = React.useMemo(() => {
    const ratio = ASPECT_RATIOS.find((r) => r.id === aspectId)
    if (!ratio || ratio.value === null) return null
    if (ratio.value === 0 && image) {
      const swap = state.rotation === 90 || state.rotation === 270
      return swap
        ? image.bitmap.height / image.bitmap.width
        : image.bitmap.width / image.bitmap.height
    }
    return ratio.value || null
  }, [aspectId, image, state.rotation])

  const handleAspect = (id: string) => {
    setAspectId(id)
    if (!image) return
    const ratio = ASPECT_RATIOS.find((r) => r.id === id)
    if (!ratio || ratio.value === null) return

    const swap = state.rotation === 90 || state.rotation === 270
    const imageAspect = swap
      ? image.bitmap.height / image.bitmap.width
      : image.bitmap.width / image.bitmap.height
    const target = ratio.value === 0 ? imageAspect : ratio.value

    const nextCrop = cropFromAspect(target, imageAspect)
    if (cropping) {
      setDraftCrop(nextCrop)
    } else {
      commit((prev) => ({ ...prev, crop: nextCrop }))
    }
  }

  const startCrop = () => {
    setDraftCrop(state.crop)
    setCropping(true)
  }

  const applyCrop = () => {
    // Crop is stored relative to the *original* image, so compose the draft
    // (relative to the current crop window) back into absolute coordinates.
    commit((prev) => ({
      ...prev,
      crop: {
        x: prev.crop.x + draftCrop.x * prev.crop.width,
        y: prev.crop.y + draftCrop.y * prev.crop.height,
        width: draftCrop.width * prev.crop.width,
        height: draftCrop.height * prev.crop.height,
      },
    }))
    setCropping(false)
  }

  const cancelCrop = () => {
    setDraftCrop(state.crop)
    setCropping(false)
  }

  const handleExport = () => {
    if (!image) return
    const canvas = document.createElement('canvas')
    renderToCanvas(canvas, image.bitmap, state)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error('Export failed')
          return
        }
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        const base = image.name.replace(/\.[^.]+$/, '')
        link.href = url
        link.download = `${base}-darkroom.png`
        link.click()
        URL.revokeObjectURL(url)
        toast.success('Exported', { description: link.download })
      },
      'image/png',
    )
  }

  // Keyboard shortcuts: undo/redo and hold-to-compare.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (event.key === '\\' && !event.repeat) {
        setComparing(true)
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === '\\') setComparing(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [undo, redo])

  const dimensions = React.useMemo(() => {
    if (!image) return null
    return outputSize(image.bitmap, state)
  }, [image, state])

  const viewportState: EditorState = cropping ? { ...state, crop: draftCrop } : state

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ApertureIcon className="size-4 text-primary" />
          <span className="font-mono text-xs tracking-[0.2em] uppercase">Darkroom</span>
        </div>

        {image ? (
          <>
            <Separator orientation="vertical" className="mx-1 h-5" />
            <span className="max-w-[9rem] truncate text-xs text-muted-foreground sm:max-w-xs">
              {image.name}
            </span>
            {dimensions ? (
              <span className="hidden font-mono text-[10px] text-muted-foreground/70 tabular-nums sm:inline">
                {dimensions.width} × {dimensions.height}
              </span>
            ) : null}
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          {image ? (
            <>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" onClick={undo} disabled={!canUndo} aria-label="Undo" />
                  }
                >
                  <UndoIcon />
                </TooltipTrigger>
                <TooltipContent>Undo · ⌘Z</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" onClick={redo} disabled={!canRedo} aria-label="Redo" />
                  }
                >
                  <RedoIcon />
                </TooltipTrigger>
                <TooltipContent>Redo · ⇧⌘Z</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant={comparing ? 'secondary' : 'ghost'}
                      size="icon-sm"
                      aria-label="Compare with original"
                      aria-pressed={comparing}
                      onPointerDown={() => setComparing(true)}
                      onPointerUp={() => setComparing(false)}
                      onPointerLeave={() => setComparing(false)}
                    />
                  }
                >
                  <EyeIcon />
                </TooltipTrigger>
                <TooltipContent>Hold to compare · \</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="mx-1 h-5" />

              <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                <ImagePlusIcon data-icon="inline-start" />
                <span className="hidden sm:inline">Replace</span>
              </Button>

              <Button size="sm" onClick={handleExport}>
                <DownloadIcon data-icon="inline-start" />
                Export
              </Button>
            </>
          ) : null}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) loadFile(file)
            event.target.value = ''
          }}
        />
      </header>

      {image ? (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <CanvasViewport
            source={image.bitmap}
            state={viewportState}
            cropping={cropping}
            onCropChange={setDraftCrop}
            aspect={activeAspect}
            comparing={comparing}
          />

          <aside className="flex max-h-[52dvh] min-h-0 shrink-0 flex-col border-t border-border bg-sidebar lg:max-h-none lg:w-[19rem] lg:border-t-0 lg:border-l">
            <ControlRail
              state={state}
              source={image.bitmap}
              cropping={cropping}
              aspectId={aspectId}
              onAdjust={handleAdjust}
              onResetAdjustment={handleResetAdjustment}
              onResetAllAdjustments={handleResetAllAdjustments}
              onPreset={(id) => commit((prev) => ({ ...prev, presetId: id }))}
              onRotate={handleRotate}
              onFlip={handleFlip}
              onAspect={handleAspect}
              onStartCrop={startCrop}
              onApplyCrop={applyCrop}
              onCancelCrop={cancelCrop}
            />
          </aside>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <DropZone onFile={loadFile} />
        </div>
      )}
    </main>
  )
}
