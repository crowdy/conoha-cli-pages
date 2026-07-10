# bun-elysia-chat デプロイ

Bun と Elysia を使ったリアルタイムチャットアプリを ConoHa VPS にデプロイする手順です。WebSocket でメッセージを即時配信し、チャット履歴は SQLite（`bun:sqlite`）に永続化します。本例は proxy モードで動作し、conoha-proxy が HTTPS（Let's Encrypt）と WebSocket アップグレードの終端を行います。

## 完成イメージ

- チャットアプリが `https://<あなたの FQDN>` で TLS 付きアクセス可能
- 複数ブラウザタブ間でメッセージがリアルタイムに配信される
- 接続時に過去のチャット履歴がロードされる
- オンライン人数がリアルタイムに表示される

## 前提条件

- ConoHa CLI がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- 公開したい FQDN の DNS A レコードが対象サーバーの IP を指している（[DNS / TLS](/guide/dns-tls)）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）

## デプロイ手順

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/bun-elysia-chat

# conoha.yml の hosts: を自分の FQDN に書き換える

# アプリ登録（初回のみ）
conoha app init <サーバー名>

# デプロイ
conoha app deploy <サーバー名>
```

`conoha.yml` は次の内容です（`hosts:` のみ書き換えます）。

```yaml
name: bun-elysia-chat
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - bun-elysia-chat.example.com
web:
  service: web
  port: 3000
```

`compose.yml` はホスト側ポートを直接バインドしません。proxy がスロットごとにランダムポートを注入します。

```yaml
services:
  web:
    build: .
    # No host-side port: conoha-proxy injects a randomly-bound
    # 127.0.0.1:0:3000 mapping at deploy time so two slots (blue/green)
    # can coexist. Publishing explicitly here would conflict.
    expose:
      - "3000"
    volumes:
      - chat_data:/data
    restart: unless-stopped

volumes:
  chat_data:
```

全文は [GitHub の compose.yml](https://github.com/crowdy/conoha-cli-app-samples/blob/main/bun-elysia-chat/compose.yml) を参照してください。

::: tip 設定ポイント
- **WebSocket アップグレードの透過** — conoha-proxy は HTTP アップグレードヘッダーを検知して WebSocket 接続をそのままバックエンドへ転送します。これによりチャットのリアルタイム通信が `https://` 経由（TLS 終端後）でも途切れずに動作します。追加設定は不要です。
- **単一 FQDN・単一サービス構成** — `conoha.yml` の `hosts:` は 1 件、`web` サービスも 1 つのみでアクセサリ（DB など）はありません。チャット履歴は SQLite ファイルとして `chat_data` ボリュームに保存され、コンテナ間で共有する外部 DB は不要です。
- **単一レプリカ前提** — オンラインユーザー一覧はプロセス内メモリで保持されるため、スケールアウトする場合は Redis 等の共有ストアへプレゼンス情報を移す設計変更が必要です（詳細は upstream リポジトリの README を参照）。
:::

## 動作確認

```bash
# ステータス
conoha app status <サーバー名>

# ログ
conoha app logs <サーバー名>

# proxy 登録の確認
conoha proxy services <サーバー名>
```

ブラウザで `https://<あなたの FQDN>` にアクセスし、ニックネームを入力してチャットルームに参加します。複数タブで開いてメッセージを送ると、他のタブにもリアルタイムに反映されればWebSocket通信は正常です。初回アクセス時は Let's Encrypt 証明書発行に数十秒かかる場合があります。

curl で WebSocket ハンドシェイクの応答コード（`101 Switching Protocols`）を確認することもできます。

```bash
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: <base64-16byte-nonce>" \
  https://<あなたの FQDN>/ws
```

## 関連リンク

- [Recipe: bun-elysia-chat](https://github.com/crowdy/conoha-cli-app-samples/tree/main/bun-elysia-chat)
- [Bun ドキュメント](https://bun.sh/docs)
- [Elysia ドキュメント](https://elysiajs.com/)
- [Next.js デプロイ（proxy モードの基本形）](/examples/nextjs)
- [conoha-proxy セットアップ](/guide/proxy-setup)
