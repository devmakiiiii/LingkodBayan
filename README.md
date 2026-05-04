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

- If authentication fails, verify the Supabase environment variables and email confirmation settings.
- If admin pages do not show records, confirm the Supabase migrations were applied and the admin role/user metadata is configured correctly.
- If the app cannot connect locally, reinstall dependencies and restart the dev server.

## More Documentation

- [SETUP.md](SETUP.md) - full database, auth, and deployment setup
- [GETTING_STARTED.md](GETTING_STARTED.md) - quick-start and feature walkthrough
