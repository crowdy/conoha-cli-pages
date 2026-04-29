# config

CLI 設定の表示・変更を行うコマンドグループです。設定ファイルは `~/.config/conoha/` 以下にあります。

## config show

現在の設定 (アクティブプロファイル、既定の出力形式、登録済みプロファイル一覧) を表示します。

### 使い方

```bash
conoha config show
```

出力例:

```
Config dir:     /home/you/.config/conoha
Active profile: default
Default format: table
Profiles:       2
  * default (tenant=abc..., region=tyo3)
    staging (tenant=def..., region=tyo3)
```

`*` がアクティブプロファイルを示します。

---

## config set

設定値を変更します。

### 使い方

```bash
conoha config set <key> <value>
```

### 対応キー

| キー | 説明 |
|------|------|
| `format` | 既定の出力形式 (`table` / `json` / `yaml` / `csv`) |

未対応のキーを指定すると `unknown config key` エラーになります。

### 例

```bash
conoha config set format json
```

---

## config path

設定ディレクトリのパスを stdout に出力します。スクリプト連携向け。

### 使い方

```bash
conoha config path
```

出力例:

```
/home/you/.config/conoha
```

---

## 設定ファイル

| ファイル | 説明 | パーミッション |
|---|---|---|
| `config.yaml` | プロファイル設定 | 0600 |
| `credentials.yaml` | パスワード | 0600 |
| `tokens.yaml` | トークンキャッシュ | 0600 |

設定値の優先順位は: 環境変数 (`CONOHA_*`) > フラグ > プロファイル設定 > デフォルト値。
