# Dify (AI ワークフロー) デプロイ

[Dify](https://dify.ai/) は RAG・チャットボット・エージェント・ワークフロー自動化を GUI で構築できる **セルフホスト AI アプリ基盤**です。LangSmith や Make.com と同じ"ノーコード/ローコード AI オーケストレーター"の領域に位置づけられますが、完全に自分のサーバーで動かせることが最大の特徴です。

このサンプルは Dify を **conoha-proxy 経由で 3 つの FQDN に公開**します: root FQDN (`dify-https.example.com`) は nginx のファンアウトルーター、`api.dify-https.example.com` は Dify の Flask API、`web.dify-https.example.com` は Dify の Next.js フロントエンドが直接 HTTPS で提供されます。3 つのサブドメインは全て `expose:` ブロックで `blue_green: true` 付きで登録されるため、`conoha app deploy` ごとにゼロダウンタイムでスロット切替されます。

Dify 自体は LLM を実行しません — OpenAI・Anthropic などの外部 API エンドポイント、または自前の vLLM や Ollama に対してリクエストをオーケストレーションするため、**GPU は不要**です。

::: tip 本例は proxy モード対応 (`conoha.yml` 同梱)
HTTPS 終端と blue/green スロット切替は conoha-proxy が担当します。3 つの `expose:` ブロックを使ったマルチ FQDN パターンについては [2. conoha.yml](#_2-conoha-yml) で詳しく解説します。
:::

::: info GPU は不要
Dify は LLM を自前で実行しません — モデルプロバイダー（OpenAI、Anthropic、vLLM、Ollama など）の API エンドポイントを呼び出すオーケストレーターです。CPU-only のフレーバー（`g2l-t-4` など、4GB RAM 以上）で十分動作します。
:::

## 完成イメージ

- `https://dify-https.example.com` にアクセスすると nginx 経由で Dify UI が表示される（旧来の URL 互換）
- `https://api.dify-https.example.com` に Dify Flask API が直接公開され、外部アプリからの API 呼び出しが可能
- `https://web.dify-https.example.com` に Dify Next.js フロントエンドが直接公開される（推奨入口）
- ブラウザからエージェント・ワークフロー・チャットボットをノーコードで構築できる
- 会話履歴・ナレッジベース・ワークフロー定義は PostgreSQL 16 に永続保存される

## アーキテクチャ

```
   ブラウザ ──HTTPS──► conoha-proxy (ACME Let's Enc)
   (3 FQDN)               │  (blue/green slots)
                           ├──→ nginx:80  (dify-https.example.com)
                           │       /api /console/api /v1 /files → api:5001
                           │       /                            → web:3000
                           ├──→ api:5001  (api.dify-https.example.com)
                           └──→ web:3000  (web.dify-https.example.com)

                         worker (accessory) ─┐
                         db     (accessory) ─┼─ 永続化・内部通信のみ
                         redis  (accessory) ─┘
```

| レイヤー | サービス | 技術 | blue/green |
|---|---|---|---|
| ルーター | `nginx` | nginx 1.27-alpine — パスベースファンアウト | yes（root FQDN） |
| API | `api` | langgenius/dify-api — Flask REST + ファイル管理 | yes（`api.` FQDN） |
| フロント | `web` | langgenius/dify-web — Next.js | yes（`web.` FQDN） |
| ワーカー | `worker` | dify-api（MODE=worker、Celery） | accessory のみ |
| DB | `db` | PostgreSQL 16-alpine | accessory のみ |
| キャッシュ | `redis` | Redis 7-alpine | accessory のみ |

## 前提条件

- conoha-cli **≥ v0.6.1** がインストール・ログイン済み（[はじめに](/guide/getting-started)）
  - v0.6.1 未満では `expose:` ブロックの blue/green スロットが proxy ターゲットとして登録されない既知の不具合があります
- **CPU フレーバー**（GPU 不要）— RAM は **`g2l-t-4`（4GB）以上を推奨**（Dify + PostgreSQL + Redis + Next.js 合計で約 3–4GB）（[サーバー管理](/guide/server)）
- **3 つの DNS A レコード**をサーバー IP に向けていること（[DNS / TLS](/guide/dns-tls)）:
  - `dify-https.example.com`、`api.dify-https.example.com`、`web.dify-https.example.com`
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）

## 1. compose.yml

完全版は [`dify-https/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/dify-https/compose.yml)。重要部分を抜粋します。

```yaml
services:
  nginx:
    image: nginx:1.27-alpine
    expose:
      - "80"           # No host port: conoha-proxy injects at deploy time
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on: [api, web]

  api:
    image: langgenius/dify-api:0.15.8
    environment:
      - MODE=api
      - DB_USERNAME=dify
      - DB_HOST=db
      - DB_PORT=5432
      - DB_DATABASE=dify
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - STORAGE_TYPE=local
      # SECRET_KEY / DB_PASSWORD / REDIS_PASSWORD / CONSOLE_API_URL /
      # APP_API_URL / SERVICE_API_URL / APP_WEB_URL come from env_file
      # (.env.server) — do NOT hardcode here (see conoha-cli#166).
    volumes:
      - dify_storage:/app/api/storage
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_started }

  worker:
    image: langgenius/dify-api:0.15.8
    environment:
      - MODE=worker
      - DB_HOST=db
      - REDIS_HOST=redis
      # See `api.environment` note re: env_file.
    volumes:
      - dify_storage:/app/api/storage

  web:
    image: langgenius/dify-web:0.15.8
    # CONSOLE_API_URL / APP_API_URL come from env_file (.env.server).
    # Baked into browser bundle — must point at api.dify-https.example.com.

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=dify
      - POSTGRES_PASSWORD=${DB_PASSWORD:?required}
      - POSTGRES_DB=dify
    volumes: [dify_db:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dify"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD:?required}
    volumes: [dify_redis:/data]

volumes:
  dify_storage:
  dify_db:
  dify_redis:
```

::: warning `expose` を `ports` にしないこと
proxy モードでは `expose:` を使ってコンテナ側ポートだけを宣言します。`ports:` で公開すると blue/green スロットが衝突します。詳しくは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。
:::

## 2. conoha.yml

```yaml
name: dify-https
# Replace with your own FQDNs before running `conoha app init`.
# This sample fronts THREE FQDNs:
#   - root: nginx (web UI fan-out)
#   - api.: Dify api directly (slot-aware)
#   - web.: Dify web (Next.js) directly (slot-aware)
hosts:
  - dify-https.example.com
web:
  service: nginx
  port: 80
  # nginx itself stays slot-aware so we keep the root FQDN swap behaviour.
  health:
    # nginx default config returns 200 on `/` once api/web are up; the
    # proxy default `/up` 404s.
    path: /
expose:
  # Dify api exposed on its own subdomain so the slot rotation actually
  # reaches the api container (pre-#54 layout had api as accessory and
  # only nginx slot-rotated).
  - label: api
    host: api.dify-https.example.com
    service: api
    port: 5001
    blue_green: true
    health:
      # Dify api Flask app registers `/health` (returns {"pong":"pong"}).
      path: /health
      # First-start runs DB migrations; give it room.
      unhealthy_threshold: 24
  # Dify web (Next.js) on its own subdomain. Stateless, blue_green:true.
  - label: web
    host: web.dify-https.example.com
    service: web
    port: 3000
    blue_green: true
    health:
      # Dify web is Next.js; root `/` returns 200 once compiled.
      # No dedicated `/api/health` route ships, so we fall back to `/`.
      path: /
      unhealthy_threshold: 24
# `worker` stays accessory: it's an internal-only service (no inbound
# HTTP), and per spec §1.3 "internal-only blue/green is deferred". This
# means worker code updates do NOT slot-rotate — see README's "既知の
# 制限" section for the residual.
accessories:
  - worker
  - db
  - redis
```

**root FQDN は nginx ファンアウト経由（slot-aware）:** `hosts:` と `web.service: nginx` の組み合わせにより、`dify-https.example.com` へのリクエストは conoha-proxy から nginx コンテナに転送されます。nginx は `/api`・`/console/api`・`/v1`・`/files` を `api:5001` に、残りの `/` を `web:3000` にプロキシします。nginx 自体が slot-aware なので root FQDN でもゼロダウンタイムで切替されます。

**`expose:` ブロックで `api.` と `web.` サブドメインを独立公開:** 各エントリが独立した HTTPS ルートを定義します。`api.dify-https.example.com` は `api` サービスの 5001 番ポートに直結し、`web.dify-https.example.com` は `web` サービスの 3000 番ポートに直結します。どちらも `blue_green: true` なので `conoha app deploy` のスロット切替が `api` / `web` コンテナに正しく届きます。`unhealthy_threshold: 24`（24 × 5 秒 = 120 秒）は Dify の初回起動時に DB マイグレーションが走るための猶予です — この値を下げると初回デプロイが unhealthy 判定で失敗します。

**`worker` は accessory のためスロット切替なし:** `worker` はバックグラウンドの Celery プロセスでインバウンド HTTP ポートを持ちません。conoha-cli spec §1.3「内部専用 blue/green は deferred」のため `accessories:` に残ります。**既知の残存制約**です — `worker` コードの変更を伴う更新ではデプロイ後に手動再起動が必要です（[ハマりどころ](#ハマりどころ) 参照）。

## 3. nginx 設定

完全版は [`dify-https/nginx.conf`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/dify-https/nginx.conf)。nginx が Dify の URL 名前空間を 2 つに分割するルーティング:

```nginx
server {
    listen 80;
    server_name _;
    client_max_body_size 15M;   # ナレッジベース PDF アップロード対応

    # Dify API 系パス → api コンテナ
    location /api        { proxy_pass http://api:5001; ... }
    location /console/api { proxy_pass http://api:5001; ... }
    location /v1         { proxy_pass http://api:5001; ... }
    location /files      { proxy_pass http://api:5001; ... }

    # それ以外 → Next.js フロントエンド
    location /           { proxy_pass http://web:3000; ... }
}
```

`/api`・`/console/api`・`/v1`・`/files` は Flask API (`api:5001`) 行き、`/` は Next.js フロントエンド (`web:3000`) 行きです。新しいサブドメイン構成では `api.` / `web.` へ直接アクセスするため、nginx を経由するのは root FQDN (`dify-https.example.com`) にアクセスした場合のみです。

## 4. .env (環境変数)

`conoha app env set` で以下の変数を設定します。`CONSOLE_API_URL` / `APP_API_URL` は **Next.js ビルド時にブラウザ向けバンドルに焼き込まれる**ため、正しい FQDN を設定しないとログイン後に `ERR_NAME_NOT_RESOLVED` が発生します。

| 変数 | 説明 |
|---|---|
| `SECRET_KEY` | アプリ署名鍵（必須）— `openssl rand -hex 32` で生成 |
| `DB_PASSWORD` | PostgreSQL パスワード（必須）|
| `REDIS_PASSWORD` | Redis パスワード（必須）|
| `CONSOLE_API_URL` | `https://api.dify-https.example.com`（ブラウザ側バンドルに焼き込み）|
| `APP_API_URL` | 同上 |
| `SERVICE_API_URL` | 同上 |
| `APP_WEB_URL` | `https://web.dify-https.example.com` |

## 5. デプロイ

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/dify-https

# conoha.yml の 3 つの FQDN（hosts[], expose[label=api].host, expose[label=web].host）を書き換える
$EDITOR conoha.yml

# DNS A レコードを 3 つ設定し伝播を確認（全て同じ VPS IP）
dig +short dify-https.example.com
dig +short api.dify-https.example.com
dig +short web.dify-https.example.com

conoha proxy boot --acme-email you@example.com myserver  # サーバーごとに 1 回
conoha app init myserver
conoha app env set myserver SECRET_KEY=$(openssl rand -hex 32) \
  DB_PASSWORD=$(openssl rand -base64 32) \
  REDIS_PASSWORD=$(openssl rand -base64 32) \
  CONSOLE_API_URL=https://api.dify-https.example.com \
  APP_API_URL=https://api.dify-https.example.com \
  SERVICE_API_URL=https://api.dify-https.example.com \
  APP_WEB_URL=https://web.dify-https.example.com
conoha app deploy myserver   # 初回は DB マイグレーションで 5–10 分
```

## 6. 動作確認

```bash
# api ヘルスチェック（{"pong":"pong"} が返れば起動完了）
curl -i https://api.dify-https.example.com/health

# web フロントエンド確認
curl -o /dev/null -s -w "%{http_code}\n" https://web.dify-https.example.com/

# root FQDN（nginx 経由）確認
curl -o /dev/null -s -w "%{http_code}\n" https://dify-https.example.com/
```

ブラウザで `https://web.dify-https.example.com` を開くと初回セットアップ画面が表示されます。`https://dify-https.example.com` でも nginx のロケーションルールにより同じ画面に到達できますが、新しいサブドメイン構成では `web.` を正規入口として扱うことを推奨します。

## 初期セットアップ

1. `https://web.dify-https.example.com` をブラウザで開く
2. 管理者メールアドレス・パスワードを入力してアカウント作成
3. 画面右上の設定アイコン → **「設定」** → **「モデルプロバイダー」** でプロバイダーを追加:
   - **OpenAI / Anthropic**: 各プロバイダーを選択して API キーを入力
   - **自前 vLLM / Ollama**: `OpenAI-API-compatible` を選択してエンドポイント URL を入力

::: tip モデルプロバイダーの API キーは Dify UI で設定する
OpenAI や Anthropic の API キーは `compose.yml` や `.env` には書きません。Dify のセキュリティモデルでは、モデルプロバイダーの認証情報は UI から入力し PostgreSQL に暗号化して保存されます。
:::

## カスタマイズ

- **モデルプロバイダーの変更**: 「設定 > モデルプロバイダー」から OpenAI・Anthropic・Gemini・Azure OpenAI・Mistral など多数のプロバイダーを追加できます。自前の [vLLM](/examples/vllm-gpu) や Ollama を組み合わせると API 費用ゼロで LLM バックエンドを運用できます。
- **Worker のスケールアップ**: `compose.yml` で `worker` の `replicas` を増やし `docker compose up -d worker` で手動反映（`worker` は accessory のため `app deploy` では反映されません）。
- **ナレッジベース / RAG**: PDF・Markdown・CSV をアップロードすると RAG パイプラインが構築できます（ファイルは `dify_storage` ボリューム）。Dify 0.15 以降はプラグインマーケットプレイスからの機能追加にも対応しています（「設定 > プラグイン」）。

## ハマりどころ

### 3 つの DNS A レコードが必要

**最もよくある詰まりポイント。** `api.dify-https.example.com` と `web.dify-https.example.com` の A レコードを忘れると Let's Encrypt の証明書発行が失敗し SSL エラーになります。3 つのサブドメインは全て**同じ VPS の IP アドレス**を向ければよいです。

```bash
# 伝播確認（3 つとも同じ IP が返ること）
dig +short dify-https.example.com
dig +short api.dify-https.example.com
dig +short web.dify-https.example.com
```

### `unhealthy_threshold: 24` は初回 DB マイグレーション用

`unhealthy_threshold: 24`（5 秒 × 24 回 = 120 秒）は Dify の `api` コンテナが初回起動時に `alembic upgrade head`（DB スキーママイグレーション）を実行するための待機時間です。マイグレーション完了まで `/health` は 200 を返さないため、この値を低くすると初回デプロイが unhealthy 判定で失敗します。マイグレーションが遅い場合は `conoha app logs myserver` でログを確認しながら値を増やしてください。

### `worker` は accessory のため自動デプロイされない

`worker` は `accessories:` に含まれているため `conoha app deploy` を実行しても **`worker` コンテナはスロット切替されません**。コード更新時は新スロットの `api` / `web` はコード変更を反映している一方 `worker` は旧コードのまま動き続けます。Dify のジョブ仕様変更を伴う更新では、デプロイ後に明示的に再起動してください:

```bash
ssh myserver -- 'docker compose -p dify-https-acc restart worker'
```

`internal-only blue/green` への対応は conoha-cli spec §1.3 の次期バッチで予定されています。

### モデルプロバイダーの API キーは Dify UI で設定する

OpenAI・Anthropic などの API キーは `compose.yml` や `.env` には書きません。Dify の UI「設定 > モデルプロバイダー」から入力し PostgreSQL に暗号化して保存されます。環境変数に `OPENAI_API_KEY` などを書いても Dify は参照しません。コンテナを再作成しても設定は `dify_db` ボリュームに残ります。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の dify-https](https://github.com/crowdy/conoha-cli-app-samples/tree/main/dify-https)
- 検証記: Qiita — *公開後にリンク追加*
- 公式: [dify.ai](https://dify.ai/) / [langgenius/dify](https://github.com/langgenius/dify)
- 関連サンプル:
  - [Ory Hydra + FastAPI (OAuth2)](/examples/hydra-python-api) — マルチサービス proxy パターン
  - [nginx リバースプロキシ](/examples/nginx-reverse-proxy) — nginx ファンアウトの基礎
  - [vLLM (OpenAI 互換, L4 GPU)](/examples/vllm-gpu) — Dify の LLM バックエンドとして組み合わせ可能
