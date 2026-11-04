# Boarding House Record & Monitoring System

React (Vite) frontend + Node.js/Express backend + Supabase (PostgreSQL).
This replaces the old PHP version; there are no `.php` files left.

```
.github/workflows/   CI, GitHub Pages deploy, database migration deploy
backend/             Express API (auth, dashboards, payments, rooms, QR attendance)
src/                 React app (Vite, React Router)
supabase/            Database migrations
index.html, vite.config.js, package.json   the React app at the repo root
```

## 1. Database

Run `supabase/migrations/20260916000000_initial_schema.sql` in the Supabase SQL Editor
(or let the included GitHub Action push it). If your tables already exist, skip this step.

Then run the second migration too: `supabase/migrations/20261010000000_owner_features.sql`
(beds per room, tenant billing / disabling accounts, notifications, reservations, expenses, maintenance,
announcements, audit log, settings). It is safe to run more than once.

## 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Fill in `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (server-side secret key) and `JWT_SECRET`
(generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).

To email boarders (curfew + payment notices) also fill in `GMAIL_USER` and `GMAIL_APP_PASSWORD`.
Use a Google **App Password** (Google Account > Security > 2-Step Verification > App passwords),
not your normal Gmail password. Without them, notices still show in each boarder's dashboard.

**Never commit `backend/.env` and never put the secret key in frontend code.**

## 3. Install and run

Requires Node.js 18+.

```bash
npm run install:all               # frontend (root) + backend dependencies
npm run seed                      # optional: creates demo accounts
npm run dev:api                   # terminal 1: API on http://localhost:4000
npm run dev                       # terminal 2: web app on http://localhost:5173
```

Demo accounts created by `npm run seed` (change these before going live):

| Role    | Username | Password   |
|---------|----------|------------|
| Admin   | admin1   | admin123   |
| Owner   | owner1   | owner123   |
| Boarder | boarder1 | boarder123 |

Existing users from the PHP app keep working: their bcrypt password hashes are compatible.

## 4. Production

```bash
npm run build     # builds dist/
NODE_ENV=production npm start
```

When `dist/` exists the Express server serves it, so one process hosts the whole app (simplest option).
Serve it over HTTPS (login cookie is `secure` in production, and the camera QR scanner needs HTTPS).

## 5. Live site on GitHub Pages

GitHub Pages only hosts static files, so the **React app** goes on Pages and the **Express API** must run on a
Node host (Render, Railway, ...) over https.

1. Host the API (`backend/`) and set its environment values (see `backend/.env.example`), including
   `CLIENT_ORIGIN=https://<your-github-username>.github.io` and `CROSS_SITE=true`, plus `NODE_ENV=production`.
2. In the GitHub repo: **Settings > Secrets and variables > Actions > Variables**, add
   `VITE_API_URL` = the https URL of the hosted API (no trailing slash).
3. **Settings > Pages > Build and deployment > Source = GitHub Actions** (not "Deploy from a branch").
4. Push to `main`. The *Deploy to GitHub Pages* workflow builds the app and publishes it at
   `https://<your-github-username>.github.io/<repo-name>/`.

Known limit: the login cookie is sent between two different sites, so browsers that block third-party cookies
(for example Safari) cannot stay logged in. For those, host the whole app on the Node host instead (section 4).

## API overview

| Method | Path                      | Access          |
|--------|---------------------------|-----------------|
| POST   | `/api/auth/login`         | public          |
| POST   | `/api/auth/register`      | public (Boarder accounts only) |
| POST   | `/api/auth/logout`        | any             |
| GET    | `/api/auth/me`            | logged in       |
| GET    | `/api/boarder/dashboard`  | Boarder         |
| POST   | `/api/scan`               | public (kiosk scanner on the home page) |
| GET    | `/api/admin/dashboard`    | Owner           |
| GET    | `/api/owner/dashboard`    | Admin           |
| POST   | `/api/boarder/reports`    | Boarder (complaint/report) |
| POST   | `/api/boarder/gcash`      | Boarder (submit GCash payment) |
| GET    | `/api/gcash-qr`           | any logged-in user (image) |
| POST/DELETE | `/api/gcash-qr`      | Admin (upload / remove QR) |
| PATCH  | `/api/owner/reports/:id`  | Admin (reply / set status) |
| POST   | `/api/owner/gcash/:id/approve` | Admin |
| POST   | `/api/owner/gcash/:id/reject`  | Admin |
| GET    | `/api/boarders`           | Admin, Owner    |
| POST   | `/api/payments`           | Admin           |
| POST   | `/api/rooms`              | Admin, Owner    |
| GET    | `/api/qr/boarders`        | Admin, Owner    |
| POST   | `/api/qr/boarders/:id/regenerate` | Admin, Owner |

## GitHub Actions

- `node-ci.yml` syntax-checks the backend and builds the frontend (replaces the old PHP lint job).
- `deploy-pages.yml` builds the React app and publishes it to GitHub Pages (see section 5).
- `supabase-deploy.yml` pushes `supabase/migrations` (unchanged). It needs the repository secrets
  `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID`. If the database already exists, baseline the
  migration history with the Supabase CLI before enabling it.

