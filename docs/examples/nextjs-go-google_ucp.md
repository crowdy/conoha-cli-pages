# Next.js + Go + Google UCP デプロイ

[Google の Universal Commerce Protocol (UCP)](https://developers.google.com/pay/api/universal-commerce-protocol/overview) は、AI エージェントが商品の閲覧からチェックアウトまでを自律的に行えるようにする、Google が提案するオープンな商取引プロトコルです。本例はこの UCP を実装したデモ用の花屋アプリで、Next.js 15（フロントエンド + UCP manifest ビューアとチェックアウトシミュレータを備えた UCP Inspector）、Go 1.23（API: manifest 配信・capability negotiation・チェックアウトセッション・モック決済）、PostgreSQL 17 の 3 層構成です。ConoHa VPS には proxy モード（blue/green + Let's Encrypt HTTPS）でデプロイし、外部に公開されるのは `frontend` のみです。

## 完成イメージ

- `https://<FQDN>` で UCP フラワーショップのトップページ（商品一覧）が表示される
- `/inspector` で UCP Inspector（manifest ビューア + チェックアウトシミュレータ）が動作する
- `/.well-known/ucp` で UCP manifest が JSON として返る
- `conoha app deploy` の blue/green 切り替えでダウンタイムなし更新、`api` と `db` は常時稼働し続ける

## 前提条件

- conoha-cli がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（`--for proxy` プリセット推奨、[サーバー管理](/guide/server#プリセット-for)）
- ドメインの DNS A レコードをサーバー IP に向けている（[DNS / TLS](/guide/dns-tls)）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）
- 本デモの決済処理はすべてモックのため、実際の Google API 資格情報は不要

## デプロイ手順

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/nextjs-go-google_ucp

# conoha.yml の hosts: を自分の FQDN に書き換える
$EDITOR conoha.yml
```

```yaml
name: nextjs-go-google-ucp
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - nextjs-go-google-ucp.example.com
web:
  service: frontend
  port: 3000
# `api` and `db` are marked as accessories: they're reached only from
# `frontend` over the internal compose network, so they stay alive
# across blue/green swaps — only `frontend` is duplicated per slot.
accessories:
  - api
  - db
```

```bash
conoha proxy boot --acme-email you@example.com myserver   # サーバーごとに1回

conoha app init myserver
conoha app deploy myserver
```

::: tip 設定ポイント
`frontend` が唯一のブラウザ到達可能サービスで、`api`（Go、`/health` でヘルスチェック）と `db`（PostgreSQL 17）は `accessories:` に指定されているため、compose 内部ネットワークからのみ到達できます。`conoha.yml` のコメントより:

> `api` and `db` are marked as accessories: they're reached only from
> `frontend` over the internal compose network, so they stay alive
> across blue/green swaps — only `frontend` is duplicated per slot.

compose.yml（抜粋。パスワードはこのドキュメントでは `${DB_PASSWORD:?required}` としてマスクしています。実際の compose.yml には固定値が入っているため、本番運用前に必ず変更してください）:

```yaml
services:
  api:
    build: ./api
    expose:
      - "8080"
    environment:
      - DATABASE_URL=postgres://appuser:${DB_PASSWORD:?required}@db:5432/appdb?sslmode=disable
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:17
    environment:
      - POSTGRES_DB=appdb
      - POSTGRES_USER=appuser
      - POSTGRES_PASSWORD=${DB_PASSWORD:?required}
    volumes:
      - db_data:/var/lib/postgresql/data
      - ./api/db/migrations:/docker-entrypoint-initdb.d
```

完全版は [`nextjs-go-google_ucp/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/nextjs-go-google_ucp/compose.yml) を参照してください。

デプロイ後のアプリ名は `conoha.yml` の `name: nextjs-go-google-ucp`（ハイフン）に正規化されるため、クローンしたディレクトリ／サンプルの slug が `nextjs-go-google_ucp`（アンダースコア）であっても、`conoha app status` / `conoha app logs` の表示や `--app-name` 指定はハイフン形の `nextjs-go-google-ucp` になります。

本デモの決済・チェックアウトはすべてモックで完結しており、実際の Google API キーやサービスアカウント資格情報は不要です。将来、実際の Google Pay / UCP 認証情報を組み込む場合は値を直接書き込まず `<GOOGLE_API_CREDENTIAL>` のようなプレースホルダーで管理してください（[Next.js proxy モードの制約](/examples/nextjs#環境変数を使う場合) により、`app env set` は現状 proxy デプロイには反映されないため、Dockerfile の `ENV` や compose の `environment:` / `env_file:` 経由で注入します）。
:::

## 動作確認

```bash
conoha app status myserver
conoha app logs myserver

curl https://nextjs-go-google-ucp.example.com/.well-known/ucp
curl https://nextjs-go-google-ucp.example.com/api/products
```

ブラウザで `https://nextjs-go-google-ucp.example.com` にアクセスすると花屋デモのトップページが、`/inspector` で UCP Inspector が表示されます。初回は Let's Encrypt 証明書発行に数十秒かかる場合があります。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の nextjs-go-google_ucp](https://github.com/crowdy/conoha-cli-app-samples/tree/main/nextjs-go-google_ucp)
- Google UCP: [Universal Commerce Protocol 概要](https://developers.google.com/pay/api/universal-commerce-protocol/overview)
- conoha-cli: [はじめに](/guide/getting-started)
- 関連サンプル:
  - [Next.js（プレーン構成）](/examples/nextjs) — バックエンドなしの Next.js 単体デプロイ
  - [Next.js + FastAPI + PostgreSQL](/examples/nextjs-fastapi-postgresql) — 同じ frontend/api/db 構成のリファレンス実装
