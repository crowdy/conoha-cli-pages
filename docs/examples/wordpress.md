# WordPress デプロイ

WordPressをConoHa VPSにデプロイする手順です。レンタルサーバーからVPSに移行したい方向け。


::: tip 本例は no-proxy モードで動作します
[アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。HTTPS / blue-green を使う場合は [Hello World](/examples/hello-world) や [Next.js](/examples/nextjs) の proxy モード版を参考にしてください。
:::

## 完成イメージ

- WordPressが `http://<サーバーIP>` でアクセス可能
- MySQLがサイドカーコンテナで動作
- データは永続化

## 前提条件

- ConoHa CLIがインストール・ログイン済み
- メモリ1GB以上のサーバー

## 1. プロジェクト構成

```
wordpress-site/
├── docker-compose.yml
└── .dockerignore
```

WordPressは公式Dockerイメージを使うため、Dockerfileは不要です。

## 2. docker-compose.yml

```yaml
services:
  wordpress:
    image: wordpress:6
    ports:
      - "80:80"
    depends_on:
      - db
    environment:
      - WORDPRESS_DB_HOST=db
      - WORDPRESS_DB_USER=wordpress
      - WORDPRESS_DB_PASSWORD=${MYSQL_PASSWORD}
      - WORDPRESS_DB_NAME=wordpress
    volumes:
      - wp_data:/var/www/html
    restart: unless-stopped

  db:
    image: mysql:8
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=wordpress
      - MYSQL_USER=wordpress
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
    volumes:
      - db_data:/var/lib/mysql
    restart: unless-stopped

volumes:
  wp_data:
  db_data:
```

## 3. .dockerignore

```
.git
```

## 4. デプロイ

```bash
# 初期化
conoha app init <サーバー名> --app-name wordpress --no-proxy

# 環境変数を設定
conoha app env set <サーバー名> --app-name wordpress \
  MYSQL_PASSWORD=your-secure-password \
  MYSQL_ROOT_PASSWORD=your-root-password

# デプロイ
conoha app deploy <サーバー名> --app-name wordpress --no-proxy
```

## 5. 動作確認

ブラウザで `http://<サーバーIP>` にアクセスすると、WordPressのセットアップ画面が表示されます。

```bash
conoha app status <サーバー名> --app-name wordpress
conoha app logs <サーバー名> --app-name wordpress
```

## バックアップ

データベースのバックアップ:

```bash
conoha server ssh <サーバー名> -i ~/.ssh/conoha_mykey
# サーバー内で:
cd /opt/conoha/wordpress
docker compose exec db mysqldump -u root -p wordpress > backup.sql
```
