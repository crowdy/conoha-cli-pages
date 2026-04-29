# Next.js デプロイ

Next.js アプリを ConoHa VPS にデプロイする手順です。本例では proxy モード (blue/green + Let's Encrypt HTTPS) で公開します。Vercel の代替として、自分のサーバーで Next.js を動かしたい方向け。

::: tip 別モードの選択
HTTPS / DNS が不要な場合は本例の末尾「[no-proxy モードで動かす](#no-proxy-モードで動かす)」を参照してください。
:::

## 完成イメージ

- Next.js アプリが `https://app.example.com` で TLS 付きアクセス可能
- blue/green 切り替えで無停止デプロイ
- `conoha app deploy` でコード更新、drain 窓内なら `conoha app rollback` で即座に戻せる

## 前提条件

- ConoHa CLI がインストール・ログイン済み ([はじめに](/guide/getting-started))
- サーバーが作成済み ([`--for proxy` プリセット推奨](/guide/server#プリセット-for))
- ドメイン (例: `app.example.com`) を用意し、A レコードを VPS の IP に向けている ([DNS / TLS](/guide/dns-tls))
- conoha-proxy がブート済み ([conoha-proxy セットアップ](/guide/proxy-setup))

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
Next.js の `standalone` 出力を使うには、`next.config.ts` に以下を追加:

```ts
const nextConfig = {
  output: 'standalone',
}
```
:::

## 3. compose.yml を作成

proxy モードでは外部ポートを直接バインドしません。proxy がコンテナ内部の `3000` にルーティングします。

```yaml
services:
  web:
    build: .
    expose:
      - "3000"
    restart: unless-stopped
```

## 4. conoha.yml を作成

```yaml
name: myapp
hosts:
  - app.example.com
web:
  service: web
  port: 3000
deploy:
  drain_ms: 30000          # rollback 用に旧スロットを 30 秒残す
```

## 5. .dockerignore を作成

```
node_modules
.next
.git
```

## 6. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名>

# デプロイ
conoha app deploy <サーバー名>
```

## 7. 動作確認

```bash
# ステータス
conoha app status <サーバー名>

# ログ
conoha app logs <サーバー名>

# proxy 登録
conoha proxy services <サーバー名>
```

ブラウザで `https://app.example.com` にアクセスして、Next.js のページが TLS 付きで表示されれば完了です。

## 環境変数を使う場合

::: warning proxy モードでは現状反映されません
`app env set` は proxy モードのデプロイには現状反映されません ([#94](https://github.com/crowdy/conoha-cli/issues/94) で再設計予定)。proxy モードでは Dockerfile の `ENV` や compose の `environment:` / `env_file:` を使ってください。
:::

```yaml
# compose.yml に environment ブロックを追加
services:
  web:
    build: .
    expose:
      - "3000"
    environment:
      DATABASE_URL: postgres://user:pass@db:5432/mydb
      NEXT_PUBLIC_API_URL: https://api.example.com
    restart: unless-stopped
```

## コード更新

```bash
conoha app deploy <サーバー名>
```

新しいスロットでビルドが始まり、healthy 確認後に proxy が新スロットへ切り替えます。drain 窓内なら直前のバージョンへ戻せます:

```bash
conoha app rollback <サーバー名>
```

## no-proxy モードで動かす

HTTPS / DNS が不要、または既存 Docker ホストで簡単に動かしたい場合は `--no-proxy` モードを使います。`conoha.yml` は不要です。

```yaml
# compose.yml はポートを直接バインドする形に変える
services:
  web:
    build: .
    ports:
      - "80:3000"
    restart: unless-stopped
```

```bash
conoha app init <サーバー名> --app-name myapp --no-proxy
conoha app deploy <サーバー名> --app-name myapp --no-proxy

# 環境変数 (no-proxy モードでは反映されます)
conoha app env set <サーバー名> --app-name myapp DATABASE_URL=postgres://...
conoha app deploy <サーバー名> --app-name myapp --no-proxy
```
