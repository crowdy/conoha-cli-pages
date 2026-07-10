# Uptime Kuma デプロイ

Uptime Kuma（軽量なセルフホスティング監視ツール）を ConoHa VPS にデプロイする手順です。本例は proxy モード（blue/green + Let's Encrypt HTTPS）で公開します。Web サイトやサービスの稼働状態を、自分のサーバーでリアルタイムに監視したい方向け。

## 完成イメージ

- Uptime Kuma のダッシュボードが `https://<あなたの FQDN>` で TLS 付きアクセス可能
- 監視データは `uptime_kuma_data` ボリュームで永続化
- サービスは単一コンテナのみ（サイドカーなし）

## 前提条件

- ConoHa CLI がインストール・ログイン済み ([はじめに](/guide/getting-started))
- 公開したい FQDN（例: `uptime-kuma.example.com`）の DNS A レコードをサーバー IP に向けている ([DNS / TLS](/guide/dns-tls))
- conoha-proxy がブート済み ([conoha-proxy セットアップ](/guide/proxy-setup))

## デプロイ手順

```bash
# 1. サンプルを取得
git clone https://github.com/crowdy/conoha-cli-app-samples.git
cd conoha-cli-app-samples/uptime-kuma

# 2. conoha.yml の hosts を自分の FQDN に書き換える
#    （エディタで uptime-kuma.example.com を置き換える）

# 3. アプリ登録
conoha app init <サーバー名>

# 4. デプロイ
conoha app deploy <サーバー名>
```

`conoha.yml` はこの構成です（[全文は GitHub](https://github.com/crowdy/conoha-cli-app-samples/blob/main/uptime-kuma/conoha.yml)）:

```yaml
name: uptime-kuma
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - uptime-kuma.example.com
web:
  service: uptime-kuma
  port: 3001
```

`compose.yml` の抜粋（[全文は GitHub](https://github.com/crowdy/conoha-cli-app-samples/blob/main/uptime-kuma/compose.yml)）:

```yaml
services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    # No host-side port: conoha-proxy injects a randomly-bound
    # 127.0.0.1:0:3001 mapping at deploy time so two slots (blue/green)
    # can coexist. Publishing explicitly here would conflict.
    expose:
      - "3001"
    volumes:
      - uptime_kuma_data:/app/data
    restart: unless-stopped

volumes:
  uptime_kuma_data:
```

::: tip 設定ポイント
- 初期管理者アカウントは環境変数ではなく、初回アクセス時にブラウザ上で作成します。パスワードを `conoha app env set` で渡す必要はありません。
- 監視データは `uptime_kuma_data` ボリュームに永続化されるため、`conoha app deploy` で再デプロイしてもデータは消えません。
- サービスは `uptime-kuma` 単一コンテナのみで、DB などのサイドカーは不要です。
:::

## 動作確認

ブラウザで `https://<あなたの FQDN>` にアクセスし、初回管理者アカウントを作成します（初回は Let's Encrypt 証明書発行に数十秒かかる場合があります）。ログイン後、ダッシュボードから「Add New Monitor」で監視対象（HTTP、TCP、DNS、Ping など）を追加すると、稼働状況がリアルタイムに表示されます。

```bash
conoha app status <サーバー名>
conoha app logs <サーバー名>
```

## 関連リンク

- Recipe: [conoha-cli-app-samples/uptime-kuma](https://github.com/crowdy/conoha-cli-app-samples/tree/main/uptime-kuma)
- [Uptime Kuma 公式ドキュメント](https://github.com/louislam/uptime-kuma/wiki)
