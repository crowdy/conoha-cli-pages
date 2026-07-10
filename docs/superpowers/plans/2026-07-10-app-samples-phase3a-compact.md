# App-samples Phase 3a — compact pages (Web/Full-stack + Curiosities) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Parent spec:** `docs/superpowers/specs/2026-06-05-app-samples-reflection-design.md` (Phase 3a row, Delivery Plan; compact template; IA §2/§3/§8).

**Goal:** Add 8 compact `/examples/` pages (bun-elysia-chat, hono-drizzle-postgresql, nextjs-go-google_ucp, sendgrid-invitation, dns-server, line-api-mock, line-cli-go, slurm-rest-api), register them in the ja sidebar, and rewire their `docs/index.md` rows to internal links — one PR.

**Architecture:** Each page is an independent new file under `docs/examples/<sample>.md` authored from upstream sources. Page authoring is delegated one-subagent-per-page (isolated files, no shared-file conflicts). The controller performs the two shared-file edits centrally after pages land: `docs/.vitepress/config/ja.ts` (sidebar) and `docs/index.md` (row rewires). This avoids parallel edits colliding on the two shared files.

**Tech Stack:** VitePress 1.6.4, Markdown (ja locale only), `gh api` for upstream source fetch, `npx vitepress build docs` for dead-link validation.

## Global Constraints

Every task's requirements implicitly include this section. Copied from the spec + CONTRIBUTING.md + the kickoff prompt.

- **Tier = compact** (~60–120 lines). Follow the spec "Compact template": intro (state proxy vs no-proxy mode) → 完成イメージ (3–4 bullets) → 前提条件 (3–4 bullets) → デプロイ手順 → `::: tip 設定ポイント` (1–3 must-know knobs) → 動作確認 → 関連リンク. Promote to a flagship section only where a sample genuinely needs it (multi-FQDN expose, OIDC, no-proxy/installer, JWT edge).
- **No front-matter** (matches existing pages). **ja locale only** — do NOT create en/ko pages.
- **Internal links are absolute:** `/examples/<sample>`, `/guide/<topic>`. No relative links.
- **Source-of-truth order** per sample: `README.md` → `conoha.yml` → `compose.yml`/`docker-compose.yml` → `.env.example`. Fetch with:
  `gh api repos/crowdy/conoha-cli-app-samples/contents/<sample>/<file> --jq '.content' | base64 -d`
- **Reproduce the upstream `conoha.yml` inline comments verbatim** when quoting it. **Excerpt** compose (do not inline the whole file); link the full file on GitHub `main`.
- **Secret-handling (gitleaks CI blocks merge on violation):**
  - No literal passwords/tokens/keys in any code block. Mask as `${VAR:?required}` (compose) or `<PLACEHOLDER>` (shell).
  - **Never reproduce upstream weak defaults** (`:-postgres`, `apppass`, `changeme`, `:-dex`, etc.) — describe them generically instead of printing the literal.
  - No real IPs (only `0.0.0.0`/`127.0.0.1`; documented CIDR/RFC-5737 ranges are fine), no real tenant UUIDs (use `00000000-...` or `aaaaaaaa-bbbb-...`).
  - Mask connection strings: `postgres://${USER}:${PASSWORD}@db/${DB}`.
  - Known token prefixes to never print with a real-looking body: `sk_`, `pk_`, `whsec_`, `price_`, `hf_`, `Bearer <token>`.
- **`（サンプルで設定済み）`** not `（デフォルト）` for values the sample repo already sets.
- **Build clean:** `npx vitepress build docs` finishes with no dead-link/sidebar warnings (a pre-existing Caddyfile notice, if any, is acceptable).
- **File scoping (conflict avoidance):** a page-authoring subagent writes ONLY its own `docs/examples/<sample>.md`. It must NOT touch `ja.ts` or `index.md` — the controller wires those centrally (Tasks 9–10).

---

### Task 1: bun-elysia-chat page

**Files:**
- Create: `docs/examples/bun-elysia-chat.md`

**Interfaces:**
- Produces: page at `/examples/bun-elysia-chat` (linked from sidebar Webフレームワーク + index.md フルスタックウェブ row).

**Sample facts (from conoha.yml):** proxy mode, single web service `web:3000`, no accessories. Bun + Elysia WebSocket realtime chat.

