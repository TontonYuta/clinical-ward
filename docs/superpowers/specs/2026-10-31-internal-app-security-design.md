# Internal App Security Design

## Intent
Protect Clinical Ward as an internal web app by adding a deterrent against casual browser inspection and server-side authentication/authorization; prevent the UI role selector from being treated as identity.

## Goals
- Integrate disable-devtool for production browsers, exempt developer/test environments, and fail gracefully.
- Add server-issued expiring signed sessions and role checks for operational APIs.
- Never treat seeded demo users/PINs, client-selected role, or frontend secrets as authentication.

## Non-goals
- Claim DevTools can be reliably disabled.
- Deploy or alter production environment variables.
- Use static API secrets embedded in the frontend.

## Approaches
1. Frontend-only deterrent: leaves APIs open, insufficient.
2. Server-side sessions with real account provisioning and role authorization plus production-only deterrent: recommended, requires credential enrollment and login flow.
3. Shared API key embedded in frontend: rejected because users can extract it.

## Constraints and decisions
- Seeded PINs and role selection are not production credentials.
- Vercel currently copies SQLite to instance-local storage; auth must not depend on this for durable accounts.
- No identity provider is configured.
- User previously authorized autonomous choice, but supplied no real credentials or provider.

## Builder decision
Integrate the deterrent now. Do not activate production API enforcement with demo credentials or an embedded secret. Production readiness requires real identity provisioning, production secrets, and end-to-end verification.

## Implementation status and production blocker
The browser deterrent is implemented as a production-only dynamic import. An opt-in server authentication boundary, login UI, expiring HttpOnly session, origin checks, and role policy are implemented. It remains disabled until real accounts and deployment secrets are provisioned; seeded demo accounts are never accepted by the new login flow.
