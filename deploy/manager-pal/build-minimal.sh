#!/usr/bin/env bash
# Builds a MINIMAL deploy tree = production main (3e01cf8) + ONLY the Manager & Pal function and its rules.
# Safe: local only. Creates /workspace/clingNote-deploy (detached worktree) and commits nothing anywhere.
set -euo pipefail
REPO=$(cd "$(dirname "$0")/../.." && pwd); BASE=${BASE:-3e01cf8}; SRC=${SRC:-feat/manager-pal}; OUT=${OUT:-/workspace/clingNote-deploy}
cd "$REPO"
[ -e "$OUT" ] && git worktree remove --force "$OUT"
git worktree add --detach "$OUT" "$BASE"
# 1) function: new files only (no existing prod file is modified)
for f in netlify/functions/manager-pal.js netlify/functions/lib/managerPal.js netlify/functions/lib/cors.js; do git show "$SRC:$f" > "$OUT/$f"; done
# 2) netlify.toml: append only the manager-pal block
cat >> "$OUT/netlify.toml" <<'TOML'

# Manager & Pal (manager link + pal pairing + block/report). Uses the existing Firebase admin + OneSignal env vars; no new env vars.
[functions."manager-pal"]
included_files = ["netlify/functions/lib/**"]
external_node_modules = ["firebase-admin", "@opentelemetry/api"]
TOML
# 3) firestore.rules: production rules + the Manager & Pal block inserted before the final default-deny (nothing else changes)
python3 - "$OUT/firestore.rules" "$REPO/deploy/manager-pal/manager-pal.rules.snippet" <<'PY'
import sys; p, s = sys.argv[1], open(sys.argv[2]).read(); r = open(p).read()
m = '    // Default deny all other collections'; assert r.count(m) == 1, 'anchor'
open(p, 'w').write(r.replace(m, s + m))
PY
# 4) sanity: function loads against prod libs; unit tests pass in the minimal tree
git show "$SRC:scripts/test-manager-pal.js" > "$OUT/scripts/test-manager-pal.js"
(cd "$OUT" && node -e "require('./netlify/functions/manager-pal.js')" && node scripts/test-manager-pal.js && rm scripts/test-manager-pal.js)
echo; echo "== Changes vs $BASE (this is EVERYTHING the deploy changes) =="; (cd "$OUT" && git status --short && git diff --stat)
