import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface ServiceStatus {
  name: string
  status: 'ok' | 'degraded' | 'down'
  latency: number
  lastChecked: string
}

async function pingService(name: string, fn: () => Promise<Response>): Promise<ServiceStatus> {
  const start = performance.now()
  try {
    const res = await fn()
    const latency = Math.round(performance.now() - start)
    const status = !res.ok ? 'down' : latency > 500 ? 'degraded' : 'ok'
    return { name, status, latency, lastChecked: new Date().toISOString() }
  } catch {
    const latency = Math.round(performance.now() - start)
    return { name, status: 'down', latency, lastChecked: new Date().toISOString() }
  }
}

export async function GET() {
  const serverStart = performance.now()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const results = await Promise.allSettled([
    pingService('Supabase', () =>
      fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: supabaseKey || '',
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: 'no-store',
      })
    ),
    pingService('Production', () =>
      fetch('https://qrstkr.com', { method: 'HEAD', cache: 'no-store' })
    ),
  ])

  const services: ServiceStatus[] = results.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: 'Unknown', status: 'down' as const, latency: 0, lastChecked: new Date().toISOString() }
  )

  // Add API server self-measurement
  const serverLatency = Math.round(performance.now() - serverStart)
  services.push({
    name: 'API Server',
    status: 'ok',
    latency: serverLatency,
    lastChecked: new Date().toISOString(),
  })

  return NextResponse.json({ services, serverTime: Date.now() })
}