- [ ] **Step 1:** Fetch sources: `README.md`, `conoha.yml`, `compose.yml`/`docker-compose.yml`, `.env.example` for `bun-elysia-chat`.
- [ ] **Step 2:** Write `docs/examples/bun-elysia-chat.md` as a compact page. Intro: Bun + Elysia realtime WebSocket chat, proxy mode. 設定ポイント should surface the WebSocket-over-proxy behavior (conoha-proxy passes WS upgrades) and the single-FQDN shape.
- [ ] **Step 3:** Verify: no literal secrets, absolute links, no front-matter. Run the secret/IP grep sweep (see Verification section).
- [ ] **Step 4:** Commit: `docs(examples): add bun-elysia-chat compact page`.

### Task 2: hono-drizzle-postgresql page

**Files:**
- Create: `docs/examples/hono-drizzle-postgresql.md`

**Sample facts:** proxy mode, `web:3000`, `accessories: [db]` (PostgreSQL kept alive across blue/green). Hono + Drizzle REST API + Swagger UI.

- [ ] **Step 1:** Fetch sources for `hono-drizzle-postgresql`.
- [ ] **Step 2:** Write compact page. 設定ポイント: the `accessories: [db]` pattern (DB started once, survives blue/green swaps; only `web` is duplicated) and where Swagger UI is served. Reproduce the conoha.yml `accessories` comment verbatim.
- [ ] **Step 3:** Verify + secret sweep.
- [ ] **Step 4:** Commit: `docs(examples): add hono-drizzle-postgresql compact page`.

### Task 3: nextjs-go-google_ucp page

