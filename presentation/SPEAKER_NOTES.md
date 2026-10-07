# LingkodBayan — Presentation Speaker Notes

Suggested total time: **8–10 minutes** (slide numbers match `slides.html`).

---

## Slide 1 — Title (30 seconds)

> Good day! Our system is **LingkodBayan** — a civic services portal that connects
> citizens with their local government. It lets residents submit service requests,
> file complaints, track progress, and read official announcements, while giving
> administrators one dashboard to manage everything.

Say your name, course/section, and the repo (github.com/devmakiiiii/LingkodBayan).

---

## Slide 2 — The Problem (45 seconds)

> Residents used to queue at the barangay office for simple things — water issues,
> waste collection, street repairs. Complaints had no transparent tracking, and
> announcements reached people inconsistently. Admins had no centralized tool.

Key line: **"Everything was paper-based, slow, and invisible to the resident."**

---

## Slide 3 — The Solution (45 seconds)

> LingkodBayan digitizes the citizen–government interaction in one portal.
> Three audiences: the **public** can browse announcements and track submissions
> without an account; **citizens** get a full self-service portal; **admins** get a
> management dashboard.

Mention: it's a real web app — responsive, works on phones.

---

## Slide 4 — User Roles & Access Control (1 minute)

> Access is enforced in **two layers**: `middleware.ts` redirects unauthorized
> users at the HTTP layer, and **Row-Level Security** in the database ensures a
> citizen's browser can only ever query their own rows — even if they bypass the UI.

- Public → `/`, `/announcements`, `/track`
- Citizen → `/citizen/*` (after email OTP sign-up + ID verification)
- Admin → `/admin/*` (role granted only through trusted `app_metadata`)

**CS tie-in:** Role-Based Access Control (RBAC) + database-level security policies.

---

## Slide 5 — Citizen Features (1 minute)

Walk through the list quickly:
- Dashboard with statistics
- **Request a service** (water, waste, street repair, health, education)
- **File a complaint** with evidence and two-way messaging
- **Track status** with SLA timers + in-app/SMS notifications (Semaphore)
- **ID verification** — upload government ID, OCR processing
- **Proxy filing** — authorize someone to file on your behalf
- Announcements, document pickups, feedback, settings

---

## Slide 6 — Admin Features (1 minute)

- Dashboard & **analytics with a Leaflet heatmap** of the barangay
- Process requests/complaints through allowed status transitions
- **Verification queue** — approve/reject resident IDs
- Residents directory, purok manifest, pre-registered residents
- Announcements, officials & designations
- **Excel report export** + **audit logs** for every admin action

---

## Slide 7 — Live Demo Flow (1.5 minutes — or do a real demo)

Narrate the pipeline:

> 1. Citizen signs up → verifies email with a 6-digit OTP
> 2. Uploads a government ID → OCR extracts text → fuzzy-matched against the registry
> 3. Submits a service request (validated client and server side)
> 4. Admin sees it, moves it `pending → processing → approved`
> 5. Citizen gets notified and tracks it to completion — or anyone can track it
>    publicly with the reference number, no login needed

If demoing live: use the test accounts from `GETTING_STARTED.md`.

---

## Slide 8 — Architecture (1 minute)

> It's a **three-tier client–server architecture**:
> the **browser** (React), the **application server** (Next.js API routes and
> middleware), and the **data layer** (Supabase — Postgres, Auth, Storage).
> Two optional external services: **Semaphore** for SMS and **Vercel** for hosting.

Mention the request path: Browser → Next.js middleware (auth, CSRF, rate limit) →
API route → Supabase (RLS check) → response → notification.

---

## Slide 9 — Tech Stack (45 seconds)

> Frontend: **Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui**.
> Forms: **React Hook Form + Zod** validation.
> Backend: **Supabase** — Postgres with Row-Level Security, Auth, Storage.
> Deployed on **Vercel** via GitHub.

Don't read the whole list — just highlight the big four.

---

## Slide 10 — CS Concept: Finite State Machine (1 minute) ⭐

> Every request, complaint, and feedback lifecycle is modeled as a **deterministic
> finite automaton** — a set of states, an initial state, terminal states, and a
> transition relation, defined in `lib/status-machine.ts`.
>
> For a service request: `pending → processing → approved` or `rejected`.
> The UI only offers buttons for **legal transitions**, and the server rejects
> illegal ones — so an *approved* request can never jump back to *pending*.
> One authoritative guard, used by server actions, API routes, and the UI.

