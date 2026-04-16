# Slack Tide — Spec

**Status:** Active
**Slug:** slack-tide

## Milestone: M1 - Foundation

**Status:** Complete
**Target:** Q1 2026

### Features

- [x] Vercel deployment — get the app live
- [x] Auth — Supabase login working
- [x] Dashboard — project cards with feature counts
- [x] Burn-up chart — scope log visualization
- [x] Git feed — recent commits via GitHub API

## Milestone: M2 - Project Tracking

**Status:** In Progress
**Target:** Q2 2026

### Features

- [x] Sync script — push .md files to Supabase
- [ ] Sub-project support — parent/child project nesting
- [x] Git hook — auto-sync on commit
- [x] Sync reconciliation — sync-project.mjs now tracks every milestone and feature ID it touches each run, then deletes anything on the project that wasn't seen. Eliminates ghost "planned" rows from feature renames and obsolete milestones that used to accumulate forever. Cascade on `features.milestone_id` handles feature cleanup when milestones are dropped; `scope_log.feature_id` is ON DELETE SET NULL so burnup history is preserved. Dry-run does a read-only lookup to preview what would be deleted without writing.

## Scope Creep

- [x] Collapsible project cards — auto-collapse at 100%, manual toggle
- [x] Sort completed projects to bottom of dashboard

## Out of Scope

- Mobile app
