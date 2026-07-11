# DevSecOps Guardrail — automated security suite

`security.js` is an end-to-end security regression that must pass before any
release. It drives the running app (real browser + real database) and asserts
the controls below. Run it against a live local stack:

```bash
node tests/security/security.js
```

It exits non-zero if any check fails.

## Coverage (16 areas)

| # | Area | What is asserted |
|---|---|---|
| 1 | Data isolation | Manager A cannot read/act on Manager B's deal (404); anonymous API read returns 0 rows (RLS) |
| 2 | Injection prevention | SQLi payload in deal fields is stored as literal text; tables intact (parameterised queries) |
| 3 | Brute-force defence | Rapid failed logins hit a 429 lockout (per-IP + per-email limiter on `/api/auth/login`) |
| 4 | Data exfiltration | Board shows only owner-scoped deals; no bulk cross-user leak |
| 5 | Authorization | Per-action role checks: Approver AI POST 403, non-Admin export 403, Admin export 200 |
| 6 | Secrets management | No server secrets in the client bundle; no real `.env` tracked; error paths carry no secrets |
| 7 | Session handling | Session cookie present, **httpOnly**, SameSite=Lax; logout clears it; server-side session establishment (rotation, no fixation) |
| 8 | Input validation / output encoding | XSS payload does not execute and renders escaped; non-UUID / oversized input rejected (400) |
| 9 | CSRF | Cross-origin POSTs to `/api/ai/*` and `/api/auth/login` refused (403) |
| 10 | Security headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy present; `X-Powered-By` removed |
| 11 | Dependency / supply chain | `bun audit` reports no known high/critical advisories |
| 12 | Logging & monitoring | Security-relevant events written to the immutable audit log; no secrets in metadata; exports self-logged |
| 13 | Error handling | Error responses expose no stack traces / DB / path internals; malformed input → clean 400 |
| 14 | File upload | No file-upload surface exists (nothing to exploit) |
| 15 | Backup / data integrity | `audit_events` immutable (no UPDATE/DELETE policy); authenticated user cannot tamper audit rows |
| 16 | Privacy & data minimisation | No sensitive PII columns; PDPA right-to-erasure (`eraseContactNotes`) redacts free-text notes, retains structured fields |

## Controls implemented (where)

- **Security headers / CSP / HSTS** — `next.config.ts`
- **Rate limiting, same-origin/CSRF, error sanitisation, CSV/filename hardening** — `lib/security.ts`
- **Server-side auth (httpOnly cookies, brute-force limits)** — `app/api/auth/login`, `app/api/auth/signup`, `lib/supabase/server.ts#hardenCookie`
- **Owner-scoped RLS + role helpers + immutable audit** — `supabase/migrations/0002_auth_roles_rls.sql`
- **Right-to-erasure** — `app/actions/contact.ts#eraseContactNotes`

## Infrastructure-level items (managed, not in app code)

- **Backup & recovery (15):** Supabase provides encrypted, access-controlled
  managed backups / point-in-time recovery. Restores are console/role-gated.
  The app-side guarantee tested here is audit immutability.
- **Data residency (privacy):** Supabase project hosted in-region
  (ap-southeast-1) per bank policy.
- **Rate limiting at scale:** the in-memory limiter is the per-instance app
  layer; for hard multi-instance guarantees back it with Upstash/Redis, and
  Supabase Auth enforces its own authoritative login throttling.
