# hono-drizzle-postgresql デプロイ

Hono と Drizzle ORM を使ったブックマーク管理 REST API を ConoHa VPS にデプロイする手順です。OpenAPI 定義から Swagger UI が自動生成されるため、API ドキュメントを別途書く必要がありません。本例では proxy モード（blue/green + Let's Encrypt HTTPS）で公開します。

## 完成イメージ

- REST API が `https://<あなたの FQDN>/api/bookmarks` で TLS 付きアクセス可能
- `https://<あなたの FQDN>/doc` で Swagger UI から API を直接試せる
- PostgreSQL は accessory として稼働し、blue/green デプロイのたびに再起動されない
- `conoha app deploy` でコード更新、drain 窓内なら `conoha app rollback` で即座に戻せる

## 前提条件

- ConoHa CLI がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[`--for proxy` プリセット推奨](/guide/server#プリセット-for)）
- ドメイン（例: `hono-drizzle-postgresql.example.com`）を用意し、A レコードを VPS の IP に向けている（[DNS / TLS](/guide/dns-tls)）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）

## デプロイ手順

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples.git
cd conoha-cli-app-samples/hono-drizzle-postgresql

# conoha.yml の hosts: を自分の FQDN に書き換える
$EDITOR conoha.yml

# 初期化（初回のみ）
conoha app init <サーバー名>

# デプロイ
conoha app deploy <サーバー名>
```

`web`（Hono API）はポート `3000` で待ち受け、conoha-proxy が TLS 終端して転送します。`db`（PostgreSQL）は外部に公開されません。

## compose.yml（抜粋）

完全版は [`hono-drizzle-postgresql/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/hono-drizzle-postgresql/compose.yml)。`DATABASE_URL` と `POSTGRES_PASSWORD` はこのドキュメントでは `${POSTGRES_PASSWORD:?required}` としてマスクしています（実際の compose.yml には値が入っているため、本番運用前に必ず変更してください）。

```yaml
services:
  web:
    build: .
    expose:
      - "3000"
    environment:
      - DATABASE_URL=postgres://${POSTGRES_USER:?required}:${POSTGRES_PASSWORD:?required}@db/${POSTGRES_DB:?required}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:17-alpine
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:?required}
      - POSTGRES_DB=${POSTGRES_DB:?required}
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  db_data:
```

::: tip 設定ポイント: accessories と Swagger UI

`conoha.yml` では `db` が `accessories:` に指定されています（サンプルで設定済み）。該当箇所のコメントを引用します。

```yaml
# `db` is marked as an accessory so it's started once and kept alive
# across blue/green swaps — only `web` is duplicated per slot.
accessories:
  - db
```

つまり `db` は compose 内部ネットワークからのみ到達可能な常駐サービスで、`web` が blue/green でスロット切替されてもコンテナは再作成されません。DB はスロット間で共有されるため、デプロイのたびにデータが失われる心配はありません。

Swagger UI は `web`（Hono アプリ）の `/doc` パスで提供されており、ソース側では `@hono/zod-openapi` が OpenAPI 定義から自動生成しています。追加の設定は不要です。
:::

## 動作確認

```bash
# ステータス
conoha app status <サーバー名>

# ブックマーク一覧を取得
curl https://<あなたの FQDN>/api/bookmarks

# ヘルスチェック
curl https://<あなたの FQDN>/health
```

ブラウザで `https://<あなたの FQDN>/doc` にアクセスすると Swagger UI が表示され、`/api/bookmarks` の各エンドポイント（GET / POST / PUT / DELETE）をブラウザ上から試せます。

## 関連リンク

- [Recipe: hono-drizzle-postgresql](https://github.com/crowdy/conoha-cli-app-samples/tree/main/hono-drizzle-postgresql)
- [Hono 公式ドキュメント](https://hono.dev/)
- [Drizzle ORM 公式ドキュメント](https://orm.drizzle.team/)
- [Next.js](/examples/nextjs)（proxy モードの基本的な流れ）
- [nextjs-fastapi-postgresql](/examples/nextjs-fastapi-postgresql)（複数 accessory 構成の詳細解説）
