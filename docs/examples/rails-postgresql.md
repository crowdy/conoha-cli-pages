# Rails + PostgreSQL デプロイ

Ruby on RailsアプリをPostgreSQLと一緒にConoHa VPSにデプロイする手順です。


::: tip 本例は no-proxy モードで動作します
[アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。HTTPS / blue-green を使う場合は [Hello World](/examples/hello-world) や [Next.js](/examples/nextjs) の proxy モード版を参考にしてください。
:::

## 完成イメージ

- Railsアプリが `http://<サーバーIP>` でアクセス可能
- PostgreSQLがサイドカーコンテナで動作

## 前提条件

- ConoHa CLIがインストール・ログイン済み
- メモリ1GB以上のサーバー

## 1. Rails プロジェクトを作成

```bash
rails new myapp --database=postgresql
cd myapp
```

## 2. Dockerfile

```dockerfile
FROM ruby:3.4-slim AS builder
RUN apt-get update && apt-get install -y build-essential libpq-dev
WORKDIR /app
COPY Gemfile Gemfile.lock ./
RUN bundle install --jobs 4 --without development test

FROM ruby:3.4-slim
RUN apt-get update && apt-get install -y libpq5 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /usr/local/bundle /usr/local/bundle
COPY . .
RUN bundle exec rails assets:precompile SECRET_KEY_BASE=dummy
EXPOSE 3000
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
```

## 3. docker-compose.yml

```yaml
services:
  web:
    build: .
    ports:
      - "80:3000"
    depends_on:
      - db
    environment:
      - DATABASE_URL=postgres://postgres:${POSTGRES_PASSWORD}@db:5432/myapp_production
      - RAILS_ENV=production
      - SECRET_KEY_BASE=${SECRET_KEY_BASE}
    restart: unless-stopped

  db:
    image: postgres:17
    volumes:
      - pg_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=myapp_production
    restart: unless-stopped

volumes:
  pg_data:
```

## 4. .dockerignore

```
.git
log/*
tmp/*
node_modules
```

## 5. config/database.yml を修正

```yaml
production:
  url: <%= ENV["DATABASE_URL"] %>
```

## 6. デプロイ

```bash
# 初期化
conoha app init <サーバー名> --app-name myapp --no-proxy

# 環境変数を設定
conoha app env set <サーバー名> --app-name myapp \
  POSTGRES_PASSWORD=your-secure-password \
  SECRET_KEY_BASE=$(rails secret)

# デプロイ
conoha app deploy <サーバー名> --app-name myapp --no-proxy
```

## 7. データベースのセットアップ

初回デプロイ後:

```bash
conoha server ssh <サーバー名> -i ~/.ssh/conoha_mykey
# サーバー内で:
cd /opt/conoha/myapp
docker compose exec web bundle exec rails db:create db:migrate
```

## 8. 動作確認

ブラウザで `http://<サーバーIP>` にアクセスしてRailsのページが表示されれば完了です。

```bash
conoha app status <サーバー名> --app-name myapp
conoha app logs <サーバー名> --app-name myapp
```
