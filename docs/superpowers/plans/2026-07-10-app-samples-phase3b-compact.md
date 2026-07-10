# App-samples Phase 3b — compact pages (SaaS + Dev Infra/Ops) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Parent spec:** `docs/superpowers/specs/2026-06-05-app-samples-reflection-design.md` (Phase 3b row; compact template; IA §5/§6; source-material order).

**Goal:** Add 13 compact `/examples/` pages (meilisearch, plausible-analytics, strapi-postgresql, github-actions-runner, github-pr-doc-reviewer, prometheus-grafana, quickwit-otel, uptime-kuma, chatops-deploy, multi-env-deploy, gitops-pipeline, hermes-agent, personal-dashboard), register them in the ja sidebar (existing セルフホスティング SaaS + 開発インフラ・運用 categories — no new category), and rewire the 6 already-present `docs/index.md` rows to internal links — one PR.

**Architecture:** Identical to Phase 3a. One authoring subagent per page (isolated new file); controller wires the two shared files (`ja.ts`, `index.md`) centrally afterward.

## Global Constraints

Same as Phase 3a (copied verbatim — binding on every task):
- **Tier = compact** (~60–130 lines). Spec "Compact template": intro (state proxy vs no-proxy mode) → 完成イメージ → 前提条件 → デプロイ手順 → `::: tip 設定ポイント` (1–3 knobs) → 動作確認 → 関連リンク. Fuller sections only where a sample genuinely needs it (multi-FQDN expose, no-proxy/installer, special TLS).
- **No front-matter. ja locale only. Absolute internal links** (`/examples/x`, `/guide/x`).
- **Source order:** README.md → conoha.yml → compose.yml/docker-compose.yml → .env.example. Fetch: `gh api repos/crowdy/conoha-cli-app-samples/contents/<sample>/<file> --jq '.content' | base64 -d`. Reproduce conoha.yml inline comments verbatim; excerpt compose, link full file on GitHub main.
- **Secret-handling (gitleaks blocks merge):** no literal passwords/tokens/keys — mask as `${VAR:?required}`/`<PLACEHOLDER>`; never reproduce upstream weak defaults as literals (describe generically); no real IPs (0.0.0.0/127.0.0.1 + RFC-5737 OK); no real UUIDs; mask connection strings; never print a real-looking body after `sk_`/`pk_`/`whsec_`/`price_`/`SG.`/`hf_`/`AIza`/`ghp_`/`github_pat_`/`eyJ`/`Bearer`.
- `（サンプルで設定済み）` not `（デフォルト）` for sample-set values.
- **Build clean:** `npx vitepress build docs`, no dead-link warnings (pre-existing caddyfile notice OK).
- **File scoping:** an authoring subagent writes ONLY its own `docs/examples/<sample>.md`; never touches ja.ts/index.md.

---

### Tasks 1–13: author one compact page per sample

Each task: fetch sources, write `docs/examples/<sample>.md` per the compact template + Global Constraints, run the secret/IP sweep, report. Per-sample facts (from conoha.yml unless noted):

