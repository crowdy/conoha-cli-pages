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

## 3. compose.yml を作成

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

## 4. main.py を作成

Login/Consentプロバイダーと保護されたAPIを1つのFastAPIアプリで実装します。

```python
"""
Login/Consent provider and protected API for Ory Hydra.

This app serves three roles:
1. Login provider  - handles Hydra's login challenges
2. Consent provider - handles Hydra's consent challenges
3. Protected API   - validates OAuth2 tokens via Hydra's introspection endpoint
"""

import os

import httpx
from fastapi import FastAPI, Form, Header, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

app = FastAPI()
templates = Jinja2Templates(directory="templates")

HYDRA_ADMIN_URL = os.environ.get("HYDRA_ADMIN_URL", "http://hydra:4445")


# --- Login provider ---


@app.get("/login", response_class=HTMLResponse)
async def login_get(request: Request, login_challenge: str):
    """Show login form or skip if session exists."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{HYDRA_ADMIN_URL}/oauth2/auth/requests/login",
            params={"login_challenge": login_challenge},
        )
        data = resp.json()

    # Skip login if user already authenticated in this session
    if data.get("skip"):
        async with httpx.AsyncClient() as client:
            resp = await client.put(
                f"{HYDRA_ADMIN_URL}/oauth2/auth/requests/login/accept",
                params={"login_challenge": login_challenge},
                json={"subject": data["subject"]},
            )
            body = resp.json()
        return RedirectResponse(body["redirect_to"], status_code=302)

    return templates.TemplateResponse(
        "login.html",
        {"request": request, "challenge": login_challenge},
    )


@app.post("/login")
async def login_post(
    login_challenge: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
):
    """Accept or reject the login challenge."""
    # Demo: accept any login where username == password
    if username != password:
        return HTMLResponse(
            "<h1>Login failed</h1><p>Hint: username must equal password</p>",
            status_code=401,
        )

    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"{HYDRA_ADMIN_URL}/oauth2/auth/requests/login/accept",
            params={"login_challenge": login_challenge},
            json={
                "subject": username,
                "remember": True,
                "remember_for": 3600,
            },
        )
        body = resp.json()

    return RedirectResponse(body["redirect_to"], status_code=302)


# --- Consent provider ---


@app.get("/consent", response_class=HTMLResponse)
async def consent_get(request: Request, consent_challenge: str):
    """Show consent form or auto-approve for trusted clients."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{HYDRA_ADMIN_URL}/oauth2/auth/requests/consent",
            params={"consent_challenge": consent_challenge},
        )
        data = resp.json()

    # Auto-approve if user already consented or client is trusted
    if data.get("skip"):
        async with httpx.AsyncClient() as client:
            resp = await client.put(
                f"{HYDRA_ADMIN_URL}/oauth2/auth/requests/consent/accept",
                params={"consent_challenge": consent_challenge},
                json={
                    "grant_scope": data.get("requested_scope", []),
                    "grant_access_token_audience": data.get(
                        "requested_access_token_audience", []
                    ),
                },
            )
            body = resp.json()
        return RedirectResponse(body["redirect_to"], status_code=302)

    return templates.TemplateResponse(
        "consent.html",
        {
            "request": request,
            "challenge": consent_challenge,
            "scopes": data.get("requested_scope", []),
            "client_name": data.get("client", {}).get(
                "client_name", data.get("client", {}).get("client_id", "unknown")
            ),
        },
    )


@app.post("/consent")
async def consent_post(
    consent_challenge: str = Form(...),
    grant_scope: list[str] = Form(default=[]),
):
    """Accept the consent challenge with selected scopes."""
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"{HYDRA_ADMIN_URL}/oauth2/auth/requests/consent/accept",
            params={"consent_challenge": consent_challenge},
            json={
                "grant_scope": grant_scope,
                "grant_access_token_audience": [],
                "remember": True,
                "remember_for": 3600,
            },
        )
        body = resp.json()

    return RedirectResponse(body["redirect_to"], status_code=302)


# --- Protected API ---


@app.get("/api/me")
async def api_me(authorization: str = Header(default="")):
    """Protected endpoint — validates the Bearer token via Hydra introspection."""
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        return JSONResponse(
            {"error": "missing authorization header"}, status_code=401
        )

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{HYDRA_ADMIN_URL}/oauth2/introspect",
            data={"token": token},
        )
        data = resp.json()

    if not data.get("active"):
        return JSONResponse(
            {"error": "invalid or expired token"}, status_code=401
        )

    return {
        "subject": data.get("sub"),
        "scope": data.get("scope"),
        "client_id": data.get("client_id"),
        "token_type": data.get("token_type"),
    }


@app.get("/api/public")
async def api_public():
    """Public endpoint — no authentication required."""
    return {"message": "This is a public endpoint. No token needed."}


@app.get("/health")
async def health():
    return {"status": "ok"}
```

