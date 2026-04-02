# volume

ブロックストレージボリュームの管理を行うコマンドグループです。

## volume list

ボリューム一覧を表示します。

### 使い方

```bash
conoha volume list
```

---

## volume show

ボリュームの詳細を表示します。

### 使い方

```bash
conoha volume show <ボリュームID>
```

---

## volume create

ボリュームを作成します。同名のボリュームが存在する場合、確認プロンプトが表示されます。

### 使い方

```bash
conoha volume create --name <ボリューム名> --size <サイズGB> [flags]
```

| オプション | 説明 | 必須 |
|-----------|------|------|
| `--name` | ボリューム名 | ○ |
| `--size` | サイズ（GB） | ○ |
| `--type` | ボリュームタイプ | |
| `--description` | 説明 | |
| `--image` | ソースイメージIDまたは名前（ブータブルボリューム作成用） | |
| `--wait` | 作成完了まで待機 | |
| `--wait-timeout` | 最大待機時間（デフォルト: 5m） | |

### 例

通常のデータボリュームを作成:

```bash
conoha volume create --name data-vol --size 100
```

OSイメージからブータブルボリュームを作成:

```bash
conoha volume create --name boot-vol --size 30 --image vmi-ubuntu-24.04-amd64 --wait
```

---

## volume rename

ボリュームの名前や説明を変更します。`--name` と `--description` のうち少なくとも1つが必要です。

### 使い方

```bash
conoha volume rename <ボリュームIDまたは名前> [flags]
```

| オプション | 説明 | 必須 |
|-----------|------|------|
| `--name` | 新しいボリューム名 | |
| `--description` | 新しい説明 | |

### 例

```bash
conoha volume rename old-name --name new-name
conoha volume rename my-vol --description "本番用データ"
conoha volume rename my-vol --name new-name --description "更新済み"
```

---

## volume delete

ボリュームを削除します。確認プロンプトが表示されます。

### 使い方

```bash
conoha volume delete <ボリュームID>
```

---

## volume types

利用可能なボリュームタイプの一覧を表示します。

### 使い方

```bash
conoha volume types
```

---

## volume backup

ボリュームバックアップの管理を行います。

### volume backup list

バックアップ一覧を表示します。

```bash
conoha volume backup list
```

### volume backup show

バックアップの詳細を表示します。

```bash
conoha volume backup show <バックアップID>
```

### volume backup restore

バックアップを指定のボリュームにリストアします。

```bash
conoha volume backup restore <バックアップID> <ボリュームID>
```
