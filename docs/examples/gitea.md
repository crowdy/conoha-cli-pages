# Gitea デプロイ

GiteaとPostgreSQLを使ったセルフホスティングGitサービスをConoHa VPSにデプロイする手順です。GitHub/GitLabの軽量代替として、自分のサーバーでGitリポジトリを管理したい方向け。


::: tip 本例は no-proxy モードで動作します
[アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。HTTPS / blue-green を使う場合は [Hello World](/examples/hello-world) や [Next.js](/examples/nextjs) の proxy モード版を参考にしてください。
:::

## 完成イメージ

- Gitea Web UI が `http://<サーバーIP>:3000` でアクセス可能
- Git SSH アクセスがポート `2222` で利用可能
- PostgreSQL 17 がデータストアとして稼働
- `conoha app deploy` でアップデートを即座に反映

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

## 1. compose.yml を作成

```yaml
services:
  gitea:
    image: gitea/gitea:latest
    ports:
      - "3000:3000"
      - "2222:22"
    environment:
      - GITEA__database__DB_TYPE=postgres
      - GITEA__database__HOST=db:5432
      - GITEA__database__NAME=gitea
      - GITEA__database__USER=gitea
      - GITEA__database__PASSWD=${DB_PASSWORD:-gitea}
    volumes:
      - gitea_data:/data
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:17-alpine
    environment:
      - POSTGRES_USER=gitea
      - POSTGRES_PASSWORD=${DB_PASSWORD:-gitea}
      - POSTGRES_DB=gitea
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gitea"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  gitea_data:
  db_data:
```

::: tip 公式イメージのみ使用
このサンプルはDockerfileなしで動作します。`gitea/gitea:latest` と `postgres:17-alpine` の公式イメージをそのまま使用します。
:::

## 2. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name gitea --no-proxy

# 環境変数を設定（パスワードを必ず変更してください）
conoha app env set <サーバー名> --app-name gitea \
  DB_PASSWORD=your_secure_password

# デプロイ
conoha app deploy <サーバー名> --app-name gitea --no-proxy
```

## 3. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name gitea

# ログ確認
conoha app logs <サーバー名> --app-name gitea
```

ブラウザで `http://<サーバーIP>:3000` にアクセスすると、初期セットアップ画面が表示されます。

```bash
# Git SSH アクセス
git clone ssh://git@<サーバーIP>:2222/user/repo.git
```

## 初期セットアップ

初回アクセス時にセットアップ画面が表示されます。以下の項目を確認してください:

- **データベース設定**: PostgreSQL（compose.ymlの設定が自動入力されます）
- **サーバーURL**: `http://<サーバーIP>:3000`
- **SSH サーバードメイン**: `<サーバーIP>`
- **SSH ポート**: `2222`
- **管理者アカウント**: ページ下部で管理者ユーザーを作成

## 環境変数でカスタマイズ

`GITEA__` プレフィックスの環境変数でGiteaの設定を変更できます:

```bash
conoha app env set <サーバー名> --app-name gitea \
  DB_PASSWORD=your_secure_password \
  GITEA__server__DOMAIN=git.example.com \
  GITEA__server__ROOT_URL=https://git.example.com \
  GITEA__service__DISABLE_REGISTRATION=true

# 再デプロイで反映
conoha app deploy <サーバー名> --app-name gitea --no-proxy
```

## コード更新

設定を変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name gitea --no-proxy
```