1. **meilisearch** — proxy, web `meilisearch:7700`, no accessories. 設定ポイント: `MEILI_MASTER_KEY` must be `${MEILI_MASTER_KEY:?required}` (search admin key — never a literal); production mode requires it.
2. **plausible-analytics** — proxy, web `plausible:8000`, accessories `[db, clickhouse]` (ClickHouse holds event data, must survive blue/green — quote conoha.yml comment). 設定ポイント: `SECRET_KEY_BASE` masked; ClickHouse persistence caveat.
3. **strapi-postgresql** — proxy, web `strapi:1337`, accessories `[db]`. 設定ポイント: the Strapi secret set (`APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET`) all masked as `${...:?required}`; `accessories:[db]` blue/green pattern (quote comment).
4. **github-actions-runner** — SPECIAL: NO conoha.yml, **no-proxy** mode (outbound-only to GitHub; README says "このサンプルは proxy モードを使いません" and no conoha.yml is created). Needs a GitHub PAT (`repo` scope). 設定ポイント: `--no-proxy` init/deploy; PAT as `<PLACEHOLDER>`/`${ACCESS_TOKEN:?required}` — never a `ghp_`/`github_pat_` literal. Do NOT invent a proxy/FQDN flow.
5. **github-pr-doc-reviewer** — SPECIAL: NO conoha.yml. Self-hosted GitHub Actions runner + Claude that auto-reviews PRs (spec/ADR/glossary drift). Like github-actions-runner it is an **outbound-only self-hosted runner** with no inbound web service, so it is effectively **no-proxy** — determine the exact mode from the README and state it in the intro; do NOT invent an inbound FQDN/proxy flow. Needs GitHub PAT + **Anthropic Pro/Max subscription auth (no API key)**. 設定ポイント: PAT + REPO_URL as placeholders (never `ghp_`/`github_pat_` literal); note subscription auth = no API key needed; `quick`/`deep` modes.
6. **prometheus-grafana** — proxy, web `grafana:3000`, accessories `[prometheus, node-exporter]` (only Grafana public; Prometheus internal — quote comment). 設定ポイント: `GF_SECURITY_ADMIN_PASSWORD` masked; Prometheus not browser-reachable by design.
7. **quickwit-otel** — proxy, web `grafana:3000`, **multi-FQDN `expose:`** (`otel` subdomain → `otel-edge:4318`, `blue_green:false`, health `/`), root health `/api/health` (`unhealthy_threshold:24`), accessories `[quickwit, otel-collector]`. This one warrants a slightly fuller page. 設定ポイント: (a) the `expose:` subdomain + why `otel-edge` Caddy sidecar exists (collector's OTLP HTTP 404s on GET / — quote comment); (b) OTLP gRPC :4317 intentionally NOT exposed (HTTP/1.1 proxy limitation — quote comment); (c) DNS A records needed for root + otel subdomain.
8. **uptime-kuma** — proxy, web `uptime-kuma:3001`, no accessories. 設定ポイント: first-run admin account creation in-browser; single-service simplicity.
9. **chatops-deploy** — proxy, web `web:3000`. ChatOps deploy-bot pattern. 設定ポイント: chat-platform tokens + any ConoHa credentials as placeholders (never literals); what the bot triggers.
10. **multi-env-deploy** — proxy, web `web:3000`. Multi-environment (staging/prod) deploy pattern; conoha.yml `hosts:` is a default overridden per env via `--app-name`/per-env FQDN (quote the conoha.yml comment). 設定ポイント: per-environment `--app-name` + FQDN override; the hosts-is-a-default caveat.
11. **gitops-pipeline** — proxy, web `web:3000`. GitOps pipeline pattern. 設定ポイント: what drives the pipeline; any tokens as placeholders.
12. **hermes-agent** — proxy, web `nginx:80`, accessories `[gateway, dashboard]` (in-container nginx fronts an LLM agent gateway + HTMX dashboard; only nginx duplicated per slot — same caveat as sendgrid-invitation; quote comment). 設定ポイント: LLM API key(s) masked as `${...:?required}` (never a real key); the nginx-fronts-accessories blue/green caveat.
13. **personal-dashboard** — SPECIAL: NO conoha.yml, **no-proxy + Caddy + Cloudflare Origin CA** (the only sample using Origin CA; 15-year cert, Cloudflare Full-Strict). Go + Next.js + SQLite behind Caddy. 設定ポイント: (a) no-proxy + Cloudflare Origin CA TLS model (contrast with proxy/Let's-Encrypt); (b) Origin CA cert + key handled as files/secrets, never inlined; (c) weather(JMA)/calendar(Outlook/Google) API creds as placeholders. Frame honestly as a no-proxy/Caddy pattern, not a `conoha.yml` proxy deploy.

Per-task steps (all tasks): [ ] fetch sources → [ ] write page → [ ] secret/IP sweep clean → (controller commits centrally).

### Task 14: Sidebar registration (controller, central)

**Modify `docs/.vitepress/config/ja.ts`.** No new category. Append in spec IA order:
- **セルフホスティング SaaS** — append in spec §5 order: `Strapi + PostgreSQL (Headless CMS)` → `/examples/strapi-postgresql`; `Meilisearch (全文検索)` → `/examples/meilisearch`; `Plausible Analytics` → `/examples/plausible-analytics`.
- **開発インフラ・運用** — append (after Dokploy): `GitHub Actions Runner` → `/examples/github-actions-runner`; `GitHub PR ドキュメントレビュー` → `/examples/github-pr-doc-reviewer`; `Prometheus + Grafana` → `/examples/prometheus-grafana`; `Quickwit + OpenTelemetry` → `/examples/quickwit-otel`; `Uptime Kuma (稼働監視)` → `/examples/uptime-kuma`; `ChatOps デプロイ` → `/examples/chatops-deploy`; `マルチ環境デプロイ` → `/examples/multi-env-deploy`; `GitOps パイプライン` → `/examples/gitops-pipeline`; `Hermes エージェント` → `/examples/hermes-agent`; `パーソナルダッシュボード` → `/examples/personal-dashboard`.

### Task 15: index.md rewiring (controller, central)

**Modify `docs/index.md`.** Rewire ONLY the 6 rows already present as `tree/main` GitHub links → internal `/examples/<sample>`:
- セルフホスティング SaaS section: `plausible-analytics`.
- 開発インフラ・運用 section: `github-actions-runner`, `github-pr-doc-reviewer`, `prometheus-grafana`, `quickwit-otel`, `uptime-kuma`.

**Deferred to Phase 4 (flagged per gate discipline):** the other 7 samples (`meilisearch`, `strapi-postgresql`, `chatops-deploy`, `multi-env-deploy`, `gitops-pipeline`, `hermes-agent`, `personal-dashboard`) are ABSENT from index.md and are in Phase 4's absent-rows list — do NOT add them here. Count line + catalog link untouched (Phase 4).

### Task 16: Build + secret sweep + impl review (controller)

- [ ] `npx vitepress build docs` — dead-link clean.
- [ ] Secret/IP sweep across all 13 pages (regex per Phase 3a Verification, plus `ghp_`/`github_pat_`).
- [ ] requesting-code-review (opus) on the branch diff with this plan path; fix Critical/Important before PR.

## Verification

```bash
grep -nE "_PASSWORD=[^$]|_SECRET=[^$]|_TOKEN=[^$]|_KEYS?=[^$]|_BASE=[^$]|Bearer [A-Za-z0-9]|ghp_[A-Za-z0-9]|github_pat_[A-Za-z0-9]|eyJ[A-Za-z0-9]|sk-[A-Za-z0-9-]{8}|sk_[A-Za-z0-9]|pk_[A-Za-z0-9]|whsec_|price_[A-Za-z0-9]|SG\.[A-Za-z0-9]|hf_[A-Za-z0-9]|AIza[A-Za-z0-9]|BEGIN [A-Z ]*PRIVATE KEY|BEGIN CERTIFICATE|:-[a-z]" docs/examples/<sample>.md
grep -nE "([0-9]{1,3}\.){3}[0-9]{1,3}" docs/examples/<sample>.md | grep -vE "0\.0\.0\.0|127\.0\.0\.1|192\.0\.2\.|198\.51\.100\.|203\.0\.113\."
npx vitepress build docs   # expect "build complete", no dead-link warnings
```
(Note: a hit where the char after `=` is a placeholder — `_TOKEN=<PLACEHOLDER>`, `APP_KEYS=<...>`, `SECRET_KEY_BASE=$(openssl ...)` — is a false positive; inspect the value beside the `=`. `${VAR:?required}` forms never match because the char after `=` is `$`.)
