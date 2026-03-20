#!/usr/bin/env bash
# install-hook.sh — installs a post-commit git hook into a target project that
# auto-syncs SPEC.md / PROJECT_TODO.md to the slack-tide dashboard on commit.
#
# Usage:
#   ./scripts/install-hook.sh /path/to/your/project
#   ./scripts/install-hook.sh          (defaults to current directory)
#
# The installed hook only fires when a file listed in .slack-tide.json
# (spec_files / todo_file) is part of the commit, so normal commits are untouched.

set -e

SLACK_TIDE_REPO="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-$(pwd)}"

# ── Validate target ──────────────────────────────────────────────────────────

if [ ! -d "$TARGET/.git" ]; then
  echo "❌ $TARGET is not a git repository"
  exit 1
fi

if [ ! -f "$TARGET/.slack-tide.json" ]; then
  echo "⚠️  No .slack-tide.json found in $TARGET"
  echo "   The hook will install but won't sync until .slack-tide.json exists."
  echo "   Create one with: { \"project_slug\": \"my-slug\", \"spec_files\": [\"SPEC.md\"], \"todo_file\": \"PROJECT_TODO.md\" }"
  echo ""
fi

# ── Handle existing post-commit hook ─────────────────────────────────────────

HOOK_DIR="$TARGET/.git/hooks"
HOOK_PATH="$HOOK_DIR/post-commit"

if [ -f "$HOOK_PATH" ]; then
  if grep -q "slack-tide sync" "$HOOK_PATH" 2>/dev/null; then
    echo "✅ slack-tide hook already installed at $HOOK_PATH"
    echo "   Updating baked-in repo path to: $SLACK_TIDE_REPO"
    # Re-install (overwrite) to refresh the baked-in path
  else
    echo "⚠️  Existing post-commit hook found that wasn't installed by slack-tide."
    echo "   Appending slack-tide sync block to it instead of overwriting."
    APPEND_MODE=true
  fi
fi

# ── Generate hook content ─────────────────────────────────────────────────────

HOOK_BLOCK=$(cat << HOOKEOF

# ── slack-tide sync ───────────────────────────────────────────────────────────
# Auto-syncs project docs to dashboard on commit.
# Installed by: $SLACK_TIDE_REPO/scripts/install-hook.sh
_SLACK_TIDE_REPO="\${SLACK_TIDE_REPO:-$SLACK_TIDE_REPO}"

if [ -f ".slack-tide.json" ] && [ -f "\$_SLACK_TIDE_REPO/scripts/sync-project.mjs" ]; then
  _CHANGED=\$(git diff-tree --no-commit-id -r --name-only HEAD 2>/dev/null)
  # Read watched filenames from .slack-tide.json so any spec/todo name works
  _WATCHED=\$(node -e "
    try {
      const c = JSON.parse(require('fs').readFileSync('.slack-tide.json','utf8'));
      const files = [...(c.spec_files||['SPEC.md']), c.todo_file||'PROJECT_TODO.md'];
      console.log(files.join('\n'));
    } catch(e) { console.log('SPEC.md\nPROJECT_TODO.md'); }
  " 2>/dev/null)
  _MATCH=false
  while IFS= read -r _FILE; do
    if echo "\$_CHANGED" | grep -qF "\$_FILE"; then
      _MATCH=true
      break
    fi
  done <<< "\$_WATCHED"
  if [ "\$_MATCH" = "true" ]; then
    _PROJECT_PATH="\$(pwd)"
    (cd "\$_SLACK_TIDE_REPO" && node scripts/sync-project.mjs "\$_PROJECT_PATH" > /tmp/slack-tide-sync.log 2>&1) &
    echo "⏳ slack-tide: syncing to dashboard... (tail /tmp/slack-tide-sync.log)"
  fi
fi
# ── end slack-tide sync ───────────────────────────────────────────────────────
HOOKEOF
)

if [ "${APPEND_MODE:-false}" = "true" ]; then
  echo "$HOOK_BLOCK" >> "$HOOK_PATH"
else
  printf '#!/usr/bin/env bash\n%s\n' "$HOOK_BLOCK" > "$HOOK_PATH"
fi

chmod +x "$HOOK_PATH"

# ── Done ──────────────────────────────────────────────────────────────────────

echo "✅ Hook installed: $HOOK_PATH"
echo "   Baked-in slack-tide path: $SLACK_TIDE_REPO"
echo ""
echo "   The hook fires automatically when SPEC.md or PROJECT_TODO.md are committed."
echo "   To override the slack-tide repo path at runtime:"
echo "     SLACK_TIDE_REPO=/other/path git commit ..."
echo ""
echo "   To test it manually:"
echo "     bash $HOOK_PATH"
