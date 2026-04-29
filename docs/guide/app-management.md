# アプリ管理

デプロイしたアプリの環境変数管理、ロールバック、削除、一覧表示を行います。デプロイ自体は [アプリデプロイ](/guide/app-deploy) を参照してください。

## 環境変数

### 環境変数を設定

```bash
conoha app env set <サーバー名> --app-name myapp DATABASE_URL=postgres://... SECRET_KEY=mysecret
```

複数の変数を一度に設定できます。

::: warning proxy モードでの制限
`app env set` は両モードで動きますが、**現状 proxy モードのデプロイには値が反映されません** ([#94](https://github.com/crowdy/conoha-cli/issues/94) で再設計予定)。proxy モードで実行すると `warning: app env has no effect on proxy-mode deployed slots` が出ます。proxy モードでは当面 compose ファイルの `environment:` / `env_file:` でアプリ設定を渡してください。
:::

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

## ロールバック (proxy モードのみ)

proxy モードのアプリは drain 窓内であれば直前のスロットに即時ロールバックできます。

```bash
conoha app rollback my-server --app-name hello-world
```

`expose:` ブロックを持つ multi-host アプリでは既定でルート + 全ブロックを宣言の逆順でロールバックします。drain 窓を過ぎたブロックは警告のみでスキップされ、残りは継続して処理されます。

特定のブロックだけロールバックしたい場合は `--target` を使います。

```bash
# ルートだけ
conoha app rollback my-server --target=web

# expose ブロックだけ
conoha app rollback my-server --target=dex
```

`--drain-ms <ms>` で戻し先の drain 窓を上書きできます (`0` で proxy 既定)。

::: warning no-proxy モードでは利用不可
no-proxy モードには blue/green swap が無いため `rollback` は使えません (`rollback is not supported in no-proxy mode` エラー)。コミットを checkout して再 deploy してください。
:::

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

## クリーンな状態から再デプロイ

`app reset` は `app destroy` → `app init` → `app deploy` を1コマンドにまとめたものです。デプロイ状態を破棄して、現在の `conoha.yml` とリポジトリを最初から適用し直したいときに使います。

```bash
conoha app reset my-server --app-name hello-world
```

```
Reset app "hello-world" on vm-18268c66-ae? All data will be deleted and re-deployed. [y/N]: y
==> Phase 1/3: destroying current deployment
==> Phase 2/3: re-initializing
==> Phase 3/3: deploying
```

CI や AI エージェントなどの非対話環境では `--yes` を付けて実行します:

```bash
conoha app reset my-server --app-name hello-world --yes
```

::: warning
`app destroy` と同様にデータがすべて消えます。残しておきたい環境変数があれば、事前に `app env list` で控えておいてください。
:::
