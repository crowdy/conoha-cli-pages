# Buzz（人間 + AI エージェント協働ワークスペース）をセルフホスト

[Buzz](https://github.com/block/buzz)（Block, Inc. / Apache-2.0）は、**人間と AI エージェントが同じ部屋（Nostr リレー）で作業する**セルフホスト型ワークスペースです。メッセージも git イベントもワークフローも、すべて署名済み Nostr イベントとして 1 本のログに載り、署名者が人間かプロセスかで扱いが変わりません。

このサンプルは、ConoHa VPS 1 台に Buzz リレーを立て、**Claude エージェントを独自の Nostr 鍵を持つ参加者として常駐**させ、`buzz` CLI からの `@mention` に応答するところまでを **実測で** 示します（2026-07-25 に ConoHa 実機で全工程を検証済み）。`dokploy` や `vcluster` と同じく、`conoha app deploy` を使わない scripts 主体のサンプルです。

::: warning このサンプルはデプロイ対象（proxy モード）ではありません
`conoha app deploy` は使いません。`conoha.yml` を持たず、Caddy が `<ip-dashes>.sslip.io` + Let's Encrypt で 80/443 を **直接** 終端します。`conoha server create` で VPS を作り、リポジトリ同梱のスクリプト（`up.sh` → `verify.sh` → `agent-up.sh` → `down.sh`）を実行する構成です。デプロイモードの違いは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を、同種の non-compose / scripts 主体サンプルは [Dokploy](/examples/dokploy) や [vCluster](/examples/vcluster) を参照してください。
:::

::: tip バンドル Web にチャット UI はありません
リレーの `/` は **NIP-11 の JSON**（relay info）を返す Nostr エンドポイントで、チャット画面ではありません。**人間側の操作は `buzz` CLI** で行います。チャット GUI が要る場合は上流のデスクトップアプリ（Tauri、プリビルドあり）を使います（後述）。
:::

![ConoHa VPS 上のセルフホスト Buzz にデスクトップアプリで接続した様子（左下 `133-117-74-17` が自前リレー、`demo` チャンネルにエージェントが常駐）](https://raw.githubusercontent.com/crowdy/conoha-cli-app-samples/main/buzz/docs/screenshot.png)

## 完成イメージ

- ConoHa VPS 1 台の上に Buzz リレースタック（`relay` + `postgres` + `redis` + `minio` + `caddy`）が立ち上がり、`wss://<ip-dashes>.sslip.io` で外部から HTTPS/WSS 到達できる
- ホスト上の systemd サービス `buzz-acp` が **Claude エージェント** を常駐させ、独自の Nostr 鍵を持つメンバーとして `demo` チャンネルに参加する
- オーナーが `buzz` CLI から `@agent ...` と投稿すると、エージェントが同じチャンネルに応答を返す（`verify.sh --agent` が偽陰性対照 → 実応答まで自動検証）
- 上流のデスクトップアプリ（Tauri）から自前リレーの URL を登録すると、`demo` チャンネルが見え、GUI からも `@agent` に話せる

## 構成

- **リレースタック**（Docker Compose, 上流 `deploy/compose/`）: `relay`（Rust）+ `postgres` + `redis` + `minio` + `caddy`。
- **TLS**: Caddy が `<ip-dashes>.sslip.io` + Let's Encrypt で 80/443 を直接終端します（`conoha proxy` 不使用 = `conoha.yml` なし）。実機で LE 証明書取得と外部 HTTPS 到達を確認済み。
- **エージェント**: ホスト上の systemd サービス `buzz-acp`。`buzz-acp` が `claude-agent-acp`（ACP アダプタ）を spawn し、それが `claude`（Claude Code）を駆動します。エージェントは独自の Nostr 鍵を持つメンバーです。
- **上流ピン**: `deploy/compose/` を固定コミット SHA（`.buzz-ref`）で取得し、**パッチしません**。差分は `.env` 生成とホスト側スクリプトだけです。

## 前提条件

- conoha-cli がインストール・ログイン済み（[はじめに](/guide/getting-started)）。本サンプルは v0.8.0 で確認。
- **ConoHa に登録済みの SSH キーペア**（`conoha keypair list` で名前を確認し `KEY_NAME` に渡す）。対応する秘密鍵が手元にあること（`conoha server ssh` が自動検出する）。
- **`g2l-t-c6m8`（6 vCPU / 8GB, 時間課金）を推奨**。VM 上で `buzz-acp`/`buzz`（Rust）をビルドするため 8GB を推奨します。
  - 実測（2026-07-25, `sha-ab3af82`）: cargo ビルド **約 2 分**、稼働中メモリ使用 **約 1.1 GiB / 7.7 GiB**（relay 37M / caddy 29M / postgres 66M / redis 4M / minio 88M）、ディスク約 14 GB。運用だけなら軽いが、ビルドに余裕が要ります。
  - **フレーバー名・イメージ名は時期により異なる** — `conoha flavor list` / `conoha image list` で実在する名前を必ず確認してください（本サンプルは `vmi-ubuntu-26.04-amd64` を既定）。
- 手元に `git` / `bash` / `python3` / `openssl` / `curl`。
- **Claude 認証**（サブスクリプション OAuth もしくは `ANTHROPIC_API_KEY`）。詳細は「エージェントの認証」節。
- SSH(22)/HTTP(80, ACME)/HTTPS(443) を開ける（`up.sh` がセキュリティグループを作成）。

## クイックスタート

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/buzz

bash scripts/selftest.sh                       # ① ローカル検証（課金なし・静的検査込み）
KEY_NAME=<登録済みキー名> ./scripts/up.sh       # ② VM 作成 + リレー起動（課金開始）
./scripts/verify.sh                            # ③ リレー完了条件（0-4）
# ④ Claude 認証（サブスクリプション）: VM で一度だけ（次節参照）
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat... ./scripts/agent-up.sh   # ⑤ ビルド→鍵→systemd→チャンネル
./scripts/verify.sh --agent                    # ⑥ 偽陰性対照 → @mention 応答（中核）
./scripts/down.sh                              # ⑦ 全破棄（必ず実行 — 時間課金）
```

::: warning 時間課金 — 使い終わったら必ず `down.sh`
VM は時間課金です。検証が終わったら `./scripts/down.sh` でサーバー・ブートボリューム・セキュリティグループまで破棄してください。
:::

## エージェントの認証

`agent-up.sh` は `CLAUDE_CODE_OAUTH_TOKEN`（サブスクリプション OAuth）または `ANTHROPIC_API_KEY`（API 従量課金）を環境変数で受け取り、VM の root-only env（`/root/.buzz-agent.env`, `umask 077`）に配置します。どちらも渡さない場合は、systemd を用意した上で「トークンを追記して `systemctl restart buzz-acp`」する手順を表示します（silent に無認証で進めません）。

- **サブスクリプション OAuth（既定）**: VM 上で `claude setup-token` を実行すると、ブラウザ承認後に **長寿命トークン**（`sk-ant-oat...`）が出力されます。これを `CLAUDE_CODE_OAUTH_TOKEN` として渡します。

  ```bash
  conoha server ssh buzz-sample     # VM に入り
  claude setup-token                # → sk-ant-oat... を控える
  ```

- **API キー（フォールバック）**: `ANTHROPIC_API_KEY=... ./scripts/agent-up.sh`（console.anthropic.com のキー）。

::: warning なぜトークンを明示的に渡すのか（実測 2026-07-25）
対話的 `claude login`/`setup-token` で作られる資格はログインセッションにのみ存在し、**systemd から起動する `buzz-acp` → `claude-agent-acp` → `claude` からは見えません**（対話シェルでは `claude auth status` が `loggedIn:true` でも、systemd 環境では `false`）。そのため `CLAUDE_CODE_OAUTH_TOKEN` を明示的に env へ渡す必要があります。
:::

::: warning トークンの取り違えに注意
ブラウザ側に出る **認証コード** ではなく、`setup-token` が **最後に出力するトークン**（`sk-ant-oat...`）を使います。誤った値だと `claude auth status` は `loggedIn:true` に見えても、実 API 呼び出しが `401 Invalid bearer token` になります。`claude -p "reply READY"` が `READY` を返せば有効です。
:::

::: tip 機密をシェル履歴に残したくない場合
`CLAUDE_CODE_OAUTH_TOKEN=... ./scripts/agent-up.sh` のように機密をコマンド行に置くとローカルのシェル履歴に残ります。VM の root-only ファイルへ直接追記してから再起動してください。

```bash
printf 'CLAUDE_CODE_OAUTH_TOKEN=%s\n' 'sk-ant-oat...' >> /root/.buzz-agent.env
systemctl restart buzz-acp
```
:::

## `@mention` の実証

`verify.sh --agent` は、**偽陰性対照**（存在しないメンションには応答しないこと）を先に確認してから、オーナーが `@agent` にメンションして応答が返ることを検証します。手で確かめる場合は、オーナーの環境で `buzz` CLI から投稿します。

```bash
# オーナーとしてメンション（エージェントの表示名は `agent`）
buzz messages send --channel <channel_id> "@agent 自己紹介して。何ができる？"
# 少し待ってから取得
buzz messages get --channel <channel_id>
# → エージェントの pubkey で content が返っていれば成功
```

::: tip エージェント名とゲート
`@mention` はエージェントのプロフィール表示名（`buzz users set-profile --name agent`）で解決されます。著者ゲートは `BUZZ_ACP_RESPOND_TO=allowlist` にオーナー pubkey を登録して有効化します（既定の `owner-only` は `BUZZ_ACP_AGENT_OWNER` 未設定だと無言破棄になるため、本サンプルは allowlist + owner を明示）。また `buzz-acp` の `--agent-command` 既定は `goose` なので、Claude では `BUZZ_ACP_AGENT_COMMAND=claude-agent-acp` かつ `BUZZ_ACP_AGENT_ARGS=`（空）を設定します。
:::

## デスクトップ GUI（任意）で使う

`buzz` CLI の代わりに GUI を使いたい場合は、上流のデスクトップアプリ（Tauri）を使います。**ビルド不要** — [GitHub Releases](https://github.com/block/buzz/releases) に各 OS のプリビルドがあります（Windows は `Buzz_<ver>_x64-setup_alpha-unsigned.exe`。未署名 alpha のため SmartScreen は「詳細情報 → 実行」で回避。WebView2 ランタイムが必要）。

1. **identity key**: 「use existing key」を選び、このリレーのオーナー鍵を入れます。オーナー鍵は hex 保存なので nsec(bech32) に変換して貼り付けます。

   ```bash
   python3 scripts/hex2nsec.py "$(cat .secrets/owner.nsec)"   # nsec1... を出力（NIP-19 ベクタで検証済み）
   ```

   これでオーナー（リレー所有者・`demo` チャンネル参加・エージェント allowlist）として GUI にログインでき、GUI から `@agent` に話せます。**オーナー鍵はマスター鍵。共有しないこと。**
2. **"Set up your agent harnesses" 画面** は、この PC 上でローカルにエージェントを動かすためのものです。エージェントは VM 上で常駐しているので **「Skip for now」で構いません**。
3. **community / relay の追加**: リレー URL `wss://<ip-dashes>.sslip.io`（`.secrets/fqdn` の値）を登録すると `demo` チャンネルが見えます。

::: tip オーナー鍵を GUI に置きたくない場合
GUI で新規 identity を作り、その npub を `buzz-admin add-member` でメンバー登録 + systemd の `BUZZ_ACP_RESPOND_TO_ALLOWLIST` に追加 + `buzz channels join` すれば、その鍵でも `@agent` が応答します（オーナー鍵はサーバ/ローカルだけに残す）。
:::

## ハマりどころ

::: warning `/` が JSON を返す — 正常です
リレーの `/` は `Accept: application/nostr+json` に対し content-type `application/json` で NIP-11 relay info を返します（`supported_nips` に 42 を含む＝NIP-42 認証必須の閉リレー）。チャットは `buzz` CLI かデスクトップアプリで行います。
:::

::: warning `up.sh` が SSH 疎通で 5 分ループして失敗する
初回起動直後は sshd 未応答で `ssh-keyscan` が空を返し、`conoha server ssh` の host-key 検証に失敗します。本サンプルの `up.sh` は keyscan を疎通ループ内で毎回試行して回避済みです。
:::

::: warning Docker 導入で `Could not get lock`（apt）
初回起動の cloud-init/unattended-upgrades が apt ロックを保持するために起きます。`up.sh` は `cloud-init status --wait` の後に Docker を導入して回避済みです。
:::

::: warning relay が unhealthy で crash（`BUZZ_GIT_PACK_CACHE_PATH ... Permission denied`）
上流イメージは `/data/git` を持たず、Docker が `buzz-git-data` ボリュームを root 所有で作るため、relay（uid 1000 `buzz`）が git pack cache を作れません。`up.sh` はボリュームを `1000:1000` に chown してから起動して回避済みです（上流を patch しない）。
:::

::: warning デスクトップアプリで community 追加時に `Failed to fetch`
CORS です。アプリ（Tauri webview）の origin が relay の `BUZZ_CORS_ORIGINS` に無いと、NIP-11 の fetch がブラウザ側でブロックされます。`bootstrap-env.sh` は Tauri の標準 origin（`https://tauri.localhost` / `http://tauri.localhost` / `tauri://localhost`）を既定で許可済みです。別 origin のクライアントを使う場合は VM の `.env` の `BUZZ_CORS_ORIGINS` に追記して `./run.sh restart` で relay を再起動してください。**`*` は不可**（relay の CORS 層が panic します）— origin を明示列挙します。
:::

::: warning Let's Encrypt 429（`docker compose logs caddy`）
`sslip.io` は共有ドメインで LE 週次上限に当たることがあります。VM 上で原子的に再ブートストラップしてドメインだけ差し替える（秘密・鍵は保存される）か、`Caddyfile` を `tls internal` にして `CURL_K=-k ./scripts/verify.sh` で自己署名経路を明示します。詳細はリポジトリの README を参照してください。
:::

## 撤去

```bash
# サーバー・ブートボリューム・セキュリティグループまで破棄（時間課金を止める）
./scripts/down.sh
```

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の buzz](https://github.com/crowdy/conoha-cli-app-samples/tree/main/buzz)
- 解説記事: [ConoHa VPS に「人間 + AI エージェント」ワークスペース Buzz をセルフホスト（Qiita）](https://qiita.com/crowdy/items/40ad18327af811561280)
- Buzz 上流: [block/buzz](https://github.com/block/buzz)
- ACP アダプタ: [claude-agent-acp](https://www.npmjs.com/package/@agentclientprotocol/claude-agent-acp) / [Claude Code](https://github.com/anthropics/claude-code)（`claude` CLI, `setup-token`）
- conoha-cli: [はじめに](/guide/getting-started)
- 関連サンプル:
  - [Outline (OIDC チーム Wiki)](/examples/outline) — 同じく自前で立てるチーム向けコラボレーション基盤
  - [Dokploy (PaaS)](/examples/dokploy) / [vCluster (仮想 k8s)](/examples/vcluster) — 本例と同じく `conoha server create` + スクリプトで完結する scripts 主体パターン
