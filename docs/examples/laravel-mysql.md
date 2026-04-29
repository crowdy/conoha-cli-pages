# Laravel + MySQL デプロイ

Laravel アプリを MySQL と組み合わせて ConoHa VPS にデプロイする手順です。Eloquent ORM による CRUD 機能を持つ投稿アプリを例に説明します。


::: tip 本例は no-proxy モードで動作します
[アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。HTTPS / blue-green を使う場合は [Hello World](/examples/hello-world) や [Next.js](/examples/nextjs) の proxy モード版を参考にしてください。
:::

## 完成イメージ

- Laravel アプリが `http://<サーバーIP>` でアクセス可能
- MySQL 8.0 がコンテナで起動し、データを永続化
- `conoha app deploy` でコード更新を即座に反映

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

## 1. Laravel プロジェクトを作成

```bash
composer create-project laravel/laravel myapp
cd myapp
```

## 2. Dockerfile を作成

```dockerfile
FROM composer:2 AS deps
WORKDIR /app
COPY composer.json ./
RUN composer install --no-dev --no-scripts --prefer-dist

FROM php:8.3-apache
RUN docker-php-ext-install pdo_mysql
RUN a2enmod rewrite
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
    && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf \
    && sed -ri -e 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf
WORKDIR /var/www/html
COPY --from=deps /app/vendor ./vendor
COPY . .
RUN chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true
RUN chmod +x bin/docker-entrypoint
EXPOSE 80
ENTRYPOINT ["bin/docker-entrypoint"]
CMD ["apache2-foreground"]
```

::: tip マルチステージビルド
`composer:2` イメージで依存関係をインストールし、本番用の `php:8.3-apache` イメージにはベンダーライブラリのみをコピーします。これにより最終イメージを小さく保てます。
:::

## 3. bin/docker-entrypoint を作成

コンテナ起動時に APP_KEY 生成とマイグレーションを自動実行するエントリポイントスクリプトを作成します。

```bash
mkdir -p bin
cat > bin/docker-entrypoint << 'EOF'
#!/bin/bash
set -e

# Generate app key if not set
if [ -z "$APP_KEY" ]; then
    php artisan key:generate --force
fi

# Run database migrations
php artisan migrate --force

exec "$@"
EOF
chmod +x bin/docker-entrypoint
```

## 4. compose.yml を作成

```yaml
services:
  web:
    build: .
    ports:
      - "80:80"
    environment:
      - APP_ENV=production
      - APP_DEBUG=false
      - DB_HOST=db
      - DB_DATABASE=laravel
      - DB_USERNAME=laravel
      - DB_PASSWORD=laravel
    depends_on:
      db:
        condition: service_healthy

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=laravel
      - MYSQL_USER=laravel
      - MYSQL_PASSWORD=laravel
    volumes:
      - db_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  db_data:
```

::: info ヘルスチェック
`depends_on` に `condition: service_healthy` を指定することで、MySQL が完全に起動してから Laravel コンテナが立ち上がります。マイグレーション実行時の接続エラーを防げます。
:::

## 5. .dockerignore を作成

```
.git
.gitignore
*.md
node_modules/
vendor/
storage/logs/
.env
```

## 6. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name laravel-app --no-proxy

# デプロイ
conoha app deploy <サーバー名> --app-name laravel-app --no-proxy
```

## 7. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name laravel-app

# ログ確認
conoha app logs <サーバー名> --app-name laravel-app
```

ブラウザで `http://<サーバーIP>` にアクセスして、Laravel の投稿一覧ページが表示されれば完了です。

## 環境変数を使う場合

本番環境ではパスワードを環境変数で管理します。

```bash
conoha app env set <サーバー名> --app-name laravel-app \
  DB_PASSWORD=your-secure-password \
  APP_KEY=base64:your-app-key

# 再デプロイで反映
conoha app deploy <サーバー名> --app-name laravel-app --no-proxy
```

## コード更新

コードやマイグレーションを変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name laravel-app --no-proxy
```

`bin/docker-entrypoint` で `php artisan migrate --force` が自動実行されるため、マイグレーションも自動で適用されます。
