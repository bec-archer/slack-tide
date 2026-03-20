# New Project → Dashboard Checklist

## 1. Add the project to Supabase

Go to [slack-tide.dev](https://slack-tide.dev) and click **+ New Project** on the dashboard. Fill in the slug (lowercase, hyphenated, e.g. `my-project`), display name, and status. Hit save. The project card will appear immediately — it'll just be empty until you sync.

> If it's a **sub-project** (e.g. QRSTKR iOS App), pick a parent project from the dropdown.

---

## 2. Set up the docs in the repo

In Cowork, with the project's repo folder selected, say:

> *"Set up tracking for [project name]"*

The **project-docs skill** will create three files in the repo root:
- `.slack-tide.json` — tells the sync script what to look for
- `SPEC.md` — milestones, features, out-of-scope
- `PROJECT_TODO.md` — current status of each feature (✅ / 🔧 / ⬜)

Fill these out (or have Cowork fill them out based on what you tell it about the project).

---

## 3. Sync to the dashboard

```bash
cd ~/Developer/slack-tide
npm run sync /path/to/your/new/project
```

For example:
```bash
npm run sync ~/Developer/my-new-project
```

That's it. The dashboard will update with the real milestone and feature data.

---

## 4. Keeping it up to date

Whenever you update `SPEC.md` or `PROJECT_TODO.md`, just run the same sync command again. It upserts — nothing gets deleted, statuses update in place.

> **Tip:** If something moved from out-of-scope to in-scope, update the SPEC.md first (add the feature), update the TODO status, then sync.

---

## Quick reference

| Thing | Where |
|---|---|
| Add/edit project card | slack-tide.dev → + New Project |
| Create initial docs | Cowork: "set up tracking for [project]" |
| Sync docs → dashboard | `cd ~/Developer/slack-tide && npm run sync /path/to/project` |
| Dashboard data lives in | slack-tide Supabase (vzluxlbzslyaswoybvzg) |
| Auth also lives in | slack-tide Supabase (same project) |

---

## Env vars the sync script needs (in `~/Developer/slack-tide/.env.local`)

```
SLACK_TIDE_SUPABASE_URL=https://vzluxlbzslyaswoybvzg.supabase.co
SLACK_TIDE_SUPABASE_SERVICE_KEY=<service role key from slack-tide Supabase → Settings → API → service_role>
```

These are already set up — just here for reference if you ever rebuild or move machines.
