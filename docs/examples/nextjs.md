# Next.js デプロイ

Next.jsアプリをConoHa VPSにデプロイする手順です。Vercelの代替として、自分のサーバーでNext.jsを動かしたい方向け。

## 完成イメージ

- Next.js アプリが `http://<サーバーIP>` でアクセス可能
- `conoha app deploy` でコード更新を即座に反映

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

## 1. Next.js プロジェクトを作成

```bash
npx create-next-app@latest myapp
cd myapp
```

## 2. Dockerfile を作成

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

::: tip
Next.jsの `standalone` 出力を使うには、`next.config.ts` に以下を追加:

```ts
const nextConfig = {
  output: 'standalone',
}
```
:::

## 3. docker-compose.yml を作成

```yaml
services:
  web:
    build: .
    ports:
      - "80:3000"
    restart: unless-stopped
```

## 4. .dockerignore を作成

```
node_modules
.next
.git
```

## 5. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name myapp

# デプロイ
conoha app deploy <サーバー名> --app-name myapp
```

## 6. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name myapp

# ログ確認
conoha app logs <サーバー名> --app-name myapp
```

ブラウザで `http://<サーバーIP>` にアクセスして、Next.jsのページが表示されれば完了です。

## 環境変数を使う場合

```bash
conoha app env set <サーバー名> --app-name myapp \
  DATABASE_URL=postgres://user:pass@db:5432/mydb \
  NEXT_PUBLIC_API_URL=https://api.example.com

# 再デプロイで反映
conoha app deploy <サーバー名> --app-name myapp
```

## コード更新

コードを変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name myapp
```
