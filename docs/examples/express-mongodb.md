# Express.js + MongoDB デプロイ

Express.js と MongoDB を使った投稿アプリをConoHa VPSにデプロイする手順です。Mongoose による CRUD 機能を持ちます。

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

## 4. Dockerfile を作成

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "app.js"]
```

## 5. compose.yml を作成

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

## 6. .dockerignore を作成

```
README.md
.git
node_modules
```

## 7. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name express-app

# デプロイ
conoha app deploy <サーバー名> --app-name express-app
```

## 8. 動作確認

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
conoha app deploy <サーバー名> --app-name express-app
```

::: warning
MongoDBは認証なしで起動するため、本番環境では認証設定を追加することを推奨します。
:::

## コード更新

コードを変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name express-app
```
