# App Samples — Phase 1 (Bootstrap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the first PR of the app-samples reflection work — add the `opencascade-fem` flagship page (validating the flagship template), register it in the sidebar under `アーキテクチャパターン`, copy its screenshot into `docs/public/`, and append an "Adding a new example page" checklist to `CONTRIBUTING.md`. No `docs/index.md` changes in this PR (opencascade-fem is not yet in any home-page table; its row gets added during Phase 4 cleanup).

**Architecture:** One new markdown page (`docs/examples/opencascade-fem.md`), one new asset (`docs/public/examples/opencascade-fem/screenshot.png`), two file edits (`docs/.vitepress/config/ja.ts`, `CONTRIBUTING.md`). Build verified by `npx vitepress build docs` after each commit. PR opened against `main`.

**Tech Stack:** VitePress 1.6.4, markdown. Source-of-truth for opencascade-fem's behavior: `crowdy/conoha-cli-app-samples` `main` at `opencascade-fem/README.md`, `opencascade-fem/conoha.yml`, `opencascade-fem/compose.yml`, and `docs/blogs/opencascade-fem.md`.

**Spec:** `docs/superpowers/specs/2026-06-05-app-samples-reflection-design.md`

**Phase strategy note:** The spec describes the *target* 8-category sidebar. Empty sidebar sections are visually distracting, so the new categories (`フルスタックウェブ`, `開発インフラ・運用`, `ちょっと変わったもの`) are introduced only when their first content arrives — in later phase PRs (2a–3b). This PR makes the minimal sidebar change: append `opencascade-fem` under the existing `アーキテクチャパターン`. Subsequent phases get their own plans (`2026-XX-XX-app-samples-phaseN-<topic>.md`).

---

## File Structure

| Path | Action | Purpose |
|---|---|---|
| `docs/examples/opencascade-fem.md` | **create** | Flagship example page (CAD → mesh → FEM → vtk.js). Validates the flagship template. |
| `docs/public/examples/opencascade-fem/screenshot.png` | **create** | UI screenshot, copied from upstream `opencascade-fem/docs/screenshot.png`. |
| `docs/.vitepress/config/ja.ts` | refresh | Append `opencascade-fem` entry under `アーキテクチャパターン` (ja sidebar only). |
| `CONTRIBUTING.md` | refresh | Append "Adding a new example page" checklist after the secret-handling rules. |

No changes to `docs/.vitepress/config/en.ts` / `ko.ts` (those locales have no `/examples/` sections at all and stay untouched, per spec Non-Goals).
No changes to `docs/index.md` in this PR.

---

## Task 1: Create branch and confirm clean baseline

**Files:** none yet (verification only).

- [ ] **Step 1.1: Confirm on main and pull latest**

```bash
git checkout main
git pull --ff-only origin main
```

Expected: `Already up to date.` or fast-forward summary.

- [ ] **Step 1.2: Create the working branch**

```bash
git checkout -b docs/examples-phase1-opencascade-fem
```

Expected: `Switched to a new branch 'docs/examples-phase1-opencascade-fem'`.

- [ ] **Step 1.3: Install dependencies if needed**

```bash
npm install
```

Expected: no errors. Skip if `node_modules/` already exists with `vitepress`.

- [ ] **Step 1.4: Confirm baseline build is clean**

```bash
npx vitepress build docs
```

Expected: a `build complete in <Ns>.` line with **no warnings**. If you see warnings (e.g., `[vitepress] dead link ...`), stop and investigate — the baseline must be clean so any new warnings can be attributed to this PR's changes.

---

## Task 2: Copy the upstream screenshot into `docs/public/`

**Files:**
- Create: `docs/public/examples/opencascade-fem/screenshot.png`

VitePress serves files under `docs/public/` from the site root. So a file at `docs/public/examples/opencascade-fem/screenshot.png` becomes URL `/examples/opencascade-fem/screenshot.png`, which is the path the page will reference.

- [ ] **Step 2.1: Verify the upstream screenshot exists**

```bash
ls -la /root/dev/crowdy/conoha-cli-app-samples/opencascade-fem/docs/screenshot.png
```

Expected: a file with non-zero size. If missing, stop — the upstream sample needs a screenshot before this PR can proceed.

- [ ] **Step 2.2: Create the asset directory**

```bash
mkdir -p docs/public/examples/opencascade-fem
```

- [ ] **Step 2.3: Copy the screenshot**

