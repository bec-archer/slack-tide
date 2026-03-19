/**
 * circular-qr.ts — Server-side circular QR SVG generator
 *
 * Port of circular_qr_batch.py to JavaScript/TypeScript.
 * Generates Illustrator-compatible circular QR codes as SVG strings.
 *
 * Uses the `qrcode` npm package for QR matrix generation.
 */

import QRCode from 'qrcode'

// ---------------------------------------------------------------------------
// QR matrix helpers
// ---------------------------------------------------------------------------

interface FinderRegion {
  r0: number; c0: number; r1: number; c1: number
}

function getFinderRegions(moduleCount: number): FinderRegion[] {
  const n = moduleCount
  return [
    { r0: 0, c0: 0, r1: 8, c1: 8 },          // Top-left
    { r0: 0, c0: n - 8, r1: 8, c1: n },       // Top-right
    { r0: n - 8, c0: 0, r1: n, c1: 8 },       // Bottom-left
  ]
}

function isInFinder(row: number, col: number, moduleCount: number): boolean {
  for (const { r0, c0, r1, c1 } of getFinderRegions(moduleCount)) {
    if (r0 <= row && row < r1 && c0 <= col && col < c1) return true
  }
  return false
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, w / 2, h / 2)
  return (
    `M${x + r},${y}` +
    `H${x + w - r}` +
    `A${r},${r} 0 0 1 ${x + w},${y + r}` +
    `V${y + h - r}` +
    `A${r},${r} 0 0 1 ${x + w - r},${y + h}` +
    `H${x + r}` +
    `A${r},${r} 0 0 1 ${x},${y + h - r}` +
    `V${y + r}` +
    `A${r},${r} 0 0 1 ${x + r},${y}` +
    `Z`
  )
}

// ---------------------------------------------------------------------------
// Seeded PRNG (matches Python's Random with MD5 seed)
// ---------------------------------------------------------------------------

class SeededRandom {
  private state: number

  constructor(seed: string) {
    // Simple hash-based seed (doesn't need to match Python exactly, just be deterministic)
    let h = 0
    for (let i = 0; i < seed.length; i++) {
      h = ((h << 5) - h + seed.charCodeAt(i)) | 0
    }
    this.state = Math.abs(h) || 1
  }

  random(): number {
    // Mulberry32 PRNG
    let t = (this.state += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// MD5-ish hash for seeding (simple version)
// ---------------------------------------------------------------------------

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return hash.toString(16)
}

// ---------------------------------------------------------------------------
// Core SVG generation
// ---------------------------------------------------------------------------

interface GenerateOptions {
  dotSize?: number
  border?: number
  noiseFill?: boolean
  noiseDensity?: number
  ringWidth?: number
  finderStyle?: 'rounded' | 'circle' | 'square'
  fgColor?: string
  bgColor?: string
}

export function generateCircularQrSvg(
  data: string,
  options: GenerateOptions = {}
): string {
  const {
    dotSize = 0.8,
    border = 8,
    noiseFill = true,
    noiseDensity = 0.35,
    ringWidth = 0.8,
    finderStyle = 'rounded',
    fgColor = '#000000',
    bgColor = '#ffffff',
  } = options

  // Step 1: Generate QR matrix
  const qr = QRCode.create(data, {
    errorCorrectionLevel: 'H',
  })

  const moduleCount = qr.modules.size
  const totalSize = moduleCount + 2 * border

  // Step 2: Geometry
  const cx = totalSize / 2
  const cy = totalSize / 2
  const radius = totalSize / 2 - 0.3
  const dotR = dotSize / 2

  // Helper to check if module is dark
  const isDark = (row: number, col: number): boolean => {
    if (row < 0 || row >= moduleCount || col < 0 || col >= moduleCount) return false
    return qr.modules.get(row, col) === 1
  }

  // Step 3: Build SVG string
  const parts: string[] = []

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 ${totalSize} ${totalSize}">`)

  // Defs — clip path
  parts.push(`<defs><clipPath id="qr-circle-clip"><circle cx="${cx}" cy="${cy}" r="${(radius - ringWidth / 2).toFixed(1)}" /></clipPath></defs>`)

  // Background circle
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${radius.toFixed(1)}" fill="${bgColor}" stroke="none" />`)

  // Step 4: Noise fill
  if (noiseFill) {
    parts.push(`<g clip-path="url(#qr-circle-clip)" id="noise-fill">`)
    const rng = new SeededRandom(simpleHash(data))
    const noiseR = dotSize * 0.4

    for (let row = 0; row < totalSize; row++) {
      for (let col = 0; col < totalSize; col++) {
        // Skip QR data region
        const inQr = (border <= row && row < border + moduleCount &&
                      border <= col && col < border + moduleCount)
        if (inQr) continue

        const cellCx = col + 0.5
        const cellCy = row + 0.5
        const dist = Math.sqrt((cellCx - cx) ** 2 + (cellCy - cy) ** 2)
        if (dist > radius - ringWidth) continue

        if (rng.random() < noiseDensity) {
          parts.push(`<circle cx="${cellCx.toFixed(2)}" cy="${cellCy.toFixed(2)}" r="${noiseR.toFixed(3)}" fill="${fgColor}" />`)
        }
      }
    }
    parts.push(`</g>`)
  }

  // Step 5: QR data modules (circles, excluding finders)
  parts.push(`<g clip-path="url(#qr-circle-clip)" id="qr-data">`)
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (!isDark(row, col)) continue
      if (isInFinder(row, col, moduleCount)) continue

      const mcx = (border + col + 0.5).toFixed(2)
      const mcy = (border + row + 0.5).toFixed(2)
      parts.push(`<circle cx="${mcx}" cy="${mcy}" r="${dotR.toFixed(3)}" fill="${fgColor}" stroke="none" />`)
    }
  }
  parts.push(`</g>`)

