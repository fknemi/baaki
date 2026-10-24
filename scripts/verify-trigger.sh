#!/usr/bin/env bash
# Verifies the append-only rule for the events table:
#   1. The application role (baaki_app) cannot UPDATE or DELETE events
#   2. The application role cannot disable the trigger
# Exit 0 on success, 1 on failure.

set -uo pipefail

DB="${DATABASE_URL_APP:-}"
if [ -z "$DB" ]; then
  DB=$(grep '^DATABASE_URL_APP=' .env.local 2>/dev/null | cut -d= -f2-)
fi
if [ -z "$DB" ]; then
  echo "❌ DATABASE_URL_APP not set and not found in .env.local"
  exit 1
fi

PSQL="psql $DB -t -A -v ON_ERROR_STOP=0"
pass=0; fail=0
ok() { echo "  ✅ $1"; pass=$((pass+1)); }
no() { echo "  ❌ $1"; fail=$((fail+1)); }

echo "=== Append-only events verification ==="
echo

# Get a real event to attempt to mutate
EVENT_SEQ=$(docker compose exec -T postgres psql -U postgres -d baaki -t -A -c \
  "SELECT seq FROM events LIMIT 1;" 2>/dev/null | tr -d ' ')
if [ -z "$EVENT_SEQ" ] || [ "$EVENT_SEQ" = "" ]; then
  echo "❌ No events found — seed the DB first with 'bun seed'"
  exit 1
fi
echo "Testing against event seq=$EVENT_SEQ"
echo

# 1. UPDATE must fail
echo "[1] Attempting UPDATE as baaki_app"
OUT=$($PSQL -c "UPDATE events SET payload = '{\"tampered\":true}'::jsonb WHERE seq = $EVENT_SEQ;" 2>&1)
echo "$OUT" | grep -qiE "permission denied|cannot update" && \
  ok "UPDATE refused" || no "UPDATE was NOT refused: $OUT"
echo

# 2. DELETE must fail
echo "[2] Attempting DELETE as baaki_app"
OUT=$($PSQL -c "DELETE FROM events WHERE seq = $EVENT_SEQ;" 2>&1)
echo "$OUT" | grep -qiE "permission denied|cannot delete" && \
  ok "DELETE refused" || no "DELETE was NOT refused: $OUT"
echo

# 3. ALTER TABLE ... DISABLE TRIGGER must fail
echo "[3] Attempting DISABLE TRIGGER as baaki_app"
OUT=$($PSQL -c "ALTER TABLE events DISABLE TRIGGER ALL;" 2>&1)
echo "$OUT" | grep -qiE "must be owner|permission denied" && \
  ok "DISABLE TRIGGER refused" || no "DISABLE TRIGGER succeeded: $OUT"
echo

# 4. INSERT still works (sanity)
echo "[4] INSERT must succeed"
OUT=$($PSQL -c "
INSERT INTO events (business_id, entity_type, entity_id, type, actor, at_iso, payload, prev_hash, hash, chain_seq)
SELECT business_id, entity_type, entity_id, 'TRIGGER_TEST', 'system',
       NOW(), '{}'::jsonb, 'x', 'test_hash_' || EXTRACT(EPOCH FROM NOW()),
       99999
FROM events WHERE seq = $EVENT_SEQ
RETURNING seq;" 2>&1)
echo "$OUT" | grep -qE "^[0-9]+$" && \
  ok "INSERT succeeded (returns seq)" || no "INSERT failed: $OUT"
echo

# Cleanup: we can't delete the test row (append-only), so note it.
echo "⚠ Test row left in events table (append-only). This is expected."
echo "   Run 'docker compose down -v && bun seed' to reset."

echo "════════════════════════════════════════"
echo "Result: $pass pass · $fail fail"
[ "$fail" -gt 0 ] && exit 1 || exit 0