```bash
cp /root/dev/crowdy/conoha-cli-app-samples/opencascade-fem/docs/screenshot.png \
   docs/public/examples/opencascade-fem/screenshot.png
```

- [ ] **Step 2.4: Verify the copy**

```bash
ls -la docs/public/examples/opencascade-fem/screenshot.png
file docs/public/examples/opencascade-fem/screenshot.png
```

Expected: file present, `file` reports `PNG image data`.

---

## Task 3: Write the flagship page `docs/examples/opencascade-fem.md`

**Files:**
- Create: `docs/examples/opencascade-fem.md`

This is the page that proves the flagship template. The full content below should be written verbatim. Source material: upstream `opencascade-fem/README.md` + `docs/blogs/opencascade-fem.md` for tone/framing.

- [ ] **Step 3.1: Create the page with this exact content**

````markdown
# OpenCascade FEM デプロイ

CAD 形状を組み → メッシュを切り → 線形弾性 FEM を解いて → ブラウザに 3D 表示。商用 CAE の中で完結するワークフローを、すべてオープンソース + 単一 Docker コンテナで再現するサンプルです。

::: tip 本例は proxy モード対応 (`conoha.yml` 同梱)
HTTPS 終端は conoha-proxy が担当します。no-proxy で動かす場合は末尾の [no-proxy で動かす](#no-proxy-で動かす) を参照してください。
:::

## 完成イメージ

- ブラウザで `bracket` / `plate_hole` / `cantilever_ibeam` の 3 形状をパラメトリックに調整
- 「実行」を押すと SSE で `queued → shape → mesh → assemble → solve → postproc → done` の進捗が逐次配信される
- vtk.js で von Mises 応力分布を 3D 表示・回転・ズーム
- ジョブ完了後 30 分は結果が残り、TTL リーパで自動掃除

![opencascade-fem screenshot](/examples/opencascade-fem/screenshot.png)

## 前提条件

- ConoHa CLI がインストール・ログイン済み ([はじめに](/guide/getting-started))
- サーバーが作成済み ([`--for proxy` プリセット推奨](/guide/server#プリセット-for))
- ドメインを用意し、A レコードを VPS の IP に向けている ([DNS / TLS](/guide/dns-tls))
- conoha-proxy がブート済み ([conoha-proxy セットアップ](/guide/proxy-setup))

::: warning RAM 推奨
gmsh + scikit-fem + OpenCascade を同時に動かすため、**2GB 以上のメモリ** を推奨します (`g2l-t-2` 以上)。デフォルト設定の `MAX_CONCURRENT=2` でピーク時 ~1.5GB を消費します。
:::

## スタック

| 役割 | 採用ライブラリ |
|---|---|
| CAD | pythonocc-core 7.9 (OpenCascade の Python バインディング、conda-forge) |
| Mesh | gmsh 4.15 (OpenCascade ジオメトリを四面体メッシュ化) |
| Solver | scikit-fem 10.x + `scipy.sparse.linalg.spsolve` (線形弾性、CPU) |
| API | FastAPI + uvicorn (SSE 進捗ストリーミング) |
| Frontend | vanilla JS + vtk.js (CDN ESM、importmap で依存解決) |
| Container | micromamba ベース、約 1GB の単一イメージ |

## 1. compose.yml

完全版は [`opencascade-fem/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/opencascade-fem/compose.yml)。要点だけ抜粋します。

```yaml
services:
  web:
    build: .
    expose: ["8000"]   # ホストには公開しない (proxy が振り分ける)
    environment:
      OCFEM_MAX_CONCURRENT: "2"
      OCFEM_MAX_ELEMENTS: "200000"
      OCFEM_SOLVER_TIMEOUT_SECONDS: "60"
      OCFEM_JOB_TTL_SECONDS: "1800"
    volumes:
      - jobs:/app/jobs   # 結果ファイルの一時保管 (TTL リーパが定期掃除)
volumes:
  jobs: {}
```

::: warning `expose` を `ports` にしないこと
proxy モードでは `expose:` を使ってコンテナ側ポートだけを宣言します。`ports:` で公開すると blue/green スロットが衝突します。詳しくは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。
:::

## 2. conoha.yml

```yaml
name: opencascade-fem
hosts:
  - opencascade-fem.example.com
web:
  service: web
  port: 8000
```

`hosts:` は自分の FQDN に書き換えてください。`port: 8000` は compose の `expose: ["8000"]` と一致させます。

## 3. デプロイ

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/opencascade-fem

# conoha.yml の hosts: を自分のドメインに編集
$EDITOR conoha.yml

# proxy がブートしていなければ
conoha proxy boot --acme-email you@example.com <サーバー名>

conoha app init <サーバー名>
conoha app deploy <サーバー名>
```

初回ビルドは micromamba + OpenCascade + gmsh のセットアップで 5〜10 分かかります。2 回目以降はレイヤキャッシュで 1 分以内に収まります。

## 4. 動作確認

### ブラウザで開く

`https://opencascade-fem.example.com/` でフロントエンドが表示されます。

1. 左ペインで形状 (`bracket` / `plate_hole` / `cantilever_ibeam`) を選択
2. パラメータ (寸法・厚み・穴半径など) を調整
3. **実行** を押すと右ペインで SSE 進捗が流れ、完了後に応力分布が 3D 表示される

### API を直接叩く

ジョブ投入:

```bash
curl -X POST https://opencascade-fem.example.com/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "shape": {"kind": "plate_hole", "params": {"length": 100, "width": 50, "thickness": 5, "hole_radius": 10}},
    "mesh_size": 5.0,
    "material": {"E": 210e9, "nu": 0.3},
    "load": {"magnitude": 1e7}
  }'
# => {"job_id": "..."}
```

SSE で進捗を購読:

```bash
curl -N https://opencascade-fem.example.com/jobs/<JOB_ID>/events
# data: {"stage": "queued", ...}
# data: {"stage": "shape", "t_ms": 42, ...}
# data: {"stage": "mesh", "t_ms": 1234, ...}
# data: {"stage": "assemble", ...}
# data: {"stage": "solve", ...}
# data: {"stage": "done", ...}
```

結果ダウンロード (VTP 形式):

```bash
curl -O https://opencascade-fem.example.com/jobs/<JOB_ID>/result.vtp
```

### `/shapes` カタログ

```bash
curl https://opencascade-fem.example.com/shapes | jq .
```

3 形状それぞれのパラメータレンジと境界条件メタデータが返ります。

## ギャラリーの 3 形状

| kind | パラメータ | 境界条件 |
|---|---|---|
| `bracket` | base_len, base_thk, wall_h, wall_thk, width | 底面 fixed / 壁面上端に +Z 方向 traction |
| `plate_hole` | length, width, thickness, hole_radius | 短辺 X=0 fixed / X=L で +X 方向引張 (Kirsch 応力集中) |
| `cantilever_ibeam` | length, height, flange_w, flange_t, web_t | 壁面 X=0 fixed / 自由端 X=L で +X 方向引張 |

## チューニング

| 環境変数 | デフォルト | 説明 |
|---|---|---|
| `OCFEM_MAX_CONCURRENT` | 2 | 同時実行ジョブの上限 |
| `OCFEM_MAX_ELEMENTS` | 200000 | 1 ジョブのメッシュ要素数の上限 |
| `OCFEM_SOLVER_TIMEOUT_SECONDS` | 60 | ソルバーのウォールクロック上限 |
| `OCFEM_JOB_TTL_SECONDS` | 1800 | ジョブディレクトリの保持時間 |

CPU コア数に応じて `OCFEM_MAX_CONCURRENT` を増やす場合、メモリも線形に伸びる点に注意 (1 ジョブあたり 200k 要素で ~700MB)。

## ハマりどころ

### ソルバータイムアウトはバックグラウンドジョブを止めない

`OCFEM_SOLVER_TIMEOUT_SECONDS` は HTTP 応答だけ打ち切ります。CPython の `ThreadPoolExecutor` スレッドは協調的にしか停止できないため、実際の計算はバックグラウンドで継続します。タイムアウトしたジョブが連続すると CPU を占有したままになる可能性があります。

**対策**: `OCFEM_MAX_ELEMENTS` を保守的に保ち、フロントエンドからの `mesh_size` 検証で長時間ジョブを未然に弾く。本サンプルはこの方針を採用しています。

### vtk.js には Unstructured Grid Reader が無い

結果ファイルは表面 PolyData (VTP) のみ。テト体積メッシュではなく境界三角形だけをエクスポートします。

- 応力集中などの**表面現象**は十分可視化できる
- **内部の体積場**は表示されない

### 線形・小変形・等方性のみ

塑性・接触・動解析・モーダル・流体・熱は対象外。本サンプルは「単一コンテナで CAD → FEM → 可視化が一通り動く」ことを示すデモであって、商用 CAE の置き換えではありません。

### ジョブ状態はインメモリ

コンテナ再起動でジョブ履歴は消失します。永続化が必要なら結果 VTP を S3 互換ストレージへ流す、または PostgreSQL でジョブメタデータを保持するなどの拡張が必要です。

## no-proxy で動かす

HTTPS が不要 (社内・開発用) で proxy を立てたくない場合は `--no-proxy` を明示します。

```bash
conoha app deploy <サーバー名> --no-proxy
```

このサンプルは `conoha.yml` を同梱しているため、no-proxy 指定は明示的に必要です。proxy / no-proxy の使い分けは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の opencascade-fem](https://github.com/crowdy/conoha-cli-app-samples/tree/main/opencascade-fem)
- 検証記: [Qiita — ConoHa VPS3 + conoha-cli で OpenCascade + scikit-fem の CAE Web アプリを 1 台にデプロイ](https://qiita.com/crowdy)
- pythonocc-core: [tpaviot/pythonocc-core](https://github.com/tpaviot/pythonocc-core)
- gmsh: [gmsh.info](https://gmsh.info/)
- scikit-fem: [scikit-fem ドキュメント](https://scikit-fem.readthedocs.io/)
- vtk.js: [vtk.js ドキュメント](https://kitware.github.io/vtk-js/)
- 関連サンプル: [vLLM (OpenAI 互換 LLM サーバー)](/examples/vllm-gpu) — SSE ストリーミングつながり
````

- [ ] **Step 3.2: Verify the file was created**

```bash
wc -l docs/examples/opencascade-fem.md
```

Expected: ~210 lines (give or take a few).

- [ ] **Step 3.3: Secret-handling self-check**

```bash
grep -E "_PASSWORD=|_SECRET=|_TOKEN=|Bearer " docs/examples/opencascade-fem.md
```

Expected: no output. If anything matches, replace with `${VAR:?required}` or `<PLACEHOLDER>` per `CONTRIBUTING.md` rules.

```bash
grep -E "([0-9]{1,3}\.){3}[0-9]{1,3}" docs/examples/opencascade-fem.md
```

Expected: no real-looking IPs (the page should not contain any IPv4 literal — the only host references are placeholder FQDNs).

- [ ] **Step 3.4: Build and check for warnings**

```bash
npx vitepress build docs
```

Expected: `build complete in <Ns>.` with no warnings. In particular, watch for `[vitepress] dead link` warnings — the page links to `/guide/getting-started`, `/guide/server`, `/guide/dns-tls`, `/guide/proxy-setup`, `/guide/app-deploy`, and `/examples/vllm-gpu`. All six already exist; if a warning appears, double-check the typed path.

- [ ] **Step 3.5: Dev-server visual check**

```bash
npx vitepress dev docs &
DEV_PID=$!
sleep 5
curl -s http://localhost:5173/examples/opencascade-fem | head -50
kill $DEV_PID
```

Expected: HTML output containing the page title. The page is reachable directly by URL even before the sidebar entry exists.

- [ ] **Step 3.6: Commit**

```bash
git add docs/examples/opencascade-fem.md docs/public/examples/opencascade-fem/screenshot.png
git commit -m "$(cat <<'EOF'
docs(examples): add opencascade-fem flagship page

CAD → mesh → linear-elasticity FEM → vtk.js, proxy-mode by default with
a no-proxy escape hatch. Validates the flagship template for Phase 1 of
the app-samples reflection work.

EOF
)"
```

---

## Task 4: Register the page in the ja sidebar

**Files:**
- Modify: `docs/.vitepress/config/ja.ts`

The new entry goes at the end of the `アーキテクチャパターン` section so existing pages stay first. The new categories from the spec (`フルスタックウェブ`, `開発インフラ・運用`, `ちょっと変わったもの`) are NOT introduced in this PR — they appear when their first content arrives in later phase PRs.

- [ ] **Step 4.1: Locate the section**

Open `docs/.vitepress/config/ja.ts`. The relevant block today is:

```ts
{
  text: 'アーキテクチャパターン',
  items: [
    { text: 'nginx リバースプロキシ', link: '/examples/nginx-reverse-proxy' },
    { text: 'Ory Hydra + FastAPI (OAuth2)', link: '/examples/hydra-python-api' },
  ],
},
```

- [ ] **Step 4.2: Append the opencascade-fem entry**

Replace the block above with:

```ts
{
  text: 'アーキテクチャパターン',
  items: [
    { text: 'nginx リバースプロキシ', link: '/examples/nginx-reverse-proxy' },
    { text: 'Ory Hydra + FastAPI (OAuth2)', link: '/examples/hydra-python-api' },
    { text: 'OpenCascade FEM (CAD→CAE→3D)', link: '/examples/opencascade-fem' },
  ],
},
```

- [ ] **Step 4.3: Build and verify the sidebar resolves the link**

```bash
npx vitepress build docs
```

Expected: clean build. If `[vitepress] dead link` appears for `/examples/opencascade-fem`, the page from Task 3 is missing.

- [ ] **Step 4.4: Dev-server check that the sidebar shows the new entry**

```bash
npx vitepress dev docs &
DEV_PID=$!
sleep 5
curl -s http://localhost:5173/examples/nextjs | grep -c "opencascade-fem"
kill $DEV_PID
```

Expected: a non-zero count (the sidebar HTML embeds the new link on every `/examples/*` page).

- [ ] **Step 4.5: Commit**

```bash
git add docs/.vitepress/config/ja.ts
git commit -m "$(cat <<'EOF'
docs(sidebar): register opencascade-fem under アーキテクチャパターン

EOF
)"
```

---

## Task 5: Append "Adding a new example page" to CONTRIBUTING.md

**Files:**
- Modify: `CONTRIBUTING.md`

This codifies the checklist that future PRs in Phases 2a–3b will follow, so the conventions don't drift.

- [ ] **Step 5.1: Inspect the end of CONTRIBUTING.md**

```bash
tail -10 CONTRIBUTING.md
```

Expected: ends with the "If you accidentally commit a secret" section.

- [ ] **Step 5.2: Append the new section**

Append the following block to the end of `CONTRIBUTING.md` (one blank line before the new heading, no trailing whitespace):

```markdown

## Adding a new example page

When adding a page under `docs/examples/` for a sample that exists in
[`conoha-cli-app-samples`](https://github.com/crowdy/conoha-cli-app-samples):

1. **Filename**: `docs/examples/<sample>.md`, kebab-case, same slug as the
   `app-samples` directory (e.g. `opencascade-fem.md`, not
   `opencascade_fem.md` or `opencascade-fem-page.md`).
2. **Page layout**: 完成イメージ → 前提条件 → デプロイ → 動作確認 → 関連リンク.
   Flagship pages (GPU/AI, OIDC, PaaS, showcase full-stack) add
   `compose.yml` excerpt, ハマりどころ, and カスタマイズ sections; compact
   pages omit them and lean on the upstream README.
3. **Sidebar**: register in `docs/.vitepress/config/ja.ts` under the
   matching category. The eight target categories are スターター /
   Web フレームワーク / フルスタックウェブ / AI / GPU / セルフホスティング SaaS
   / 開発インフラ・運用 / アーキテクチャパターン / ちょっと変わったもの (see
   `docs/superpowers/specs/2026-06-05-app-samples-reflection-design.md`).
   Do not create empty category sections — introduce a category only when
   its first page lands.
4. **index.md rewire**: if `docs/index.md` already links to
   `github.com/crowdy/conoha-cli-app-samples/tree/main/<sample>`, switch it
   to `/examples/<sample>` in the same PR.
5. **Screenshots**: copy upstream screenshots into
   `docs/public/examples/<sample>/` and reference as
   `/examples/<sample>/<name>.png`.
6. **Internal links**: use absolute paths (`/examples/<other>`,
   `/guide/<topic>`), not relative.
7. **Build clean**: `npx vitepress build docs` must finish with no
   warnings. Dead-link warnings block the PR.
8. **Secret-handling**: every code block must comply with the rules
   above — no literal passwords, no real IPs, no real tenant UUIDs.
```

- [ ] **Step 5.3: Verify the addition**

```bash
tail -45 CONTRIBUTING.md
```

Expected: the new section appears in full.

- [ ] **Step 5.4: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "$(cat <<'EOF'
docs(contributing): add "Adding a new example page" checklist

Codifies the eight-step convention used by Phases 2a–3b of the
app-samples reflection work so each sample page lands consistently.

EOF
)"
```

---

## Task 6: Final build verification and PR

**Files:** none (verification and push only).

- [ ] **Step 6.1: Re-run a clean build**

```bash
rm -rf docs/.vitepress/dist
npx vitepress build docs
```

Expected: `build complete in <Ns>.` with no warnings.

- [ ] **Step 6.2: Check no unintended file changes**

```bash
git status
git diff --stat main...HEAD
```

Expected `--stat` summary (4 files):
- `CONTRIBUTING.md` (additions only)
- `docs/.vitepress/config/ja.ts` (1 line added inside the アーキパターン block)
- `docs/examples/opencascade-fem.md` (new)
- `docs/public/examples/opencascade-fem/screenshot.png` (new, binary)

If anything else appears (e.g., `docs/.vitepress/dist/...`), unstage and clean — `dist/` is gitignored but verify.

- [ ] **Step 6.3: Final secret-handling sweep across the diff**

```bash
git diff main...HEAD -- docs/examples/opencascade-fem.md \
  | grep -E "_PASSWORD=|_SECRET=|_TOKEN=|Bearer |sk_[a-zA-Z0-9]|pk_[a-zA-Z0-9]|whsec_|hf_[a-zA-Z0-9]"
```

Expected: no output.

```bash
git diff main...HEAD -- docs/examples/opencascade-fem.md \
  | grep -E "^\+.*([0-9]{1,3}\.){3}[0-9]{1,3}"
```

Expected: no output (no real IPv4 added).

- [ ] **Step 6.4: Push the branch**

```bash
git push -u origin docs/examples-phase1-opencascade-fem
```

- [ ] **Step 6.5: Open the PR**

```bash
gh pr create --title "docs(examples): add opencascade-fem flagship page + CONTRIBUTING checklist (Phase 1)" --body "$(cat <<'EOF'
## Summary

Phase 1 of the app-samples reflection work
(spec: \`docs/superpowers/specs/2026-06-05-app-samples-reflection-design.md\`).
This PR is intentionally narrow — it validates the flagship template against
one sample (\`opencascade-fem\`, the newest sample in
\`conoha-cli-app-samples\`) and lays down the contributor conventions used by
the seven follow-up PRs.

- New page \`docs/examples/opencascade-fem.md\` (~210 lines, flagship template)
- Screenshot at \`docs/public/examples/opencascade-fem/screenshot.png\`
- Sidebar entry added to \`docs/.vitepress/config/ja.ts\` under
  アーキテクチャパターン
- \`CONTRIBUTING.md\` gains an "Adding a new example page" checklist

No changes to \`docs/index.md\` (opencascade-fem is not yet listed in any
home-page table; its row gets added in the Phase 4 cleanup PR alongside
the \`50+\` → \`55+\` count bump).

The new sidebar categories from the spec (フルスタックウェブ /
開発インフラ・運用 / ちょっと変わったもの) are deferred to the PR that
introduces their first content — empty sections would look broken.

## Test plan

- [ ] \`npx vitepress build docs\` is clean (no warnings)
- [ ] Dev server: \`/examples/opencascade-fem\` renders with screenshot,
  table of stack, and all six tip/warning callouts
- [ ] Sidebar shows the new entry on every \`/examples/*\` page
- [ ] Every internal link in the new page resolves (clicked through:
  /guide/getting-started, /guide/server, /guide/dns-tls,
  /guide/proxy-setup, /guide/app-deploy, /examples/vllm-gpu)
- [ ] \`gitleaks\` PR check passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: the command returns a PR URL. Report it to the user.

---

## Follow-up: Phases 2a through 4

This PR (Phase 1) unblocks the other phases listed in the spec. Each of the
following deserves its own plan file because the per-PR contents differ in
sample selection, sidebar shape, and `index.md` rewires:

- `2026-MM-DD-app-samples-phase2a-ai-gpu-flagships.md`
- `2026-MM-DD-app-samples-phase2b-saas-flagships.md`
- `2026-MM-DD-app-samples-phase2c-devinfra-flagships.md`
- `2026-MM-DD-app-samples-phase2d-fullstack-flagships.md`
- `2026-MM-DD-app-samples-phase3a-compact-web-curio.md`
- `2026-MM-DD-app-samples-phase3b-compact-saas-devinfra.md`
- `2026-MM-DD-app-samples-phase4-cleanup.md`

Write each plan when the corresponding PR is started — they share the same
structure (Task 1 baseline → Task 2 screenshot copies → Task 3 page writes →
Task 4 sidebar updates → Task 5 index.md rewires → Task 6 build + PR) but
the page content differs per sample.
