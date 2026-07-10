---
layout: home
hero:
  name: ConoHa CLI
  text: ConoHa VPS3をコマンドラインから操作
  tagline: サーバー作成からアプリデプロイまで、すべてターミナルから
  image:
    src: /banner.svg
    alt: ConoHa CLI
  actions:
    - theme: brand
      text: はじめに
      link: /guide/getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/crowdy/conoha-cli
    - theme: alt
      text: HPC構築を相談（無料）
      link: /support
features:
  - title: かんたんインストール
    details: Go製のシングルバイナリ。ダウンロードしてすぐ使えます。
  - title: アプリデプロイ
    details: Dockerfileがあれば conoha app deploy の一発でデプロイ完了。
  - title: フル機能
    details: サーバー・ネットワーク・DNS・ストレージ・ロードバランサーまで全API対応。
---

## 何が作れる？

[crowdy/conoha-cli-app-samples](https://github.com/crowdy/conoha-cli-app-samples) には **50+ のサンプル** が揃っています。すべて `git clone` → `conoha app deploy` だけで HTTPS 付きで起動します。

### AI / GPU

L4 GPU フレーバー (`g2l-t-c20m128g1-l4`) + `conoha app deploy` だけ。

| サンプル | できること |
|---|---|
| [ollama-webui-gpu](/examples/ollama-webui-gpu) | Gemma 4 など大規模 LLM をブラウザでチャット (Open WebUI) |
| [vllm-gpu](/examples/vllm-gpu) | Qwen2.5-7B AWQ で **OpenAI 互換 API**、SSE ストリーミング対応 |
| [hunyuan3d-gpu](/examples/hunyuan3d-gpu) | 画像から 3D モデル (GLB) を生成 (Tencent Hunyuan3D-2) |
| [fish-speech-tts-gpu](/examples/fish-speech-tts-gpu) | 音声クローニング付き TTS + Go CLI クライアント |
| [dify-https](/examples/dify-https) | AI ワークフロープラットフォーム (Dify) |
| [voice-agent-conoha-l4](/examples/voice-agent-conoha-l4) | WebRTC + faster-whisper + Qwen2.5 + Style-BERT-VITS2 で自前音声エージェント |

### セルフホスティング SaaS

外部 SaaS を自前で。OIDC 認証や DB は `accessories:` に書くだけ。

| サンプル | できること |
|---|---|
| [gitea](https://github.com/crowdy/conoha-cli-app-samples/tree/main/gitea) | OIDC 認証付きの自前 Git ホスティング |
| [supabase-selfhost](/examples/supabase-selfhost) | Supabase をフルセット (Studio + Kong + GoTrue + PostgREST) |
| [immich](/examples/immich) | Google フォト代替の写真バックアップ |
| [outline](/examples/outline) | Notion 風チームナレッジベース (OIDC 認証付き) |
| [ghost-blog](https://github.com/crowdy/conoha-cli-app-samples/tree/main/ghost-blog) | Ghost + MySQL でブログ運営 |
| [plausible-analytics](/examples/plausible-analytics) | プライバシー重視の Web アナリティクス |

### 開発インフラ・運用

| サンプル | できること |
|---|---|
| [coolify](/examples/coolify) / [dokploy](/examples/dokploy) | セルフホスティング PaaS (Heroku/Vercel 代替) |
| [github-actions-runner](/examples/github-actions-runner) | セルフホスト Actions Runner (GPU 利用も可) |
| [github-pr-doc-reviewer](/examples/github-pr-doc-reviewer) | PR の spec / ADR / glossary 整合性を Claude が自動レビュー |
| [prometheus-grafana](/examples/prometheus-grafana) | メトリクス監視・可視化スタック |
| [quickwit-otel](/examples/quickwit-otel) | OpenTelemetry ログ・トレース基盤 + Grafana |
| [uptime-kuma](/examples/uptime-kuma) | セルフホスティング稼働監視 |

### フルスタックウェブ

| サンプル | できること |
|---|---|
| [nextjs-fastapi-postgresql](/examples/nextjs-fastapi-postgresql) | Next.js + FastAPI + PostgreSQL の CRUD ひな型 |
| [nextjs-fastapi-clerk-stripe](/examples/nextjs-fastapi-clerk-stripe) | Clerk 認証 + Stripe サブスクの SaaS デモ (マルチサブドメイン) |
| [rails-mercari](/examples/rails-mercari) | Rails で作るメルカリ風マーケットプレイス (OIDC 認証 + Sidekiq) |
| [django-postgresql](https://github.com/crowdy/conoha-cli-app-samples/tree/main/django-postgresql) | Django ORM + 管理画面 |
| [spring-boot-postgresql](https://github.com/crowdy/conoha-cli-app-samples/tree/main/spring-boot-postgresql) | Spring Boot + JPA CRUD |
| [bun-elysia-chat](https://github.com/crowdy/conoha-cli-app-samples/tree/main/bun-elysia-chat) | Bun + Elysia の WebSocket リアルタイムチャット |
| [hono-drizzle-postgresql](https://github.com/crowdy/conoha-cli-app-samples/tree/main/hono-drizzle-postgresql) | Hono + Drizzle REST API + Swagger UI |

### ちょっと変わったもの

| サンプル | できること |
|---|---|
| [dns-server](https://github.com/crowdy/conoha-cli-app-samples/tree/main/dns-server) | PowerDNS + CRUD API で個人 DNS ホスティング |
| [line-api-mock](https://github.com/crowdy/conoha-cli-app-samples/tree/main/line-api-mock) | LINE Messaging API のローカル開発用モック (Webhook エミュレーション) |
| [slurm-rest-api](https://github.com/crowdy/conoha-cli-app-samples/tree/main/slurm-rest-api) | Slurm 単一ノードクラスター + REST API (JWT 認証) |
| [nextjs-go-google_ucp](https://github.com/crowdy/conoha-cli-app-samples/tree/main/nextjs-go-google_ucp) | Google UCP デモ (AI エージェントコマース) |
| [hydra-python-api](https://github.com/crowdy/conoha-cli-app-samples/tree/main/hydra-python-api) | Ory Hydra で OAuth2 認可サーバーを自前運用 |

→ [全 50+ サンプルを一覧する](https://github.com/crowdy/conoha-cli-app-samples)

## 5ステップでデプロイ

### 1. インストール

```bash
brew install crowdy/tap/conoha-cli   # 実行ファイルは conoha
conoha version
```

### 2. ログイン

```bash
conoha auth login
```
```
✓ Logged in successfully
```

### 3. キーペアを作成

```bash
conoha keypair create my-key
```
```
✓ Keypair my-key created
```

### 4. サーバーを作成

```bash
conoha server create --name my-server \
  --flavor g2l-t-c2m1d100 --image ubuntu-24.04 \
  --key-name my-key --security-group IPv4v6-SSH --wait
```
```
✓ Server my-server is ACTIVE (163.xx.xx.xx)
```

### 5. アプリをデプロイ

```bash
conoha app deploy my-server
```
```
✓ App is running at http://163.xx.xx.xx:3000
```

::: tip 詳しくは
[クイックスタート](/guide/quickstart) で実際の出力を見ながら試せます。
:::

## 構築サポート（無料）

ConoHa で **HPC / GPU / k8s などの大規模インフラ** を組みたいけれど、どう始めればいいか分からない——そんなときは、**conoha-cli を作った本人** が無料でお手伝いします。

conoha-cli の OSS 活動として、実戦で使ってもらいながら事例を増やすのが目的です。

→ [構築サポートについて詳しく見る](/support)
