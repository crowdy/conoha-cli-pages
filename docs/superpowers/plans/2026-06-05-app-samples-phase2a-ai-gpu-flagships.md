# App Samples — Phase 2a (AI / GPU Flagships) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five flagship example pages — `ollama-webui-gpu`, `hunyuan3d-gpu`, `fish-speech-tts-gpu`, `voice-agent-conoha-l4`, and `dify-https` — to the AI/GPU section of the docs site, rename the category from "AI / LLM" to "AI / GPU", rewire four `index.md` rows from GitHub links to internal links, and add a new `voice-agent-conoha-l4` row to the home-page AI/GPU table.

**Architecture:** Five new markdown pages under `docs/examples/`, optionally accompanied by screenshots under `docs/public/examples/<sample>/` if the upstream sample ships one. Each page follows the flagship template established by `docs/examples/opencascade-fem.md` (merged in PR #30): 完成イメージ → 前提条件 → スタック → compose.yml 抜粋 → conoha.yml → デプロイ → 動作確認 → カスタマイズ / チューニング → ハマりどころ → 関連リンク. Sidebar edits in `docs/.vitepress/config/ja.ts` rename the category and add five entries; `docs/index.md` swaps four existing GitHub links to internal links and inserts one new row for `voice-agent-conoha-l4`. Build verified by `npx vitepress build docs` after each commit. One PR per phase.

**Tech Stack:** VitePress 1.6.4, markdown. Source-of-truth for each sample's behavior: `crowdy/conoha-cli-app-samples` `main` at each sample's `README.md`, `conoha.yml`, `compose.yml`, `Dockerfile`, plus the matching `docs/blogs/<sample>.md` Qiita draft where it exists (`hunyuan3d-gpu`, `fish-speech-tts-gpu`, `voice-agent-conoha-l4` have drafts; `ollama-webui-gpu` and `dify-https` do not).

**Spec:** `docs/superpowers/specs/2026-06-05-app-samples-reflection-design.md`

**Reference flagship:** `docs/examples/opencascade-fem.md` (229 lines). Every page in this PR follows its section shape. Deviate only where the sample requires it (no-proxy vs proxy mode, GPU prerequisites, multi-FQDN `expose:` blocks, etc).

---

## Sample Cheat Sheet (read before writing each page)

| Sample | Mode | Flavor | conoha.yml | Notable | Page target |
|---|---|---|---|---|---|
| `ollama-webui-gpu` | proxy | L4 GPU | `accessories: [ollama]` so the warm model survives blue/green swaps | Open WebUI + Ollama on L4 | ~200L |
| `hunyuan3d-gpu` | **no-proxy** | L4 GPU | **none** — Gradio binds 7860 directly | Image → GLB via Tencent Hunyuan3D-2 | ~200L |
| `fish-speech-tts-gpu` | proxy | L4 GPU | Single host fronts Gradio at `:7860`; REST API at `:8080` reachable only via SSH tunnel | TTS + voice cloning + bundled Go CLI client | ~280L |
| `voice-agent-conoha-l4` | proxy | **L4 GPU pinned via `flavor:` field** | `accessories: [backend, llm, agent]`; only `frontend` slot-rotates | Self-hosted WebRTC voice agent (WebRTC → Silero VAD → faster-whisper STT → Qwen2.5 LLM → SBV2 TTS) | ~400L |
| `dify-https` | proxy, **multi-host** | CPU (no GPU needed) | THREE FQDNs via `expose:` blocks: root (nginx fan-out), `api.`, `web.`; `worker` accessory does NOT slot-rotate (deferred per spec §1.3) | Dify AI workflow platform self-hosted | ~280L |

Implementer dispatched per page MUST read the upstream `README.md` + (when present) the blog draft before writing. The blog draft's "なぜ面白いか" framing is often the right intro voice; the README's "既知の制限" / troubleshooting section is the right source for the ハマりどころ section.

---

## File Structure

| Path | Action | Purpose |
|---|---|---|
| `docs/examples/ollama-webui-gpu.md` | **create** | Flagship page (proxy mode, `accessories:` pattern walkthrough). |
| `docs/examples/hunyuan3d-gpu.md` | **create** | Flagship page (no-proxy mode, like vllm-gpu). |
| `docs/examples/fish-speech-tts-gpu.md` | **create** | Flagship page (proxy mode, Gradio + REST API two-port pattern with SSH tunnel). |
| `docs/examples/voice-agent-conoha-l4.md` | **create** | Flagship page (proxy mode, `flavor:` pin, multi-accessory architecture). |
| `docs/examples/dify-https.md` | **create** | Flagship page (proxy mode, multi-FQDN `expose:` block pattern). |
| `docs/public/examples/<sample>/*.png` | create *(if upstream has a screenshot)* | Screenshots from `app-samples/<sample>/docs/`. As of plan write, none of the 5 have one — skip unless one appears upstream. |
| `docs/.vitepress/config/ja.ts` | refresh | Rename `AI / LLM` → `AI / GPU`; rename `Ollama + Open WebUI` → `Ollama + Open WebUI (CPU)`; append 5 entries in the right order. |
| `docs/index.md` | refresh | Swap 4 GitHub links to internal (`ollama-webui-gpu`, `hunyuan3d-gpu`, `fish-speech-tts-gpu`, `dify-https`); add a new row for `voice-agent-conoha-l4` in the AI/GPU table. |

No changes to `docs/.vitepress/config/en.ts` / `ko.ts` (those locales have no `/examples/` content; per spec Non-Goals).
No changes to `CONTRIBUTING.md` (Phase 1 already added the checklist).
No changes to other example pages (existing 22 stay as they are).

---

## Task 1: Create branch and confirm clean baseline

**Files:** none yet (verification only).

- [ ] **Step 1.1: Confirm on main and pull latest**

```bash
git checkout main
git pull --ff-only origin main
```

Expected: `Already up to date.` or fast-forward summary. Phase 1 (PR #30, `af9df82`) should already be present in `git log --oneline -5`.

- [ ] **Step 1.2: Create the working branch**

```bash
git checkout -b docs/examples-phase2a-ai-gpu-flagships
```

- [ ] **Step 1.3: Confirm baseline build is clean**

```bash
npx vitepress build docs
```

Expected: `build complete in <Ns>.` with no warnings (the caddyfile language-fallback notices are pre-existing). If anything else, stop and investigate.

---

## Tasks 2–6: Per-page authoring

Each of Tasks 2–6 follows the same shape: **read the sample's source material, write the page following the flagship template, sanity-check, commit**.

The implementer dispatched for each task gets the per-sample notes embedded in the task prompt, plus the universal checklist below. Each task produces exactly one commit on the branch.

### Universal per-page checklist

For every page in Tasks 2–6:

- [ ] **Read source material** in this order:
  1. `app-samples/<sample>/README.md`
  2. `app-samples/docs/blogs/<sample>.md` if it exists (skip otherwise — note that 2 of the 5 don't have one)
  3. `app-samples/<sample>/conoha.yml` (or note its absence — `hunyuan3d-gpu` has none)
  4. `app-samples/<sample>/compose.yml` for the excerpt
  5. `app-samples/<sample>/Dockerfile` only if a quirk needs to be surfaced

- [ ] **Open the reference flagship** at `docs/examples/opencascade-fem.md` and the comparable existing page (`docs/examples/vllm-gpu.md` for GPU + no-proxy; `docs/examples/hydra-python-api.md` for multi-service proxy; `docs/examples/hello-world.md` for proxy basics). Copy the structural patterns, not the prose.

- [ ] **Page sections (mandatory)** in this order:
  1. `# <タイトル> デプロイ` (H1)
  2. 1–2 paragraph intro
  3. `::: tip` or `::: warning` callout stating proxy vs no-proxy mode
  4. `## 完成イメージ` — 3–5 bullet outcomes
  5. `## 前提条件` — including any GPU / RAM / flavor / FQDN requirements; include the standard four (`CLI installed`, `server created with --for proxy`, `DNS A record`, `proxy booted`) when applicable
  6. `## スタック` (optional table — use it when ≥4 non-obvious dependencies need orienting)
  7. `## 1. compose.yml` — **excerpt only**, link to the full file at `https://github.com/crowdy/conoha-cli-app-samples/blob/main/<sample>/compose.yml`. Strip secrets-leak surfaces (`POSTGRES_PASSWORD=postgres` becomes `${POSTGRES_PASSWORD:?required}`).
  8. `## 2. conoha.yml` — show the file verbatim with the `hosts:` pointing to `<sample>.example.com`. Skip this section entirely for `hunyuan3d-gpu` (no `conoha.yml`).
  9. `## 3. (optional) NVIDIA cloud-init` — required for the four GPU samples; reuse the script from `docs/examples/vllm-gpu.md` lines 102–125 and note that the same cloud-init works.
  10. `## 4. デプロイ` — `git clone → cd → edit hosts → conoha app init → conoha app deploy`. Make `--no-proxy` opt-in explicit for `hunyuan3d-gpu`.
  11. `## 5. 動作確認` — browser walk + `curl` smoke + (if applicable) SDK / API example
  12. `## カスタマイズ` or `## チューニング` — model swap, env vars, OIDC swap, scaling knobs
  13. `## ハマりどころ` — 2–4 concrete pitfalls drawn from upstream "既知の制限" + the implementer's reading of compose / Dockerfile quirks
  14. `## 関連リンク` — recipe (GitHub), blog draft URL only if published (otherwise placeholder `*公開後にリンク追加*`), upstream project, related sample (always link `vllm-gpu` for GPU pages, `opencascade-fem` for SSE pages, `hydra-python-api` for OIDC pages)

- [ ] **Conventions** (every page):
  - No front-matter
  - Absolute internal links: `/guide/...`, `/examples/...`
  - No literal passwords / secrets / Bearer tokens (`CONTRIBUTING.md` rules apply — `gitleaks` runs in CI)
  - No real IPv4 / UUID / tenant ID literals
  - Use placeholder FQDNs (`<sample>.example.com`) and placeholder `<SERVER_IP>` / `<YOUR_KEY>` / `<JOB_ID>` etc.
  - Code fences balanced (matched openers/closers)
  - `::: tip / warning / danger` blocks always closed with `:::`
  - Tables have consistent column counts
  - Headings have no skipped levels

- [ ] **Pre-commit sanity checks**:

```bash
wc -l docs/examples/<sample>.md   # expect inside ±20% of the page-target line count
grep -E "_PASSWORD=|_SECRET=|_TOKEN=|Bearer |sk_[a-zA-Z0-9]|pk_[a-zA-Z0-9]|whsec_|hf_[a-zA-Z0-9]" docs/examples/<sample>.md   # expect no output
grep -E "([0-9]{1,3}\.){3}[0-9]{1,3}" docs/examples/<sample>.md   # expect no output
npx vitepress build docs   # expect clean build, no [vitepress] dead link warnings
```

If any check fails, fix before committing. The page is NOT yet referenced from the sidebar at this point, so VitePress can render it directly by URL (`/examples/<sample>`) but won't show it in the sidebar until Task 7. Dead-link warnings would come from misspelled internal links inside the new page.

- [ ] **Commit format**: one commit per page, message:

```
docs(examples): add <sample> flagship page

<2-line summary of what the page covers and which mode it uses>
```

### Task 2: ollama-webui-gpu (proxy mode, accessories pattern)

**Files:**
- Create: `docs/examples/ollama-webui-gpu.md`

**Sample-specific notes (for the implementer):**

- conoha.yml has `accessories: [ollama]`. The model is GPU-resident and takes minutes to reload, so the ollama container is kept alive across blue/green swaps — only `webui` is duplicated. This is the headline story for this page; the ハマりどころ section should call out that the ollama container is NOT slot-rotated and any change to `ollama:` in compose.yml requires a manual restart.
- L4 GPU flavor is required. Reuse the NVIDIA cloud-init from `docs/examples/vllm-gpu.md`.
- Default model in upstream: Gemma 4 (check README for exact tag). Document `OLLAMA_MODELS` and how to `ollama pull` from inside the container.
- Open WebUI port: `8080` (per `conoha.yml`).
- Compare and contrast with `docs/examples/ollama-webui.md` (the CPU version, 126 lines) — link from this new page back to the CPU one for users without GPU.
- No blog draft exists. Lean entirely on README + compose.yml.

**Execute the Universal per-page checklist above with the notes above.**

### Task 3: hunyuan3d-gpu (no-proxy mode, Gradio direct-bind)

**Files:**
- Create: `docs/examples/hunyuan3d-gpu.md`

**Sample-specific notes:**

- NO `conoha.yml` → uses no-proxy mode. The page MUST have a top-level `::: tip` block stating this, mirroring `docs/examples/vllm-gpu.md` lines 5–7 and `docs/examples/opencascade-fem.md` lines 5–7. Skip the `## 2. conoha.yml` section.
- L4 GPU flavor required. Reuse NVIDIA cloud-init from `vllm-gpu.md`.
- UI is Gradio. Page should explain that Gradio is bound directly to `:7860` (or whatever the upstream sets) and that `--no-proxy` is mandatory for `conoha app deploy`.
- Blog draft at `app-samples/docs/blogs/hunyuan3d-gpu.md` (284 lines) — use it as the prose source for intro and ハマりどころ. Note any published Qiita URL in the blog draft front-matter; if absent, use the placeholder pattern.
- Functional demo flow: upload image → GLB output. Show a `curl` example for the file upload endpoint if Gradio exposes a clean REST shape; otherwise stick to the browser walkthrough.
- Disk requirement: model is large (~10GB+). Document `start_period` for healthcheck and storage expectation in 前提条件 and ハマりどころ.

### Task 4: fish-speech-tts-gpu (proxy mode, two-port pattern)

**Files:**
- Create: `docs/examples/fish-speech-tts-gpu.md`

**Sample-specific notes:**

- conoha.yml fronts Gradio at `:7860` via proxy (`web.port: 7860`). The REST API on `:8080` is **NOT** exposed via the proxy — only via SSH tunnel. This is the headline pattern story for the page: how to expose one HTTP port while keeping the API internal. Include an SSH tunnel example: `ssh -L 8080:localhost:8080 <SERVER_IP>` and then `curl http://localhost:8080/...`.
- L4 GPU flavor required. Reuse NVIDIA cloud-init.
- Bundled Go CLI client (`line-cli-go` style — separate Go binary) lives in `app-samples/fish-speech-tts-gpu/`. Document how to build and run it locally against the SSH-tunneled API.
- Voice cloning: explain the reference-audio + transcript upload pattern.
- Blog draft at `app-samples/docs/blogs/fish-speech-tts-gpu.md` (352 lines) — rich source. Use for intro voice, technical depth, and ハマりどころ section.

### Task 5: voice-agent-conoha-l4 (proxy mode, `flavor:` pin, multi-service)

**Files:**
- Create: `docs/examples/voice-agent-conoha-l4.md`

**Sample-specific notes:**

- This is the most complex sample in Phase 2a. Target ~400 lines.
- conoha.yml uses the `flavor: g2l-t-c4m16g1-l4` field — required so `conoha app deploy` rejects the deploy if the server flavor doesn't match. Surface this pattern explicitly; the same `flavor:` pin pattern will be useful for future GPU samples.
- `accessories: [backend, llm, agent]` — only `frontend` is duplicated per blue/green slot. Highlight which services stay warm and why (the LLM is GPU-resident; the agent holds WebRTC peer state).
- Architecture stack: Next.js frontend → backend API → agent (FastAPI + aiortc + Silero VAD + faster-whisper STT + ConversationLoop) → vLLM (Qwen2.5-7B-AWQ + Hermes tool parser) → SBV2 TTS. Diagram this either with a code-block ASCII (cf. `docs/examples/hydra-python-api.md` lines 28–36) or a labeled stack table.
- Three personas (modes) shipped: surface the `/modes` endpoint and the persona-swap UI.
- Google Sheets integration: surface as optional, with auth via service account (do NOT inline any private key — placeholder `<SERVICE_ACCOUNT_JSON>`).
- WebRTC requires HTTPS for production browsers (mic access). Document the prerequisite.
- Blog draft at `app-samples/docs/blogs/voice-agent-conoha-l4.md` (230 lines).
- Related-link cross-pollination: link to `/examples/vllm-gpu` (same LLM stack), `/examples/fish-speech-tts-gpu` (TTS context).

### Task 6: dify-https (proxy mode, multi-FQDN expose blocks)

**Files:**
- Create: `docs/examples/dify-https.md`

**Sample-specific notes:**

- **CPU-only** sample (no L4 GPU needed). Skip the NVIDIA cloud-init section.
- conoha.yml uses **three** FQDNs via `expose:` blocks: root (`<sample>.example.com` → nginx fan-out), `api.` (Dify API, blue_green:true, /health probe), `web.` (Dify web Next.js, blue_green:true, / probe). This is the headline pattern story for the page: show the full `conoha.yml` and walk through what each `expose:` block does, including the `unhealthy_threshold: 24` for first-start DB migrations.
- `worker` accessory does NOT slot-rotate (internal-only blue/green deferred per spec §1.3). Note this honestly in ハマりどころ: worker code changes require a manual restart.
- DNS prerequisite: three A records (`dify-https.example.com`, `api.dify-https.example.com`, `web.dify-https.example.com`) all pointing at the VPS.
- Dify init: first-boot DB migration takes time — surface that and tie it to the `unhealthy_threshold: 24`.
- No blog draft. Lean on README + conoha.yml + nginx config in `app-samples/dify-https/nginx.conf` (if present) for prose.
- Related sample link: `/examples/hydra-python-api` (multi-service proxy pattern). `/examples/nginx-reverse-proxy` (architectural cousin).

---

## Task 7: Sidebar update — rename category, append 5 entries

**Files:**
- Modify: `docs/.vitepress/config/ja.ts`

- [ ] **Step 7.1: Locate the current AI/LLM section** (around lines 55–62):

```ts
{
  text: 'AI / LLM',
  items: [
    { text: 'FastAPI + AIチャットボット', link: '/examples/fastapi-ai-chatbot' },
    { text: 'Ollama + Open WebUI', link: '/examples/ollama-webui' },
    { text: 'vLLM (OpenAI 互換, L4 GPU)', link: '/examples/vllm-gpu' },
  ],
},
```

- [ ] **Step 7.2: Replace with the AI/GPU section** (rename + reorder + 5 new entries):

```ts
{
  text: 'AI / GPU',
  items: [
    { text: 'FastAPI + AIチャットボット', link: '/examples/fastapi-ai-chatbot' },
    { text: 'Ollama + Open WebUI (CPU)', link: '/examples/ollama-webui' },
    { text: 'Ollama + Open WebUI (L4 GPU)', link: '/examples/ollama-webui-gpu' },
    { text: 'vLLM (OpenAI 互換, L4 GPU)', link: '/examples/vllm-gpu' },
    { text: 'Hunyuan3D-2 (画像→3D, L4 GPU)', link: '/examples/hunyuan3d-gpu' },
    { text: 'Fish Speech TTS (L4 GPU)', link: '/examples/fish-speech-tts-gpu' },
    { text: '音声エージェント (WebRTC + L4 GPU)', link: '/examples/voice-agent-conoha-l4' },
    { text: 'Dify (AI ワークフロー)', link: '/examples/dify-https' },
  ],
},
```

Match the existing 2-space indentation. Use the Edit tool with old_string = the current block and new_string = the new block.

- [ ] **Step 7.3: Build clean**:

```bash
npx vitepress build docs
```

Expected: clean build. Every new sidebar link must resolve to an existing page in `docs/examples/` (all 5 pages were created in Tasks 2–6).

- [ ] **Step 7.4: Commit**:

```bash
git add docs/.vitepress/config/ja.ts
git commit -m "$(cat <<'EOF'
docs(sidebar): rename AI/LLM → AI/GPU, add 5 phase-2a flagships

- AI / LLM → AI / GPU (most new entries are non-LLM: TTS, 3D, voice agent)
- Distinguish ollama-webui CPU vs L4 GPU explicitly
- Add ollama-webui-gpu, hunyuan3d-gpu, fish-speech-tts-gpu,
  voice-agent-conoha-l4, dify-https

EOF
)"
```

---

## Task 8: index.md rewire — swap 4 GitHub links + add voice-agent row

**Files:**
- Modify: `docs/index.md`

- [ ] **Step 8.1: Swap the four existing rows** in the AI / GPU table (around lines 36–40) to use internal links. Use the Edit tool four times (one Edit per row) with unique `old_string`:

```diff
- | [ollama-webui-gpu](https://github.com/crowdy/conoha-cli-app-samples/tree/main/ollama-webui-gpu) | Gemma 4 など大規模 LLM をブラウザでチャット (Open WebUI) |
+ | [ollama-webui-gpu](/examples/ollama-webui-gpu) | Gemma 4 など大規模 LLM をブラウザでチャット (Open WebUI) |
```

```diff
- | [hunyuan3d-gpu](https://github.com/crowdy/conoha-cli-app-samples/tree/main/hunyuan3d-gpu) | 画像から 3D モデル (GLB) を生成 (Tencent Hunyuan3D-2) |
+ | [hunyuan3d-gpu](/examples/hunyuan3d-gpu) | 画像から 3D モデル (GLB) を生成 (Tencent Hunyuan3D-2) |
```

```diff
- | [fish-speech-tts-gpu](https://github.com/crowdy/conoha-cli-app-samples/tree/main/fish-speech-tts-gpu) | 音声クローニング付き TTS + Go CLI クライアント |
+ | [fish-speech-tts-gpu](/examples/fish-speech-tts-gpu) | 音声クローニング付き TTS + Go CLI クライアント |
```

```diff
- | [dify-https](https://github.com/crowdy/conoha-cli-app-samples/tree/main/dify-https) | AI ワークフロープラットフォーム (Dify) |
+ | [dify-https](/examples/dify-https) | AI ワークフロープラットフォーム (Dify) |
```

- [ ] **Step 8.2: Add the voice-agent row** to the same AI / GPU table. Insert after the `dify-https` row so the table stays in roughly the same order as the sidebar:

```markdown
| [voice-agent-conoha-l4](/examples/voice-agent-conoha-l4) | WebRTC + faster-whisper + Qwen2.5 + Style-BERT-VITS2 で自前音声エージェント |
```

The Edit can target the `dify-https` row line and replace with `dify-https row + newline + voice-agent row`. Match the surrounding table column alignment.

- [ ] **Step 8.3: Build clean**:

```bash
npx vitepress build docs
```

Expected: clean build, no warnings.

- [ ] **Step 8.4: Commit**:

```bash
git add docs/index.md
git commit -m "$(cat <<'EOF'
docs(home): rewire AI/GPU table to internal links + add voice-agent row

- Swap 4 GitHub /tree/main/ links to /examples/ internal links
  (ollama-webui-gpu, hunyuan3d-gpu, fish-speech-tts-gpu, dify-https)
- Add voice-agent-conoha-l4 row (was missing from the home page)

EOF
)"
```

---

## Task 9: Final build verification and PR

**Files:** none (verification + push only).

- [ ] **Step 9.1: Clean rebuild**:

```bash
rm -rf docs/.vitepress/dist
npx vitepress build docs
```

Expected: `build complete in <Ns>.` with no warnings.

- [ ] **Step 9.2: Confirm the file change set**:

```bash
git diff --stat main...HEAD
```

Expected: 7 or 8 files (5 new pages + ja.ts + index.md + possibly screenshots in `docs/public/examples/<sample>/` if any exist upstream).

- [ ] **Step 9.3: Secret-handling sweep across the diff**:

```bash
git diff main...HEAD -- 'docs/examples/*.md' \
  | grep -E "_PASSWORD=|_SECRET=|_TOKEN=|Bearer |sk_[a-zA-Z0-9]|pk_[a-zA-Z0-9]|whsec_|hf_[a-zA-Z0-9]"
```

Expected: no output.

```bash
git diff main...HEAD -- 'docs/examples/*.md' \
  | grep -E "^\+.*([0-9]{1,3}\.){3}[0-9]{1,3}"
```

Expected: no output.

- [ ] **Step 9.4: Push the branch**:

```bash
git push -u origin docs/examples-phase2a-ai-gpu-flagships
```

- [ ] **Step 9.5: Open the PR**:

```bash
gh pr create --title "docs(examples): AI/GPU flagships — 5 new pages + sidebar rename (Phase 2a)" --body "$(cat <<'EOF'
## Summary

Phase 2a of the app-samples reflection work
(spec: \`docs/superpowers/specs/2026-06-05-app-samples-reflection-design.md\`,
plan: \`docs/superpowers/plans/2026-06-05-app-samples-phase2a-ai-gpu-flagships.md\`).
Adds five flagship pages for the GPU/AI samples and renames the sidebar
category accordingly. Phase 2b (self-hosted SaaS) comes next.

### Site changes

- 5 new pages under \`docs/examples/\`: ollama-webui-gpu, hunyuan3d-gpu,
  fish-speech-tts-gpu, voice-agent-conoha-l4, dify-https
- Sidebar: \`AI / LLM\` → \`AI / GPU\`; ollama-webui split into CPU vs
  GPU labels; 5 new entries appended
- \`docs/index.md\`: 4 rows in the AI/GPU table swapped from GitHub
  links to internal links; new \`voice-agent-conoha-l4\` row added

### Patterns demonstrated by these pages

- \`accessories:\` pattern (ollama-webui-gpu) — keep heavy services warm across blue/green swaps
- \`--no-proxy\` mode (hunyuan3d-gpu) — Gradio direct-bind
- Single proxy-fronted HTTP port + SSH-tunnel REST API (fish-speech-tts-gpu)
- \`flavor:\` pin field (voice-agent-conoha-l4) — reject deploy if server flavor mismatches
- Multi-FQDN \`expose:\` blocks (dify-https) — three subdomains served from one app

## Test plan

- [ ] \`npx vitepress build docs\` is clean (no warnings)
- [ ] Each new page renders at \`/examples/<sample>\` with correct sidebar context
- [ ] Sidebar shows AI / GPU heading and all 8 entries in the right order
- [ ] \`docs/index.md\` AI/GPU table now has 5 internal-link rows + voice-agent row
- [ ] \`gitleaks\` PR check passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: the command returns a PR URL.

---

## Follow-up plans

After this PR is merged, the remaining phases each get their own plan:

- `2026-MM-DD-app-samples-phase2b-saas-flagships.md` — outline, supabase-selfhost, immich
- `2026-MM-DD-app-samples-phase2c-devinfra-flagships.md` — coolify, dokploy
- `2026-MM-DD-app-samples-phase2d-fullstack-flagships.md` — nextjs-fastapi-postgresql, nextjs-fastapi-clerk-stripe, rails-mercari
- `2026-MM-DD-app-samples-phase3a-compact-web-curio.md` — 8 compact pages (Web/Full-stack + Curiosities)
- `2026-MM-DD-app-samples-phase3b-compact-saas-devinfra.md` — 13 compact pages (SaaS + Dev Infra)
- `2026-MM-DD-app-samples-phase4-cleanup.md` — `50+` → `55+`, residual `index.md` rewires, dead-link sweep
