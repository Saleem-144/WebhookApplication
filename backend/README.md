# WebhookApplication Backend

This is the Node.js / Express.js backend for the Dialpad Super Admin Dashboard. It is built using **JavaScript (ES Modules)** and integrates with PostgreSQL, Redis, and Socket.IO.

## Project Overview
This backend provides the foundational infrastructure for a real-time Dialpad management dashboard. It includes a secure JWT-based authentication system with role-based access control, a comprehensive user management API with automated email credential delivery, and a centralized audit logging service. The data layer is optimized for high-performance with a PostgreSQL connection pool and abstracted model helpers for offices, departments, and agents. Most importantly, it features a reactive real-time engine built on Socket.IO and Redis Pub/Sub, allowing the dashboard to instantly reflect incoming Dialpad events like new messages, call status changes, and agent presence updates even across multiple server instances.

## Technical Stack
- **Runtime**: Node.js (ESM)
- **Framework**: Express.js
- **Database**: PostgreSQL (`pg` pool)
- **Real-time**: Socket.IO + ioredis (Pub/Sub)
- **Security**: JWT (Cookies) + bcrypt
- **Services**: Resend (Email), Upstash (Redis)

---

## Getting Started

1. **Environment Variables**: Copy `.env.example` to `.env` and set at least:
   - `DATABASE_URL`: PostgreSQL connection string.
   - `JWT_SECRET`: Secret for signing tokens.
   - `REDIS_URL`: Redis connection string (optional; omit to disable Pub/Sub).
   - `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`: Required only when running `admin-setup.js` (values are not stored in source code; password is hashed into the DB).
   - `RESEND_API_KEY`: For automated email credentials when inviting users.

2. **Installation**:
   ```bash
   cd backend
   npm install
   ```

3. **Database Seeding**:
   ```bash
   # In backend/.env set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (min 8 chars).
   # Creates the first superadmin in the `users` table — no credentials are hardcoded in code.
   node scripts/admin-setup.js

   # If the DB was created before `agent` existed on `users.role`, run once:
   # psql $DATABASE_URL -f migrations/001_users_role_agent.sql
   # For profile pictures: psql $DATABASE_URL -f migrations/002_users_avatar_url.sql

   # Populate with mock offices/agents for testing
   node scripts/seed-data.js
   ```

4. **Run Server**:
   ```bash
   npm run dev
   ```

---

## API Documentation

### Authentication (`/api/auth`)
- `POST /login`: Receives `{email, password}`. Sets an HTTP-only cookie named `token`.
- `PATCH /profile`: (Protected) `{ name }` updates display name.
- `POST /avatar`: (Protected) `multipart/form-data` field `avatar` — image up to 2 MB (JPEG/PNG/GIF/WebP). Saves under `backend/uploads/avatars` and sets `users.avatar_url`.
- `POST /change-password`: (Protected) Updates the user's password.

### User Management (`/api/users`)
- `GET /`: (Protected, **superadmin** or **admin**) List all dashboard users.
- `POST /`: (**superadmin** or **admin**) Creates a user. **Superadmin** may set role **superadmin**, **admin**, or **agent**. **Admin** may only set **admin** or **agent** (temporary password; email if Resend is configured).
- `DELETE /:id`: (**superadmin** or **admin**) Deletes a user. **Admins cannot delete a superadmin.**

### Statistics & Data (`/api/stats`, `/api/search`)
- `GET /api/stats/summary`: Returns counts for Offices, Departments, and Agents.
- `GET /api/stats/offices`: Returns a list of all active offices.
- `GET /api/search?q=...`: Unified search across Agents and Customers (min 2 chars).

---

## Real-time Events (Socket.IO)

The backend listens to the `dialpad_events` channel on Redis and bridges them to Socket.IO.

| Event | Data Payload | Description |
|-------|--------------|-------------|
| `new_message` | `message` object | Emitted when a new SMS is received. |
| `call_started` | `call` object | Emitted when a call begins ringing/connecting. |
| `call_ended` | `call` object | Emitted when a call hangup occurs. |
| `agent_status` | `{agentId, status}` | Emitted when an agent's presence changes. |
| `new_notification` | `notification` object | Emitted for any alert (missed call, voicemail). |

---

## Folder Structure
- `/src/db`: DB Pool and query helpers (`models.js`).
- `/src/middleware`: JWT authentication and RBAC.
- `/src/routes`: API endpoints.
- `/src/services`: Business logic (Email, Audit Logging, Notifications).
- `/src/socket`: Socket.IO emitters and Redis bridge.
- `/scripts`: Setup and Seeding utilities.
