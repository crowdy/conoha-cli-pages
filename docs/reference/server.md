# server

サーバー（VM）の管理を行うコマンドグループです。

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
| `--flavor` | フレーバーID | ○ |
| `--image` | イメージ名またはID | ○ |
| `--key-name` | SSHキーペア名 | |
| `--security-group` | セキュリティグループ名 | |
| `--startup-script` | 起動スクリプトファイルパス | |

### 例

```bash
conoha server create \
  --name myserver \
  --flavor g2l-t-c2m1d100 \
  --image ubuntu-24.04 \
  --key-name mykey
```

---

## server delete

サーバーを削除します。

### 使い方

```bash
conoha server delete <サーバー名またはID>
```

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
| `--key` | 秘密鍵のパス |
| `--user` | ユーザー名（デフォルト: root） |

### 例

```bash
conoha server ssh myserver --key ~/.ssh/conoha_mykey
```

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
