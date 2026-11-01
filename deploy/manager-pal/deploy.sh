#!/usr/bin/env bash
# DO NOT RUN without Tacanda's go-ahead. Deploys the minimal tree from build-minimal.sh.
# Requires: netlify CLI logged in + linked to the production site; firebase CLI logged in with access to clingnote-463b4.
set -euo pipefail
[ "${CONFIRM:-}" = "yes-deploy-manager-pal" ] || { echo "Refusing: set CONFIRM=yes-deploy-manager-pal"; exit 1; }
OUT=${OUT:-/workspace/clingNote-deploy}; cd "$OUT"
[ -n "${NETLIFY_SITE_ID:-}" ] || { echo "Set NETLIFY_SITE_ID (production site)"; exit 1; }
mkdir -p ../deploy-backup
# 0) Record what's live for rollback
netlify api getSite --data "{\"site_id\":\"$NETLIFY_SITE_ID\"}" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["published_deploy"]["id"])' > ../deploy-backup/netlify-previous-deploy-id.txt
echo "Previous Netlify deploy: $(cat ../deploy-backup/netlify-previous-deploy-id.txt)"
git show HEAD:firestore.rules > ../deploy-backup/firestore.rules.3e01cf8   # = rules file at prod main (also check Console > Rules history)
# 1) Netlify DRAFT deploy (build with the site's own env vars), then smoke test the draft URL
npm ci && (cd netlify/functions && npm ci)
netlify deploy --build --site "$NETLIFY_SITE_ID" --json > ../deploy-backup/draft.json
DRAFT_URL=$(python3 -c 'import json;print(json.load(open("../deploy-backup/draft.json"))["deploy_url"])'); DRAFT_ID=$(python3 -c 'import json;print(json.load(open("../deploy-backup/draft.json"))["deploy_id"])')
code=$(curl -s -o /dev/null -w '%{http_code}' "$DRAFT_URL/.netlify/functions/manager-pal?token=zztestnotarealtoken000000000000"); echo "draft GET bad token -> $code (expect 404)"; [ "$code" = 404 ]
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Authorization: Bearer x' -d '{"action":"managerList"}' "$DRAFT_URL/.netlify/functions/manager-pal"); echo "draft bad auth -> $code (expect 401)"; [ "$code" = 401 ]
# 2) Rules first (new collections only; existing rules unchanged), then publish the exact draft that was tested
firebase deploy --only firestore:rules --project clingnote-463b4
netlify api restoreSiteDeploy --data "{\"site_id\":\"$NETLIFY_SITE_ID\",\"deploy_id\":\"$DRAFT_ID\"}" >/dev/null
echo "Published deploy $DRAFT_ID. Rollback: see ROLLBACK in DEPLOY.md"