  // Step 6: Finder patterns
  parts.push(`<g clip-path="url(#qr-circle-clip)" id="finder-patterns">`)

  const finderCenters = [
    { fy: border + 3.5, fx: border + 3.5 },                    // Top-left
    { fy: border + 3.5, fx: border + moduleCount - 3.5 },      // Top-right
    { fy: border + moduleCount - 3.5, fx: border + 3.5 },      // Bottom-left
  ]

  for (const { fy, fx } of finderCenters) {
    if (finderStyle === 'circle') {
      // Concentric circles (bullseye)
      parts.push(`<circle cx="${fx}" cy="${fy}" r="3.5" fill="${fgColor}" stroke="none" />`)
      parts.push(`<circle cx="${fx}" cy="${fy}" r="2.5" fill="${bgColor}" stroke="none" />`)
      parts.push(`<circle cx="${fx}" cy="${fy}" r="1.5" fill="${fgColor}" stroke="none" />`)
    } else if (finderStyle === 'rounded') {
      // Rounded rectangles
      const cr = 0.6
      parts.push(`<path d="${roundedRectPath(fx - 3.5, fy - 3.5, 7, 7, cr)}" fill="${fgColor}" stroke="none" />`)
      parts.push(`<path d="${roundedRectPath(fx - 2.5, fy - 2.5, 5, 5, cr * 0.7)}" fill="${bgColor}" stroke="none" />`)
      parts.push(`<path d="${roundedRectPath(fx - 1.5, fy - 1.5, 3, 3, cr * 0.5)}" fill="${fgColor}" stroke="none" />`)
    } else {
      // Square finders from matrix
      const mr = Math.round(fy - border - 3.5)
      const mc = Math.round(fx - border - 3.5)
      for (let dr = 0; dr < 7; dr++) {
        for (let dc = 0; dc < 7; dc++) {
          if (isDark(mr + dr, mc + dc)) {
            const sx = (border + mc + dc).toFixed(2)
            const sy = (border + mr + dr).toFixed(2)
            parts.push(`<rect x="${sx}" y="${sy}" width="1" height="1" fill="${fgColor}" />`)
          }
        }
      }
    }
  }
  parts.push(`</g>`)

  // Step 7: Outer ring
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${radius.toFixed(1)}" fill="none" stroke="${fgColor}" stroke-width="${ringWidth}" />`)

  parts.push(`</svg>`)

  return parts.join('')
}

/**
 * Replace the demo QR in a captured design SVG with a real QR for the given URL.
 *
 * Strategy: The captureDesignSvg() function tags the nested QR <svg> with
 * data-qr-element="true". We find that specific element and replace its
 * inner content with the freshly generated real QR.
 */
export function patchDesignSvgWithRealQr(
  designSvg: string,
  qrUrl: string,
  qrColor: string = '#000000',
  bgColor: string = '#ffffff'
): string {
  // Generate the real QR SVG
  const realQrSvg = generateCircularQrSvg(qrUrl, {
    fgColor: qrColor,
    bgColor: bgColor,
    dotSize: 0.8,
    border: 8,
    noiseFill: true,
    noiseDensity: 0.35,
    finderStyle: 'rounded',
  })

  // Extract inner content from the generated QR (everything between <svg ...> and </svg>)
  const realInnerMatch = realQrSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/)
  if (!realInnerMatch) return designSvg
  const realInner = realInnerMatch[1]

  // Extract the viewBox from the real QR
  const realVbMatch = realQrSvg.match(/viewBox="([^"]*)"/)
  const realViewBox = realVbMatch ? realVbMatch[1] : '0 0 49 49'

  // Strategy 1: Find the QR SVG by its data-qr-element marker attribute.
  // This is set by captureDesignSvg() in QRCustomizerMockup.jsx.
  const markerPattern = /(<svg\s[^>]*data-qr-element="true"[^>]*>)([\s\S]*?)(<\/svg>)/
  let match = designSvg.match(markerPattern)

  if (!match) {
    // Strategy 2: Find a NESTED <svg> that has x= positioning (not the root SVG)
    // and contains qr-circle-clip (the QR's circular clip path).
    // The x= attribute ensures we skip the outer design SVG (which has no x= attr).
    console.warn('No data-qr-element marker found, falling back to nested SVG detection')
    const nestedPattern = /(<svg\s[^>]*\bx="[^"]*"[^>]*>)([\s\S]*?qr-circle-clip[\s\S]*?)(<\/svg>)/
    match = designSvg.match(nestedPattern)
  }

  if (!match) {
    console.warn('Could not find QR SVG in design — returning original')
    return designSvg
  }

  // Update the viewBox in the opening tag and swap the inner content
  let openTag = match[1]
  if (/viewBox="[^"]*"/.test(openTag)) {
    openTag = openTag.replace(/viewBox="[^"]*"/, `viewBox="${realViewBox}"`)
  } else {
    openTag = openTag.replace(/>$/, ` viewBox="${realViewBox}">`)
  }

  return designSvg.replace(match[0], openTag + realInner + match[3])
}
