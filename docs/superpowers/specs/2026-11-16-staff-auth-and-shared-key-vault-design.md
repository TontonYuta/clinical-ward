# Staff Identity, Access Control, and Shared Key Vault

## Intent

Provide durable staff accounts with role-based backend authorization and make monitor API keys consistent across devices and Render instances. The previously selected persistence target is shared PostgreSQL.

## Current state

- `users` stores seeded staff profile fields and demo PIN/RFID values; it does not represent login accounts.
- `/auth/login` reads PBKDF2 hashes from `AUTH_USERS_JSON`; `AUTH_REQUIRED` defaults off.
- The clinical frontend `AuthGate` is commented out. The monitor has no login flow.
- Admin endpoints are currently reachable without authentication when `AUTH_REQUIRED=false`.
- API keys are stored in a JSON file inside the container; read/write errors are swallowed.
- Production currently uses SQLite at `/app/clinical_hospital.db`; changing the whole application's database to PostgreSQL would affect clinical data and is outside this design.

## Goals

- Use a persistent PostgreSQL database for staff login accounts and API key vault.
- Link accounts to staff profiles without using seeded demo PIN/RFID as passwords.
- Require authenticated sessions in production and enforce roles at backend endpoints.
- Give staff individual accounts and least-privilege access, with management reserved for authorized administrators.
- Encrypt provider secrets at rest with a key stored separately in deployment secrets; never return raw secrets to clients or logs.
- Preserve existing clinical SQLite database and workflows during initial rollout.
- Provide explicit migration/bootstrap behavior and avoid silently creating public admin accounts.

## Non-goals

- Replatform all clinical data from SQLite to PostgreSQL.
- Treat frontend route visibility as authorization.
- Use sample/seed staff identities as production credentials.
- Automatically provision paid hosting resources without an explicit cost decision.

## Architecture

Add an isolated async PostgreSQL store, configured by `IDENTITY_DATABASE_URL`, for staff accounts, account-role grants, sessions/revocation metadata, and encrypted API key vault. Keep the clinical app's current `DATABASE_URL` unchanged. Authentication resolves account -> staff profile reference and role grants; sensitive admin routes require an authenticated director/admin permission. The monitor and clinical frontend share the backend session service. The vault encrypts raw keys using an application encryption secret distinct from the database credentials.

## Security constraints

- Production auth is fail-closed: missing identity database, session signing secret, or encryption key prevents admin service startup/readiness.
- Passwords use a memory-hard password hash where available; existing PBKDF2 support can be retained only for controlled bootstrap compatibility.
- Session cookies are HttpOnly, Secure in production, SameSite, short-lived, and revocable.
- State-changing requests retain origin/CSRF protections.
- API key responses are masked; raw values are used only server-side.
- Audit account provisioning, role changes, login failures, key create/delete/activate/rotate events without recording secrets.
- Do not migrate the app to PostgreSQL until a separately reviewed data migration exists.

## Rollout

1. Add schema, migrations, service tests, and bootstrap tooling without changing production auth behavior.
2. Configure a PostgreSQL instance and deployment secrets; run schema/bootstrap and verify a named admin account.
3. Enable backend auth and monitor login first; verify access from multiple devices and confirm anonymous admin requests fail.
4. Enable the clinical app login after staff accounts and role mapping are validated.
5. Migrate any intended vault entries through an explicit operator-controlled path; verify encrypted-at-rest records and masked API responses.
6. Remove the JSON vault path after database parity and restore checks pass.

## Open deployment prerequisite

Production implementation cannot be activated until an identity PostgreSQL connection, session-signing secret, key-encryption secret, and an initial authorized administrator account are provisioned. No secrets or paid database resources are created by code changes alone.
