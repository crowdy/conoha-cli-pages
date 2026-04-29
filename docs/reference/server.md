# server

サーバー（VM）の管理を行うコマンドグループです。

## サーバーの指定方法 {#server-identifier}

多くのサーバーコマンドでは `<サーバー名またはID>` を引数に取ります。以下の3つの方法でサーバーを指定できます：

| 指定方法 | 例 | 説明 |
|---------|---|------|
| UUID | `1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d` | サーバーID（完全一致） |
| VM名 | `vps-1234567` | ConoHaが自動付与するVM名 |
| ネームタグ | `my-web-server` | ユーザーが設定した名前（`instance_name_tag`） |

::: tip ネームタグを使うと便利です
UUIDやランダムなVM名の代わりに、覚えやすいネームタグでサーバーを指定できます。ネームタグはサーバー作成時に `--name` で設定され、`server rename` で変更できます。

```bash
# UUIDの代わりにネームタグで操作
conoha server stop my-web-server
conoha server ssh my-web-server
```
:::

::: warning 優先順位
VM名とネームタグが同じ文字列の場合、VM名が優先されます。同じネームタグを持つサーバーが複数ある場合はエラーになるため、UUIDを使用してください。
:::

---

## server list

サーバー一覧を表示します。

### 使い方

```bash
conoha server list
```

### 例

```bash
# テーブル形式
conoha server list

# JSON形式
conoha server list --format json

# フィルタリング
conoha server list --filter status=ACTIVE
```

---

## server show

サーバーの詳細情報を表示します。

### 使い方

```bash
conoha server show <サーバー名またはID>
```

---

## server create

新しいサーバーを作成します。

### 使い方

```bash
conoha server create [flags]
```

### オプション