::: tip コードの構成
- **Login provider** (`/login`): Hydra の login challenge を処理。デモではユーザー名＝パスワードで認証通過
- **Consent provider** (`/consent`): スコープ選択画面を表示。チェックボックスで付与するスコープを選択
- **Protected API** (`/api/me`): Bearer トークンを Hydra の introspection エンドポイントで検証
:::

## 5. templates/login.html を作成

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      color: #333;
    }
    .card {
      background: #fff;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #666; margin-bottom: 1.5rem; font-size: 0.9rem; }
    label { display: block; margin-bottom: 0.3rem; font-weight: 500; }
    input {
      width: 100%;
      padding: 0.6rem;
      margin-bottom: 1rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 1rem;
      box-sizing: border-box;
    }
    button {
      width: 100%;
      padding: 0.7rem;
      background: #1976d2;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
    }
    button:hover { background: #1565c0; }
    .hint { color: #999; font-size: 0.8rem; margin-top: 1rem; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign In</h1>
    <p>Ory Hydra OAuth2 Demo</p>
    <form method="post" action="/login">
      <input type="hidden" name="login_challenge" value="{{ challenge }}">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" placeholder="Enter username" required autofocus>
      <label for="password">Password</label>
      <input type="password" id="password" name="password" placeholder="Enter password" required>
      <button type="submit">Sign In</button>
    </form>
    <p class="hint">Demo: use the same value for username and password (e.g., admin / admin)</p>
  </div>
</body>
</html>
```

## 6. templates/consent.html を作成

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      color: #333;
    }
    .card {
      background: #fff;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #666; margin-bottom: 1rem; font-size: 0.9rem; }
    .scope-list { margin-bottom: 1.5rem; }
    .scope-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0;
    }
    .scope-item input { width: auto; }
    button {
      width: 100%;
      padding: 0.7rem;
      background: #1976d2;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
    }
    button:hover { background: #1565c0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize</h1>
    <p><strong>{{ client_name }}</strong> is requesting access to your account.</p>
    <form method="post" action="/consent">
      <input type="hidden" name="consent_challenge" value="{{ challenge }}">
      <div class="scope-list">
        {% for scope in scopes %}
        <div class="scope-item">
          <input type="checkbox" name="grant_scope" value="{{ scope }}" id="scope_{{ scope }}" checked>
          <label for="scope_{{ scope }}">{{ scope }}</label>
        </div>
        {% endfor %}
      </div>
      <button type="submit">Allow Access</button>
    </form>
  </div>
</body>
</html>
```

## 7. .dockerignore を作成

```
README.md
.git
__pycache__
*.pyc
.venv
setup.sh
```

## 8. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name hydra

# デプロイ
conoha app deploy <サーバー名> --app-name hydra
```

## 9. デプロイ後セットアップ（OAuth2クライアント登録）

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
# Run this once after `conoha app deploy` or `docker compose up`.

set -e

HYDRA_ADMIN=${HYDRA_ADMIN:-http://localhost:4445}

echo "==> Creating OAuth2 client 'demo-app'..."
docker compose exec hydra hydra create oauth2-client \
  --endpoint http://localhost:4445 \
  --name "Demo App" \
  --grant-type authorization_code,refresh_token \
  --response-type code \
  --scope openid,profile,email,offline_access \
  --redirect-uri http://localhost:9010/callback \
  --token-endpoint-auth-method client_secret_post

echo ""
echo "==> Done! Use the client_id and client_secret above to start an OAuth2 flow."
echo ""
echo "Authorization URL:"
echo "  http://localhost:4444/oauth2/auth?response_type=code&client_id=<CLIENT_ID>&redirect_uri=http://localhost:9010/callback&scope=openid+profile+email&state=random-state"
```

## 10. 動作確認

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
