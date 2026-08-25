export type Adjustments = {
  exposure: number
  contrast: number
  saturation: number
  temperature: number
  tint: number
  vignette: number
  grain: number
  sharpen: number
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  vignette: 0,
  grain: 0,
  sharpen: 0,
}

export type AdjustmentKey = keyof Adjustments

export type AdjustmentSpec = {
  key: AdjustmentKey
  label: string
  min: number
  max: number
  step: number
  /** Rendered as a signed value (e.g. +0.42) when true. */
  signed: boolean
  unit?: string
}

export const ADJUSTMENT_SPECS: AdjustmentSpec[] = [
  { key: 'exposure', label: 'Exposure', min: -100, max: 100, step: 1, signed: true, unit: 'EV' },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, step: 1, signed: true },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, step: 1, signed: true },
  { key: 'temperature', label: 'Temperature', min: -100, max: 100, step: 1, signed: true, unit: 'K' },
  { key: 'tint', label: 'Tint', min: -100, max: 100, step: 1, signed: true },
  { key: 'sharpen', label: 'Sharpen', min: 0, max: 100, step: 1, signed: false },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100, step: 1, signed: false },
  { key: 'grain', label: 'Grain', min: 0, max: 100, step: 1, signed: false },
]

export type Preset = {
  id: string
  name: string
  /** Short descriptor shown under the preset name. */
  note: string
  adjustments: Partial<Adjustments>
  /** Extra channel curve applied on top of the adjustments. */
  toning?: { r: number; g: number; b: number }
  monochrome?: boolean
}

export const PRESETS: Preset[] = [
  {
    id: 'original',
    name: 'Original',
    note: 'No processing',
    adjustments: {},
  },
  {
    id: 'portra',
    name: 'Portra',
    note: 'Warm negative',
    adjustments: { exposure: 6, contrast: -8, saturation: 10, temperature: 18, grain: 14 },
    toning: { r: 1.04, g: 1.0, b: 0.94 },
  },
  {
    id: 'cinestill',
    name: 'Cinestill',
    note: 'Tungsten halation',
    adjustments: { exposure: 4, contrast: 12, saturation: 6, temperature: -22, grain: 20 },
    toning: { r: 1.06, g: 0.99, b: 1.05 },
  },
  {
    id: 'silver',
    name: 'Silver',
    note: 'Mono, hard light',
    adjustments: { contrast: 26, exposure: 2, sharpen: 20, grain: 24, vignette: 18 },
    monochrome: true,
  },
  {
    id: 'faded',
    name: 'Faded',
    note: 'Lifted blacks',
    adjustments: { exposure: 10, contrast: -22, saturation: -16, temperature: 6 },
    toning: { r: 1.02, g: 1.01, b: 1.04 },
  },
  {
    id: 'cyanotype',
    name: 'Cyanotype',
    note: 'Blue process',
    adjustments: { contrast: 18, saturation: -100, temperature: -40, vignette: 22 },
    monochrome: true,
    toning: { r: 0.72, g: 0.92, b: 1.25 },
  },
  {
    id: 'noir',
    name: 'Noir',
    note: 'Deep shadow mono',
    adjustments: { contrast: 40, exposure: -8, vignette: 34, grain: 16, sharpen: 12 },
    monochrome: true,
  },
  {
    id: 'bleach',
    name: 'Bleach',
    note: 'Low sat, high key',
    adjustments: { exposure: 14, contrast: 30, saturation: -46, sharpen: 16 },
  },
]

export type Crop = { x: number; y: number; width: number; height: number }

export const FULL_CROP: Crop = { x: 0, y: 0, width: 1, height: 1 }

export type AspectRatio = {
  id: string
  label: string
  /** null means freeform. */
  value: number | null
}

export const ASPECT_RATIOS: AspectRatio[] = [
  { id: 'free', label: 'Free', value: null },
  { id: 'original', label: 'Original', value: 0 },
  { id: '1:1', label: '1:1', value: 1 },
  { id: '4:5', label: '4:5', value: 4 / 5 },
  { id: '3:2', label: '3:2', value: 3 / 2 },
  { id: '16:9', label: '16:9', value: 16 / 9 },
]

export type EditorState = {
  adjustments: Adjustments
  presetId: string
  crop: Crop
  rotation: number
  flipH: boolean
  flipV: boolean
}

export const INITIAL_EDITOR_STATE: EditorState = {
  adjustments: DEFAULT_ADJUSTMENTS,
  presetId: 'original',
  crop: FULL_CROP,
  rotation: 0,
  flipH: false,
  flipV: false,
}

export function formatAdjustment(spec: AdjustmentSpec, value: number) {
  if (spec.signed) {
    const sign = value > 0 ? '+' : ''
    return `${sign}${value}`
  }
  return `${value}`
}

export function isDefaultState(state: EditorState) {
  const adjustmentsClean = ADJUSTMENT_SPECS.every(
    (spec) => state.adjustments[spec.key] === DEFAULT_ADJUSTMENTS[spec.key],
  )
  const cropClean =
    state.crop.x === 0 && state.crop.y === 0 && state.crop.width === 1 && state.crop.height === 1
  return (
    adjustmentsClean &&
    cropClean &&
    state.rotation === 0 &&
    !state.flipH &&
    !state.flipV &&
    state.presetId === 'original'
  )
}
