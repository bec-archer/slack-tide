-- Add parent_project_id to support sub-projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS parent_project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

-- Index for fast child lookups
CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_project_id);
