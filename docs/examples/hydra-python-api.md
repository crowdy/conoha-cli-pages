# Ory Hydra + FastAPI (OAuth2) デプロイ

Ory Hydra（OAuth2 / OpenID Connectサーバー）とPython（FastAPI）を組み合わせた認可サンプルをConoHa VPSにデプロイする手順です。HydraがOAuth2フローを処理し、PythonアプリがログインUI・同意画面の提供とトークン検証付きAPIを担当します。

## 完成イメージ

- Hydra Public API が `http://<サーバーIP>:4444` でアクセス可能（OAuth2エンドポイント）
- Hydra Admin API が `http://<サーバーIP>:4445` で稼働
- FastAPI アプリが `http://<サーバーIP>:9010` でアクセス可能
- Authorization Code Flowの完全なOAuth2フローが動作

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

::: warning RAM 推奨
Hydra・FastAPI・PostgreSQLを同時に動かすため、**2GB以上のRAM**を推奨します。
:::

## アーキテクチャ

```
ブラウザ ──→ Hydra (:4444)  ←──→  PostgreSQL
              │  ↑
              ↓  │
          Python App (:9010)
          ├── /login     ← ログイン画面
          ├── /consent   ← 同意画面
          └── /api/me    ← トークン検証付き API
```

1. クライアントがHydraの認可エンドポイントにリクエスト
2. HydraがユーザーをPythonアプリのログイン画面にリダイレクト
3. ログイン成功後、Hydraが同意画面にリダイレクト
4. 同意後、Hydraがアクセストークンを発行
5. クライアントがトークンを使って `/api/me` にアクセス

## 1. Dockerfile を作成

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 9010
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9010"]
```

## 2. requirements.txt を作成

```
fastapi==0.115.12
uvicorn[standard]==0.34.2
httpx==0.28.1
jinja2==3.1.6
python-multipart==0.0.20
```

## 3. docker-compose.yml を作成

```yaml
services:
  # Ory Hydra — OAuth2 / OpenID Connect server
  hydra:
    image: oryd/hydra:v2.2
    ports:
      - "4444:4444"   # Public API (OAuth2 endpoints)
      - "4445:4445"   # Admin API (login/consent provider calls)
    environment:
      - DSN=postgres://hydra:hydra@db:5432/hydra?sslmode=disable
      - URLS_SELF_ISSUER=http://localhost:4444
      - URLS_LOGIN=http://localhost:9010/login
      - URLS_CONSENT=http://localhost:9010/consent
      - SECRETS_SYSTEM=a-very-secret-key-that-must-be-changed
      - LOG_LEVEL=info
    command: serve all --dev
    depends_on:
      hydra-migrate:
        condition: service_completed_successfully
    restart: unless-stopped

  # Run database migrations before Hydra starts
  hydra-migrate:
    image: oryd/hydra:v2.2
    environment:
      - DSN=postgres://hydra:hydra@db:5432/hydra?sslmode=disable
    command: migrate sql -e --yes
    depends_on:
      db:
        condition: service_healthy

  # Python app — Login/consent provider + protected API
  app:
    build: .
    ports:
      - "9010:9010"
    environment:
      - HYDRA_ADMIN_URL=http://hydra:4445
    depends_on:
      - hydra

  # PostgreSQL for Hydra
  db:
    image: postgres:17-alpine
    environment:
      - POSTGRES_USER=hydra
      - POSTGRES_PASSWORD=hydra
      - POSTGRES_DB=hydra
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hydra"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  db_data:
```

## 4. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name hydra

# デプロイ
conoha app deploy <サーバー名> --app-name hydra
```

## 5. デプロイ後セットアップ（OAuth2クライアント登録）

デプロイ後、SSHでサーバーに接続してOAuth2クライアントを登録します:

```bash
# サーバーにSSH接続
conoha server ssh <サーバー名>

# サーバー上で実行
cd /opt/conoha/hydra
bash setup.sh
```

`client_id` と `client_secret` が表示されます。これを控えてください。

`setup.sh` の内容:

```bash
#!/bin/bash
# Register an OAuth2 client after Hydra is running.
set -e

docker compose exec hydra hydra create oauth2-client \
  --endpoint http://localhost:4445 \
  --name "Demo App" \
  --grant-type authorization_code,refresh_token \
  --response-type code \
  --scope openid,profile,email,offline_access \
  --redirect-uri http://localhost:9010/callback \
  --token-endpoint-auth-method client_secret_post
```

## 6. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name hydra

# ログ確認
conoha app logs <サーバー名> --app-name hydra
```

### 認可フロー（ブラウザ）

以下のURLにアクセス（`<CLIENT_ID>` を実際の値に置き換え）:

```
http://<サーバーIP>:4444/oauth2/auth?response_type=code&client_id=<CLIENT_ID>&redirect_uri=http://<サーバーIP>:9010/callback&scope=openid+profile+email&state=test
```

ログイン画面 → 同意画面 → リダイレクト（authorization code付き）の順に遷移します。

::: tip デモ認証
ユーザー名とパスワードに**同じ値**を入力するとログインできます（例: `admin` / `admin`）。
:::

### トークン取得（curl）

```bash
# authorization code をトークンに交換
curl -X POST http://<サーバーIP>:4444/oauth2/token \
  -d grant_type=authorization_code \
  -d code=<AUTH_CODE> \
  -d redirect_uri=http://<サーバーIP>:9010/callback \
  -d client_id=<CLIENT_ID> \
  -d client_secret=<CLIENT_SECRET>
```

### 保護されたAPIにアクセス

```bash
# トークンを使ってAPIにアクセス
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://<サーバーIP>:9010/api/me

# 公開エンドポイント（トークン不要）
curl http://<サーバーIP>:9010/api/public
```

## APIエンドポイント

| エンドポイント | 認証 | 説明 |
|--------------|------|------|
| `GET /api/me` | Bearer トークン必須 | トークンの主体・スコープ・クライアント情報を返す |
| `GET /api/public` | 不要 | 公開エンドポイント |
| `GET /health` | 不要 | ヘルスチェック |

## 本番環境向けカスタマイズ

```bash
# compose.yml の SECRETS_SYSTEM を強力なシークレットに変更後、再デプロイ
conoha app deploy <サーバー名> --app-name hydra
```

本番環境では以下を変更してください:

- `SECRETS_SYSTEM`: ランダムな強力なシークレット（最低32文字）
- `URLS_SELF_ISSUER`: 実際のドメイン（例: `https://auth.example.com`）
- `URLS_LOGIN` / `URLS_CONSENT`: 実際のドメインに対応するURL
- `--dev` フラグを削除（本番モードで起動）
- `main.py` の `login_post` を実際のユーザー認証ロジックに変更

## コード更新

コードを変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name hydra
```
