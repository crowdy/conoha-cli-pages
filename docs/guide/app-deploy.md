# アプリデプロイ

ConoHa CLIを使えば、Dockerfileがあるプロジェクトをコマンド一発でデプロイできます。

## 前提条件

- サーバーが作成済み（[サーバー管理](/guide/server)を参照）
- サーバーにDockerがインストール済み
- プロジェクトに `Dockerfile` と `docker-compose.yml` がある

## デプロイの流れ

```
app init → app deploy → app logs で確認
```

## 1. アプリの初期化

サーバー上にアプリの受け口を作成します。

```bash
conoha app init <サーバー名> --app-name myapp
```

これにより、サーバー上に以下が作成されます:
- `/opt/conoha/myapp/` — 作業ディレクトリ
- `/opt/conoha/myapp.git/` — Gitリポジトリ（push受信用）
- post-receiveフック — push時に自動で `docker compose up -d`

## 2. アプリのデプロイ

プロジェクトのディレクトリで実行します。

```bash
cd /path/to/your/project
conoha app deploy <サーバー名> --app-name myapp
```

実行内容:
1. プロジェクトファイルをtarで圧縮
2. サーバーにSSHで転送
3. `docker compose up -d --build` を実行

`.dockerignore` があれば、記載されたファイルは除外されます。`.git/` ディレクトリは常に除外されます。

## 3. 動作確認

### ログを見る

```bash
conoha app logs <サーバー名> --app-name myapp
```

リアルタイムでフォロー:

```bash
conoha app logs <サーバー名> --app-name myapp --follow
```

### ステータス確認

```bash
conoha app status <サーバー名> --app-name myapp
```

コンテナの状態（running/stopped）が表示されます。

## アプリの再デプロイ

コードを変更したら、同じコマンドで再デプロイできます:

```bash
conoha app deploy <サーバー名> --app-name myapp
```

## アプリの停止・再起動

```bash
# 停止
conoha app stop <サーバー名> --app-name myapp

# 再起動
conoha app restart <サーバー名> --app-name myapp
```

## docker-compose.yml の例

```yaml
services:
  web:
    build: .
    ports:
      - "80:3000"
    restart: unless-stopped
```

## 次のステップ

- [アプリ管理](/guide/app-management) — 環境変数・削除・一覧
- [実践デプロイ例](/examples/nextjs) — フレームワーク別のデプロイ手順
