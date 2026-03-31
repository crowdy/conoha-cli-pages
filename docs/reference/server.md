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

## server add-security-group

サーバーにセキュリティグループを追加します。

エイリアス: `add-sg`

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

---

## server remove-security-group

サーバーからセキュリティグループを削除します。

エイリアス: `remove-sg`

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
