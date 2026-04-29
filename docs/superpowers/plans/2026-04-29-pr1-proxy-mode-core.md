# PR 1 — proxy mode core: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the proxy-mode foundation in the docs site: a reference page for the `conoha proxy` command group, an operations guide for setting up conoha-proxy on a VPS, a rewritten `guide/app-deploy.md` that leads with proxy mode, a rewritten `guide/quickstart.md` with proxy-first walkthrough, and an updated `reference/app.md` that surfaces proxy-mode flags + `app rollback`.

**Architecture:** Six file edits (two new, four refresh) + one sidebar update, all on a single branch `docs/pr1-proxy-mode`. Each task creates or rewrites one page, registers it in `docs/.vitepress/config/ja.ts`, runs `npx vitepress build docs`, and commits. PR opened at the end.

**Tech Stack:** VitePress 1.6.4, markdown, no JavaScript changes outside the sidebar config. Source-of-truth for CLI behavior: `crowdy/conoha-cli` `main` (v0.7.1) — fetch flags directly from `cmd/proxy/*.go` and `cmd/app/*.go` rather than guessing.

**Spec:** `docs/superpowers/specs/2026-04-29-cli-v07-docs-update-design.md`

---

## File Structure

| Path | Action | Purpose |
|---|---|---|
| `docs/reference/proxy.md` | **create** | `conoha proxy` command reference (9 subcommands) |
| `docs/guide/proxy-setup.md` | **create** | Operator guide: install / boot / observe / troubleshoot conoha-proxy |
| `docs/reference/app.md` | refresh | Add proxy/no-proxy/slot/drain-ms/compose-file/insecure flags + `app rollback` + `app status` JSON shape |
| `docs/guide/app-deploy.md` | rewrite | Mode comparison → proxy mode → no-proxy mode → mode switching → multi-host (expose) |
| `docs/guide/quickstart.md` | rewrite | Path A proxy mode → Path B no-proxy alternative |
| `docs/.vitepress/config/ja.ts` | refresh | Register `guide/proxy-setup` and `reference/proxy` in ja sidebar |

No changes to `docs/.vitepress/config/en.ts` or `ko.ts` in this PR — those locales are addressed in PR 6.

---

## Task 1: Create branch and confirm clean baseline

**Files:** none yet (verification only).

- [ ] **Step 1.1: Create the working branch**

```bash
git checkout main
git pull --ff-only origin main
git checkout -b docs/pr1-proxy-mode
```

- [ ] **Step 1.2: Confirm baseline build is clean**

```bash
npx vitepress build docs
```

Expected: `build complete in <Ns>.` with no warnings. If anything else, stop and investigate before changing files.

- [ ] **Step 1.3: Snapshot the source flag definitions for reference**

These are the canonical sources for command flags used in subsequent tasks. Read them once into local files so the executor isn't re-fetching repeatedly.

```bash
mkdir -p .tmp-plan-sources
gh api repos/crowdy/conoha-cli/contents/cmd/proxy/proxy.go --jq '.content' | base64 -d > .tmp-plan-sources/proxy.go
gh api repos/crowdy/conoha-cli/contents/cmd/proxy/boot.go --jq '.content' | base64 -d > .tmp-plan-sources/boot.go
gh api repos/crowdy/conoha-cli/contents/cmd/proxy/lifecycle.go --jq '.content' | base64 -d > .tmp-plan-sources/lifecycle.go
gh api repos/crowdy/conoha-cli/contents/cmd/proxy/observability.go --jq '.content' | base64 -d > .tmp-plan-sources/observability.go
gh api repos/crowdy/conoha-cli/contents/cmd/app/deploy.go --jq '.content' | base64 -d > .tmp-plan-sources/app-deploy.go
gh api repos/crowdy/conoha-cli/contents/cmd/app/rollback.go --jq '.content' | base64 -d > .tmp-plan-sources/app-rollback.go
gh api repos/crowdy/conoha-cli/contents/cmd/app/init.go --jq '.content' | base64 -d > .tmp-plan-sources/app-init.go
gh api repos/crowdy/conoha-cli/contents/cmd/app/mode.go --jq '.content' | base64 -d > .tmp-plan-sources/mode.go
echo ".tmp-plan-sources/" >> .gitignore
```

This directory is gitignored and serves as the executor's quick reference for "what flags does X actually take?"

