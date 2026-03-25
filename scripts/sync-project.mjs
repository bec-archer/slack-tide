#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// .env loader (minimal, no npm package)
// ---------------------------------------------------------------------------
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const lines = readFileSync(filePath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    // strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

// Load .env.local from the slack-tide repo root
const scriptDir = new URL('.', import.meta.url).pathname
const repoRoot = resolve(scriptDir, '..')
loadEnvFile(join(repoRoot, '.env.local'))

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const projectPath = resolve(args.find(a => !a.startsWith('--')) || process.cwd())

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.SLACK_TIDE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SLACK_TIDE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials.')
  console.error('Set SLACK_TIDE_SUPABASE_URL and SLACK_TIDE_SUPABASE_SERVICE_KEY as environment variables,')
  console.error('or ensure they exist in ~/Developer/slack-tide/.env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ---------------------------------------------------------------------------
// Read config
// ---------------------------------------------------------------------------
const configPath = join(projectPath, '.slack-tide.json')
if (!existsSync(configPath)) {
  console.error(`Missing .slack-tide.json in ${projectPath}`)
  console.error('')
  console.error('Create a .slack-tide.json with:')
  console.error(JSON.stringify({ project_slug: 'my-project', spec_files: ['SPEC.md'], todo_file: 'PROJECT_TODO.md' }, null, 2))
  process.exit(1)
}

const config = JSON.parse(readFileSync(configPath, 'utf-8'))
const specFiles = config.spec_files || ['SPEC.md']
const todoFile = config.todo_file || 'PROJECT_TODO.md'

// ---------------------------------------------------------------------------
// SPEC.md parser
// ---------------------------------------------------------------------------
function parseSpec(text) {
  const lines = text.split('\n')
  let projectName = null
  let projectSlug = null
  let projectStatus = 'active'
  const milestones = []
  let currentMilestone = null
  let inFeatures = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Project name from first H1
    if (!projectName && /^# /.test(trimmed)) {
      projectName = trimmed.replace(/^# /, '').replace(/\s*—\s*Spec$/i, '').trim()
      continue
    }

    // Slug
    const slugMatch = trimmed.match(/^\*\*Slug:\*\*\s*(.+)/)
    if (slugMatch) {
      projectSlug = slugMatch[1].trim()
      continue
    }

    // Project-level status (before any milestone)
    if (!currentMilestone) {
      const statusMatch = trimmed.match(/^\*\*Status:\*\*\s*(.+)/)
      if (statusMatch) {
        projectStatus = statusMatch[1].trim().toLowerCase()
        continue
      }
    }

    // Milestone header
    const milestoneMatch = trimmed.match(/^## Milestone:\s*(.+)/)
    if (milestoneMatch) {
      currentMilestone = {
        name: milestoneMatch[1].trim(),
        status: 'planned',
        target_date: null,
        features: [],
      }
      milestones.push(currentMilestone)
      inFeatures = false
      continue
    }

    // Other H2 — end current milestone context
    if (/^## /.test(trimmed) && !milestoneMatch) {
      currentMilestone = null
      inFeatures = false
      continue
    }

    if (!currentMilestone) continue

    // Milestone status
    const msStatusMatch = trimmed.match(/^\*\*Status:\*\*\s*(.+)/)
    if (msStatusMatch) {
      const raw = msStatusMatch[1].trim().toLowerCase()
      if (raw.includes('complete')) currentMilestone.status = 'completed'
      else if (raw.includes('progress')) currentMilestone.status = 'in_progress'
      else currentMilestone.status = 'planned'
      continue
    }

    // Milestone target
    const targetMatch = trimmed.match(/^\*\*Target:\*\*\s*(.+)/)
    if (targetMatch) {
      const rawDate = targetMatch[1].trim()
      currentMilestone.target_date = isNaN(new Date(rawDate).getTime()) ? null : rawDate
      continue
    }

    // Features heading
    if (/^### Features/i.test(trimmed)) {
      inFeatures = true
      continue
    }
    // Any other H3 ends features block
    if (/^### /.test(trimmed)) {
      inFeatures = false
      continue
    }

    // Feature lines
    if (inFeatures && /^- /.test(trimmed)) {
      const checkboxMatch = trimmed.match(/^- \[([ xX])\]\s*(.+)/)
      const plainMatch = !checkboxMatch && trimmed.match(/^- (.+)/)
      const fullText = checkboxMatch ? checkboxMatch[2].trim() : plainMatch ? plainMatch[1].trim() : null
      if (fullText) {
        const checked = checkboxMatch ? checkboxMatch[1].toLowerCase() === 'x' : false
        const sepIndex = fullText.indexOf(' — ')
        const name = sepIndex >= 0 ? fullText.slice(0, sepIndex).trim() : fullText
        const description = sepIndex >= 0 ? fullText.slice(sepIndex + 3).trim() : null
        currentMilestone.features.push({
          name,
          description,
          status: checked ? 'done' : 'planned',
        })
      }
    }
  }

  return { projectName, projectSlug, projectStatus, milestones }
}

// ---------------------------------------------------------------------------
// PROJECT_TODO.md parser
// ---------------------------------------------------------------------------
function parseTodo(text) {
  const lines = text.split('\n')
  const statusByMilestone = {} // { normalizedMilestoneName: { normalizedFeatureName: status } }
  const scopeChanges = []
  let currentSection = null
  let inScopeChanges = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip frontmatter
    if (trimmed === '---') continue
    if (/^(project|last_synced):/.test(trimmed)) continue

    // Section header
    const h2Match = trimmed.match(/^## (.+)/)
    if (h2Match) {
      const heading = h2Match[1].trim()
      if (/scope\s*changes/i.test(heading)) {
        inScopeChanges = true
        currentSection = null
        continue
      }
      inScopeChanges = false
      currentSection = normalizeName(heading)
      if (!statusByMilestone[currentSection]) statusByMilestone[currentSection] = {}
      continue
    }

    // Scope change entries
    if (inScopeChanges && /^- /.test(trimmed)) {
      const entry = trimmed.replace(/^- /, '').trim()
      const dateMatch = entry.match(/^(\d{4}-\d{2}-\d{2}):\s*(.+)/)
      scopeChanges.push({
        date: dateMatch ? dateMatch[1] : null,
        note: dateMatch ? dateMatch[2].trim() : entry,
      })
      continue
    }

    // Feature status lines
    if (currentSection && /^- /.test(trimmed)) {
      const statusMatch = trimmed.match(/^- (✅|🔧|⬜)\s*(.+)/)
      if (statusMatch) {
        const emoji = statusMatch[1]
        const featureName = normalizeName(statusMatch[2].trim())
        let status = 'planned'
        if (emoji === '✅') status = 'done'
        else if (emoji === '🔧') status = 'in_progress'
        statusByMilestone[currentSection][featureName] = status
      }
    }
  }

  return { statusByMilestone, scopeChanges }
}

function normalizeName(s) {
  // Strip leading milestone prefixes like "M1 - ", parenthetical descriptions,
  // lowercase, strip punctuation
  return s
    .replace(/^M\d+\s*[-–—]\s*/i, '')
    .replace(/\s*\(.*?\)/g, '')       // strip (parenthetical descriptions)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
}

// ---------------------------------------------------------------------------
// Main sync
// ---------------------------------------------------------------------------
async function main() {
  const prefix = dryRun ? '[DRY RUN] ' : ''

  // Read and parse SPEC files
  let specData = null
  for (const specFile of specFiles) {
    const specPath = join(projectPath, specFile)
    if (existsSync(specPath)) {
      const text = readFileSync(specPath, 'utf-8')
      specData = parseSpec(text)
      break
    }
  }

  if (!specData) {
    console.error(`No spec file found in ${projectPath}. Looked for: ${specFiles.join(', ')}`)
    process.exit(1)
  }

  const slug = specData.projectSlug || config.project_slug
  if (!slug) {
    console.error('No project slug found in SPEC.md or .slack-tide.json')
    process.exit(1)
  }

  // Read and parse TODO file (optional)
  let todoData = null
  const todoPath = join(projectPath, todoFile)
  if (existsSync(todoPath)) {
    todoData = parseTodo(readFileSync(todoPath, 'utf-8'))
  }

  console.log(`${prefix}🔄 Syncing: ${slug}`)

  // ---- Project upsert ----
  const projectRow = {
    slug,
    name: specData.projectName || slug,
    status: specData.projectStatus,
  }

  let projectId
  if (dryRun) {
    console.log(`   Project: would upsert ${JSON.stringify(projectRow)}`)
    // Fetch existing project id for dry-run milestone/feature display
    const { data: existing } = await supabase.from('projects').select('id').eq('slug', slug).single()
    projectId = existing?.id || '<new>'
  } else {
    const { data, error } = await supabase
      .from('projects')
      .upsert(projectRow, { onConflict: 'slug' })
      .select('id')
      .single()
    if (error) {
      console.error('   Project upsert failed:', error.message)
      process.exit(1)
    }
    projectId = data.id
    console.log('   Project: ✅ upserted')
  }

  // ---- Milestones upsert ----
  let milestoneCount = 0
  const milestoneIdMap = {} // name -> id

  for (const ms of specData.milestones) {
    const msRow = {
      project_id: projectId,
      name: ms.name,
      status: ms.status,
      target_date: ms.target_date,
    }

    if (dryRun) {
      console.log(`   Milestone: would upsert "${ms.name}" (${ms.status})`)
      const { data: existing } = await supabase
        .from('milestones')
        .select('id')
        .eq('project_id', projectId)
        .eq('name', ms.name)
        .single()
      milestoneIdMap[ms.name] = existing?.id || '<new>'
    } else {
      // Try update first, then insert (no native composite upsert in supabase-js)
      const { data: existing } = await supabase
        .from('milestones')
        .select('id')
        .eq('project_id', projectId)
        .eq('name', ms.name)
        .single()

      if (existing) {
        await supabase.from('milestones').update({ status: ms.status, target_date: ms.target_date }).eq('id', existing.id)
        milestoneIdMap[ms.name] = existing.id
      } else {
        const { data: inserted, error } = await supabase
          .from('milestones')
          .insert(msRow)
          .select('id')
          .single()
        if (error) {
          console.error(`   Milestone insert failed for "${ms.name}":`, error.message)
          continue
        }
        milestoneIdMap[ms.name] = inserted.id
      }
    }
    milestoneCount++
  }
  console.log(`   Milestones: ${milestoneCount} ${dryRun ? 'would be upserted' : 'upserted'}`)

  // ---- Features upsert ----
  let featureCount = 0
  const statusCounts = { done: 0, in_progress: 0, planned: 0 }

  for (const ms of specData.milestones) {
    const milestoneId = milestoneIdMap[ms.name]
    if (!milestoneId) continue
    // In non-dry-run mode, skip if milestone hasn't been created yet
    if (!dryRun && milestoneId === '<new>') continue

    const normalizedMs = normalizeName(ms.name)

    for (const feat of ms.features) {
      // Determine status: TODO file overrides spec checkbox
      let status = feat.status
      if (todoData?.statusByMilestone[normalizedMs]) {
        const todoStatus = todoData.statusByMilestone[normalizedMs][normalizeName(feat.name)]
        if (todoStatus) status = todoStatus
      }

      const featRow = {
        milestone_id: milestoneId,
        project_id: projectId,
        name: feat.name,
        description: feat.description,
        status,
      }

      if (dryRun) {
        console.log(`   Feature: would upsert "${feat.name}" (${status})`)
      } else {
        const { data: existing } = await supabase
          .from('features')
          .select('id')
          .eq('milestone_id', milestoneId)
          .eq('name', feat.name)
          .single()

        if (existing) {
          await supabase.from('features').update({ status, description: feat.description }).eq('id', existing.id)
        } else {
          const { error } = await supabase.from('features').insert(featRow)
          if (error) {
            console.error(`   Feature insert failed for "${feat.name}":`, error.message)
            continue
          }
        }
      }
      featureCount++
      statusCounts[status] = (statusCounts[status] || 0) + 1
    }
  }

  const statusSummary = Object.entries(statusCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ')
  if (dryRun) {
    console.log(`   Features: ${featureCount} would be upserted (${statusSummary})`)
  } else {
    console.log(`   Features: ${featureCount} upserted (${statusSummary})`)
  }

  // ---- Scope log ----
  let scopeCount = 0
  if (todoData?.scopeChanges.length) {
    for (const entry of todoData.scopeChanges) {
      if (dryRun) {
        console.log(`   Scope log: would add "${entry.note}"`)
        scopeCount++
        continue
      }

      // Check for duplicate
      const { data: existing } = await supabase
        .from('scope_log')
        .select('id')
        .eq('project_id', projectId)
        .eq('description', entry.note)
        .limit(1)

      if (existing && existing.length > 0) continue

      const logRow = {
        project_id: projectId,
        action: 'feature_added',
        description: entry.note,
      }
      const { error } = await supabase.from('scope_log').insert(logRow)
      if (error) {
        console.error(`   Scope log insert failed:`, error.message)
        continue
      }
      scopeCount++
    }
  }

  if (dryRun) {
    console.log(`   Scope log: ${scopeCount} entries would be added`)
  } else {
    console.log(`   Scope log: ${scopeCount} new entries added`)
  }

  console.log(`${prefix}✅ Done.`)
}

main().catch(err => {
  console.error('Sync failed:', err.message)
  process.exit(1)
})
