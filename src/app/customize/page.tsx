'use client'

import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with SVG/DOM refs
const QRCustomizerMockup = dynamic(
  () => import('@/components/QRCustomizerMockup'),
  { ssr: false }
)

export default function CustomizePage() {
  return <QRCustomizerMockup />
}
