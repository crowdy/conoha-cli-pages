# Reflecting conoha-cli-app-samples into /examples/

**Date:** 2026-06-05
**Topic:** Bring the 35 samples in `conoha-cli-app-samples` that lack a dedicated `/examples/` page on `conoha-cli-pages` into the site, restructure the sidebar to mirror `index.md`, and rewire home-page links.
**Status:** Design awaiting approval.

## Context

`conoha-cli-app-samples` currently ships **56 deployable samples** ranging from one-file static sites to multi-service AI agents. `conoha-cli-pages/docs/examples/` carries pages for only **21** of them; the other 35 are reachable only via GitHub links scattered across `docs/index.md`. The newest sample, `opencascade-fem` (PR #108, 2026-05-23), prompted this work — it lives only as a row in the home-page table.

The site's promise ("50+ samples, all `git clone` → `conoha app deploy`") is undercut when most samples lack an on-site page: readers landing from a search engine cannot read a story without leaving the site, and the sidebar's five categories (`Starter / Web / AI/LLM / Self-hosting / Architecture`) no longer reflect how `index.md` organises the catalog (eight categories: AI/GPU, Self-hosting SaaS, Dev Infra/Ops, Full-stack Web, Curiosities, plus the three above).

## Goals

1. **Coverage** — every sample in `app-samples` has a corresponding `/examples/<sample>.md` page.
2. **Tiered depth** — 14 *flagship* pages (GPU/AI + showcase self-hosted/PaaS/full-stack) match the depth of `vllm-gpu.md` (~200–400 lines). The remaining 21 use a compact template (~60–100 lines) that points readers back to the upstream README for compose details.
3. **Sidebar parity with `index.md`** — eight categories, same order, same naming.
4. **Link rewiring** — every GitHub `tree/main/<sample>` link in `index.md` that now has an on-site page becomes an internal `/examples/<sample>` link. The closing "→ list all 50+ samples" link to GitHub stays as the authoritative catalog.
5. **Authoring rules captured** — `CONTRIBUTING.md` gains a short checklist for adding a new example page so future samples don't drift.
6. **Build clean** — `npx vitepress build docs` passes with no dead-link or sidebar warnings on every PR.

## Non-Goals

- en / ko translations of the new pages. The `docs/en/` and `docs/ko/` trees currently have **no** `/examples/` content; preserving that gap is a deliberate scope cut. Add an `i18n` follow-up.
- Rewriting existing 21 example pages.
- Authoring the upstream `app-samples` README or changing how samples are organised in that repo.
- Building a generated index page (`/examples/index.md`) — the sidebar is the index for now. Revisit if the sidebar exceeds ~60 entries.
- Touching guide / reference pages.
- Adding screenshots that don't already exist upstream in `app-samples/<sample>/docs/`.

## Information Architecture

### Sidebar (ja, primary locale)

Sidebar config lives in `docs/.vitepress/config/ja.ts` under `/examples/`. New shape:

1. **スターター** — `hello-world`
2. **Web フレームワーク** (13) — existing 11 + `hono-drizzle-postgresql` + `bun-elysia-chat`
3. **フルスタックウェブ** *(new)* (5) — `nextjs-fastapi-postgresql`, `nextjs-fastapi-clerk-stripe`, `rails-mercari`, `nextjs-go-google_ucp`, `sendgrid-invitation`
4. **AI / GPU** (8) — existing 3 + `ollama-webui-gpu`, `hunyuan3d-gpu`, `fish-speech-tts-gpu`, `voice-agent-conoha-l4`, `dify-https`
5. **セルフホスティング SaaS** (10) — existing 4 + `outline`, `supabase-selfhost`, `immich`, `strapi-postgresql`, `meilisearch`, `plausible-analytics`
6. **開発インフラ・運用** *(new)* (12) — `coolify`, `dokploy`, `github-actions-runner`, `github-pr-doc-reviewer`, `prometheus-grafana`, `quickwit-otel`, `uptime-kuma`, `chatops-deploy`, `multi-env-deploy`, `gitops-pipeline`, `hermes-agent`, `personal-dashboard`
7. **アーキテクチャパターン** (3) — existing 2 + `opencascade-fem`
8. **ちょっと変わったもの** *(new)* (4) — `dns-server`, `line-api-mock`, `line-cli-go`, `slurm-rest-api`

Existing pages (`wordpress.md` etc.) keep their filenames; ordering inside the new categories follows `index.md`. `nav.実践例` continues to point at `/examples/nextjs` — no change.

### Page tiers

#### Flagship (14 — full vllm-gpu treatment, 200–400 lines)

| Sample | Category | Why flagship |
|---|---|---|
| `opencascade-fem` | アーキパターン | SSE + WebGL + heavy conda deps; fresh and high-touch |
| `hunyuan3d-gpu` | AI / GPU | L4 GPU + large model + GLB output |
| `fish-speech-tts-gpu` | AI / GPU | TTS + CLI client integration |
| `ollama-webui-gpu` | AI / GPU | Must contrast with CPU `ollama-webui` page |
| `voice-agent-conoha-l4` | AI / GPU | Self-contained WebRTC + STT + LLM + TTS stack |
| `dify-https` | AI / GPU | nginx + Dify wiring is non-obvious |
| `supabase-selfhost` | SaaS | Studio + Kong + GoTrue + PostgREST multi-service |
| `immich` | SaaS | OIDC + photo ingestion pipeline |
| `outline` | SaaS | OIDC (Dex) + self-hosted wiki |
| `coolify` | Dev Infra | PaaS, prime example of `accessories:` modelling |
| `dokploy` | Dev Infra | install.sh + Swarm, different from coolify |
| `nextjs-fastapi-postgresql` | Full-stack | Canonical full-stack template |
| `nextjs-fastapi-clerk-stripe` | Full-stack | Clerk + Stripe SaaS web shape |
| `rails-mercari` | Full-stack | OIDC + Sidekiq + Redis "production-ish" Rails |

#### Compact (21 — short template, 60–100 lines)

| Category | Samples |
|---|---|
| Web / Full-stack | `bun-elysia-chat`, `hono-drizzle-postgresql`, `nextjs-go-google_ucp`, `sendgrid-invitation` |
| SaaS | `meilisearch`, `plausible-analytics`, `strapi-postgresql` |
| Dev Infra | `github-actions-runner`, `github-pr-doc-reviewer`, `prometheus-grafana`, `quickwit-otel`, `uptime-kuma`, `chatops-deploy`, `multi-env-deploy`, `gitops-pipeline`, `hermes-agent`, `personal-dashboard` |
| Curiosities | `dns-server`, `line-api-mock`, `line-cli-go`, `slurm-rest-api` |

Compact pages can be promoted to flagship later by adding sections; the template is a strict subset.

## Page Templates

### Flagship template

```markdown
# <タイトル> デプロイ

<1–2 paragraph intro; state proxy vs no-proxy mode>

::: tip / warning (mode note)
:::

## 完成イメージ
- 3–5 bullets of post-deploy capabilities
- Screenshot from `app-samples/<sample>/docs/` if present

## 前提条件
- CLI / proxy boot / DNS / GPU prerequisites

## 1. compose.yml (抜粋)
<excerpt; link to full file on GitHub>

## 2. <config file> (Caddyfile / .env / nginx.conf as needed)

## 3. (GPU only) cloud-init / NVIDIA setup

## 4. デプロイ
Make `--no-proxy` opt-in explicit when applicable.

## 5. 動作確認
- smoke-test script invocation
- browser / curl / SDK example

## カスタマイズ
- Model swap / OIDC provider / DB substitution

## ハマりどころ
- Known traps with `::: warning` callouts

## 関連リンク
- Recipe (GitHub)
- Qiita / blog writeup (from `app-samples/docs/blogs/` if present)
- Upstream project docs
```

### Compact template

```markdown
# <タイトル> デプロイ

<1 paragraph: what / why / which mode>

## 完成イメージ
- 3–4 bullets

## 前提条件
- 3–4 bullets

## デプロイ手順
\`\`\`bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/<sample>
# edit conoha.yml hosts:
conoha app init <server>
conoha app deploy <server>
\`\`\`

::: tip 設定ポイント
1–3 must-know knobs (OIDC issuer, RAM floor, first-boot wait, etc.)
:::

## 動作確認
- Browser / curl health-check

## 関連リンク
- Recipe (GitHub)
- Upstream project docs
- Related samples: [<similar>](/examples/<related>)
```

### Shared conventions

- No front-matter (matches existing pages).
- Internal cross-links use absolute paths: `/examples/<sample>`, `/guide/<topic>`.
- Placeholders follow `CONTRIBUTING.md`: `<SERVER_IP>`, `<YOUR_KEY>`, `${POSTGRES_PASSWORD:?required}`. No literal default passwords, no real IPs, no real tenant IDs.
- Screenshots: copy from `app-samples/<sample>/docs/*.png` into `docs/public/examples/<sample>/` and reference as `/examples/<sample>/<name>.png`.

## Source Material

Each page derives content from, in priority order:

1. `app-samples/<sample>/README.md` — official description, compose layout, troubleshooting.
2. `app-samples/<sample>/conoha.yml` — concrete `hosts:` / `expose:` / `accessories:` wiring (useful even in compact pages).
3. `app-samples/docs/blogs/<sample>*.md` — Qiita drafts already written for many samples; reuse the "why this is interesting" framing.
4. `app-samples/<sample>/docs/*.png` — screenshots authored upstream.

## index.md Rewiring

`docs/index.md` already lists most of the 35 new samples in category tables, but each link is `github.com/.../tree/main/<sample>`. As soon as a `/examples/<sample>` page lands, switch the link:

```diff
- | [hunyuan3d-gpu](https://github.com/crowdy/conoha-cli-app-samples/tree/main/hunyuan3d-gpu) | ... |
+ | [hunyuan3d-gpu](/examples/hunyuan3d-gpu) | ... |
```

Rules:
- If `/examples/<sample>` exists, link internally.
- If not, leave the GitHub link.
- Keep the closing "→ 全 50+ サンプルを一覧する" GitHub link as the authoritative full catalog.
- Update the "50+" count to "55+" once the cleanup PR lands.

## CONTRIBUTING.md Addition

Append, after the existing secret-handling rules:

```markdown
## Adding a new example page

1. Place the page at `docs/examples/<sample>.md` (kebab-case, same slug as `app-samples`).
2. Follow the section layout: 完成イメージ → 前提条件 → デプロイ → 動作確認 → 関連リンク.
3. Register in `docs/.vitepress/config/ja.ts` under the matching category.
4. If `docs/index.md` already links to `github.com/.../tree/main/<sample>`, swap to `/examples/<sample>`.
5. Screenshots go to `docs/public/examples/<sample>/`.
6. Apply the secret-handling rules above to every code block.
```

## Delivery Plan

Split into 7–8 PRs to keep review tractable. Phase 1 blocks every later phase; Phase 2 and Phase 3 PRs are independent within each phase.

| Phase | PR | Contents |
|---|---|---|
| 1 | `docs(examples): bootstrap 8-category sidebar + opencascade-fem` | Sidebar rewrite, `opencascade-fem` flagship page, CONTRIBUTING addition. No `index.md` changes. Validates templates and the build. |
| 2a | AI/GPU flagships | `ollama-webui-gpu`, `hunyuan3d-gpu`, `fish-speech-tts-gpu`, `voice-agent-conoha-l4`, `dify-https`; sidebar slot fills; `index.md` rewires for these five. |
| 2b | SaaS flagships | `outline`, `supabase-selfhost`, `immich` + slots + rewires. |
| 2c | Dev Infra flagships | `coolify`, `dokploy` + slots + rewires. |
| 2d | Full-stack flagships | `nextjs-fastapi-postgresql`, `nextjs-fastapi-clerk-stripe`, `rails-mercari` + slots + rewires. |
| 3a | Compact: Web/Full-stack + Curiosities | `bun-elysia-chat`, `hono-drizzle-postgresql`, `nextjs-go-google_ucp`, `sendgrid-invitation`, `dns-server`, `line-api-mock`, `line-cli-go`, `slurm-rest-api` + slots + rewires. |
| 3b | Compact: SaaS + Dev Infra | `meilisearch`, `plausible-analytics`, `strapi-postgresql`, `github-actions-runner`, `github-pr-doc-reviewer`, `prometheus-grafana`, `quickwit-otel`, `uptime-kuma`, `chatops-deploy`, `multi-env-deploy`, `gitops-pipeline`, `hermes-agent`, `personal-dashboard` + slots + rewires. |
| 4 | Cleanup | Count bump (`50+` → `55+`), add `opencascade-fem` row (and any other samples missing from `index.md` tables) to the appropriate category table, final `grep` for residual `tree/main/<sample>` GitHub links, dead-link check via `vitepress build`. |

### Per-PR checklist

- New page(s) added under `docs/examples/<sample>.md`.
- Sidebar entry added to `docs/.vitepress/config/ja.ts` in the matching category.
- `docs/index.md` table rows for those samples switched to internal links.
- `npx vitepress build docs` passes with no warnings.
- No `_PASSWORD=` / `_TOKEN=` literals, no real IPs, no real UUIDs in code blocks.
- Screenshots, if any, committed under `docs/public/examples/<sample>/`.

## Risk and Trade-offs

- **Compact-tier pages risk feeling thin** vs. competing docs. Mitigation: keep the upstream README link prominent and lean on the "設定ポイント" tip to surface the few non-obvious knobs. If a compact page reads as filler, promote it.
- **`index.md` table churn** — many small rewrites across phases means rebase pain. Mitigation: phase-internal PRs touch only their samples' rows.
- **Out-of-date snapshots** — copying compose excerpts means they can drift from upstream. Mitigation: always link to the `main` branch of the actual file; never inline a full compose, only excerpt.
- **Sidebar gets long** (~60 entries). Acceptable for now; if it crosses ~80, introduce a `/examples/` landing page with grid layout and slim the sidebar to category headings only. Tracked as a follow-up, not part of this spec.

## Estimate

Rough authoring effort: 14 flagship × ~1.5 h + 21 compact × ~0.4 h ≈ 30 hours of writing, plus build / review cycles. To be broken down into concrete tasks by the implementation plan.

## Out-of-scope follow-ups

- en / ko translations for `/examples/`.
- `/examples/index.md` landing page (gallery view) if the sidebar grows past ~80 entries.
- Auto-sync check between `app-samples` directories and `docs/examples/` pages (CI job that flags drift).
- Screenshot freshness audit for flagship pages.
