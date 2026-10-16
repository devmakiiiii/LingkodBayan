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

- Node.js 22 (CI runs on Node 22; `.ts` test files require it)
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

   **Migration 39 is a security fix and must be applied too.** It stops
   `public.is_admin_user()` — the function every admin RLS policy calls — from
   accepting a role out of `user_metadata`, which is writable by the signed-in
   account itself (`supabase.auth.updateUser({ data: { role: 'admin' } })`). Until
   it is applied, a resident can forge an admin claim and read or write admin-only
   tables through the browser client, even though `lib/roles.ts` already refuses
   that claim for middleware and the `/api/admin/*` handlers. The file first
   backfills `app_metadata.role` for admins that only ever had the role in
   `user_metadata`, then replaces both `is_admin_user()` and
   `is_super_admin_user()`. It is idempotent; run the commented verification
   queries at the end to confirm no admin lost access.

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

**Two-Environment Configuration**

LingkodBayan uses separate databases for production and testing environments:

**Development (.env.local):**
```env
NEXT_PUBLIC_SUPABASE_URL=your-dev-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-dev-service-key
```

**Testing (.env.test):**
```env
NEXT_PUBLIC_SUPABASE_URL=your-testing-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-testing-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-testing-service-key
```

**Production (.env.production or Vercel settings):**
```env
NEXT_PUBLIC_SUPABASE_URL=your-production-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-key
```

If you deploy on Vercel, add the same values in the project environment settings.

### Authorization roles

Role checks read `app_metadata.role` only, through the shared resolver in
`lib/roles.ts` (used by `middleware.ts`, `lib/auth.ts`, `lib/admin-auth.ts`, and
the `/api/admin/*` handlers). `user_metadata.role` is writable by the signed-in
account holder through `supabase.auth.updateUser()`, so it is never trusted for
authorization — a resident cannot promote themselves by editing it. Provision
admins with `node scripts/setup_admin_account.js` or by setting
`role: 'admin'` in **Raw App Meta Data** in the Supabase dashboard.

The database side of that rule lives in `public.is_admin_user()`, which every
admin RLS policy calls. Apply migration `39_harden_admin_authorization.sql` so
the SQL function also ignores `user_metadata`; without it, the browser client
(which talks to PostgREST directly, not through `lib/roles.ts`) would still act
on a forged claim.

Sign-up also refuses an email that already belongs to a registered resident
(`isEmailRegisteredToResident` in `lib/db.ts`), because Supabase's
`signInWithOtp` silently signs an existing account in rather than reporting
"already registered".

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

## Testing

```bash
pnpm test        # unit tests (lib/**/*.test.ts, node:test)
pnpm test:e2e    # Playwright E2E (e2e/*.spec.ts, Chromium)
```

E2E tests cover the public, no-backend surfaces (landing page, auth guards,
public tracking) and run in CI with placeholder Supabase credentials.
Authenticated specs (`e2e/citizen-flow.spec.ts` and the citizen-dashboard
accessibility scan in `e2e/accessibility.spec.ts`) self-skip unless a seeded
backend is provided via environment variables:

```bash
E2E_SEED_URL=https://<project>.supabase.co \
E2E_TEST_USER=<verified citizen email> \
E2E_TEST_PASSWORD=<password> \
pnpm test:e2e
```

The same variables can be added as GitHub repo secrets (`E2E_SEED_URL`,
`E2E_TEST_USER`, `E2E_TEST_PASSWORD`) to run these authenticated specs in CI;
without the secrets they self-skip and CI stays green.

The accessibility spec also runs an axe-core WCAG 2.1 AA scan (serious and
critical violations fail the build) on every public page and, when the seed
variables are present, the authenticated citizen dashboard.

## Testing Accounts

The setup docs include example citizen and admin workflows for validating the app after the database is configured. Follow [GETTING_STARTED.md](GETTING_STARTED.md) for the recommended onboarding flow.

## Two-Database Setup

