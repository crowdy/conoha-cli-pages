# App Samples — Phase 2c (Dev Infra / PaaS Flagships) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two flagship example pages — `coolify` and `dokploy` — introducing the new "開発インフラ・運用" sidebar category, and rewire the shared `index.md` PaaS row from GitHub links to internal links.

**Architecture:** Two new markdown pages under `docs/examples/`. `coolify.md` follows the standard flagship template established by Phase 2b (`outline.md`, `supabase-selfhost.md`) because it is a normal proxy-mode `conoha app deploy` sample. `dokploy.md` is a **deliberate structural variant**: it is the repo's only *no-proxy, installer-driven* sample (`conoha server ssh` + `install-on-conoha.sh`, Docker Swarm) — it has no `conoha.yml`/`compose.yml`, so its page replaces the compose/conoha.yml/deploy sections with a server-create + SSH + installer walkthrough. A new sidebar category "開発インフラ・運用" is created in `docs/.vitepress/config/ja.ts` (this is its first page landing, per CONTRIBUTING rule 3). `docs/index.md` line 60 (a single row shared by both samples) is rewired to internal links. Build verified by `npx vitepress build docs` after each commit. One PR for the whole phase.

**Tech Stack:** VitePress 1.6.4, markdown. Source-of-truth for each sample's behavior: `crowdy/conoha-cli-app-samples` `main` — for `coolify`: `README.md`, `conoha.yml`, `compose.yml` (no `.env.example`); for `dokploy`: `README.md`, `install-on-conoha.sh`, and the `docs/blogs/dokploy.md` draft.

**Spec:** `docs/superpowers/specs/2026-06-05-app-samples-reflection-design.md`

**Reference flagships (read before writing):**
- `docs/examples/outline.md` / `docs/examples/supabase-selfhost.md` (Phase 2b, closest peers for `coolify` — proxy mode, accessories, DB+Redis)
- `docs/examples/opencascade-fem.md` (canonical Phase 1 template)
- `docs/examples/vllm-gpu.md` (the `--no-proxy` reference — `dokploy` shares the no-proxy framing, though dokploy goes further and skips `app deploy` entirely)

## Global Constraints

- **No front-matter** on any page (matches every existing page).
- **Absolute internal links** only: `/examples/<sample>`, `/guide/<topic>`. Never relative.
- **Secret-handling (CONTRIBUTING.md):** no literal passwords/tokens in any code block. Use `${VAR:?required}` (compose/env) or `<PLACEHOLDER>` (shell). The `coolify` `compose.yml` ships literal fallback defaults (`coolify` for `DB_PASSWORD`/`REDIS_PASSWORD`) — **never reproduce those literals**; show `${VAR:?required}` and the `openssl rand -base64 32` generation pattern instead. No real IPs (only `0.0.0.0`/`127.0.0.1` allowed), no real tenant UUIDs. Placeholder FQDNs use `<sample>.example.com`.
- **`（サンプルで設定済み）`** not `（デフォルト）` when describing values the sample sets explicitly.
- **Build clean:** `npx vitepress build docs` must finish with no dead-link or sidebar warnings (pre-existing caddyfile language-fallback notices are OK).
- **Sidebar category naming** must match the spec IA verbatim: `開発インフラ・運用`.
- **ja locale only.** No changes to `docs/.vitepress/config/en.ts` or `ko.ts` (spec Non-Goals).

---

## Task 1: Create branch and confirm clean baseline

**Files:** none (verification only).

- [ ] **Step 1.1: Confirm on main and pull latest**

```bash
git checkout main
git pull --ff-only origin main
```

