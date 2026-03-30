# Dialpad Super Admin Dashboard — Project Context

## What This Application Does

This is an internal **Super Admin Monitoring & Communication Dashboard** that integrates with **Dialpad** (a cloud phone and SMS platform) via webhooks. It independently mirrors all company communication data into its own database so management can monitor all agent-customer and agent-agent interactions across the entire company — without being affected by Dialpad's native "seen" status behavior.

> Full details → see `/docs/1_PRD.docx`, `/docs/2_DesignDocument.docx`, `/docs/3_DBSchema.docx`

---

## The Core Problem Being Solved

In Dialpad, when a customer sends a message to a department number, any agent in that department who opens the message marks it as **seen for everyone**. Management loses all visibility on who actually attended to the customer. This application:

- Receives **every** Dialpad event independently via webhooks
- Stores all data in **its own PostgreSQL database** — Dialpad's seen status is irrelevant here
- Tracks its own **per-user read receipts** (WhatsApp-style "Seen by [Name] at [time]")
- Gives the super admin a **unified view** of all offices, departments, agents, and customers

---

## Language & Stack — NON-NEGOTIABLE

| Rule | Value |
|------|-------|
| **Language** | TypeScript |
| **File extensions** | .ts and .tsx |
| **Frontend** | Next.js (App Router) + Shadcn/UI + Tailwind CSS |
| **Backend** | Node.js + Express.js |
| **Database** | PostgreSQL (hosted on Supabase) |
| **Cache / Queue** | Redis (hosted on Upstash) |
| **Real-time** | Socket.IO |
| **AI Analysis** | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| **Auth** | JWT + bcrypt |
| **Email** | Resend |
| **File Storage** | Cloudflare R2 |
| **Deployment** | Vercel (frontend) + Railway (backend) |

---

## Company Hierarchy (Dialpad Structure)

```
Company (one, registered under company admin Dialpad account)
└── Offices (multiple)
    └── Departments (multiple per office)
        └── Agents (assigned to departments)
            └── Customers (external clients, interact via company/department number)
```

---

## Project Folder Structure

```
/project-root
├── .cursorrules              ← AI coding rules (JS only, patterns, security)
├── CONTEXT.md                ← This file
├── .env.example              ← All environment variable names (no values)
│
├── /docs
│   ├── 1_PRD.docx            ← Full product requirements
│   ├── 2_DesignDocument.docx ← Architecture, APIs, folder structure, Socket events
│   ├── 3_DBSchema.docx       ← All 13 tables with SQL, indexes, key queries
│   └── 4_CursorRules.docx    ← Human-readable version of .cursorrules
│
├── /frontend                 ← Next.js app (TypeScript)
│   ├── /app
│   │   ├── /(auth)           ← Login, change-password pages
│   │   └── /(dashboard)      ← home, messages, calls, settings pages
│   ├── /components           ← Sidebar, Navbar, ChatThread, CallLog, AIPanel, etc.
│   ├── /hooks                ← useSocket.ts, useAuth.ts, useOffice.ts
│   ├── /lib                  ← API client (axios), socket client init
│   ├── /store                ← Zustand: authStore.ts, officeStore.ts, notificationStore.ts
│   └── /styles               ← Global CSS, Tailwind config
│
└── /backend                  ← Node.js + Express app (TypeScript)
    └── /src
        ├── /webhooks         ← Webhook receiver route + signature verification
        ├── /events           ← Event processors: sms.ts, call.ts, agent.ts, contact.ts
        ├── /routes           ← REST API: auth.ts, messages.ts, calls.ts, agents.ts, ai.ts
        ├── /db               ← PostgreSQL pool + query helpers
        ├── /socket           ← Socket.IO server setup and emitters
        ├── /middleware        ← JWT auth, role check, rate limiter, error handler
        ├── /services         ← email.ts, ai.ts, dialpad-api.ts
        └── /config           ← Env config loader, constants
```

---

## Application Tabs & Features

### 1. Home Tab
- Stat cards: Total Offices, Total Departments, Total Agents
- Office dropdown to filter view
- Shows selected office's departments and agents with live status dots

### 2. Messages Tab
- **Left panel toggle:** Agents | Customers
- **Agents view:** list all agents → click agent → see customers + internal agents they messaged → click one → full chat history
- **Customers view:** list all customers → click customer → see agents they talked to → click one → full chat history
- **Chat area:** full thread, sender labels, timestamps, WhatsApp-style read receipts
- **AI panel:** Summarize / Sentiment / Demands / Satisfaction / Suggested Reply buttons + free-form chatbot

### 3. Calls Tab
- Same Agents | Customers toggle as Messages
- Call log: direction badge (Inbound/Outbound/Missed), duration, date/time
- Download Transcript button (completed calls only)
- AI Recap Summary (if available from Dialpad)

### 4. Navbar
- Office selector dropdown (filters all data)
- Notification bell (badge count, dropdown with customer/agent badge per notification)
- Profile icon → name, Change Password, Logout

