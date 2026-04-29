# proxy

ConoHa VPS 上の [conoha-proxy](https://github.com/crowdy/conoha-proxy) リバースプロキシを管理するコマンドグループ。proxy モードで `conoha app deploy` を使う場合は先に `proxy boot` が必要。

## 共通オプション

すべての `proxy` サブコマンドで使用できる SSH 接続オプションです。

| オプション | 説明 |
|-----------|------|
| `--user`, `-l` | SSHユーザー名（デフォルト: `root`） |
| `--port`, `-p` | SSHポート（デフォルト: `22`） |
| `--identity`, `-i` | SSH秘密鍵のパス |

---

## proxy boot

conoha-proxy をサーバーにインストールして起動します。

### 使い方

```bash
conoha proxy boot <サーバー名> --acme-email <メールアドレス> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--acme-email` | Let's Encrypt 登録用メールアドレス（**必須**） |
| `--image` | conoha-proxy Docker イメージ（デフォルト: `ghcr.io/crowdy/conoha-proxy:latest`） |
| `--data-dir` | ホスト側データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |
| `--container` | Docker コンテナ名（デフォルト: `conoha-proxy`） |
| `--wait-timeout` | コンテナがヘルシーになるまでの最大待機時間（デフォルト: `30s`、`0` で無効） |

### 動作

1. Docker / docker compose の存在を確認します。
2. `--data-dir` を作成し、UID 65532（nonroot）に所有権を委譲します。
3. UFW で 80/443 を開放し、`net.ipv4.ip_unprivileged_port_start=0` を `/etc/sysctl.d/99-conoha-proxy.conf` に書き込みます。
4. `docker run` でコンテナを起動します。Admin Unix socket は `<data-dir>/admin.sock` に配置されます。
5. `--wait-timeout` 内に 3 回連続で `running` 状態 かつ `/healthz` が HTTP 200 を返すことを確認して成功とします。タイムアウト時は直近 20 行のコンテナログを stderr に出力します。

---

## proxy reboot

最新イメージをプルしてコンテナを再作成します。`acme-email` その他の起動フラグは `boot` と同じものを再指定する必要があります — 既存コンテナの設定は引き継がれません。

### 使い方

```bash
conoha proxy reboot <サーバー名> --acme-email <メールアドレス> [flags]
```

### オプション

`boot` と同一のフラグを受け付けます。

| オプション | 説明 |
|-----------|------|
| `--acme-email` | Let's Encrypt 登録用メールアドレス（**必須**） |
| `--image` | conoha-proxy Docker イメージ（デフォルト: `ghcr.io/crowdy/conoha-proxy:latest`） |
| `--data-dir` | ホスト側データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |
| `--container` | Docker コンテナ名（デフォルト: `conoha-proxy`） |
| `--wait-timeout` | コンテナがヘルシーになるまでの最大待機時間（デフォルト: `30s`、`0` で無効） |

---

## proxy start / stop / restart

コンテナの起動・停止・再起動を行います。

### 使い方

```bash
conoha proxy start   <サーバー名> [flags]
conoha proxy stop    <サーバー名> [flags]
conoha proxy restart <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--container` | Docker コンテナ名（デフォルト: `conoha-proxy`） |

---

## proxy remove

conoha-proxy コンテナを削除します。データボリュームは既定で残るため、登録済みサービス・証明書・状態は保持されます。完全消去には `--purge` を指定してください。

### 使い方

```bash
conoha proxy remove <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--container` | Docker コンテナ名（デフォルト: `conoha-proxy`） |
| `--data-dir` | ホスト側データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |
| `--purge` | ホスト側データディレクトリも削除する |

---

## proxy logs

conoha-proxy コンテナのログを表示します。

### 使い方

```bash
conoha proxy logs <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--container` | Docker コンテナ名（デフォルト: `conoha-proxy`） |
| `--follow`, `-f` | ログをリアルタイムでフォロー |
| `--tail` | 末尾から表示する行数（デフォルト: `0` = 全行） |

---

## proxy details

バージョンと readiness を表示します。Admin API `/v1/version` を Unix socket 経由で取得した結果を出力します。

### 使い方

```bash
conoha proxy details <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--data-dir` | ホスト側データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |

---

## proxy services

登録されているプロキシサービスの一覧を表示します。`conoha app init` 済みのアプリと expose ブロックが `<アプリ名>` / `<アプリ名>-<label>` 形式で並びます。

### 使い方

```bash
conoha proxy services <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--data-dir` | ホスト側データディレクトリ（デフォルト: `/var/lib/conoha-proxy`） |
