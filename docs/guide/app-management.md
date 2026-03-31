# アプリ管理

デプロイしたアプリの環境変数管理、削除、一覧表示を行います。

## 環境変数

### 環境変数を設定

```bash
conoha app env set <サーバー名> --app-name myapp DATABASE_URL=postgres://... SECRET_KEY=mysecret
```

複数の変数を一度に設定できます。

### 環境変数を確認

```bash
# 一覧
conoha app env list <サーバー名> --app-name myapp

# 特定の変数を取得
conoha app env get <サーバー名> --app-name myapp DATABASE_URL
```

### 環境変数を削除

```bash
conoha app env unset <サーバー名> --app-name myapp SECRET_KEY
```

### 環境変数の反映

環境変数を変更した後、アプリに反映するには再デプロイが必要です:

```bash
conoha app deploy <サーバー名> --app-name myapp
```

::: tip 仕組み
環境変数はサーバー上の `/opt/conoha/{app-name}.env.server` に保存されます。`app deploy` 実行時にこのファイルが `.env` としてコピーされ、docker composeから参照されます。
:::

## デプロイ済みアプリ一覧

```bash
conoha app list my-server
```

```
hello-world                    running (1)
myapp                          no containers
```

アプリ名とコンテナの状態（running / stopped / no containers）が表示されます。

## アプリの削除

```bash
conoha app destroy my-server --app-name hello-world
```

```
Destroy app "hello-world" on vm-18268c66-ae? All data will be deleted. [y/N]: y
==> Stopping containers...
==> Removing work directory...
==> Removing git repository...
==> Removing environment file...
==> Done.
App "hello-world" destroyed.
```

`--yes` で確認をスキップできます。

::: warning
削除すると以下がすべて消えます:
- コンテナ（停止・削除）
- 作業ディレクトリ（`/opt/conoha/myapp/`）
- Gitリポジトリ（`/opt/conoha/myapp.git/`）
- 環境変数ファイル（`/opt/conoha/myapp.env.server`）
:::
