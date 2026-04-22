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

::: warning `--app-name` は DNS-1123 ラベル
`--app-name` には小文字英数字とハイフンのみを使ってください（アンダースコア不可、63 文字以内）。これは `conoha.yml` の `name` フィールドと同じ形式で、これを守らないと `--proxy` モードで `init/deploy` と `destroy` のパス解決が食い違い、サーバー側の `/opt/conoha/<name>/` が残留することがあります。
:::

## Blue/Green (`--proxy`) モードでの固定ポートバインディング回避

`--proxy` モード（conoha-proxy と組み合わせる Blue/Green デプロイ）では、CLI が各スロットに**動的なホストポート**を割り当ててリバースプロキシ経由で公開します。したがって `compose.yml` に `ports: "3000:3000"` のような**ホスト側固定ポートバインディング**があると、2 回目のデプロイ（green slot）でホストポート競合が発生してデプロイが失敗します。

対処法は 2 つあります:

1. `compose.yml` の `ports:` を `expose:` に書き換える（シンプル・推奨）
2. プロジェクトルートに **`conoha-docker-compose.yml`** を置いて `compose.yml` の代わりに使う（`compose.yml` を変更したくない場合）

CLI は次の順にコンパイル対象ファイルを探すため、`conoha-docker-compose.yml` が存在すれば優先して使用されます:

```
conoha-docker-compose.yml → conoha-docker-compose.yaml →
docker-compose.yml        → docker-compose.yaml        →
compose.yml               → compose.yaml
```

### 書き換え例

**元の `compose.yml`（`--no-proxy` 用）:**

```yaml
services:
  web:
    build: .
    ports:
      - "3000:3000"
  db:
    image: postgres:16
```

**`--proxy` 用の `conoha-docker-compose.yml`:**

```yaml
services:
  web:
    build: .
    expose:
      - "3000"
  db:
    image: postgres:16
```

`expose:` はコンテナ内部ポートの宣言のみで、ホスト側にはバインドされません。conoha-proxy は同じ Docker ネットワーク内からコンテナに到達できるため、これで Blue/Green の並行デプロイが可能になります。

::: tip 既存サンプルの検証について
[conoha-cli-app-samples](https://github.com/crowdy/conoha-cli-app-samples) リポジトリのサンプルは主に `--no-proxy` モードを想定しており、`ports:` 固定バインディングを持つものが多いです。`--proxy` モードで使う場合は、上記の override パターンで `conoha-docker-compose.yml` を追加するのが実用的です。
:::

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
