# nginx リバースプロキシ デプロイ

nginxをリバースプロキシとして使い、複数のアプリを1台のVPSで運用するサンプルです。Node.js（フロントエンド）とPython（APIサーバー）をポート80で統合します。

## 完成イメージ

- `http://<サーバーIP>/` → App 1（Node.js フロントエンド）
- `http://<サーバーIP>/api/` → App 2（Python API）
- `http://<サーバーIP>/health` → nginx ヘルスチェック
- `conoha app deploy` でコード更新を即座に反映

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

## ルーティング構成

```
クライアント
    │
    ▼ :80
  nginx (リバースプロキシ)
    ├── /        → app1:3000  (Node.js)
    ├── /api/    → app2:8000  (Python)
    └── /health  → 200 OK
```

## 1. ファイル構成

```
.
├── compose.yml
├── nginx.conf
├── app1/
│   ├── Dockerfile
│   └── app.js
└── app2/
    ├── Dockerfile
    └── app.py
```

## 2. nginx.conf を作成

```nginx
upstream app1 {
    server app1:3000;
}

upstream app2 {
    server app2:8000;
}

server {
    listen 80;

    location / {
        proxy_pass http://app1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://app2;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        return 200 '{"status":"ok"}';
        add_header Content-Type application/json;
    }
}
```

## 3. docker-compose.yml を作成

```yaml
services:
  proxy:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app1
      - app2

  app1:
    build: ./app1

  app2:
    build: ./app2
```

## 4. App 1（Node.js）を作成

`app1/Dockerfile`:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY app.js .
EXPOSE 3000
CMD ["node", "app.js"]
```

`app1/app.js`:

```javascript
const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>App 1 - Frontend</title>
</head>
<body>
  <h1>Nginx Reverse Proxy Demo</h1>
  <p>This page is served by <strong>App 1</strong> (Node.js) via <code>/</code></p>
  <button onclick="callApi()">Call App 2 API</button>
  <div id="result"></div>
  <script>
    async function callApi() {
      const res = await fetch("/api/hello");
      const data = await res.json();
      document.getElementById("result").textContent = JSON.stringify(data);
    }
  </script>
</body>
</html>`);
});

server.listen(3000, () => console.log("App 1 running on port 3000"));
```

## 5. App 2（Python）を作成

`app2/Dockerfile`:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY app.py .
EXPOSE 8000
CMD ["python", "app.py"]
```

`app2/app.py`:

```python
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/hello":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "message": "Hello from App 2 (Python)",
                "path": self.path
            }).encode())
        else:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "service": "app2",
                "path": self.path
            }).encode())

    def log_message(self, format, *args):
        print(f"App 2: {args[0]}")

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 8000), Handler)
    print("App 2 running on port 8000")
    server.serve_forever()
```

## 6. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name reverse-proxy

# デプロイ
conoha app deploy <サーバー名> --app-name reverse-proxy
```

## 7. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name reverse-proxy

# ログ確認
conoha app logs <サーバー名> --app-name reverse-proxy
```

curlで各エンドポイントを確認:

```bash
# App 1（Node.js フロントエンド）
curl http://<サーバーIP>/

# App 2（Python API）
curl http://<サーバーIP>/api/hello

# ヘルスチェック
curl http://<サーバーIP>/health
```

ブラウザで `http://<サーバーIP>/` にアクセスして「Call App 2 API」ボタンをクリックすると、nginxを経由してPythonのAPIが呼ばれます。

## アプリを追加する場合

新しいアプリ（App 3）を追加するには:

1. `app3/` ディレクトリとDockerfileを作成
2. `compose.yml` に `app3` サービスを追加
3. `nginx.conf` に `upstream` と `location` ブロックを追加:

```nginx
upstream app3 {
    server app3:PORT;
}

# server {} ブロック内に追加
location /app3/ {
    proxy_pass http://app3;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

4. 再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name reverse-proxy
```

## コード更新

コードを変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name reverse-proxy
```