## Automatic notices (owner features)

- **Rooms:** no limit on rooms or on boarders per room. A room becomes *Occupied* automatically as soon as it
  has a boarder and *Available* again when it has none (*Maintenance* is manual).
- **Curfew:** every day at the curfew time (default 22:00, Manila time, change in Settings) every active
  boarder gets an in-app notice and a Gmail. Boarders not checked in get a "return now" message.
- **Payments:** each boarder has a *next due date*. On that date, if unpaid, they are emailed to pay within
  3 days (Settings) or be disabled. After the 3 days the account is disabled automatically, the bed is
  freed and login is blocked. Recording a Rent payment moves the due date one month ahead.
  Boarders with no due date set are never auto-disabled.
- Owner API: everything under `/api/owner/*` (Admin role only).

## QR attendance (no login)

- Every boarder has a personal QR (`users.qr_token`, created by migration `20261016000000_boarder_qr.sql`).
- Admin/Owner print the cards at `/qr`. Boarders can also see their QR on their dashboard.
- The home page opens the camera automatically. A scan calls `POST /api/scan`, which writes
  Time In (first scan of the day) / Time Out (second scan) to the Supabase `attendance` table.
- Admin (Attendance tab) and Owner dashboards refresh every 10 seconds, so scans show up live.

## Room availability, reports, GCash (boarder dashboard)

- **Room pie chart:** the boarder dashboard shows Available / Occupied / Maintenance rooms.
- **Reports:** a boarder sends a report; it appears right away for the Admin (*Boarder Reports* tab, red counter
  in the sidebar) and the Owner (dashboard). Both dashboards refresh every 10 seconds and show a banner when a
  new report arrives. When the Admin replies or changes the status, the boarder gets a notification.
- **GCash QR:** Admin > Settings > *GCash QR*: upload a screenshot of your GCash receive-money QR (number/name optional).
  Boarders see the QR on their dashboard (with a Save image button), pay by scanning it in GCash, then submit
  the amount and the receipt's Reference No. The Admin checks it in *GCash Payments* and
  approves (records the payment, moves the due date for Rent) or rejects with a reason.
  This is manual confirmation, not an automatic gateway (see PayMongo/Xendit if you want auto-confirmation).
- Run the migration `supabase/migrations/20261017000000_reports_gcash.sql`.

## Forgot password, gender, advance payment, Paid/Unpaid

Run the migration `supabase/migrations/20261018000000_advance_gender_reset.sql` first.

- **Forgot password** (`/forgot-password`): the boarder enters username or email, gets a 6-digit code by email
  (valid 15 minutes, 5 tries, stored hashed), then sets a new password. Needs the Gmail/SMTP settings; in
  development the code is printed in the backend console. No email on the account? Admin > Tenants > *Reset
  password* creates a temporary password, and the boarder changes it in *Change Password* on their dashboard.
- **Gender:** Male / Female is chosen on the Register page and shown in Tenants and the Owner's Boarders table.
- **Rent once a month:** a boarder can't pay Rent again in the same calendar month (admin form and GCash form
  both check it). They can pay again next month. **Advance Payment** (formerly *Deposit*) is for paying ahead.
- **Paid / Unpaid:** every recorded payment is **Paid** automatically (GCash payments become Paid when approved).
  *Payment Proofs* now shows Paid/Unpaid, with a *Mark Paid / Mark Unpaid* button for corrections.

## Receipts

Every **Paid** payment has an official receipt (`OR-000123`) with date, boarder, room, type, amount, method
(GCash / recorded by admin) and reference no. Boarders open it from *Payment Records → View receipt*; the Admin
from *Payments* or *Payment Proofs → Receipt*. *Print / Save as PDF* uses the browser print dialog.
`GET /api/receipts/:id`: a boarder can only open their own; Unpaid payments have no receipt.

## Due-date warnings (red)

A boarder is shown in **red** when the rent is **overdue or due within 7 days** (`billing.urgent` from
`billingState`, constant `DUE_WARNING_DAYS` in `services/scheduler.js`). Once rent is paid the due date moves a
month ahead, so the red goes away by itself.
- Admin: *Billing* (sorted, closest due date first) and *Tenants* highlight the row and the date; Overview shows the count.
- Owner: *Boarders* table has a *Next due* column and a counter tile.
- Boarder: red tile + a warning banner on their own dashboard.

## Charts (Admin Overview and Owner dashboard)

Pie charts for **rooms** (Available / Occupied / Maintenance) and **boarders** (Male / Female; disabled boarders
are not counted, accounts without a gender show as "Not set"). The boarder dashboard shows the rooms pie too.

## Disabled accounts

The old *Terminated* status is now **Disabled**. A disabled boarder can't log in or scan, and the bed is freed. Run
`supabase/migrations/20261019000000_disabled_status.sql` (renames existing rows). Endpoint: `POST /api/owner/tenants/:id/disable`.

## Two-column dashboards

The Boarder and Owner dashboards show a row of stat tiles, then **two columns** of cards (`.admin-cols` / `.admin-col`
in `admin.css`). On screens narrower than 1000px they stack into one column.
