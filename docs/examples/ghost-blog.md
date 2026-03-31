# Ghost ブログ デプロイ

Ghost と MySQL の公式 Docker イメージを使ったブログプラットフォームを ConoHa VPS にデプロイするサンプルです。WordPress の代替として人気が高まっています。

## 完成イメージ

- Ghost ブログが `http://<サーバーIP>:2368` でアクセス可能
- 管理画面が `http://<サーバーIP>:2368/ghost/` でアクセス可能
- データは Docker ボリュームに永続化

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）
- RAM 2GB 以上のフレーバー推奨（Ghost + MySQL の同時起動のため）

## 1. compose.yml を作成

Ghost と MySQL の公式イメージを使用するため、Dockerfile は不要です。

```yaml
services:
  ghost:
    image: ghost:5
    ports:
      - "2368:2368"
    environment:
      - url=http://localhost:2368
      - database__client=mysql
      - database__connection__host=db
      - database__connection__user=ghost
      - database__connection__password=${GHOST_DB_PASSWORD:-ghost}
      - database__connection__database=ghost
    volumes:
      - ghost_data:/var/lib/ghost/content
    depends_on:
      db:
        condition: service_healthy

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD:-rootpassword}
      - MYSQL_DATABASE=ghost
      - MYSQL_USER=ghost
      - MYSQL_PASSWORD=${GHOST_DB_PASSWORD:-ghost}
    volumes:
      - db_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  ghost_data:
  db_data:
```

## 2. 環境変数を設定

パスワードは必ず変更してください。デフォルト値のまま本番環境にデプロイしないようにしてください。

```bash
conoha app env set <サーバー名> --app-name ghost \
  MYSQL_ROOT_PASSWORD=your_strong_root_password \
  GHOST_DB_PASSWORD=your_strong_ghost_password
```

## 3. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name ghost

# デプロイ
conoha app deploy <サーバー名> --app-name ghost
```

## 4. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name ghost

# ログ確認（MySQL の起動完了まで少し時間がかかります）
conoha app logs <サーバー名> --app-name ghost
```

ブラウザで以下にアクセスして確認します。

- ブログ: `http://<サーバーIP>:2368`
- 管理画面: `http://<サーバーIP>:2368/ghost/`

初回アクセス時に管理者アカウントのセットアップ画面が表示されます。

::: tip MySQL の起動待機について
`depends_on` の `condition: service_healthy` により、MySQL が完全に起動するまで Ghost の起動が待機されます。初回デプロイ時はログに `Waiting for database...` のようなメッセージが表示されることがありますが正常です。
:::

## ドメインを設定する場合

独自ドメインを使用する場合は、`url` 環境変数を更新します。

```bash
conoha app env set <サーバー名> --app-name ghost \
  url=https://blog.example.com

conoha app deploy <サーバー名> --app-name ghost
```

## コード更新

compose.yml を変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name ghost
```

::: warning データの永続化
Ghost のコンテンツ（投稿・画像・テーマ）は `ghost_data` ボリュームに、MySQL のデータは `db_data` ボリュームに保存されます。サーバーを削除するとデータも失われるため、定期的にバックアップを取得してください。
:::
