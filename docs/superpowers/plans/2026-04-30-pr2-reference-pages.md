# PR 2 — new reference pages: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reference pages for all conoha-cli command groups currently missing from the docs site: `flavor`, `image`, `dns`, `lb`, `storage`, `identity`, `gpu`, `config`. Each page documents every subcommand with signature + flag table, mirroring the style of `docs/reference/proxy.md` (added in PR 1).

**Architecture:** Eight new markdown files under `docs/reference/`, sidebar updates in `docs/.vitepress/config/ja.ts`. Source-of-truth: cached in `.worktrees/pr2-reference-pages/.tmp-plan-sources/` (gitignored). Build verified per task.

**Tech Stack:** VitePress 1.6.4, markdown.

**Spec:** `docs/superpowers/specs/2026-04-29-cli-v07-docs-update-design.md`

---

## File Structure

| Path | Action | Source |
|---|---|---|
| `docs/reference/flavor.md` | create | `.tmp-plan-sources/flavor_flavor.go` |
| `docs/reference/image.md` | create | `.tmp-plan-sources/image_image.go` |
| `docs/reference/dns.md` | create | `.tmp-plan-sources/dns_dns.go` |
| `docs/reference/lb.md` | create | `.tmp-plan-sources/lb_*.go` (5 files) |
| `docs/reference/storage.md` | create | `.tmp-plan-sources/storage_storage.go` |
| `docs/reference/identity.md` | create | `.tmp-plan-sources/identity_identity.go` |
| `docs/reference/gpu.md` | create | `.tmp-plan-sources/gpu_*.go` |
| `docs/reference/config.md` | create | `.tmp-plan-sources/config_config.go` |
| `docs/.vitepress/config/ja.ts` | modify | register all 8 in `/reference/` block |

## Style template (every page)

Mirror `docs/reference/proxy.md`:

