# Getting Started with LingkodBayan

Welcome to LingkodBayan! This guide will help you get the app up and running.

## What is LingkodBayan?

LingkodBayan is a civic services portal that connects citizens with their local government. It allows citizens to:
- Submit service requests (water, waste, street repairs, health, education)
- File complaints about government services
- Track the status of their submissions
- View official announcements

Administrators can:
- Manage incoming requests and complaints
- Update submission status
- View resident information
- Create and publish announcements

## Quick Start

### 1. **Set Up the Database**

First, you need to create the database tables in Supabase.

Run the migration script to see the SQL:
```bash
node scripts/migrate.js
```

This will output all the SQL statements needed. Copy the output and:
1. Go to your Supabase project dashboard (https://app.supabase.com)
2. Navigate to "SQL Editor" in the left sidebar
3. Click "New Query"
4. Paste the SQL script from the terminal
5. Click "Run" to execute

The database will now be set up with all tables and Row Level Security policies.

### 2. **Test the App**

The app is now running on http://localhost:3000

#### Test as a Citizen:
1. Click "Get Started" on the landing page
2. Sign up with your information:
   - First Name: Juan
   - Last Name: Dela Cruz
   - Email: juan@example.com
   - Barangay: Barangay 1
   - Password: anything (remember it!)
3. Confirm your email (check spam folder if needed)
4. Sign in with your email and password
5. You'll be redirected to the citizen dashboard where you can:
   - View statistics
   - Submit service requests
   - File complaints
   - Track submissions
   - View announcements

#### Test as an Admin:
To create an admin account, you need to manually set it up in Supabase:

1. Go to Supabase Dashboard → Authentication → Users
2. Create a new user with any email (e.g., admin@example.com)
3. Go to the "User Details" for that user
4. In the "Raw User Meta Data" section, add:
   ```json
   {
     "role": "admin",
     "first_name": "Admin",
     "last_name": "User"
   }
   ```
5. Sign in with that email
6. You'll be redirected to the admin dashboard where you can:
   - View all submissions
   - Manage requests and complaints
   - Update statuses
   - Create announcements
   - Manage residents

### 3. **Explore Features**

#### Citizen Features:
- **Dashboard**: See your stats and recent activity
- **Request Service**: Submit a new service request with category and description
- **My Requests**: Track all your submitted requests
- **File Complaint**: Report an issue or complaint
- **My Complaints**: Monitor complaint status
- **Announcements**: Read official government updates

#### Admin Features:
- **Dashboard**: Overview of all system activity
- **Manage Requests**: View all requests with resident info, update status
- **Manage Complaints**: Process and resolve complaints
- **Residents**: View all registered citizens
- **Announcements**: Create and publish public announcements

## Project Structure

```
app/
├── page.tsx                 # Landing page
├── auth/
│   ├── login/              # Login page
│   ├── sign-up/            # Registration page
│   ├── sign-up-success/    # Confirmation page
│   ├── error/              # Error page
│   └── callback/           # OAuth callback handler
├── citizen/                # Citizen portal
│   ├── layout.tsx          # Citizen sidebar layout
│   ├── dashboard/          # Dashboard
│   ├── my-requests/        # View requests
│   ├── request-service/    # Submit request
│   ├── my-complaints/      # View complaints
│   ├── file-complaint/     # Submit complaint
│   └── announcements/      # View announcements
└── admin/                  # Admin panel
    ├── layout.tsx          # Admin sidebar layout
    ├── dashboard/          # Admin overview
    ├── requests/           # Manage requests
    ├── complaints/         # Manage complaints
    ├── residents/          # Manage residents
    └── announcements/      # Create announcements

lib/
├── supabase/               # Supabase client setup
│   ├── client.ts           # Browser client
│   ├── server.ts           # Server client
│   └── proxy.ts            # Session handling
├── db.ts                   # Database helper functions
└── schemas.ts              # Validation schemas

components/
├── citizen/
│   └── sidebar.tsx         # Citizen navigation
└── admin/
    └── sidebar.tsx         # Admin navigation
```

## Environment Variables

The app requires these environment variables (set automatically by Vercel):
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

## Troubleshooting

### "Cannot find module" errors
- Run `pnpm install` to install all dependencies
- Restart the dev server with `pnpm dev`

### 404 on Sign Up Success page
- Make sure the database migration was run correctly
- Clear browser cache and reload

### Authentication not working
- Check that Supabase environment variables are set correctly
- Ensure email confirmation is enabled in Supabase
- Check browser console for detailed error messages

### Role-based redirect not working
- Make sure you set the `role` metadata correctly for admin users
- Middleware redirects based on `user.user_metadata.role`
- Citizens have `role: "citizen"`, Admins have `role: "admin"`

## Next Steps

1. **Customize branding**: Update colors in `app/globals.css`
2. **Add more features**: Extend the database schema in `scripts/01_create_schema.sql`
3. **Deploy**: Push to GitHub and deploy to Vercel with your Supabase credentials
4. **Notifications**: Consider adding email notifications for status updates

## Support

For issues or questions:
- Check the SETUP.md file for detailed database setup
- Review the code comments in components
- Check Supabase documentation for authentication help

Happy serving! 🚀
