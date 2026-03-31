# MinIO + n8n デプロイ

MinIO（S3互換オブジェクトストレージ）とn8n（ワークフロー自動化）を組み合わせたセルフホスティング基盤をConoHa VPSにデプロイする手順です。

## 完成イメージ

- MinIO コンソールが `http://<サーバーIP>:9001` でアクセス可能
- MinIO API が `http://<サーバーIP>:9000` で利用可能（S3互換）
- n8n が `http://<サーバーIP>:5678` でアクセス可能
- `conoha app deploy` でアップデートを即座に反映

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

::: warning RAM 推奨
MinIOとn8nを同時に動かすため、**2GB以上のRAM**を推奨します。
:::

## 1. compose.yml を作成

```yaml
services:
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ROOT_USER:-minioadmin}
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD:-minioadmin}
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5

  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER:-admin}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD:-admin}
      - N8N_PROTOCOL=http
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  minio_data:
  n8n_data:
```

::: tip 公式イメージのみ使用
このサンプルはDockerfileなしで動作します。`minio/minio:latest` と `n8nio/n8n:latest` の公式イメージをそのまま使用します。
:::

## 2. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name minio-n8n

# 環境変数を設定（パスワードを必ず変更してください）
conoha app env set <サーバー名> --app-name minio-n8n \
  MINIO_ROOT_USER=your_minio_user \
  MINIO_ROOT_PASSWORD=your_minio_password \
  N8N_USER=your_n8n_user \
  N8N_PASSWORD=your_n8n_password

# デプロイ
conoha app deploy <サーバー名> --app-name minio-n8n
```

## 3. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name minio-n8n

# ログ確認
conoha app logs <サーバー名> --app-name minio-n8n
```

各サービスにブラウザでアクセスして確認:

| サービス | URL | 説明 |
|---------|-----|------|
| MinIO コンソール | `http://<サーバーIP>:9001` | バケット・オブジェクト管理UI |
| MinIO API | `http://<サーバーIP>:9000` | S3互換APIエンドポイント |
| n8n | `http://<サーバーIP>:5678` | ワークフロー自動化UI |

## MinIO + n8n 連携

n8nからMinIOにアクセスするには、n8nのS3ノードを使用します:

1. n8n で新規ワークフローを作成
2. `S3` ノードを追加
3. 認証情報を設定:
   - **Endpoint**: `http://<サーバーIP>:9000`
   - **Access Key ID**: `MINIO_ROOT_USER` の値
   - **Secret Access Key**: `MINIO_ROOT_PASSWORD` の値
   - **Region**: `us-east-1`（任意）
   - **Force path style**: ON

## 環境変数を更新する場合

```bash
conoha app env set <サーバー名> --app-name minio-n8n \
  MINIO_ROOT_PASSWORD=new_secure_password

# 再デプロイで反映
conoha app deploy <サーバー名> --app-name minio-n8n
```

## コード更新

設定を変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name minio-n8n
```
