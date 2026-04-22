# はじめに

ConoHa CLIは、ConoHa VPS3をターミナルから操作するためのコマンドラインツールです。

## インストール

### macOS (Homebrew)

```bash
brew install crowdy/tap/conoha-cli
```

### Scoop (Windows)

```powershell
scoop bucket add crowdy https://github.com/crowdy/crowdy-bucket
scoop install conoha
```

### Linux / macOS (手動)

[GitHub Releases](https://github.com/crowdy/conoha-cli/releases) からお使いのOS・アーキテクチャに合ったバイナリをダウンロードしてください。

```bash
# 例: Linux amd64
VERSION=$(curl -s https://api.github.com/repos/crowdy/conoha-cli/releases/latest | grep tag_name | cut -d '"' -f4)
curl -Lo conoha.tar.gz "https://github.com/crowdy/conoha-cli/releases/download/${VERSION}/conoha-cli_${VERSION#v}_linux_amd64.tar.gz"
tar xzf conoha.tar.gz conoha
sudo mv conoha /usr/local/bin/
rm conoha.tar.gz
```

### Windows (手動)

```powershell
$version = (Invoke-RestMethod https://api.github.com/repos/crowdy/conoha-cli/releases/latest).tag_name
$v = $version -replace '^v', ''
Invoke-WebRequest -Uri "https://github.com/crowdy/conoha-cli/releases/download/$version/conoha-cli_${v}_windows_amd64.zip" -OutFile conoha.zip
Expand-Archive conoha.zip -DestinationPath .
Remove-Item conoha.zip
```

## インストール確認

```bash
conoha version
```

バージョン番号が表示されればOKです。

## ログイン

ConoHa APIのユーザー名・パスワード・テナントIDを使ってログインします。これらは [ConoHaコントロールパネル](https://manage.conoha.jp/) の「API」ページで確認できます。

```bash
conoha auth login
```

対話形式で以下を入力します:

- **API User**: APIユーザー名
- **Password**: APIパスワード
- **Tenant ID**: テナントID
- **Region**: tyo3 (東京)

実行例:

```
$ conoha auth login
Tenant ID: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
API Username: gncu12345678
API Password: *********************
Authenticating as gncu12345678...
Logged in to profile "default" (token expires 2026-03-31T02:16:10Z / 2026-03-31 11:16 JST)
```

::: tip
`--profile` オプションで複数のアカウントを管理できます。

```bash
conoha auth login --profile work
conoha auth login --profile personal
conoha auth switch work
```
:::

## ログイン確認

```bash
conoha auth status
```

トークンの有効期限とプロファイル情報が表示されます。

## 基本的な使い方

```bash
# サーバー一覧
conoha server list

# JSON形式で出力
conoha server list --format json

# ヘルプを見る
conoha --help
conoha server --help
conoha server create --help
```

実行例（`conoha server list`）:

```
ID                                    NAME            STATUS   FLAVOR         TAG
1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d  my-web-server   ACTIVE   g2l-t-c3m2     production
2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e  my-api-server   ACTIVE   g2l-t-c2m1     staging
3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f  test-server     SHUTOFF  g2l-t-c2m1     test
4d5e6f7a-8b9c-0d1e-2f3a-4b5c6d7e8f9a  db-server       ACTIVE   g2d-t-c2m4d60  database
```

## 出力フォーマット

すべてのコマンドで `--format` オプションが使えます。

| フォーマット | 説明 |
|-------------|------|
| `table` | テーブル形式（デフォルト） |
| `json` | JSON形式 |
| `yaml` | YAML形式 |
| `csv` | CSV形式 |

## 次のステップ

- [クイックスタート](/guide/quickstart) — キーペア作成 → サーバー作成 → SSH接続の一連の流れ
- [サーバー管理](/guide/server) — サーバーの作成・起動・停止
- [アプリデプロイ](/guide/app-deploy) — Dockerアプリのデプロイ
