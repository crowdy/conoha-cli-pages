# はじめに

ConoHa CLIは、ConoHa VPS3をターミナルから操作するためのコマンドラインツールです。

## インストール

### macOS (Homebrew)

```bash
brew install crowdy/tap/conoha
```

### Linux / macOS (手動)

[GitHub Releases](https://github.com/crowdy/conoha-cli/releases) からお使いのOS・アーキテクチャに合ったバイナリをダウンロードしてください。

```bash
# 例: Linux amd64
curl -LO https://github.com/crowdy/conoha-cli/releases/latest/download/conoha_linux_amd64.tar.gz
tar xzf conoha_linux_amd64.tar.gz
sudo mv conoha /usr/local/bin/
```

### Windows

[GitHub Releases](https://github.com/crowdy/conoha-cli/releases) から `conoha_windows_amd64.zip` をダウンロードし、パスの通ったディレクトリに配置してください。

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

## 出力フォーマット

すべてのコマンドで `--format` オプションが使えます。

| フォーマット | 説明 |
|-------------|------|
| `table` | テーブル形式（デフォルト） |
| `json` | JSON形式 |
| `yaml` | YAML形式 |
| `csv` | CSV形式 |

## 次のステップ

- [サーバー管理](/guide/server) — サーバーの作成・起動・停止
- [アプリデプロイ](/guide/app-deploy) — Dockerアプリのデプロイ
