# App Samples — Phase 2d (Full-stack Web Flagships) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three flagship example pages — `nextjs-fastapi-postgresql`, `nextjs-fastapi-clerk-stripe`, and `rails-mercari` — introducing the new "フルスタックウェブ" sidebar category, and rewire/add the matching `index.md` rows.

**Architecture:** Three new markdown pages under `docs/examples/`, all proxy-mode. `nextjs-fastapi-postgresql.md` is the canonical single-FQDN full-stack template (Next.js frontend + FastAPI backend + Postgres, same-origin `rewrites`). `nextjs-fastapi-clerk-stripe.md` extends it into a SaaS shape with a **second FQDN** (`api.` subdomain via `expose:`) so Clerk/Stripe webhooks reach the backend with byte-intact bodies for HMAC verification — its defining pattern. `rails-mercari.md` is the heaviest: a **3-FQDN**, 6-service Rails stack (nginx + Rails/Puma + Sidekiq + Redis + Dex OIDC + Postgres) with OIDC on an `auth.` subdomain and blue/green on an `app.` subdomain. A new sidebar category "フルスタックウェブ" is created in `docs/.vitepress/config/ja.ts` between "Webフレームワーク" and "AI / GPU" (first landing). `docs/index.md` rewires two existing rows (nextjs-fastapi-postgresql, rails-mercari) and **adds a new row** for nextjs-fastapi-clerk-stripe (it has no row today). Build verified by `npx vitepress build docs` after each commit. One PR for the whole phase.

**Tech Stack:** VitePress 1.6.4, markdown. Source-of-truth: `crowdy/conoha-cli-app-samples` `main` — each sample's `README.md`, `conoha.yml`, `compose.yml`, and (clerk-stripe only) `.env.example`. Blog drafts exist but are STALE for two of the three — see per-task warnings; trust README/conoha.yml/compose.yml.

**Spec:** `docs/superpowers/specs/2026-06-05-app-samples-reflection-design.md`

**Reference flagships (read before writing):**
- `docs/examples/dify-https.md` (multi-FQDN `expose:` pattern — closest peer for clerk-stripe and rails-mercari)
- `docs/examples/outline.md` (Dex OIDC on a subdomain + `blue_green: false` + health-path override — closest peer for rails-mercari)
- `docs/examples/opencascade-fem.md` / `docs/examples/supabase-selfhost.md` (canonical flagship structure)
- `docs/examples/nextjs.md`, `docs/examples/rails-postgresql.md` (simpler siblings to link "step down" to)

## Global Constraints

- **No front-matter** on any page.
- **Absolute internal links** only: `/examples/<sample>`, `/guide/<topic>`.
- **Secret-handling (CONTRIBUTING.md):** all secrets shown as `${VAR:?required}`. **Never** print literal Clerk/Stripe keys (`pk_`, `sk_`, `whsec_`, `price_`) — the clerk-stripe `.env.example` uses `xxxxx` placeholders; keep them as `${VAR:?required}` in the page. The compose files ship hardcoded demo DB creds (`appuser`/`apppass`, `postgres`/`postgres`, `dex`/`dex`) — **do not reproduce those literals**; show `${VAR:?required}` and `openssl rand` generation. No real IPs (only `0.0.0.0`/`127.0.0.1`), no real tenant UUIDs. Placeholder FQDNs: root = `<sample>.example.com`; subdomains = `api.example.com`, `app.example.com`, `auth.example.com`.
- **`（サンプルで設定済み）`** not `（デフォルト）` for sample-set values.
- **conoha-cli version floors:** `nextjs-fastapi-clerk-stripe` and `rails-mercari` require **conoha-cli >= v0.6.1** (blue/green + `expose:` correctness). State this in 前提条件 for both. `nextjs-fastapi-postgresql` has no special floor (single FQDN).
- **Build clean:** `npx vitepress build docs` — no dead-link or sidebar warnings.
- **Sidebar category naming** must match spec IA verbatim: `フルスタックウェブ`.
- **ja locale only** (no en/ko changes).
- **Reproduce upstream `conoha.yml` inline comments verbatim** in each page's YAML block — they are authoritative prose.

---

## Task 1: Create branch and confirm clean baseline

**Files:** none (verification only).

- [ ] **Step 1.1:** Confirm on main and pull latest. If executing after Phase 2c merges, Phase 2c should be in the log; either way branch from current `main`.

```bash
git checkout main
git pull --ff-only origin main
npx vitepress build docs
```

Expected: clean build.

- [ ] **Step 1.2:** Create the working branch:

```bash
git checkout -b docs/examples-phase2d-fullstack-flagships
```

- [ ] **Step 1.3:** Add this plan file and commit it (tags along into the PR):

```bash
git add docs/superpowers/plans/2026-07-07-app-samples-phase2d-fullstack-flagships.md
git commit -m "docs(plan): add phase-2d fullstack flagships implementation plan"
```

---

## Universal per-page checklist (Tasks 2–4)

For every page:

- [ ] **Read source material** from `crowdy/conoha-cli-app-samples` `main` in this order:
  1. `<sample>/README.md`
  2. `docs/blogs/<sample>.md` / related blog if it exists (use ONLY for feature narrative; the blogs for clerk-stripe and rails-mercari document older no-proxy layouts — do not follow their infra)
  3. `<sample>/conoha.yml` (reproduce inline comments verbatim)
  4. `<sample>/compose.yml`
  5. `<sample>/.env.example` (clerk-stripe only)
