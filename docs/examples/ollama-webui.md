# Ollama + Open WebUI デプロイ

Ollama と Open WebUI の公式 Docker イメージを使ったローカル LLM チャット環境を ConoHa VPS にデプロイするサンプルです。ブラウザから ChatGPT のような UI で LLM と会話できます。

## 完成イメージ

- Open WebUI が `http://<サーバーIP>:3000` でアクセス可能
- tinyllama モデルが初回起動時に自動ダウンロード
- API キー不要でプライベートな LLM 環境を構築

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）
- **RAM 4GB 以上推奨**（Ollama + LLM モデルの同時動作のため）

## 1. compose.yml を作成

Ollama と Open WebUI の公式イメージを使用するため、Dockerfile は不要です。

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama
    entrypoint: ["/bin/sh", "-c", "ollama serve & sleep 5 && ollama pull tinyllama && wait"]
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:11434/api/tags || exit 1"]
      interval: 10s
      timeout: 10s
      retries: 10
      start_period: 30s

  webui:
    image: ghcr.io/open-webui/open-webui:main
    ports:
      - "3000:8080"
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
      - WEBUI_AUTH=false
    volumes:
      - webui_data:/app/backend/data
    depends_on:
      ollama:
        condition: service_healthy

volumes:
  ollama_data:
  webui_data:
```

::: tip tinyllama の自動ダウンロード
初回起動時に tinyllama モデル（約600MB）が自動でダウンロードされます。完了までサーバーのネットワーク速度に応じて数分かかります。`conoha app logs` でダウンロードの進捗を確認できます。
:::

## 2. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name ollama-webui

# デプロイ
conoha app deploy <サーバー名> --app-name ollama-webui
```

## 3. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name ollama-webui

# ログ確認（tinyllama のダウンロード完了まで数分かかります）
conoha app logs <サーバー名> --app-name ollama-webui
```

ログに `tinyllama` のダウンロード完了が表示されたら、ブラウザで `http://<サーバーIP>:3000` にアクセスします。ChatGPT 風のチャット画面が表示されれば完了です。

## 別のモデルを使う場合

`compose.yml` の `ollama pull tinyllama` を変更して別のモデルを利用できます。

| モデル | サイズ | 必要 RAM |
|--------|--------|----------|
| tinyllama | 約600MB | 4GB |
| llama3.2 | 約2GB | 8GB |
| gemma3 | 約5GB | 16GB |

```yaml
entrypoint: ["/bin/sh", "-c", "ollama serve & sleep 5 && ollama pull llama3.2 && wait"]
```

変更後は再デプロイで反映されます。

```bash
conoha app deploy <サーバー名> --app-name ollama-webui
```

## 認証を有効にする場合

デフォルトでは認証なし（`WEBUI_AUTH=false`）で動作します。公開環境では認証を有効にしてください。

```yaml
environment:
  - OLLAMA_BASE_URL=http://ollama:11434
  - WEBUI_AUTH=true
```

認証を有効にすると、初回アクセス時に管理者アカウントの作成画面が表示されます。

## コード更新

compose.yml を変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name ollama-webui
```

::: warning モデルデータの永続化
ダウンロード済みの LLM モデルは `ollama_data` ボリュームに保存されます。サーバーを削除するとモデルも失われ、次回起動時に再ダウンロードが必要になります。
:::
