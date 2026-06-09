# App Samples — Phase 2b (Self-hosted SaaS Flagships) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three flagship example pages — `outline`, `supabase-selfhost`, and `immich` — to the Self-hosted SaaS section of the docs site, rename the sidebar category from "セルフホスティング" to "セルフホスティング SaaS", and rewire three `index.md` rows from GitHub links to internal links.

**Architecture:** Three new markdown pages under `docs/examples/`. Each follows the flagship template established by `docs/examples/opencascade-fem.md` and refined through Phase 2a (`ollama-webui-gpu.md`, `dify-https.md`, `voice-agent-conoha-l4.md`): 完成イメージ → アーキテクチャ → 前提条件 → compose.yml 抜粋 → conoha.yml + 解説 → 環境変数 → デプロイ → 動作確認 → 初期セットアップ / カスタマイズ → ハマりどころ → 関連リンク. None of the three samples require a GPU, so the NVIDIA cloud-init section is skipped throughout this phase. Sidebar edit in `docs/.vitepress/config/ja.ts` renames the category and adds three entries; `docs/index.md` swaps three rows in the existing SaaS table. Build verified by `npx vitepress build docs` after each commit. One PR per phase.

**Tech Stack:** VitePress 1.6.4, markdown. Source-of-truth for each sample's behavior: `crowdy/conoha-cli-app-samples` `main` at each sample's `README.md`, `conoha.yml`, `compose.yml`, and `.env.example` plus the matching `docs/blogs/<sample>.md` Qiita draft where it exists (only `outline` has one; `supabase-selfhost` and `immich` do not).

**Spec:** `docs/superpowers/specs/2026-06-05-app-samples-reflection-design.md`

**Reference flagships:**
- `docs/examples/opencascade-fem.md` (canonical Phase 1 template)
- `docs/examples/dify-https.md` (multi-FQDN `expose:` pattern + `unhealthy_threshold` story — closest peer for `outline` and `supabase-selfhost`)
- `docs/examples/voice-agent-conoha-l4.md` (multi-accessory pattern — closest peer for `immich`)
- `docs/examples/hydra-python-api.md` (OIDC walkthrough — useful for `outline`)
- `docs/examples/ollama-webui-gpu.md` (single-accessory pattern, generic flagship structure)

---

## Sample Cheat Sheet (read before writing each page)

| Sample | Mode | conoha.yml pattern | Headline story | Page target |
|---|---|---|---|---|
| `outline` | proxy | root (`outline`) + 1 `expose:` subdomain (`dex.<root>`) + 2 accessories (`db`, `redis`) | Self-hosted Notion-style wiki with bundled Dex OIDC provider on a subdomain — no external SSO required | ~340L |
| `supabase-selfhost` | proxy | root (`kong`) + 1 `expose:` subdomain (`admin.<root>` → `studio`) + 4 accessories (`auth`, `rest`, `meta`, `db`) | Supabase BaaS via Kong API gateway on root; Studio admin UI on subdomain; deep accessory split for the worker services | ~300L |
| `immich` | proxy | root (`immich-server`) + 3 accessories (`immich-machine-learning`, `db` (pgvecto-rs), `redis`) | Self-hosted photo backup with ML face/object recognition; the ML model cache, photo metadata DB, and Redis queue must survive blue/green swaps | ~250L |

Implementer dispatched per page MUST read the upstream `README.md` + (when present) the blog draft + the **inline comments in `conoha.yml`** (which are detailed and authoritative) before writing. The conoha.yml comments for each of these three samples are already excellent prose explaining the routing and accessory choices — preserve them verbatim in the on-site page's YAML block.

---

## File Structure

| Path | Action | Purpose |
|---|---|---|
| `docs/examples/outline.md` | **create** | Flagship page (proxy mode, multi-FQDN with Dex OIDC subdomain, `/_health` probe pattern, `unhealthy_threshold: 24`). |
| `docs/examples/supabase-selfhost.md` | **create** | Flagship page (proxy mode, Kong API gateway on root + Studio admin UI on subdomain, 4-accessory worker split). |
| `docs/examples/immich.md` | **create** | Flagship page (proxy mode, 3-accessory pattern: ML + pgvector DB + Redis). |
| `docs/.vitepress/config/ja.ts` | refresh | Rename `セルフホスティング` → `セルフホスティング SaaS`; append 3 entries (`outline`, `supabase-selfhost`, `immich`) in sensible order. |
| `docs/index.md` | refresh | Swap 3 GitHub `/tree/main/<sample>` links to `/examples/<sample>` (the rows for `outline`, `supabase-selfhost`, `immich` already exist in the SaaS table at lines ~50–52). |