Expected: `Already up to date.` (or a fast-forward). Phase 2b (PR #32, commit `7430801`) should be in `git log --oneline -5`.

- [ ] **Step 1.2: Create the working branch**

```bash
git checkout -b docs/examples-phase2c-devinfra-flagships
```

- [ ] **Step 1.3: Confirm baseline build is clean**

```bash
npx vitepress build docs
```

Expected: `build complete in <Ns>.` with no warnings.

- [ ] **Step 1.4: Add this plan file and commit it (tags along into the PR, matching the Phase 2b pattern)**

```bash
git add docs/superpowers/plans/2026-07-07-app-samples-phase2c-devinfra-flagships.md
git commit -m "docs(plan): add phase-2c devinfra flagships implementation plan"
```

---

## Universal per-page checklist (Tasks 2–3)

For every page:

- [ ] **Read source material** from `crowdy/conoha-cli-app-samples` `main` (use `gh api .../contents/<path> --jq '.content' | base64 -d`) in this order:
  1. `<sample>/README.md`
  2. `docs/blogs/<sample>.md` if it exists (only `dokploy` has one)
  3. `<sample>/conoha.yml` (coolify only — reproduce inline comments verbatim in the page's YAML block)
  4. `<sample>/compose.yml` (coolify only — for the excerpt)
  5. `<sample>/install-on-conoha.sh` (dokploy only)
- [ ] **Open the reference flagship pages** listed above; match section shape, do not copy prose.
- [ ] **Conventions**: see Global Constraints. All code fences balanced; all `:::` callouts closed.
- [ ] **Pre-commit sanity checks**:

```bash
wc -l docs/examples/<sample>.md
# Secret scan (should print nothing):
grep -E "_PASSWORD=[^\$]|_SECRET=[^\$]|_TOKEN=[^\$]|Bearer |sk_[a-zA-Z0-9]|pk_[a-zA-Z0-9]|whsec_|hf_[a-zA-Z0-9]" docs/examples/<sample>.md
# Real-IP scan (only 0.0.0.0 / 127.0.0.1 allowed):
grep -E "([0-9]{1,3}\.){3}[0-9]{1,3}" docs/examples/<sample>.md | grep -v "0\.0\.0\.0\|127\.0\.0\.1"
npx vitepress build docs
```

Expected: no secret/IP output; clean build.

- [ ] **Commit**: one commit per page.

---

## Task 2: coolify (proxy mode, self-hosted PaaS behind conoha-proxy)

**Files:**
- Create: `docs/examples/coolify.md`

**Interfaces:**
- Produces: the file `docs/examples/coolify.md` (referenced by the sidebar entry in Task 4 and the index.md link in Task 5). Related-links section must link `/examples/dokploy` (created in Task 3).

**Sample brief (authoritative — from upstream `main`):**

- **Mode:** proxy. `conoha.yml` exists (`web.service: coolify`, `port: 8000`). Standard `conoha proxy boot` → `app init` → `app deploy` flow. `--no-proxy` is only mentioned as an *alternative workaround* for the realtime-WebSocket limitation — do NOT present it as the default.
- **Headline story:** turns one ConoHa VPS into a self-hosted Vercel/Netlify-style PaaS; after deploy you run *other* apps (git-push auto-deploy, one-click DBs, auto-HTTPS) from Coolify's own UI. The instructive twist: a PaaS deployed *behind* conoha-proxy, so there is a layered-proxy caveat (proxy fronts one HTTP port, so Coolify's realtime WebSocket ports 6001/6002 don't traverse the public FQDN).
- **conoha.yml — reproduce VERBATIM (with these comments):**

```yaml
name: coolify
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - coolify.example.com
web:
  service: coolify
  # HTTP UI port. The container also exposes 6001 (Soketi / socket.io
  # for realtime UI updates) and 6002 (Laravel Reverb / WebSocket).
  # conoha-proxy fronts HTTP only, so realtime updates in the UI may
  # not work via the public FQDN — see README for details.
  port: 8000
# `postgres` and `redis` are accessories: schema and queue state must
# survive blue/green swaps.
accessories:
  - postgres
  - redis
```

- **compose.yml excerpt to show** (link full file at `https://github.com/crowdy/conoha-cli-app-samples/blob/main/coolify/compose.yml`): the `coolify` service pins image `ghcr.io/coollabsio/coolify:4.0.0-beta.473` (no moving `:4` tag; `:latest`/`:v3` resolve to Coolify v3 — must pin a concrete v4 beta tag); `expose: ["8000","6001","6002"]` (no host ports); volumes `/data/coolify:/data/coolify` and **`/var/run/docker.sock:/var/run/docker.sock`** (Coolify orchestrates host Docker — essential + security-relevant); `depends_on` postgres (healthy) + redis (started). `postgres` = `postgres:16-alpine`, `pg_isready` healthcheck; `redis` = `redis:7-alpine` with `--requirepass`.
- **Environment variables** (set via `conoha app env set`; show as `${VAR:?required}`, never literals):
  - `APP_URL` — **mandatory, no default** (`${APP_URL:?...}`). Must equal the public HTTPS FQDN or Coolify generates broken invite/OAuth links; empty value intentionally fails startup.
  - `APP_KEY` — Laravel encryption key; auto-generated on first boot if unset, or pre-set via `base64:$(openssl rand -base64 32)`. **Secret.**
  - `DB_PASSWORD` — Postgres password (compose default is the literal `coolify` — must override). **Secret.**
  - `REDIS_PASSWORD` — Redis `--requirepass` (compose default `coolify` — must override). **Secret.**
  - `APP_ID` — `${APP_ID:-coolify}` instance id; non-secret, default fine.
- **Architecture:** `coolify` (UI :8000, proxied; internal-only :6001 Soketi / :6002 Reverb; mounts host docker.sock) + `postgres` accessory (16, schema/state) + `redis` accessory (7, cache/queue). One host `coolify.example.com` → 1 DNS A record. Apps deployed *through* Coolify later get their own domains configured inside Coolify.
- **完成イメージ (3–5 bullets):** browse to `https://<FQDN>`, create initial admin account (first load may take tens of seconds for cert issuance); one-click deploy of apps/DBs/services from the UI; GitHub/GitLab auto-deploy on push; automatic Let's Encrypt HTTPS for the apps Coolify manages; `APP_KEY` auto-generated (or pre-set).
- **前提条件:** conoha-cli installed; ConoHa VPS3 account; SSH keypair. **RAM 4GB+ (`g2l-t-4`)**. One DNS A record (edit `hosts:` to your FQDN before `app init`). Proxy boot required. No GPU.
- **ハマりどころ (write these as `::: warning` where apt):**
  1. **Realtime UI doesn't work over the public FQDN.** conoha-proxy fronts a single HTTP port; Coolify's live deploy progress/log streaming needs socket.io (6001) + Reverb (6002). Normal ops work; live progress/log tails degrade to manual refresh. Workarounds: Coolify's own installer with bundled Caddy, or `--no-proxy` letting Coolify terminate TLS.
  2. `APP_URL` mandatory with no default — must equal the public HTTPS FQDN.
  3. Env step is not optional — compose ships literal default passwords (`coolify`) that are public in the repo; you MUST override `DB_PASSWORD`/`REDIS_PASSWORD` and set `APP_KEY`/`APP_URL` before/at deploy.
  4. Image tag pinning — pin a concrete v4 beta tag; no moving `:4` tag; `:latest`/`:v3` = Coolify v3. Bump manually when 4.0.0 stable ships.
  5. Coolify bind-mounts `/var/run/docker.sock` — it controls the host Docker daemon; expected for a PaaS but worth flagging security-wise.
- **Screenshots:** none upstream. Do not reference any image.
- **関連リンク:** Recipe (GitHub `tree/main/coolify`); `/examples/dokploy` (peer PaaS — contrast proxy vs installer); `/examples/supabase-selfhost`, `/examples/dify-https` (other multi-service self-host); Coolify project (https://coolify.io/); conoha-cli.

**Page sections (in order):** `# Coolify (セルフホスティング PaaS) デプロイ` → 1–2 paragraph intro (state proxy mode) → `::: tip 本例は proxy モード対応 (\`conoha.yml\` 同梱)` → `## 完成イメージ` → `## アーキテクチャ` (ASCII diagram: proxy → coolify:8000 (+ internal 6001/6002) + postgres/redis accessories; plus a stack table) → `## 前提条件` → `## 1. conoha.yml` (verbatim + prose on accessories and the 6001/6002 caveat) → `## 2. compose.yml (抜粋)` (excerpt + docker.sock note) → `## 3. 環境変数 (\`.env\`)` (`${VAR:?required}` block + APP_KEY generation) → `## 4. デプロイ` (proxy flow, 1 DNS A record) → `## 5. 動作確認` (browser admin creation + `curl -I https://<FQDN>`) → `## 初期セットアップ` (admin account, connect a git source, deploy a first app through Coolify) → `## カスタマイズ` (image tag bump, resource limits, `--no-proxy` for realtime) → `## ハマりどころ` → `## 関連リンク`. Target ~250–320 lines.

- [ ] **Step 2.1:** Read source material (README, conoha.yml, compose.yml) per the universal checklist.
- [ ] **Step 2.2:** Write `docs/examples/coolify.md` following the brief and section order above.
- [ ] **Step 2.3:** Run the pre-commit sanity checks (secret scan, IP scan, `wc -l`, build). Expected: clean.
- [ ] **Step 2.4:** Commit:

```bash
git add docs/examples/coolify.md
git commit -m "$(cat <<'EOF'
docs(examples): add coolify flagship page

Self-hosted PaaS behind conoha-proxy — accessories (postgres/redis),
mandatory APP_URL, and the 6001/6002 realtime-WebSocket proxy caveat.
EOF
)"
```

---

## Task 3: dokploy (no-proxy, installer-driven PaaS on Docker Swarm)

**Files:**
- Create: `docs/examples/dokploy.md`

**Interfaces:**
- Produces: the file `docs/examples/dokploy.md` (referenced by the sidebar entry in Task 4 and the index.md link in Task 5). Related-links section must link `/examples/coolify` (Task 2) and `/examples/hello-world`.

**⚠️ Structural note for the implementer:** `dokploy` is NOT a `conoha app deploy` sample. It has **no `conoha.yml` and no `compose.yml`**. Do NOT invent them. The flagship template's "compose.yml 抜粋 / conoha.yml / app deploy" sections are **replaced** by a "server create → server ssh → run installer" walkthrough. This is the one sample that teaches the *other* half of conoha-cli (`server create` + `server ssh`), so lean into that framing.

**Sample brief (authoritative — from upstream `main`):**

- **Mode:** no-proxy, installer-driven. Dokploy is itself a PaaS controller requiring **Docker Swarm**; its bundled **Traefik runs in host mode and binds `:80`/`:443` directly**, so a conoha-proxy layer would collide. **No `conoha proxy boot` step.** Deploy path: `conoha server create` → `conoha server ssh` → run `install-on-conoha.sh` as root inside the VPS.
- **Why no compose.yml works (state this):** the official `install.sh` performs Swarm init, overlay-network creation, Swarm-secret generation, and starts 3 Swarm *services* + a Traefik container. `docker compose` is single-host and cannot express Swarm mode (`docker service`) or Swarm secrets.
- **`install-on-conoha.sh` is a thin ConoHa wrapper** over `https://dokploy.com/install.sh` adding three things: a pinned version, a ConoHa-safe Swarm CIDR, and public-IPv4 `ADVERTISE_ADDR` auto-detection. Key logic:
  - Pinned defaults (single lines to bump for upgrades): `DEFAULT_DOKPLOY_VERSION="v0.28.8"`, `DEFAULT_SWARM_INIT_ARGS="--default-addr-pool 10.20.0.0/16 --default-addr-pool-mask-length 24"`.
  - `require_root()` — exits if not uid 0.
  - `ensure_advertise_addr()` — if `ADVERTISE_ADDR` set, use it; else if host has an RFC1918 IP, defer to upstream; else fetch public IPv4 (tries `ifconfig.io`, `icanhazip.com`, `ipecho.net/plain`) and export it. This solves ConoHa VPS3's "public IPv4 only, no private IP" problem where upstream `get_private_ip()` would fail.
  - `run_upstream_installer()` — exports the two vars then `curl -fsSL https://dokploy.com/install.sh | bash`.
  - Upstream installer provisions (single Swarm manager node): Docker install, `docker swarm init`, overlay network `dokploy-network`, Swarm secret `dokploy_postgres_password`, services `dokploy` / `dokploy-postgres` / `dokploy-redis`, and the `dokploy-traefik` container (host mode).
- **Recommended invocation (inside the VPS, run this — do NOT paste real IPs):**

```bash
curl -fsSL https://raw.githubusercontent.com/crowdy/conoha-cli-app-samples/main/dokploy/install-on-conoha.sh | sudo -E bash
```

- **Configuration inputs (no `.env` file):** all optional env vars passed through `sudo -E`:
  - `DOKPLOY_VERSION` (default `v0.28.8`) — pin version.
  - `DOCKER_SWARM_INIT_ARGS` (default `--default-addr-pool 10.20.0.0/16 --default-addr-pool-mask-length 24`) — overlay CIDR.
  - `ADVERTISE_ADDR` — Swarm advertise address (auto-detected public IPv4 by default).
  - The one operator secret is the **admin Email + Password** created in the browser at `:3000` on first visit (not in any file). The Swarm secret `dokploy_postgres_password` is auto-generated by the upstream installer and never shown.
  - **`sudo -E` is mandatory** — without `-E`, sudo strips these env vars and overrides are silently ignored.
- **Architecture (from README ASCII diagram):** `dokploy-traefik` (Traefik v3.6.x, host mode, :80/:443, `docker run`) + `dokploy` (control plane, Web UI :3000, `docker service`, reached directly via Swarm ingress mesh — NOT through Traefik) + `dokploy-postgres` (PostgreSQL 16, :5432, metadata, `docker service`) + `dokploy-redis` (Redis 7, :6379, queue, `docker service`); all on overlay network `dokploy-network`, single Swarm manager node. Dashboard: `http://<server-ip>:3000`.
- **完成イメージ (bullets):** `http://<server-ip>:3000` opens the dashboard; first visit creates admin (Email + Password); a running self-hosted PaaS (Traefik + Postgres + Redis + Swarm) on one 4GB VPS; deploy the repo's `hello-world` sample *through* Dokploy (Public Git → Dockerfile build, Build Path `hello-world`) reachable via an auto-generated `*.traefik.me` / `<ip>.nip.io` domain; optional custom domain + Let's Encrypt via Traefik; access to Dokploy's Templates marketplace.
- **前提条件:** conoha-cli installed; ConoHa VPS3 account; SSH key. **`g2l-t-4` (4GB) or larger** (Dokploy + bundled Postgres/Redis/Traefik + first build uses ~2–3GB; 2GB risks OOM). ConoHa Ubuntu 24.04 image (needs `iproute2`'s `ip`). **No `conoha proxy boot`.** DNS not required to start — use `*.traefik.me` / `<server-ip>.nip.io`; only a custom domain needs an A record.
- **ハマりどころ (`::: warning` where apt):**
  1. **Forgetting `sudo -E`** — #1 gotcha; without `-E`, `DOKPLOY_VERSION`/`ADVERTISE_ADDR`/`DOCKER_SWARM_INIT_ARGS` are stripped and silently ignored.
  2. **Port conflicts** — upstream installer aborts if `:80`/`:443`/`:3000` are taken. Check `ss -tulnp` and stop the offender.
  3. **Swarm overlay CIDR collision** — default `10.20.0.0/16` can clash with a corporate VPN; override via `DOCKER_SWARM_INIT_ARGS="--default-addr-pool 172.30.0.0/16 --default-addr-pool-mask-length 24"` with `sudo -E`.
  4. **ConoHa "no private IP"** — upstream `get_private_ip()` fails on VPS3 (public IPv4 only); the wrapper solves it, but if auto-detection fails set `ADVERTISE_ADDR=<ip> sudo -E bash install-on-conoha.sh` manually (use a `<SERVER_IP>` placeholder in the doc).
  5. **Uninstall "volume is in use"** — after `docker service rm`, Swarm reaps task containers asynchronously; a wait loop is needed before `docker volume rm`. Reproduce the README's full uninstall sequence.
  6. (minor) `/etc/dokploy` is `chmod 777` by upstream so non-root containers can read/write — expected, not a bug.
- **Screenshots:** none upstream.
- **関連リンク:** Recipe (GitHub `tree/main/dokploy`); `/examples/coolify` (peer PaaS — contrast: coolify uses `conoha app deploy` under proxy on :8000, dokploy uses `server ssh` + installer with its own Traefik on :80/:443, Swarm-based); `/examples/hello-world` (the app deployed through Dokploy); Dokploy (https://dokploy.com/), docs (https://docs.dokploy.com/); conoha-cli.

**Page sections (variant, in order):** `# Dokploy (セルフホスティング PaaS) デプロイ` → intro (state clearly: no-proxy, installer-driven, Docker Swarm, and that this teaches `server create` + `server ssh` rather than `app deploy`) → `::: warning 本例は \`conoha app deploy\` を使いません` callout (explain why: Traefik owns :80/:443, Swarm required) → `## 完成イメージ` → `## アーキテクチャ` (ASCII diagram + stack table) → `## 前提条件` (4GB, Ubuntu 24.04, no proxy boot, DNS optional) → `## 1. サーバー作成` (`conoha server create --flavor g2l-t-4 --image ubuntu-24.04 ...`) → `## 2. インストール` (SSH in, run the `curl ... | sudo -E bash` one-liner; explain the wrapper's version pin / CIDR / ADVERTISE_ADDR) → `## 3. 初期セットアップ` (browse `http://<SERVER_IP>:3000`, create admin) → `## 4. 動作確認 / アプリをデプロイ` (deploy `hello-world` through Dokploy UI: Public Git provider, Build Path `hello-world`, Dockerfile build, reachable via `*.traefik.me`) → `## カスタマイズ` (version bump, custom domain + Let's Encrypt, CIDR override) → `## アンインストール` (the README's service rm → wait loop → network/volume/secret cleanup → `swarm leave --force`) → `## ハマりどころ` → `## 関連リンク`. Target ~250–320 lines.

- [ ] **Step 3.1:** Read source material (README, `docs/blogs/dokploy.md`, `install-on-conoha.sh`) per the universal checklist.
- [ ] **Step 3.2:** Write `docs/examples/dokploy.md` following the brief and the variant section order above. Use `<SERVER_IP>` placeholders — never a real IP.
- [ ] **Step 3.3:** Run the pre-commit sanity checks. Expected: clean (the `curl | sudo -E bash` line and `ss -tulnp` are fine; no secrets, no real IPs).
- [ ] **Step 3.4:** Commit:

```bash
git add docs/examples/dokploy.md
git commit -m "$(cat <<'EOF'
docs(examples): add dokploy flagship page

No-proxy, installer-driven PaaS (Docker Swarm + Traefik). The one
sample that uses server ssh + install-on-conoha.sh instead of app deploy.
EOF
)"
```

---

## Task 4: Sidebar — create the "開発インフラ・運用" category

**Files:**
- Modify: `docs/.vitepress/config/ja.ts`

**Interfaces:**
- Consumes: `/examples/coolify` (Task 2), `/examples/dokploy` (Task 3) — both must exist on the branch before this task's build check.

Per the spec IA, "開発インフラ・運用" sits between "セルフホスティング SaaS" and "アーキテクチャパターン". This is the category's first landing (CONTRIBUTING rule 3 satisfied).

- [ ] **Step 4.1:** Edit `docs/.vitepress/config/ja.ts`. Match this exact `old_string` (the boundary between the SaaS section's close and the アーキテクチャパターン section's open):

old_string:
```ts
            { text: 'MinIO + n8n', link: '/examples/minio-n8n' },
          ],
        },
        {
          text: 'アーキテクチャパターン',
```

new_string:
```ts
            { text: 'MinIO + n8n', link: '/examples/minio-n8n' },
          ],
        },
        {
          text: '開発インフラ・運用',
          items: [
            { text: 'Coolify (PaaS)', link: '/examples/coolify' },
            { text: 'Dokploy (PaaS, Swarm)', link: '/examples/dokploy' },
          ],
        },
        {
          text: 'アーキテクチャパターン',
```

- [ ] **Step 4.2:** Build clean:

```bash
npx vitepress build docs
```

Expected: clean build, no dead-link warnings (both pages exist on the branch).

- [ ] **Step 4.3:** Commit:

```bash
git add docs/.vitepress/config/ja.ts
git commit -m "$(cat <<'EOF'
docs(sidebar): add 開発インフラ・運用 category with coolify + dokploy

First landing of the Dev Infra category (spec IA #6), inserted between
セルフホスティング SaaS and アーキテクチャパターン.
EOF
)"
```

---

## Task 5: index.md rewire — swap the shared PaaS row to internal links

**Files:**
- Modify: `docs/index.md`

The `coolify` and `dokploy` links share a single row (line 60) in the 開発インフラ・運用 table. Both pages land in this PR, so both links become internal.

- [ ] **Step 5.1:** Edit `docs/index.md`. old_string:

```markdown
| [coolify](https://github.com/crowdy/conoha-cli-app-samples/tree/main/coolify) / [dokploy](https://github.com/crowdy/conoha-cli-app-samples/tree/main/dokploy) | セルフホスティング PaaS (Heroku/Vercel 代替) |
```

new_string:
```markdown
| [coolify](/examples/coolify) / [dokploy](/examples/dokploy) | セルフホスティング PaaS (Heroku/Vercel 代替) |
```

- [ ] **Step 5.2:** Build clean:

```bash
npx vitepress build docs
```

- [ ] **Step 5.3:** Commit:

```bash
git add docs/index.md
git commit -m "$(cat <<'EOF'
docs(home): rewire coolify/dokploy PaaS row to internal links
EOF
)"
```

---

## Task 6: Final verification and PR

**Files:** none (verification + push only).

- [ ] **Step 6.1: Clean rebuild**

```bash
rm -rf docs/.vitepress/dist
npx vitepress build docs
```

Expected: `build complete in <Ns>.` with no warnings.

- [ ] **Step 6.2: Confirm the change set**

```bash
git diff --stat main...HEAD
```

Expected ~4 files (2 new pages + sidebar config + index.md), plus the Phase 2c plan file.

- [ ] **Step 6.3: Secret-handling sweep**

```bash
git diff main...HEAD -- 'docs/examples/*.md' \
  | grep -E "_PASSWORD=[^\$]|_SECRET=[^\$]|_TOKEN=[^\$]|Bearer |sk_[a-zA-Z0-9]|pk_[a-zA-Z0-9]|whsec_|hf_[a-zA-Z0-9]" \
  | grep -v ":?required\|openssl rand"
git diff main...HEAD -- 'docs/examples/*.md' \
  | grep -E "^\+.*([0-9]{1,3}\.){3}[0-9]{1,3}" \
  | grep -v "0\.0\.0\.0\|127\.0\.0\.1\|10\.20\.0\.0\|172\.30\.0\.0"
```

Expected: no output. (The `10.20.0.0/16` / `172.30.0.0/16` Swarm CIDR examples in dokploy are documentation of installer args, not real host IPs — excluded above.)

- [ ] **Step 6.4: Push the branch**

```bash
git push -u origin docs/examples-phase2c-devinfra-flagships
```

- [ ] **Step 6.5: Open the PR**

```bash
gh pr create --title "docs(examples): dev-infra PaaS flagships — coolify + dokploy + new category (Phase 2c)" --body "$(cat <<'EOF'
## Summary

Phase 2c of the app-samples reflection work
(spec: `docs/superpowers/specs/2026-06-05-app-samples-reflection-design.md`,
plan: `docs/superpowers/plans/2026-07-07-app-samples-phase2c-devinfra-flagships.md`).
Adds two flagship PaaS pages and introduces the new 開発インフラ・運用
sidebar category. Phase 2d (full-stack web) comes next.

### Site changes

- 2 new pages under `docs/examples/`: coolify, dokploy
- Sidebar: new `開発インフラ・運用` category (spec IA #6) with both entries,
  between セルフホスティング SaaS and アーキテクチャパターン
- `docs/index.md`: the shared coolify/dokploy PaaS row swapped to internal links

### Patterns demonstrated

- **coolify** — a PaaS deployed *behind* conoha-proxy; accessories
  (postgres/redis) + the 6001/6002 realtime-WebSocket proxy caveat
- **dokploy** — the repo's only no-proxy, installer-driven sample:
  `server create` + `server ssh` + `install-on-conoha.sh` (Docker Swarm +
  Traefik), teaching the non-`app deploy` half of conoha-cli

### Doc trail (`srcExclude`'d from build)

- `docs/superpowers/plans/2026-07-07-app-samples-phase2c-devinfra-flagships.md`

## Test plan

- [ ] `npx vitepress build docs` is clean
- [ ] Each new page renders at `/examples/<sample>` with correct sidebar context
- [ ] Sidebar shows `開発インフラ・運用` with coolify + dokploy
- [ ] `docs/index.md` PaaS row now links internally
- [ ] `gitleaks` PR check passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: the command returns a PR URL.

---

## Self-Review notes (author)

- **Spec coverage:** Phase 2c per spec Delivery Plan = coolify + dokploy Dev Infra flagships + slots + rewires. ✔ Tasks 2–5 cover exactly this.
- **dokploy variant:** the plan explicitly overrides the standard flagship template because dokploy has no conoha.yml/compose.yml — flagged in the Architecture header and Task 3.
- **Category-first rule:** 開発インフラ・運用 is created only as its first pages land (Task 4). ✔
- **Type consistency:** sidebar links `/examples/coolify` + `/examples/dokploy` match the filenames created in Tasks 2–3 and the index.md links in Task 5. ✔
