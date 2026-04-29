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
| `--proxy` | proxy モードを強制（マーカーと不一致ならエラー） |
| `--no-proxy` | no-proxy モードを強制（`--proxy` と排他） |
| `--data-dir` | サーバー側 conoha-proxy データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |
| `--insecure` | known_hosts 検証をスキップ（TOFU を無効化） |

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
| `--proxy` | proxy モードを強制（マーカーと不一致ならエラー） |
| `--no-proxy` | no-proxy モードを強制（`--proxy` と排他） |
| `--slot` | slot ID を固定（既定: git short SHA / timestamp、`[a-z0-9][a-z0-9-]{0,63}` 制約） |
| `--data-dir` | サーバー側 conoha-proxy データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |
| `--insecure` | known_hosts 検証をスキップ（TOFU を無効化） |

### 動作

1. プロジェクトファイルをtarで圧縮（`.dockerignore` と `.git/` を除外）
2. サーバーにSSHで転送
3. `.env.server` があれば `.env` にコピー
4. `docker compose up -d --build` を実行

---

## app rollback

drain 窓内に直前のスロットへ即時ロールバックします（proxy モードのみ）。`expose:` ブロックを持つ multi-host アプリでは既定でルート + 全ブロックを逆順にロールバックします。

### 使い方

```bash
conoha app rollback <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--app-name` | アプリ名 |
| `--proxy` | proxy モードを強制（マーカーと不一致ならエラー） |
| `--no-proxy` | no-proxy モードを強制（`--proxy` と排他） |
| `--target` | 単一ブロックのみロールバック: `web` または `expose:` の label（既定: 全ブロック） |
| `--drain-ms` | 戻し先の drain 窓をミリ秒で上書き（`0` = proxy 既定） |
| `--data-dir` | サーバー側 conoha-proxy データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |
| `--insecure` | known_hosts 検証をスキップ（TOFU を無効化） |
| `--identity`, `-i` | SSH秘密鍵のパス |
| `--user`, `-l` | SSHユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |

### 動作

1. proxy 側に旧スロットがまだ drain 中であることを確認
2. Admin API 経由で target_url を旧スロットに切り戻し
3. drain 窓を `--drain-ms`（または既定）に再設定
4. multi-host アプリで `--target` 未指定時は expose ブロックを宣言の逆順で同様に切り戻し（窓が閉じたブロックは警告のみで継続）

### 制限

- no-proxy モードでは利用不可（実行すると `rollback is not supported in no-proxy mode` エラー）
- drain 窓を過ぎたスロットはロールバック不能。コミットを checkout して再 deploy してください

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
| `--proxy` | proxy モードを強制（マーカーと不一致ならエラー） |
| `--no-proxy` | no-proxy モードを強制（`--proxy` と排他） |
| `--insecure` | known_hosts 検証をスキップ（TOFU を無効化） |

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
| `--proxy` | proxy モードを強制（マーカーと不一致ならエラー） |
| `--no-proxy` | no-proxy モードを強制（`--proxy` と排他） |
| `--data-dir` | サーバー側 conoha-proxy データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |
| `--insecure` | known_hosts 検証をスキップ（TOFU を無効化） |

### `--format json` のスキーマ

```json
{
  "root": { "service": "web", "containers": [...] },
  "expose": [
    { "label": "dex", "service": "dex", "containers": [...] }
  ]
}
```

`expose` ブロックを持たないアプリでは `"expose": []`。`conoha.yml` がローカルにない場合は `root` のみが返り、`expose` フィールドは省略されます（v0.7.0+ の graceful degrade）。

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
| `--proxy` | proxy モードを強制（マーカーと不一致ならエラー） |
| `--no-proxy` | no-proxy モードを強制（`--proxy` と排他） |
| `--insecure` | known_hosts 検証をスキップ（TOFU を無効化） |

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
| `--proxy` | proxy モードを強制（マーカーと不一致ならエラー） |
| `--no-proxy` | no-proxy モードを強制（`--proxy` と排他） |
| `--insecure` | known_hosts 検証をスキップ（TOFU を無効化） |

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
| `--yes`, `-y` | 確認プロンプトをスキップ（非対話実行向け） |
| `--identity`, `-i` | SSH秘密鍵のパス |
| `--user`, `-l` | SSHユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |
| `--proxy` | proxy モードを強制（マーカーと不一致ならエラー） |
| `--no-proxy` | no-proxy モードを強制（`--proxy` と排他） |
| `--data-dir` | サーバー側 conoha-proxy データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |
| `--insecure` | known_hosts 検証をスキップ（TOFU を無効化） |

### 削除されるもの

- コンテナ（停止・削除）
- 作業ディレクトリ（`/opt/conoha/{app-name}/`）
- Gitリポジトリ（`/opt/conoha/{app-name}.git/`）
- 環境変数ファイル（`/opt/conoha/{app-name}.env.server`）

---

## app reset

`app destroy` → `app init` → `app deploy` を1コマンドでまとめて実行し、アプリをクリーンな状態から再デプロイします。

### 使い方

```bash
conoha app reset <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--app-name` | アプリ名 |
| `--yes`, `-y` | 確認プロンプトをスキップ（非対話実行向け） |
| `--identity`, `-i` | SSH秘密鍵のパス |
| `--user`, `-l` | SSHユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |
| `--proxy` | proxy モードを強制（マーカーと不一致ならエラー） |
| `--no-proxy` | no-proxy モードを強制（`--proxy` と排他） |
| `--slot` | slot ID を固定（既定: git short SHA / timestamp、`[a-z0-9][a-z0-9-]{0,63}` 制約） |
| `--data-dir` | サーバー側 conoha-proxy データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |
| `--insecure` | known_hosts 検証をスキップ（TOFU を無効化） |

### 動作

3フェーズで実行されます。

1. **destroy** — 既存のコンテナ、作業ディレクトリ、Gitリポジトリ、環境変数ファイルを削除
2. **init** — アプリの受け口を再作成
3. **deploy** — カレントディレクトリのプロジェクトをデプロイ

::: tip いつ使うか
デプロイ状態（スロット、作業ディレクトリ、環境変数など）を破棄して、現在の `conoha.yml` とリポジトリを最初から適用し直したいときに使います。CI や AI エージェントなどの非対話環境では `--yes` を付けて実行します。
:::

::: warning
`app destroy` と同等の削除処理を含みます。環境変数ファイル（`.env.server`）も消えるため、必要であれば事前に `app env list` でバックアップしてください。
:::
