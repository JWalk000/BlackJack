# Estate

Build and underwrite real estate deals — ground-up or rehab, residential or commercial — with full itemized costs.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Plans

| | Free | Pro ($15/mo) |
|--|------|--------------|
| Deals | Up to **3** in browser `localStorage` | Unlimited |
| Storage | Local only | Cloud sync + auto-save (`user_deals`) |
| Multi-device | No | Yes (signed in + Pro) |
| Bank package PDF | Print → Save as PDF | Same |
| Share link `/package/[token]` | Paywalled | Unlimited |

Billing: Stripe Checkout (subscription) + Customer Portal. Entitlements live in Supabase `profiles` (`plan`, `status`, `stripe_customer_id`).

## Storage modes

| Capability | Without Supabase | With Supabase |
|------------|------------------|---------------|
| Deals | Browser `localStorage` | Cloud table `user_deals` + local offline cache (**Pro**) |
| Auth | Guest only (Sign in explains setup) | Email/password accounts |
| Plan | Free limits | `profiles` row drives Free vs Pro |
| Bank package PDF | Print → Save as PDF | Same |
| Share link `/package/[token]` | Pro only · local file store in dev | Pro only · Postgres `shared_packages` |

Guests work offline under Free limits. Cloud sync and share links require **Pro**.

## Cloud setup (Supabase free tier)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → New query → paste entire contents of [`supabase/schema.sql`](supabase/schema.sql) → Run.
   (Includes `profiles` for billing, `user_deals`, and `shared_packages`.)
3. **Project Settings → API** → copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**server only** — Stripe webhooks)
4. Put them in `.env.local` (local) and Vercel **Environment Variables** (production).
5. **Authentication → Providers → Email**: leave enabled. For fastest MVP testing, turn off **Confirm email**.
6. Restart `npm run dev` / redeploy.

```bash
# Server only — never prefix with NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=
```

### Auth behavior

- Sign up / Sign in in the header (modal).
- **Pro** signed-in users: saves write to `user_deals` and `localStorage`.
- **Free** (guest or signed-in): local only, max 3 deals.
- **My deals** merges cloud + browser only when Pro.
- Sign out clears the session; local cache remains until cleared.

## Stripe billing (Pro)

### Dashboard product

1. Open [Stripe Dashboard](https://dashboard.stripe.com) → **Product catalog**.
2. **Add product** named **Estate Pro** (one product per tier — do not put Free and Pro prices on the same product).
3. **Price**: recurring, **$15.00 USD / month**. Copy the Price ID (`price_...`).
4. **Developers → API keys**: copy **Secret key** (`sk_test_...` or `sk_live_...`). Publishable key is optional for this Checkout redirect flow.
5. **Settings → Billing → Customer portal**: enable cancel / update payment method as desired.
6. **Developers → Webhooks → Add endpoint**
   - Production URL: `https://giddyup.space/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the endpoint **signing secret** (`whsec_...`).

### Env vars

Copy from [`.env.example`](.env.example):

```bash
NEXT_PUBLIC_APP_URL=https://giddyup.space   # local: http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_PRO_MONTHLY=price_...       # from product catalog
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=          # optional
SUPABASE_SERVICE_ROLE_KEY=                  # required for webhooks
```

Never commit real keys. Use placeholders until your Stripe account is ready.

### Local webhook testing

```bash
# Terminal A
npm run dev

# Terminal B — Stripe CLI
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Paste the printed whsec_... into STRIPE_WEBHOOK_SECRET and restart next
```

Prefer the real Checkout flow at `/pricing` so `metadata.supabase_user_id` is set.

### App routes

| Route / API | Purpose |
|-------------|---------|
| `/pricing` | Free vs Pro; Subscribe / Manage billing |
| `POST /api/stripe/checkout` | Checkout Session (`mode: subscription`) |
| `POST /api/stripe/portal` | Customer Portal for cancel/update |
| `POST /api/stripe/webhook` | Updates `profiles.plan` / `status` |

Production webhook: **`https://giddyup.space/api/stripe/webhook`**.

### Flow

1. User signs in → `/pricing` → **Subscribe**.
2. Checkout completes → webhook sets `profiles.plan = pro`.
3. Header shows **Manage billing** (portal) instead of **Upgrade to Pro**.
4. On cancel → webhook sets Free; soft limits resume.

If Stripe keys are missing, the app still builds; Checkout returns a configuration error until env is set.

### Bank package distribution

1. Open a deal → **Final numbers** → **Open bank package** (or `/deals/[id]/package`).
2. **Download PDF for bank** → browser print dialog → Save as PDF (Free + Pro).
3. **Copy share link** → **Pro only** — read-only snapshot at `/package/[token]` (90-day default).
4. Share page disclaimer: *Generated by Estate · not MLS appraisal*.

Share links need durable storage on Vercel → configure Supabase. Locally, files can land under `data/shared/`.

## Find deals (public market data)

**Route:** `/deals/find`

Inventory and benchmarks ship as committed JSON snapshots under `src/data/generated/` (static import — no `fs` in the client). Production does not scrape at request time.

| Source | Use |
|--------|-----|
| [Zillow Research ZHVI](https://www.zillow.com/research/data/) county CSV | Area median home $/sf ≈ ZHVI ÷ 1900 finished sf |
| Harris CAD parcels (ArcGIS) | Residential + vacant parcel sample (assessed/market value) |
| Fort Bend CAD parcels (ArcGIS) | Homes with living area + vacant land |
| [FHFA HPI](https://www.fhfa.gov/data/hpi) (optional) | Houston metro trend badge only |

**CAD assessed/market value ≠ MLS list price.** UI labels price as assessor value and asks users to verify with a realtor.

### Refresh data

```bash
npm run data:pull
```

Writes:

- `src/data/generated/free-leads.json`
- `src/data/generated/area-comps-live.json`
- `data/cache/*` mirrors

Options: `--skip-parcels`, `--skip-hpi`. Redeploy after pull to publish new snapshots.
