# Go Fiber デプロイ

Go と Fiber フレームワークで構築した高速 REST API サーバーを ConoHa VPS にデプロイする手順です。マルチステージビルドにより、最終イメージを最小限に抑えます。

## 完成イメージ

- Go Fiber アプリが `http://<サーバーIP>:3000` でアクセス可能
- インメモリでメッセージの CRUD を行う REST API
- `conoha app deploy` でコード更新を即座に反映

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

## 1. Go プロジェクトを作成

```bash
mkdir myapp && cd myapp
go mod init myapp
go get github.com/gofiber/fiber/v2
```

## 2. main.go を作成

```go
package main

import (
    "fmt"
    "log"
    "time"

    "github.com/gofiber/fiber/v2"
)

type Message struct {
    ID        int       `json:"id"`
    Text      string    `json:"text"`
    CreatedAt time.Time `json:"created_at"`
}

var messages []Message
var nextID = 1

func main() {
    app := fiber.New()

    // Health check
    app.Get("/health", func(c *fiber.Ctx) error {
        return c.JSON(fiber.Map{"status": "ok"})
    })

    // List messages
    app.Get("/api/messages", func(c *fiber.Ctx) error {
        return c.JSON(messages)
    })

    // Create message
    app.Post("/api/messages", func(c *fiber.Ctx) error {
        var body struct {
            Text string `json:"text"`
        }
        if err := c.BodyParser(&body); err != nil {
            return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
        }
        if body.Text == "" {
            return c.Status(400).JSON(fiber.Map{"error": "text is required"})
        }
        msg := Message{ID: nextID, Text: body.Text, CreatedAt: time.Now()}
        nextID++
        messages = append(messages, msg)
        return c.Status(201).JSON(msg)
    })

    // Delete message
    app.Delete("/api/messages/:id", func(c *fiber.Ctx) error {
        id, err := c.ParamsInt("id")
        if err != nil {
            return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
        }
        for i, msg := range messages {
            if msg.ID == id {
                messages = append(messages[:i], messages[i+1:]...)
                return c.SendStatus(204)
            }
        }
        return c.Status(404).JSON(fiber.Map{"error": "not found"})
    })

    fmt.Println("Server running on port 3000")
    log.Fatal(app.Listen(":3000"))
}
```

## 3. Dockerfile を作成

```dockerfile
# Stage 1: Build
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o server .

# Stage 2: Production runner
FROM alpine:3.21
WORKDIR /app
COPY --from=builder /app/server .
EXPOSE 3000
CMD ["./server"]
```

::: tip マルチステージビルド
ビルドステージで静的バイナリ（`CGO_ENABLED=0`）をコンパイルし、本番ステージでは素の `alpine` イメージにバイナリのみをコピーします。最終イメージはわずか数 MB になり、起動も非常に高速です。
:::

## 4. compose.yml を作成

```yaml
services:
  web:
    build: .
    ports:
      - "3000:3000"
```

## 5. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name go-api

# デプロイ
conoha app deploy <サーバー名> --app-name go-api
```

## 6. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name go-api

# ログ確認
conoha app logs <サーバー名> --app-name go-api
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
conoha app env set <サーバー名> --app-name go-api \
  PORT=3000 \
  LOG_LEVEL=info

# 再デプロイで反映
conoha app deploy <サーバー名> --app-name go-api
```

## コード更新

コードを変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name go-api
```

## データベースを追加する場合

永続化が必要になったら compose.yml にデータベースを追加し、GORM などの ORM を導入します。

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
