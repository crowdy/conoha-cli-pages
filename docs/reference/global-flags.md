# グローバルフラグ・環境変数

すべてのコマンドで利用できる永続フラグと環境変数の一覧です。

## グローバルフラグ

`cmd/root.go` の `PersistentFlags()` で定義されています。

| オプション | 説明 |
|-----------|------|
| `--profile` | 使用するプロファイル名 |
| `--format` | 出力形式: `table` / `json` / `yaml` / `csv` |
| `--no-input` | 対話プロンプトを無効化（CI / スクリプト向け） |
| `--yes`, `-y` | 確認プロンプトを自動承認 |
| `--quiet` | 不要な出力を抑制 |
| `--verbose`, `-v` | 詳細出力 |
| `--no-color` | カラー出力を無効化 |
| `--no-headers` | テーブル / CSV のヘッダーを非表示 |
| `--filter` | 行フィルタ（複数指定可、後述） |
| `--sort-by` | 行ソート（フィールド名） |
| `--insecure` | SSH ホスト鍵検証を無効化（推奨されません — 検証用 / 使い捨て VPS のみ） |

### 待機系フラグ

非同期操作を行うコマンドには `cmdutil.AddWaitFlags()` で以下が追加されます。

| オプション | 説明 |
|-----------|------|
| `--wait` | 操作完了まで待機 |
| `--wait-timeout` | 待機タイムアウト（デフォルト: `5m`） |

---

## `--filter` の演算子

`--filter` は `key<op>value` の形式で複数指定できます (各指定は AND 結合)。

| 演算子 | 意味 | 例 |
|-------|------|----|
| `=` | 完全一致 | `--filter status=ACTIVE` |
| `~` | 部分一致 (含む) | `--filter name~web` |
| `~=` | 正規表現一致 | `--filter name~=^prod-` |

`~` と `~=` は v0.6.1+ 以降で利用可能です。

### 例

```bash
# 完全一致
conoha server list --filter status=ACTIVE

# 部分一致
conoha server list --filter name~web

# 正規表現
conoha server list --filter 'name~=^prod-'

# 複数フィルタ (AND)
conoha server list --filter status=ACTIVE --filter name~web
```

---

## 環境変数

| 変数 | 説明 |
|------|------|
| `CONOHA_PROFILE` | 使用するプロファイル名 |
| `CONOHA_TENANT_ID` | テナント ID |
| `CONOHA_USERNAME` | API ユーザー名 |
| `CONOHA_PASSWORD` | API パスワード |
| `CONOHA_TOKEN` | 認証トークン（直接指定） |
| `CONOHA_FORMAT` | 出力形式 |
| `CONOHA_CONFIG_DIR` | 設定ディレクトリ |
| `CONOHA_NO_INPUT` | 非対話モード（`1` / `true`） |
| `CONOHA_YES` | 確認プロンプトを自動承認（`1` / `true`） |
| `CONOHA_NO_COLOR` | カラー出力を無効化（`1` / `true`、`NO_COLOR` も認識） |
| `CONOHA_ENDPOINT` | API エンドポイント上書き |
| `CONOHA_ENDPOINT_MODE` | `int` で内部 API モード（サービス名をパスに追加） |
| `CONOHA_DEBUG` | デバッグログ（`1` / `api`） |
| `CONOHA_SSH_INSECURE` | SSH ホスト鍵検証を無効化（`1` / `true`） |

### 優先順位

```
環境変数 > フラグ > プロファイル設定 > デフォルト値
```

たとえば `--no-input` を渡しても `CONOHA_NO_INPUT=` (空) が設定されている場合は環境変数が優先されません (空値は無効として扱われ、フラグ値が使用されます)。

---

## 関連ページ

- [`config` リファレンス](/reference/config) — プロファイル管理 (`config show / set / path`)
- [終了コード](/reference/exit-codes) — エラー時の終了コード一覧
