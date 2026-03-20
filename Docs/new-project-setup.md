# Setting Up Slack Tide Sync on a New Project

Quick reference for wiring a project repo into the Slack Tide dashboard.

---

## Prerequisites

- The project must already exist in the [Slack Tide dashboard](https://slack-tide.dev) before the first sync. Create it manually there first — the sync script upserts milestones and features but **does not create the project record itself**.
- Node.js must be available in the project repo's environment.
- The slack-tide repo must be cloned locally (assumed at `~/Developer/slack-tide`).

---

## Step 1 — Create `.slack-tide.json`

Add a `.slack-tide.json` file to the **repo root**. Note the dot prefix — the hook looks for the dotfile specifically. `slack-tide.json` (no dot) will not be found.

```json
{
  "project_slug": "your-slug",
  "spec_files": ["path/to/Spec.md"],
  "todo_file": "path/to/PROJECT_TODO.md"
}
```

- `project_slug` must match the slug in the dashboard exactly.
- `spec_files` is an array — supports multiple spec files for larger projects.
- Paths are relative to the repo root (e.g. `"docs/Punchlist_Spec.md"`).

---

## Step 2 — Install the git hook

Run the install script once, pointing it at the project repo:

```bash
~/Developer/slack-tide/scripts/install-hook.sh /path/to/your/project
```

This drops a `post-commit` hook into the project's `.git/hooks/`. If a `post-commit` hook already exists there for something else, the script appends to it rather than overwriting.

To reinstall or update the hook (e.g. after pulling a new version of the install script), just run the same command again.

---

## Step 3 — Trigger a sync

The hook only fires when a commit touches one of the files listed in `spec_files` or `todo_file`. Commits that don't touch those files are ignored entirely.

To trigger manually without making a real change:

```bash
git commit --allow-empty -m "chore: trigger slack-tide sync"
```

*(Touch the spec or TODO file instead if you'd rather not use empty commits.)*

---

## Checking sync status

The hook runs in the background so it doesn't block git. Check the log after committing:

```bash
cat /tmp/slack-tide-sync.log
```

Or watch it in real time:

```bash
tail -f /tmp/slack-tide-sync.log
```

---

## Manual sync (no hook)

You can also sync any time without committing, from the slack-tide repo:

```bash
cd ~/Developer/slack-tide
npm run sync /path/to/your/project

# Dry run (preview without writing to Supabase):
npm run sync /path/to/your/project --dry-run
```

---

## Gotchas

**`.slack-tide.json` vs `slack-tide.json`** — the dot prefix matters. The hook explicitly checks for `.slack-tide.json`. A file without the dot will be silently ignored and the hook will never fire.

**No log file after a commit** — means the hook ran but the trigger condition wasn't met. Either the committed files weren't in `spec_files`/`todo_file`, or `.slack-tide.json` wasn't found. Double-check both.

**Project slug mismatch** — if the slug in `.slack-tide.json` doesn't match what's in the dashboard, the sync will either create a duplicate project or fail. Verify the slug in the dashboard before first sync.

**Paths are relative to repo root** — `"docs/Punchlist_Spec.md"` not `"./docs/Punchlist_Spec.md"` and not an absolute path.