- [ ] **Step 1.4: Commit the gitignore entry only**

```bash
git add .gitignore
git commit -m "chore: ignore plan-source scratch dir"
```

---

## Task 2: Create `reference/proxy.md`

**Files:**
- Create: `docs/reference/proxy.md`
- Modify: `docs/.vitepress/config/ja.ts` (add reference sidebar entry)

The reference page documents 9 subcommands. Each section follows the same template used in existing reference pages (e.g., `docs/reference/app.md`): H2 command name, short description, `### 使い方`, `### オプション` (table), optional `### 動作` (behavior).

- [ ] **Step 2.1: Write `docs/reference/proxy.md` with this structure**

Sections in order. Flag tables are exhaustive — read `.tmp-plan-sources/{proxy,boot,lifecycle,observability}.go` to confirm.

```markdown
# proxy

ConoHa VPS 上の [conoha-proxy](https://github.com/crowdy/conoha-proxy) リバースプロキシを管理するコマンドグループです。proxy モードで `conoha app deploy` を行う場合は、まず `proxy boot` でプロキシをサーバーに展開する必要があります。

## 共通オプション

すべての `proxy` サブコマンドで使えるSSH接続フラグ:

| オプション | 説明 |
|-----------|------|
| `--user`, `-l` | SSHユーザー名（デフォルト: `root`） |
| `--port`, `-p` | SSHポート（デフォルト: `22`） |
| `--identity`, `-i` | SSH秘密鍵のパス |

---

## proxy boot

サーバーに conoha-proxy コンテナを展開・起動します。Let's Encrypt 自動 HTTPS、UFW での 80/443 開放、`net.ipv4.ip_unprivileged_port_start=0` の sysctl 適用も行います。

### 使い方

\`\`\`bash
conoha proxy boot <サーバー> --acme-email <email> [flags]
\`\`\`

### オプション

| オプション | 説明 |
|-----------|------|
| `--acme-email` | Let's Encrypt 登録用メールアドレス（**必須**） |
| `--image` | conoha-proxy Docker イメージ（デフォルト: `ghcr.io/crowdy/conoha-proxy:latest`） |
| `--data-dir` | サーバー側データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |
| `--container` | Docker コンテナ名（デフォルト: `conoha-proxy`） |
| `--wait-timeout` | コンテナの healthy 待機上限（デフォルト: `30s`、`0` で無効化） |

### 動作

1. Docker / docker compose の存在を確認
2. `--data-dir` を作成し UID 65532 (nonroot) に所有権を委譲
3. UFW で 80/443 を開放、`net.ipv4.ip_unprivileged_port_start=0` を `/etc/sysctl.d/99-conoha-proxy.conf` に書き込み
4. `docker run` でコンテナ起動（Admin Unix socket は `<data-dir>/admin.sock`）
5. `--wait-timeout` 内に 3回連続 `running` + `/healthz` 200 で成功と判定。タイムアウト時は直近 20 行のコンテナログを stderr に出力

---

## proxy reboot

最新イメージをプルしてコンテナを再作成します。`acme-email` その他の起動フラグは `boot` と同じものを再指定する必要があります（既存コンテナの設定は引き継がれません）。

### 使い方

\`\`\`bash
conoha proxy reboot <サーバー> --acme-email <email> [flags]
\`\`\`

### オプション

`boot` と同一（`--acme-email`, `--image`, `--data-dir`, `--container`, `--wait-timeout`）。

---

## proxy start / stop / restart

実行中コンテナの起動・停止・再起動を行います。`reboot` と異なりイメージのプルや設定の再適用は行いません。

### 使い方

\`\`\`bash
conoha proxy start   <サーバー> [--container <name>]
conoha proxy stop    <サーバー> [--container <name>]
conoha proxy restart <サーバー> [--container <name>]
\`\`\`

### オプション

| オプション | 説明 |
|-----------|------|
| `--container` | Docker コンテナ名（デフォルト: `conoha-proxy`） |

---

## proxy remove

conoha-proxy コンテナを削除します。データボリューム（`--data-dir`）は既定で残るため、登録済みサービス・証明書・状態は保持されます。完全消去するには `--purge` を指定します。

### 使い方

\`\`\`bash
conoha proxy remove <サーバー> [flags]
\`\`\`

### オプション

| オプション | 説明 |
|-----------|------|
| `--container` | Docker コンテナ名（デフォルト: `conoha-proxy`） |
| `--data-dir` | サーバー側データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |
| `--purge` | データディレクトリも削除（証明書・登録サービスもすべて消える） |

---

## proxy logs

コンテナログを表示します。

### 使い方

\`\`\`bash
conoha proxy logs <サーバー> [flags]
\`\`\`

### オプション

| オプション | 説明 |
|-----------|------|
| `--container` | Docker コンテナ名（デフォルト: `conoha-proxy`） |
| `--follow`, `-f` | リアルタイムフォロー |
| `--tail` | 末尾行数（デフォルト: `0` = すべて） |

---

## proxy details

conoha-proxy のバージョンと readiness を表示します。Admin API `/v1/version` を Unix socket 経由で叩いた結果です。

### 使い方

\`\`\`bash
conoha proxy details <サーバー> [--data-dir <path>]
\`\`\`

### オプション

| オプション | 説明 |
|-----------|------|
| `--data-dir` | サーバー側データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |

---

## proxy services

サーバーに登録されているプロキシサービスの一覧を表示します。`conoha app init` 済みのアプリ（およびその `expose:` ブロック）が `<アプリ名>` / `<アプリ名>-<label>` という名前で並びます。

### 使い方

\`\`\`bash
conoha proxy services <サーバー> [--data-dir <path>]
\`\`\`

### オプション

| オプション | 説明 |
|-----------|------|
| `--data-dir` | サーバー側データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |
```

