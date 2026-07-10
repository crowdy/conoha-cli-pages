# Plausible Analytics デプロイ

[Plausible Analytics](https://plausible.io/) はプライバシー重視の軽量 Web アナリティクスです。Cookie 不要・GDPR/ePrivacy 準拠で、Google Analytics の代替として使えます。本例では proxy モード（blue/green + Let's Encrypt HTTPS）でデプロイします。

::: tip 本例は proxy モードで動作します
HTTPS / DNS が不要な場合は [Hello World](/examples/hello-world) や [Next.js](/examples/nextjs) の no-proxy モード解説を参考にしてください。詳細は [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較)。
:::

## 完成イメージ

- `https://<あなたの FQDN>` で Plausible の管理画面に TLS 付きでアクセス可能
- blue/green 切り替えで無停止デプロイ
- PostgreSQL・ClickHouse は accessory として常駐し、ClickHouse に溜まったイベントデータはデプロイのたびに消えない

## 前提条件

- ConoHa CLI がインストール・ログイン済み ([はじめに](/guide/getting-started))
- 公開したい FQDN の DNS A レコードがサーバー IP を指している ([DNS / TLS](/guide/dns-tls))
- conoha-proxy がブート済み ([conoha-proxy セットアップ](/guide/proxy-setup))

## デプロイ手順

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/plausible-analytics

# conoha.yml の hosts: を自分の FQDN に書き換える
$EDITOR conoha.yml
```

conoha.yml（抜粋。完全版は [GitHub](https://github.com/crowdy/conoha-cli-app-samples/blob/main/plausible-analytics/conoha.yml)）:

```yaml
name: plausible-analytics
hosts:
  - plausible-analytics.example.com
web:
  service: plausible
  port: 8000
accessories:
  - db
  - clickhouse
```

compose.yml（抜粋。完全版は [GitHub](https://github.com/crowdy/conoha-cli-app-samples/blob/main/plausible-analytics/compose.yml)。DB / ClickHouse の接続文字列はマスクしています）:

```yaml
services:
  plausible:
    image: ghcr.io/plausible/community-edition:v2.1.5
    expose:
      - "8000"
    environment:
      - BASE_URL=${BASE_URL:?required}
      - SECRET_KEY_BASE=${SECRET_KEY_BASE:?required}
      - DATABASE_URL=postgres://plausible:${DB_PASSWORD:?required}@db:5432/plausible
      - CLICKHOUSE_DATABASE_URL=http://clickhouse:8123/plausible
    depends_on:
      db:
        condition: service_healthy
      clickhouse:
        condition: service_started
```

```bash
conoha proxy boot --acme-email you@example.com myserver   # サーバーごとに 1 回

conoha app init myserver

conoha app env set myserver \
  BASE_URL=https://plausible-analytics.example.com \
  SECRET_KEY_BASE=$(openssl rand -base64 48) \
  DB_PASSWORD=$(openssl rand -hex 32)

conoha app deploy myserver
```

::: tip 設定ポイント
- **`SECRET_KEY_BASE` は必ずランダム生成する**: compose 側では `${SECRET_KEY_BASE:?required}` として宣言されており、値を渡さないとコンテナ起動時にエラーになります。固定文字列を貼り付けず、`conoha app env set` で `$(openssl rand -base64 48)` を使って生成してください。
- **`accessories: [db, clickhouse]` と blue/green 永続化**: conoha.yml には次のコメントがあります（原文）:

  > `db` (PostgreSQL) and `clickhouse` are marked as accessories so they're started once and kept alive across blue/green swaps — only `plausible` is duplicated per slot. ClickHouse stores event data which must not be wiped on redeploy.

  つまり `conoha app deploy` のたびに再作成されるのは `plausible` コンテナのみで、ユーザー・サイト情報を持つ PostgreSQL とイベントデータを持つ ClickHouse は accessory として維持され、データが失われません。
:::

## 動作確認

ブラウザで `https://<あなたの FQDN>` にアクセスし、管理者アカウントを作成します（初回は Let's Encrypt 証明書発行に数十秒かかる場合があります）。

1. サイトを追加してトラッキングスクリプトを取得
2. 対象サイトの `<head>` に以下を追加

```html
<script defer data-domain="yourdomain.com" src="https://<あなたの FQDN>/js/script.js"></script>
```

3. 対象サイトにアクセスし、Plausible のダッシュボードにアクセスが記録されることを確認

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の plausible-analytics](https://github.com/crowdy/conoha-cli-app-samples/tree/main/plausible-analytics)
- Plausible ドキュメント: [plausible.io/docs](https://plausible.io/docs)