| オプション | 説明 | 必須 |
|-----------|------|------|
| `--name` | サーバー名 | ○ |
| `--flavor` | フレーバー ID または名前（例: `g2l-t-c2m1d100`、省略時はインタラクティブ選択） | |
| `--image` | イメージ名または ID（省略時はインタラクティブ選択） | |
| `--key-name` | SSHキーペア名（省略時はインタラクティブ選択） | |
| `--volume` | ブートディスクとして使用する既存ボリュームID | |
| `--security-group` | セキュリティグループ名（複数指定可、省略時はインタラクティブ選択） | |
| `--for` | プリセット名 — `flavor` / `image` / `security-group` を一括指定（[後述](#プリセット-for)） | |
| `--admin-pass` | 管理者パスワード | |
| `--user-data` | 起動スクリプトファイルパス | |
| `--user-data-raw` | 起動スクリプト文字列（インライン） | |
| `--user-data-url` | 起動スクリプトURL（`#include`でラップ） | |
| `--wait` | サーバーがACTIVEになるまで待機 | |
| `--wait-timeout` | 待機タイムアウト時間 | |

::: tip インタラクティブモード
`--name` 以外のオプションを省略すると、対話形式で選択できます。`--flavor`、`--image`、`--key-name`、`--security-group` はそれぞれ利用可能な一覧から選択できます。
:::

::: tip 非インタラクティブモード（スクリプト・CI/CD）
TTYが利用できない環境（CI/CD、スクリプト、自動化ツール）では、`--flavor`、`--image`、`--key-name`、`--security-group` をフラグで指定するとプロンプトなしで実行できます。ブートボリュームは `{サーバー名}-boot` として自動作成されます（サイズはフレーバーに応じて決定、`g2l-t-c2m1d100` など `d100` 付きフレーバーで100GB）。確認プロンプトをスキップするには `-y` フラグを使用してください。

既存ボリュームを使用したい場合は `--volume` フラグで明示的に指定してください。
:::

::: tip 起動スクリプト
`--user-data`、`--user-data-raw`、`--user-data-url` は同時に1つのみ指定できます。最大16KiBまでです。
:::

### プリセット (`--for`) {#プリセット-for}

`--for <preset>` でフレーバー / イメージ / セキュリティグループをまとめて埋められます。明示フラグは常に優先されます (security group は明示指定するとプリセットを **置き換え**、追記しません)。

| プリセット | 用途 | flavor | image | security-group |
|---|---|---|---|---|
| `proxy` | conoha-proxy 用 VPS | `g2l-t-c3m2` | 最新の `vmi-docker-*-ubuntu-*-amd64` | `default,IPv4v6-SSH,IPv4v6-Web,IPv4v6-ICMP` |

イメージはプリセット適用時に `ListImages` で動的解決されます (lex 降順で active なものを選択)。CLI バイナリに古い ID を埋め込まないための仕組みです。

未知のプリセット名はエラー (既知のプリセット一覧が表示されます)。プリセットの security group が存在しない場合は事前検証で停止します。

```bash
conoha server create --no-input --yes --wait \
  --name myproxy --key-name my-key --for proxy
```

### 例

```bash
# 必須オプションのみ（他はインタラクティブ選択）
conoha server create --name myserver

# すべてのオプションを指定
conoha server create \
  --name myserver \
  --flavor g2l-t-c2m1d100 \
  --image ubuntu-24.04 \
  --key-name mykey \
  --security-group IPv4v6-SSH \
  --security-group IPv4v6-Web

# 起動スクリプト付き
conoha server create \
  --name myserver \
  --flavor g2l-t-c2m1d100 \
  --image ubuntu-24.04 \
  --key-name mykey \
  --user-data ./setup.sh

# 作成完了まで待機
conoha server create \
  --name myserver \
  --flavor g2l-t-c2m1d100 \
  --image ubuntu-24.04 \
  --key-name mykey \
  --wait

# スクリプト・CI/CDでの使用（非インタラクティブ）
conoha server create \
  --name myserver \
  --flavor g2l-t-c2m1d100 \
  --image ubuntu-24.04 \
  --key-name mykey \
  --security-group IPv4v6-SSH \
  --wait -y
```

---

## server delete

サーバーを削除します。確認プロンプトあり。

### 使い方

```bash
conoha server delete <サーバー名またはID> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--delete-boot-volume` | サーバー削除後にブートボリュームも削除（`-y` と併用推奨） |

::: tip ブートボリュームの孤立を避ける
非インタラクティブモードで自動作成したブートボリュームは、サーバー削除後に残り続けます。同じ名前で再作成すると `volume create` の重複名警告にぶつかったり、`server create` のブート用ボリューム自動作成に失敗したりします。`--delete-boot-volume` を付けるとサーバーと同時に該当ボリュームも削除します。
:::

---

## server start

停止中のサーバーを起動します。

### 使い方

```bash
conoha server start <サーバー名またはID>
```

---

## server stop

サーバーを停止します。

### 使い方

```bash
conoha server stop <サーバー名またはID>
```

---

## server reboot

サーバーを再起動します。

### 使い方

```bash
conoha server reboot <サーバー名またはID>
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--hard` | ハードリブート |

---

## server resize

サーバーのスペックを変更します。

### 使い方

```bash
conoha server resize <サーバー名またはID> --flavor <フレーバーID>
```

---

## server rebuild

サーバーを新しいイメージで再構築します。

### 使い方

```bash
conoha server rebuild <サーバー名またはID> --image <イメージ名またはID>
```

---

## server rename

サーバー名を変更します。

### 使い方

```bash
conoha server rename <サーバー名またはID> --name <新しい名前>
```

---

## server ssh

サーバーにSSH接続します。

### 使い方

```bash
conoha server ssh <サーバー名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--identity`, `-i` | 秘密鍵のパス（未指定時は `~/.ssh/conoha_<KeyName>` を自動検出） |
| `--user`, `-l` | ユーザー名（デフォルト: root） |
| `--port`, `-p` | SSHポート（デフォルト: 22） |

### 例

```bash
conoha server ssh myserver --identity ~/.ssh/conoha_mykey

# 任意のコマンドをリモート実行
conoha server ssh myserver -- uptime
```

### known_hosts / TOFU

`server ssh` を含むすべての SSH 接続コマンドは `~/.ssh/known_hosts` でホスト鍵を検証します（v0.6.1+ 以降）。初回接続時はホスト鍵を保存する **Trust On First Use (TOFU)** で動作します。グローバルフラグ `--insecure` で検証をスキップできます (推奨されません — 検証用 / 使い捨て VPS のみ)。

---

## server deploy

サーバー上でスクリプトを実行します。

### 使い方

```bash
conoha server deploy <サーバー名> --script <スクリプトファイル>
```

---

## server console

VNCコンソールのURLを取得します。

### 使い方

```bash
conoha server console <サーバー名またはID>
```

---

## server ips

サーバーのIPアドレス一覧を表示します。

### 使い方

```bash
conoha server ips <サーバー名またはID>
```

---

## server metadata

サーバーのメタデータを表示します。

### 使い方

```bash
conoha server metadata <サーバー名またはID>
```

---

## server add-security-group

サーバーにセキュリティグループを追加します。エイリアス: `add-sg`。

### 使い方

```bash
conoha server add-security-group <サーバー名またはID> --name <セキュリティグループ名>
```

### オプション

| オプション | 説明 | 必須 |
|-----------|------|------|
| `--name` | セキュリティグループ名 | ○ |

### 例

```bash
conoha server add-security-group my-web-server --name IPv4v6-Web
```

::: tip
v0.5.3 以降は Neutron port API を経由してセキュリティグループを反映します ([#64](https://github.com/crowdy/conoha-cli/pull/64))。`server show` で適用結果を確認できます。
:::

---

## server remove-security-group

サーバーからセキュリティグループを削除します。エイリアス: `remove-sg`。

### 使い方

```bash
conoha server remove-security-group <サーバー名またはID> --name <セキュリティグループ名>
```

### オプション

| オプション | 説明 | 必須 |
|-----------|------|------|
| `--name` | セキュリティグループ名 | ○ |

### 例

```bash
conoha server remove-security-group my-web-server --name IPv4v6-Web
```

---

## server open-port

カスタムセキュリティグループにイングレスルールを追加してポートを開放するショートカットコマンドです。サーバーにカスタム SG が無ければ `<server-name>-sg` を自動作成してアタッチします。

### 使い方

```bash
conoha server open-port <サーバー名またはID> <ports> [flags]
```

`<ports>` はカンマ区切りの単一ポートまたは範囲です。

```
7860
7860,8080
7860,8080,9000-9010
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--sg` | 対象 SG 名（デフォルト: `<server-name>-sg`、無ければ自動作成） |
| `--remote-ip` | 接続元 CIDR（デフォルト: `0.0.0.0/0`、IPv6 も可） |
| `--protocol` | プロトコル: `tcp` / `udp`（デフォルト: `tcp`、`icmp` 非対応） |

### 動作

1. サーバーに紐付くカスタム SG を解決（無ければ作成）
2. 既存ルールと重複するレンジは「Skipped」と stderr に出力
3. 残りのレンジを `CreateSecurityGroupRule` で順次追加
4. 1 件以上失敗すると非 0 終了。各失敗の詳細は stderr に出力

### 例

```bash
# Web サーバー用に 80/443 を開放
conoha server open-port my-server 80,443

# 開発用に範囲開放（社内 CIDR から限定）
conoha server open-port my-dev 8080-8090 --remote-ip 10.0.0.0/8

# UDP も可
conoha server open-port my-vpn 51820 --protocol udp
```

---

## server attach-volume

ボリュームをサーバーにアタッチします。

### 使い方

```bash
conoha server attach-volume <サーバー名またはID> --volume <ボリュームID>
```

---

## server detach-volume

ボリュームをサーバーからデタッチします。

### 使い方

```bash
conoha server detach-volume <サーバー名またはID> --volume <ボリュームID>
```