Note on the snippet above: the bash code blocks use escaped triple-backticks (`\``) only because this plan document itself is a markdown file. **In the actual file you write to `docs/reference/proxy.md`, use unescaped triple-backticks.** Do not paste the literal `\`\`\`bash` into the file.

- [ ] **Step 2.2: Register the page in the ja sidebar**

Open `docs/.vitepress/config/ja.ts`. Find the `'/reference/'` sidebar block (around line 76). The current `items:` array ends with `{ text: 'skill', link: '/reference/skill' }`. Insert `{ text: 'proxy', link: '/reference/proxy' }` immediately **before** the `app` entry to keep alphabetical-ish grouping consistent with the README's command list:

```ts
'/reference/': [
  {
    text: 'コマンドリファレンス',
    items: [
      { text: 'auth', link: '/reference/auth' },
      { text: 'server', link: '/reference/server' },
      { text: 'keypair', link: '/reference/keypair' },
      { text: 'volume', link: '/reference/volume' },
      { text: 'network', link: '/reference/network' },
      { text: 'app', link: '/reference/app' },
      { text: 'proxy', link: '/reference/proxy' },
      { text: 'skill', link: '/reference/skill' },
    ],
  },
],
```

- [ ] **Step 2.3: Build and verify**

```bash
npx vitepress build docs
```

Expected: clean build. Open `docs/.vitepress/dist/reference/proxy.html` in a browser (or `npx vitepress preview docs`) and confirm the page renders, the sidebar shows the new entry, and all internal links resolve.

- [ ] **Step 2.4: Commit**

```bash
git add docs/reference/proxy.md docs/.vitepress/config/ja.ts
git commit -m "docs(reference): add conoha proxy command reference"
```

---

## Task 3: Create `guide/proxy-setup.md`

**Files:**
- Create: `docs/guide/proxy-setup.md`
- Modify: `docs/.vitepress/config/ja.ts` (add guide sidebar entry)

This is an operator guide. It is *not* a reference page — it tells a story about installing and operating conoha-proxy on a VPS. Goal: a user with a fresh VPS should be able to follow this top-to-bottom and end up with a healthy proxy.

- [ ] **Step 3.1: Write `docs/guide/proxy-setup.md`**

Required sections (use these exact H2 headings):

1. `# conoha-proxy のセットアップ` — opening paragraph: 1-2 sentences explaining what conoha-proxy is and why proxy mode needs it (HTTPS, blue/green, multi-host).
2. `## 前提条件` — VPS に Docker + docker compose が入っていること、80/443 がインターネットから到達可能、ACME 用にメールアドレス。
3. `## proxy boot` — the canonical install command:
   ```
   conoha proxy boot my-server --acme-email ops@example.com
   ```
   Then a bullet list of what `boot` does on the host (UFW 80/443 開放, sysctl `ip_unprivileged_port_start=0`, `/var/lib/conoha-proxy` 作成 + uid 65532 所有, コンテナ起動, healthy 待機). Mirror the "動作" section in `reference/proxy.md` task 2.1 but in narrative form.