- [ ] **Open the reference flagship pages** listed above; match section shape, do not copy prose.
- [ ] **Page sections (mandatory order, adapt per per-sample notes):**
  1. `# <タイトル> デプロイ` (H1)
  2. 1–3 paragraph intro (state proxy mode + FQDN count)
  3. `::: tip 本例は proxy モード対応 (\`conoha.yml\` 同梱)` callout
  4. `## 完成イメージ` — 3–5 bullets
  5. `## アーキテクチャ` — ASCII diagram (request flow) + stack table
  6. `## 前提条件` — CLI (+ version floor where noted), server, DNS A records (state the count explicitly), proxy boot, RAM, and any EXTERNAL prerequisites (Clerk/Stripe accounts for clerk-stripe)
  7. `## 1. conoha.yml` — VERBATIM (with upstream comments) + prose on each non-obvious feature (`expose:` subdomains, health-path overrides, `blue_green`, accessories)
  8. `## 2. compose.yml (抜粋)` — operationally important excerpt; link full file at `https://github.com/crowdy/conoha-cli-app-samples/blob/main/<sample>/compose.yml`
  9. `## 3. 環境変数 (\`.env\`)` — must-set vars as `${VAR:?required}`
  10. `## 4. デプロイ` — proxy flow with DNS A-record count noted; first-deploy duration honest
  11. `## 5. 動作確認` — browser walk + `curl` health check at the documented endpoint
  12. `## カスタマイズ` — provider/DB/scaling knobs
  13. `## ハマりどころ` — 3–6 entries (`::: warning` where apt)
  14. `## 関連リンク` — recipe (GitHub), upstream project(s), related samples
- [ ] **Conventions:** see Global Constraints. All code fences balanced; all `:::` callouts closed.
- [ ] **Pre-commit sanity checks:**

```bash
wc -l docs/examples/<sample>.md
grep -E "_PASSWORD=[^\$]|_SECRET=[^\$]|_TOKEN=[^\$]|Bearer |sk_[a-zA-Z0-9]|pk_[a-zA-Z0-9]|whsec_|hf_[a-zA-Z0-9]|price_[a-zA-Z0-9]" docs/examples/<sample>.md
grep -E "([0-9]{1,3}\.){3}[0-9]{1,3}" docs/examples/<sample>.md | grep -v "0\.0\.0\.0\|127\.0\.0\.1"
npx vitepress build docs
```

Expected: no secret/IP output; clean build. (`$(openssl rand ...)` generation commands are acceptable and are excluded by the `[^\$]` guard.)

- [ ] **Commit:** one commit per page.

---

## Task 2: nextjs-fastapi-postgresql (proxy, single FQDN, canonical full-stack template)

**Files:**
- Create: `docs/examples/nextjs-fastapi-postgresql.md`

**Interfaces:**
- Produces: `docs/examples/nextjs-fastapi-postgresql.md`. Related-links must link `/examples/nextjs-fastapi-clerk-stripe` (Task 3) and `/examples/rails-mercari` (Task 4) and `/examples/nextjs`.

**Sample brief (authoritative — upstream `main`):**

- **Mode:** proxy, single FQDN (1 DNS A record). No `expose:` subdomain. No `.env.example` (config is inline in compose).
- **Headline story:** the canonical, reference full-stack template — Next.js 16 (App Router, Server Components) + FastAPI + PostgreSQL 17, one `conoha app deploy`, zero local toolchain (all builds run server-side in Docker multi-stage). A corporate site with a News-article CRUD. Same-origin (single port 80) → no CORS. Other samples (clerk-stripe SaaS) extend this.
- **conoha.yml — reproduce VERBATIM:**

```yaml
name: nextjs-fastapi-postgresql
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - nextjs-fastapi-postgresql.example.com
web:
  service: frontend
  port: 3000
# `backend` and `db` are marked as accessories: they're reached only
# from `frontend` over the internal compose network, so they stay alive
# across blue/green swaps — only `frontend` is duplicated per slot.
accessories:
  - backend
  - db
```

- **compose.yml excerpt to show** (link full file): 3 services. `frontend` (`build: ./frontend`, `expose: ["3000"]` — no host port; `NEXT_PUBLIC_API_URL=http://localhost/api`; `depends_on backend: service_healthy`). `backend` (`build: ./backend`, `expose: ["8000"]`, `DATABASE_URL=postgresql+asyncpg://appuser:apppass@db:5432/appdb`, healthcheck = a Python one-liner hitting `/api/health`). `db` (`postgres:17`, `POSTGRES_DB=appdb`/`POSTGRES_USER=appuser`/`POSTGRES_PASSWORD=apppass` — **mask the password as `${POSTGRES_PASSWORD:?required}` in the doc**, `pg_isready` healthcheck, `db_data` volume).
- **The routing mechanism (`next.config.ts` — show it):**

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://backend:8000/api/:path*" },
    ];
  },
};
```

Browser/SSR hit `/api/...` on the Next.js origin; Next's `rewrites` forward to `http://backend:8000`. No API subdomain, no CORS. `NEXT_PUBLIC_API_URL=http://localhost/api` relies on this same-origin rewrite path.
- **Environment variables** (no `.env.example`; overridable via `.env.server` at deploy): `POSTGRES_PASSWORD` (secret — shown as `${POSTGRES_PASSWORD:?required}`). **Flag the discrepancy**: README says to override `DB_PASSWORD`, but compose actually uses `POSTGRES_PASSWORD` AND embeds `apppass` inside `DATABASE_URL`, so a production password change must update **both** `POSTGRES_PASSWORD` and `DATABASE_URL`.
- **Architecture:**

```
ブラウザ → :80 → [frontend (Next.js)]
                      │ rewrites /api/* → backend:8000/api/*
                      ▼
                  [backend (FastAPI)]
                      │ asyncpg
                      ▼
                  [db (PostgreSQL 17)]
```

