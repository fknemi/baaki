
A phone-first receivables command centre for small Indian businesses. Tracks every invoice, tells the owner who to chase today, generates GST-compliant invoices and payment demand letters, matches incoming payments, and forecasts cash shortages weeks before they hit — every action backed by a tamper-evident audit chain.

**Built for HackCache '26 — Problem 4: The Small Business Invoice Chase**

[![Hosted on Render](https://img.shields.io/badge/hosted%20on-Render-46E3B7?logo=render&logoColor=white)](https://render.com)

<br>

<p align="center">
<img width="200" height="400" alt="Dashboard" src="https://github.com/user-attachments/assets/8df7c477-b704-4e54-b5fd-61f5cf11dbda" />
<img width="200" height="400" alt="Forecast" src="https://github.com/user-attachments/assets/404e0ac3-f886-4e87-8007-c4f322224b35" />
<img width="200" height="400" alt="Follow-ups" src="https://github.com/user-attachments/assets/fa25e69e-1ed6-4b31-a968-cd478d363e1c" />
<img width="200" height="400" alt="Demand Letter" src="https://github.com/user-attachments/assets/5acc5603-0822-48e2-8864-20c5d99860c3" />
</p>

<br>

## Table of contents

- [Overview](#overview)
- [What Baaki does](#what-baaki-does)
- [The nine mechanisms](#the-nine-mechanisms)
- [System architecture](#system-architecture)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scheduled reminders on Render](#scheduled-reminders-on-render)
- [Project structure](#project-structure)

<br>

## Overview

Small businesses in India supply goods on credit and get paid weeks later. Without an accounts team, the owner loses track of who owes what, forgets to follow up, and discovers a cash shortage only when salaries are due. Baaki answers three questions every morning: how much is owed, how late it is, and whether cash will run short before salaries are due.

Baaki works down a ranked list of who to chase today, sends the right message in the customer's language, and writes every action to an append-only hash-linked audit chain.

The demo business is Sharma Packaging, Pune — a micro packaging enterprise, GST-registered (regular), 12 customers on 30-day credit. All customers, GSTINs, phone numbers, and transactions in the app are synthetic.

Baaki is hosted on **Render**. Automatic email reminders are driven by **Render Cron Jobs**, not by the app process, so scheduled dispatch keeps working in the background even when nobody is using the app.

<br>

## What Baaki does

**Daily command centre.** A single dashboard shows total outstanding, overdue amount with the oldest invoice age, expected collections this week and month, cash in bank, the lowest point in the thirteen-week forecast, an ageing bar split into not-yet-due through ninety-plus days, and the top five customers to chase today.

**Invoices and follow-ups.** Every invoice is tracked end to end, from draft to sent to paid or disputed. An editable six-stage escalation ladder runs from a friendly heads-up three days before due date through to a payment demand letter at thirty days and next-steps suggestions at forty-five days. Today's follow-ups lists every reminder that is due today, with the message ready in the customer's preferred language and one-tap WhatsApp, email, or SMS.

**Cash forecast.** Thirteen weeks, week by week, using each customer's historical average days late rather than their stated due date. The first week cash dips below the safety buffer is flagged, along with the specific invoices that would close the gap if collected.

**Payments and Inbox.** A bank CSV is parsed and matched against open invoices with a confidence score and a reason for every proposal. Shortfalls of exactly one, two, or ten percent of taxable value are flagged as possible TDS. Nothing is marked paid without human confirmation. Disputes and already-paid claims land in the Inbox, and the ladder pauses or resumes based on the resolution.

**Documents.** Tax Invoice, Bill of Supply, or plain invoice selected automatically by registration type. Payment Demand Letter with a mandatory disclaimer and optional MSMED Section 16 interest (scoped to micro and small only). Evidence pack collecting every artefact associated with an invoice. All printed as A4 via CSS paged media.

**Every action audited.** Every state change is written to an append-only hash-linked chain. A "Verify this record" button recomputes from genesis and names the first failing sequence number if anything has been tampered with.

<br>

## The nine mechanisms

These are what make Baaki defensible rather than just functional. Every mechanism has a primary source and a test.

| # | Mechanism | Source |
|---|---|---|
| 1 | Hash-chain audit log — every event hashes the previous event's hash combined with its canonical JSON | Git commit chain model |
| 2 | Statutory compound interest on late payment, three times RBI rate, monthly rests, scoped to micro and small only | MSMED Act 2006, Section 16 |
| 3 | GSTIN mod-36 Luhn checksum — catches the typo that regex alone misses | CBIC GSTIN specification |
| 4 | UPI deep-link QR — payee VPA, payee name, amount, currency, note, rendered as inline SVG | NPCI UPI Linking Specification v1.5.1 |
| 5 | GST invoice numbering — sixteen-character limit, unique per financial year | CGST Rule 46(b) |
| 6 | GST rounding — fifty paise or more rounds up, less is ignored, applied only to the final total | CGST Act Section 170 |
| 7 | E-invoicing threshold — historical and sticky above five crore aggregate turnover | CBIC e-invoicing rules |
| 8 | Cash forecast placing receipts on effective due date (stated due date plus historical average days late) | Property-tested invariants |
| 9 | A4 PDF via browser CSS paged media, no PDF library, pixel-diffed at one-tenth of one percent | Browser print dialog |

The demand letter is never called a legal notice. A CI script fails the build if that phrase appears outside the single mandatory disclaimer, or if the words court, emblem, or seal appear at all.

<br>

## System architecture

Baaki strictly separates side effects from domain logic. All financial calculations are pure, testable, and deterministic. Database operations are mathematically protected from tampering.

```
┌─────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│                 │      │  Render Cron Jobs    │      │  External APIs   │
│  Client (Web)   │      │  (reminders, cleanup)│      │ (Resend, Gemini) │
└────────┬────────┘      └──────────┬───────────┘      └────────┬─────────┘
         │                          │                           ▲
         │ HTTPS / SSE              │ Daily trigger             │
         ▼                          ▼                           │
┌───────────────────────────────────────────────────────────────┴─────────┐
│                                                                         │
│                    Next.js 16 — Hosted on Render                        │
│                                                                         │
│  ┌────────────────┐    ┌─────────────────────┐    ┌──────────────────┐  │
│  │  /app          │    │  /lib/domain        │    │  /lib/db         │  │
│  │  UI, routing,  │───▶│  Pure engines:      │◀───│  Drizzle schema, │  │
│  │  Route         │    │  money, GST, GSTIN, │    │  queries, hash-  │  │
│  │  Handlers      │    │  forecast, matcher, │    │  chain helper    │  │
│  │                │    │  priority, msmed    │    │                  │  │
│  └────────┬───────┘    └─────────────────────┘    └────────┬─────────┘  │
│           │                                                │            │
└───────────┼────────────────────────────────────────────────┼────────────┘
            │                                                │
            ▼ Drizzle ORM / S3 API                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Data Layer                                                             │
│                                                                         │
│  [ PostgreSQL 16 (Render Managed) ]     [ Cloudflare R2 / SeaweedFS ]   │
│  - Append-only hash chain               - Direct presigned uploads      │
│  - BEFORE UPDATE / BEFORE DELETE        - Server never proxies bytes    │
│  - Idempotency unique indices                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Request flow and layer isolation

Each request passes through four strict stages.

| Step | Layer | Role |
|---|---|---|
| **Compute** | `src/lib/domain` | Pure engines for money, GST, GSTIN, numbering, ladder, matcher, forecast, priority, grades, MSMED interest, and the hash chain. No I/O, no `Date.now`, no randomness — time is a parameter. Every engine has a dedicated test file matching the spec's exact vectors. |
| **Validate** | `src/app/api` | Route Handlers check session, scope, and role, then call the relevant domain function and write both the data change and an audit event in one single database transaction. Success returns `{ data }`, failure returns `{ error: { code, message } }` with the correct HTTP status. |
| **Persist** | `src/lib/db` | Drizzle ORM over Postgres 16. The `events` table has `BEFORE UPDATE` and `BEFORE DELETE` triggers. The application role is not the table owner, preventing it from disabling its own restrictions. |
| **Render** | `src/app/(app)` | Server-rendered pages with client islands. Interactive views fetch from Route Handlers. Print routes render A4 via CSS paged media. Public customer links render without the app shell. |

<br>

## Tech stack

| Package | Type | Role |
|---|---|---|
| Next.js 16 | framework | App Router, Route Handlers, server runtime, static optimisation for public pages |
| TypeScript | language | Strict mode across the codebase |
| React 19 | library | UI runtime pinned by Next.js |
| Tailwind CSS v4 + shadcn | styling | Utility-first styling with a shared design system |
| PostgreSQL 16 | database | Source of truth; enforces the append-only audit chain |
| Drizzle ORM | library | SQL-first ORM that does not hide triggers or role separation |
| postgres.js | library | DB driver with `prepare: false` behind PgBouncer |
| Firebase Phone Auth | platform | Client OTP combined with server-side session tokens |
| Cloudflare R2 / SeaweedFS | storage | Presigned PUT and GET; the server never proxies bytes |
| Upstash Redis | library | Rate limiting per user and per IP |
| Render Cron Jobs | platform | Daily reminder dispatch and hourly cleanup; calls secured endpoints with a Bearer token |
| Resend | API | Email delivery with idempotency keys, reply-to set to the owner |
| Meta Cloud API | API | WhatsApp send when templates are approved; falls back to one-tap `wa.me` links |
| Google Gemini | API | AI chat and OCR, proxied through the server so the key never reaches the client |
| qrcode | library | UPI deep-link QR rendered as inline SVG on invoice, letter, and pay page |
| Recharts | library | Forecast and ageing charts drawn as SVG |
| CSS paged media | browser | A4 PDFs via the print dialog; no PDF library in the production path |
| Custom i18n | library | English and Hindi files with key parity enforced in CI |
| Vitest + Testing Library + fast-check | testing | Unit, component, and property tests |
| Playwright + axe-core | testing | End-to-end, accessibility, print goldens, network checks |
| Bun | tooling | Package manager and script runner |
| Render | hosting | Web Service for the Next.js app, Managed Postgres, Cron Jobs |

<br>

## Getting started

### Prerequisites

- Bun 1.1 or newer
- Docker Desktop (or Docker Engine with the compose plugin)
- Node 22 LTS
- A Firebase project with phone authentication enabled (only needed for real OTP login — the demo account bypasses Firebase entirely)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/<owner>/baaki.git
cd baaki
bun install
```

Start local services:

```bash
docker compose up -d
```

This brings up Postgres on 5432, Redis on 6379, and SeaweedFS S3 on 8333.

Copy the environment template and fill in every value listed in [Environment variables](#environment-variables):

```bash
cp .env.example .env.local
```

Run migrations, seed the demo data, and start the dev server:

```bash
bun db:migrate
bun seed
bun dev
```

Open `http://localhost:3000`.

### Logging in

The fastest path into the app is the demo account: click **"Try as Sharma Packaging"** on the login screen. You are logged in as the seeded owner without touching Firebase.

### Verify the audit chain is armed

```bash
bun check:trigger
```

This must print **permission denied** for both `UPDATE` and `DELETE` on the `events` table. If it does not, the trigger is not protecting the audit chain and the tamper demo is not real.

<br>

## Environment variables

Set these in `.env.local` (or in Render's environment panel in production).

**Required for local development and production:**

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres owner connection string, used for migrations |
| `AUTH_SECRET` | Random 64-character hex string, used to sign sessions and pay-link JWTs |
| `CRON_SECRET` | Random 64-character hex string, sent as a Bearer token to secured cron endpoints |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally, your public URL in production |

**Storage (Cloudflare R2 in production, SeaweedFS locally):**

| Variable | Notes |
|---|---|
| `R2_ENDPOINT_URL` | `http://localhost:8333` locally, your R2 endpoint in production |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | S3 credentials and bucket name |

**Firebase (client config, exposed to the browser by design):**

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase web app config |

**Firebase Admin (server-only):**

| Variable | Notes |
|---|---|
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Service account credentials |

**AI (server-only):**

| Variable | Notes |
|---|---|
| `GEMINI_API_KEY`, `GEMINI_TIMEOUT_MS` | AI chat and OCR; falls back to keyword FAQ on timeout |

**Email:**

| Variable | Notes |
|---|---|
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Email delivery; reply-to is set to the business owner on every send |

> **Never commit** the Firebase service account JSON. It goes in `.env.local` only, and in Render's environment panel in production.

<br>

## Scheduled reminders on Render

Automatic email reminders run as Render Cron Jobs, independently of the app process. Two jobs are declared in `render.yaml`:

1. **Daily reminder dispatch.** Hits `/api/cron/reminders` at 04:30 UTC (10:00 IST) with the cron secret as a Bearer token. The handler derives which ladder stages are due today, skips disputed and promised invoices, sends via Resend (and WhatsApp if templates are approved), logs every send, and appends an audit event.
2. **Hourly cleanup.** Hits `/api/cron/cleanup` to expire OTPs, purge orphaned draft files, and delete stale sessions.

Auto-send is opt-in per stage in Settings. By default, only the friendly heads-up and the due-date reminder go out automatically. Demand letters are never auto-sent. No stage is ever sent twice, no message goes to a paused or disputed invoice, and every message ends with the owner's contact number.

<br>

## Project structure

```
baaki/
├── src/
│   ├── app/
│   │   ├── (app)/                    # Authenticated app shell
│   │   │   ├── dashboard/            # Hero amounts, ageing bar, chase list
│   │   │   ├── invoices/             # List, detail, new wizard, OCR
│   │   │   ├── customers/            # List, detail, new
│   │   │   ├── follow-ups/           # Today's reminders
│   │   │   ├── forecast/             # 13-week cash chart
│   │   │   ├── chase/                # Ranked chase list
│   │   │   ├── payments/             # CSV import, match queue
│   │   │   ├── inbox/                # Disputes and already-paid claims
│   │   │   ├── documents/            # Per-invoice timeline
│   │   │   ├── settings/             # Business, ladder, expenses
│   │   │   └── help/                 # AI chat
│   │   ├── (auth)/                   # Login, signup, reset
│   │   ├── api/                      # Route Handlers
│   │   │   ├── auth/                 # Demo, logout, me, session
│   │   │   ├── invoices/             # CRUD, send, reminder, verify, pay-link
│   │   │   ├── customers/            # CRUD
│   │   │   ├── payments/             # Import, confirm, manual
│   │   │   ├── inbox/                # Accept, reject, edit-invoice
│   │   │   ├── forecast/             # 13-week projection
│   │   │   ├── chase/                # Ranked list
│   │   │   ├── events/               # Verify, timeline
│   │   │   ├── documents/            # Letter, evidence pack
│   │   │   ├── uploads/              # Presign, confirm, signed, view
│   │   │   ├── ai/                   # Chat (SSE), extract-invoice
│   │   │   ├── pay/                  # Public customer link
│   │   │   ├── cron/                 # Reminders, cleanup
│   │   │   └── admin/                # Demo date, reset (dev only)
│   │   ├── print/                    # A4 invoice, letter, evidence pack
│   │   └── pay/                      # Customer-facing invoice page
│   ├── components/                   # UI, domain components, charts, QR
│   ├── lib/
│   │   ├── domain/                   # Pure engines
│   │   ├── db/                       # Drizzle schema, queries, hash-chain helper
│   │   ├── auth/                     # Session, roles, pay-link JWT
│   │   ├── integrations/             # Resend, Gemini, R2, Firebase
│   │   ├── i18n/                     # English and Hindi translations
│   │   ├── templates/                # Reminder copy per stage, per language
│   │   └── csv/                      # Parser and sanitiser
│   ├── data/seed/                    # Business, customers, invoices, expenses, CSV
│   └── store/                        # External store and derived selectors
├── tests/e2e/                        # Playwright specs and golden PDFs
├── scripts/                          # Forbidden token scan, i18n parity,
│                                     # secrets scan, seed, trigger check, smoke test
├── docker/                           # Local Postgres, Redis, SeaweedFS config
└── render.yaml                       # Render Web Service + Cron Job declarations
```
