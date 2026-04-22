# keypair

SSHキーペアの管理を行うコマンドグループです。サーバー作成時に指定するSSH公開鍵をConoHa側で保存・管理します。

---

## keypair list

登録済みキーペアの一覧を表示します。

### 使い方

```bash
conoha keypair list
```

### 例

```bash
# テーブル形式
conoha keypair list

# JSON形式
conoha keypair list --format json
```

---

## keypair show

指定キーペアの詳細と公開鍵を表示します。

### 使い方

```bash
conoha keypair show <キーペア名>
```

### オプション

| オプション | 説明 |
|-----------|------|
| `-o`, `--output` | 公開鍵をファイルに保存（デフォルトは標準出力） |

### 例

```bash
# 公開鍵を標準出力に表示
conoha keypair show my-key

# 公開鍵をファイルに保存
conoha keypair show my-key -o ~/.ssh/my-key.pub
```

---

## keypair create

新しいキーペアを作成します。秘密鍵は自動的に `~/.ssh/conoha_<キーペア名>` に保存されます。

### 使い方

```bash
conoha keypair create <キーペア名> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `-o`, `--output` | 秘密鍵の保存先ファイルパス（デフォルト: `~/.ssh/conoha_<キーペア名>`） |
| `--public-key` | 既存の公開鍵内容をインポート（秘密鍵はConoHa側では生成されない） |

### 例

```bash
# 新規キーペアを作成（秘密鍵は ~/.ssh/conoha_my-key に自動保存）
conoha keypair create my-key

# 保存先を指定
conoha keypair create my-key -o ~/.ssh/my-custom-path

# 既存の公開鍵をインポート
conoha keypair create my-key --public-key "$(cat ~/.ssh/id_ed25519.pub)"
```

実行例:

```
$ conoha keypair create my-key
Private key saved to /Users/you/.ssh/conoha_my-key
Public key saved to /Users/you/.ssh/conoha_my-key.pub
Keypair my-key created
```

::: tip 秘密鍵の自動検出
`conoha server ssh` は `~/.ssh/conoha_<キーペア名>` に保存された秘密鍵を自動的に検出します。サーバーを `--key-name my-key` で作成した場合、`-i` オプションなしでSSH接続できます。
:::

::: warning 秘密鍵の取り扱い
`--public-key` を使って既存の鍵をインポートしない限り、秘密鍵はこのコマンド実行時の1回しか取得できません。ファイルを紛失した場合はキーペアを削除して作成し直す必要があります。
:::

---

## keypair delete

キーペアを削除します。

### 使い方

```bash
conoha keypair delete <キーペア名>
```

### 例

```bash
# 確認プロンプトあり
conoha keypair delete my-key

# 確認プロンプトをスキップ
conoha keypair delete my-key -y
```

::: warning
削除してもConoHa側の登録情報が消えるだけで、既にそのキーで作成したサーバーのSSH接続は引き続き利用できます。ローカルの `~/.ssh/conoha_<キーペア名>` も自動では削除されません。
:::
