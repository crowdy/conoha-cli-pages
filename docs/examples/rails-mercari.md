# Rails マーケットプレイス (Dex OIDC + Sidekiq) デプロイ

Mercari 風の中古マーケットプレイスアプリを ConoHa VPS に一括デプロイするサンプルです。Rails 8.1 製の出品・購入フローに加え、OIDC プロバイダー **[Dex](https://dexidp.io/)** によるログインと、**[Sidekiq](https://sidekiq.org/)** + Redis を使った非同期通知を備えた、本シリーズで最も重量級のフルスタック構成です。ローカルに Ruby/Node のセットアップは一切不要で、`conoha app deploy` 一発で 6 コンテナが立ち上がります。

この構成は **3 つの FQDN** を conoha-proxy 経由で公開します: root FQDN (`rails-mercari.example.com`) は既存の nginx 集約レイヤー、`app.example.com` は Rails `web` を直接 blue/green で公開、`auth.example.com` は Dex OIDC を独立サブドメインで公開します。nginx・Dex・Rails それぞれ異なる役割で `hosts:` / `expose:` を使い分ける、これまでの proxy パターンの総合形です。

::: tip 本例は proxy モード対応 (`conoha.yml` 同梱)
HTTPS 終端と blue/green スロット切替は conoha-proxy が担当します。3 つの FQDN と `web:` / `expose:` の使い分けについては [2. conoha.yml](#_2-conoha-yml) で詳しく解説します。
:::

::: info GPU は不要
Rails・Dex・Sidekiq のいずれも推論処理を行いません。CPU-only フレーバーで動作しますが、6 コンテナ構成のため **RAM は 2GB 以上を推奨**します（[前提条件](#前提条件) 参照）。
:::

## 完成イメージ

- ホーム画面に商品一覧（Mercari 風マーケットプレイス）が表示される
- 「Dex でログイン」ボタンから `auth.example.com` の Dex ログイン画面に遷移し、`seller@example.com` / `password` でログインできる
- ログイン後 `app.example.com` の `/auth/dex/callback` に戻り、Rails 側でセッションが確立する
- 出品者として「出品する」から商品を登録できる（状態は `on_sale` / `sold`）
- `buyer@example.com` でログインし直し、「購入する」を押すと商品が SOLD になる
- 購入操作は Sidekiq の非同期ジョブ (`PurchaseNotificationJob`) をトリガーし、`conoha app logs` に `[NOTIFICATION] Item '...' purchased ...` というログが出力される

## アーキテクチャ

```
ブラウザ ─┬─ https://rails-mercari.example.com → proxy → nginx:80 ─┬─ / → web:3000 (Rails/Puma)
          │                                                        └─ /dex/ → dex:5556
          ├─ https://app.example.com  → proxy → web:3000  (Rails 直接, blue/green)
          └─ https://auth.example.com → proxy → dex:5556  (OIDC issuer)
                 internal: web/sidekiq → db:5432, redis:6379 ; dex → db:5432（別 `dex` DB）
```

| レイヤー | サービス | 技術 | 公開先 | blue/green |
|---|---|---|---|---|
| ルート Web | `nginx` | nginx alpine（集約プロキシ） | `rails-mercari.example.com`（root web） | yes |
| アプリ本体 | `web` | Rails 8.1 / Puma | `app.example.com`（`expose:`） | yes |
| OIDC プロバイダー | `dex` | dexidp/dex v2.45.1 | `auth.example.com`（`expose:`） | `blue_green: false` |
| ジョブワーカー | `sidekiq` | Sidekiq 7.3（同一イメージ） | — | accessory のみ |
| データベース | `db` | PostgreSQL 17-alpine | — | accessory のみ |
| キャッシュ | `redis` | Redis 7-alpine | — | accessory のみ |

nginx は root FQDN のアプリ shell を後方互換のために維持しつつ内部で `web` と `dex` を集約し、`app.` / `auth.` の各サブドメインはそれぞれのサービスへ直結します。**nginx は静的アセットを一切配信しません** — `nginx.conf` は `/` → Rails、`/dex/` → Dex への単純なリバースプロキシのみで、`root` / `try_files` もアセット用ボリュームもありません。Dockerfile も `assets:precompile` を実行せず、Rails/Puma がアセットを含め全てを配信します（詳しくは [3. nginx.conf](#_3-nginx-conf) 参照）。

## 前提条件

- conoha-cli **≥ v0.6.1** がインストール・ログイン済み（[はじめに](/guide/getting-started)）
  - `expose:` ブロックの `blue_green: false` が proxy に正しくルーティングされるのは v0.6.1 以降です（[conoha-cli#163](https://github.com/crowdy/conoha-cli/issues/163)）
- **CPU フレーバー**（GPU 不要）— **RAM 2GB 以上を推奨**（[サーバー管理](/guide/server)）。Rails/Puma と Sidekiq はどちらも Rails フル起動のプロセスを持つため、Postgres + Redis + Dex + nginx を合わせた 6 コンテナで RAM を消費します。加えて `app.` / root の blue/green デプロイ時は Rails + nginx のスロットが一時的に二重化するため、デプロイ時のピークメモリにも余裕を持たせてください
- **3 つの DNS A レコード**を同じサーバー IP に向けていること（[DNS / TLS](/guide/dns-tls)）:
  - `rails-mercari.example.com`（root — nginx 集約）
  - `app.example.com`（Rails `web` 直接、blue/green）
  - `auth.example.com`（Dex OIDC issuer）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）

## 1. compose.yml

完全版は [`rails-mercari/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/rails-mercari/compose.yml)。6 サービス、host port は使わず `expose:` のみです。

```yaml
services:
  nginx:
    image: nginx:alpine
    expose:
      - "80"           # No host port: conoha-proxy injects at deploy time
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - web
      - dex

  web:
    build: .
    expose:
      - "3000"
    environment:
      - RAILS_ENV=production
      - DB_HOST=db
      - DB_USER=postgres
      - DB_PASSWORD=${DB_PASSWORD:?required}
      - DB_NAME=app_production
      - SECRET_KEY_BASE=${SECRET_KEY_BASE:?required}
      - REDIS_URL=redis://redis:6379/0
      - OIDC_CLIENT_ID=mercari-app
      # OIDC_EXTERNAL_HOST / OIDC_REDIRECT_URI / OIDC_CLIENT_SECRET は
      # deliberately omitted — env_file (.env.server) 経由で渡す
      # (下記「compose の env_file 落とし穴」参照)。

  sidekiq:
    build: .
    command: bundle exec sidekiq
    environment:
      - RAILS_ENV=production
      - DB_HOST=db
      - DB_USER=postgres
      - DB_PASSWORD=${DB_PASSWORD:?required}
      - DB_NAME=app_production
      - SECRET_KEY_BASE=${SECRET_KEY_BASE:?required}
      - REDIS_URL=redis://redis:6379/0

  redis:
    image: redis:7-alpine
    volumes: [redis_data:/data]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 5

  dex:
    image: dexidp/dex:v2.45.1
    entrypoint: ["sh", "-c"]
    command:
      - |
        sed -e "s|__DEX_ISSUER_HOST__|$$DEX_ISSUER_HOST|g" \
            -e "s|__RAILS_HOST__|$$RAILS_HOST|g" \
            -e "s|__RAILS_OIDC_CLIENT_ID__|$$RAILS_OIDC_CLIENT_ID|g" \
            -e "s|__RAILS_OIDC_CLIENT_SECRET__|$$RAILS_OIDC_CLIENT_SECRET|g" \
            -e "s|__DEX_DB_PASSWORD__|$$DEX_DB_PASSWORD|g" \
            /etc/dex/dex.yml > /tmp/dex.yml && exec dex serve /tmp/dex.yml
    expose:
      - "5556"
    environment:
      - DEX_DB_PASSWORD=${DEX_DB_PASSWORD:?required}
    volumes:
      - ./dex.yml:/etc/dex/dex.yml:ro
    depends_on:
      db: { condition: service_healthy }
    healthcheck:
      # コンテナ内部のテレメトリポート 5558 を直接チェック（proxy 経由の
      # /dex/healthz とは別）
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:5558/healthz"]
      interval: 5s
      retries: 5

  db:
    image: postgres:17-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${DB_PASSWORD:?required}
      - POSTGRES_DB=app_production
      - DEX_DB_NAME=dex
      - DEX_DB_USER=dex
      - DEX_DB_PASSWORD=${DEX_DB_PASSWORD:?required}
    volumes:
      - db_data:/var/lib/postgresql/data
      - ./init-db.sh:/docker-entrypoint-initdb.d/init-db.sh:ro   # dex 用 DB を別途作成
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 5

volumes:
  db_data:
  redis_data:
```

`bin/docker-entrypoint` はコンテナ起動時に `./bin/rails db:prepare` を実行するため、初回起動は DB マイグレーションを含みます（`web` の `/up` ヘルスチェックが `unhealthy_threshold: 24` になっている理由。後述）。`db` は `init-db.sh` により Rails 用 DB (`app_production`) とは別に `dex` DB を作成します。

::: warning `OIDC_*` 変数を `web` / `dex` の `environment:` に追加しないこと
`OIDC_EXTERNAL_HOST` / `OIDC_REDIRECT_URI` / `OIDC_CLIENT_SECRET`（Rails 側）や `DEX_ISSUER_HOST` / `RAILS_HOST` / `RAILS_OIDC_CLIENT_*`（Dex 側）は、compose の `environment:` に書くとパース時に `${VAR:-default}` で解決されてしまい、conoha-cli が注入する `env_file`（`.env.server`）由来の値を上書きしてしまいます。サンプルはこれらを意図的に `environment:` から外し、`.env.server` 経由でのみ渡しています。
:::

## 2. conoha.yml

```yaml
name: rails-mercari
# Replace with your own FQDN before running `conoha app init`.
# Only the root web host goes here. Subdomains (e.g. auth.example.com,
# app.example.com) are declared per-block under `expose:` below — listing
# them here too fails validation ("host duplicates an entry in hosts[]").
# The proxy ACMEs the root and each expose host independently as long as
# DNS A records exist for them.
hosts:
  - rails-mercari.example.com
# nginx remains as the root web (port 80). It proxies both Rails (`web`) and
# Dex internally on the compose network — kept for backward compatibility
# and so the root FQDN still serves the app shell. The `expose:` blocks
# below add direct subdomain access for two reasons:
#   - `auth.example.com` so the browser OIDC discovery + redirect flow
#     reaches Dex under HTTPS (the original layout could not).
#   - `app.example.com` so the Rails `web` service gets its own slot-aware
#     blue/green rotation on `app deploy` (nginx-only blue/green left the
#     inner Rails container pinned to the build it was created with).
web:
  service: nginx
  port: 80
expose:
  # Dex OIDC provider, exposed on its own subdomain so the browser
  # discovery + redirect flow can reach it under HTTPS. blue_green: false
  # because Dex isn't slot-aware (Postgres-backed sessions / approval
  # state would diverge across slots otherwise).
  - label: auth
    host: auth.example.com
    service: dex
    port: 5556
    blue_green: false
    # Dex's default `/up` 404s; `/dex/healthz` returns 200 once OIDC is up.
    health:
      path: /dex/healthz
  # Rails app on its own subdomain with blue/green so code changes to
  # the `web` service rotate cleanly across slots (the previous
  # nginx-only blue/green didn't re-roll the Rails container).
  - label: app
    host: app.example.com
    service: web
    port: 3000
    blue_green: true
    # Rails 8.1 ships `/up` (rails/health#show); this sample's routes
    # are hand-written so the route is added explicitly in
    # config/routes.rb. First start runs DB migrations and can take ~30s.
    health:
      path: /up
      unhealthy_threshold: 24    # 24 × 5s = 120s
# `db` (PostgreSQL), `redis`, and `sidekiq` only serve compose-internal
# traffic and shouldn't be duplicated per blue/green slot. `sidekiq`
# stays accessory per issue #54 §1.3 (worker services out of scope).
accessories:
  - db
  - redis
  - sidekiq
```

**root FQDN は nginx、それとは独立に `app.` / `auth.` を `expose:` で直結：** `hosts:` に登録した root FQDN (`rails-mercari.example.com`) は `web.service: nginx` によってこれまで通り nginx コンテナへ届きます。一方、`expose:` の 2 ブロックはそれぞれ独立した HTTPS エンドポイントとして `web`（Rails）と `dex` に直結します。3 つの FQDN が同一サーバー上で共存し、それぞれ個別に Let's Encrypt 証明書を取得します。

**`app.example.com` に `blue_green: true` を付けた理由：** 旧レイアウトでは nginx だけが blue/green スロットを持ち、内部の Rails コンテナはビルド時点のまま固定されていました（コード変更が `app deploy` でロールしない）。`web` サービスを `app.` サブドメインで直接 `expose:` することで、Rails 自身がスロット切替の対象になり、コード更新が確実に反映されます。

**`auth.example.com` に `blue_green: false` を付けた理由：** Dex はセッション・承認状態を Postgres の `dex` DB に保存します。blue/green を有効にすると 2 スロットが同じ Postgres バックエンドを共有しつつも、切替タイミングで別インスタンスとして扱われ、ログインフローが不安定になるおそれがあります。そのため Dex は 1 インスタンスに固定し、`blue_green: false` としています。

**`/up` と `unhealthy_threshold: 24`：** Rails 8.1 は標準で `/up`（`Rails::HealthController`）を提供しますが、本サンプルはハンドメイドのルーティングのため `config/routes.rb` に明示的に追加しています。コンテナ起動時に `bin/docker-entrypoint` が `rails db:prepare` を実行し初回マイグレーションを走らせるため、起動から `/up` が 200 を返すまで最大 30 秒程度かかります。conoha-proxy のデフォルト `unhealthy_threshold: 3`（3 × 5 秒 = 15 秒）では待ちきれず初回デプロイが unhealthy 判定になるため、`unhealthy_threshold: 24`（24 × 5 秒 = 120 秒）に緩めています。

**`accessories:` の `db` / `redis` / `sidekiq`：** いずれも compose 内部通信のみのサービスで、blue/green スロットごとに複製する必要がありません。`sidekiq` は inbound HTTP ポートを持たない worker のため、conoha-cli spec issue #54 §1.3 の方針により accessory 側に留まります（= `sidekiq` のコード更新は `app deploy` でスロット切替されません。[ハマりどころ](#ハマりどころ) 参照）。

## 3. nginx.conf

完全版は [`rails-mercari/nginx.conf`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/rails-mercari/nginx.conf)。

```nginx
upstream rails { server web:3000; }
upstream dex_upstream { server dex:5556; }
server {
    listen 80;
    location /dex/ {
        proxy_pass http://dex_upstream/dex/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location / {
        proxy_pass http://rails;
        proxy_set_header Host $host;
    }
}
```

この通り、nginx がやっているのは `/` → Rails、`/dex/` → Dex への単純なリバースプロキシだけです。`root` や `try_files`、アセット用のボリュームマウントは一切ありません。**Dockerfile も `assets:precompile` を実行しません** — CSS/JS/画像を含めたすべての静的アセットは Rails/Puma（`web` コンテナ）自身が配信します。nginx を「アセットサーバー」と誤解しないよう注意してください。

## 4. 環境変数

`.env.example` は同梱されておらず、すべて `conoha app env set` で設定します。秘密情報は `openssl rand` で生成してください。

| 変数 | 種別 | 説明 |
|---|---|---|
| `DB_PASSWORD` | secret | PostgreSQL `postgres` ユーザーのパスワード。`openssl rand -base64 32` |
| `SECRET_KEY_BASE` | secret | Rails のセッション/クッキー署名鍵。`openssl rand -hex 64`。**`RAILS_MASTER_KEY` は使いません** — アプリは `SECRET_KEY_BASE` を直接環境変数から読みます（`credentials.yml.enc` 不使用） |
| `DEX_DB_PASSWORD` | secret | Dex 用 Postgres ユーザー（`dex` DB）のパスワード。`openssl rand -base64 32` |
| `DEX_ISSUER_HOST` | required | ブラウザ向け Dex の公開ホスト名。`issuer: https://<host>/dex` の組み立てに使用。実際の `auth.<FQDN>` を指定 |
| `RAILS_HOST` | required | ブラウザ向け Rails の公開ホスト名。redirect_uri (`https://<host>/auth/dex/callback`) の組み立てに使用。実際の `app.<FQDN>` を指定 |
| `RAILS_OIDC_CLIENT_ID` | not secret | Dex 側の static client id（サンプルで設定済み: `mercari-app`）。`OIDC_CLIENT_ID` と一致させる |
| `RAILS_OIDC_CLIENT_SECRET` | secret | Dex 側の OIDC クライアントシークレット。`openssl rand -base64 32` |
| `OIDC_CLIENT_SECRET` | secret | Rails/OmniAuth 側の OIDC クライアントシークレット。`openssl rand -base64 32`。**`RAILS_OIDC_CLIENT_SECRET` と完全に同一の値でなければなりません**（不一致だと token 交換が失敗します） |

::: warning `RAILS_OIDC_CLIENT_SECRET` と `OIDC_CLIENT_SECRET` は同一の値にすること
`RAILS_OIDC_CLIENT_SECRET`（Dex の `staticClients[].secret`）と `OIDC_CLIENT_SECRET`（Rails OmniAuth の `client_options.secret`）が一致していないと、Dex ログイン後の OIDC トークン交換が失敗し、`/auth/dex/callback` でエラーになります。`conoha app env set` で両方に同じ生成値を渡してください。
:::

::: warning 既知の制限（conoha-cli#166）: `${VAR:-default}` interpolation が env_file の値を握り潰す
`web` / `db` サービスの `DB_PASSWORD` / `SECRET_KEY_BASE` / `DEX_DB_PASSWORD` は compose 上で `${VAR:-default}` interpolation を保持しているため、`conoha app env set` で設定した値が [conoha-cli#166](https://github.com/crowdy/conoha-cli/issues/166) の修正までは反映されません。回避策は `compose.yml` の該当箇所を手動で `${VAR:?required}` などに書き換え、デフォルト値の解決を止めることです。OIDC 関連の変数（`DEX_ISSUER_HOST` / `RAILS_HOST` / `RAILS_OIDC_CLIENT_*` / `OIDC_CLIENT_SECRET`）はそもそも `environment:` に書かれていないため、この問題を回避できています。
:::

## 5. デプロイ

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/rails-mercari

# conoha.yml の 3 つの FQDN を書き換える:
#   hosts[0]              → rails-mercari.example.com
#   expose[label=auth].host → auth.example.com
#   expose[label=app].host  → app.example.com
$EDITOR conoha.yml
```

::: warning 3 つの DNS A レコードが必要（頻出ミス）
`rails-mercari.example.com`・`app.example.com`・`auth.example.com` の **すべて** の A レコードを同じ VPS IP に向けてください。1 つでも欠けると、その FQDN の Let's Encrypt 証明書発行が失敗し SSL エラーになります。

```bash
# 伝播確認（3 つとも同じ IP が返ること）
dig +short rails-mercari.example.com
dig +short app.example.com
dig +short auth.example.com
```
:::

```bash
conoha proxy boot --acme-email you@example.com myserver   # サーバーごとに 1 回

conoha app init myserver

conoha app env set myserver \
  DB_PASSWORD=$(openssl rand -base64 32) \
  SECRET_KEY_BASE=$(openssl rand -hex 64) \
  DEX_DB_PASSWORD=$(openssl rand -base64 32) \
  DEX_ISSUER_HOST=auth.example.com \
  RAILS_HOST=app.example.com \
  RAILS_OIDC_CLIENT_ID=mercari-app \
  RAILS_OIDC_CLIENT_SECRET=$(openssl rand -base64 32) \
  OIDC_CLIENT_SECRET=$(openssl rand -base64 32)

conoha app deploy myserver   # 初回は image pull + DB migration で 5–10 分
```

`RAILS_OIDC_CLIENT_SECRET` と `OIDC_CLIENT_SECRET` に**同じ生成値**を渡す必要がある点に注意してください（上記コマンド例では別々の `openssl rand` を呼んでいるため、実際にコピー&ペーストする場合は一方の出力をもう一方にも使うか、変数に保存してから両方に渡してください）。

## 6. 動作確認

```bash
conoha app status myserver
conoha app logs myserver

# Rails ヘルスチェック（200 が返れば起動完了）
curl -i https://app.example.com/up

# Dex OIDC ヘルスチェック（200 が返れば Dex 起動完了）
curl -i https://auth.example.com/dex/healthz
```

ブラウザで `https://rails-mercari.example.com`（または `https://app.example.com`）を開くと商品一覧のホーム画面が表示されます。

### テストユーザー

サンプルの `dex.yml` には以下のテスト用ユーザーが `staticPasswords` として定義されています。**本番公開前に必ず変更してください。**

| メールアドレス | パスワード | 役割 |
|---|---|---|
| `seller@example.com` | `password` | 出品者 |
| `buyer@example.com` | `password` | 購入者 |

1. ホーム画面で **Dex でログイン** をクリック → `https://auth.example.com` の Dex ログイン画面にリダイレクト
2. `seller@example.com` / `password` を入力してログイン
3. `https://app.example.com/auth/dex/callback` を経由して Rails 側にセッションが確立
4. 「出品する」から商品を登録（`on_sale` 状態になる）
5. ログアウトして `buyer@example.com` / `password` で再ログイン
6. 出品済み商品の「購入する」をクリック → 商品が `sold` に変わる
7. `conoha app logs myserver` を確認すると、Sidekiq がキューから `PurchaseNotificationJob` を処理したログ（`[NOTIFICATION] Item '...' purchased ...`）が出力される

## OIDC split-horizon（`config/initializers/omniauth.rb`）

Rails の OmniAuth 設定は、ブラウザ向けエンドポイントとサーバー間エンドポイントを明確に分けています:

- **ブラウザ向け**（issuer / authorization_endpoint）: `https://auth.example.com/dex` — HTTPS の `auth.` サブドメインを使い、conoha-proxy の証明書を経由する
- **サーバー間**（token / userinfo / jwks）: `http://dex:5556/dex` — compose 内部ネットワークを直接使う plain HTTP

`discovery: false` を指定して手動でエンドポイントを列挙しているのは、`openid_connect` gem がディスカバリを有効にすると全エンドポイントに HTTPS を強制してしまうためです。内部通信は plain HTTP なので、ディスカバリを有効にすると `web` → `dex` のサーバー間呼び出しが失敗します。

## カスタマイズ

- **本番環境の Dex ユーザー**: `dex.yml` の `staticPasswords` は本番公開前に削除し、GitHub・Google・LDAP などの外部 IdP コネクタに置き換えてください
- **Sidekiq のスケールアップ**: `sidekiq` は accessory のため `compose.yml` の `replicas` を変更後 `docker compose up -d sidekiq` で手動反映が必要です（`app deploy` では反映されません）
- **通知ジョブの拡張**: `PurchaseNotificationJob` を編集してメール送信や Slack Webhook 連携に差し替え可能です
- **Rails 側の機能追加**: `app/controllers/` / `app/views/` を編集し、`db/migrate/` に新しいマイグレーションを追加してスキーマを変更できます

## ハマりどころ

::: warning OIDC クライアントシークレットの不一致
`RAILS_OIDC_CLIENT_SECRET`（Dex 側）と `OIDC_CLIENT_SECRET`（Rails 側）が完全に一致していないと、Dex ログイン後の OIDC トークン交換が失敗します。両方の値を同じ生成結果に揃えてください。
:::

::: warning `RAILS_HOST` / `DEX_ISSUER_HOST` は実際の FQDN を指定すること
`RAILS_HOST` は Rails の redirect_uri、`DEX_ISSUER_HOST` は Dex の issuer URL の組み立てに使われます。プレースホルダのまま、または誤った値を設定すると、callback の mismatch や issuer claim の検証エラーでログインが失敗します。
:::

::: warning compose の `${VAR:-default}` interpolation が secret を握り潰す（conoha-cli#166）
`DB_PASSWORD` / `SECRET_KEY_BASE` / `DEX_DB_PASSWORD` は `web` / `db` の `environment:` に `${VAR:-default}` の形で残っているため、`conoha app env set` で設定したユーザー値が反映されないことがあります。OIDC 関連の変数はこの問題を避けるため意図的に `environment:` から外されています — これらを `environment:` に書き戻さないでください。
:::

::: warning OIDC discovery を有効にしないこと
サンプルは `discovery: false` にして `http://dex:5556/dex` へのエンドポイントを手動指定しています。discovery を有効にすると `openid_connect` gem が内部通信にも HTTPS を要求し、compose 内部ネットワーク上の plain HTTP 呼び出しが失敗します。
:::

::: warning Dex と Sidekiq はスロット切替の対象外
Dex は Postgres バックエンドのセッション/承認状態がスロット間で分散するのを避けるため `blue_green: false` に固定されています。Sidekiq は `accessories:` に置かれ、`app deploy` ではロールされません。両方を blue/green に切り替えないでください — Dex はログインループ、Sidekiq は accessory 前提のヘルスチェック欠如により想定外の挙動を招きます。
:::

::: warning 初回起動は DB マイグレーションで時間がかかる
コンテナ起動時に `bin/docker-entrypoint` が `rails db:prepare` を実行するため、`/up` が 200 を返すまで最大 30 秒程度かかることがあります（`unhealthy_threshold: 24` ≈ 120 秒で吸収）。また `init-db.sh` は **空の Postgres ボリュームに対してのみ** `dex` DB を作成するため、既存ボリュームを使い回すと `dex` DB が作られない場合があります。Dex のヘルスチェックは proxy 経由の `/dex/healthz` とコンテナ内部の `:5558/healthz` の 2 種類で、いずれも `/up` ではありません。
:::

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の rails-mercari](https://github.com/crowdy/conoha-cli-app-samples/tree/main/rails-mercari)
- Dex: [dexidp.io](https://dexidp.io/) / [dexidp/dex](https://github.com/dexidp/dex)
- Sidekiq: [sidekiq.org](https://sidekiq.org/)
- 関連サンプル:
  - [Outline (Dex OIDC on サブドメイン)](/examples/outline) — Dex OIDC-on-subdomain パターンの原型
  - [Gitea](/examples/gitea) — よりシンプルなセルフホスト Git サービス（no-proxy の基礎パターン）
  - [Ory Hydra + FastAPI (OAuth2)](/examples/hydra-python-api) — 代替 OIDC プロバイダーを使うパターン
  - [Rails + PostgreSQL](/examples/rails-postgresql) — Dex / Sidekiq なしのシンプルな Rails ステップダウン版
