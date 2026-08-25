'use client'

import * as React from 'react'
import { ImagePlusIcon, UploadCloudIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type DropZoneProps = {
  onFile: (file: File) => void
}

export function DropZone({ onFile }: DropZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)
  // Nested dragenter/dragleave events fire per child element; count depth so the
  // highlight only clears when the pointer truly leaves the zone.
  const depth = React.useRef(0)

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    depth.current = 0
    setDragging(false)
    const file = Array.from(event.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (file) onFile(file)
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div
        onDragEnter={(e) => {
          e.preventDefault()
          depth.current += 1
          setDragging(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault()
          depth.current -= 1
          if (depth.current <= 0) setDragging(false)
        }}
        onDrop={handleDrop}
        className={cn(
          'relative flex w-full max-w-xl flex-col items-center gap-6 rounded-xl border border-dashed px-8 py-16 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border bg-card/40',
        )}
      >
        <div
          className={cn(
            'flex size-14 items-center justify-center rounded-full border transition-colors',
            dragging ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground',
          )}
        >
          {dragging ? (
            <UploadCloudIcon className="size-6" />
          ) : (
            <ImagePlusIcon className="size-6" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium tracking-tight text-balance">
            Drop a photo to start developing
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
            Everything runs locally in your browser — your photo is never uploaded to a server.
          </p>
        </div>

        <Button onClick={() => inputRef.current?.click()}>
          <ImagePlusIcon data-icon="inline-start" />
          Choose image
        </Button>

        <p className="font-mono text-xs tracking-wide text-muted-foreground/70">
          JPG · PNG · WEBP · AVIF
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onFile(file)
            event.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
