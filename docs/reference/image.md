# image

VPS イメージ (OS イメージやカスタム ISO) を管理するコマンドグループです。

## image list

イメージ一覧を表示します (`ID` / `Name` / `Status` / `MinDisk` / `Visibility`)。

### 使い方

```bash
conoha image list
```

---

## image show

特定イメージの詳細を表示します。

### 使い方

```bash
conoha image show <id>
```

---

## image create

イメージレコードのみを作成します。実際のファイルアップロードは別途 `image upload` を呼び出します。一気に作成 + アップロードしたい場合は `image import` を使ってください。

### 使い方

```bash
conoha image create --name <name> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--name` | イメージ名（**必須**） |
| `--disk-format` | ディスクフォーマット（デフォルト: `iso`） |
| `--container-format` | コンテナフォーマット（デフォルト: `bare`） |

---

## image upload

既存のイメージレコードにファイルをアップロードします。アップロード進捗とサイズが stderr に出力されます。

### 使い方

```bash
conoha image upload <id> --file <path>
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--file` | アップロードするローカルファイルのパス（**必須**） |

---

## image import

`image create` + `image upload` を 1 コマンドで実行します。`--wait` で `active` ステータスになるまで待機できます。

### 使い方

```bash
conoha image import --name <name> --file <path> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--name` | イメージ名（**必須**） |
| `--file` | アップロードするローカルファイルのパス（**必須**） |
| `--disk-format` | ディスクフォーマット（デフォルト: `iso`） |
| `--container-format` | コンテナフォーマット（デフォルト: `bare`） |
| `--wait` | `active` 状態になるまで待機 |
| `--wait-timeout` | 待機タイムアウト（デフォルト: 5m） |

### 動作

1. `CreateImage` でレコード作成（ID が stderr に出力）
2. ファイルをマルチパートアップロード
3. `--wait` 指定時はステータスをポーリング (`active` で成功、`killed` / `deactivated` で失敗)
4. アップロード失敗時はリトライコマンド (`conoha image upload <id> --file ...`) を案内

---

## image delete

イメージを削除します (確認プロンプトあり、`--yes` で省略可)。

### 使い方

```bash
conoha image delete <id>
```
