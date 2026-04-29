# Rust Actix-web デプロイ

Rust と Actix-web で構築した高速 REST API サーバーを ConoHa VPS にデプロイする手順です。マルチステージビルドにより、最小限のイメージで本番環境に配置します。


::: tip 本例は no-proxy モードで動作します
[アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。HTTPS / blue-green を使う場合は [Hello World](/examples/hello-world) や [Next.js](/examples/nextjs) の proxy モード版を参考にしてください。
:::

## 完成イメージ

- Rust Actix-web アプリが `http://<サーバーIP>:3000` でアクセス可能
- インメモリでメッセージの CRUD を行う REST API
- `conoha app deploy` でコード更新を即座に反映

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

## 1. Rust プロジェクトを作成

```bash
cargo new myapp
cd myapp
```

## 2. Cargo.toml に依存関係を追加

```toml
[package]
name = "myapp"
version = "0.1.0"
edition = "2024"

[dependencies]
actix-web = "4"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
```

## 3. src/main.rs を作成

```rust
use actix_web::{web, App, HttpServer, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Serialize, Clone)]
struct Message {
    id: u32,
    text: String,
}

#[derive(Deserialize)]
struct CreateMessage {
    text: String,
}

struct AppState {
    messages: Mutex<Vec<Message>>,
    next_id: Mutex<u32>,
}

async fn index() -> impl Responder {
    HttpResponse::Ok().content_type("text/html").body(INDEX_HTML)
}

async fn list_messages(data: web::Data<AppState>) -> impl Responder {
    let messages = data.messages.lock().unwrap();
    HttpResponse::Ok().json(&*messages)
}

async fn create_message(
    data: web::Data<AppState>,
    body: web::Json<CreateMessage>,
) -> impl Responder {
    if body.text.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "text is required"}));
    }
    let mut messages = data.messages.lock().unwrap();
    let mut next_id = data.next_id.lock().unwrap();
    let msg = Message {
        id: *next_id,
        text: body.text.clone(),
    };
    *next_id += 1;
    messages.push(msg.clone());
    HttpResponse::Created().json(msg)
}

async fn delete_message(
    data: web::Data<AppState>,
    path: web::Path<u32>,
) -> impl Responder {
    let id = path.into_inner();
    let mut messages = data.messages.lock().unwrap();
    if let Some(pos) = messages.iter().position(|m| m.id == id) {
        messages.remove(pos);
        HttpResponse::NoContent().finish()
    } else {
        HttpResponse::NotFound().json(serde_json::json!({"error": "not found"}))
    }
}

async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let data = web::Data::new(AppState {
        messages: Mutex::new(Vec::new()),
        next_id: Mutex::new(1),
    });

    println!("Server running on port 3000");

    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/", web::get().to(index))
            .route("/health", web::get().to(health))
            .route("/api/messages", web::get().to(list_messages))
            .route("/api/messages", web::post().to(create_message))
            .route("/api/messages/{id}", web::delete().to(delete_message))
    })
    .bind("0.0.0.0:3000")?
    .run()
    .await
}

const INDEX_HTML: &str = r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rust Actix on ConoHa</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 700px;
      margin: 2rem auto;
      padding: 0 1rem;
      background: #f5f5f5;
      color: #333;
    }
    h1 { margin-bottom: 1rem; }
    .msg { background: #fff; padding: 1rem; border-radius: 8px; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; }
    .form-box { background: #fff; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; display: flex; gap: 0.5rem; }
    input { flex: 1; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; }
    button { padding: 0.5rem 1.5rem; background: #b7410e; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
    .delete { background: #d32f2f; font-size: 0.85rem; padding: 0.3rem 0.8rem; }
  </style>
</head>
<body>
  <h1>Rust Actix on ConoHa</h1>
  <div class="form-box">
    <input type="text" id="input" placeholder="Type a message..." required>
    <button onclick="send()">Send</button>
  </div>
  <div id="list"></div>
  <script>
    async function load() {
      const res = await fetch("/api/messages");
      const msgs = await res.json();
      document.getElementById("list").innerHTML = msgs.map(m =>
        '<div class="msg"><span>' + m.text + '</span>' +
        '<button class="delete" onclick="del(' + m.id + ')">Delete</button></div>'
      ).join("");
    }
    async function send() {
      const input = document.getElementById("input");
      const text = input.value.trim();
      if (!text) return;
      await fetch("/api/messages", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({text})
      });
      input.value = "";
      load();
    }
    async function del(id) {
      await fetch("/api/messages/" + id, {method: "DELETE"});
      load();
    }
    document.getElementById("input").addEventListener("keydown", e => {
      if (e.key === "Enter") send();
    });
    load();
  </script>
</body>
</html>"#;
```

## 4. Dockerfile を作成

```dockerfile
# Stage 1: Build
FROM rust:1.86-alpine AS builder
WORKDIR /app
RUN apk add --no-cache musl-dev
COPY Cargo.toml ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY src ./src
RUN touch src/main.rs && cargo build --release

# Stage 2: Production runner
FROM alpine:3.21
WORKDIR /app
COPY --from=builder /app/target/release/myapp ./server
EXPOSE 3000
CMD ["./server"]
```

::: tip マルチステージビルドとビルドキャッシュ
`Cargo.toml` を先にコピーしてダミーの `main.rs` でビルドすることで、依存関係のコンパイル結果をキャッシュします。ソースコード変更時に依存関係の再コンパイルをスキップできるため、2回目以降のビルドが大幅に高速化されます。初回ビルドは Rust コンパイルに数分かかります。
:::

## 5. compose.yml を作成

```yaml
services:
  web:
    build: .
    ports:
      - "3000:3000"
```

## 6. .dockerignore を作成

```
.git
.gitignore
*.md
target/
```

## 7. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name rust-api --no-proxy

# デプロイ
conoha app deploy <サーバー名> --app-name rust-api --no-proxy
```

## 8. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name rust-api

# ログ確認
conoha app logs <サーバー名> --app-name rust-api
```

ブラウザで `http://<サーバーIP>:3000` にアクセスしてメッセージボードが表示されれば完了です。

API エンドポイントは curl でも確認できます。

```bash
# メッセージ一覧
curl http://<サーバーIP>:3000/api/messages

# メッセージ作成
curl -X POST http://<サーバーIP>:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from ConoHa!"}'

# ヘルスチェック
curl http://<サーバーIP>:3000/health
```

## 環境変数を使う場合

```bash
conoha app env set <サーバー名> --app-name rust-api \
  RUST_LOG=info \
  PORT=3000

# 再デプロイで反映
conoha app deploy <サーバー名> --app-name rust-api --no-proxy
```

## コード更新

コードを変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name rust-api --no-proxy
```

## データベースを追加する場合

永続化が必要になったら compose.yml にデータベースを追加し、SQLx や Diesel などの ORM を導入します。

```yaml
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/mydb
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:17-alpine
    environment:
      - POSTGRES_PASSWORD=pass
      - POSTGRES_USER=user
      - POSTGRES_DB=mydb
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  db_data:
```