No changes to `docs/.vitepress/config/en.ts` / `ko.ts` (per spec Non-Goals).
No NVIDIA cloud-init sections in any of the three pages (CPU-only).
No `vllm-gpu と同じ内容` cross-reference (no GPU).
No CONTRIBUTING.md changes (Phase 1 already established the checklist).

---

## Task 1: Create branch and confirm clean baseline

**Files:** none (verification only).

- [ ] **Step 1.1: Confirm on main and pull latest**

```bash
git checkout main
git pull --ff-only origin main
```

Expected: `Already up to date.` Phase 2a (PR #31, commit `0d332ae`) should be in `git log --oneline -5`. The Phase 2b plan commit will sit on local main here, and tag along into the eventual Phase 2b PR (same pattern as Phase 1 and 2a).

- [ ] **Step 1.2: Create the working branch**

```bash
git checkout -b docs/examples-phase2b-saas-flagships
```

- [ ] **Step 1.3: Confirm baseline build is clean**

```bash
npx vitepress build docs
```

Expected: `build complete in <Ns>.` with no warnings (caddyfile language-fallback notices are pre-existing and OK).

---

## Tasks 2–4: Per-page authoring

Each per-page task follows the same shape: read source material, write the page following the flagship template, sanity-check, commit. The implementer dispatched for each task gets the per-sample notes embedded in the task prompt, plus the universal checklist below.

### Universal per-page checklist

For every page in Tasks 2–4:

- [ ] **Read source material** in this order:
  1. `app-samples/<sample>/README.md`
  2. `app-samples/docs/blogs/<sample>.md` if it exists (only `outline` has one)
  3. `app-samples/<sample>/conoha.yml` (the inline comments are authoritative — read them carefully and reproduce them verbatim in the on-site page's YAML block)
  4. `app-samples/<sample>/compose.yml` for the excerpt
  5. `app-samples/<sample>/.env.example` for required environment variables
  6. `app-samples/<sample>/nginx.conf` / `app-samples/<sample>/dex/` / etc. only if a sample-specific quirk needs surfacing

- [ ] **Open the canonical reference** at the flagship pages listed above. Match the section shape; do not copy prose.

- [ ] **Page sections (mandatory, in this order — adapt only as noted in per-sample notes)**:
  1. `# <タイトル> デプロイ` (H1)
  2. 1–3 paragraph intro
  3. `::: tip 本例は proxy モード対応 (\`conoha.yml\` 同梱)` callout
  4. `::: tip GPU は不要` callout (this is the SaaS phase — none of the 3 samples need GPU)
  5. `## 完成イメージ` — 3–5 bullets of post-deploy capabilities
  6. `## アーキテクチャ` — ASCII diagram (when ≥3 services) + a stack table covering each layer. For `immich`, use a simpler stack table without the ASCII diagram (only 4 services). For `outline` and `supabase-selfhost`, include both.
  7. `## 前提条件` — CLI installed, server created, DNS A records (multi-FQDN samples need 2 records — root + subdomain), proxy booted, RAM/disk recommendations
  8. `## 1. compose.yml` — excerpt of operationally important parts (env-var wiring, healthchecks, volumes). Use `${VAR:?required}` for any password/secret env. Link to the full file at `https://github.com/crowdy/conoha-cli-app-samples/blob/main/<sample>/compose.yml`.
  9. `## 2. conoha.yml` — show the file VERBATIM (preserving the upstream inline comments). Then add prose blocks (one per non-obvious feature):
     - For `outline`: root host + `web.health.path: /_health` (Outline-specific); `expose:` block for `dex` subdomain (OIDC reachability); `blue_green: false` on dex (sqlite session state); `accessories: [db, redis]`
     - For `supabase-selfhost`: root host (`kong` API gateway) + `web.health.path: /auth/v1/health` (Kong-specific routing trick); `expose:` block for `admin` subdomain (Studio Next.js); `blue_green: false` on studio; `accessories: [auth, rest, meta, db]` and why each stays accessory
     - For `immich`: 3-accessory pattern with concrete justification for each (ML model cache > minutes to reload; `db` pgvecto-rs holds photo metadata; `redis` holds job queue state)
  10. `## 3. 環境変数 (\`.env\`)` — surface must-set vars (Outline: `SECRET_KEY`, `UTILS_SECRET`, `URL`, OIDC client config; Supabase: `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`; Immich: `UPLOAD_LOCATION`, `DB_PASSWORD`)
  11. `## 4. デプロイ` — standard proxy-mode flow with the DNS A-record count noted explicitly (2 for outline/supabase, 1 for immich). Mention first-deploy duration honestly.
  12. `## 5. 動作確認` — browser walk + a `curl` health check at the documented health endpoint
  13. `## 初期セットアップ` — OIDC flow / admin user creation / first-run setup. For Outline: Dex user setup walkthrough. For Supabase: anon/service key retrieval + first table creation. For Immich: admin user + first photo upload + ML model warm-up.
  14. `## カスタマイズ` — provider swap, scaling, storage backends, plugin systems
  15. `## ハマりどころ` — 3–5 entries pulled from upstream README / blog draft / conoha.yml comments. The conoha.yml comments often contain hard-won knowledge that should land here.
  16. `## 関連リンク` — recipe (GitHub), blog placeholder (`Qiita — *公開後にリンク追加*` if no published URL), upstream project, related samples (`hydra-python-api` for OIDC; `dify-https` for multi-FQDN; `ollama-webui-gpu` or `voice-agent-conoha-l4` for accessory pattern)

- [ ] **Conventions (every page)**:
  - No front-matter
  - Absolute internal links: `/guide/...`, `/examples/...`
  - Placeholder FQDNs: `<sample>.example.com`; subdomain placeholders: `dex.outline.example.com`, `admin.supabase-selfhost.example.com`
  - Use `${VAR:?required}` for required secrets. Do NOT write literal credential defaults.
  - `（サンプルで設定済み）` not `（デフォルト）` for explicitly-set sample values
  - All code fences balanced; callouts closed
  - No literal passwords, no real IPs (except `0.0.0.0` / `127.0.0.1` in legitimate localhost contexts), no real UUIDs

- [ ] **Pre-commit sanity checks**:

```bash
wc -l docs/examples/<sample>.md
grep -E "_PASSWORD=[^\${]|_SECRET=[^\${]|_TOKEN=[^\${]|Bearer |sk_[a-zA-Z0-9]|pk_[a-zA-Z0-9]|whsec_|hf_[a-zA-Z0-9]" docs/examples/<sample>.md
# Expect no output. The pattern excludes ${VAR:?required} placeholders. Also note: $(openssl rand -base64 32) style commands are demonstrating how to GENERATE secrets and are not hardcoded values — these are acceptable.
grep -E "([0-9]{1,3}\.){3}[0-9]{1,3}" docs/examples/<sample>.md
# Only 0.0.0.0 / 127.0.0.1 acceptable; otherwise no output
grep -c "NVIDIA\|cloud-init\|nvidia-smi" docs/examples/<sample>.md
# Expect 0 — CPU-only phase
grep -c "vllm-gpu) と同じ内容" docs/examples/<sample>.md
# Expect 0 — CPU-only
npx vitepress build docs
# Expect clean
```

- [ ] **Commit**: one commit per page, message:

```
docs(examples): add <sample> flagship page

<2-line summary of what the page covers and the headline pattern>
```

### Task 2: outline (proxy mode, multi-FQDN OIDC, /_health probe)

**Files:**
- Create: `docs/examples/outline.md`

**Sample-specific notes for the implementer:**

- conoha.yml has a single `expose:` subdomain entry: `dex` on `dex.<root>` with `blue_green: false`. The headline story for this page is **self-hosted OIDC via Dex on a separate subdomain** so the OAuth2 redirect flow can reach Dex over HTTPS. Explain WHY Dex is on its own subdomain rather than a path under root: the OIDC discovery + redirect flow uses the `iss` URL, and changing `iss` mid-deploy breaks tokens — keeping Dex on its own subdomain isolates the OIDC issuer URL from the wiki's path namespace.
- `web.health.path: /_health` and `unhealthy_threshold: 24` are both explicit Outline quirks. Document both: Outline has no `/up` (proxy's default), `/_health` returns 200 once the server is reachable, and first-start runs DB migrations.
- `dex.health.path: /dex/healthz` — Dex's default `/up` 404s; the health endpoint is under `/dex/`.
- `blue_green: false` on Dex: sqlite-backed sessions and approval state would diverge across slots. Mention that this means Dex code changes don't slot-rotate (similar to `worker` in dify-https, but here the limitation is intentional architectural).
- Blog draft at `app-samples/docs/blogs/outline.md` (394 lines) — use it for intro voice ("Notion ライク" framing) and for the OIDC walkthrough. The blog draft includes a step-by-step Dex configuration that's worth distilling into the 初期セットアップ section.
- 2 DNS A records: `outline.example.com` and `dex.outline.example.com` (or whatever the user's actual root + subdomain). Surface this explicitly in 前提条件 and デプロイ — common gotcha.
- 関連 cross-links: `/examples/hydra-python-api` (OIDC peer), `/examples/dify-https` (multi-FQDN peer), `/examples/gitea` (other OIDC sample), `/examples/voice-agent-conoha-l4` (accessory peer).

### Task 3: supabase-selfhost (proxy mode, Kong API gateway, multi-FQDN, 4-accessory)

**Files:**
- Create: `docs/examples/supabase-selfhost.md`

**Sample-specific notes:**

- conoha.yml uses `kong` as the root `web` service. The headline story is **Kong as the API gateway** that routes all Supabase client SDK calls (`/rest/*`, `/auth/*`, etc.) on the root FQDN. Studio (admin UI) is on the `admin.` subdomain because it's a Next.js app — keeping it off the root means the Kong routing doesn't have to know about the Next.js bundle.
- `web.health.path: /auth/v1/health` — Kong's `/` returns 404 because there's no matching route registered without an `apikey` header. The `auth/v1/health` path is exposed by Kong (proxies through to GoTrue's health endpoint) without auth. Surface this as a non-obvious operational detail.
- `unhealthy_threshold: 24` — Supabase first-boot is slow (GoTrue / PostgREST / Postgres startup chain). Document this honestly.
- `admin` expose block: `blue_green: false` because Studio's in-memory connection pool to postgres-meta isn't designed for parallel slots.
- Four accessories: `auth` (GoTrue), `rest` (PostgREST), `meta` (postgres-meta), `db` (PostgreSQL). Document the role of each:
  - `auth` / `rest` — reached via Kong on root; never expose `auth:9999` / `rest:3000` directly
  - `meta` — reached by Studio internally for the Table Editor schema introspection
  - `db` — PostgreSQL, never expose `:5432` publicly (only role-based auth in front of it)
- 2 DNS A records: `supabase-selfhost.example.com` and `admin.supabase-selfhost.example.com`
- No blog draft — lean on README + conoha.yml inline comments.
- `.env` required vars: `JWT_SECRET` (use `openssl rand -base64 64`), `ANON_KEY` + `SERVICE_ROLE_KEY` (these are signed JWTs derived from `JWT_SECRET` — document the generation flow), `POSTGRES_PASSWORD`, `DASHBOARD_USERNAME` + `DASHBOARD_PASSWORD` for Studio.
- 関連 cross-links: `/examples/dify-https` (multi-FQDN + DB-heavy peer), `/examples/nginx-reverse-proxy` (gateway pattern cousin), `/examples/voice-agent-conoha-l4` (accessory peer).

### Task 4: immich (proxy mode, 3-accessory, photo backup)

**Files:**
- Create: `docs/examples/immich.md`

**Sample-specific notes:**

- conoha.yml is the simplest of the three — single FQDN, no `expose:` subdomain, `accessories: [immich-machine-learning, db, redis]`. The headline story is the **3-accessory pattern**:
  - `immich-machine-learning` — the ML model cache (face/object recognition). Cold-start downloads multi-GB models from Hugging Face. Must NOT be reset on redeploy.
  - `db` — pgvecto-rs (PostgreSQL with vector extension). Holds photo metadata + face embeddings. Re-indexing is expensive.
  - `redis` — job queue state. Resetting drops in-flight photo upload jobs.
- Only 1 DNS A record (no subdomain).
- Storage: the photo library lives in a Docker volume (`UPLOAD_LOCATION`). Surface size planning honestly — Immich users routinely have 100GB+ photo libraries. Document how to attach a separate volume or override `UPLOAD_LOCATION` to a mounted disk.
- ML model first-download is large. Document `start_period` and the warm-up wait.
- `.env` required vars: `DB_PASSWORD`, `UPLOAD_LOCATION` (default `./library` is fine for small libs; recommend an absolute path for prod), `IMMICH_VERSION` (pin a tag, not `release`).
- Mobile / desktop client apps: Immich has iOS / Android / desktop apps that talk to the server. Surface this and the OAuth-style "API key" the mobile app needs.
- No blog draft — lean on README (which is short at 54 lines) + conoha.yml comments.
- README is short, but the upstream `docker-compose.yml` and Immich's own docs are rich — implementer should be honest if the page ends up needing to explain Immich-specific config that the README doesn't cover.
- 関連 cross-links: `/examples/ollama-webui-gpu` (accessories pattern peer; same warm-cache rationale), `/examples/voice-agent-conoha-l4` (multi-accessory peer), `/examples/dify-https` (DB-heavy SaaS peer).

---

## Task 5: Sidebar update — rename category + append 3 entries

**Files:**
- Modify: `docs/.vitepress/config/ja.ts`

- [ ] **Step 5.1: Locate the current section** (around lines 68–76):

```ts
{
  text: 'セルフホスティング',
  items: [
    { text: 'WordPress', link: '/examples/wordpress' },
    { text: 'Ghost ブログ', link: '/examples/ghost-blog' },
    { text: 'Gitea', link: '/examples/gitea' },
    { text: 'MinIO + n8n', link: '/examples/minio-n8n' },
  ],
},
```

- [ ] **Step 5.2: Replace with the renamed + expanded section** (3 new entries inserted in an order that groups OIDC-bearing samples and admin-UI samples sensibly):

```ts
{
  text: 'セルフホスティング SaaS',
  items: [
    { text: 'WordPress', link: '/examples/wordpress' },
    { text: 'Ghost ブログ', link: '/examples/ghost-blog' },
    { text: 'Gitea (OIDC)', link: '/examples/gitea' },
    { text: 'Outline (OIDC チーム Wiki)', link: '/examples/outline' },
    { text: 'Supabase Self-host', link: '/examples/supabase-selfhost' },
    { text: 'Immich (写真管理)', link: '/examples/immich' },
    { text: 'MinIO + n8n', link: '/examples/minio-n8n' },
  ],
},
```

Notes on the new order: `Gitea` gets an `(OIDC)` parenthetical to match `Outline (OIDC チーム Wiki)`. Order goes from older / simpler (WordPress, Ghost) → OIDC pair (Gitea, Outline) → DB-heavy infrastructure (Supabase, Immich) → workflow (MinIO + n8n).

Use the Edit tool. Match the existing 2-space indentation. Phase 2a already established that adding `(L4 GPU)` / `(CPU)` distinguishers is fine; this phase uses parentheticals analogously.

- [ ] **Step 5.3: Build clean**:

```bash
npx vitepress build docs
```

Expected: clean build, no dead-link warnings (all 3 new pages exist on the branch by this point).

- [ ] **Step 5.4: Commit**:

```bash
git add docs/.vitepress/config/ja.ts
git commit -m "$(cat <<'EOF'
docs(sidebar): rename セルフホスティング → セルフホスティング SaaS, add 3 phase-2b flagships

- Rename category to match the spec's target (also aligns with the
  Phase 2a AI/LLM → AI/GPU precedent: 2-word disambiguation)
- Add OIDC parenthetical to Gitea to match new Outline label
- Add outline, supabase-selfhost, immich
EOF
)"
```

---

## Task 6: index.md rewire — swap 3 GitHub links to internal

**Files:**
- Modify: `docs/index.md`

The three rows already exist in the SaaS table (around lines 50–52). Swap each to internal links.

- [ ] **Step 6.1: Three Edit-tool replacements**, one per row (each has a unique `old_string`):

Edit 1:
```diff
- | [supabase-selfhost](https://github.com/crowdy/conoha-cli-app-samples/tree/main/supabase-selfhost) | Supabase をフルセット (Studio + Kong + GoTrue + PostgREST) |
+ | [supabase-selfhost](/examples/supabase-selfhost) | Supabase をフルセット (Studio + Kong + GoTrue + PostgREST) |
```

Edit 2:
```diff
- | [immich](https://github.com/crowdy/conoha-cli-app-samples/tree/main/immich) | Google フォト代替の写真バックアップ |
+ | [immich](/examples/immich) | Google フォト代替の写真バックアップ |
```

Edit 3:
```diff
- | [outline](https://github.com/crowdy/conoha-cli-app-samples/tree/main/outline) | Notion 風チームナレッジベース (OIDC 認証付き) |
+ | [outline](/examples/outline) | Notion 風チームナレッジベース (OIDC 認証付き) |
```

- [ ] **Step 6.2: Build clean**:

```bash
npx vitepress build docs
```

- [ ] **Step 6.3: Commit**:

```bash
git add docs/index.md
git commit -m "$(cat <<'EOF'
docs(home): rewire SaaS table to internal links for phase-2b flagships

Swap 3 GitHub /tree/main/ links to /examples/ internal links:
outline, supabase-selfhost, immich.
EOF
)"
```

---

## Task 7: Final build verification and PR

**Files:** none (verification + push only).

- [ ] **Step 7.1: Clean rebuild**:

```bash
rm -rf docs/.vitepress/dist
npx vitepress build docs
```

Expected: `build complete in <Ns>.` with no warnings.

- [ ] **Step 7.2: Confirm the file change set**:

```bash
git diff --stat main...HEAD
```

Expected ~5 files (3 new pages + sidebar config + index.md). Plus the Phase 2b plan file if it's still tagging along from local main.

- [ ] **Step 7.3: Secret-handling sweep**:

```bash
git diff main...HEAD -- 'docs/examples/*.md' \
  | grep -E "_PASSWORD=[^\${]|_SECRET=[^\${]|_TOKEN=[^\${]|Bearer |sk_[a-zA-Z0-9]|pk_[a-zA-Z0-9]|whsec_|hf_[a-zA-Z0-9]" \
  | grep -v ":?required\|openssl rand\|hf_cache\|HF_HOME"
```

Expected: no output. `$(openssl rand ...)` patterns demonstrating secret GENERATION are acceptable and excluded above.

```bash
git diff main...HEAD -- 'docs/examples/*.md' \
  | grep -E "^\+.*([0-9]{1,3}\.){3}[0-9]{1,3}" \
  | grep -v "0\.0\.0\.0\|127\.0\.0\.1"
```

Expected: no output.

- [ ] **Step 7.4: Push the branch**:

```bash
git push -u origin docs/examples-phase2b-saas-flagships
```

- [ ] **Step 7.5: Open the PR**:

```bash
gh pr create --title "docs(examples): self-hosted SaaS flagships — 3 new pages + sidebar rename (Phase 2b)" --body "$(cat <<'EOF'
## Summary

Phase 2b of the app-samples reflection work
(spec: \`docs/superpowers/specs/2026-06-05-app-samples-reflection-design.md\`,
plan: \`docs/superpowers/plans/2026-06-05-app-samples-phase2b-saas-flagships.md\`).
Adds three flagship pages for the self-hosted SaaS samples and renames
the sidebar category. Phase 2c (PaaS — coolify, dokploy) comes next.

### Site changes

- 3 new pages under \`docs/examples/\`: outline, supabase-selfhost, immich
- Sidebar: \`セルフホスティング\` → \`セルフホスティング SaaS\`; Gitea gets
  an \`(OIDC)\` parenthetical to match the new Outline label; 3 new
  entries inserted in OIDC/DB/workflow groupings
- \`docs/index.md\`: 3 rows in the SaaS table swapped from GitHub to
  internal links

### Patterns demonstrated by these pages

- Self-hosted OIDC via Dex on a subdomain (outline) — multi-FQDN OIDC
  reachability + sqlite session caveat
- Kong API gateway routing (supabase-selfhost) — root-FQDN API
  routing + admin UI on subdomain + 4-accessory worker split
- 3-accessory pattern (immich) — ML model cache + pgvector DB +
  Redis queue, all warm across blue/green swaps

### Doc trail (\`srcExclude\`'d from build)

- \`docs/superpowers/plans/2026-06-05-app-samples-phase2b-saas-flagships.md\`

## Test plan

- [ ] \`npx vitepress build docs\` is clean
- [ ] Each new page renders at \`/examples/<sample>\` with correct
  sidebar context
- [ ] Sidebar shows \`セルフホスティング SaaS\` and 7 entries
- [ ] \`docs/index.md\` SaaS table now has 3 new internal links
- [ ] \`gitleaks\` PR check passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: the command returns a PR URL.

---

## Follow-up plans

After this PR is merged, the remaining Phase-2 / Phase-3 / Phase-4 PRs each get their own plan:

- `2026-MM-DD-app-samples-phase2c-devinfra-flagships.md` — coolify, dokploy
- `2026-MM-DD-app-samples-phase2d-fullstack-flagships.md` — nextjs-fastapi-postgresql, nextjs-fastapi-clerk-stripe, rails-mercari
- `2026-MM-DD-app-samples-phase3a-compact-web-curio.md` — 8 compact pages
- `2026-MM-DD-app-samples-phase3b-compact-saas-devinfra.md` — 13 compact pages
- `2026-MM-DD-app-samples-phase4-cleanup.md` — count bump + residual rewires + dead-link sweep