Show the small state diagram on the slide.

---

## Slide 11 — CS Concept: Algorithms & Data Structures (1 minute) ⭐

> **Levenshtein distance** — a classic dynamic-programming algorithm — powers ID
> verification: when a resident uploads an ID, we compare their name against the
> pre-registered roster using edit-distance similarity **plus phonetic (NYSIIS)
> matching**, then a weighted score decides auto-verify, review, or rejection.
> Typos don't break verification.
>
> Data structures: **HashMaps** for O(1) rate-limit counters and lookups,
> **HashSets** for the XSS sanitizer allowlist and transition guards,
> and a **job queue** (Postgres-backed) for async OCR processing with polling.

Complexity note if asked: Levenshtein is **O(n×m)** time and space.

---

## Slide 12 — CS Concept: Security (1 minute) ⭐

Layer them — this is your strongest section:

1. **Cryptography** — AES-GCM encryption with random IVs, SHA-256 key derivation, bcrypt password hashing, CSPRNG tokens
2. **CSRF** — 32-byte double-submit tokens; header must match cookie or HTTP 403
3. **RBAC** — roles read only from `app_metadata`, which users can't edit (prevents self-promotion to admin)
4. **Row-Level Security** — enforced inside the database itself
5. **Rate limiting** — fixed-window counters, durable in Postgres so serverless cold resets can't bypass them
6. **XSS** — HTML allowlist sanitizer
7. **PII hygiene** — a DB trigger auto-deletes expired OCR rows (TTL/garbage collection)

---

## Slide 13 — Testing & Quality (45 seconds)

> - **Unit tests** on core logic (`pnpm test`, Node test runner)
> - **Playwright E2E tests** for public pages, auth guards, and citizen flows
> - **axe-core WCAG 2.1 AA accessibility scans** — serious violations fail the build
> - **GitHub Actions CI** runs everything on every push

---

## Slide 14 — Results / Future Work / Close (45 seconds)

Future improvements (pick 2–3):
- Offline support via the existing service worker (network-first caching already shipped)
- Map-based request clustering (Leaflet heatmap already in place)
- Automated sync of the pre-registered roster from a national ID database
- Mobile app / PWA notifications

Close with:

> "LingkodBayan turns a paper-based barangay workflow into a transparent, secure,
> and accessible digital service — built on well-known computer science foundations:
> finite state machines, dynamic programming, cryptography, and access-control theory.
> Thank you!"

---

## Anticipated Q&A

**Q: Why Supabase instead of a custom backend?**
A: It provides Postgres + Auth + Storage with Row-Level Security built in — security is enforced at the database, not just the UI. Fewer moving parts, still standard SQL.

**Q: What happens if someone forges an admin role?**
A: Roles are read from `app_metadata`, which only the server can write. Migration 39 also hardened the SQL function `is_admin_user()` so the browser client can't act on a forged claim either.

**Q: How does verification avoid false positives?**
A: Exact matches (email/phone/national ID) score highest; names use max(Levenshtein, phonetic) similarity with weighted scoring — borderline cases go to `needs_review` for a human admin.

**Q: Is it scalable?**
A: Stateless serverless deployment on Vercel scales horizontally; rate limiting was moved to Postgres because in-memory state resets between serverless instances.

**Q: Why FSM instead of just an enum?**
A: An enum only defines valid values; an FSM defines valid *changes*. Illegal transitions are rejected in one place instead of ad-hoc checks scattered across the code.

**Q: How do you protect citizen data (PII)?**
A: RLS, AES-GCM encryption of sensitive fields, private storage buckets with signed URLs, HTML sanitization, audit logging, and automatic deletion of expired OCR data via a database trigger.


> It's a **three-tier client–server architecture**:
> the **browser** (React), the **application server** (Next.js API routes and
> middleware), and the **data layer** (Supabase — Postgres, Auth, Storage).
> Two optional external services: **Semaphore** for SMS and **Vercel** for hosting.

Mention the request path: Browser → Next.js middleware (auth, CSRF, rate limit) →
API route → Supabase (RLS check) → response → notification.