Only port 80 (frontend) is public; backend:8000 and db:5432 are internal only. API endpoints: `GET /api/health`, `GET|POST /api/posts`, `GET|PUT|DELETE /api/posts/{id}`. Pages: `/`, `/news`, `/news/new`, `/news/{id}`, `/news/{id}/edit`.
- **完成イメージ (bullets):** corporate-style top page (Hero / services / news / company / recruit CTA) at `https://<FQDN>`; `/news` list + `/news/{id}` detail; `/news/new` create, `/news/{id}/edit` edit, delete with confirm dialog — full CRUD; `curl https://<FQDN>/api/posts` works same-origin (`/api/health` health check); success = all 3 containers `Up (healthy)`.
- **前提条件:** conoha-cli, ConoHa VPS3, SSH key. **1 DNS A record.** Proxy boot required. **`g2l-t-2` (2GB)** sufficient. Tables auto-created at FastAPI startup (no Alembic).
- **ハマりどころ:**
  1. **API base URL: build-time vs runtime.** `NEXT_PUBLIC_API_URL=http://localhost/api` works via the server-side Next rewrite; **direct browser-side JS calls won't work** (`localhost` = the server itself). Adding client fetches needs care.
  2. `output: "standalone"` is required; removing it breaks `server.js` startup.
  3. DB migrations auto-run only on first boot (`lifespan` runs `Base.metadata.create_all`) — it only *creates missing* tables; schema changes to existing tables are NOT applied (no Alembic).
  4. blue/green + DB: `db`/`backend` are accessories (not restarted on swap); only `frontend` rotates. The DB is shared across slots.
  5. No CORS middleware (same-origin by design); a cross-origin/subdomain split would need CORS added.
  6. README/compose password-var mismatch (see Environment variables) — change both `POSTGRES_PASSWORD` and `DATABASE_URL`; never ship the literal `apppass`.
- **Screenshots:** none upstream.
- **関連リンク:** Recipe (GitHub `tree/main/nextjs-fastapi-postgresql`); `/examples/nextjs-fastapi-clerk-stripe` (SaaS extension); `/examples/rails-mercari` (heavier full-stack peer); `/examples/nextjs` (plain Next.js); Next.js / FastAPI docs; conoha-cli.

- [ ] **Step 2.1:** Read source material per the universal checklist.
- [ ] **Step 2.2:** Write `docs/examples/nextjs-fastapi-postgresql.md` following the brief and the universal section order. Target ~250–320 lines.
- [ ] **Step 2.3:** Run pre-commit sanity checks. Expected: clean.
- [ ] **Step 2.4:** Commit:

```bash
git add docs/examples/nextjs-fastapi-postgresql.md
git commit -m "$(cat <<'EOF'
docs(examples): add nextjs-fastapi-postgresql flagship page

Canonical full-stack template — single-FQDN same-origin Next.js rewrite
to FastAPI, Postgres accessory, tables auto-created at startup.
EOF
)"
```

---

## Task 3: nextjs-fastapi-clerk-stripe (proxy, 2 FQDNs, SaaS with Clerk auth + Stripe billing)

**Files:**
- Create: `docs/examples/nextjs-fastapi-clerk-stripe.md`

**Interfaces:**
- Consumes: builds on the `nextjs-fastapi-postgresql` shape (Task 2). Produces: `docs/examples/nextjs-fastapi-clerk-stripe.md`. Related-links must link `/examples/nextjs-fastapi-postgresql` (base template).

**⚠️ Source conflict:** the canonical files (`README.md`, `conoha.yml`, `compose.yml`, `.env.example`) describe the **current proxy-mode / multi-subdomain / HTTPS** design. The blog draft (`docs/blogs/nextjs-fastapi-clerk-stripe.md`) documents an **older no-proxy HTTP variant** (`ports: 8000:8000`, webhooks over `http://<IP>:8000`). **Follow README + conoha.yml (proxy, multi-subdomain, HTTPS).** Treat blog `crypto.subtle`/HTTP notes as historical dev-mode only.

**Sample brief (authoritative — upstream `main`):**

- **Mode:** proxy, **2 FQDNs** (root + `api.` subdomain via `expose:`). Requires **conoha-cli >= v0.6.1**.
- **Headline story:** a production-shaped SaaS — Clerk-managed auth + Stripe subscription billing on Next.js 16 (App Router, shadcn/ui) + FastAPI + Postgres 17. Flow: sign up → pick Free/Pro/Enterprise → Stripe Checkout → gated dashboard → self-serve Customer Portal. Multi-subdomain so third-party webhooks (Clerk, Stripe) land on the API subdomain with byte-intact bodies for HMAC verification.
- **conoha.yml — reproduce VERBATIM:**

```yaml
name: nextjs-fastapi-clerk-stripe
# Replace with your own FQDN before running `conoha app init`.
# Only the root web host goes here. Subdomains (e.g. api.example.com)
# are declared per-block under `expose:` below — listing them here too
# fails validation ("host duplicates an entry in hosts[]"). The proxy
# ACMEs both the root and each expose host independently as long as
# DNS A records exist for them.
hosts:
  - nextjs-fastapi-clerk-stripe.example.com
web:
  service: frontend
  port: 3000
# FastAPI backend, exposed on its own subdomain so Clerk / Stripe can
# deliver webhooks directly to /api/webhooks/* without going through
# Next.js's rewrite (which mutates the request body and breaks HMAC
# signature verification). blue_green defaults to true — FastAPI is
# stateless, so slot rotation is safe; Postgres state lives in the
# `db` accessory and is shared across slots.
expose:
  - label: api
    host: api.example.com
    service: backend
    port: 8000
    # Proxy default `/up` 404s on FastAPI; the app exposes /api/health.
    health:
      path: /api/health
# `db` (PostgreSQL) only serves other compose services internally
# and shouldn't be duplicated per blue/green slot.
accessories:
  - db
```

