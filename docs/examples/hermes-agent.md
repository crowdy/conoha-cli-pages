# Hermes Agent デプロイ

Nous Research の自己学習型 AI エージェント「Hermes Agent」を ConoHa VPS にデプロイする手順です。OpenAI 互換 API を提供する gateway と、管理用 Web UI の dashboard をまとめて公開する、ConoHa インフラ管理向け DevOps アシスタントです。本例は proxy モード（blue/green + Let's Encrypt HTTPS）で動作します。

## 完成イメージ

- `https://<あなたのFQDN>/` で dashboard に Basic 認証付きでアクセス可能
- gateway が OpenAI 互換 API を内部ポート 8642 で提供（nginx 経由）
- `conoha app deploy` で blue/green 切り替え（ただし対象範囲に注意点あり、後述）

## 前提条件

- ConoHa CLI がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[`--for proxy` プリセット推奨](/guide/server#プリセット-for)）
- 公開したい FQDN の DNS A レコードがサーバー IP を指している（[DNS / TLS](/guide/dns-tls)）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）
- LLM プロバイダの API キー（例: [Anthropic](https://console.anthropic.com/)）

## デプロイ手順

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples.git
cd conoha-cli-app-samples/hermes-agent
```

`conoha.yml` の `hosts:` を自分の FQDN に書き換えます。

```yaml
name: hermes-agent
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - <あなたのFQDN>          # 例: hermes.example.com（サンプルで設定済みのドメイン名から変更）
web:
  service: nginx
  port: 80
# `gateway` (LLM agent gateway, port 8642 internal) and `dashboard`
# (HTMX UI, port 9119 internal) are accessories — the in-container
# nginx proxies to them. Same caveat as sendgrid-invitation: only
# `nginx` is duplicated per blue/green slot, so updates to gateway
# or dashboard ride with the slot's snapshot.
accessories:
  - gateway
  - dashboard
```

gateway / dashboard のコンテナ構成は `compose.yml` に定義済みです（[全文は GitHub 参照](https://github.com/crowdy/conoha-cli-app-samples/blob/main/hermes-agent/compose.yml)）。抜粋:

```yaml
services:
  gateway:
    image: nousresearch/hermes-agent
    command: gateway run
    expose:
      - "8642"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - API_SERVER_KEY=${API_SERVER_KEY:-}
  dashboard:
    image: nousresearch/hermes-agent
    command: dashboard --host 0.0.0.0 --insecure --no-open
    expose:
      - "9119"
  nginx:
    image: nginx:alpine
    expose:
      - "80"
```

API キーと gateway の共有シークレットを設定してデプロイします。

```bash
# アプリ登録（初回のみ）
conoha app init <サーバー名>

# gateway が読む LLM API キーと共有シークレットを設定（必須 — 未設定だと API 呼び出し時にエラーになります）
conoha app env set <サーバー名> \
  ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:?required} \
  API_SERVER_KEY=$(openssl rand -hex 32)

# デプロイ
conoha app deploy <サーバー名>
```

::: tip 設定ポイント
- **API キーは `${ANTHROPIC_API_KEY:?required}` で必須化する** — `compose.yml` の元の定義は `ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}` のように未設定時は空文字にフォールバックし、アプリ側のエラーで気づく設計です。本ドキュメントではさらに明示的に `:?required` としています。Anthropic の `sk-ant-` や OpenAI 系の `sk-proj-` 形式の実キーを `conoha.yml` / `compose.yml` に平文で書かず、必ず `conoha app env set` 経由で渡してください。
- **web は nginx のみ、gateway/dashboard は accessory** — 上記 `conoha.yml` のコメントの通りです:

  > `gateway` (LLM agent gateway, port 8642 internal) and `dashboard` (HTMX UI, port 9119 internal) are accessories — the in-container nginx proxies to them. Same caveat as sendgrid-invitation: only `nginx` is duplicated per blue/green slot, so updates to gateway or dashboard ride with the slot's snapshot.

  `conoha app deploy` で blue/green 再作成されるのは nginx だけです。エージェントの設定やモデルを変更しても、それだけでは新スロットには反映されません。
:::

## 動作確認

```bash
conoha app status <サーバー名>
conoha app logs <サーバー名>
```

- ブラウザで `https://<あなたのFQDN>/` にアクセスすると Basic 認証のダイアログ → dashboard が表示されます（初回は証明書発行に数十秒かかる場合があります）
- gateway の OpenAI 互換 API は conoha-proxy の公開対象外（内部 8642）なので、確認にはサーバーへ SSH して `docker exec` で叩きます:

```bash
ssh root@<サーバーIP>
docker exec $(docker ps -q -f name=gateway) curl -s http://localhost:8642/health
```

## 関連リンク

- Recipe: [hermes-agent](https://github.com/crowdy/conoha-cli-app-samples/tree/main/hermes-agent)
- 関連: [sendgrid-invitation](https://github.com/crowdy/conoha-cli-app-samples/tree/main/sendgrid-invitation) — 同じ「nginx が accessory をまとめてフロントする」構成パターン
- [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較)
