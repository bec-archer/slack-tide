'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Project, Milestone, Feature, ScopeLogEntry } from '@/lib/dashboard-types'
import ProjectHeader from '@/components/dashboard/ProjectHeader'
import StatsRow from '@/components/dashboard/StatsRow'
import StatusBar from '@/components/dashboard/StatusBar'
import BurnUpChart from '@/components/dashboard/BurnUpChart'
import MilestoneCard from '@/components/dashboard/MilestoneCard'
import FeatureRow from '@/components/dashboard/FeatureRow'
import ScopeLogTimeline from '@/components/dashboard/ScopeLogTimeline'
import AddMilestoneForm from '@/components/dashboard/AddMilestoneForm'
import GitCommitFeed from '@/components/dashboard/GitCommitFeed'
import InfraHealth from '@/components/dashboard/InfraHealth'

const ADMIN_EMAIL = 'beckeeper78@gmail.com'

export default function ProjectDashboardPage() {
  const params = useParams()
  const slug = params.slug as string
  const { user } = useAuth()
  const isAdmin = user?.email === ADMIN_EMAIL

  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [scopeLog, setScopeLog] = useState<ScopeLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pulseKey, setPulseKey] = useState(0)
  const [apiLatency, setApiLatency] = useState<number | null>(null)
  const initialLoadDone = useRef(false)

  const fetchData = useCallback(async () => {
    const supabase = createBrowserClient()
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('slug', slug)
      .single()

    if (projectError || !projectData) {
      setError('Project not found')
      setLoading(false)
      return
    }

    setProject(projectData)

    const [milestonesRes, featuresRes, scopeLogRes] = await Promise.all([
      supabase.from('milestones').select('*').eq('project_id', projectData.id).order('sort_order').limit(200),
      supabase.from('features').select('*').eq('project_id', projectData.id).order('sort_order').limit(500),
      supabase
        .from('scope_log')
        .select('*')
        .eq('project_id', projectData.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    setMilestones(milestonesRes.data || [])
    setFeatures(featuresRes.data || [])
    setScopeLog(scopeLogRes.data || [])
    setLoading(false)

    // Pulse on realtime updates (not initial load)
    if (initialLoadDone.current) {
      setPulseKey((k) => k + 1)
    }
    initialLoadDone.current = true
  }, [slug])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!project) return
    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`dashboard-${project.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'milestones', filter: `project_id=eq.${project.id}` },
        fetchData
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'features', filter: `project_id=eq.${project.id}` },
        fetchData
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scope_log', filter: `project_id=eq.${project.id}` },
        fetchData
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [project, fetchData])

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-4 bg-bg-elevated rounded w-20 mb-6" />
        <div className="h-12 bg-bg-elevated rounded-lg w-2/3" />
        <div className="h-3 bg-bg-elevated rounded w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-bg-elevated rounded-xl" />
          ))}
        </div>
        <div className="h-48 bg-bg-elevated rounded-xl" />
        <div className="h-48 bg-bg-elevated rounded-xl" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="text-center py-16">
        <p className="text-error text-sm mb-4">{error || 'Project not found'}</p>
        <Link href="/dashboard" className="text-accent text-sm hover:underline">
          ← Back to projects
        </Link>
      </div>
    )
  }

  const sortedMilestones = [...milestones].sort((a, b) => a.sort_order - b.sort_order)
  const milestoneIds = new Set(milestones.map((m) => m.id))
  const unassignedFeatures = features.filter((f) => !f.milestone_id || !milestoneIds.has(f.milestone_id))

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-xs text-text-tertiary hover:text-accent transition-colors mb-4 inline-block"
        >
          ← All Projects
        </Link>
        <ProjectHeader
          project={project}
          features={features}
          isAdmin={isAdmin}
          onRefresh={fetchData}
        />
      </div>

      <div className="mb-6">
        <StatsRow features={features} createdAt={project.created_at} accentColor={project.color} pulseKey={pulseKey} apiLatency={apiLatency} />
      </div>

      <StatusBar features={features} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
        {/* Left column */}
        <div className="space-y-8">
          <BurnUpChart scopeLog={scopeLog} accentColor={project.color} />

          <section>
            <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-4">
              Milestones
            </h2>
            <div className="space-y-4">
              {sortedMilestones.length === 0 ? (
                <p className="text-text-tertiary text-sm">No milestones yet.</p>
              ) : (
                sortedMilestones.map((milestone) => (
                  <MilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    features={features.filter((f) => f.milestone_id === milestone.id)}
                    projectColor={project.color}
                    isAdmin={isAdmin}
                    onRefresh={fetchData}
                  />
                ))
              )}
              {isAdmin && (
                <AddMilestoneForm
                  projectId={project.id}
                  sortOrder={milestones.length}
                  onAdded={fetchData}
                />
              )}
              {unassignedFeatures.length > 0 && (
                <div className="card-static !p-0 overflow-hidden mt-4">
                  <div className="p-5 pb-3">
                    <h3 className="text-lg font-semibold text-text-secondary">Unassigned</h3>
                    <p className="text-xs text-text-tertiary mt-0.5">{unassignedFeatures.length} features not in a milestone</p>
                  </div>
                  <div className="border-t border-border-subtle px-3 py-2">
                    {unassignedFeatures.map((feature) => (
                      <FeatureRow
                        key={feature.id}
                        feature={feature}
                        isAdmin={isAdmin}
                        onRefresh={fetchData}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-4">
              Scope Log
            </h2>
            <div className="card-static">
              <ScopeLogTimeline entries={scopeLog} />
            </div>
          </section>
        </div>

        {/* Right column — sticky commit feed + infra health */}
        <div className="sticky top-6 hidden lg:flex flex-col gap-4">
          <InfraHealth accentColor={project.color} onLatencyUpdate={setApiLatency} />
          <GitCommitFeed accentColor={project.color} pulseKey={pulseKey} />
        </div>
      </div>
    </div>
  )
}
