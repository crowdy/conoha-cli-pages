# app

アプリケーションのデプロイと管理を行うコマンドグループです。

## app init

サーバー上にアプリの受け口を作成します。

### 使い方

```bash
conoha app init <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--app-name` | アプリ名 |
| `--identity`, `-i` | SSH秘密鍵のパス |
| `--user`, `-l` | SSHユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |

---

## app deploy

カレントディレクトリのプロジェクトをサーバーにデプロイします。

### 使い方

```bash
conoha app deploy <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--app-name` | アプリ名 |
| `--identity`, `-i` | SSH秘密鍵のパス |
| `--user`, `-l` | SSHユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |

### 動作

1. プロジェクトファイルをtarで圧縮（`.dockerignore` と `.git/` を除外）
2. サーバーにSSHで転送
3. `.env.server` があれば `.env` にコピー
4. `docker compose up -d --build` を実行

---

## app logs

アプリのコンテナログを表示します。

### 使い方

```bash
conoha app logs <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--app-name` | アプリ名 |
| `--follow`, `-f` | リアルタイムでフォロー |
| `--tail` | 末尾の行数（デフォルト: 100） |
| `--service` | 特定のサービス名 |
| `--identity`, `-i` | SSH秘密鍵のパス |
| `--user`, `-l` | SSHユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |

---

## app status

アプリのコンテナ状態を表示します。

### 使い方

```bash
conoha app status <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--app-name` | アプリ名 |
| `--identity`, `-i` | SSH秘密鍵のパス |
| `--user`, `-l` | SSHユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |

---

## app stop

アプリのコンテナを停止します。

### 使い方

```bash
conoha app stop <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--app-name` | アプリ名 |
| `--identity`, `-i` | SSH秘密鍵のパス |
| `--user`, `-l` | SSHユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |

---

## app restart

アプリのコンテナを再起動します。

### 使い方

```bash
conoha app restart <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--app-name` | アプリ名 |
| `--identity`, `-i` | SSH秘密鍵のパス |
| `--user`, `-l` | SSHユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |

---

## app env set

環境変数を設定します。

### 使い方

```bash
conoha app env set <サーバー名> --app-name <アプリ名> KEY=VALUE [KEY=VALUE...]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--app-name` | アプリ名 |
| `--identity`, `-i` | SSH秘密鍵のパス |
| `--user`, `-l` | SSHユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |

### 例

```bash
conoha app env set myserver --app-name myapp DATABASE_URL=postgres://... SECRET_KEY=abc123
```

::: tip
設定後、`app deploy` で再デプロイすると反映されます。
:::

---

## app env get

特定の環境変数の値を取得します。

### 使い方

```bash
conoha app env get <サーバー名> --app-name <アプリ名> KEY
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--app-name` | アプリ名 |
| `--identity`, `-i` | SSH秘密鍵のパス |
| `--user`, `-l` | SSHユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |

---

## app env list

設定済みの環境変数一覧を表示します。

### 使い方

```bash
conoha app env list <サーバー名> --app-name <アプリ名>
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--app-name` | アプリ名 |
| `--identity`, `-i` | SSH秘密鍵のパス |
| `--user`, `-l` | SSHユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |

---

## app env unset

環境変数を削除します。

### 使い方

```bash
conoha app env unset <サーバー名> --app-name <アプリ名> KEY [KEY...]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--app-name` | アプリ名 |
| `--identity`, `-i` | SSH秘密鍵のパス |
| `--user`, `-l` | SSHユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |

---

## app list

サーバー上のデプロイ済みアプリ一覧を表示します。

### 使い方

```bash
conoha app list <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--identity`, `-i` | SSH秘密鍵のパス |
| `--user`, `-l` | SSHユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |

---

## app destroy

アプリとそのデータをすべて削除します。

### 使い方

```bash
conoha app destroy <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--app-name` | アプリ名 |
| `--identity`, `-i` | SSH秘密鍵のパス |
| `--user`, `-l` | SSHユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |

### 削除されるもの

- コンテナ（停止・削除）
- 作業ディレクトリ（`/opt/conoha/{app-name}/`）
- Gitリポジトリ（`/opt/conoha/{app-name}.git/`）
- 環境変数ファイル（`/opt/conoha/{app-name}.env.server`）
