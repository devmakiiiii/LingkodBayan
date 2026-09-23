# Identity Verification System — Implementation Plan

## Context & Current State

LingkodBayan is a Next.js 16 App Router project using Supabase (PostgreSQL + Auth + Storage), TypeScript, Tailwind CSS, and shadcn/ui. The existing auth flow is OTP-based:

1. User fills sign-up form (email, password, first/last name, barangay, phone, address)
2. Supabase sends a 6-digit OTP via email
3. User enters OTP → `getOrCreateResidentProfile()` creates a `residents` row
4. User metadata includes `role: 'citizen'`
5. User is redirected to `/citizen/dashboard`

The `residents` table currently has: `id`, `user_id` (FK→auth.users), `first_name`, `last_name`, `email`, `phone`, `address`, `barangay`, `created_at`, `updated_at`. RLS policies restrict each resident to their own data; admins can view all.

**There is no pre-registration table, no verification status tracking, and no OCR/ID-reading capability today.** This plan adds all three.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Pre-saved data source | New `pre_registered_residents` table, populated via admin CSV upload or Supabase Edge Function webhook from an external government DB | Keeps pre-saved data separate from authenticated residents until verified; supports both manual import and automated sync |
| Verification gate | Block access to `/citizen/*` routes until `verification_status` is `verified` | Prevents unverified users from interacting with civic services |
| Matching algorithm | Server-side fuzzy matching: Levenshtein + phonetic (Double Metaphone) + weighted field scoring | Names have typos/variations; a pure exact-match approach produces too many false negatives |
| ID document OCR | Self-hosted Tesseract.js via a Next.js server action/API route, with optional cloud fallback (Google Vision if `GOOGLE_VISION_API_KEY` env is set) | No per-verification cost; cloud fallback available when accuracy is critical |
| Verification status values | `unverified`, `auto_verified`, `id_verified`, `needs_review`, `rejected` | Maps to the three pathways in the user's spec (auto-match, OCR-match, fallback) plus a rejected state |

---

## Data Model

### New Table: `pre_registered_residents`

```sql
CREATE TABLE IF NOT EXISTS public.pre_registered_residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Core identity fields
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  date_of_birth DATE,
  email TEXT NOT NULL,
  phone TEXT,
  -- Address fields
  street_address TEXT,
  barangay TEXT NOT NULL,
  city_municipality TEXT,
  province TEXT DEFAULT 'Metro Manila',
  postal_code TEXT,
  -- Government ID reference
  national_id TEXT,            -- e.g., PhilSys 12-digit number
  id_type TEXT CHECK (id_type IN ('philsys', 'drivers_license', 'passport', 'voter', 'sss', 'tin', 'umid')),
  -- Source tracking
  source TEXT NOT NULL DEFAULT 'manual',  -- 'csv_upload', 'government_sync', 'manual'
  import_batch_id TEXT,
  -- Metadata
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Indexes for fast lookup
  CONSTRAINT pre_registered_residents_email_unique UNIQUE (email)
);

-- Indexes for matching performance
CREATE INDEX IF NOT EXISTS idx_pre_reg_residents_name ON public.pre_registered_residents (first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_pre_reg_residents_phone ON public.pre_registered_residents (phone);
CREATE INDEX IF NOT EXISTS idx_pre_reg_residents_national_id ON public.pre_registered_residents (national_id);
```

### Modified Table: `residents` — add verification columns

```sql
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS verification_status TEXT
    DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'auto_verified', 'id_verified', 'needs_review', 'rejected')),
  ADD COLUMN IF NOT EXISTS verification_method TEXT
    CHECK (verification_method IN ('form_match', 'id_ocr', 'manual', 'admin_override')),
  ADD COLUMN IF NOT EXISTS verification_confidence NUMERIC(5,2) CHECK (verification_confidence >= 0 AND verification_confidence <= 100),
  ADD COLUMN IF NOT EXISTS verification_details JSONB,
  ADD COLUMN IF NOT EXISTS id_document_type TEXT,
  ADD COLUMN IF NOT EXISTS id_document_url TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_residents_verification_status ON public.residents (verification_status);
```

### New Table: `verification_attempts` (audit log)

