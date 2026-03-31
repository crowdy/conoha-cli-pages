# Spring Boot + PostgreSQL デプロイ

Spring Boot アプリを PostgreSQL と組み合わせて ConoHa VPS にデプロイする手順です。JPA による CRUD 機能を持つ投稿アプリを例に説明します。

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
spring.datasource.url=jdbc:postgresql://${DB_HOST:localhost}:5432/${DB_NAME:app_production}
spring.datasource.username=${DB_USER:postgres}
spring.datasource.password=${DB_PASSWORD:postgres}
spring.jpa.hibernate.ddl-auto=update
```

## 6. デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名> --app-name spring-app

# デプロイ
conoha app deploy <サーバー名> --app-name spring-app
```

## 7. 動作確認

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
conoha app deploy <サーバー名> --app-name spring-app
```

## コード更新

コードを変更したら、同じコマンドで再デプロイ:

```bash
conoha app deploy <サーバー名> --app-name spring-app
```

`spring.jpa.hibernate.ddl-auto=update` の設定により、エンティティの変更はデプロイ時に自動でスキーマに反映されます。
