# NestJS + PostgreSQL デプロイ

NestJS と PostgreSQL を使った投稿アプリをConoHa VPSにデプロイする手順です。TypeORM による CRUD 機能を持ちます。

## 完成イメージ

- `http://<サーバーIP>:3000` で投稿一覧ページが表示される
- テーブルはアプリ起動時にTypeORMが自動作成する
- `conoha app deploy` でコード更新を即座に反映

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

## 1. プロジェクトを作成

```bash
npm install -g @nestjs/cli
nest new nestjs-app
cd nestjs-app
npm install @nestjs/typeorm typeorm pg hbs
```

## 2. package.json を確認

```json
{
  "name": "conoha-nestjs-sample",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:prod": "node dist/main"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/typeorm": "^11.0.0",
    "hbs": "^4.2.0",
    "pg": "^8.13.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.0",
    "typeorm": "^0.3.20"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "typescript": "^5.7.0"
  }
}
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
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/views ./views
COPY --from=builder /app/package.json ./
RUN npm install --omit=dev
EXPOSE 3000
CMD ["node", "dist/main"]
```

## 4. compose.yml を作成

```yaml
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=db
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=app_production
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:17-alpine
    environment:
      - POSTGRES_PASSWORD=postgres
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  db_data:
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
conoha app init <サーバー名> --app-name nestjs-app

# デプロイ
conoha app deploy <サーバー名> --app-name nestjs-app
```

## 7. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name nestjs-app

# ログ確認
conoha app logs <サーバー名> --app-name nestjs-app
```

ブラウザで `http://<サーバーIP>:3000` にアクセスして投稿一覧ページが表示されれば完了です。

## 環境変数を本番向けに設定する

```bash
conoha app env set <サーバー名> --app-name nestjs-app \
  DB_PASSWORD=your-secure-password \
  DB_NAME=app_production

# 再デプロイで反映
conoha app deploy <サーバー名> --app-name nestjs-app
```

::: warning
`synchronize: true` はテーブルを自動作成・更新しますが、開発用の設定です。本番環境ではTypeORMのマイグレーションを使用してください。
:::

## コード更新

コードを変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name nestjs-app
```
