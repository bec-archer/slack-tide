export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'
export type MilestoneStatus = 'planned' | 'in_progress' | 'completed'
export type FeatureStatus = 'planned' | 'in_progress' | 'done' | 'shipped' | 'cut'
export type FeaturePriority = 'low' | 'medium' | 'high' | 'critical'
export type ScopeLogAction = 'feature_added' | 'feature_cut' | 'feature_status_changed' | 'milestone_added' | 'milestone_completed' | 'project_created'

export interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  color: string
  status: ProjectStatus
  created_at: string
  updated_at: string
}

export interface Milestone {
  id: string
  project_id: string
  name: string
  description: string | null
  sort_order: number
  target_date: string | null
  status: MilestoneStatus
  created_at: string
  updated_at: string
}

export interface Feature {
  id: string
  milestone_id: string
  project_id: string
  name: string
  description: string | null
  status: FeatureStatus
  priority: FeaturePriority
  sort_order: number
  is_scope_creep: boolean
  created_at: string
  updated_at: string
}

export interface ScopeLogEntry {
  id: string
  project_id: string
  feature_id: string | null
  action: ScopeLogAction
  description: string | null
  old_value: string | null
  new_value: string | null
  created_at: string
}