4. `## ライフサイクル運用` — short subsections for `proxy reboot` (latest image), `proxy start/stop/restart`, `proxy remove --purge`. One sentence + one command each. Include this caution: "`reboot` 時は `--acme-email` を再指定する必要があります（コンテナ設定は引き継がれません）".
5. `## 観測` — subsections for `proxy logs -f`, `proxy details`, `proxy services`. Show example output for `services` (use the README schema: lines like `myapp                  app.example.com  →  127.0.0.1:9001`).
6. `## トラブルシューティング` — subsections (each H3):
   - **ACME 発行に失敗する** — DNS A レコード未設定 / 80 番ポート未到達。`proxy logs -f` で `acme:` 行を grep。
   - **healthy 待機がタイムアウトする** — `--wait-timeout` を伸ばす、直近20行のログを確認、メモリ不足ならフレーバー昇格 (`server resize`)。
   - **TLS ハンドシェイクで失敗する** — DNS が VPS を指していないため証明書未発行のホスト。dig + `proxy details` で確認。
   - **`/var/lib/conoha-proxy` のパーミッション** — uid 65532 が書き込めない場合は `sudo chown -R 65532:65532 /var/lib/conoha-proxy`。
7. `## 関連ページ` — links to `/guide/app-deploy` and `/reference/proxy`.

- [ ] **Step 3.2: Register the page in the ja guide sidebar**

In `docs/.vitepress/config/ja.ts`, find the `'/guide/'` block. After `{ text: 'アプリ管理', link: '/guide/app-management' }` insert `{ text: 'conoha-proxy セットアップ', link: '/guide/proxy-setup' }`:

```ts
'/guide/': [
  {
    text: 'ガイド',
    items: [
      { text: 'はじめに', link: '/guide/getting-started' },
      { text: 'クイックスタート', link: '/guide/quickstart' },
      { text: 'サーバー管理', link: '/guide/server' },
      { text: 'アプリデプロイ', link: '/guide/app-deploy' },
      { text: 'アプリ管理', link: '/guide/app-management' },
      { text: 'conoha-proxy セットアップ', link: '/guide/proxy-setup' },
      { text: 'Claude Code スキル', link: '/guide/skill' },
    ],
  },
],
```

- [ ] **Step 3.3: Build and spot-check**

```bash
npx vitepress build docs
```

Expected: clean. Confirm the new sidebar entry renders and the `関連ページ` links to `/guide/app-deploy` and `/reference/proxy` resolve.

- [ ] **Step 3.4: Commit**

```bash
git add docs/guide/proxy-setup.md docs/.vitepress/config/ja.ts
git commit -m "docs(guide): add conoha-proxy setup operator guide"
```

---

## Task 4: Refresh `reference/app.md` for proxy mode

**Files:**
- Modify: `docs/reference/app.md`

Three sets of changes. The current file is the canonical structure — keep it, augment it.

- [ ] **Step 4.1: Add `--proxy` / `--no-proxy` / `--slot` / `--drain-ms` / `--compose-file` / `--insecure` flags to existing subcommands**

For each of `app init`, `app deploy`, `app destroy`, `app rollback`, `app status`, `app logs`, `app stop`, `app restart`, `app reset` — extend the オプション table to include the proxy-mode flags that apply. Use this matrix (from `.tmp-plan-sources/`):

| Flag | init | deploy | rollback | destroy | status | logs | stop | restart | reset |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `--proxy` / `--no-proxy` (mutually exclusive) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `--slot <id>` |  | ✓ |  |  |  |  |  |  | ✓ |
| `--drain-ms <ms>` |  |  | ✓ |  |  |  |  |  |  |
| `--data-dir <path>` (proxy data dir) | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  | ✓ |
| `--target <label>` |  |  | ✓ |  |  |  |  |  |  |
| `--compose-file <path>` |  | ✓ |  |  |  |  |  |  | ✓ |
| `--insecure` (skip known_hosts TOFU) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

