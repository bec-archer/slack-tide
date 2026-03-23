'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Project, Feature, Milestone } from '@/lib/dashboard-types'
import ProjectCard from '@/components/dashboard/ProjectCard'
import AddProjectForm from '@/components/dashboard/AddProjectForm'

const ADMIN_EMAIL = 'beckeeper78@gmail.com'

export default function DashboardPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = user?.email === ADMIN_EMAIL

  const fetchData = useCallback(async () => {
    const supabase = createBrowserClient()
    const [projectsRes, featuresRes, milestonesRes] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('features').select('id, project_id, status').limit(500),
      supabase.from('milestones').select('id, project_id').limit(200),
    ])
    if (projectsRes.error) {
      setError('Failed to load projects')
      setLoading(false)
      return
    }
    const allProjects = projectsRes.data || []
    console.log('[Dashboard] All projects from Supabase:', JSON.stringify(allProjects.map(p => ({ id: p.id, name: p.name, parent_project_id: p.parent_project_id }))))
    const topLevel = allProjects.filter((p: Project) => p.parent_project_id == null)
    console.log('[Dashboard] Top-level (parent_project_id == null):', topLevel.map((p: Project) => p.name))
    topLevel.forEach((parent: Project) => {
      const kids = allProjects.filter((p: Project) => p.parent_project_id === parent.id)
      console.log(`[Dashboard] Children of "${parent.name}" (id=${parent.id}):`, kids.map((p: Project) => p.name))
    })
    const orphans = allProjects.filter((p: Project) => p.parent_project_id != null && !topLevel.some((t: Project) => t.id === p.parent_project_id))
    if (orphans.length > 0) console.warn('[Dashboard] ORPHANED sub-projects (parent not in top-level):', orphans.map((p: Project) => ({ name: p.name, parent_project_id: p.parent_project_id })))
    setProjects(allProjects)
    setFeatures((featuresRes.data || []) as unknown as Feature[])
    setMilestones((milestonesRes.data || []) as unknown as Milestone[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel('dashboard-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-bg-elevated rounded-lg w-24" />
          <div className="h-8 bg-bg-elevated rounded-lg w-28" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-bg-elevated rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return <div className="text-error text-sm py-8 text-center">{error}</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Projects</h1>
        {isAdmin && <AddProjectForm onAdded={fetchData} />}
      </div>
      {projects.length === 0 ? (
        <p className="text-text-tertiary text-sm">No projects yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects
            .filter((p) => p.parent_project_id == null)
            .sort((a, b) => {
              const progress = (projectId: string) => {
                const f = features.filter((f) => f.project_id === projectId && f.status !== 'cut')
                if (f.length === 0) return 0
                return Math.round(f.filter((f) => f.status === 'done' || f.status === 'shipped').length / f.length * 100)
              }
              const pa = progress(a.id), pb = progress(b.id)
              if (pa === 100 && pb !== 100) return 1
              if (pa !== 100 && pb === 100) return -1
              return 0
            })
            .map((parent) => {
              const children = projects.filter((p) => p.parent_project_id === parent.id)
              const parentFeatures = features.filter(
                (f) => f.project_id === parent.id
              ) as Feature[]
              return (
                <div key={parent.id} className="space-y-2">
                  <ProjectCard
                    project={parent}
                    features={parentFeatures}
                    milestoneCount={milestones.filter((m) => m.project_id === parent.id).length}
                  />
                  {children.map((child) => (
                    <div key={child.id} className="pl-6 relative">
                      <span className="absolute left-1.5 top-4 text-text-tertiary text-sm select-none">↳</span>
                      <ProjectCard
                        project={child}
                        features={features.filter((f) => f.project_id === child.id) as Feature[]}
                        milestoneCount={milestones.filter((m) => m.project_id === child.id).length}
                        isSubProject
                      />
                    </div>
                  ))}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
