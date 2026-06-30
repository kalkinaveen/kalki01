# Auth Security Testing Playbook (Iter-31)

## SEC-001 — Admin password bcrypt hashing

Verify the on-disk admin doc no longer contains the plaintext `password` field:
```
mongosh
use test_database
db.admin.findOne({_id: "creds"}, {password:1, password_hash:1})
```
Expected: `password` is missing, `password_hash` starts with `$2b$12$`.

Functional test (curl):
```
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)
curl -s -X POST "$API/api/admin/login" -H 'Content-Type: application/json' -d '{"password":"admin123"}' -w "\nHTTP %{http_code}\n"
# → HTTP 200 { ok: true, token: "..." }
curl -s -X POST "$API/api/admin/login" -H 'Content-Type: application/json' -d '{"password":"bad"}' -w "\nHTTP %{http_code}\n"
# → HTTP 401 { detail: "Access denied" }
```

Brute-force lockout (5 wrong attempts → 429 for 15 min):
```
for i in 1 2 3 4 5 6; do
  curl -s -X POST "$API/api/admin/login" -H 'Content-Type: application/json' -d '{"password":"x"}' -w " | HTTP %{http_code}\n"
done
# Attempts 1–4 → 401, attempts 5+ → 429
# Correct password is ALSO blocked during lockout window
```

Reset lockout for the next test:
```
mongosh test_database --quiet --eval 'db.admin_login_attempts.deleteMany({})'
```

Change-password endpoint:
```
TOK=$(curl -s -X POST "$API/api/admin/login" -d '{"password":"admin123"}' -H 'Content-Type: application/json' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
# new password must be ≥ 8 chars
curl -s -X POST "$API/api/admin/password" -H "X-Admin-Token: $TOK" -H 'Content-Type: application/json' -d '{"new_password":"short"}' -w "\nHTTP %{http_code}\n"
# → HTTP 400
curl -s -X POST "$API/api/admin/password" -H "X-Admin-Token: $TOK" -H 'Content-Type: application/json' -d '{"new_password":"newSecure123"}' -w "\nHTTP %{http_code}\n"
# → HTTP 200 { ok: true }  ALSO invalidates all admin tokens
```

To reset back to `admin123` for testing, set `ADMIN_PASSWORD=admin123` + `ADMIN_PASSWORD_FORCE=1` in /app/backend/.env and restart backend.

## SEC-002 — CORS allow-list

CORS origins come from `CORS_ORIGINS` env (.env). Wildcards are stripped — explicit origins only.

Direct test against the backend (bypassing the K8s ingress which rewrites CORS):
```
curl -sI http://localhost:8001/api/config -H 'Origin: https://errorhacker.site' | grep -i access-control
# → access-control-allow-origin: https://errorhacker.site
# → access-control-allow-credentials: true

curl -sI http://localhost:8001/api/config -H 'Origin: https://evil.example.com' | grep -i access-control
# → only `access-control-allow-credentials: true` (no allow-origin — browser blocks request)
```

The K8s ingress in the preview environment may rewrite `Access-Control-Allow-Origin: *` on the public URL; that's a separate deployment-config layer. The FastAPI app itself enforces the allow-list correctly as shown above.

## Database collections

- `db.admin` — admin creds doc (`_id: "creds"`, `password_hash`, `tokens[]`)
- `db.admin_login_attempts` — per-IP brute-force counter (`_id: ip`, `fails`, `first_at`, `last_at`)