1. `# <group>` — H1 + 1-2 sentence opener describing the group's purpose. End in `です。`.
2. `## 共通オプション` (only if the source defines persistent SSH or other shared flags for the group — most groups don't, so this section is usually omitted).
3. `## <group> <subcommand>` — H2 per subcommand. Each:
   - 1-2 sentence description.
   - `### 使い方` with code-fenced bash usage.
   - `### オプション` markdown table (`| オプション | 説明 |`). Required flags marked clearly.
   - Optional `### 動作` for non-obvious behavior.
4. `---` separators between subcommand sections.

**Flag accuracy:** every flag must come from `.tmp-plan-sources/`. Do not invent. If a flag is defined as a global persistent in `cmd/root.go` (e.g., `--insecure`, `--filter`, `--format`), do NOT repeat it per-subcommand — those are slated for `reference/global-flags.md` (PR 4).

---

## Task 1: Branch + source cache

**Files:** `.tmp-plan-sources/` (already populated).

- [ ] **Step 1.1: Verify worktree**

```bash
cd /root/dev/crowdy/conoha-cli-pages/.worktrees/pr2-reference-pages
git status
ls .tmp-plan-sources/ | wc -l   # expect 13
```

- [ ] **Step 1.2: Baseline build**

```bash
npx vitepress build docs
```

Expected: clean.

---

## Task 2: Small references — `flavor`, `config`, `identity`

These are short (3-row sidebars roughly: list/show, show/set/path, credential/subuser/role × CRUD). Bundle into one task.

- [ ] **Step 2.1: Write `docs/reference/flavor.md`**

Subcommands from `flavor_flavor.go`:
- `flavor list` — list available flavors. Inherits global `--format`, `--sort-by`, `--filter` (do not document — global).
- `flavor show <id>` — flavor details.

No command-specific flags beyond globals. Both subcommands take only a single positional ID for `show`.

- [ ] **Step 2.2: Write `docs/reference/config.md`**

Subcommands from `config_config.go`:
- `config show` — print current configuration.
- `config set <key> <value>` — set a config value.
- `config path` — print config directory path.

Add a section at the end describing config file locations: `~/.config/conoha/config.yaml`, `credentials.yaml`, `tokens.yaml` (perm 0600). Refer to README "設定" section for completeness.

- [ ] **Step 2.3: Write `docs/reference/identity.md`**

Subgroups from `identity_identity.go`:
- `identity credential list / show / delete`
- `identity subuser list / delete`
- `identity role list`

Use one H2 per subgroup (`## identity credential`, etc.) and H3 per subcommand within (`### list`, `### show`, etc.) — this matches `docs/reference/network.md` style for nested subgroups.

- [ ] **Step 2.4: Register all three in `ja.ts`**

In `'/reference/'` items, insert in alphabetical-ish order with the existing convention (auth, server, keypair, volume, network, **flavor**, **image** [pending], dns, lb, app, proxy, storage, **identity**, gpu [pending], **config**, skill).

The PR 1 sidebar was: `auth, server, keypair, volume, network, app, proxy, skill`. Add the new entries while keeping that base order. Final shape after PR 2:

```ts
{ text: 'auth', link: '/reference/auth' },
{ text: 'server', link: '/reference/server' },
{ text: 'keypair', link: '/reference/keypair' },
{ text: 'volume', link: '/reference/volume' },
{ text: 'network', link: '/reference/network' },
{ text: 'flavor', link: '/reference/flavor' },
{ text: 'image', link: '/reference/image' },
{ text: 'dns', link: '/reference/dns' },
{ text: 'lb', link: '/reference/lb' },
{ text: 'storage', link: '/reference/storage' },
{ text: 'identity', link: '/reference/identity' },
{ text: 'app', link: '/reference/app' },
{ text: 'proxy', link: '/reference/proxy' },
{ text: 'gpu', link: '/reference/gpu' },
{ text: 'config', link: '/reference/config' },
{ text: 'skill', link: '/reference/skill' },
```

This task only adds the three pages — but go ahead and add ALL eight new sidebar entries at once (the missing pages will be created in Tasks 3–6). VitePress build does not error on dead sidebar links by default; `ignoreDeadLinks` config or `srcExclude` settles it. **However**, if build does error on dead links, defer the sidebar-only entries for incomplete pages until their respective tasks. (Test this with the first build after Step 2.4.)

- [ ] **Step 2.5: Build + commit**

```bash
npx vitepress build docs
git add docs/reference/flavor.md docs/reference/config.md docs/reference/identity.md docs/.vitepress/config/ja.ts
git commit -m "docs(reference): add flavor / config / identity references"
```

---

## Task 3: `dns` reference

Source: `dns_dns.go`. Two subgroups:
- `dns domain list / show <id> / create / delete <id>`
- `dns record list / create / delete <record-id>`

Flags to extract from source: `dns domain create` and `dns record create` likely have flags for name / type / content / ttl. Read `dns_dns.go` for exact flag names.

Also document the `id` / `uuid` decode acceptance fix (v0.7.0+, release notes #170): both `id` and `uuid` keys are accepted on domain/record JSON decoding. Add as a short note at the end of the page.

- [ ] **Step 3.1: Read `.tmp-plan-sources/dns_dns.go`** for exact subcommand flag definitions.
- [ ] **Step 3.2: Write `docs/reference/dns.md`** with structure: H1 + opener, two H2 (`## dns domain`, `## dns record`) each with H3 per subcommand. Match the proxy.md style.
- [ ] **Step 3.3: Build + commit**

```bash
npx vitepress build docs
git add docs/reference/dns.md
git commit -m "docs(reference): add dns command reference"
```

---

## Task 4: `image` reference

Source: `image_image.go`. Subcommands: `list / show / create / upload / import / delete`. The `import` command is interesting — it bundles `create` + `upload`. Read source for flag definitions (likely `--name`, `--file`, `--container-format`, `--disk-format` for create/upload).

- [ ] **Step 4.1: Read source**, extract flags.
- [ ] **Step 4.2: Write `docs/reference/image.md`** — H2 per subcommand. Note that `import` is a convenience wrapper for `create + upload`.
- [ ] **Step 4.3: Build + commit**

```bash
git add docs/reference/image.md
git commit -m "docs(reference): add image command reference"
```

---

## Task 5: `storage` reference

Source: `storage_storage.go` (10KB — largest). Subcommands:
- `storage account` — show account info
- `storage container list / create <name> / delete <name>`
- `storage ls <container>`
- `storage cp <src> <dst>` — bidirectional (local↔remote)
- `storage rm <container/object>`
- `storage publish <container>` / `unpublish <container>`

For `cp`, document both directions (local→remote, remote→local) with examples.
For `publish`, explain it makes the container web-accessible (HTTP).

- [ ] **Step 5.1: Read source**.
- [ ] **Step 5.2: Write `docs/reference/storage.md`** — H2 per subgroup or per top-level command.
- [ ] **Step 5.3: Build + commit**

```bash
git add docs/reference/storage.md
git commit -m "docs(reference): add storage command reference"
```

---

## Task 6: `lb` reference

Source: 5 files in `.tmp-plan-sources/lb_*.go`. Largest reference page — 5 subgroups × CRUD each = ~20 commands.

Subgroups:
- `lb` (top-level) — list / show / create / delete
- `lb listener` — list / show / create / delete
- `lb pool` — list / show / create / delete
- `lb member` — list / show / create / delete
- `lb healthmonitor` — list / show / create / delete

For brevity, use a unified approach: one H2 per subgroup, one H3 per subcommand within. Some flag tables will repeat (every `create` takes various OpenStack-LB-specific flags) — that's acceptable for a reference page.

- [ ] **Step 6.1: Read all 5 source files**, extract flags per command.
- [ ] **Step 6.2: Write `docs/reference/lb.md`**.
- [ ] **Step 6.3: Build + commit**

```bash
git add docs/reference/lb.md
git commit -m "docs(reference): add lb (load balancer) command reference"
```

---

## Task 7: `gpu` reference

Source: `gpu_gpu.go` (560 bytes — minimal) + `gpu_setup.go` (8.5KB — actual logic). Single subcommand: `gpu setup <server>`.

Required content:
- What it does (NVIDIA driver + Container Toolkit one-shot install)
- Target flavor / image guidance (e.g., `g2l-t-c12m48n-h100-1` requires `vmi-cuda-*`)
- Flags from source (e.g., `--driver-version`, `--toolkit-version`, `--reboot`, `--insecure` if local; check source)
- Idempotency: re-running should detect existing install and skip steps

- [ ] **Step 7.1: Read source**, extract flags + behavior.
- [ ] **Step 7.2: Write `docs/reference/gpu.md`**.
- [ ] **Step 7.3: Build + commit**

```bash
git add docs/reference/gpu.md
git commit -m "docs(reference): add gpu command reference"
```

---

## Task 8: Final verification + PR

- [ ] **Step 8.1: Final build**

```bash
npx vitepress build docs
```

- [ ] **Step 8.2: Sidebar / link audit**

```bash
# All 8 new pages should exist
for p in flavor image dns lb storage identity gpu config; do
  [ -f "docs/reference/$p.md" ] && echo "✓ $p" || echo "MISSING $p"
done

# Internal cross-link audit
grep -rhoE '/(guide|reference)/[a-z-]+' docs/reference/{flavor,image,dns,lb,storage,identity,gpu,config}.md \
  | sort -u | while read link; do
      file="docs${link}.md"
      [ -f "$file" ] || echo "MISSING: $link → $file"
    done
```

- [ ] **Step 8.3: Push + PR**

```bash
git push -u origin docs/pr2-reference-pages
gh pr create --title "docs: 8 new reference pages (PR 2 of 6)" --body "..."
```

PR body: list of 8 pages added, link audit clean, build clean, sidebar updated.

---

## Self-Review Checklist

- All 8 pages exist in `docs/reference/`.
- Every subcommand listed in source files has an entry in its respective page.
- No fabricated flags. Globals (`--filter`, `--format`, `--insecure`, etc.) are NOT repeated per-command (defer to PR 4).
- Sidebar order in `ja.ts` matches the spec.
- Build clean.
- Cross-links resolve.
