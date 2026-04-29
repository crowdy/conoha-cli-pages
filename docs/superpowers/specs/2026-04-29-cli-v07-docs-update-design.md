# Docs Update for conoha-cli v0.7.x + conoha-proxy

**Date:** 2026-04-29
**Topic:** Reflect v0.5.0 → v0.7.1 conoha-cli features and the conoha-proxy subsystem in the docs site.
**Status:** Design approved, awaiting plan.

## Context

The docs site (`crowdy.github.io/conoha-cli-pages`) was last meaningfully updated against pre-v0.6.0 conoha-cli. Since then:

- v0.6.0 introduced the `cmd/proxy` subsystem (`conoha proxy boot/...`) and made **proxy-mode blue/green deploys the default `app deploy` behavior**. `app deploy` no longer works without `conoha.yml` unless `--no-proxy` is passed.
- v0.6.0–v0.7.1 added many features: `expose:` blocks (multi-host), `app rollback`, `gpu setup`, `--for proxy` server preset, `--user-data*` startup scripts, `--delete-boot-volume`, `volume rename`, filter operators (`~`, `~=`), SSH TOFU, distinct exit codes, `--compose-file`, etc.
- Whole command groups (`proxy`, `dns`, `lb`, `flavor`, `image`, `storage`, `identity`, `gpu`, `config`) have **no reference page** at all — present in the CLI but absent from the site.
- `en.ts` / `ko.ts` sidebars reference pages under `/en/...` and `/ko/...` but no markdown files exist for those locales — 404 across the board.

The result: a user landing on the docs site cannot complete a v0.7.1 walkthrough; the site teaches a flow (`app init` + `app deploy` with no `conoha.yml`) that current CLI rejects.

## Goals

1. **Reference completeness** — every command group in `cmd/` has a reference page.
2. **Mode clarity** — proxy and no-proxy modes, when to choose each, and how to switch, are explained in one canonical place.
3. **Link integrity** — every nav/sidebar link returns 200. en/ko sidebars are pruned to pages that actually exist.
4. **Examples runnable on v0.7.1** — Hello World and Next.js demonstrate proxy mode end-to-end; the other 18 examples explicitly opt into `--no-proxy` so they continue to work.
5. **Build clean** — `npx vitepress build docs` passes with no warnings on every PR.

## Non-Goals

- Theme / visual redesign.
- New site sections (tutorial videos, auto-generated API ref, etc.).
- Authoring conoha-proxy's own docs (lives in `crowdy/conoha-proxy`).
- Adding new example apps (only updating existing 20).
- Search / SEO tuning.
- Full en/ko parity. Only seven canonical pages get translated this round.

## Information Architecture

### Sidebar (ja, primary locale)

**Guide**
- はじめに — getting-started *(refresh)*
- クイックスタート — quickstart *(rewrite, proxy first)*
- サーバー管理 — server *(refresh)*
- アプリデプロイ — app-deploy *(rewrite around mode comparison)*
- アプリ管理 — app-management *(refresh)*
- conoha-proxy セットアップ — proxy-setup *(new)*
- DNS / TLS — dns-tls *(new)*
- GPU セットアップ — gpu-setup *(new)*
- Claude Code スキル — skill *(unchanged)*

**Reference**
- auth, server *(refresh)*, keypair, volume *(refresh)*, network
- flavor *(new)*, image *(new)*, dns *(new)*, lb *(new)*
- storage *(new)*, identity *(new)*
- app *(major refresh)*, proxy *(new)*, gpu *(new)*, config *(new)*
- skill
- グローバルフラグ・環境変数 — global-flags *(new)*
- 終了コード — exit-codes *(new)*

**Examples** — sidebar unchanged; content updated in-place.

### Locales (en/ko)

Seven canonical pages translated; sidebar pruned to those:
- `guide/getting-started`
- `guide/app-deploy`
- `reference/app`
- `reference/proxy`
- `reference/server`
- `reference/global-flags`
- `reference/exit-codes`

`docs/en/` and `docs/ko/` directories are created in PR 6. Other sidebar entries currently in `en.ts` / `ko.ts` are removed in the same PR (no orphan 404 links).

