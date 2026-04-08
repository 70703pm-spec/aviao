# Backend API

## Setup

1. Copy [backend/.env.example](/Users/geisaangeli/aviao/backend/.env.example) to `backend/.env`
2. Start MongoDB
3. Run:

```bash
npm install
npm start
```

## Auth Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/providers`
- `GET /api/auth/oauth/google`
- `GET /api/auth/oauth/github`
- `GET /api/auth/session`
- `POST /api/auth/logout`

## Request Shapes

`POST /api/auth/register`

```json
{
  "username": "flight-ops",
  "displayName": "Flight Operations",
  "email": "ops@example.com",
  "password": "password123"
}
```

`POST /api/auth/login`

```json
{
  "identifier": "flight-ops",
  "password": "password123"
}
```

You can also send an email in `identifier`.

## Notes

- Local passwords are stored as hashes.
- Sessions are stored on the user document in MongoDB.
- Google and GitHub login stay disabled until their client keys are configured.
