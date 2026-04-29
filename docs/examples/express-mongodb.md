# Express.js + MongoDB デプロイ

Express.js と MongoDB を使った投稿アプリをConoHa VPSにデプロイする手順です。Mongoose による CRUD 機能を持ちます。


::: tip 本例は no-proxy モードで動作します
[アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。HTTPS / blue-green を使う場合は [Hello World](/examples/hello-world) や [Next.js](/examples/nextjs) の proxy モード版を参考にしてください。
:::

## 完成イメージ

- `http://<サーバーIP>:3000` で投稿一覧ページが表示される
- 投稿の作成・削除ができる
- MongoDBのデータはボリュームに永続化される

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

## 1. プロジェクトを作成

```bash
mkdir express-app
cd express-app
npm init -y
npm install express ejs mongoose
```

## 2. app.js を作成

```js
const express = require("express");
const mongoose = require("mongoose");

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
const mongoURL = process.env.MONGO_URL || "mongodb://db:27017/app";
mongoose.connect(mongoURL);

// Post schema
const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: String,
  createdAt: { type: Date, default: Date.now },
});
const Post = mongoose.model("Post", postSchema);

// Routes
app.get("/", async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.render("index", { posts });
});

app.post("/posts", async (req, res) => {
  await Post.create({ title: req.body.title, body: req.body.body });
  res.redirect("/");
});

app.post("/posts/:id/delete", async (req, res) => {
  await Post.findByIdAndDelete(req.params.id);
  res.redirect("/");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## 3. package.json を確認

```json
{
  "name": "conoha-express-sample",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node app.js"
  },
  "dependencies": {
    "express": "^5.1.0",
    "ejs": "^3.1.10",
    "mongoose": "^8.13.2"
  }
}
```

## 4. views/index.ejs を作成

EJS テンプレートエンジンで描画されるビューファイルを作成します。

```bash
mkdir views
```

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Express on ConoHa</title>
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
    .post { background: #fff; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
    .post h2 { margin: 0 0 0.5rem; font-size: 1.2rem; }
    .post p { margin: 0; color: #666; }
    .form-box { background: #fff; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; }
    input, textarea { width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; box-sizing: border-box; }
    textarea { height: 80px; resize: vertical; }
    button { padding: 0.5rem 1.5rem; background: #1976d2; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
    .delete { background: #d32f2f; font-size: 0.85rem; padding: 0.3rem 0.8rem; }
    form.inline { display: inline; }
  </style>
</head>
<body>
  <h1>Express on ConoHa</h1>
  <div class="form-box">
    <form action="/posts" method="post">
      <input type="text" name="title" placeholder="Title" required>
      <textarea name="body" placeholder="Body (optional)"></textarea>
      <button type="submit">Create Post</button>
    </form>
  </div>
  <% posts.forEach(post => { %>
    <div class="post">
      <h2><%= post.title %></h2>
      <p><%= post.body %></p>
      <form action="/posts/<%= post._id %>/delete" method="post" class="inline">
        <button type="submit" class="delete">Delete</button>
      </form>
    </div>
  <% }) %>
</body>
</html>
```

## 5. Dockerfile を作成

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "app.js"]
```

## 6. compose.yml を作成

```yaml
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGO_URL=mongodb://db:27017/app
    depends_on:
      - db

  db:
    image: mongo:8
    volumes:
      - db_data:/data/db

volumes:
  db_data:
```

## 7. .dockerignore を作成

```
README.md
.git
node_modules
```

## 8. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name express-app --no-proxy

# デプロイ
conoha app deploy <サーバー名> --app-name express-app --no-proxy
```

## 9. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name express-app

# ログ確認
conoha app logs <サーバー名> --app-name express-app
```

ブラウザで `http://<サーバーIP>:3000` にアクセスして投稿一覧ページが表示されれば完了です。

## 環境変数を設定する

```bash
conoha app env set <サーバー名> --app-name express-app \
  MONGO_URL=mongodb://db:27017/myapp

# 再デプロイで反映
conoha app deploy <サーバー名> --app-name express-app --no-proxy
```

::: warning
MongoDBは認証なしで起動するため、本番環境では認証設定を追加することを推奨します。
:::

## コード更新

コードを変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name express-app --no-proxy
```
