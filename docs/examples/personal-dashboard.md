# Personal Dashboard デプロイ

時計・天気（気象庁 JMA）・カレンダー（Outlook / Google）・カウントダウン・ショートカットを1画面にまとめた自分用ダッシュボードを、ConoHa VPS3に**no-proxyモード**でデプロイするサンプルです。Go + Next.jsのシングルバイナリをCaddyの背後に置き、TLSはconoha-proxy（Let's Encrypt自動取得）ではなく**Cloudflare Origin CA証明書**（手動発行・15年有効）で終端します。他のサンプルの多くが使うproxyモード + Let's Encryptとは異なる構成なので、その前提を先に押さえておいてください。

::: tip このサンプルのTLSモデル
本サンプルは `conoha.yml` を持たない**no-proxyモード**で動作します。TLS終端はconoha-proxyではなくVPS上のCaddyコンテナが行い、証明書はLet's EncryptではなくCloudflare Origin CA（Full-Strict構成向けの手動発行証明書）を使います。proxyモードとの違いは[アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較)を参照してください。
:::

## 完成イメージ

- ブラウザ1画面に大型デジタル時計・JMA天気（今日/明日）・カレンダー・カウントダウン・ショートカットアイコンが並ぶ
- カレンダーはMicrosoft Outlook / Google Calendarの複数アカウントを集約表示（任意）
- ライト/ダークテーマをOS設定追従 + 手動切替
- Cloudflareのオレンジクラウド（プロキシON）経由でHTTPSアクセス

## 前提条件

- ConoHa CLIがインストール・ログイン済み
- ConoHa VPS3アカウント + SSHキーペア
- **Cloudflareで管理しているドメイン**（オレンジクラウド = プロキシON、SSL/TLSモードはFull (Strict)）
- Cloudflare Origin CA証明書 + 秘密鍵（`SSL and Certificates: Edit`権限のAPIトークンで発行）
- （任意）Outlook / Google Calendar連携用のクライアント資格情報、JMA officeコード

## デプロイ手順

```bash
# 1. VPSを作る
conoha server create --name dashboard-server \
  --flavor <フレーバーID> \
  --image <イメージID> \
  --key-name <your-key> \
  --security-group default \
  --security-group IPv4v6-SSH \
  --security-group IPv4v6-Web \
  --no-input --yes --wait

# 2. アプリを初期化 (no-proxyモード。conoha.ymlは作らない)
conoha app init dashboard-server --app-name dashboard --no-proxy
```

Cloudflare Origin CA証明書と秘密鍵は、**リポジトリやコマンド引数に直接書かず、ファイルとしてVPSに配置**します。

```bash
# 3. Origin CA証明書・秘密鍵をファイルとしてVPSに配置 (内容はコマンドに埋め込まない)
ssh root@<VPS-IP> 'mkdir -p /etc/caddy/certs && chmod 700 /etc/caddy/certs'
scp certs/example.com.crt certs/example.com.key root@<VPS-IP>:/etc/caddy/certs/
ssh root@<VPS-IP> 'chmod 644 /etc/caddy/certs/*.crt && chmod 600 /etc/caddy/certs/*.key'

# caddy/Caddyfile の <YOUR-DOMAIN> は事前に自分のホスト名へ置換しておく
```

```bash
# 4. 環境変数を設定 (値はプレースホルダ。実値は各自のシークレット管理で注入する)
conoha app env set dashboard-server --app-name dashboard \
  JMA_OFFICE_CODE=<JMAオフィスコード> \
  MS_TENANT_ID=${MS_TENANT_ID:?required-if-outlook} \
  MS_CLIENT_ID=${MS_CLIENT_ID:?required-if-outlook} \
  MS_CLIENT_SECRET=${MS_CLIENT_SECRET:?required-if-outlook} \
  MS_REFRESH_TOKEN=${MS_REFRESH_TOKEN:?required-if-outlook} \
  GOOGLE_ACCOUNTS=${GOOGLE_ACCOUNTS_JSON:?required-if-google}

# 5. デプロイ
conoha app deploy dashboard-server --app-name dashboard --no-proxy
```

`docker-compose.yml`の抜粋（完全版は関連リンク参照）:

```yaml
services:
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - /etc/caddy/certs:/etc/caddy/certs:ro
    depends_on:
      - web

  web:
    build: { context: ., dockerfile: Dockerfile }
    expose: ["8080"]
    volumes:
      - ./data:/app/data
    environment:
      PORT: "8080"
      JMA_OFFICE_CODE: "130000"
```

`caddy/Caddyfile`の抜粋:

```
<YOUR-DOMAIN> {
    # Cloudflare Origin CA証明書。ホストの /etc/caddy/certs/ からマウント
    tls /etc/caddy/certs/<YOUR-DOMAIN>.crt /etc/caddy/certs/<YOUR-DOMAIN>.key
    reverse_proxy web:8080
}
```

::: tip 設定ポイント
- **no-proxy + Cloudflare Origin CA**: このサンプルはconoha-proxy（Let's Encrypt自動取得）を使わず、Caddyが自前でOrigin CA証明書を読み込んでTLS終端します。Origin CAは15年有効で、CloudflareのSSL/TLSモードをFull (Strict)にしていれば運用中の自動更新はほぼ不要です。反面、この証明書はCloudflareのエッジからしか信頼されないため、CFプロキシ（オレンジクラウド）を外すと成立しない構成です。
- **証明書・秘密鍵はファイル/シークレットとして扱う**: Origin CA証明書と秘密鍵の中身はこのページやリポジトリに直接書きません。`scp`等でVPS上の`/etc/caddy/certs/`に配置し、`docker-compose.yml`からread-onlyマウントする運用にしてください。
- **API資格情報はプレースホルダで管理**: `MS_CLIENT_SECRET`や`GOOGLE_ACCOUNTS`などの認証情報は、実値をコマンドやファイルに直書きせず、`<VAR:?required>`のようなプレースホルダで示した上で、シークレット管理の仕組みから注入してください。
:::

## 動作確認

```bash
conoha app status dashboard-server --app-name dashboard
conoha app logs dashboard-server --app-name dashboard --follow
```

ブラウザで自分のCloudflareドメイン（例: `https://example.com`）にアクセスすると、時計・天気・カレンダー・カウントダウン・ショートカットが1画面に表示されます。

## 関連リンク

- Recipe: <https://github.com/crowdy/conoha-cli-app-samples/tree/main/personal-dashboard>
- フルソース: <https://github.com/crowdy/dashboard.crowdy.dev>
- [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較)
