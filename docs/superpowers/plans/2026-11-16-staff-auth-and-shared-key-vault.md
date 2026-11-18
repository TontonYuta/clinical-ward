# Staff Auth and Shared Key Vault Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with TDD. Each task must preserve unrelated dirty work.

**Goal:** Add persistent staff accounts and role authorization plus a shared encrypted API-key vault without replatforming clinical SQLite data.

**Architecture:** Use a dedicated async PostgreSQL identity store configured independently from clinical `DATABASE_URL`. Staff accounts link to existing staff profile identifiers, backend middleware enforces roles, and key vault operations use database transactions and application-layer encryption. Production activation remains gated on externally provisioned database and secrets.

**Tech Stack:** FastAPI, SQLAlchemy async, PostgreSQL (`asyncpg`), Argon2 password hashing, authenticated HttpOnly cookies, AES-GCM authenticated encryption, React/TypeScript monitor and clinical app.

**Spec:** `docs/superpowers/specs/2026-11-16-staff-auth-and-shared-key-vault-design.md`

## Global Constraints

- Never store or return a raw password or raw provider key outside trusted server operations.
- Do not use sample staff credentials in production bootstrap.
- Keep clinical operational data on the current database; identity PostgreSQL is a separate connection.
- No admin endpoint may rely on frontend-only visibility for authorization.
- Production auth must fail closed when required secrets or identity storage are missing.
- Preserve unrelated user changes in the working tree.

## Review Focus

- Anonymous or non-admin access to key management, tested at API level.
- Two independent monitor clients mutating vault records concurrently, tested against repository transactions.
- Missing/wrong encryption key or database connection, tested as startup/readiness failure.
- Disabled staff account or revoked session, tested as rejected authentication.
- Rotation/deletion while requests are reading active keys, tested for deterministic state.

---

### Task 1: Identity storage boundary and schema

**Files:**
- Create: `backend/app/identity_database.py`
- Create: `backend/app/models/identity.py`
- Modify: `backend/requirements.txt`
- Test: `backend/tests/test_identity_store.py`

**Interfaces:**
- Produces async identity session factory and identity models for `staff_profiles`, `staff_accounts`, `staff_role_grants`, `identity_sessions`, and `provider_api_keys`.
- Consumes `IDENTITY_DATABASE_URL`; does not replace clinical `DATABASE_URL`.

- [ ] Add tests proving separate DB URL selection, account-to-staff link constraints, role grants and key record uniqueness.
- [ ] Run focused tests and confirm the new identity interfaces are absent.
- [ ] Add the isolated async engine/session boundary and SQLAlchemy models.
- [ ] Run focused tests and verify clinical database configuration remains unchanged.

### Task 2: Password, session, and role authorization

**Files:**
- Modify: `backend/app/security/auth.py`
- Modify: `backend/app/main.py`
- Create: `backend/app/services/identity_service.py`
- Test: `backend/tests/test_identity_auth.py`

**Interfaces:**
- `authenticate_staff(username: str, password: str) -> AuthenticatedUser | None`
- `authorize_request(user, method, path) -> bool`
- Consumes identity session factory and role grants from Task 1.

- [ ] Test valid/invalid credentials, inactive account, role denial, expiry and revocation.
- [ ] Run tests and confirm identity-backed auth is missing.
- [ ] Implement Argon2 password verification, signed short-lived sessions, revocation checks and role enforcement.
- [ ] Verify admin endpoints reject anonymous/non-admin requests while ordinary staff access follows configured least privilege.

### Task 3: Identity bootstrap and migration tooling

**Files:**
- Create: `backend/scripts/bootstrap_identity_admin.py`
- Create: `backend/scripts/import_staff_profiles.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_identity_bootstrap.py`

**Interfaces:**
- Bootstrap reads credentials interactively or from a one-time protected input; it never prints password/hash/secret.
- Staff import maps approved profile fields and existing staff IDs; it excludes seeded PIN/RFID values from authentication.

- [ ] Test duplicate account, invalid role, missing profile and credential redaction.
- [ ] Implement explicit idempotent migrations/bootstrap without creating default production credentials.
- [ ] Verify app startup does not expose default/demo accounts as production logins.

### Task 4: Encrypted, shared provider key vault

**Files:**
- Create: `backend/app/security/secret_encryption.py`
- Modify: `backend/app/services/admin_key_vault.py`
- Modify: `backend/app/routers/admin_monitoring.py`
- Test: `backend/tests/test_shared_key_vault.py`

**Interfaces:**
- Vault CRUD, active-key selection, usage accounting, rotation and heartbeat use the identity database transaction layer.
- Raw key encryption uses an independent `KEY_ENCRYPTION_KEY`; responses contain only masked values.

- [ ] Test encryption round-trip, wrong/missing encryption key, concurrent add/delete/usage, active-key rotation and response masking.
- [ ] Implement database repository and transaction semantics; remove silent file-I/O failure behavior after migration path exists.
- [ ] Verify no key material enters logs or public response schema.

### Task 5: Login integration for monitor and clinical app

**Files:**
- Modify: `admin-portal/src/main.tsx`, `admin-portal/src/App.tsx`, `admin-portal/src/services/adminApi.ts`
- Modify: `src/main.tsx`, `src/security/AuthGate.tsx`
- Test: frontend auth service/component tests

- [ ] Test session restore, login, logout, expired session and denied role.
- [ ] Enable login UI and send credentialed same-origin requests; do not persist bearer tokens in local storage.
- [ ] Verify monitor admin screens require director/admin role and clinical UI reflects account profile/permissions.

### Task 6: Deployment and production verification

**Files:**
- Modify: `render.yaml`, deployment/security runbook, migration docs
- Verify: backend auth, key-vault, monitor and frontend test/build commands

- [ ] Document required `IDENTITY_DATABASE_URL`, `SECRET_KEY`, `KEY_ENCRYPTION_KEY`, initial administrator bootstrap and backup requirements.
- [ ] Configure only after the database and secrets exist; do not deploy a locked monitor without a verified admin login.
- [ ] Verify anonymous admin requests fail, authorized admin can manage keys, other roles cannot, data persists through redeploy, and multi-device views agree.
- [ ] Commit/push only this workstream after all deployment gates pass.
