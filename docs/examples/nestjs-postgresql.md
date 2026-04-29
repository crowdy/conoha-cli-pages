# NestJS + PostgreSQL デプロイ

NestJS と PostgreSQL を使った投稿アプリをConoHa VPSにデプロイする手順です。TypeORM による CRUD 機能を持ちます。


::: tip 本例は no-proxy モードで動作します
[アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。HTTPS / blue-green を使う場合は [Hello World](/examples/hello-world) や [Next.js](/examples/nextjs) の proxy モード版を参考にしてください。
:::

## 完成イメージ

- `http://<サーバーIP>:3000` で投稿一覧ページが表示される
- テーブルはアプリ起動時にTypeORMが自動作成する
- `conoha app deploy` でコード更新を即座に反映

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

## 1. プロジェクトを作成

```bash
npm install -g @nestjs/cli
nest new nestjs-app
cd nestjs-app
npm install @nestjs/typeorm typeorm pg hbs
```

## 2. package.json を確認

```json
{
  "name": "conoha-nestjs-sample",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:prod": "node dist/main"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/typeorm": "^11.0.0",
    "hbs": "^4.2.0",
    "pg": "^8.13.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.0",
    "typeorm": "^0.3.20"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "typescript": "^5.7.0"
  }
}
```

## 3. src/app.module.ts を作成

TypeORM の接続設定とモジュール定義です。

```typescript
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Post } from "./post.entity";
import { PostsController } from "./posts.controller";
import { PostsService } from "./posts.service";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST || "db",
      port: 5432,
      username: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "app_production",
      entities: [Post],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Post]),
  ],
  controllers: [PostsController],
  providers: [PostsService],
})
export class AppModule {}
```

## 4. src/post.entity.ts を作成

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("posts")
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: "text", nullable: true })
  body: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

## 5. src/posts.service.ts を作成

```typescript
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Post } from "./post.entity";

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly repo: Repository<Post>,
  ) {}

  findAll(): Promise<Post[]> {
    return this.repo.find({ order: { createdAt: "DESC" } });
  }

  create(title: string, body: string): Promise<Post> {
    const post = this.repo.create({ title, body });
    return this.repo.save(post);
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
```

## 6. src/posts.controller.ts を作成

```typescript
import { Body, Controller, Get, Post as HttpPost, Param, Render, Redirect } from "@nestjs/common";
import { PostsService } from "./posts.service";

@Controller()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @Render("index")
  async index() {
    const posts = await this.postsService.findAll();
    return { posts };
  }

  @HttpPost("posts")
  @Redirect("/")
  async create(@Body() body: { title: string; body: string }) {
    await this.postsService.create(body.title, body.body);
  }

  @HttpPost("posts/:id/delete")
  @Redirect("/")
  async remove(@Param("id") id: string) {
    await this.postsService.remove(Number(id));
  }
}
```

## 7. views/index.hbs を作成

Handlebars テンプレートエンジンで描画される投稿一覧ページです。

```bash
mkdir views
```

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NestJS on ConoHa</title>
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
    button { padding: 0.5rem 1.5rem; background: #e0234e; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
    .delete { background: #d32f2f; font-size: 0.85rem; padding: 0.3rem 0.8rem; }
    form.inline { display: inline; }
  </style>
</head>
<body>
  <h1>NestJS on ConoHa</h1>
  <div class="form-box">
    <form action="/posts" method="post">
      <input type="text" name="title" placeholder="Title" required>
      <textarea name="body" placeholder="Body (optional)"></textarea>
      <button type="submit">Create Post</button>
    </form>
  </div>
  {{#each posts}}
    <div class="post">
      <h2>{{this.title}}</h2>
      <p>{{this.body}}</p>
      <form action="/posts/{{this.id}}/delete" method="post" class="inline">
        <button type="submit" class="delete">Delete</button>
      </form>
    </div>
  {{/each}}
</body>
</html>
```

## 8. Dockerfile を作成

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production runner
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/views ./views
COPY --from=builder /app/package.json ./
RUN npm install --omit=dev
EXPOSE 3000
CMD ["node", "dist/main"]
```

## 9. compose.yml を作成

```yaml
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=db
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=app_production
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:17-alpine
    environment:
      - POSTGRES_PASSWORD=postgres
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  db_data:
```

## 10. .dockerignore を作成

```
README.md
.git
node_modules
dist
```

## 11. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name nestjs-app --no-proxy

# デプロイ
conoha app deploy <サーバー名> --app-name nestjs-app --no-proxy
```

## 12. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name nestjs-app

# ログ確認
conoha app logs <サーバー名> --app-name nestjs-app
```

ブラウザで `http://<サーバーIP>:3000` にアクセスして投稿一覧ページが表示されれば完了です。

## 環境変数を本番向けに設定する

```bash
conoha app env set <サーバー名> --app-name nestjs-app \
  DB_PASSWORD=your-secure-password \
  DB_NAME=app_production

# 再デプロイで反映
conoha app deploy <サーバー名> --app-name nestjs-app --no-proxy
```

::: warning
`synchronize: true` はテーブルを自動作成・更新しますが、開発用の設定です。本番環境ではTypeORMのマイグレーションを使用してください。
:::

## コード更新

コードを変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name nestjs-app --no-proxy
```