### 5. Settings Tab (Super Admin only)
- Profile: update name, change password
- User management: add user (auto-generate password, send via email), list users, delete, resend credentials

---

## Authentication Rules

- **No public signup** — super admin creates users only
- Super admin enters email → system generates random 12-char password → emails it via Resend
- User logs in → `must_change_password` flag forces password change on first login
- JWT tokens, expire 8 hours, stored in HTTP-only cookies
- All backend routes protected by JWT middleware
- Role checked at route level (`superadmin` vs `admin`)

---

## Key Business Logic — Never Deviate From These

### Read / Seen Tracking
- **NEVER** use Dialpad's seen status
- Read tracking is in the `message_read_log` table only
- A message is "read" only when opened in THIS app by a specific named user
- Query always joins `message_read_log` with `users` to show "Seen by [Name] at [time]"

### Notifications
- Created by webhook events, not Dialpad's notification system
- Every inbound SMS → one `notifications` row
- Every missed call → one `notifications` row
- Marked read only when user clicks it in this app
- Bell badge count = unread notifications for current user from DB

### Outbound Messages (Optimistic UI)
1. User clicks Send → message renders immediately as "Sending..." (grey)
2. Backend calls Dialpad API to send
3. On Socket.IO `message_sent` event → update to "Sent" (blue tick)
4. On Socket.IO `message_failed` event → show "Failed — Retry" button

### Webhook Processing Order (always this exact sequence)
1. Save raw payload to `webhook_events` table (always first, even if processing fails)
2. Verify HMAC-SHA256 signature — reject 401 if invalid
3. Parse event type field
4. Route to correct processor in `/src/events/`
5. Processor saves to correct DB table(s)
6. Processor publishes to Redis pub/sub
7. Socket.IO picks up from Redis → emits to frontend
8. Mark `webhook_events.processed = true`

---

## Database Tables (13 total)

| Table | Purpose |
|-------|---------|
| `users` | App login accounts |
| `offices` | Offices synced from Dialpad |
| `departments` | Departments per office |
| `agents` | Agents per department |
| `agent_status` | Live agent availability (upserted per status webhook) |
| `customers` | External contacts/clients |
| `message_threads` | Groups messages into conversations |
| `messages` | All SMS messages (inbound, outbound, internal) |
| `message_read_log` | Per-user read receipts — the "seen" feature |
| `calls` | All call records with status, duration, transcript URL |
| `notifications` | In-app notifications (independent of Dialpad) |
| `webhook_events` | Raw webhook audit log for debugging and replay |
| `audit_log` | Admin action history |

> Full SQL with indexes and key queries → `/docs/3_DBSchema.docx`

---

## Environment Variables Required

```
# Dialpad
DIALPAD_API_KEY=
DIALPAD_WEBHOOK_SECRET=
DIALPAD_COMPANY_ID=

# Database
DATABASE_URL=

# Redis
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=

# Auth
JWT_SECRET=
JWT_EXPIRES_IN=8h

# Email
RESEND_API_KEY=
EMAIL_FROM=

# AI
ANTHROPIC_API_KEY=

# Storage
R2_BUCKET_NAME=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_ENDPOINT=

# App
FRONTEND_URL=
PORT=4000
NODE_ENV=development
```

---

## Dialpad Webhook Events Handled

| Category | Events |
|----------|--------|
| SMS | inbound, outbound, delivery status, internal inbound, internal outbound |
| Calls | ringing, connected, hangup, voicemail, missed, recording available, AI transcription, AI recap |
| Agent Status | available, busy, dnd, offline |
| Contacts | created, updated, deleted |

---

## API Response Format (always consistent)

```js
// Success
{ success: true, data: { ... } }

// Error
{ success: false, error: "Human readable message", code: "ERROR_CODE" }
```

---

## Socket.IO Events (Backend → Frontend)

| Event | When Emitted | Frontend Action |
|-------|-------------|-----------------|
| `new_message` | Inbound SMS webhook received | Append to thread, increment notification badge |
| `message_sent` | Outbound SMS confirmed | Update optimistic message to "sent" |
| `message_failed` | Dialpad API error on send | Show "Failed — Retry" |
| `call_started` | Call ringing/connected | Show active call banner |
| `call_ended` | Call hangup | Update call log with duration |
| `agent_status` | Status change webhook | Update status dot next to agent |
| `new_notification` | Any inbound event | Increment bell badge, add to dropdown |
| `transcript_ready` | Transcript webhook received | Enable Download button for that call |

---

## Important Notes for Cursor AI

- **TypeScript** — write scalable, type-safe TypeScript code using `.ts` and `.tsx` file extensions.
- **No `require()`** — use ES module `import/export` syntax throughout
- **No inline SQL in routes** — all queries go through `/db/` helper files
- **No business logic in routes** — routes call services, services do the work
- **Parameterized queries always** — never string-interpolate SQL values
- **Try/catch on every async function** — no unhandled promise rejections
- **Read `.cursorrules`** before generating any file — it is the single source of truth for all coding decisions