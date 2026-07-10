# LINE API Mock デプロイ

LINE Messaging API の OpenAPI 仕様に準拠したモックサーバーを ConoHa VPS にデプロイする手順です。実 LINE 公式アカウントを持たずに自分の LINE Bot を開発・テストしたい方向け。管理 UI から仮想ユーザーを操作して Bot の webhook を疑似的に叩ける、ローカル開発・CI 向けのモックです。proxy モード (blue/green + Let's Encrypt HTTPS) で公開します。

::: tip CLI クライアントと組み合わせる
Bot 側ではなく LINE API を叩く CLI クライアントが必要な場合は [line-cli-go](/examples/line-cli-go) を参照してください。本モックの `baseURL` をそのクライアントに向けることで、実 LINE Platform に依存せず End-to-End の動作確認ができます。
:::

## 完成イメージ

- モックサーバーが `https://line-api-mock.example.com` で TLS 付きアクセス可能
- `/admin` の管理 UI から仮想ユーザー・チャンネル・会話ログを操作できる
- `/docs` の Swagger UI から `/v2/bot/*` などのエンドポイントを直接試せる
- PostgreSQL は accessory として起動し、blue/green デプロイの間も再起動されない

## 前提条件

- ConoHa CLI がインストール・ログイン済み ([はじめに](/guide/getting-started))
- ドメイン (例: `line-api-mock.example.com`) を用意し、DNS A レコードを VPS の IP に向けている ([DNS / TLS](/guide/dns-tls))
- conoha-proxy がブート済み ([conoha-proxy セットアップ](/guide/proxy-setup))

## デプロイ手順

```bash
# 1. サンプルを取得
git clone https://github.com/crowdy/conoha-cli-app-samples.git
cd conoha-cli-app-samples/line-api-mock

# 2. conoha.yml の hosts を自分の FQDN に書き換える
#    (DNS A レコードがサーバー IP を指している必要があります)

# 3. アプリ登録
conoha app init <サーバー名>

# 4. APP_BASE_URL を公開 FQDN に設定
#    (webhook コールバック URL や自己参照 URL の生成に使われるため必須)
conoha app env set <サーバー名> APP_BASE_URL=https://line-api-mock.example.com

# 5. デプロイ
conoha app deploy <サーバー名>
```

conoha.yml は次のようになっています。

```yaml
name: line-api-mock
hosts:
  - line-api-mock.example.com
web:
  service: app
  port: 3000
accessories:
  - db
```

compose.yml は `app` (Hono + PostgreSQL 接続) と `db` (PostgreSQL 17) の 2 サービス構成です。抜粋（全文は [GitHub](https://github.com/crowdy/conoha-cli-app-samples/blob/main/line-api-mock/compose.yml) を参照）。

```yaml
services:
  app:
    build: .
    expose:
      - "3000"
    environment:
      - APP_BASE_URL=${APP_BASE_URL:?required}
      - PORT=3000
      - MOCK_ALLOW_PRIVATE_WEBHOOKS=${MOCK_ALLOW_PRIVATE_WEBHOOKS:-0}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:17-alpine
    # DB 認証情報はコンテナ間の内部通信専用（外部には公開されません）。
    # 詳細は GitHub の compose.yml を参照してください。
    restart: unless-stopped
```

::: tip 設定ポイント

**チャンネル認証情報はログで確認する** — 初回起動時に既定のチャンネルと仮想ユーザーが自動作成され、`channel_id` / `channel_secret` / `access_token` はコンテナログにのみ出力されます（設定ファイルには書かれません）。デプロイ後は次で取得してください。

```bash
conoha app logs <サーバー名>
```

```
[line-api-mock] Seeded default channel:
  channel_id:     <PLACEHOLDER>
  channel_secret: <PLACEHOLDER>
  access_token:   <PLACEHOLDER>
```

**`db` は accessory として永続化される** — conoha.yml に次のコメントの通り、blue/green のスロット切替対象は `app` のみです。

> `db` is marked as an accessory so it's started once and kept alive
> across blue/green swaps — only `app` is duplicated per slot.

つまりデプロイのたびに PostgreSQL が再起動・再作成されることはなく、仮想ユーザーや会話ログはそのまま引き継がれます。

:::

## 動作確認

```bash
# ステータス
conoha app status <サーバー名>

# ヘルスチェック
curl https://line-api-mock.example.com/health

# Swagger UI で API を確認（ブラウザ）
# https://line-api-mock.example.com/docs
```

`/admin` の管理 UI（サンプルで設定済み: Basic Auth。ユーザー名・パスワードはログ出力を参照）で仮想ユーザーから Bot に発言すると、設定した webhook URL に署名付きで POST されます。自分の Bot 側の受信を確認したら完了です。

## 関連リンク

- [Recipe (GitHub)](https://github.com/crowdy/conoha-cli-app-samples/tree/main/line-api-mock)
- [line-cli-go](/examples/line-cli-go) — 本モックと組み合わせる LINE API CLI クライアント
- [LINE Messaging API ドキュメント](https://developers.line.biz/ja/docs/messaging-api/)
