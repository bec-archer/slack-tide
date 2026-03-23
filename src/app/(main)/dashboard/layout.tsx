import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard — Slack Tide',
  description: 'Project dashboard and feature tracking',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Hide the root-layout Nav on dashboard routes */}
      <style>{`body > nav, body > div > nav { display: none !important; }`}</style>
      <main className="min-h-screen bg-bg-primary">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>
    </>
  )
}
