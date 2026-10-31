# Production security activation

The repository now contains an opt-in authentication boundary. Keep AUTH_REQUIRED=false only for local demo mode. Before enabling it on Vercel:

1. Generate a random SECRET_KEY of at least 32 characters.
2. Generate one PBKDF2 password hash per real staff account:

   PYTHONPATH=backend .venv/bin/python -c "from app.security.auth import hash_password; print(hash_password('use-a-password-manager'))"

3. Set AUTH_USERS_JSON as a Vercel server-side variable. Example shape:

   {"alice":{"role":"pharmacist","password_hash":"pbkdf2_sha256$..."}}

4. Set AUTH_REQUIRED=true, APP_ENV=production, CORS_ORIGINS to exact internal origins, and a new server-side GEMINI_API_KEY if the copilot is enabled. Never use VITE_ variables for secrets.
5. Deploy a preview and verify unauthenticated API calls return 401, invalid credentials return 401, valid sessions can read permitted data, and role-restricted writes return 403.
6. Rotate any credential previously bundled in a frontend build.

The browser disable-devtool package is only a deterrent. It is not part of the authentication boundary and does not protect API endpoints.