For each row in each command's options table, append a new line in the same format as existing rows. Examples:

```markdown
| `--proxy` | proxy モードを強制（マーカーと不一致ならエラー） |
| `--no-proxy` | no-proxy モードを強制（`--proxy` と排他） |
| `--slot` | slot ID を固定（既定: git short SHA / timestamp、`[a-z0-9][a-z0-9-]{0,63}` 制約） |
| `--data-dir` | サーバー側 conoha-proxy データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |
| `--compose-file` | 使用する compose ファイルのパス（自動検出順は `conoha-docker-compose.yml` → `docker-compose.yml` → `compose.yml`） |
| `--insecure` | known_hosts 検証をスキップ（TOFU を無効化） |
```

- [ ] **Step 4.2: Add a new `## app rollback` section**

Insert after the existing `## app deploy` section. Mirror the existing reference page style (H2, short description, 使い方, オプション table, 動作).

```markdown
## app rollback

drain 窓内に直前のスロットへ即時ロールバックします（proxy モードのみ）。`expose:` ブロックを持つ multi-host アプリでは既定でルート + 全ブロックを逆順にロールバックします。

### 使い方

\`\`\`bash
conoha app rollback <サーバー名> [flags]
\`\`\`

### オプション

| オプション | 説明 |
|-----------|------|
| `--app-name` | アプリ名 |
| `--target` | 単一ブロックのみロールバック: `web` または `expose:` の label（既定: 全ブロック） |
| `--drain-ms` | 戻し先の drain 窓をミリ秒で上書き（`0` = proxy 既定） |
| `--data-dir` | サーバー側 proxy データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |
| `--proxy` / `--no-proxy` | モード強制 |
| `--insecure` | known_hosts TOFU をスキップ |
| `--app-name` などの SSH フラグ | `app deploy` と同じ |

### 動作

1. proxy 側に旧スロットがまだ drain 中であることを確認
2. Admin API 経由で target_url を旧スロットに切り戻し
3. drain 窓を `--drain-ms`（または既定）に再設定
4. multi-host アプリで `--target` 未指定時は expose ブロックを宣言の逆順で同様に切り戻し（窓が閉じたブロックは警告のみで継続）

### 制限

- no-proxy モードでは利用不可（実行すると `rollback is not supported in no-proxy mode` エラー）
- drain 窓を過ぎたスロットはロールバック不能。コミットを checkout して再 deploy してください
```

(Replace `\`\`\`bash` with real triple-backticks in the file.)

- [ ] **Step 4.3: Document `app status --format json` shape**

Find the `## app status` section. After the existing options table, append:

```markdown
### `--format json` のスキーマ

\`\`\`json
{
  "root": { "service": "web", "containers": [...] },
  "expose": [
    { "label": "dex", "service": "dex", "containers": [...] }
  ]
}
\`\`\`

`expose` ブロックを持たないアプリでは `"expose": []`。`conoha.yml` がローカルにない場合は `root` のみが返り、`expose` フィールドは省略されます（v0.7.0+ の graceful degrade）。
```

- [ ] **Step 4.4: Build and spot-check**

```bash
npx vitepress build docs
```

Expected: clean. Open the rendered `reference/app.html`, confirm the new flag rows and the rollback section appear.

- [ ] **Step 4.5: Commit**

```bash
git add docs/reference/app.md
git commit -m "docs(reference/app): add proxy-mode flags, rollback, status JSON schema"
```

---

## Task 5: Rewrite `guide/app-deploy.md`

**Files:**
- Modify: `docs/guide/app-deploy.md` (full rewrite)

The current file is built around `app init` + `app deploy` with `git push` as an alternative. The rewrite is built around the **mode comparison** as the entry point, then drills into each mode.

- [ ] **Step 5.1: Read the current file once for tone/voice reference**

```bash
cat docs/guide/app-deploy.md
```

Match the existing terse Japanese voice (no "ですます" politeness inflation, code-first).

- [ ] **Step 5.2: Replace the entire file with this structure**

Required H2 sections in order:

