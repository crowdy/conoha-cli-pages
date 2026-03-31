# Hello World デプロイ

静的HTMLをnginxで配信する最もシンプルなサンプルです。`conoha app deploy` を初めて試す方におすすめです。

## 完成イメージ

- `http://<サーバーIP>` で「Hello from ConoHa!」ページが表示される
- `index.html` を編集して `conoha app deploy` するだけで更新できる

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

## 1. プロジェクトを作成

```bash
mkdir hello-world
cd hello-world
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

```yaml
services:
  web:
    build: .
    ports:
      - "80:80"
```

## 5. .dockerignore を作成

```
README.md
.git
```

## 6. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name hello-world

# デプロイ
conoha app deploy <サーバー名> --app-name hello-world
```

## 7. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name hello-world

# ログ確認
conoha app logs <サーバー名> --app-name hello-world
```

ブラウザで `http://<サーバーIP>` にアクセスして、「Hello from ConoHa!」が表示されれば完了です。

## コンテンツ更新

`index.html` を編集したら、同じコマンドで再デプロイするだけです:

```bash
conoha app deploy <サーバー名> --app-name hello-world
```