```sql
CREATE TABLE IF NOT EXISTS public.verification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('form_match', 'id_ocr', 'manual_review')),
  input_data JSONB,            -- What the user submitted
  matched_pre_registered_id UUID REFERENCES public.pre_registered_residents(id),
  match_score NUMERIC(5,2),
  confidence_breakdown JSONB,  -- Per-field scores for debugging
  ocr_extracted_data JSONB,    -- Raw OCR output
  status TEXT NOT NULL CHECK (status IN ('matched', 'no_match', 'needs_review', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_attempts_resident ON public.verification_attempts (resident_id);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_status ON public.verification_attempts (status);
```

### New Table: `verification_settings` (threshold config)

```sql
-- Store in system_settings table (already exists) under key 'verification_thresholds'
-- Example value JSON:
{
  "auto_verify_threshold": 85,
  "id_verify_threshold": 75,
  "manual_review_threshold": 50,
  "name_weight": 0.40,
  "email_weight": 0.25,
  "phone_weight": 0.15,
  "address_weight": 0.20,
  "dob_weight": 0.10
}
```

---

## Example: Pre-saved Resident Data Structure (JSON)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "first_name": "Juan",
  "last_name": "Dela Cruz",
  "middle_name": "Santos",
  "date_of_birth": "1985-03-15",
  "email": "juan.dela.cruz@example.com",
  "phone": "+639171234567",
  "street_address": "Block 10 Lot 5, Greenhills Subdivision",
  "barangay": "Barangay San Antonio",
  "city_municipality": "Quezon City",
  "province": "Metro Manila",
  "postal_code": "1112",
  "national_id": "123456789012",
  "id_type": "philsys",
  "source": "csv_upload",
  "import_batch_id": "batch_2025_001",
  "is_verified": true,
  "verified_at": "2025-06-15T08:30:00Z",
  "created_at": "2025-06-10T14:22:33Z",
  "updated_at": "2025-06-15T08:30:00Z"
}
```

---

## Matching Logic Architecture

### Endpoint: `app/api/verification/match/route.ts`

**Input** (POST body): The sign-up form fields (first_name, last_name, middle_name, email, phone, address line-by-line or combined, barangay, date_of_birth, national_id).

**Algorithm:**

```
1. Normalize all string inputs:
   - lowercase, trim, collapse whitespace
   - strip punctuation
   - replace common abbreviations (St. → Saint, etc.)

2. Query pre_registered_residents with indexed lookups first:
   a. EXACT match on email OR phone OR national_id → score = 100 (auto-verify candidate)
   b. Phonetic + fuzzy match on first_name + last_name → score = Levenshtein similarity

3. Weighted scoring per candidate:
   - Name (Double Metaphone + Levenshtein): weight 40%
   - Email exact match: weight 25%
   - Phone normalized match: weight 15%
   - Address partial match: weight 15%
   - Date of birth exact match: weight 5%

4. Take the highest-scoring candidate:
   - score >= auto_verify_threshold (default 85) → auto_verified
   - score >= id_verify_threshold (default 75) → id_verified (still needs ID upload)
   - score >= manual_review_threshold (default 50) → needs_review
   - score < manual_review_threshold → no_match

