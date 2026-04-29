# Hello World デプロイ

静的 HTML を nginx で配信する最もシンプルなサンプルです。本例では proxy モード (blue/green + Let's Encrypt HTTPS) で公開する流れを示します。`conoha app deploy` を初めて試す方におすすめです。

::: tip 別モードの選択
HTTPS / DNS が不要な場合は本例の末尾「[no-proxy モードで動かす](#no-proxy-モードで動かす)」を参照してください。
:::

## 完成イメージ

- `https://hello.example.com` で「Hello from ConoHa!」ページが表示される
- `index.html` を編集して `conoha app deploy` するだけで更新できる
- conoha-proxy が Let's Encrypt 証明書を自動取得

## 前提条件

- ConoHa CLI がインストール・ログイン済み ([はじめに](/guide/getting-started))
- サーバーが作成済み ([`--for proxy` プリセット推奨](/guide/server#プリセット-for))
- ドメイン (例: `hello.example.com`) を用意し、A レコードを VPS の IP に向けている ([DNS / TLS](/guide/dns-tls))
- conoha-proxy がブート済み ([conoha-proxy セットアップ](/guide/proxy-setup))

## 1. プロジェクトを作成

```bash
mkdir hello-world
cd hello-world
git init
```

## 2. index.html を作成

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hello ConoHa</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 { color: #333; font-size: 2.5rem; }
    p { color: #666; font-size: 1.2rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Hello from ConoHa!</h1>
    <p>Deployed with <code>conoha app deploy</code></p>
  </div>
</body>
</html>
```

## 3. Dockerfile を作成

```dockerfile
FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
```

## 4. compose.yml を作成

proxy モードでは外部公開ポートを直接バインドしません — proxy がコンテナの内部ポートにルーティングします。

```yaml
services:
  web:
    build: .
    expose:
      - "80"
```

## 5. conoha.yml を作成

proxy モードで必須の設定ファイルです。`hosts` に DNS A レコードを向けたホスト名を、`web.port` に compose で expose したポートを書きます。

```yaml
name: hello
hosts:
  - hello.example.com
web:
  service: web
  port: 80
```

## 6. .dockerignore を作成

```
README.md
.git
```

## 7. デプロイ

```bash
# 初期化（初回のみ; proxy にサービス登録）
conoha app init <サーバー名>

# デプロイ
conoha app deploy <サーバー名>
```

`app init` がサービスを proxy に登録し、`app deploy` 完了後に Let's Encrypt が HTTP-01 検証で証明書を取得します (DNS が VPS を指していることが前提)。

## 8. 動作確認

```bash
# ステータス
conoha app status <サーバー名>

# ログ
conoha app logs <サーバー名>

# proxy 側登録の確認
conoha proxy services <サーバー名>
```

ブラウザで `https://hello.example.com` にアクセスして、TLS 付きで「Hello from ConoHa!」が表示されれば完了です。

## コンテンツ更新

`index.html` を編集したら、同じコマンドで再デプロイするだけです:

```bash
conoha app deploy <サーバー名>
```

drain 窓内であれば直前のスロットへロールバックできます:

```bash
conoha app rollback <サーバー名>
```

## no-proxy モードで動かす

HTTPS / DNS が不要、または既存 Docker ホストで簡単に動かしたい場合は `--no-proxy` モードが使えます。`conoha.yml` は不要、proxy のブートも不要です。

```yaml
# compose.yml はポートを直接バインドする形に変える
services:
  web:
    build: .
    ports:
      - "80:80"
```

```bash
conoha app init <サーバー名> --app-name hello-world --no-proxy
conoha app deploy <サーバー名> --app-name hello-world --no-proxy
```

`http://<サーバーIP>` でアクセスできます。HTTPS は別途自前で構成してください。詳細は [アプリデプロイ — no-proxy モード](/guide/app-deploy#no-proxy-モード) を参照。
