'use client'

import * as React from 'react'
import type { Crop } from '@/lib/editor-types'

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'move'

const MIN_SIZE = 0.06

const HANDLES: { id: Handle; className: string; cursor: string }[] = [
  { id: 'nw', className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'nwse-resize' },
  { id: 'ne', className: 'right-0 top-0 translate-x-1/2 -translate-y-1/2', cursor: 'nesw-resize' },
  { id: 'sw', className: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursor: 'nesw-resize' },
  { id: 'se', className: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2', cursor: 'nwse-resize' },
]

const EDGES: { id: Handle; className: string; cursor: string }[] = [
  { id: 'n', className: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2', cursor: 'ns-resize' },
  { id: 's', className: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', cursor: 'ns-resize' },
  { id: 'w', className: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  { id: 'e', className: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
]

type CropOverlayProps = {
  crop: Crop
  onChange: (crop: Crop) => void
  /** Aspect ratio to lock to, in display space. null = freeform. */
  aspect: number | null
  /** Displayed image aspect (w/h), needed to convert the lock into unit space. */
  displayAspect: number
}

export function CropOverlay({ crop, onChange, aspect, displayAspect }: CropOverlayProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const dragRef = React.useRef<{
    handle: Handle
    startX: number
    startY: number
    origin: Crop
  } | null>(null)

  // Unit-space aspect: a 1:1 crop on a 3:2 image is not a unit square.
  const unitAspect = aspect === null ? null : aspect / displayAspect

  const handlePointerDown = (event: React.PointerEvent, handle: Handle) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = {
      handle,
      startX: (event.clientX - rect.left) / rect.width,
      startY: (event.clientY - rect.top) / rect.height,
      origin: crop,
    }
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current
    const rect = containerRef.current?.getBoundingClientRect()
    if (!drag || !rect) return

    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    const dx = px - drag.startX
    const dy = py - drag.startY
    const o = drag.origin

    let next: Crop = { ...o }

    if (drag.handle === 'move') {
      next.x = Math.min(Math.max(0, o.x + dx), 1 - o.width)
      next.y = Math.min(Math.max(0, o.y + dy), 1 - o.height)
      onChange(next)
      return
    }

    const h = drag.handle
    let left = o.x
    let top = o.y
    let right = o.x + o.width
    let bottom = o.y + o.height

    if (h.includes('w')) left = Math.min(Math.max(0, o.x + dx), right - MIN_SIZE)
    if (h.includes('e')) right = Math.max(Math.min(1, right + dx), left + MIN_SIZE)
    if (h.includes('n')) top = Math.min(Math.max(0, o.y + dy), bottom - MIN_SIZE)
    if (h.includes('s')) bottom = Math.max(Math.min(1, bottom + dy), top + MIN_SIZE)

    next = { x: left, y: top, width: right - left, height: bottom - top }

    if (unitAspect !== null) {
      // Re-derive height from width, anchored to the stationary corner/edge.
      const anchorRight = h.includes('w')
      const anchorBottom = h.includes('n')
      let width = next.width
      let height = width / unitAspect

      if (h === 'n' || h === 's') {
        height = next.height
        width = height * unitAspect
      }

      // Clamp so the locked rect stays inside the frame.
      if (height > 1) {
        height = 1
        width = height * unitAspect
      }
      if (width > 1) {
        width = 1
        height = width / unitAspect
      }

      const x = anchorRight ? right - width : next.x
      const y = anchorBottom ? bottom - height : next.y

      next = {
        x: Math.min(Math.max(0, x), 1 - width),
        y: Math.min(Math.max(0, y), 1 - height),
        width,
        height,
      }
    }

    onChange(next)
  }

  const endDrag = (event: React.PointerEvent) => {
    if (dragRef.current) {
      ;(event.target as HTMLElement).releasePointerCapture?.(event.pointerId)
      dragRef.current = null
    }
  }

  const style = {
    left: `${crop.x * 100}%`,
    top: `${crop.y * 100}%`,
    width: `${crop.width * 100}%`,
    height: `${crop.height * 100}%`,
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none"
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/*
        Scrim over everything except the crop window. Four strips are used
        instead of a brightness filter over the selection so the kept pixels
        render at their true values.
      */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-x-0 top-0 bg-background/70"
          style={{ height: `${crop.y * 100}%` }}
        />
        <div
          className="absolute inset-x-0 bottom-0 bg-background/70"
          style={{ height: `${(1 - crop.y - crop.height) * 100}%` }}
        />
        <div
          className="absolute left-0 bg-background/70"
          style={{
            top: `${crop.y * 100}%`,
            height: `${crop.height * 100}%`,
            width: `${crop.x * 100}%`,
          }}
        />
        <div
          className="absolute right-0 bg-background/70"
          style={{
            top: `${crop.y * 100}%`,
            height: `${crop.height * 100}%`,
            width: `${(1 - crop.x - crop.width) * 100}%`,
          }}
        />
      </div>

      {/* Crop window. */}
      <div className="absolute" style={style}>
        <div
          role="button"
          tabIndex={0}
          aria-label="Move crop region"
          onPointerDown={(e) => handlePointerDown(e, 'move')}
          className="absolute inset-0 cursor-move outline-none ring-1 ring-primary/90 ring-inset focus-visible:ring-2"
        >
          {/* Rule-of-thirds guides. */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-1/3 h-px w-full bg-primary/25" />
            <div className="absolute top-2/3 h-px w-full bg-primary/25" />
            <div className="absolute left-1/3 h-full w-px bg-primary/25" />
            <div className="absolute left-2/3 h-full w-px bg-primary/25" />
          </div>
        </div>

        {EDGES.map((edge) => (
          <div
            key={edge.id}
            onPointerDown={(e) => handlePointerDown(e, edge.id)}
            style={{ cursor: edge.cursor }}
            aria-hidden="true"
            className={`absolute size-4 ${edge.className}`}
          />
        ))}

        {HANDLES.map((handle) => (
          <div
            key={handle.id}
            onPointerDown={(e) => handlePointerDown(e, handle.id)}
            style={{ cursor: handle.cursor }}
            aria-hidden="true"
            className={`absolute size-3 rounded-full border-2 border-primary bg-background ${handle.className}`}
          />
        ))}
      </div>
    </div>
  )
}
