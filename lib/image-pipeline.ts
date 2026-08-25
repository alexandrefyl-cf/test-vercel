import {
  type Adjustments,
  type Crop,
  type EditorState,
  type Preset,
  PRESETS,
} from './editor-types'

function clamp255(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

/**
 * Merge a preset's adjustments with the user's manual adjustments.
 * Manual values are treated as deltas on top of the preset baseline.
 */
export function resolvePreset(presetId: string): Preset {
  return PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]
}

export function effectiveAdjustments(state: EditorState): Adjustments {
  const preset = resolvePreset(state.presetId)
  const base = preset.adjustments
  const out = { ...state.adjustments }
  for (const key of Object.keys(out) as (keyof Adjustments)[]) {
    const presetValue = base[key] ?? 0
    out[key] = out[key] + presetValue
  }
  return out
}

/**
 * Builds a 256-entry lookup table per channel for the tonal adjustments.
 * Using an LUT keeps the per-pixel loop cheap on large images.
 */
function buildChannelLuts(adj: Adjustments, toning?: { r: number; g: number; b: number }) {
  const exposure = 2 ** (adj.exposure / 50)
  const contrast = (adj.contrast + 100) / 100
  const tempR = 1 + (adj.temperature / 100) * 0.28
  const tempB = 1 - (adj.temperature / 100) * 0.28
  const tintG = 1 + (adj.tint / 100) * 0.2

  const toneR = (toning?.r ?? 1) * tempR
  const toneG = (toning?.g ?? 1) * tintG
  const toneB = (toning?.b ?? 1) * tempB

  const lutR = new Uint8ClampedArray(256)
  const lutG = new Uint8ClampedArray(256)
  const lutB = new Uint8ClampedArray(256)

  for (let i = 0; i < 256; i++) {
    // Work in linear-ish 0..1, apply exposure then contrast around mid grey.
    const base = (i / 255) * exposure
    const contrasted = (base - 0.5) * contrast + 0.5
    lutR[i] = clamp255(contrasted * toneR * 255)
    lutG[i] = clamp255(contrasted * toneG * 255)
    lutB[i] = clamp255(contrasted * toneB * 255)
  }

  return { lutR, lutG, lutB }
}

/**
 * Applies a 3x3 sharpen convolution scaled by `amount` (0..1).
 * Operates on a copy so the source pixels stay intact during sampling.
 */
function applySharpen(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  if (amount <= 0) return
  const source = new Uint8ClampedArray(data)
  const center = 1 + 4 * amount
  const side = -amount

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4
      for (let c = 0; c < 3; c++) {
        const idx = i + c
        const up = idx - width * 4
        const down = idx + width * 4
        const sum =
          source[idx] * center +
          source[up] * side +
          source[down] * side +
          source[idx - 4] * side +
          source[idx + 4] * side
        data[idx] = clamp255(sum)
      }
    }
  }
}

export type ProcessOptions = {
  adjustments: Adjustments
  monochrome?: boolean
  toning?: { r: number; g: number; b: number }
  /** Deterministic grain so the preview does not shimmer between renders. */
  grainSeed?: number
}

/** Mutates the given ImageData in place. */
export function processImageData(imageData: ImageData, options: ProcessOptions) {
  const { adjustments: adj, monochrome, toning } = options
  const { data, width, height } = imageData
  const { lutR, lutG, lutB } = buildChannelLuts(adj, toning)

  const saturation = 1 + adj.saturation / 100
  const grain = adj.grain / 100
  const vignette = adj.vignette / 100

  const cx = width / 2
  const cy = height / 2
  const maxDist = Math.hypot(cx, cy)
  let seed = options.grainSeed ?? 1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4

      let r = lutR[data[i]]
      let g = lutG[data[i + 1]]
      let b = lutB[data[i + 2]]

      // Luminance using Rec. 709 weights.
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b

      if (monochrome) {
        r = lum
        g = lum
        b = lum
        if (toning) {
          r = clamp255(lum * toning.r)
          g = clamp255(lum * toning.g)
          b = clamp255(lum * toning.b)
        }
      } else if (saturation !== 1) {
        r = clamp255(lum + (r - lum) * saturation)
        g = clamp255(lum + (g - lum) * saturation)
        b = clamp255(lum + (b - lum) * saturation)
      }

      if (vignette > 0) {
        const dist = Math.hypot(x - cx, y - cy) / maxDist
        const falloff = 1 - vignette * Math.pow(dist, 2.2)
        r *= falloff
        g *= falloff
        b *= falloff
      }

      if (grain > 0) {
        // Cheap deterministic PRNG (xorshift) keeps grain stable per render.
        seed ^= seed << 13
        seed ^= seed >>> 17
        seed ^= seed << 5
        const noise = ((seed & 0xff) / 255 - 0.5) * grain * 64
        r += noise
        g += noise
        b += noise
      }

      data[i] = clamp255(r)
      data[i + 1] = clamp255(g)
      data[i + 2] = clamp255(b)
    }
  }

  applySharpen(data, width, height, adj.sharpen / 100)
}

/** Pixel dimensions of the output after crop + rotation. */
export function outputSize(image: { width: number; height: number }, state: EditorState) {
  const cropW = Math.max(1, Math.round(image.width * state.crop.width))
  const cropH = Math.max(1, Math.round(image.height * state.crop.height))
  const swap = state.rotation === 90 || state.rotation === 270
  return {
    width: swap ? cropH : cropW,
    height: swap ? cropW : cropH,
    cropW,
    cropH,
  }
}

/**
 * Draws the cropped/rotated/flipped source into the target canvas and applies
 * the pixel pipeline. Returns the canvas for chaining.
 */
export function renderToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | ImageBitmap,
  state: EditorState,
  maxEdge?: number,
) {
  const source = { width: image.width, height: image.height }
  const { width, height, cropW, cropH } = outputSize(source, state)

  let scale = 1
  if (maxEdge && Math.max(width, height) > maxEdge) {
    scale = maxEdge / Math.max(width, height)
  }
  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))

  canvas.width = targetW
  canvas.height = targetH

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return canvas

  ctx.save()
  ctx.clearRect(0, 0, targetW, targetH)
  ctx.translate(targetW / 2, targetH / 2)
  ctx.rotate((state.rotation * Math.PI) / 180)
  ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1)

  const drawW = (state.rotation === 90 || state.rotation === 270 ? targetH : targetW)
  const drawH = (state.rotation === 90 || state.rotation === 270 ? targetW : targetH)

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    image as CanvasImageSource,
    state.crop.x * source.width,
    state.crop.y * source.height,
    cropW,
    cropH,
    -drawW / 2,
    -drawH / 2,
    drawW,
    drawH,
  )
  ctx.restore()

  const preset = resolvePreset(state.presetId)
  const adj = effectiveAdjustments(state)

  const imageData = ctx.getImageData(0, 0, targetW, targetH)
  processImageData(imageData, {
    adjustments: adj,
    monochrome: preset.monochrome,
    toning: preset.toning,
    grainSeed: 1013904223,
  })
  ctx.putImageData(imageData, 0, 0)

  return canvas
}

export function cropFromAspect(aspect: number, imageAspect: number): Crop {
  // Largest centered rect of `aspect` that fits inside a unit box of `imageAspect`.
  if (aspect >= imageAspect) {
    const height = imageAspect / aspect
    return { x: 0, y: (1 - height) / 2, width: 1, height }
  }
  const width = aspect / imageAspect
  return { x: (1 - width) / 2, y: 0, width, height: 1 }
}