**Files:**
- Create: `docs/examples/nextjs-go-google_ucp.md` (filename keeps the upstream slug's underscore).

**Sample facts:** proxy mode, web service `frontend:3000`, `accessories: [api, db]` (Go API + DB reached only over the internal compose network). Google UCP (AI agent commerce) demo. NOTE: conoha.yml `name:` normalizes to `nextjs-go-google-ucp` (hyphen) but the directory/slug is `nextjs-go-google_ucp` (underscore) — the page filename and index/sidebar slug follow the directory: `nextjs-go-google_ucp`.

- [ ] **Step 1:** Fetch sources for `nextjs-go-google_ucp`.
- [ ] **Step 2:** Write compact page. Intro must state honestly what "Google UCP" is (agent-commerce protocol demo). 設定ポイント: frontend-as-web with api/db as internal accessories; any required Google/API credentials must be shown as `<PLACEHOLDER>` / `${VAR:?required}`, never a real-looking key. Add a one-line callout that the deployed app name normalizes to `nextjs-go-google-ucp` (hyphen) even though the cloned directory/slug is `nextjs-go-google_ucp` (underscore) — so `conoha app status/logs` shows the hyphen form.
- [ ] **Step 3:** Verify + secret sweep (watch for API-key-shaped literals).
- [ ] **Step 4:** Commit: `docs(examples): add nextjs-go-google_ucp compact page`.

### Task 4: sendgrid-invitation page

**Files:**
- Create: `docs/examples/sendgrid-invitation.md`

**Sample facts:** proxy mode, web service `nginx:80`, `accessories: [frontend, backend]` (Next.js + FastAPI behind in-container nginx). IMPORTANT upstream caveat (reproduce faithfully): only `nginx` is duplicated per blue/green slot; inner services are NOT re-rolled on a fresh `app deploy`. Uses SendGrid for invitation emails.

- [ ] **Step 1:** Fetch sources for `sendgrid-invitation`.
- [ ] **Step 2:** Write compact page. 設定ポイント: (a) the SendGrid API key must be provided as `${SENDGRID_API_KEY:?required}` — never print a `SG.`-shaped literal; (b) the nginx-fronts-frontend+backend accessory shape and its blue/green caveat (quote the conoha.yml comment verbatim).
- [ ] **Step 3:** Verify + secret sweep (watch for `SG.` SendGrid key shapes).
- [ ] **Step 4:** Commit: `docs(examples): add sendgrid-invitation compact page`.

### Task 5: dns-server page

**Files:**
- Create: `docs/examples/dns-server.md`

**Sample facts:** proxy mode, web service `app:8080`, `accessories: [pdns, db, pdns-init]`, `health.path: /health` with `unhealthy_threshold: 24` (covers init + first boot). PowerDNS + CRUD API personal DNS hosting; `pdns` binds host `:53` directly; none of the accessories can be duplicated per slot (stateful / sole authoritative DNS listener).

- [ ] **Step 1:** Fetch sources for `dns-server`.
- [ ] **Step 2:** Write compact page. 設定ポイント: (a) the `:53` host-bind + why accessories can't blue/green (quote the conoha.yml comment); (b) the extended health threshold for first-boot schema seeding; (c) any API auth key masked. Mention `/health` path override.
- [ ] **Step 3:** Verify + secret sweep.
- [ ] **Step 4:** Commit: `docs(examples): add dns-server compact page`.

### Task 6: line-api-mock page

**Files:**
- Create: `docs/examples/line-api-mock.md`

**Sample facts:** proxy mode, web service `app:3000`, `accessories: [db]`. LINE Messaging API local-dev mock (webhook emulation). Companion to `line-cli-go` (Task 7) — cross-link them.

- [ ] **Step 1:** Fetch sources for `line-api-mock`.
- [ ] **Step 2:** Write compact page. Intro: mock LINE Messaging API for local development / webhook emulation. 設定ポイント: channel ID/secret are emitted in startup logs (point readers there); `accessories: [db]` persistence. Add 関連リンク cross-link to `/examples/line-cli-go`.
- [ ] **Step 3:** Verify + secret sweep (channel secrets must be `<PLACEHOLDER>`).
- [ ] **Step 4:** Commit: `docs(examples): add line-api-mock compact page`.

### Task 7: line-cli-go page (SPECIAL: CLI client, not a deploy target)

**Files:**
- Create: `docs/examples/line-cli-go.md`

**Sample facts:** NO `conoha.yml` — this is a Go CLI *client* for `line-api-mock`, not a `conoha app deploy` web service. Built with `go build`, configured via `.env` / `.line-cli.yaml`, drives `token`/`message`/etc. commands against a running `line-api-mock`.

- [ ] **Step 1:** Fetch sources: `README.md`, `.env.example`, `.line-cli.yaml.example` for `line-cli-go`.
- [ ] **Step 2:** Write a compact page that is HONEST about the mode: this sample is a companion CLI, not a server you `conoha app deploy`. Structure: intro (what it is + that it pairs with line-api-mock) → 完成イメージ → 前提条件 (Go toolchain, a running line-api-mock) → 使い方 (build → configure → `token issue` → `message push`) → 動作確認 → 関連リンク (cross-link `/examples/line-api-mock`). Do NOT invent a `conoha app deploy` flow. Channel ID/secret/token shown only as `<PLACEHOLDER>`.
- [ ] **Step 3:** Verify + secret sweep.
- [ ] **Step 4:** Commit: `docs(examples): add line-cli-go compact page`.

### Task 8: slurm-rest-api page

**Files:**
- Create: `docs/examples/slurm-rest-api.md`

**Sample facts:** proxy mode, web service `slurm-edge:6820` (thin Caddy sidecar fronting `slurmrestd`), `blue_green: false` (stateful cluster pinned to one slot), `health.path: /healthz` (`unhealthy_threshold: 24`). `accessories: [mariadb, slurmdbd, slurmctld, cpu-worker, gpu-worker, slurmrestd]`. Single-node Slurm cluster + REST API with JWT auth on `/openapi/v3`.

- [ ] **Step 1:** Fetch sources for `slurm-rest-api`.
- [ ] **Step 2:** Write compact page. This one may need a slightly fuller treatment (it is architecturally non-trivial). 設定ポイント: (a) the slurm-edge Caddy sidecar exists because slurmrestd requires JWT and can't serve the proxy's 2xx probe (quote the conoha.yml comment); (b) `blue_green: false` — stateful volumes pinned to one slot; (c) JWT auth flow to reach `/openapi/v3`. Any JWT/token shown as `<PLACEHOLDER>`.
- [ ] **Step 3:** Verify + secret sweep.
- [ ] **Step 4:** Commit: `docs(examples): add slurm-rest-api compact page`.

---

### Task 9: Sidebar registration (controller, central)

**Files:**
- Modify: `docs/.vitepress/config/ja.ts`

Per spec IA §2/§3/§8. Add entries preserving spec order:
- **Webフレームワーク** — append in spec IA §2 order: `Hono + Drizzle + PostgreSQL` → `/examples/hono-drizzle-postgresql`; `Bun + Elysia チャット` → `/examples/bun-elysia-chat`.
- **フルスタックウェブ** — append: `Next.js + Go (Google UCP)` → `/examples/nextjs-go-google_ucp`; `SendGrid 招待メール` → `/examples/sendgrid-invitation`.
- **ちょっと変わったもの** *(new category — create it after アーキテクチャパターン, spec IA #8)* — items in this order: `DNS サーバー (PowerDNS)` → `/examples/dns-server`; `LINE API モック` → `/examples/line-api-mock`; `LINE CLI (Go)` → `/examples/line-cli-go`; `Slurm REST API` → `/examples/slurm-rest-api`.

- [ ] **Step 1:** Edit `ja.ts` per above.
- [ ] **Step 2:** Confirm the new category slot ordering matches the spec (ちょっと変わったもの is last).

### Task 10: index.md rewiring (controller, central)

**Files:**
- Modify: `docs/index.md`

**Scope decision (plan-review Important 2 & 3):** Phase 3a rewires **links only**, in place — it does NOT move rows between homepage sections and does NOT add currently-absent rows. Rationale: spec:233 scopes phase-internal PRs to "only their samples' rows," and spec:219 assigns "add samples missing from index.md tables" to **Phase 4 Cleanup**. `sendgrid-invitation` and `line-cli-go` are already in Phase 4's absent-rows list, so adding them here would double-handle them.

Current `index.md` state (verified): these 6 samples appear as GitHub `tree/main` links. Switch each to internal `/examples/<sample>`:
- フルスタックウェブ section: `bun-elysia-chat` (index.md:79), `hono-drizzle-postgresql` (index.md:80).
- ちょっと変わったもの section: `dns-server` (index.md:86), `line-api-mock` (index.md:87), `slurm-rest-api` (index.md:88), `nextjs-go-google_ucp` (index.md:89).

**Explicitly deferred to Phase 4 (Part E), flagged here per gate discipline:**
1. ADD rows for `sendgrid-invitation` and `line-cli-go` (both in the Phase 4 absent-rows list).
2. Reconcile homepage-section vs sidebar-category placement (`bun-elysia-chat`/`hono-drizzle-postgresql` sit in the homepage フルスタックウェブ table but the sidebar files them under Webフレームワーク; `nextjs-go-google_ucp` sits in homepage ちょっと変わったもの but the sidebar files it under フルスタックウェブ). Holistic index.md↔sidebar parity is a Phase 4 concern, not a per-sample rewire.

Do NOT touch the closing "→ 全 50+ サンプルを一覧する" catalog link or the count in this PR (count bump is Phase 4).

- [ ] **Step 1:** Rewire the 6 existing rows to internal links.
- [ ] **Step 2:** Confirm no other Phase-3a slug remains as a `tree/main` link (the 2 deferred samples stay absent until Phase 4).

### Task 11: Build + secret sweep + review (controller)

- [ ] **Step 1:** `npx vitepress build docs` — must be dead-link clean.
- [ ] **Step 2:** Secret/IP sweep across all 8 new pages (see Verification).
- [ ] **Step 3:** requesting-code-review (impl review) on the branch diff with this plan path; fix Critical/Important findings before PR.

---

## Verification (run before each page commit and before the PR)

```bash
# Secret / weak-default sweep — must return nothing
grep -nE "_PASSWORD=[^$]|_SECRET=[^$]|_TOKEN=[^$]|Bearer [A-Za-z0-9]|sk_[A-Za-z0-9]|pk_[A-Za-z0-9]|whsec_|price_[A-Za-z0-9]|SG\.[A-Za-z0-9]|hf_[A-Za-z0-9]|:-[a-z]" docs/examples/<sample>.md

# Real-IP sweep — must return nothing (0.0.0.0 / 127.0.0.1 and RFC-5737 doc ranges excepted)
grep -nE "([0-9]{1,3}\.){3}[0-9]{1,3}" docs/examples/<sample>.md | grep -vE "0\.0\.0\.0|127\.0\.0\.1|192\.0\.2\.|198\.51\.100\.|203\.0\.113\."
```

Build:
```bash
npx vitepress build docs
# Expected: "build complete" with no dead-link / missing-sidebar warnings.
```

## Self-review checklist (controller, before PR)
- All 8 pages exist, compact tier, no front-matter, absolute links.
- Sidebar: 8 entries added, ちょっと変わったもの created last, spec order preserved.
- index.md: 6 rewires + 2 new rows; no residual Phase-3a `tree/main` links; count untouched.
- Build clean; secret sweep clean on every page.
