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
// Helper: find ' — ' separator OUTSIDE of parentheses
// Prevents splitting inside descriptions like "Feature (detail — note)"
// ---------------------------------------------------------------------------
function findDescSep(text) {
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') depth--
    else if (depth === 0 && text.slice(i, i + 3) === ' — ') return i
  }
  return -1
}

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
      let fullText = checkboxMatch ? checkboxMatch[2].trim() : plainMatch ? plainMatch[1].trim() : null
      if (fullText) {
        let checked = checkboxMatch ? checkboxMatch[1].toLowerCase() === 'x' : false

        // Handle emoji status prefixes (✅ = done, 🔧 = in_progress, ⬜ = planned/not started)
        // Strip them from the feature name so they don't pollute stored names.
        const emojiMatch = fullText.match(/^([✅🔧⬜])\s*(.+)/)
        if (emojiMatch) {
          if (emojiMatch[1] === '✅') checked = true
          fullText = emojiMatch[2].trim()
        }

        // Find ' — ' separator OUTSIDE of parentheses so that descriptions like
        // "Feature (detail — more detail)" don't get split at the wrong point,
        // which would leave a truncated unclosed '(' in the stored feature name.
        const sepIndex = findDescSep(fullText)
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
  const priorityByFeature = {} // { normalizedSectionName: { normalizedFeatureName: priority } }
  const sectionPriority = {}   // { normalizedSectionName: 'high' | 'low' | 'medium' }
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
      if (!priorityByFeature[currentSection]) priorityByFeature[currentSection] = {}
      continue
    }

    // Section-level priority from blockquote emojis:
    //   🚨 or 🚨🔒 → high  |  🔥 → high  |  🔽 → low
    if (currentSection && /^>/.test(trimmed)) {
      if (/🚨/.test(trimmed) || /🔥/.test(trimmed)) {
        sectionPriority[currentSection] = 'high'
      } else if (/🔽/.test(trimmed)) {
        sectionPriority[currentSection] = 'low'
      }
      continue
    }

    // Scope change entries
    // Supports both formats:
    //   - 2026-03-24: Feature name
    //   - ⬜ Feature name — *added 2026-03-24*
    //   - Feature name — *added 2026-03-24*
    if (inScopeChanges && /^- /.test(trimmed)) {
      let entry = trimmed.replace(/^- /, '').trim()
      // Strip leading status emoji (⬜/🔧/✅)
      entry = entry.replace(/^[⬜🔧✅]\s*/, '')
      // Try prefix date format: "2026-03-24: Feature name"
      const prefixDateMatch = entry.match(/^(\d{4}-\d{2}-\d{2}):\s*(.+)/)
      // Try suffix date format: "Feature name — *added 2026-03-24*"
      const suffixDateMatch = entry.match(/^(.+?)\s*—\s*\*added\s+(\d{4}-\d{2}-\d{2})\*$/)
      if (prefixDateMatch) {
        scopeChanges.push({
          date: prefixDateMatch[1],
          note: prefixDateMatch[2].trim(),
        })
      } else if (suffixDateMatch) {
        scopeChanges.push({
          date: suffixDateMatch[2],
          note: suffixDateMatch[1].trim(),
        })
      } else {
        scopeChanges.push({
          date: null,
          note: entry,
        })
      }
      continue
    }

    // Feature status lines
    if (currentSection && /^- /.test(trimmed)) {
      const statusMatch = trimmed.match(/^- (✅|🔧|⬜)\s*(.+)/)
      if (statusMatch) {
        const emoji = statusMatch[1]
        let featureText = statusMatch[2].trim()

        // Check for inline priority tag: *(low priority)* or *(high priority)*
        let featurePriority = null
        const priorityTagMatch = featureText.match(/\s*\*\((low|high)\s+priority\)\*\s*$/i)
        if (priorityTagMatch) {
          featurePriority = priorityTagMatch[1].toLowerCase()
          featureText = featureText.slice(0, -priorityTagMatch[0].length).trim()
        }

        // Strip ' — ' description suffix before normalizing, matching spec parser behavior.
        // Without this, TODO entries like "Feature (parens) — verbose description" normalize
        // to a longer string than the spec's "Feature (parens)" and the join fails.
        const descSep = findDescSep(featureText)
        const featureNameRaw = descSep >= 0 ? featureText.slice(0, descSep).trim() : featureText
        const featureName = normalizeName(featureNameRaw)
        let status = 'planned'
        if (emoji === '✅') status = 'done'
        else if (emoji === '🔧') status = 'in_progress'
        statusByMilestone[currentSection][featureName] = status

        if (featurePriority) {
          priorityByFeature[currentSection][featureName] = featurePriority
        }
      }
    }
  }

  return { statusByMilestone, priorityByFeature, sectionPriority, scopeChanges }
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

  // Read and parse ALL spec files, merging milestones from each.
  // The first file that exists provides the project name/slug/status;
  // subsequent files contribute their milestones. When the same milestone
  // name appears in multiple specs, the LATER occurrence wins (detail specs
  // like Strategy_Control_Reporting_Spec.md are listed after the system spec
  // and carry the authoritative status + feature list for their milestones).
  let specData = null
  for (const specFile of specFiles) {
    const specPath = join(projectPath, specFile)
    if (!existsSync(specPath)) continue
    const text = readFileSync(specPath, 'utf-8')
    const parsed = parseSpec(text)
    if (!specData) {
      specData = parsed
    } else {
      // Deduplicate: later file wins for same-named milestone
      for (const ms of parsed.milestones) {
        const existingIdx = specData.milestones.findIndex(
          m => m.name.toLowerCase() === ms.name.toLowerCase()
        )
        if (existingIdx >= 0) {
          specData.milestones[existingIdx] = ms
        } else {
          specData.milestones.push(ms)
        }
      }
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

  // Track which feature IDs were touched by this sync run so the reconcile
  // step at the end can delete anything that's no longer in the spec.
  const seenFeatureIds = new Set()

  // Build a set of normalized scope change names to flag is_scope_creep on features
  const scopeCreepNames = new Set(
    (todoData?.scopeChanges || []).map(sc => normalizeName(sc.note))
  )

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

      // Determine priority: per-feature tag > section blockquote > default "medium"
      let priority = 'medium'
      if (todoData) {
        if (todoData.sectionPriority[normalizedMs]) {
          priority = todoData.sectionPriority[normalizedMs]
        }
        const featPriority = todoData.priorityByFeature[normalizedMs]?.[normalizeName(feat.name)]
        if (featPriority) {
          priority = featPriority
        }
      }

      const isScopeCreep = scopeCreepNames.has(normalizeName(feat.name))

      const featRow = {
        milestone_id: milestoneId,
        project_id: projectId,
        name: feat.name,
        description: feat.description,
        status,
        priority,
        is_scope_creep: isScopeCreep,
      }

      if (dryRun) {
        const creepTag = isScopeCreep ? ' 🔀' : ''
        const prioTag = priority !== 'medium' ? ` [${priority}]` : ''
        console.log(`   Feature: would upsert "${feat.name}" (${status})${prioTag}${creepTag}`)
        // Dry-run also needs to know which features WOULD be touched so the
        // reconcile preview is accurate — look up the existing ID (if any)
        // without writing anything.
        if (milestoneId && milestoneId !== '<new>') {
          const { data: existingRows } = await supabase
            .from('features')
            .select('id')
            .eq('milestone_id', milestoneId)
            .eq('name', feat.name)
            .limit(1)
          if (existingRows?.[0]?.id) seenFeatureIds.add(existingRows[0].id)
        }
      } else {
        // Use .limit(2) instead of .single() so that if duplicates somehow exist,
        // we still find and update the first one rather than falling through to INSERT
        // (which is what caused the runaway duplicate bug — .single() returns null for 2+ rows).
        const { data: existingRows } = await supabase
          .from('features')
          .select('id, status')
          .eq('milestone_id', milestoneId)
          .eq('name', feat.name)
          .limit(2)
        const existing = existingRows?.[0] ?? null

        if (existing) {
          seenFeatureIds.add(existing.id)
          const oldStatus = existing.status
          await supabase.from('features').update({ status, priority, description: feat.description, is_scope_creep: isScopeCreep }).eq('id', existing.id)

          // Log status change to scope_log for burnup chart tracking
          if (oldStatus !== status) {
            const { error: logError } = await supabase.from('scope_log').insert({
              project_id: projectId,
              feature_id: existing.id,
              action: 'feature_status_changed',
              description: `Feature "${feat.name}": ${oldStatus} → ${status}`,
              old_value: oldStatus,
              new_value: status,
            })
            if (logError) {
              console.error(`   Scope log failed for "${feat.name}":`, logError.message)
            } else {
              console.log(`   📊 Status change logged: "${feat.name}" ${oldStatus} → ${status}`)
            }
          }
        } else {
          const { data: inserted, error } = await supabase.from('features').insert(featRow).select('id').single()
          if (error) {
            console.error(`   Feature insert failed for "${feat.name}":`, error.message)
            continue
          }
          if (inserted?.id) seenFeatureIds.add(inserted.id)

          // Log new feature to scope_log for burnup chart tracking
          const { error: logError } = await supabase.from('scope_log').insert({
            project_id: projectId,
            feature_id: inserted?.id || null,
            action: 'feature_added',
            description: `Feature added: "${feat.name}"`,
            old_value: null,
            new_value: status,
          })
          if (logError) {
            console.error(`   Scope log failed for new "${feat.name}":`, logError.message)
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

  // ---- Reconcile: delete milestones & features no longer in the spec ----
  // The sync is otherwise write-only — renames and removals accumulate as ghost
  // rows that show up on the dashboard forever. This step trims anything on
  // this project that wasn't touched by the current sync run.
  //
  // scope_log.feature_id has ON DELETE SET NULL, and features.milestone_id has
  // ON DELETE CASCADE, so deletions preserve burnup history and clean up
  // orphaned features automatically.
  const validMilestoneIds = new Set(Object.values(milestoneIdMap).filter(id => id && id !== '<new>'))

  // Orphan features: belong to a current milestone but weren't in the current spec
  const { data: allFeatures, error: listFeatErr } = await supabase
    .from('features')
    .select('id, name')
    .eq('project_id', projectId)
  if (listFeatErr) {
    console.error(`   Reconcile: could not list features:`, listFeatErr.message)
  } else {
    const orphanFeatures = (allFeatures || []).filter(f => !seenFeatureIds.has(f.id))
    if (orphanFeatures.length === 0) {
      console.log(`   Reconcile features: 0 orphans (clean ✨)`)
    } else if (dryRun) {
      console.log(`   Reconcile features: ${orphanFeatures.length} orphan(s) would be deleted`)
      for (const f of orphanFeatures) console.log(`     - "${f.name}"`)
    } else {
      const ids = orphanFeatures.map(f => f.id)
      const { error: delErr } = await supabase.from('features').delete().in('id', ids)
      if (delErr) {
        console.error(`   Reconcile features: delete failed:`, delErr.message)
      } else {
        console.log(`   Reconcile features: ${orphanFeatures.length} orphan(s) deleted`)
        for (const f of orphanFeatures) console.log(`     - "${f.name}"`)
      }
    }
  }

  // Orphan milestones: exist on this project but weren't in any current spec file
  const { data: allMilestones, error: listMsErr } = await supabase
    .from('milestones')
    .select('id, name')
    .eq('project_id', projectId)
  if (listMsErr) {
    console.error(`   Reconcile: could not list milestones:`, listMsErr.message)
  } else {
    const orphanMilestones = (allMilestones || []).filter(m => !validMilestoneIds.has(m.id))
    if (orphanMilestones.length === 0) {
      console.log(`   Reconcile milestones: 0 orphans (clean ✨)`)
    } else if (dryRun) {
      console.log(`   Reconcile milestones: ${orphanMilestones.length} orphan(s) would be deleted`)
      for (const m of orphanMilestones) console.log(`     - "${m.name}"`)
    } else {
      const ids = orphanMilestones.map(m => m.id)
      const { error: delErr } = await supabase.from('milestones').delete().in('id', ids)
      if (delErr) {
        console.error(`   Reconcile milestones: delete failed:`, delErr.message)
      } else {
        console.log(`   Reconcile milestones: ${orphanMilestones.length} orphan(s) deleted (features cascaded)`)
        for (const m of orphanMilestones) console.log(`     - "${m.name}"`)
      }
    }
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
