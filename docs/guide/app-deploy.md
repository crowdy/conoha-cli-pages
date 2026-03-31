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
conoha app init my-server --app-name hello-world
```

```
Initializing app "hello-world" on vm-18268c66-ae (133.88.116.147)...
==> Installing Docker...
==> Installing Docker Compose plugin...
==> Installing git...
==> Creating directories...
Initialized empty Git repository in /opt/conoha/hello-world.git/
==> Installing post-receive hook...
==> Done!

App "hello-world" initialized on vm-18268c66-ae (133.88.116.147).

Add the remote and deploy:
  git remote add conoha root@133.88.116.147:/opt/conoha/hello-world.git
  git push conoha main
```

Docker・Git のインストールとGitリポジトリの作成が自動で行われます。

::: tip app deploy を使う場合
`git push` の代わりに `conoha app deploy` でもデプロイできます。次のセクションでは `app deploy` を使う方法を紹介します。
:::

## 2. アプリのデプロイ

プロジェクトのディレクトリで実行します。

```bash
cd /path/to/your/project
conoha app deploy my-server
```

```
App name: hello-world
Archiving current directory...
Uploading to vm-18268c66-ae (133.88.116.147)...
Building and starting containers...
 Image hello-world-web Building
 ...
 Image hello-world-web Built
 Container hello-world-web-1 Creating
 Container hello-world-web-1 Created
 Container hello-world-web-1 Starting
 Container hello-world-web-1 Started
NAME                IMAGE             COMMAND                  SERVICE   CREATED                  STATUS                  PORTS
hello-world-web-1   hello-world-web   "/docker-entrypoint.…"   web       Less than a second ago   Up Less than a second   0.0.0.0:80->80/tcp
Deploy complete.
```

実行内容:
1. プロジェクトファイルをtarで圧縮
2. サーバーにSSHで転送
3. `docker compose up -d --build` を実行

`.dockerignore` があれば、記載されたファイルは除外されます。`.git/` ディレクトリは常に除外されます。

## 3. 動作確認

### ブラウザ/curlで確認

サーバーのIPアドレスにアクセスします。

```bash
curl 133.88.116.147
```

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Hello ConoHa</title>
</head>
<body>
  <h1>Hello from ConoHa!</h1>
  <p>Deployed with <code>conoha app deploy</code></p>
</body>
</html>
```

::: tip IPアドレスの確認
`conoha server show my-server` でサーバーのIPアドレスを確認できます。
:::

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

## git push でデプロイする方法

`app deploy` の代わりに `git push` でもデプロイできます。`app init` 実行時に表示されるコマンドを使います。

### SSH設定

`git push` を使うには、`~/.ssh/config` にサーバーのエントリが必要です。`conoha keypair create` で作成したキーを指定します:

```
Host conoha
    HostName 133.88.116.147
    User root
    IdentityFile ~/.ssh/conoha_my-key
```

### リモートの追加とpush

```bash
git remote add conoha conoha:/opt/conoha/hello-world.git
git push conoha main
```

```
Enumerating objects: 180, done.
...
remote: ==> Checking out main...
remote: Switched to branch 'main'
To conoha:/opt/conoha/hello-world.git
 * [new branch]      main -> main
```

::: warning IPアドレス直指定は非推奨
`root@133.88.116.147:/opt/conoha/...` 形式では SSH鍵が自動選択されず `Permission denied` になることがあります。SSH config のホスト名を使いましょう。
:::

## 次のステップ

- [アプリ管理](/guide/app-management) — 環境変数・削除・一覧
- [実践デプロイ例](/examples/nextjs) — フレームワーク別のデプロイ手順