## Page Specifications

### New guide pages

**`guide/proxy-setup.md`** — what conoha-proxy is and why (HTTPS, blue/green, drain), `proxy boot --acme-email` and what it changes on the host (UFW 80/443, sysctl `net.ipv4.ip_unprivileged_port_start=0`), `proxy logs / details / services` for ops, Admin Unix socket location and `--data-dir`, troubleshooting (ACME failures, healthy-gate timeout via `--wait-timeout`, DNS-not-pointed → TLS handshake failure).

**`guide/dns-tls.md`** — adding a domain via `conoha dns`, A-record management, propagation check, Let's Encrypt HTTP-01 prerequisites (port 80 reachable, A record matches), proxy auto-renewal, renewal-failure diagnosis.

**`guide/gpu-setup.md`** — `conoha gpu setup` (one-shot NVIDIA driver + container toolkit), target flavor / image guidance, post-checks (`nvidia-smi`).

### Rewritten guide pages

**`guide/quickstart.md`** — Path A (proxy mode) first: `proxy boot` → DNS A → write `conoha.yml` → `app init` → `app deploy` → HTTPS. Path B (no-proxy) follows as "simpler alternative": pre-installed Docker → `app init --no-proxy` → `app deploy --no-proxy`. Sequential, not tabbed.

**`guide/app-deploy.md`** — opens with mode comparison table (purpose, conoha.yml needed, DNS, TLS, slot, rollback). Then proxy mode (full `conoha.yml` schema, `expose:` blocks for multi-host, slot auto-suffix). Then no-proxy mode (current content, cleaned). Mode switching (destroy → init in opposite mode). Coexistence of both modes on the same VPS via different `<app-name>`s.

### Refreshed guide pages

**`guide/server.md`** — add `--for proxy` preset section, `--user-data` / `--user-data-raw` / `--user-data-url` section, `--delete-boot-volume` section, `open-port` shortcut section. Note `--flavor` accepts flavor names.