5. Log attempt to verification_attempts table.
6. Return { match: boolean, confidence: number, matched_resident: {...}, action: 'auto_verify' | 'id_verify' | 'needs_review' | 'no_match' }
```

**Implementation details:**
- Use a server-side API route with `createAdminClient()` (service role bypasses RLS, needed to read `pre_registered_residents`).
- Use a lightweight fuzzy matching library. Check `package.json` — if none exists, add `fast-levenshtein` (tiny, no deps). For phonetic matching, use `nysiis` or implement Double Metaphone inline.
- The `national_id` field gives the strongest signal and should be the primary exact-match key for Philippine IDs.
- **Do not** perform this matching client-side — it would expose the entire pre-registered roster via RLS bypass or leak data.

### Workflow Integration Point

In the sign-up flow (`/app/auth/sign-up/page.tsx`), after the user submits the form but **before** calling `supabase.auth.signInWithOtp`:

1. Call `/api/verification/match` with the form data.
2. If `action === 'auto_verify'`: proceed with Supabase sign-up as normal. After OTP verification and `getOrCreateResidentProfile`, automatically set `verification_status = 'auto_verified'` in the `residents` table.
3. If `action === 'id_verify'` or `action === 'needs_review'`: proceed with sign-up but redirect to an ID-upload step instead of the dashboard.
4. If `action === 'no_match'`: show an error and offer an admin contact form.

---

## ID Reading (OCR) Architecture

### Storage Bucket: `id-documents`

Follow the existing `evidence` bucket pattern from `app/api/citizen/evidence/route.ts`:

```sql
-- Supabase SQL to create the bucket (or use storage API)
-- Bucket: id-documents
-- Public: false (private — PII)
-- Allowed MIME types: image/jpeg, image/png, image/webp
-- File size limit: 5MB
```

### Endpoint: `app/api/verification/upload-id/route.ts`

1. Authenticate user via `createServerClient` + `request.cookies`.
2. Validate file type and size (same logic as evidence upload).
3. Upload to `id-documents` bucket with path `id-documents/{userId}/{timestamp}-{uuid}.ext` — private.
4. Return the storage path (not the public URL, since docs are private).
5. Immediately enqueue OCR processing by calling `POST /api/verification/process-id`.

### Endpoint: `app/api/verification/process-id/route.ts`

1. Receives the storage path + resident_id + expected values (from pre-registered match).
2. Downloads the image from Supabase Storage (`createAdminClient()`).
3. Runs OCR:
   - **Primary (default):** Tesseract.js (`tesseract.js` npm package) — self-hosted, no external API key needed. Good enough for PH government ID templates.
   - **Fallback (if `GOOGLE_VISION_API_KEY` env var is set):** Google Cloud Vision TEXT_DETECTION API.
4. Parses structured fields from OCR output:
   - For PhilSys: look for "PhilSys ID No.", "Family Name", "Given Name", "Middle Name", "Date of Birth", "Address"
   - For Driver's License: "LAST NAME", "FIRST NAME", "MIDDLE NAME", "BIRTHDATE", "ADDRESS"
   - Template-based regex parsing per `id_type`
5. Runs the same fuzzy matching algorithm against the pre-registered data.
6. Stores OCR results in `verification_attempts` (`ocr_extracted_data`, `matched_pre_registered_id`, `match_score`).
7. Updates `residents` table: set `id_document_url`, `id_document_type`, `verification_status`, `verification_confidence`, `verification_method = 'id_ocr'`, `verified_at = NOW()`.
8. Returns the match result to the frontend.

### Frontend: ID Upload UI

New page at `/auth/verify-id` (or a modal step in the sign-up flow):
- File picker for ID image
- Preview thumbnail
- Progress indicator ("Processing...")
- Result display: "Verified" / "Requires manual review" with confidence %

---

## Workflow Improvements

### 1. Verification Status Gate in Middleware

Modify `middleware.ts` to redirect unverified residents away from `/citizen/*` to a verification-required page:

```typescript
// In the "user is logged in" branch of middleware.ts
if (user && userRole === 'citizen') {
  const resident = await getResident(user.id) // fetch from DB
  if (resident?.verification_status !== 'verified' && pathname.startsWith('/citizen')) {
    // Allow access to /citizen/verify-* and /auth/* only
    if (!pathname.startsWith('/citizen/verify')) {
      const url = request.nextUrl.clone()
      url.pathname = '/citizen/verify-id'
      return NextResponse.redirect(url)
    }
  }
}
```

**Implementation note:** The current `middleware.ts` does not fetch resident data. This requires either a Supabase RPC call (expensive per-request) or a lightweight DB query. Consider caching the verification status in a cookie or JWT claim after the initial check — see "Performance Considerations" below.

### 2. Admin Review Queue

New admin page `/admin/verification` (or `/admin/identity-verification`):
- Table of residents with `verification_status IN ('needs_review', 'rejected')`
- Columns: name, email, match score, verification method, attempt type, OCR extracted data (JSON preview)
- Actions: Approve (set `auto_verified` or `id_verified`), Reject (set `rejected`, reason)
- Each row links to a detail view showing the ID document (private URL via signed URL)

### 3. Confidence Threshold Configuration

Add to the existing `system_settings` table (already used for barangay info, mission/vision, etc.):
- Key: `verification_thresholds`
- Value: JSON with `auto_verify_threshold`, `id_verify_threshold`, `manual_review_threshold`, field weights

Admin settings UI under `/admin/settings` can edit these via the existing `updateSystemSetting` helper in `lib/db.ts`.

### 4. Sign-up Form Enhancements

Modify `/app/auth/sign-up/page.tsx`:
- Add `middle_name`, `date_of_birth`, `national_id` fields
- Add `id_type` dropdown (PhilSys, Driver's License, Passport, Voter's ID, etc.)
- Call `/api/verification/match` before initiating OTP
- Show match result inline: "✅ Matched with pre-registered data" or "⚠️ No match found, you may still sign up"

### 5. Verification Status UI

On `/citizen/dashboard`:
- If `verification_status === 'unverified'`: show banner "Complete your identity verification to access all services"
- If `verification_status === 'needs_review'`: show "Your ID is under review. Check back later."
- If `verification_status === 'rejected'`: show "Your verification was rejected. Contact admin."

### 6. Rate Limiting & Security

- Rate-limit the `/api/verification/match` endpoint (reuse the 429 pattern from the sign-up page)
- Rate-limit the `/api/verification/process-id` OCR endpoint (OCR is CPU-intensive)
- Sign URLs for ID document viewing (use `supabase.storage.from('id-documents').createSignedUrl()` with 1-hour expiry)
- Log all verification attempts with IP and user agent for audit
- **Never** store raw ID document images publicly — keep bucket private

### 7. Performance Considerations

- The `pre_registered_residents` table can grow large; ensure indexes on `email`, `phone`, `national_id`, and `(first_name, last_name)`
- For the middleware check, avoid a DB query on every request — cache verification status in a short-lived cookie (e.g., `verification_status` set at sign-in, refreshed on profile update)
- OCR processing should be async (fire-and-forget from the upload endpoint, then poll for results)

### 8. Data Retention Policy

- ID documents: auto-delete after 30 days once verification is complete (cron job or scheduled function)
- Verification attempts: retain for 1 year for audit purposes
- Pre-registered resident records: retain indefinitely (can be marked `is_verified = TRUE` after successful match)

---

## API Endpoints Summary

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/verification/match` | Fuzzy-match sign-up data against pre-registered residents |
| POST | `/app/api/verification/upload-id/route.ts` | Upload ID document to private storage bucket |
| POST | `/api/verification/process-id` | Run OCR on uploaded ID, parse fields, match against pre-registered data |
| GET | `/api/verification/status` | Check current verification status of authenticated resident |
| POST | `/api/admin/pre-registered-residents/import` | Admin CSV upload → batch insert into `pre_registered_residents` |
| GET | `/api/admin/pre-registered-residents` | List all pre-registered residents (with filter/search) |
| GET | `/api/admin/verification/attempts` | Admin review queue (needs_review + rejected) |
| PATCH | `/api/admin/verification/attempts/:id` | Admin approve/reject verification attempt |

---

## Database Migrations (scripts/)

### `16_add_verification_schema.sql`

```sql
-- Add verification columns to residents
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS verification_status TEXT
    DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'auto_verified', 'id_verified', 'needs_review', 'rejected')),
  ADD COLUMN IF NOT EXISTS verification_method TEXT
    CHECK (verification_method IN ('form_match', 'id_ocr', 'manual', 'admin_override')),
  ADD COLUMN IF NOT EXISTS verification_confidence NUMERIC(5,2) CHECK (verification_confidence >= 0 AND verification_confidence <= 100),
  ADD COLUMN IF NOT EXISTS verification_details JSONB,
  ADD COLUMN IF NOT EXISTS id_document_type TEXT,
  ADD COLUMN IF NOT EXISTS id_document_url TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_residents_verification_status ON public.residents (verification_status);

-- Create pre_registered_residents table (see DDL above)
-- Create verification_attempts table (see DDL above)

-- Add RLS policy: admins can view pre_registered_residents
-- (residents table policies already allow admin SELECT/UPDATE)
```

### `17_create_verification_buckets.sql`

```sql
-- Create private id-documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('id-documents', 'id-documents', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
```

### Update `migrate.js`

Add the new SQL files to the consolidated output.

---

## Code Changes Required

### `lib/db.ts`
- `createPreRegisteredResident(data)` — insert into `pre_registered_residents`
- `searchPreRegisteredResidents(filters)` — query with indexed lookups
- `getResidentVerification(userId)` — fetch verification_status from `residents`
- `updateResidentVerification(residentId, fields)` — UPDATE residents with verification fields
- `logVerificationAttempt(data)` — insert into `verification_attempts`
- `getVerificationAttempts(status)` — admin review queue query

### `lib/verification.ts` (new file)
- `normalizeString(str)` — lowercase, trim, strip punctuation, collapse whitespace
- `phoneticMatch(name1, name2)` — Double Metaphone or NYSIIS comparison
- `fuzzyMatch(str1, str2)` — Levenshtein similarity ratio
- `calculateMatchScore(input, candidate, weights)` — weighted scoring
- `parseOcrExtractedFields(ocrText, idType)` — template-based regex parsing

### `app/api/verification/match/route.ts` (new)
- Validates input via Zod
- Calls `searchPreRegisteredResidents`
- Runs `calculateMatchScore` on candidates
- Returns match result with confidence

### `app/api/verification/upload-id/route.ts` (new)
- Authenticates user
- Validates file
- Uploads to `id-documents` bucket (private)
- Triggers OCR processing

### `app/api/verification/process-id/route.ts` (new)
- Downloads image from storage
- Runs Tesseract.js (or Google Vision fallback)
- Parses fields per ID type template
- Runs fuzzy matching
- Updates resident verification status
- Logs attempt

### `app/auth/sign-up/page.tsx` (modify)
- Add `middle_name`, `date_of_birth`, `national_id`, `id_type` fields
- Call `/api/verification/match` before OTP
- Show match result

### `app/citizen/verify-id/page.tsx` (new)
- ID upload form with preview
- Progress indicator during OCR
- Result display

### `app/admin/verification/page.tsx` (new)
- Admin review queue table
- Approve/Reject actions per row

### `middleware.ts` (modify)
- Add verification status check for citizen routes
- Redirect to `/citizen/verify-id` if unverified

### `app/citizen/dashboard/page.tsx` (modify)
- Add verification status banner

---

## New Dependencies

| Package | Purpose | Approx. Size |
|---|---|---|
| `tesseract.js` | Self-hosted OCR for ID document parsing | ~14 MB (includes models) |
| `fast-levenshtein` | Levenshtein distance computation | ~5 KB |
| `nysiis` | Phonetic name matching | ~3 KB |

> If Google Vision fallback is desired, add `@google-cloud/vision` — but this is optional and only needed when `GOOGLE_VISION_API_KEY` is set.

---

## Validation & Testing

1. **Unit tests for matching logic** (`lib/verification.test.ts`):
   - Test `normalizeString` with common PH name variations (e.g., "Juan" vs "JUAN", "Dela Cruz" vs "De la Cruz")
   - Test `calculateMatchScore` with exact match, partial match, no match
   - Test phonetic matching edge cases

2. **Integration tests for API endpoints**:
   - `/api/verification/match` with a seeded `pre_registered_residents` row
   - `/api/verification/upload-id` with a sample ID image

3. **Manual end-to-end test**:
   - Seed a pre-registered resident
   - Sign up with matching data
   - Verify auto-verify path works
   - Sign up with mismatched data
   - Verify ID upload + OCR path works

4. **RLS policy test**: Verify that residents cannot query `pre_registered_residents` directly (no policy granting SELECT to residents).

---

## Open Questions / Assumptions

1. **Pre-saved data source**: Assumed to be imported via admin CSV upload or external sync. If the data comes from a specific government API (e.g., LGU existing resident database), the import mechanism would differ. **Assumed out of scope for initial implementation.**

2. **Tesseract.js accuracy for PH IDs**: Self-hosted OCR may struggle with certain ID layouts. The Google Vision fallback addresses this. **Recommended to start with Tesseract.js and add cloud fallback if needed.**

3. **Philippine ID templates**: The parser uses regex templates per `id_type`. If new ID types emerge, templates must be updated. **Consider making templates configurable.**

4. **Middleware DB query**: Fetching verification status in middleware adds latency. **Recommended: cache in a short-lived cookie set at sign-in, invalidated on profile update.**

5. **Data privacy (GDPR/PDPA compliance)**: ID documents contain sensitive PII. The private bucket + signed URLs + 30-day retention policy address this. **Legal review recommended before production.**
