# Aviao

Aviao is a React + Express + MongoDB application with a protected operator dashboard. It now includes:

- Local account creation and sign in
- Password hashing with Node's `crypto.scrypt`
- Database-backed session storage in MongoDB
- Optional Google OAuth and GitHub OAuth sign in

## Stack

- Frontend: React
- Backend: Express + Mongoose
- Database: MongoDB

## Quick Start

1. Start MongoDB locally.
2. Copy the example env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Install dependencies if needed:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

4. Run the app:

```bash
npm run dev
```

That starts the backend on `http://localhost:3003` and the frontend on `http://localhost:3004`.

## Authentication

The backend seeds one default local operator account on startup when MongoDB is available:

- Username: `operator`
- Password: `GodsEye2026!`

Change those defaults in [backend/.env.example](/Users/geisaangeli/aviao/backend/.env.example) before using the app outside local development.

Local accounts are stored in MongoDB with:

- `username`
- `email`
- `displayName`
- `passwordHash`
- linked auth providers
- active session tokens

Passwords are not stored in plain text.

## Google And GitHub Sign In

Google and GitHub buttons appear automatically when the backend has credentials configured.

Backend variables:

- `AUTH_GOOGLE_CLIENT_ID`
- `AUTH_GOOGLE_CLIENT_SECRET`
- `AUTH_GITHUB_CLIENT_ID`
- `AUTH_GITHUB_CLIENT_SECRET`
- `AUTH_BASE_URL`
- `FRONTEND_URL`
- `AUTH_STATE_SECRET`

For local development, make sure your OAuth apps use these callback URLs:

- Google: `http://localhost:3003/api/auth/oauth/google/callback`
- GitHub: `http://localhost:3003/api/auth/oauth/github/callback`

## Useful Paths

- [backend/src/services/authStore.js](/Users/geisaangeli/aviao/backend/src/services/authStore.js)
- [backend/src/models/user.js](/Users/geisaangeli/aviao/backend/src/models/user.js)
- [frontend/src/App.js](/Users/geisaangeli/aviao/frontend/src/App.js)
- [frontend/src/services/auth.js](/Users/geisaangeli/aviao/frontend/src/services/auth.js)
