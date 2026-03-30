# auth

認証の管理を行うコマンドグループです。

## auth login

APIの認証情報を入力してログインします。

### 使い方

```bash
conoha auth login [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--profile` | 保存するプロファイル名（デフォルト: default） |

### 例

```bash
# 対話形式でログイン
conoha auth login

# プロファイルを指定
conoha auth login --profile work
```

---

## auth status

現在の認証状態を表示します。

### 使い方

```bash
conoha auth status
```

### 例

```bash
conoha auth status
```

---

## auth list

設定済みのプロファイル一覧を表示します。

### 使い方

```bash
conoha auth list
```

---

## auth switch

アクティブなプロファイルを切り替えます。

### 使い方

```bash
conoha auth switch <プロファイル名>
```

### 例

```bash
conoha auth switch work
```

---

## auth token

現在のトークンを標準出力に出力します。スクリプトから利用する場合に便利です。

### 使い方

```bash
conoha auth token
```

### 例

```bash
# 他のコマンドでトークンを使う
curl -H "X-Auth-Token: $(conoha auth token)" https://...
```

---

## auth logout

アクティブなプロファイルのトークンと認証情報を削除します。

### 使い方

```bash
conoha auth logout
```

---

## auth remove

プロファイルを完全に削除します。

### 使い方

```bash
conoha auth remove <プロファイル名>
```
