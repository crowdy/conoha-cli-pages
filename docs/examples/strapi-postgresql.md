# Strapi + PostgreSQL デプロイ

API ファーストのヘッドレス CMS「Strapi」と PostgreSQL を ConoHa VPS に proxy モード（blue/green + Let's Encrypt HTTPS）でデプロイする手順です。コンテンツ API を GUI で定義し、Next.js や SvelteKit などのフロントエンドから利用できます。

## 完成イメージ

- Strapi の管理画面 / API が `https://<あなたの FQDN>/admin` `https://<あなたの FQDN>/api/...` で TLS 付きアクセス可能
- PostgreSQL は accessory として稼働し、blue/green 切替時も再起動されない
- `conoha app deploy` でコード更新、drain 窓内なら `conoha app rollback` で即座に戻せる

## 前提条件

- ConoHa CLI がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- 公開したい FQDN の DNS A レコードがサーバーの IP を指している（[DNS / TLS](/guide/dns-tls)）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）

## デプロイ手順

```bash
# 1. サンプルを取得
git clone https://github.com/crowdy/conoha-cli-app-samples.git
cd conoha-cli-app-samples/strapi-postgresql
```

`conoha.yml` の `hosts:` を自分の FQDN に書き換えます。

```yaml
name: strapi-postgresql
hosts:
  - strapi-postgresql.example.com   # ここを自分の FQDN に変更
web:
  service: strapi
  port: 1337
accessories:
  - db
```

```bash
# 2. アプリ登録
conoha app init <サーバー名>

# 3. シークレットを生成して環境変数に設定（必須）
conoha app env set <サーバー名> \
  DB_PASSWORD=$(openssl rand -base64 32) \
  APP_KEYS=$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32) \
  API_TOKEN_SALT=$(openssl rand -base64 32) \
  ADMIN_JWT_SECRET=$(openssl rand -base64 32) \
  JWT_SECRET=$(openssl rand -base64 32) \
  TRANSFER_TOKEN_SALT=$(openssl rand -base64 32)

# 4. デプロイ
conoha app deploy <サーバー名>
```

::: tip 設定ポイント
**シークレットは必ず生成する** — `compose.yml`（[全文](https://github.com/crowdy/conoha-cli-app-samples/blob/main/strapi-postgresql/compose.yml)）は次のように必須値を参照します（抜粋・簡略化）。

```yaml
services:
  strapi:
    environment:
      - DATABASE_HOST=db
      - DATABASE_PASSWORD=${DB_PASSWORD:?required}
      - APP_KEYS=${APP_KEYS:?required}
      - API_TOKEN_SALT=${API_TOKEN_SALT:?required}
      - ADMIN_JWT_SECRET=${ADMIN_JWT_SECRET:?required}
      - JWT_SECRET=${JWT_SECRET:?required}
      - TRANSFER_TOKEN_SALT=${TRANSFER_TOKEN_SALT:?required}
  db:
    environment:
      - POSTGRES_PASSWORD=${DB_PASSWORD:?required}
```

上記手順のように `openssl rand -base64 32` などで生成した値を必ず `conoha app env set` で渡してください。未設定のままデプロイすると、管理画面の JWT や API トークンが推測可能な値になり危険です。

**`db` は accessory** — `conoha.yml` には次のコメントがあります:

> `db` is marked as an accessory so it's started once and kept alive
> across blue/green swaps — only `strapi` is duplicated per slot.

つまり PostgreSQL への接続（`DATABASE_HOST=db` 経由、例 `postgres://strapi:<PASSWORD>@db:5432/strapi`）とそのデータは blue/green 切替をまたいで保持され、`strapi` サービスだけがスロットごとに複製されます。
:::

## 動作確認

ブラウザで `https://<あなたの FQDN>/admin` にアクセスし、初回管理者アカウントを作成します。

```bash
conoha app status <サーバー名>
conoha app logs <サーバー名>
```

## 関連リンク

- [Recipe: strapi-postgresql](https://github.com/crowdy/conoha-cli-app-samples/tree/main/strapi-postgresql)
- [Strapi ドキュメント](https://docs.strapi.io/)
