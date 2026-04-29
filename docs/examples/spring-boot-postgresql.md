# Spring Boot + PostgreSQL デプロイ

Spring Boot アプリを PostgreSQL と組み合わせて ConoHa VPS にデプロイする手順です。JPA による CRUD 機能を持つ投稿アプリを例に説明します。


::: tip 本例は no-proxy モードで動作します
[アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。HTTPS / blue-green を使う場合は [Hello World](/examples/hello-world) や [Next.js](/examples/nextjs) の proxy モード版を参考にしてください。
:::

## 完成イメージ

- Spring Boot アプリが `http://<サーバーIP>:8080` でアクセス可能
- PostgreSQL 17 がコンテナで起動し、データを永続化
- `conoha app deploy` でコード更新を即座に反映

## 前提条件

- ConoHa CLIがインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[サーバー管理](/guide/server)）

## 1. Spring Boot プロジェクトを作成

[Spring Initializr](https://start.spring.io/) で以下の依存関係を選択してプロジェクトを生成します。

- **Spring Web**
- **Spring Data JPA**
- **Thymeleaf**
- **PostgreSQL Driver**

```bash
# または Spring Boot CLI を使う場合
spring init --dependencies=web,data-jpa,thymeleaf,postgresql myapp
cd myapp
```

## 2. pom.xml の確認

主要な依存関係が含まれていることを確認します。

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-thymeleaf</artifactId>
    </dependency>
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <scope>runtime</scope>
    </dependency>
</dependencies>
```

## 3. Dockerfile を作成

```dockerfile
# Stage 1: Build with Maven
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY pom.xml .
RUN apk add --no-cache maven && mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -B

# Stage 2: Production runner
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
```

::: tip マルチステージビルド
ビルドステージでは JDK + Maven を使い、本番ステージでは JRE のみを使います。最終イメージから開発ツールを除外することでイメージサイズを削減できます。初回ビルドは Maven 依存関係のダウンロードに数分かかります。
:::

## 4. compose.yml を作成

```yaml
services:
  web:
    build: .
    ports:
      - "8080:8080"
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

::: info ヘルスチェック
`depends_on` に `condition: service_healthy` を指定することで、PostgreSQL が完全に起動してから Spring Boot コンテナが立ち上がります。起動直後の接続エラーを防げます。
:::

## 5. application.properties を設定

`src/main/resources/application.properties` にデータベース接続設定を追加します。

```properties
spring.datasource.url=jdbc:postgresql://${DB_HOST:db}:5432/${DB_NAME:app_production}
spring.datasource.username=${DB_USER:postgres}
spring.datasource.password=${DB_PASSWORD:postgres}
spring.jpa.hibernate.ddl-auto=update
spring.jpa.open-in-view=false
server.port=8080
```

## 6. エンティティクラスを作成

`src/main/java/com/example/app/Post.java` を作成します。

```java
package com.example.app;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "posts")
public class Post {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;
    private String body;

    public Post() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
}
```

## 7. リポジトリを作成

`src/main/java/com/example/app/PostRepository.java` を作成します。

```java
package com.example.app;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PostRepository extends JpaRepository<Post, Long> {
}
```

## 8. コントローラーを作成

`src/main/java/com/example/app/PostController.java` を作成します。

```java
package com.example.app;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class PostController {
    private final PostRepository repository;

    public PostController(PostRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/")
    public String index(Model model) {
        model.addAttribute("posts", repository.findAll());
        model.addAttribute("post", new Post());
        return "index";
    }

    @PostMapping("/posts")
    public String create(Post post) {
        repository.save(post);
        return "redirect:/";
    }

    @PostMapping("/posts/{id}/delete")
    public String delete(@PathVariable Long id) {
        repository.deleteById(id);
        return "redirect:/";
    }
}
```

## 9. Thymeleaf テンプレートを作成

`src/main/resources/templates/index.html` を作成します。

```html
<!DOCTYPE html>
<html lang="en" xmlns:th="http://www.thymeleaf.org">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spring Boot on ConoHa</title>
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
    form.inline { display: inline; }
    .form-box { background: #fff; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; }
    input, textarea { width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; box-sizing: border-box; }
    textarea { height: 80px; resize: vertical; }
    button { padding: 0.5rem 1.5rem; background: #1976d2; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
    .delete { background: #d32f2f; font-size: 0.85rem; padding: 0.3rem 0.8rem; }
  </style>
</head>
<body>
  <h1>Spring Boot on ConoHa</h1>
  <div class="form-box">
    <form th:action="@{/posts}" method="post" th:object="${post}">
      <input type="text" th:field="*{title}" placeholder="Title" required>
      <textarea th:field="*{body}" placeholder="Body (optional)"></textarea>
      <button type="submit">Create Post</button>
    </form>
  </div>
  <div th:each="p : ${posts}" class="post">
    <h2 th:text="${p.title}">Title</h2>
    <p th:text="${p.body}">Body</p>
    <form th:action="@{/posts/{id}/delete(id=${p.id})}" method="post" class="inline">
      <button type="submit" class="delete">Delete</button>
    </form>
  </div>
</body>
</html>
```

## 10. .dockerignore を作成

```
.git
.gitignore
*.md
target/
```

## 11. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name spring-app --no-proxy

# デプロイ
conoha app deploy <サーバー名> --app-name spring-app --no-proxy
```

## 12. 動作確認

```bash
# ステータス確認
conoha app status <サーバー名> --app-name spring-app

# ログ確認
conoha app logs <サーバー名> --app-name spring-app
```

ブラウザで `http://<サーバーIP>:8080` にアクセスして、投稿一覧ページが表示されれば完了です。

## 環境変数を使う場合

本番環境ではパスワードを環境変数で管理します。

```bash
conoha app env set <サーバー名> --app-name spring-app \
  DB_PASSWORD=your-secure-password \
  DB_NAME=your-db-name

# 再デプロイで反映
conoha app deploy <サーバー名> --app-name spring-app --no-proxy
```

## コード更新

コードを変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name spring-app --no-proxy
```

`spring.jpa.hibernate.ddl-auto=update` の設定により、エンティティの変更はデプロイ時に自動でスキーマに反映されます。
