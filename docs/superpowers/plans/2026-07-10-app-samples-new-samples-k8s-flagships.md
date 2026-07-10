# App-samples new samples — Kubernetes / 仮想化 flagships (vcluster + kubevirt-provisioner) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax.

**Parent spec:** `docs/superpowers/specs/2026-06-05-app-samples-reflection-design.md` (rev-2 — Phase 2e; new IA #8 "Kubernetes / 仮想化"; flagship template + non-deploy caveat). Human-approved 2026-07-10: new category + both flagship.

**Goal:** Add 2 **flagship** `/examples/` pages (`kubevirt-provisioner`, `vcluster`), create the new "Kubernetes / 仮想化" sidebar category, and copy the kubevirt screenshot into `docs/public/`. `index.md` rows are deferred to the Phase 4 cleanup PR (both are in the absent-rows set).

**Architecture:** Two independent flagship pages authored one-subagent-per-page. Controller wires the new sidebar category centrally.

## Global Constraints

- **Tier = flagship** (~200–300 lines; full `vllm-gpu.md`/`outline.md`-depth treatment). Flagship template: intro (state mode) → mode `::: tip/warning` → 完成イメージ (+ screenshot if present) → 前提条件 → compose/manifest excerpt (link full on GitHub main) → config → デプロイ (or the sample's real script flow) → 動作確認 → カスタマイズ → ハマりどころ → 関連リンク.
- **No front-matter. ja locale only. Absolute internal links** (`/examples/x`, `/guide/x`).
- **Source order:** README.md (+ README-en/ko, SPIKE_NOTES, docs/) → conoha.yml → compose.yml → manifests/ → scripts/ → .env.example. Fetch via `gh api repos/crowdy/conoha-cli-app-samples/contents/<path> --jq '.content' | base64 -d`.
- Reproduce conoha.yml inline comments verbatim; excerpt compose/manifests (don't inline whole files); link full files on GitHub main.
- **Secret-handling (gitleaks blocks merge):** no literal passwords/tokens/keys/kubeconfig-certs; mask as `${VAR:?required}`/`<PLACEHOLDER>`; never reproduce upstream weak defaults as literals; no real IPs (0.0.0.0/127.0.0.1/RFC-5737 OK); no real UUIDs; never inline a private key / client-cert / kubeconfig credential body (`BEGIN … KEY`, base64 cert blobs) — describe as generated/managed files; no base64 blobs ≥ ~20 chars next to a key/token/secret keyword (gitleaks generic-api-key). `（サンプルで設定済み）` not `（デフォルト）`.
- **Build clean:** `npx vitepress build docs`, no dead links. **Note:** any `${{ ... }}` (GitHub-Actions expressions) or `{{ ... }}` MUST live only inside fenced code blocks — never in inline `code` or prose (Vue interpolates inline `{{ }}` and crashes the SSR build).
- **File scoping:** each authoring subagent writes ONLY its own `docs/examples/<sample>.md` (+ its own screenshot under `docs/public/examples/<sample>/`). Never touches ja.ts/index.md — controller wires those.

---

### Task 1: kubevirt-provisioner flagship page (proxy-mode deploy)

**Files:**
- Create: `docs/examples/kubevirt-provisioner.md`
- Create: `docs/public/examples/kubevirt-provisioner/screenshot.png` (download from upstream `kubevirt-provisioner/docs/screenshot.png`)

**Sample facts (conoha.yml + README):** proxy mode, web `api:8080`, `blue_green:false` (k3s is a privileged stateful single instance; slots can't duplicate — quote comment), health `/health` with `unhealthy_threshold:120` (600s for cold k3s image pull — quote comment), accessories `[k3s, kubevirt-bootstrap]`. Stack: k3s (single privileged container = whole cluster) + KubeVirt + FastAPI provisioner. Browser creates/starts/stops/deletes Ubuntu VMs and drives a serial console (xterm.js) via `/api/vms/{name}/console` WebSocket. Runs on **hardware KVM** — ConoHa VPS3 exposes `/dev/kvm` (verified in `SPIKE_NOTES.md`); guest boot ~80s first / ~15s restart. kubevirt-bootstrap is a one-shot that applies KubeVirt then exits.

- [ ] **Step 1:** Fetch: README.md, conoha.yml, compose.yml, Dockerfile, entrypoint.sh, app/ (skim for the REST/WS routes), manifests/, bootstrap/, SPIKE_NOTES.md, docs/. Download the screenshot: `curl -sL https://raw.githubusercontent.com/crowdy/conoha-cli-app-samples/main/kubevirt-provisioner/docs/screenshot.png -o docs/public/examples/kubevirt-provisioner/screenshot.png` (mkdir -p first).
- [ ] **Step 2:** Write the flagship page. Intro: proxy-mode `conoha app deploy` sample that runs a full k8s+KubeVirt VM host on one VPS via hardware KVM. 完成イメージ references the screenshot as `/examples/kubevirt-provisioner/screenshot.png`. Sections: architecture diagram (reproduce/adapt the README ASCII arch), compose excerpt, the conoha.yml (quote comments verbatim — blue_green:false, the 600s health window), デプロイ (`conoha app init/deploy`), 動作確認 (browser VM create → serial console; curl the REST API), カスタマイズ (guest image, VM specs), ハマりどころ (`/dev/kvm` availability, the long first-boot window, blue_green:false rationale, privileged container). 関連リンク (Recipe; KubeVirt docs; related `/examples/vcluster`).
- [ ] **Step 3:** Secret/IP sweep clean (watch kubeconfig client-cert/token blobs — must be masked). Verify no inline `{{ }}` outside fenced blocks.
- [ ] **Step 4:** (controller commits centrally.)

### Task 2: vcluster flagship page (NON-DEPLOY, script-driven)

**Files:**
- Create: `docs/examples/vcluster.md`

**Sample facts (README):** **NO conoha.yml — non-deploy** (like dokploy). Driven by `conoha server create` + `conoha server ssh` + scripts. Installs **k3s** (lightweight single-node k8s) on a plain ConoHa VPS, then stands up **2 isolated vCluster virtual clusters** (`tenant-a` / `tenant-b`) and proves isolation with real commands. GPU not needed. Recommended flavor `g2l-t-c4m4` (4 vCPU/4GB), min `g2l-t-c3m2` (3 vCPU/2GB) — flavor/image names vary by region/time (`conoha flavor list` / `conoha image list`). vCluster (loft-sh, Apache-2.0) puts a per-tenant virtual control plane inside one host namespace: tenants get cluster-admin + own CRDs safely, data plane shared with host. Positioning vs Kamaji/k0smotron (hosted control plane) and Capsule (namespace isolation). Has manifests/ + scripts/ + .env.example + README-en/ko.

- [ ] **Step 1:** Fetch: README.md (+ README-en.md for terminology), .env.example, manifests/, scripts/ (read the actual install/create/verify scripts to describe the flow accurately).
- [ ] **Step 2:** Write the flagship page, adapting the flagship template for a NON-DEPLOY sample (per spec rev-2 template caveat): intro states honestly this is NOT a `conoha app deploy` target (no conoha.yml/compose) — it uses `conoha server create` + `conoha server ssh` + scripts, like dokploy. Sections: `::: warning` mode note (non-deploy, link `/guide/app-deploy#モードの比較`); 完成イメージ (2 isolated virtual clusters, tenant cluster-admin safe, own CRDs); 位置づけ (vCluster vs Kamaji/k0smotron/Capsule — from README); 前提条件 (CLI; a `g2l-t-c4m4` VPS — note flavor/image names vary, use `conoha flavor list`; SSH keypair; no GPU); セットアップ手順 (conoha server create → conoha server ssh → run the repo's k3s + vcluster scripts; reproduce the real script/manifest names); 隔離の確認 (the actual commands the README uses to demonstrate tenant isolation); カスタマイズ (add a 3rd tenant, resource limits); ハマりどころ (RAM floor, flavor naming drift, k3s/vcluster version pins). 関連リンク (Recipe; vCluster/loft-sh docs; related `/examples/kubevirt-provisioner`, `/examples/dokploy` for the non-deploy pattern).
- [ ] **Step 3:** Secret/IP sweep clean. No invented conoha.yml/proxy flow.
- [ ] **Step 4:** (controller commits centrally.)

### Task 3: Sidebar registration (controller, central)

**Modify `docs/.vitepress/config/ja.ts`.** Create a NEW category **`Kubernetes / 仮想化`** positioned **after アーキテクチャパターン, before ちょっと変わったもの** (spec IA #8). Items in this order:
- `KubeVirt プロビジョナー (k3s + VM)` → `/examples/kubevirt-provisioner`
- `vCluster (マルチテナント仮想 k8s)` → `/examples/vcluster`

### Task 4: Build + sweep + impl review (controller)

- [ ] `npx vitepress build docs` — dead-link clean.
- [ ] Secret/IP sweep across both pages (regex per Phase 3b Verification + kubeconfig/cert patterns).
- [ ] requesting-code-review (opus) on the branch diff with this plan path; fix Critical/Important before PR.

## Verification

```bash
grep -nE "_PASSWORD=[^$]|_SECRET=[^$]|_TOKEN=[^$]|_KEYS?=[^$]|_BASE=[^$]|Bearer [A-Za-z0-9]|eyJ[A-Za-z0-9]|sk-[A-Za-z0-9-]{8}|sk_[A-Za-z0-9]|BEGIN [A-Z ]*PRIVATE KEY|BEGIN CERTIFICATE|[A-Za-z0-9+/]{40,}={0,2}|:-[a-z]" docs/examples/<sample>.md
grep -nE "([0-9]{1,3}\.){3}[0-9]{1,3}" docs/examples/<sample>.md | grep -vE "0\.0\.0\.0|127\.0\.0\.1|192\.0\.2\.|198\.51\.100\.|203\.0\.113\."
grep -n "{{" docs/examples/<sample>.md   # every hit must be inside a fenced code block
npx vitepress build docs   # expect "build complete", no dead links
```
(The `[A-Za-z0-9+/]{40,}` check catches long base64 blobs that trip gitleaks generic-api-key — e.g. an inlined kubeconfig cert. Inspect each hit; mask or describe as a file.)