1. `# アプリデプロイ` — opening paragraph: same VPS で proxy / no-proxy 両方共存可能。マーカーが自動判定するので2回目以降フラグ不要、という主旨。
2. `## モードの比較` — table:
   ```markdown
   | | proxy (blue/green) | no-proxy (flat) |
   |---|---|---|
   | 既定 | ✓ | |
   | 用途 | 公開アプリ + HTTPS | テスト・社内・非HTTP |
   | `conoha.yml` | 必要 | 不要 |
   | `conoha proxy boot` | 必要 | 不要 |
   | DNS | 必要 | 不要 |
   | TLS | Let's Encrypt 自動 | 自前で |
   | レイアウト | `/opt/conoha/<name>/<slot>/` | `/opt/conoha/<name>/` |
   | rollback | ✓ (drain 窓内) | × |
   ```
3. `## proxy モード` — full walkthrough. Subsections:
   - `### conoha.yml の作成` — full schema example (copy from README lines 188–207, the YAML block with comments).
   - `### proxy をブートしてアプリを登録` — `proxy boot --acme-email`, DNS A レコード必要、`app init`, `app deploy`. Cross-link `/guide/proxy-setup` for proxy-side details.
   - `### slot の自動 suffix` — `--slot` を省略時に既存 compose project と衝突する場合 CLI が `-2` / `-3` で自動回避する旨 + 手動指定時の上書き挙動。
   - `### multi-host / expose ブロック` — full conoha.yml example with `expose:` (copy from README lines 238–251, the gitea/dex example), explanation of `<name>-<label>` registration, `blue_green: true|false` semantics, `app rollback --target=<label>`.
4. `## no-proxy モード` — current content from app-deploy.md, condensed. Show:
   - `app init --no-proxy` + `app deploy --no-proxy`
   - 再デプロイは tar 上書きのみ（消えたファイルは残る、`.env.server` 保護のため意図的）
   - rollback 不可
