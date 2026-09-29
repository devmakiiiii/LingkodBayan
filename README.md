# LingkodBayan

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/) [![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/) [![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel&logoColor=white)](https://vercel.com/)

> A civic services portal for connecting citizens with local government services.

LingkodBayan lets residents submit service requests, file complaints, track the status of their submissions, and read official announcements, while giving administrators a dashboard to manage residents, requests, complaints, and system content.

## Overview

**For citizens:** request services, file complaints, and monitor updates in one portal.

**For administrators:** manage submissions, residents, announcements, designations, and reports from a single dashboard.

## Features

- Citizen portal for service requests, complaints, announcements, and status tracking
- Admin dashboard for managing residents, requests, complaints, announcements, designations, and reports
- Role-based access with Supabase Auth and middleware redirects
- Row-level security-backed data access for resident and admin workflows
- Responsive UI built with Next.js, React, Tailwind CSS, and shadcn/ui components

## Tech Stack

- Next.js 16 with the App Router
- React 19
- TypeScript
- Supabase for database, authentication, and storage
- Tailwind CSS v4
- shadcn/ui components
- React Hook Form and Zod for form handling and validation
- Lucide React for icons

## Project Structure

```text
app/
  auth/                 Authentication pages
  admin/                Admin portal routes
  citizen/              Citizen portal routes
  layout.tsx            Root layout and metadata
  page.tsx              Landing page

components/
  admin/                Admin-specific UI components
  citizen/              Citizen-specific UI components
  request/              Request detail components
  ui/                   Shared UI primitives

lib/
  supabase/             Browser, server, and proxy Supabase clients
  db.ts                 Database helper functions
  schemas.ts            Validation schemas
  residents.ts          Resident profile helpers

scripts/
  *.sql                 Database setup and migration scripts
  migrate.js            Prints the SQL setup script for Supabase
```

## Prerequisites

- Node.js 18 or later
- pnpm
- A Supabase project

## Local Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Configure your local environment in `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   POSTGRES_URL=your_postgres_connection_string
   ```

3. Create the Supabase database schema:

   ```bash
   node scripts/migrate.js
   ```

   Copy the SQL output into the Supabase SQL Editor and run it. For the full setup flow, see [SETUP.md](SETUP.md).

   Then apply the numbered migrations in `scripts/` in ascending order. Migrations
   35-37 are required for identity verification and must be applied **before**
   deploying, because the OCR job store (`lib/verification-jobs.ts`) queries the
   `verification_ocr_jobs` table unconditionally:

   | Migration | Purpose | Skip if |
   |---|---|---|
   | `35_durable_ocr_jobs.sql` | Postgres-backed OCR job store, plus the `trg_prune_verification_ocr_jobs` trigger that reaps expired rows | Never — required for ID verification |
   | `36_verification_gate_requests.sql` | Requires a verified resident to file a service request | Never — the RLS gate |
   | `37_backfill_verification_claim.sql` | Backfills `verification_status` into `user_metadata` for pre-existing accounts | Only if the project has no verified residents yet |

   Migration 35's trigger matters: `verification_ocr_jobs` stores OCR output read
   off a resident's government ID, and the `expires_at` column on its own deletes
   nothing. Without the trigger those rows — and the PII in them — accumulate
   forever. Re-running 35 is safe; it drops and recreates the trigger.

   Migration 35 defines two functions. `prune_verification_ocr_jobs()` does the
   DELETE and returns VOID so it stays callable by hand via the SQL Editor's RPC
   panel; `trg_prune_verification_ocr_jobs()` returns TRIGGER and is what the
   trigger calls. The split is required — Postgres rejects a `CREATE TRIGGER`
   whose target returns anything other than `trigger` (error 42P17).

   Confirm the trigger is live with:

   ```bash
   node scripts/_check_prune_trigger.mjs
   ```

   Migration 36 gates **requests only**. Complaints are deliberately ungated, so
   a resident who has not verified can still file a complaint. The UX redirect in
   `middleware.ts` mirrors that scope (only `/citizen/request-service` and
   `/citizen/proxy-filing`) and treats any status outside
   `('auto_verified', 'id_verified')` as needing verification, so the redirect and
   the RLS policy cannot drift apart when a new status is added.

   Migration 37 writes to `auth.users`, which Supabase's GoTrue owns. It is
   idempotent and safe to re-run, but run it during a quiet period and run the
   commented verification query at the end of the file to confirm no admin lost
   its `role`.

4. Start the development server:

   ```bash
   pnpm dev
   ```

## Environment Variables

The app relies on the following environment variables:

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side admin access for privileged operations
- `POSTGRES_URL` - Database connection string used by the Supabase stack
- `SEMAPHORE_API_KEY` - (optional) Semaphore SMS gateway key; when set, resident events are also sent as SMS to the registered mobile number
- `SEMAPHORE_SENDERNAME` - (optional) SMS sender name, defaults to "LingkodBayan"

If you deploy on Vercel, add the same values in the project environment settings.

## Database Setup

LingkodBayan uses Supabase tables and row-level security to separate citizen and admin access. The database setup scripts create the main tables for residents, requests, complaints, announcements, admin users, and related support data.

For the full database walkthrough, including admin account setup and deployment notes, see [SETUP.md](SETUP.md) and [GETTING_STARTED.md](GETTING_STARTED.md).

## Running the App

- Development: `pnpm dev`
- Production build: `pnpm build`
- Production server: `pnpm start`

## Deployment

1. Push the repository to GitHub.
2. Connect the GitHub repo to Vercel.
3. Add the required Supabase environment variables in Vercel.
4. Deploy the app.

For a more detailed deployment guide, see [SETUP.md](SETUP.md).

## Testing Accounts

The setup docs include example citizen and admin workflows for validating the app after the database is configured. Follow [GETTING_STARTED.md](GETTING_STARTED.md) for the recommended onboarding flow.

## Troubleshooting

- If authentication fails, verify the Supabase environment variables and confirm the signup email template sends `{{ .Token }}` for the 6-digit code instead of `{{ .ConfirmationURL }}`.
- If the console reports `column <table>.<column> does not exist`, the project's schema predates the current code: run `node scripts/migrate.js`, execute the output in the Supabase SQL Editor, then verify with `node scripts/_check_schema.mjs`.
- If admin pages do not show records, confirm the Supabase migrations were applied and the admin role/user metadata is configured correctly.
- If the app cannot connect locally, reinstall dependencies and restart the dev server.

## More Documentation

- [SETUP.md](SETUP.md) - full database, auth, and deployment setup
- [GETTING_STARTED.md](GETTING_STARTED.md) - quick-start and feature walkthrough
