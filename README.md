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


## Geospatial Data Sources (WorldView Mode)

The dashboard can run fully in demo/mock mode, but you can enable live feeds with environment variables in `frontend/.env`.

### Required for richer live telemetry

- OpenSky OAuth client credentials
  - `REACT_APP_OPENSKY_CLIENT_ID`
  - `REACT_APP_OPENSKY_CLIENT_SECRET`
  - `REACT_APP_OPENSKY_TOKEN_URL`
  - optional: `REACT_APP_OPENSKY_BBOX` (`latMin,lonMin,latMax,lonMax`)
- CelesTrak source tuning (no key required in most cases)
  - `REACT_APP_CELESTRAK_BASE_URL`
  - `REACT_APP_CELESTRAK_GROUP`
  - `REACT_APP_CELESTRAK_FORMAT` (`json`, `csv`, `tle`)
- Traffic/OSM via Overpass (no key required in most cases)
  - `REACT_APP_STREET_TRAFFIC_API_URL`
  - optional: `REACT_APP_OVERPASS_API_URL`
- CCTV optional feed and webcam resolver
  - `REACT_APP_CCTV_API_URL`
  - optional: `REACT_APP_WINDY_WEBCAMS_KEY`

### Optional providers

- ADS-B Exchange (optional)
  - `REACT_APP_ADSB_EXCHANGE_URL`
  - `REACT_APP_ADSB_EXCHANGE_KEY`

### Notes

- Never commit real API secrets.
- If a live source is missing/unavailable, the app falls back to mock data.
- Public services such as OpenSky/Overpass/CelesTrak can enforce fair-use/rate limits.
- CelesTrak TLE/CSV/JSON parsing is implemented; true SGP4-grade orbital propagation can be added later if your environment allows `satellite.js`.

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
