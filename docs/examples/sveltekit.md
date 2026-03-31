# SvelteKit デプロイ

SvelteKit アプリを adapter-node で ConoHa VPS にデプロイするサンプルです。SSR 対応のモダンフレームワークです。

## 完成イメージ

- SvelteKit アプリが `http://<サーバーIP>:3000` でアクセス可能
- SSR（サーバーサイドレンダリング）が有効な状態で動作
- `conoha app deploy` でコード更新を即座に反映

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

## 1. SvelteKit プロジェクトを作成

```bash
npx sv create myapp
cd myapp
npm install
```

## 2. adapter-node を設定

`@sveltejs/adapter-node` をインストールし、`svelte.config.js` を更新します。

```bash
npm install -D @sveltejs/adapter-node
```

```js
import adapter from "@sveltejs/adapter-node";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
  },
};

export default config;
```

## 3. Dockerfile を作成

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production runner
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
RUN npm install --omit=dev
EXPOSE 3000
ENV PORT=3000
CMD ["node", "build"]
```

## 4. compose.yml を作成

```yaml
services:
  web:
    build: .
    ports:
      - "3000:3000"
```

## 5. .dockerignore を作成

```
README.md
.git
node_modules
build
.svelte-kit
```

## 6. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name sveltekit-app

# デプロイ
conoha app deploy <サーバー名> --app-name sveltekit-app
```

## 7. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name sveltekit-app

# ログ確認
conoha app logs <サーバー名> --app-name sveltekit-app
```

ブラウザで `http://<サーバーIP>:3000` にアクセスして、カウンターアプリが表示されれば完了です。

## 環境変数を使う場合

```bash
conoha app env set <サーバー名> --app-name sveltekit-app \
  DATABASE_URL=postgres://user:pass@db:5432/mydb \
  PUBLIC_API_URL=https://api.example.com

# 再デプロイで反映
conoha app deploy <サーバー名> --app-name sveltekit-app
```

::: tip
SvelteKit では `PUBLIC_` プレフィックスの環境変数がクライアント側からもアクセスできます。サーバー専用の秘密情報はプレフィックスなしで使用してください。
:::

## コード更新

コードを変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name sveltekit-app
```
