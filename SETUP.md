# LingkodBayan - Civic Services Portal

A comprehensive platform connecting citizens with local government services, enabling easy submission of service requests, complaints, and access to community announcements.

## Project Overview

LingkodBayan provides two distinct interfaces:
- **Citizen Portal**: For residents to submit requests, file complaints, and view announcements
- **Admin Dashboard**: For government officials to manage requests, complaints, and residents

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Database**: Supabase (PostgreSQL with RLS)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Form Management**: React Hook Form with Zod validation
- **Icons**: Lucide React

## Color Scheme

- **Primary**: Green (#28A745) - LingkodBayan brand color
- **Neutrals**: White, grays, blacks
- **Accent**: Primary green with opacity variations

## Setup Instructions

### 1. Database Setup

The database schema includes these tables:
- `residents` - Citizen profiles linked to auth users
- `requests` - Service requests submitted by citizens
- `complaints` - Complaints filed with the government
- `announcements` - Official announcements for residents
- `admin_users` - Admin staff management

**To set up the database:**

1. Run: `node scripts/migrate.js`
2. Copy the displayed SQL script
3. Go to your Supabase dashboard
4. Navigate to SQL Editor
5. Create a new query
6. Paste the SQL script and execute

This will create all tables with proper Row Level Security (RLS) policies.

### 2. Environment Variables

The following environment variables are automatically configured by Supabase:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `POSTGRES_URL`
- Database credentials

### 3. Authentication Flow

**Citizen Sign-Up:**
1. New user creates account with first name, last name, email, password, and barangay
2. Supabase sends a 6-digit numeric verification code instead of a confirmation link
3. User enters the code on the verification page
4. Resident profile is created after the code is verified
5. User is assigned 'citizen' role
6. Redirects to citizen dashboard

**Supabase Email Template:**
1. Open your Supabase project dashboard
2. Go to Authentication -> Templates -> Confirm signup
3. Replace the confirmation-link variable with the token variable so the email sends a numeric code
4. Make sure the email body includes `{{ .Token }}` instead of `{{ .ConfirmationURL }}`

**Citizen Login:**
1. User logs in with email and password
2. Middleware checks role and redirects to `/citizen/dashboard`

**Admin Access:**
1. Currently, admin accounts must be created directly in Supabase
2. Set `role: 'admin'` in user metadata
3. Create corresponding `admin_users` profile
4. Login redirects admin to `/admin/dashboard`

## Project Structure

```
app/
├── (admin)/           # Admin portal routes
│   ├── dashboard/
│   ├── requests/
│   ├── complaints/
│   ├── residents/
│   └── announcements/
├── (citizen)/         # Citizen portal routes
│   ├── dashboard/
│   ├── my-requests/
│   ├── request-service/
│   ├── my-complaints/
│   ├── file-complaint/
│   └── announcements/
├── auth/              # Authentication routes
│   ├── login/
│   ├── sign-up/
│   └── callback/
├── layout.tsx         # Root layout
└── page.tsx           # Landing page

components/
├── citizen/
│   └── sidebar.tsx    # Citizen navigation
├── admin/
│   └── sidebar.tsx    # Admin navigation
└── ui/                # shadcn/ui components

lib/
├── supabase/
│   ├── client.ts      # Browser client
│   ├── server.ts      # Server client
│   └── proxy.ts       # Middleware helpers
├── schemas.ts         # Zod validation schemas
└── db.ts              # Database helper functions

middleware.ts         # Role-based routing middleware
```

## Key Features

### Citizen Portal
- **Dashboard**: Overview of requests and complaints with statistics
- **Submit Requests**: File service requests with categories (water, waste, repairs, etc.)
- **File Complaints**: Report issues to government officials
- **Track Status**: Real-time updates on all submissions
- **View Announcements**: Access official barangay announcements

### Admin Dashboard
- **Overview**: Statistics on requests, complaints, and residents
- **Manage Requests**: Update status (pending → in-progress → resolved)
- **Manage Complaints**: Track and resolve citizen complaints
- **Resident Management**: View all registered citizens
- **Create Announcements**: Publish updates to the community

## Security Features

1. **Row Level Security (RLS)**: Database policies ensure users can only access their own data
2. **Role-Based Access**: Middleware enforces separation between citizen and admin portals
3. **Authentication**: Supabase Auth with secure password hashing
4. **Session Management**: HTTP-only cookies for token storage
5. **Input Validation**: Zod schemas validate all user inputs

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Database Helpers

The `lib/db.ts` file provides helpful functions:

**Citizen Functions:**
- `getResident(userId)` - Get resident profile
- `createRequest(residentId, input)` - Submit service request
- `getResidentRequests(residentId)` - List user's requests
- `createComplaint(residentId, input)` - File complaint
- `getResidentComplaints(residentId)` - List user's complaints
- `getPublishedAnnouncements()` - Fetch announcements

**Admin Functions:**
- `getAllRequests()` - All service requests with resident info
- `getAllComplaints()` - All complaints with resident info
- `getAllResidents()` - All registered citizens
- `updateRequestStatus(id, status)` - Update request status
- `updateComplaintStatus(id, status)` - Update complaint status

## Creating Admin Accounts

To create an admin user:

1. Go to your Supabase project dashboard
2. Navigate to Authentication → Users
3. Create a new user with their email and password
4. Edit user metadata and add:
   ```json
   {
     "first_name": "John",
     "last_name": "Doe",
     "role": "admin"
   }
   ```
5. Go to SQL Editor and insert admin profile:
   ```sql
   INSERT INTO admin_users (user_id, first_name, last_name, email, role)
   VALUES ('[USER_ID]', 'John', 'Doe', 'john@example.com', 'staff');
   ```

## Deployment

### Vercel Deployment

```bash
# Push to GitHub
git add .
git commit -m "Deploy LingkodBayan"
git push

# On Vercel dashboard:
# 1. Connect your GitHub repository
# 2. Set environment variables from Supabase
# 3. Deploy
```

### Environment Variables for Production

Ensure these are set in Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Testing Accounts

After setting up the database:

**Test Citizen Account:**
- Email: `citizen@test.com`
- Password: `Test123!`

**Test Admin Account:**
1. Create via Supabase dashboard
2. Set role to 'admin' in metadata

## Troubleshooting

**"Auth.uid() failed" errors:**
- Ensure RLS policies are enabled on all tables
- Run the migration script again

**Resident profile creation fails:**
- Check that the user was created successfully
- Verify the 6-digit OTP was entered correctly and that the Supabase signup email template uses `{{ .Token }}`

**Admin redirect not working:**
- Confirm `role: 'admin'` is set in user metadata
- Check middleware.ts routing logic

**Database connection issues:**
- Verify Supabase credentials in .env.local
- Check Supabase project status

## Support

For issues or questions, please refer to:
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)

---

**LingkodBayan** - Connecting Citizens and Government Services
