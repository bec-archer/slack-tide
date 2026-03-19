'use client'

import { useEffect, useState } from 'react'
import { useShop } from '@/contexts/ShopContext'
import { createBrowserClient } from '@/lib/supabase'
import type { ShopEmployee } from '@/lib/types'

type InviteMethod = 'email' | 'phone'

export default function ShopEmployeesPage() {
  const { shopId, isShopAdmin } = useShop()
  const [employees, setEmployees] = useState<ShopEmployee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Invite form
  const [inviteMethod, setInviteMethod] = useState<InviteMethod>('phone')
  const [inviteContact, setInviteContact] = useState('')
  const [inviteRole, setInviteRole] = useState<'technician' | 'admin'>('technician')
  const [isInviting, setIsInviting] = useState(false)

  // Remove confirmation
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    if (shopId) fetchEmployees()
  }, [shopId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchEmployees() {
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/shops/${shopId}/employees`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        setError('Failed to load employees')
        setIsLoading(false)
        return
      }

      const body = await res.json()
      setEmployees(body.employees ?? [])
    } catch {
      setError('Failed to load employees')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setIsInviting(true)

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Session expired'); setIsInviting(false); return }

      const payload: Record<string, string> = { role: inviteRole }
      if (inviteMethod === 'email') {
        payload.email = inviteContact.trim().toLowerCase()
      } else {
        payload.phone = inviteContact.trim()
      }

      const res = await fetch(`/api/shops/${shopId}/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      const body = await res.json().catch(() => null)

      if (!res.ok) {
        setError(body?.error || 'Failed to send invite')
        setIsInviting(false)
        return
      }

      const sentTo = inviteContact.trim()
      const smsNote = body?.smsSent ? ' (SMS sent!)' : ''
      setSuccessMsg(`Invite sent to ${sentTo}${smsNote}`)
      setInviteContact('')
      setInviteRole('technician')
      await fetchEmployees()
    } catch {
      setError('Something went wrong')
    } finally {
      setIsInviting(false)
    }
  }

  async function handleRemove(userId: string) {
    setError(null)
    setSuccessMsg(null)

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Session expired'); return }

      const res = await fetch(`/api/shops/${shopId}/employees/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error || 'Failed to remove employee')
        setRemovingId(null)
        return
      }

      setSuccessMsg('Employee removed.')
      setRemovingId(null)
      await fetchEmployees()
    } catch {
      setError('Something went wrong')
      setRemovingId(null)
    }
  }

  function employeeLabel(emp: ShopEmployee): string {
    if (emp.email && emp.phone) return `${emp.email} (${formatPhone(emp.phone)})`
    if (emp.email) return emp.email
    if (emp.phone) return formatPhone(emp.phone)
    return 'Unknown'
  }

  function formatPhone(digits: string): string {
    const clean = digits.replace(/^1/, '')
    if (clean.length === 10) {
      return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`
    }
    return digits
  }

  if (!isShopAdmin) {
    return (
      <div className="py-8 text-center">
        <h1 className="text-xl font-bold text-text-primary mb-2">Admin Only</h1>
        <p className="text-text-secondary">Only shop admins can manage employees.</p>
      </div>
    )
  }

  if (isLoading) {
    return <div className="text-text-tertiary text-sm animate-pulse py-8">Loading employees...</div>
  }

  const activeEmployees = employees.filter((e) => !e.removed_at)
  const pendingInvites = activeEmployees.filter((e) => !e.accepted_at)
  const acceptedEmployees = activeEmployees.filter((e) => e.accepted_at)

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Employees</h1>

      {error && (
        <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-4">
          <p className="text-error text-sm">{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-4 mb-4">
          <p className="text-success text-sm">{successMsg}</p>
        </div>
      )}

      {/* Invite form */}
      <div className="card-static p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Invite Employee</h2>

        {/* Method toggle */}
        <div className="flex gap-1 mb-3 bg-bg-tertiary rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => { setInviteMethod('phone'); setInviteContact('') }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              inviteMethod === 'phone'
                ? 'bg-accent/15 text-accent'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            Phone
          </button>
          <button
            type="button"
            onClick={() => { setInviteMethod('email'); setInviteContact('') }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              inviteMethod === 'email'
                ? 'bg-accent/15 text-accent'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            Email
          </button>
        </div>

        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          {inviteMethod === 'email' ? (
            <input
              type="email"
              value={inviteContact}
              onChange={(e) => setInviteContact(e.target.value)}
              placeholder="employee@example.com"
              className="input flex-1"
              required
            />
          ) : (
            <input
              type="tel"
              value={inviteContact}
              onChange={(e) => setInviteContact(e.target.value)}
              placeholder="(555) 555-1234"
              className="input flex-1"
              inputMode="tel"
              required
            />
          )}
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'technician' | 'admin')}
            className="input w-full sm:w-36"
          >
            <option value="technician">Technician</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" disabled={isInviting} className="btn-primary whitespace-nowrap">
            {isInviting ? 'Sending...' : 'Send Invite'}
          </button>
        </form>
        <p className="text-text-tertiary text-xs mt-2">
          {inviteMethod === 'phone'
            ? 'They\'ll receive a text with a link to create their account and join your shop.'
            : 'They\'ll need to visit qrstkr.com/shop/invite after creating an account to accept.'}
        </p>
      </div>

      {/* Active employees */}
      <div className="card-static divide-y divide-border-subtle">
        <div className="p-4">
          <h2 className="text-sm font-semibold text-text-primary">
            Active ({acceptedEmployees.length})
          </h2>
        </div>
        {acceptedEmployees.length === 0 ? (
          <div className="p-4 text-text-tertiary text-sm">No active employees yet.</div>
        ) : (
          acceptedEmployees.map((emp) => (
            <div key={emp.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-text-primary text-sm font-medium">{employeeLabel(emp)}</p>
                <p className="text-text-tertiary text-xs capitalize">{emp.role}</p>
              </div>
              {removingId === emp.user_id ? (
                <div className="flex gap-2">
                  <button onClick={() => handleRemove(emp.user_id!)} className="text-xs text-error font-medium hover:text-red-400 transition-colors">
                    Confirm Remove
                  </button>
                  <button onClick={() => setRemovingId(null)} className="text-xs text-text-tertiary hover:text-text-secondary transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setRemovingId(emp.user_id)}
                  className="text-xs text-text-tertiary hover:text-error transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="card-static divide-y divide-border-subtle mt-4">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-text-primary">
              Pending Invites ({pendingInvites.length})
            </h2>
          </div>
          {pendingInvites.map((emp) => (
            <div key={emp.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-text-primary text-sm font-medium">{employeeLabel(emp)}</p>
                <p className="text-text-tertiary text-xs capitalize">{emp.role} — Invited {emp.invited_at ? new Date(emp.invited_at).toLocaleDateString() : '—'}</p>
              </div>
              <span className="text-xs text-warning font-medium">Pending</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