### Production Database
Contains real citizen data and government services. Used for production deployment and live testing.

### Testing Database
Contains sample test data for development, CI/CD, and automated testing:

**Test Citizen Account:**
- Email: `citizen@test.com`
- Password: `Test123!`

**Test Admin Account:**
- Email: `admin@test.com`
- Set `role: 'admin'` in **Raw App Meta Data** (`app_metadata`) in Supabase dashboard
- Create corresponding `admin_users` profile

### Database Setup Commands

```bash
# Clone production schema for testing
pnpm db:migrate

# Seed testing database (requires TEST_ environment variables)
TEST_SUPABASE_URL=your-testing-url
TEST_SUPABASE_ANON_KEY=your-testing-key
TEST_SUPABASE_SERVICE_ROLE_KEY=your-testing-service-key
pnpm exec node scripts/seed-test-database.js

# Validate all environments
pnpm exec node scripts/validate-environments.js
```

### Environment-Specific Commands

```bash
# Development
pnpm dev

# Testing (for CI/CD)
NEXT_PUBLIC_SUPABASE_URL=$TEST_SUPABASE_URL \
NEXT_PUBLIC_SUPABASE_ANON_KEY=$TEST_SUPABASE_ANON_KEY \
pnpm dev

# Production deployment
pnpm build
pnpm start
```

### CI/CD Configuration

The CI pipeline automatically runs tests against the testing environment. Set these GitHub repository secrets:

**Testing Environment:**
- `SUPABASE_TEST_URL`
- `SUPABASE_TEST_ANON_KEY`
- `SUPABASE_TEST_SERVICE_ROLE_KEY`
- `E2E_SEED_URL`
- `E2E_TEST_USER`
- `E2E_TEST_PASSWORD`

**Production Environment:**
- `SUPABASE_PRODUCTION_URL`
- `SUPABASE_PRODUCTION_ANON_KEY`
- `SUPABASE_PRODUCTION_SERVICE_ROLE_KEY`

### Testing Workflows

1. **Unit Tests**: Run against testing environment
   ```bash
   pnpm test
   ```

2. **E2E Tests**: Use testing database for authenticated tests
   ```bash
   pnpm test:e2e
   ```

3. **E2E Tests with Seeded Data**: For authenticated citizen flow testing
   ```bash
   E2E_SEED_URL=$TEST_SUPABASE_URL \
   E2E_TEST_USER=citizen@test.com \
   E2E_TEST_PASSWORD=Test123! \
   pnpm test:e2e
   ```

4. **Production Tests**: Use production database (admin-only)
   ```bash
   pnpm test:e2e:production
   ```

## Database Migration Scripts

All migrations work with both environments. Use environment variables to target the desired database:

```bash
# Migrate testing database
pnpm db:setup:test

# Migrate production database
pnpm db:setup:prod
```

### Files Modified

- `package.json` - Added environment-specific scripts
- `env.config.ts` - New environment configuration system
- `lib/supabase/*` - Updated to use environment config
- `scripts/seed-test-database.js` - New script for test data seeding
- `scripts/validate-environments.js` - New script for environment validation
- `README.md` - Updated with two-environment setup instructions

## Troubleshooting

- If authentication fails, verify the Supabase environment variables and confirm the signup email template sends `{{ .Token }}` for the 6-digit code instead of `{{ .ConfirmationURL }}`.
- If the console reports `column <table>.<column> does not exist`, the project's schema predates the current code: run `node scripts/migrate.js`, execute the output in the Supabase SQL Editor, then verify with `node scripts/_check_schema.mjs`.
- If admin pages do not show records, confirm the Supabase migrations were applied and the admin role/user metadata is configured correctly.
- If the app cannot connect locally, reinstall dependencies and restart the dev server.

## More Documentation

- [SETUP.md](SETUP.md) - full database, auth, and deployment setup
- [GETTING_STARTED.md](GETTING_STARTED.md) - quick-start and feature walkthrough