- **compose.yml env-wiring (show the load-bearing structure):**
  - `frontend`: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is passed BOTH as `build.args` AND `environment` (it's **baked into the Next.js build**); `CLERK_SECRET_KEY` in `environment` (SSR needs it); plus `BACKEND_INTERNAL_URL=http://backend:8000`, `NEXT_PUBLIC_API_URL=http://localhost/api`, and the `NEXT_PUBLIC_CLERK_SIGN_IN/UP*` route vars.
  - `backend`: `expose: ["8000"]`, `DATABASE_URL=postgresql+asyncpg://appuser:apppass@db:5432/appdb` (mask password). **Critical comment to reproduce:** Stripe/Clerk secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CLERK_WEBHOOK_SECRET`, `CLERK_JWKS_URL`, `STRIPE_PRO_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID`) are **deliberately omitted** from compose `environment:` because compose's `${VAR}` interpolation would override the `.env.server` that `conoha app env set` injects. Only `DATABASE_URL` (internal) stays.
  - `db`: `postgres:17`, demo creds `appuser`/`apppass`/`appdb` (internal only — mask in doc), `db_data` volume.
- **Environment variables (from `.env.example`; ALL as `${VAR:?required}`):**

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:?required}
CLERK_SECRET_KEY=${CLERK_SECRET_KEY:?required}
CLERK_WEBHOOK_SECRET=${CLERK_WEBHOOK_SECRET:?required}
CLERK_JWKS_URL=${CLERK_JWKS_URL:?required}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:?required}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:?required}
STRIPE_PRO_PRICE_ID=${STRIPE_PRO_PRICE_ID:?required}
STRIPE_ENTERPRISE_PRICE_ID=${STRIPE_ENTERPRISE_PRICE_ID:?required}
```

Purposes: publishable key (build-time baked, frontend), Clerk secret (SSR session verify), Clerk webhook signing secret (`user.created` HMAC), Clerk JWKS URL (verify Clerk JWTs), Stripe secret key (Checkout/Customer/Portal API), Stripe webhook signing secret (HMAC), two Stripe Price IDs (Pro ¥980/mo, Enterprise ¥4,980/mo). **Never show real `pk_`/`sk_`/`whsec_`/`price_` values.**
- **Architecture:** root FQDN → frontend (Next.js :3000); `api.` FQDN → backend (FastAPI :8000); db accessory (Postgres, shared across slots). Backend routers: `checkout.py` (Stripe Checkout + Portal), `subscription.py` (state), `webhooks.py` (Clerk + Stripe). Webhook endpoints: `POST /api/webhooks/clerk` (`user.created`), `POST /api/webhooks/stripe` (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`). Webhooks hit the **api subdomain directly** (not the Next rewrite) so raw body bytes survive HMAC verification — this is the entire reason for the second FQDN. API calls carry a Clerk JWT (`Authorization: Bearer`), verified against `CLERK_JWKS_URL`.
- **完成イメージ (bullets):** sign up from `/sign-up` (Clerk 日本語 UI); `/pricing` shows Free / Pro (¥980) / Enterprise (¥4,980); "このプランを選択" → Stripe Checkout (日本語), test card `4242 4242 4242 4242`; `/dashboard` reflects subscription state; "サブスクリプション管理" opens Stripe Customer Portal; `https://api.<FQDN>/api/health` returns `{"status":"ok"}`.
- **前提条件:** conoha-cli **>= v0.6.1**, ConoHa VPS3, SSH key. **2 DNS A records** (root + `api.<FQDN>`). Proxy boot. **`g2l-t-2` (2GB)**. **External prerequisites (surface prominently):**
  - **Clerk account + app:** Publishable Key / Secret Key; create a `user.created` webhook → `https://api.<FQDN>/api/webhooks/clerk`; get Signing Secret + JWKS URL; register the production FQDN in allowed origins / redirect URLs.
  - **Stripe account (test mode):** 2 Products (Pro ¥980, Enterprise ¥4,980, recurring JPY) + their Price IDs; a webhook → `https://api.<FQDN>/api/webhooks/stripe` (3 events); Signing Secret; **enable Customer Portal** (dashboard-only, no API).
- **ハマりどころ (`::: warning`):**
  1. **Webhooks must target the api subdomain directly** — pointing them at the root FQDN (Next rewrite) mutates the body and HMAC verification fails with 400. Always `https://api.<FQDN>/api/webhooks/*`.
  2. Webhook signing secrets are per-URL — `STRIPE_WEBHOOK_SECRET`/`CLERK_WEBHOOK_SECRET` must match the exact registered endpoint URL.
  3. `NEXT_PUBLIC_*` are baked at build time (esp. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` via `build.args`); changing keys needs a rebuild, not just an env change.
  4. Clerk redirect URLs / allowed origins must include the FQDN, or post-login redirects go to `accounts.dev`.
  5. test vs live keys — demo uses Stripe test mode + Clerk `pk_test_`/`sk_test_`; production needs live keys (+ NEXT_PUBLIC rebuild).
  6. Don't add backend secrets to compose `environment:` — `${VAR}` interpolation there overrides `conoha app env set`.
- **Screenshots:** none upstream.
- **関連リンク:** Recipe (GitHub `tree/main/nextjs-fastapi-clerk-stripe`); `/examples/nextjs-fastapi-postgresql` (base template); Clerk (https://clerk.com/), Stripe (https://stripe.com/) docs; conoha-cli.

- [ ] **Step 3.1:** Read source material (README, conoha.yml, compose.yml, `.env.example`) per the universal checklist. Do NOT follow the stale no-proxy blog.
- [ ] **Step 3.2:** Write `docs/examples/nextjs-fastapi-clerk-stripe.md`. Include an explicit "外部サービスの準備 (Clerk / Stripe)" subsection under 前提条件. Target ~300–380 lines.
- [ ] **Step 3.3:** Run pre-commit sanity checks — pay special attention to the secret scan (the `price_` pattern is included). Expected: clean.
- [ ] **Step 3.4:** Commit:

```bash
git add docs/examples/nextjs-fastapi-clerk-stripe.md
git commit -m "$(cat <<'EOF'
docs(examples): add nextjs-fastapi-clerk-stripe flagship page

SaaS shape — Clerk auth + Stripe billing, api subdomain via expose: so
webhooks reach the backend with byte-intact bodies for HMAC verify.
EOF
)"
```

---

## Task 4: rails-mercari (proxy, 3 FQDNs, Rails + Dex OIDC + Sidekiq/Redis)

**Files:**
- Create: `docs/examples/rails-mercari.md`

**Interfaces:**
- Produces: `docs/examples/rails-mercari.md`. Related-links must link `/examples/outline`, `/examples/gitea`, `/examples/hydra-python-api`, `/examples/rails-postgresql`.

**⚠️ Source conflict + premise corrections:** the blog draft (`docs/blogs/rails-sidekiq-dex.md`) is a **pre-refactor snapshot** (single root nginx, HTTP, IP-based, no `expose:`, no blue/green). **Trust README + conoha.yml + compose.yml** (HTTPS, 3-FQDN, blue/green). Also correct two common misconceptions: (a) **nginx here does NOT serve static assets** — `nginx.conf` only reverse-proxies (`/`→Rails, `/dex/`→Dex); no `root`/`try_files`/assets volume; the Dockerfile does NOT run `assets:precompile`; Rails/Puma serves everything. (b) **`RAILS_MASTER_KEY` is NOT used** — the app reads `SECRET_KEY_BASE` directly from env; do not invent `RAILS_MASTER_KEY` or `credentials.yml.enc`.

**Sample brief (authoritative — upstream `main`):**

- **Mode:** proxy, **3 FQDNs** (root nginx + `app.` Rails + `auth.` Dex). Requires **conoha-cli >= v0.6.1**.
- **Headline story:** production-shaped Rails 8.1 marketplace ("Mercari風") — OIDC SSO via Dex + Sidekiq/Redis async background jobs + nginx reverse-proxy aggregation + Postgres 17. Six-service stack, deployable with one command, zero local Ruby/Node.
- **conoha.yml — reproduce VERBATIM (long comments are authoritative — keep them):**

```yaml
name: rails-mercari
# Replace with your own FQDN before running `conoha app init`.
# Only the root web host goes here. Subdomains (e.g. auth.example.com,
# app.example.com) are declared per-block under `expose:` below — listing
# them here too fails validation ("host duplicates an entry in hosts[]").
# The proxy ACMEs the root and each expose host independently as long as
# DNS A records exist for them.
hosts:
  - rails-mercari.example.com
# nginx remains as the root web (port 80). It proxies both Rails (`web`) and
# Dex internally on the compose network — kept for backward compatibility
# and so the root FQDN still serves the app shell. The `expose:` blocks
# below add direct subdomain access for two reasons:
#   - `auth.example.com` so the browser OIDC discovery + redirect flow
#     reaches Dex under HTTPS (the original layout could not).
#   - `app.example.com` so the Rails `web` service gets its own slot-aware
#     blue/green rotation on `app deploy` (nginx-only blue/green left the
#     inner Rails container pinned to the build it was created with).
web:
  service: nginx
  port: 80
expose:
  # Dex OIDC provider, exposed on its own subdomain so the browser
  # discovery + redirect flow can reach it under HTTPS. blue_green: false
  # because Dex isn't slot-aware (Postgres-backed sessions / approval
  # state would diverge across slots otherwise).
  - label: auth
    host: auth.example.com
    service: dex
    port: 5556
    blue_green: false
    # Dex's default `/up` 404s; `/dex/healthz` returns 200 once OIDC is up.
    health:
      path: /dex/healthz
  # Rails app on its own subdomain with blue/green so code changes to
  # the `web` service rotate cleanly across slots (the previous
  # nginx-only blue/green didn't re-roll the Rails container).
  - label: app
    host: app.example.com
    service: web
    port: 3000
    blue_green: true
    # Rails 8.1 ships `/up` (rails/health#show); this sample's routes
    # are hand-written so the route is added explicitly in
    # config/routes.rb. First start runs DB migrations and can take ~30s.
    health:
      path: /up
      unhealthy_threshold: 24    # 24 × 5s = 120s
# `db` (PostgreSQL), `redis`, and `sidekiq` only serve compose-internal
# traffic and shouldn't be duplicated per blue/green slot. `sidekiq`
# stays accessory per issue #54 §1.3 (worker services out of scope).
accessories:
  - db
  - redis
  - sidekiq
```

- **compose.yml excerpt (6 services; no host ports — `expose:` only):**
  - `nginx` (`nginx:alpine`, `expose 80`, mounts `./nginx.conf`, `depends_on web + dex`) — reverse-proxy only.
  - `web` (Rails, `build: .`, `expose 3000`): env `RAILS_ENV=production`, `DB_HOST=db`, `DB_USER=postgres`, `DB_PASSWORD=${DB_PASSWORD:-postgres}` (mask), `DB_NAME=app_production`, `SECRET_KEY_BASE=${SECRET_KEY_BASE:-...}` (mask), `REDIS_URL=redis://redis:6379/0`, `OIDC_CLIENT_ID=mercari-app`. **`OIDC_EXTERNAL_HOST`/`OIDC_REDIRECT_URI`/`OIDC_CLIENT_SECRET` are deliberately omitted** from compose (they arrive via `.env.server` from `conoha app env set`; compose `${VAR:-default}` would override them).
  - `sidekiq` (same image, `command: bundle exec sidekiq`, same DB/Redis env).
  - `redis` (`redis:7-alpine`, `redis_data` volume, `redis-cli ping` healthcheck).
  - `dex` (`dexidp/dex:v2.45.1`, templated from `dex.yml` via `sed` at entrypoint, `expose 5556`, container healthcheck hits telemetry port **5558** `/healthz`).
  - `db` (`postgres:17-alpine`, creates a separate `dex` database via `init-db.sh`, `pg_isready` healthcheck, `db_data` volume).
  - `bin/docker-entrypoint` runs `./bin/rails db:prepare` before boot → first-boot migrations (hence `/up` `unhealthy_threshold: 24`).
- **`nginx.conf` (show it — it's short and dispels the "nginx serves assets" myth):**

```nginx
upstream rails { server web:3000; }
upstream dex_upstream { server dex:5556; }
server {
    listen 80;
    location /dex/ {
        proxy_pass http://dex_upstream/dex/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location / {
        proxy_pass http://rails;
        proxy_set_header Host $host;
    }
}
```

- **Environment variables (no `.env.example`; set via `conoha app env set`; all secrets as `${VAR:?required}` + `openssl rand`):**
  - `DB_PASSWORD` (secret) — Postgres `postgres` user pw. `openssl rand -base64 32`.
  - `SECRET_KEY_BASE` (secret) — Rails session/cookie signing. `openssl rand -hex 64`.
  - `DEX_DB_PASSWORD` (secret) — Dex's Postgres user pw. `openssl rand -base64 32`.
  - `DEX_ISSUER_HOST` (required, not secret) — browser-facing Dex host; builds `issuer: https://<host>/dex`. Must be the real `auth.<FQDN>`.
  - `RAILS_HOST` (required, not secret) — browser-facing Rails host; builds redirect_uri `https://<host>/auth/dex/callback`. Must be the real `app.<FQDN>`.
  - `RAILS_OIDC_CLIENT_ID` (not secret) — Dex static client id (`mercari-app`); must match `OIDC_CLIENT_ID`.
  - `RAILS_OIDC_CLIENT_SECRET` (secret) — Dex side of the OIDC client secret.
  - `OIDC_CLIENT_SECRET` (secret) — Rails/OmniAuth side; **must exactly equal `RAILS_OIDC_CLIENT_SECRET`** (README explicit warning; mismatch breaks token exchange).
  - **Known limitation (README + conoha-cli#166):** `DB_PASSWORD`/`SECRET_KEY_BASE`/`DEX_DB_PASSWORD` keep `${VAR:-default}` interpolation in `web`/`db`, so user-set env_file values are not picked up until #166 is fixed (workaround: remove the interpolation in compose.yml). OIDC vars avoid this by being omitted from `environment:`.
- **Architecture (3 HTTPS entry points):**

```
Browser ─┬─ https://rails-mercari.example.com → proxy → nginx:80 ─┬─ / → web:3000 (Rails/Puma)
         │                                                        └─ /dex/ → dex:5556
         ├─ https://app.example.com  → proxy → web:3000  (Rails direct, blue/green)
         └─ https://auth.example.com → proxy → dex:5556  (OIDC issuer)
                internal: web/sidekiq → db:5432, redis:6379 ; dex → db:5432 (separate `dex` DB)
```

`web` blue/green true; `dex` `blue_green: false`; `db`/`redis`/`sidekiq` accessories. **OIDC split-horizon** (`config/initializers/omniauth.rb`): browser-facing endpoints use HTTPS `auth.`/`app.` subdomains; server-to-server (token/userinfo/jwks) use internal `http://dex:5556/dex` (`discovery: false`, manual endpoints, because the `openid_connect` gem forces HTTPS while internal traffic is plain HTTP).
- **完成イメージ (bullets):** home shows a marketplace item listing; "Dexでログイン" → Dex login on `auth.` → sign in as `seller@example.com` / `password` → back to Rails via `/auth/dex/callback`; as seller "出品する" to list an item (states `on_sale`/`sold`); log in as `buyer@example.com`, "購入する" → item flips to SOLD; purchase triggers a Sidekiq async job (`PurchaseNotificationJob`) visible in `conoha app logs`: `[NOTIFICATION] Item '...' purchased ...`. Test users (from `dex.yml`): `seller@example.com` and `buyer@example.com`, password `password`.
- **前提条件:** conoha-cli **>= v0.6.1**, ConoHa VPS3, SSH key. **3 DNS A records** → same server IP: root `rails-mercari.example.com`, `app.example.com`, `auth.example.com` (each gets its own Let's Encrypt cert). Proxy boot. **RAM: heavy — 6 containers** (Rails/Puma + Sidekiq both load full Rails, + Postgres + Redis + Dex + nginx); blog uses **`g2l-t-2`**; recommend 2GB+, and note blue/green temporarily doubles Rails+nginx slots at deploy time (peak memory).
- **ハマりどころ (`::: warning`):**
  1. **OIDC client secret mismatch** — `RAILS_OIDC_CLIENT_SECRET` (Dex) must exactly equal `OIDC_CLIENT_SECRET` (Rails); mismatch → token exchange fails.
  2. **`RAILS_HOST` / `DEX_ISSUER_HOST` must be the real FQDNs** — redirect_uri and issuer are built from them; wrong values → callback / issuer-claim failures.
  3. compose `${VAR:-default}` interpolation swallows user secrets for `DB_PASSWORD`/`SECRET_KEY_BASE`/`DEX_DB_PASSWORD` (conoha-cli#166); OIDC vars are kept OUT of `environment:` to avoid this — don't add them back.
  4. OIDC discovery + HTTP → sample sets `discovery: false` and hardcodes internal endpoints to `http://dex:5556/dex`; enabling discovery breaks in-cluster HTTP calls.
  5. Dex isn't slot-aware → `blue_green: false`; Sidekiq stays an accessory. Don't flip these to blue/green.
  6. First-boot DB migrations take time (`rails db:prepare`; `/up` `unhealthy_threshold: 24` ≈ 120s); `init-db.sh` creates the `dex` DB only on an empty volume. Dex health uses `/dex/healthz` (proxy) and `:5558/healthz` (container) — not `/up`.
- **Screenshots:** none upstream.
- **関連リンク:** Recipe (GitHub `tree/main/rails-mercari`); `/examples/outline` (Dex OIDC-on-subdomain peer); `/examples/gitea` (Gitea + Dex OIDC — the predecessor); `/examples/hydra-python-api` (alternative OIDC provider); `/examples/rails-postgresql` (simpler Rails step-down); Dex (dexidp.io), Sidekiq (sidekiq.org); conoha-cli.

- [ ] **Step 4.1:** Read source material (README, `rails-sidekiq-dex.md` blog for feature narrative only, conoha.yml, compose.yml, nginx.conf, `config/initializers/omniauth.rb`) per the universal checklist.
- [ ] **Step 4.2:** Write `docs/examples/rails-mercari.md` following the brief. Reproduce the long conoha.yml comments verbatim. Target ~320–400 lines.
- [ ] **Step 4.3:** Run pre-commit sanity checks. Expected: clean.
- [ ] **Step 4.4:** Commit:

```bash
git add docs/examples/rails-mercari.md
git commit -m "$(cat <<'EOF'
docs(examples): add rails-mercari flagship page

3-FQDN Rails marketplace — Dex OIDC on auth. subdomain (blue_green false),
Rails on app. subdomain (blue/green), Sidekiq/Redis async jobs.
EOF
)"
```

---

## Task 5: Sidebar — create the "フルスタックウェブ" category

**Files:**
- Modify: `docs/.vitepress/config/ja.ts`

**Interfaces:**
- Consumes: `/examples/nextjs-fastapi-postgresql` (Task 2), `/examples/nextjs-fastapi-clerk-stripe` (Task 3), `/examples/rails-mercari` (Task 4) — all must exist on the branch before this build check.

Per the spec IA, "フルスタックウェブ" sits between "Webフレームワーク" and "AI / GPU". First landing (CONTRIBUTING rule 3 satisfied).

- [ ] **Step 5.1:** Edit `docs/.vitepress/config/ja.ts`. Match this exact `old_string` (boundary between the Web section's close and the AI / GPU section's open):

old_string:
```ts
            { text: 'Rust Actix-web', link: '/examples/rust-actix-web' },
          ],
        },
        {
          text: 'AI / GPU',
```

new_string:
```ts
            { text: 'Rust Actix-web', link: '/examples/rust-actix-web' },
          ],
        },
        {
          text: 'フルスタックウェブ',
          items: [
            { text: 'Next.js + FastAPI + PostgreSQL', link: '/examples/nextjs-fastapi-postgresql' },
            { text: 'Next.js + FastAPI + Clerk + Stripe (SaaS)', link: '/examples/nextjs-fastapi-clerk-stripe' },
            { text: 'Rails メルカリ風 (OIDC + Sidekiq)', link: '/examples/rails-mercari' },
          ],
        },
        {
          text: 'AI / GPU',
```

- [ ] **Step 5.2:** Build clean:

```bash
npx vitepress build docs
```

Expected: clean build, no dead-link warnings.

- [ ] **Step 5.3:** Commit:

```bash
git add docs/.vitepress/config/ja.ts
git commit -m "$(cat <<'EOF'
docs(sidebar): add フルスタックウェブ category with 3 phase-2d flagships

First landing of the Full-stack Web category (spec IA #3), inserted
between Webフレームワーク and AI / GPU.
EOF
)"
```

---

## Task 6: index.md rewire — 2 rows internal + add the missing clerk-stripe row

**Files:**
- Modify: `docs/index.md`

The フルスタックウェブ table (around lines 67–76) already has rows for `nextjs-fastapi-postgresql` and `rails-mercari` (GitHub links) but **no row for `nextjs-fastapi-clerk-stripe`** — add it.

- [ ] **Step 6.1:** Edit 1 — rewire `nextjs-fastapi-postgresql`. old_string:

```markdown
| [nextjs-fastapi-postgresql](https://github.com/crowdy/conoha-cli-app-samples/tree/main/nextjs-fastapi-postgresql) | Next.js + FastAPI + PostgreSQL の CRUD ひな型 |
```

new_string (two rows — inserts the clerk-stripe row right after):
```markdown
| [nextjs-fastapi-postgresql](/examples/nextjs-fastapi-postgresql) | Next.js + FastAPI + PostgreSQL の CRUD ひな型 |
| [nextjs-fastapi-clerk-stripe](/examples/nextjs-fastapi-clerk-stripe) | Clerk 認証 + Stripe サブスクの SaaS デモ (マルチサブドメイン) |
```

- [ ] **Step 6.2:** Edit 2 — rewire `rails-mercari`. old_string:

```markdown
| [rails-mercari](https://github.com/crowdy/conoha-cli-app-samples/tree/main/rails-mercari) | Rails で作るメルカリ風マーケットプレイス (OIDC 認証 + Sidekiq) |
```

new_string:
```markdown
| [rails-mercari](/examples/rails-mercari) | Rails で作るメルカリ風マーケットプレイス (OIDC 認証 + Sidekiq) |
```

- [ ] **Step 6.3:** Build clean:

```bash
npx vitepress build docs
```

- [ ] **Step 6.4:** Commit:

```bash
git add docs/index.md
git commit -m "$(cat <<'EOF'
docs(home): rewire fullstack rows to internal links + add clerk-stripe

nextjs-fastapi-postgresql and rails-mercari swapped to /examples/ links;
new row added for nextjs-fastapi-clerk-stripe (previously absent).
EOF
)"
```

---

## Task 7: Final verification and PR

**Files:** none (verification + push only).

- [ ] **Step 7.1: Clean rebuild**

```bash
rm -rf docs/.vitepress/dist
npx vitepress build docs
```

Expected: `build complete in <Ns>.` with no warnings.

- [ ] **Step 7.2: Confirm the change set**

```bash
git diff --stat main...HEAD
```

Expected ~5 files (3 new pages + sidebar config + index.md), plus the Phase 2d plan file.

- [ ] **Step 7.3: Secret-handling sweep**

```bash
git diff main...HEAD -- 'docs/examples/*.md' \
  | grep -E "_PASSWORD=[^\$]|_SECRET=[^\$]|_TOKEN=[^\$]|Bearer |sk_[a-zA-Z0-9]|pk_[a-zA-Z0-9]|whsec_|hf_[a-zA-Z0-9]|price_[a-zA-Z0-9]" \
  | grep -v ":?required\|openssl rand"
git diff main...HEAD -- 'docs/examples/*.md' \
  | grep -E "^\+.*([0-9]{1,3}\.){3}[0-9]{1,3}" \
  | grep -v "0\.0\.0\.0\|127\.0\.0\.1"
```

Expected: no output.

- [ ] **Step 7.4: Push the branch**

```bash
git push -u origin docs/examples-phase2d-fullstack-flagships
```

- [ ] **Step 7.5: Open the PR**

```bash
gh pr create --title "docs(examples): full-stack web flagships — 3 new pages + new category (Phase 2d)" --body "$(cat <<'EOF'
## Summary

Phase 2d of the app-samples reflection work
(spec: `docs/superpowers/specs/2026-06-05-app-samples-reflection-design.md`,
plan: `docs/superpowers/plans/2026-07-07-app-samples-phase2d-fullstack-flagships.md`).
Adds three flagship full-stack pages and introduces the new フルスタックウェブ
sidebar category. This completes the 14 planned flagship pages (Phases 1–2d);
remaining samples move to the compact-tier Phase 3.

### Site changes

- 3 new pages under `docs/examples/`: nextjs-fastapi-postgresql,
  nextjs-fastapi-clerk-stripe, rails-mercari
- Sidebar: new `フルスタックウェブ` category (spec IA #3) with all 3 entries,
  between Webフレームワーク and AI / GPU
- `docs/index.md`: 2 rows rewired to internal links + 1 new row added for
  nextjs-fastapi-clerk-stripe (previously had no row)

### Patterns demonstrated

- **nextjs-fastapi-postgresql** — canonical single-FQDN same-origin full-stack
  (Next.js `rewrites` → FastAPI, no CORS, Postgres accessory)
- **nextjs-fastapi-clerk-stripe** — SaaS shape; `api.` subdomain via `expose:`
  so Clerk/Stripe webhooks reach the backend with byte-intact bodies (HMAC)
- **rails-mercari** — 3-FQDN, 6-service Rails; Dex OIDC on `auth.`
  (`blue_green: false`), Rails on `app.` (blue/green), Sidekiq/Redis jobs

### Doc trail (`srcExclude`'d from build)

- `docs/superpowers/plans/2026-07-07-app-samples-phase2d-fullstack-flagships.md`

## Test plan

- [ ] `npx vitepress build docs` is clean
- [ ] Each new page renders at `/examples/<sample>` with correct sidebar context
- [ ] Sidebar shows `フルスタックウェブ` with the 3 entries
- [ ] `docs/index.md` full-stack table: 2 rewired links + new clerk-stripe row
- [ ] `gitleaks` PR check passes (no literal Clerk/Stripe keys)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: the command returns a PR URL.

---

## Self-Review notes (author)

- **Spec coverage:** Phase 2d per spec Delivery Plan = nextjs-fastapi-postgresql + nextjs-fastapi-clerk-stripe + rails-mercari full-stack flagships + slots + rewires. ✔ Tasks 2–6 cover exactly this. With Phase 2d, all 14 flagship pages in the spec are complete.
- **New index.md row:** clerk-stripe had no existing row (verified) — Task 6 adds it, consistent with the spec's "add any samples missing from index.md tables" cleanup intent, done in-phase.
- **Source conflicts flagged:** clerk-stripe and rails-mercari both have stale no-proxy blog drafts; Tasks 3 & 4 explicitly instruct to trust README/conoha.yml/compose.yml. rails-mercari premise corrections (nginx doesn't serve assets; no RAILS_MASTER_KEY) are called out.
- **Secret discipline:** clerk-stripe secret scan includes the `price_` pattern; all Clerk/Stripe keys are `${VAR:?required}`. Hardcoded demo DB creds (`apppass`, `postgres`, `dex`) are masked.
- **Type consistency:** sidebar links `/examples/nextjs-fastapi-postgresql`, `/examples/nextjs-fastapi-clerk-stripe`, `/examples/rails-mercari` match the filenames created in Tasks 2–4 and the index.md links in Task 6. ✔
- **Category-first rule:** フルスタックウェブ created only as its first pages land (Task 5). ✔
