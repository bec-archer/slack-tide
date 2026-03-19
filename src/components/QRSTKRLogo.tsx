/**
 * QRSTKR Logo — new wordmark with halftone urchin.
 * Uses CSS mask-image to apply the brand gradient over the SVG.
 * The SVG lives in /public/assets/qrstkr-logo.svg.
 */

interface QRSTKRLogoProps {
  className?: string
  height?: number
  id?: string
  variant?: 'gradient' | 'white' | 'dark'
}

export default function QRSTKRLogo({ className = '', height = 32, id = 'logo', variant = 'gradient' }: QRSTKRLogoProps) {
  // viewBox of the new logo is 0 0 300 120.7, so aspect ratio ≈ 2.49:1
  const width = height * (300 / 120.7)

  const backgroundMap = {
    gradient: 'linear-gradient(135deg, var(--text-primary, #f1f5f9), var(--accent-secondary, #5eead4))',
    white: '#ffffff',
    dark: '#0a0f14',
  }

  return (
    <div
      className={className}
      aria-label="QRSTKR"
      role="img"
      style={{
        display: 'inline-block',
        width,
        height,
        background: backgroundMap[variant],
        WebkitMaskImage: 'url(/assets/qrstkr-logo.svg)',
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskImage: 'url(/assets/qrstkr-logo.svg)',
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
      }}
    />
  )
}
