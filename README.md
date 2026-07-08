# DermIntel

DermIntel is an AI-powered personalized cosmetic ingredient analyzer built around a permanent skin passport. Users sign in with Google, complete a one-time onboarding questionnaire, and then receive profile-aware ingredient verdicts, warnings, and recommendations.

## Current Build

The repository now includes:

- A premium landing page with a Google OAuth entry point.
- A protected onboarding flow that saves the user's skin profile.
- A protected dashboard that uses the saved profile for ingredient analysis.
- Express API routes for auth, session restoration, and profile persistence.
- A PostgreSQL-ready Prisma schema for `User` and `Profile`.

## Project Structure

```text
frontend/   Next.js application for landing, auth callback, onboarding, and dashboard
backend/    Express API, OAuth flow, session logic, profile endpoints, and Prisma schema
```

## Environment Setup

Backend environment variables live in [backend/.env.example](C:/Users/Bravo%2015/Documents/DermIntel/backend/.env.example). For Google OAuth, configure:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `FRONTEND_URL`
- `JWT_SECRET`
- `DATABASE_URL`

Frontend can optionally use [frontend/.env.local.example](C:/Users/Bravo%2015/Documents/DermIntel/frontend/.env.local.example) to point at a custom API base URL.

## Next Steps

1. Install dependencies from the repo root with `npm install`.
2. Create the backend `.env` from the example and fill in Google OAuth + PostgreSQL values.
3. Run the backend with `npm run dev:backend`.
4. Run the frontend with `npm run dev:frontend`.

## Notes

- The frontend authentication flow stores the returned JWT in local storage and restores the session through `/api/auth/me`.
- The backend profile endpoint prevents duplicate profiles by storing one profile per authenticated user.
- The analysis engine now expects the saved onboarding profile shape when calculating personalized fit.