5. `## モードの切り替え` — `destroy` → 反対モードで `init`。同一 VPS 上で異なる `<app-name>` なら共存可能。
6. `## 環境変数` — short note: `app env set` は両モードで動くが、proxy モードでは現状デプロイ時に反映されない（[#94](https://github.com/crowdy/conoha-cli/issues/94) で再設計予定）。詳細は `/guide/app-management` へ。
7. `## 関連ページ` — links to `/guide/proxy-setup`, `/guide/app-management`, `/reference/app`, `/reference/proxy`.

- [ ] **Step 5.3: Build and spot-check**

```bash
npx vitepress build docs
```

Expected: clean. Click through `app-deploy.html` and verify the conoha.yml schema is readable, the comparison table renders.

- [ ] **Step 5.4: Commit**

```bash
git add docs/guide/app-deploy.md
git commit -m "docs(guide/app-deploy): rewrite around proxy/no-proxy mode comparison"
```

---

## Task 6: Rewrite `guide/quickstart.md`

**Files:**
- Modify: `docs/guide/quickstart.md` (full rewrite)

Goal: a brand-new user lands here, does `auth login`, creates a VPS, and gets either an HTTPS app (proxy path) or a quick test app (no-proxy path) without context-switching between two pages.

- [ ] **Step 6.1: Replace the entire file with this structure**

Required H2 sections in order:

1. `# クイックスタート` — opening: 5 分で VPS 作成 → アプリデプロイ。proxy モードを既定として書き、no-proxy はその後の "より単純な代替" として並べる。
2. `## 1. 認証` —
   ```bash
   conoha auth login
   conoha auth status
   ```
3. `## 2. サーバー作成` — use the `--for proxy` preset since the guide leads with proxy mode:
   ```bash
   conoha server create --no-input --yes --wait \
     --name myproxy --key-name my-key --for proxy
   ```
   One-liner explanation: `--for proxy` がフレーバー / イメージ / セキュリティグループを自動設定。詳細は `/guide/server`。
4. `## Path A: proxy モード（HTTPS あり）` —
   - `### 2-1. proxy をブート`
     ```bash
     conoha proxy boot myproxy --acme-email ops@example.com
     ```
   - `### 2-2. DNS の A レコードを VPS の IP に向ける` — `conoha server show myproxy` で IP を取得 → DNS プロバイダで A レコード設定。
   - `### 2-3. リポジトリに conoha.yml を置く` — minimal example:
     ```yaml
     name: hello
     hosts: [hello.example.com]
     web:
       service: web
       port: 8080
     ```
   - `### 2-4. デプロイ`
     ```bash
     conoha app init myproxy
     conoha app deploy myproxy
     ```
   - 結果: `https://hello.example.com` で TLS 付きアクセス可。
5. `## Path B: no-proxy モード（より単純）` — opening sentence: "DNS / TLS が不要、または既存 Docker ホストで動かしたい場合"。
   - サーバー作成は Docker 入りイメージで `--user-data ./install-docker.sh` などを使う旨を一言。
   - ```bash
     conoha app init my-server --app-name hello --no-proxy
     conoha app deploy my-server --app-name hello --no-proxy
     ```
   - 結果: VPS の任意ポート（compose で公開した）にアクセス可。HTTPS は別途。
6. `## 次に読む` — links: `/guide/app-deploy`（モード詳細）、`/guide/proxy-setup`（proxy 運用）、`/guide/server`（サーバー作成詳細）、`/reference/app`、`/reference/proxy`。

- [ ] **Step 6.2: Build and spot-check**

```bash
npx vitepress build docs
```

Expected: clean. Open `quickstart.html` and verify both paths read well in sequence.

- [ ] **Step 6.3: Commit**

```bash
git add docs/guide/quickstart.md
git commit -m "docs(guide/quickstart): rewrite with proxy-first walkthrough"
```

---

## Task 7: Final verification, push, and PR

- [ ] **Step 7.1: Final build**

```bash
npx vitepress build docs
```

Expected: clean.

- [ ] **Step 7.2: Link audit**

Quick grep for any broken internal links introduced. Every `/guide/foo` and `/reference/foo` mentioned in the new/modified pages must correspond to an existing markdown file.

```bash
grep -rhoE '/(guide|reference)/[a-z-]+' docs/guide/proxy-setup.md docs/reference/proxy.md docs/guide/app-deploy.md docs/guide/quickstart.md docs/reference/app.md \
  | sort -u \
  | while read link; do
      file="docs${link}.md"
      [ -f "$file" ] || echo "MISSING: $link → $file"
    done
```

Expected: no `MISSING:` lines. If any appear, either fix the link or note that target as a future-PR dependency.

- [ ] **Step 7.3: Push and open PR**

```bash
git push -u origin docs/pr1-proxy-mode
gh pr create --title "docs: proxy mode core (PR 1 of 6)" --body "$(cat <<'EOF'
## Summary

PR 1 of the v0.7.x docs refresh (spec: docs/superpowers/specs/2026-04-29-cli-v07-docs-update-design.md).

- Add `reference/proxy.md` covering all 9 conoha-proxy subcommands (boot, reboot, start, stop, restart, remove, logs, details, services)
- Add `guide/proxy-setup.md` operator guide (boot, lifecycle ops, observability, troubleshooting)
- Refresh `reference/app.md`: proxy/no-proxy/slot/drain-ms/compose-file/insecure flags, new `app rollback` section, `app status --format json` schema
- Rewrite `guide/app-deploy.md` around proxy/no-proxy mode comparison + multi-host (expose) blocks
- Rewrite `guide/quickstart.md` with proxy-first walkthrough and no-proxy alternative
- Register new pages in `docs/.vitepress/config/ja.ts`

en/ko locales unchanged in this PR (PR 6 in the rollout).

## Test plan

- [x] `npx vitepress build docs` passes clean
- [x] Sidebar nav shows new entries in correct order
- [x] No broken internal links (verified via grep audit)
- [ ] Spot-check rendered output via `npx vitepress preview docs`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7.4: Confirm PR opened**

The previous step prints a PR URL. Open it, confirm the diff is what's expected, ensure the CI check (if any) is queued.

---

## Self-Review Checklist

Before declaring this plan ready, the implementer should confirm:

- **Spec coverage:** Every page listed in PR 1 of the spec (`reference/proxy`, `guide/proxy-setup`, `reference/app` refresh, `guide/app-deploy` rewrite, `guide/quickstart` rewrite) has a task.
- **No fabricated flags:** Every flag mentioned came from `.tmp-plan-sources/` or the conoha-cli README. If a flag is missing or wrong, fix the page rather than the plan.
- **Sidebar consistency:** ja sidebar gains exactly two entries (`guide/proxy-setup`, `reference/proxy`); en/ko untouched.
- **Internal links resolve:** the link audit step (7.2) catches any typo'd cross-link.

If any of these fail, fix inline and re-run the affected build.
