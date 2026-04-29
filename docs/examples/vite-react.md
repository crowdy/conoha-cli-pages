# Vite + React デプロイ

Vite + React で構築した SPA を nginx で ConoHa VPS に配信するサンプルです。フロントエンドプロジェクトのデプロイに最適です。


::: tip 本例は no-proxy モードで動作します
[アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。HTTPS / blue-green を使う場合は [Hello World](/examples/hello-world) や [Next.js](/examples/nextjs) の proxy モード版を参考にしてください。
:::

## 完成イメージ

- Vite + React アプリが `http://<サーバーIP>` でアクセス可能
- nginx が静的ファイルを配信し、SPA のルーティングに対応
- `conoha app deploy` でコード更新を即座に反映

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

## 1. Vite + React プロジェクトを作成

```bash
npm create vite@latest myapp -- --template react-ts
cd myapp
npm install
```

## 2. Dockerfile を作成

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

## 3. nginx.conf を作成

SPA のルーティングに対応するため、すべてのリクエストを `index.html` にフォールバックします。

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
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
node_modules
dist
```

## 6. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name react-app --no-proxy

# デプロイ
conoha app deploy <サーバー名> --app-name react-app --no-proxy
```

## 7. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name react-app

# ログ確認
conoha app logs <サーバー名> --app-name react-app
```

ブラウザで `http://<サーバーIP>` にアクセスして、カウンターアプリが表示されれば完了です。

## 環境変数を使う場合

Vite では `VITE_` プレフィックスの環境変数がビルド時にバンドルに埋め込まれます。

```bash
conoha app env set <サーバー名> --app-name react-app \
  VITE_API_URL=https://api.example.com

# 再デプロイで反映（ビルド時に埋め込まれるため再ビルドが必要）
conoha app deploy <サーバー名> --app-name react-app --no-proxy
```

## コード更新

コードを変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name react-app --no-proxy
```
