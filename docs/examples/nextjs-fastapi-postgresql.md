# Next.js + FastAPI + PostgreSQL デプロイ

Next.js 16（App Router / Server Components）+ FastAPI + PostgreSQL 17 によるフルスタック企業コーポレートサイトのサンプルです。ニュース記事の CRUD（作成・一覧・詳細・編集・削除）を備えた「フロントエンド + API + DB」の 3 層構成で、conoha-cli のフルスタックサンプルの中で最も基本的な**リファレンス・テンプレート**という位置づけです。`conoha app deploy` 一発でサーバー側の Docker マルチステージビルドがフロント・バックエンド両方をビルドするため、ローカルに Node.js や Python のツールチェインは不要です。

公開ポートは **80（frontend）のみ**。ブラウザからの `/api/*` 呼び出しは Next.js の `rewrites` によって同一オリジンで `backend:8000` へ転送されるため、API 用のサブドメインも CORS 設定も不要です。この「単一 FQDN・同一オリジン」構成は、SaaS 拡張版の [nextjs-fastapi-clerk-stripe](/examples/nextjs-fastapi-clerk-stripe) や、より重量級の [rails-mercari](/examples/rails-mercari) の土台にもなっています。

::: tip 本例は proxy モード対応（`conoha.yml` 同梱）
`expose:` ブロックは使わず、1 FQDN・1 DNS A レコードで完結します。`backend` と `db` は `accessories:` に指定され、compose 内部ネットワークからのみ到達可能です。詳しくは [1. conoha.yml](#_1-conoha-yml) で解説します。
:::

## 完成イメージ

- `https://<FQDN>` にコーポレートサイト風のトップページが表示される（ヒーロー / サービス一覧 / ニュース / 企業情報 / 採用 CTA セクション構成）
- `/news` でニュース一覧、`/news/{id}` で詳細を表示
- `/news/new` で新規投稿、`/news/{id}/edit` で編集、削除は確認ダイアログ付き — 一覧・詳細・作成・更新・削除の CRUD がすべて動作する
- `curl https://<FQDN>/api/posts` が同一オリジンで応答する（`/api/health` でヘルスチェック可能）
- `conoha app status` で `frontend` / `backend` / `db` の 3 コンテナすべてが `Up (healthy)` になっている

## アーキテクチャ

```
ブラウザ → :80 → [frontend (Next.js)]
                      │ rewrites /api/* → backend:8000/api/*
                      ▼
                  [backend (FastAPI)]
                      │ asyncpg
                      ▼
                  [db (PostgreSQL 17)]
```

公開ポートは **80（frontend）のみ**。`backend:8000` と `db:5432` は compose 内部ネットワークからのみ到達可能で、外部には一切露出しません。

| レイヤー | サービス | 技術 | blue/green |
|---|---|---|---|
| フロントエンド | `frontend` | Next.js 16（App Router / Server Components）+ React 19 + Tailwind CSS v4 | yes（`web` サービス） |
| API | `backend` | FastAPI + Uvicorn（SQLAlchemy async + asyncpg、Pydantic バリデーション） | accessory のみ |
| データベース | `db` | PostgreSQL 17 | accessory のみ |

API エンドポイントは `GET /api/health`、`GET|POST /api/posts`、`GET|PUT|DELETE /api/posts/{id}` の 6 本。ページは `/`・`/news`・`/news/new`・`/news/{id}`・`/news/{id}/edit` の 5 種類です。

## 前提条件

- conoha-cli がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- ConoHa VPS3 アカウント、SSH キーペア設定済み
- CPU フレーバー（GPU 不要）— **`g2l-t-2`（2GB）で十分動作**（[サーバー管理](/guide/server)）
- **1 つの DNS A レコード**をサーバー IP に向けていること（[DNS / TLS](/guide/dns-tls)）: `nextjs-fastapi-postgresql.example.com`
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）
- テーブルは FastAPI 起動時に自動作成されます（Alembic などのマイグレーションツールは不要）

## 1. conoha.yml

```yaml
name: nextjs-fastapi-postgresql
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - nextjs-fastapi-postgresql.example.com
web:
  service: frontend
  port: 3000
# `backend` and `db` are marked as accessories: they're reached only
# from `frontend` over the internal compose network, so they stay alive
# across blue/green swaps — only `frontend` is duplicated per slot.
accessories:
  - backend
  - db
```

`web.service` に `frontend` を指定するのは、ブラウザから直接到達できるのは Next.js だけだからです。`backend`（FastAPI）と `db`（PostgreSQL）は `accessories:` に入れることで、compose 内部ネットワークからのみ到達可能になり、外部には公開されません。

**blue/green と accessory の関係：** `accessories:` に指定したサービスは blue/green スロット切替の対象外です。デプロイのたびに新しいスロットへ立ち上がるのは `frontend` のみで、`backend` と `db` は常に同じコンテナが稼働し続けます。DB はスロット間で共有されるため、データが失われることはありません。

## 2. compose.yml（抜粋）

完全版は [`nextjs-fastapi-postgresql/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/nextjs-fastapi-postgresql/compose.yml)。重要部分を抜粋します（`POSTGRES_PASSWORD` と `DATABASE_URL` 内のパスワードはこのドキュメントでは `${POSTGRES_PASSWORD:?required}` としてマスクしています。実際の compose.yml には固定値が入っているため、本番運用前に必ず変更してください — 詳しくは [4. 環境変数](#_4-環境変数) を参照）。

```yaml
services:
  frontend:
    build: ./frontend
    # No host-side port: conoha-proxy injects a randomly-bound
    # 127.0.0.1:0:3000 mapping at deploy time so two slots (blue/green)
    # can coexist. Publishing explicitly here would conflict.
    expose:
      - "3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost/api
    depends_on:
      backend:
        condition: service_healthy

  backend:
    build: ./backend
    expose:
      - "8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://appuser:${POSTGRES_PASSWORD:?required}@db:5432/appdb
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"]
      interval: 5s
      timeout: 5s
      retries: 5

  db:
    image: postgres:17
    environment:
      - POSTGRES_DB=appdb
      - POSTGRES_USER=appuser
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:?required}
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser -d appdb"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  db_data:
```

::: warning `frontend` に `ports:` を書かないこと
`frontend` は `expose: ["3000"]` のみで宣言されています。proxy モードでは conoha-proxy がデプロイ時にランダムなホストポートを注入し、blue/green の 2 スロットを共存させます。`ports:` で固定ポートを公開するとスロット同士が衝突します。`backend`・`db` も同様に `expose:` のままにし、絶対に `ports:` で外部公開しないでください。
:::

## 3. ルーティングの仕組み（`next.config.ts`）

同一オリジン・CORS 不要を実現しているのは Next.js の `rewrites` です。

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://backend:8000/api/:path*" },
    ];
  },
};
```

ブラウザ / SSR はいずれも Next.js のオリジン（`<FQDN>`）に対して `/api/...` を呼び出します。この `rewrites` 設定により、Next.js サーバー自身が `http://backend:8000` へリクエストを転送します。API 用のサブドメインを別途用意する必要も、`backend` 側に CORS ミドルウェアを追加する必要もありません。`compose.yml` の `NEXT_PUBLIC_API_URL=http://localhost/api` はこの同一オリジン rewrite に依存しています（詳しくは [ハマりどころ](#ハマりどころ) を参照）。

## 4. 環境変数

このサンプルには `.env.example` は同梱されていません。`compose.yml` に直接環境変数が書き込まれており、デプロイ時に `.env.server` で上書きできます。

| 変数 | 説明 |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL パスワード（必須）— compose.yml では固定値が入っているため、本番運用前に `$(openssl rand -base64 32)` などで生成した値に置き換える |

::: warning README と compose.yml でパスワード変数名が食い違っている（頻出ミス）
アップストリームの README は「本番環境では `DB_PASSWORD` を `.env.server` で管理する」と記載していますが、実際の `compose.yml` は `POSTGRES_PASSWORD` を使い、さらに `backend` の `DATABASE_URL=postgresql+asyncpg://appuser:${POSTGRES_PASSWORD:?required}@db:5432/appdb` にも同じ値を埋め込んでいます。`DB_PASSWORD` という変数名で上書きしても `db` サービスのパスワードは変わりません。本番でパスワードを変更する際は **`POSTGRES_PASSWORD` と `DATABASE_URL`（`backend` サービスの環境変数）の両方**を同時に更新してください。片方だけ変更すると `backend` が古いパスワードで `db` に接続を試み、認証エラーで起動しなくなります。
:::

## 5. デプロイ

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/nextjs-fastapi-postgresql

# conoha.yml の hosts: を自分の FQDN に書き換える
$EDITOR conoha.yml
```

```bash
# 伝播確認
dig +short nextjs-fastapi-postgresql.example.com
```

```bash
conoha proxy boot --acme-email you@example.com myserver   # サーバーごとに 1 回

conoha app init myserver
conoha app deploy myserver
```

テーブル作成は FastAPI 起動時に自動実行されます（Alembic 不要）。`backend` と `db` は accessory のため blue/green 切替時も再起動されず、`frontend` のみが新スロットに立ち上がります。

## 6. 動作確認

```bash
# コンテナ状態を確認（frontend / backend / db が全て Up (healthy) であること）
conoha app status myserver

# ログを確認
conoha app logs myserver

# API をテスト（同一オリジンで frontend → backend にルーティングされる）
curl https://nextjs-fastapi-postgresql.example.com/api/health
curl https://nextjs-fastapi-postgresql.example.com/api/posts
curl -X POST https://nextjs-fastapi-postgresql.example.com/api/posts \
  -H 'Content-Type: application/json' \
  -d '{"title":"テスト投稿","body":"本文です。"}'
```

ブラウザで `https://nextjs-fastapi-postgresql.example.com` にアクセスするとコーポレートサイト風のトップページが表示されます。`/news` から一覧、`/news/new` から新規投稿、`/news/{id}/edit` から編集ができ、削除は確認ダイアログ付きで一連の CRUD が完結します。初回は Let's Encrypt 証明書発行に数十秒かかる場合があります。

## カスタマイズ

- **バックエンド**: `backend/models.py` にモデルを追加し `backend/main.py` にエンドポイントを追加、`backend/schemas.py` でバリデーションルールを変更
- **フロントエンド**: `frontend/app/page.tsx` でトップページのセクションを編集、`frontend/app/components/` にコンポーネントを追加、`frontend/app/globals.css` の `@theme` でカラーテーマを変更
- **ニュース機能の拡張**: `frontend/app/news/` にカテゴリ機能などを追加

## ハマりどころ

### API のベース URL — ビルド時 vs 実行時

`NEXT_PUBLIC_API_URL=http://localhost/api` は Next.js の**サーバーサイド** rewrite（`next.config.ts` の `rewrites()`）を経由することを前提とした値です。Server Components からのフェッチや SSR は問題なく動作しますが、**ブラウザ側の JS から直接この値を使って fetch すると失敗します** — ブラウザにとっての `localhost` はユーザー自身の PC であり、デプロイ先のサーバーではないためです。クライアントサイドの fetch を追加する場合は、相対パス `/api/...` を使うか、CORS を追加した上で正しい公開 URL を使う設計に変更してください。

### `output: "standalone"` を外すと起動できない

`frontend/next.config.ts` の `output: "standalone"` はビルド後の実行に必須です。これを外すと `.next/standalone/server.js` が生成されず、Dockerfile の起動コマンド（`node server.js`）が失敗します。

### スキーマ変更は自動適用されない（Alembic 未導入）

DB マイグレーションは `backend` の `lifespan` で起動時に `Base.metadata.create_all` を実行するのみです。これは**存在しないテーブルの作成**しか行わず、既存テーブルへのカラム追加・変更などのスキーマ変更は反映されません。本番でスキーマ変更が必要になったら Alembic の導入を検討してください。

### blue/green + DB — `backend`・`db` はスロット間で共有

`backend` と `db` は `accessories:` のため blue/green スイッチのたびに再起動されません。再起動・再作成されるのは `frontend` のみです。DB は 2 つのスロット間で共有される単一インスタンスなので、複数バージョンの `frontend` が同時に同じ DB へ書き込む可能性がある点に注意してください。

### CORS ミドルウェアなし（同一オリジン前提）

`backend` にはあえて CORS ミドルウェアが入っていません。フロントとバックエンドが同一オリジン（同じ FQDN のポート 80）で完結する設計だからです。API をサブドメインに分離したり、別オリジンのフロントエンドから叩く構成に変更する場合は、FastAPI 側に CORS 設定を追加する必要があります。

### README と compose.yml のパスワード変数名の食い違い

[4. 環境変数](#_4-環境変数) で解説した通り、README は `DB_PASSWORD` の上書きを案内していますが、実際に使われているのは `POSTGRES_PASSWORD` と、それを埋め込んだ `DATABASE_URL` です。パスワードを変更する際は両方を更新し、upstream の compose.yml に入っている固定パスワードを本番環境にそのまま出さないようにしてください。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の nextjs-fastapi-postgresql](https://github.com/crowdy/conoha-cli-app-samples/tree/main/nextjs-fastapi-postgresql)
- Next.js: [nextjs.org](https://nextjs.org/) / [Rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)
- FastAPI: [fastapi.tiangolo.com](https://fastapi.tiangolo.com/)
- conoha-cli: [はじめに](/guide/getting-started)
- 関連サンプル:
  - [nextjs-fastapi-clerk-stripe (SaaS 拡張版)](/examples/nextjs-fastapi-clerk-stripe) — 認証・課金を追加した SaaS 版
  - [rails-mercari (重量級フルスタックのペア)](/examples/rails-mercari)
  - [Next.js（プレーン構成）](/examples/nextjs) — バックエンドなしの Next.js 単体デプロイ
