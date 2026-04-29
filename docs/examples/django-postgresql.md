# Django + PostgreSQL デプロイ

Django と PostgreSQL を使った投稿アプリをConoHa VPSにデプロイする手順です。Django ORM による CRUD 機能と管理画面を持ちます。


::: tip 本例は no-proxy モードで動作します
[アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。HTTPS / blue-green を使う場合は [Hello World](/examples/hello-world) や [Next.js](/examples/nextjs) の proxy モード版を参考にしてください。
:::

## 完成イメージ

- `http://<サーバーIP>:8000` で投稿一覧ページが表示される
- `http://<サーバーIP>:8000/admin/` でDjango管理画面にアクセスできる
- DBマイグレーションはコンテナ起動時に自動実行される

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

## 1. プロジェクトを作成

```bash
django-admin startproject config .
python manage.py startapp posts
```

## 2. requirements.txt を作成

```
django==5.2
psycopg[binary]==3.2.6
gunicorn==23.0.0
```

## 3. Dockerfile を作成

```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN apt-get update -qq && apt-get install -y libpq5 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN chmod +x bin/docker-entrypoint manage.py
EXPOSE 8000
ENTRYPOINT ["bin/docker-entrypoint"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
```

## 4. エントリーポイントスクリプトを作成

`bin/docker-entrypoint` を作成します:

```bash
#!/bin/bash
set -e

# Run database migrations
python manage.py migrate --noinput

# Collect static files
python manage.py collectstatic --noinput

exec "$@"
```

```bash
chmod +x bin/docker-entrypoint
```

## 5. compose.yml を作成

```yaml
services:
  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DB_HOST=db
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=app_production
      - SECRET_KEY=change-me-in-production
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

## 6. .dockerignore を作成

```
README.md
.git
__pycache__
*.pyc
.venv
staticfiles
```

## 7. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name django-app --no-proxy

# デプロイ
conoha app deploy <サーバー名> --app-name django-app --no-proxy
```

## 8. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name django-app

# ログ確認
conoha app logs <サーバー名> --app-name django-app
```

ブラウザで `http://<サーバーIP>:8000` にアクセスして投稿一覧ページが表示されれば完了です。

## 管理画面を使う

スーパーユーザーを作成してDjango管理画面にアクセスできます:

```bash
# コンテナ内でスーパーユーザーを作成
conoha app exec <サーバー名> --app-name django-app -- \
  python manage.py createsuperuser
```

`http://<サーバーIP>:8000/admin/` にアクセスして作成したユーザーでログインします。

## 環境変数を本番向けに設定する

```bash
conoha app env set <サーバー名> --app-name django-app \
  SECRET_KEY=your-secure-secret-key \
  DB_PASSWORD=your-secure-password

# 再デプロイで反映
conoha app deploy <サーバー名> --app-name django-app --no-proxy
```

::: warning
`SECRET_KEY` と `DB_PASSWORD` は必ず本番用の値に変更してください。
:::

## コード更新

コードを変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name django-app --no-proxy
```