**`guide/app-management.md`** — add `app rollback` section (drain window, `--target=<label>`), explicitly note `app env` proxy-mode warning behavior (#94). `app reset` already documented.

### New reference pages

- **`reference/proxy.md`** — boot, reboot, start, stop, restart, remove, logs, details, services (signature + flag table + behavior summary each).
- **`reference/dns.md`** — domain create/list/delete, record create/list/delete; note `id`/`uuid` decode acceptance.
- **`reference/lb.md`** — lb / listener / pool / member / healthmonitor (CRUD per group).
- **`reference/flavor.md`** — list, show.
- **`reference/image.md`** — list, show, create, upload, import, delete.
- **`reference/storage.md`** — container, ls, cp, rm, publish.
- **`reference/identity.md`** — credential, subuser, role.
- **`reference/gpu.md`** — `gpu setup` (target flavor, steps, idempotency).
- **`reference/config.md`** — show, set, path; config file locations and precedence.
- **`reference/global-flags.md`** — `--profile`, `--format`, `--no-input`, `--yes`, `--filter` (with `=` / `~` / `~=`), `--sort-by`, `--wait`, `--wait-timeout`, `--no-color`, plus all 13 `CONOHA_*` env vars.
- **`reference/exit-codes.md`** — 0, 1, 2, 3, 4, 5, 6, 10 plus mode-conflict / not-initialized distinctions.

### Refreshed reference pages

- **`reference/app.md`** — add `--proxy` / `--no-proxy` / `--slot` / `--drain-ms` / `--compose-file` / `--insecure` to the relevant subcommands. New `app rollback` section with `--target`. Document `app status --format json` shape `{root, expose:[{label, service}]}`.
- **`reference/server.md`** — `--for`, `--user-data*`, `--delete-boot-volume`, `add-security-group` / `remove-security-group` (Neutron port API), `open-port`, `--flavor` accepting flavor names. `server ssh` gains a known_hosts / TOFU note and `--insecure` flag (matches the `app init`/`deploy` SSH behavior, source: v0.6.1 #135).
- **`reference/volume.md`** — `volume rename`, `volume create --image` (bootable), duplicate-name warning.

### Examples

- **`hello-world.md`, `nextjs.md`** — rewrite for proxy mode (full `conoha.yml`, `proxy boot`, DNS prerequisite, `app deploy`).
- **Other 18 example pages** — add `--no-proxy --app-name <name>` to `app init` / `app deploy` invocations; one-line note at top: "本例は no-proxy モードで動作します".

### en/ko translations

Translate the seven canonical pages. Ja remains canonical; en/ko are translations, not separate authoritative docs.

## PR Plan

Six PRs, each independently mergeable, each producing a clean build and consistent sidebar. Order matters where called out.

### PR 1 — proxy mode core
**New**: `guide/proxy-setup.md`, `reference/proxy.md`.
**Rewrite/refresh**: `guide/app-deploy.md`, `guide/quickstart.md`, `reference/app.md`.
**Sidebar (ja)**: register `guide/proxy-setup`, `reference/proxy`.
Locale impact: ja only.

### PR 2 — new reference pages
**New**: `reference/dns.md`, `reference/lb.md`, `reference/flavor.md`, `reference/image.md`, `reference/storage.md`, `reference/identity.md`, `reference/gpu.md`, `reference/config.md`.
**Sidebar (ja)**: register all eight.

### PR 3 — server / volume / app-management refresh + new ops guides
**New**: `guide/dns-tls.md`, `guide/gpu-setup.md`.
**Refresh**: `reference/server.md`, `reference/volume.md`, `guide/server.md`, `guide/app-management.md`.
**Sidebar (ja)**: register two new guides.

### PR 4 — appendix reference
**New**: `reference/global-flags.md`, `reference/exit-codes.md`.
**Sidebar (ja)**: register both under an appendix subsection.

### PR 5 — examples
**Rewrite**: `examples/hello-world.md`, `examples/nextjs.md` for proxy mode.
**Refresh**: 18 other examples to add `--no-proxy --app-name` and an opening note.
Sidebar: unchanged.

### PR 6 — en/ko core translations
**New directories**: `docs/en/{guide,reference}/`, `docs/ko/{guide,reference}/`.
**New files**: 7 pages × 2 languages = 14.
**Sidebar (en/ko)**: prune to translated pages only.

### Dependencies

- PR 1 first (sets the proxy-mode story the rest references).
- PR 2, 3, 4 can run in parallel after PR 1.
- PR 5 after PR 1 (examples reference proxy mode).
- PR 6 last, after PR 1–4 stabilize, to avoid translation drift.

### Per-PR acceptance

- `npx vitepress build docs` passes.
- All nav/sidebar links resolve to pages that exist.
- New CLI examples are taken from one of: (a) running v0.7.1 locally and capturing output, (b) verbatim from `crowdy/conoha-cli` README, or (c) verbatim from cmd source/help text. Mark which when not (a).
- No fabricated flags or output.

## Risks and Mitigations

- **Drift between docs and CLI.** Mitigation: cite exact CLI source paths in commit messages where flags came from; build PRs against a pinned CLI version (note in spec: v0.7.1 as of 2026-04-26).
- **PR 5 (examples) creates large diffs.** Mitigation: stick to mechanical insertions for the 18; only Hello World + Next.js carry meaningful prose changes.
- **PR 6 translations going stale.** Mitigation: PR 6 runs after others; translation files include a "Source revision: <commit>" footer pointer.
- **Sidebar churn across PRs causing nav flicker on staging.** Mitigation: each PR's sidebar edit is additive (or removes only items it owns); build verification on each PR.

## Verification

- Build: `npx vitepress build docs`.
- Manual: spot-check each new page renders, sidebar nav matches.
- Cross-language: PR 6 only — confirm en/ko language switcher does not 404 from any nav entry.
- Sample command run: pick at least one new reference page per PR and walk through one of its commands on a real VPS; capture output. (Stretch — best-effort, not blocking.)

## Out of Scope (filed as future work, not blocking)

- Adding more example apps (proxy-mode samples beyond Hello World / Next.js).
- Auto-generation of reference pages from Cobra `--help`.
- Versioned docs (per-CLI-version snapshots).
- en/ko parity beyond the seven canonical pages.
