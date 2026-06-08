# Supabase Self-host デプロイ

[Supabase](https://supabase.com/) は Postgres を中核に置いたオープンソースの Firebase 代替 BaaS（Backend as a Service）です。GoTrue による認証、PostgREST による自動 REST API 生成、Realtime サブスクリプション、Storage、そして Table Editor / SQL Editor を搭載した管理 UI（Studio）を単一の Docker Compose スタックでセルフホストできます。`@supabase/supabase-js` を使うクライアントアプリは、Supabase Cloud と同じ SDK コードをそのまま自前の FQDN に向けるだけで動作します。

このサンプルは Supabase フルスタックを **1 台の VPS** に展開します。外部に公開するのは 2 つの FQDN のみです: **Kong API ゲートウェイ**（クライアント SDK が叩く root FQDN）と **Studio 管理 UI**（`admin.` サブドメイン）。GoTrue・PostgREST・postgres-meta・PostgreSQL はすべて compose 内部でのみ到達可能な accessory として扱い、インターネットには一切露出しません。

conoha-proxy が HTTPS 終端と Let's Encrypt 証明書の自動取得を担当します。root FQDN は blue/green スロット切替に対応しており、Studio サブドメインは `blue_green: false` で 1 インスタンスに固定されます（詳細は [2. conoha.yml](#_2-conoha-yml) で解説）。

::: tip 本例は proxy モード対応 (`conoha.yml` 同梱)
HTTPS 終端と blue/green スロット切替は conoha-proxy が担当します。`expose:` ブロックを使った 2 FQDN パターン（root Kong + admin Studio サブドメイン）と 4 つの accessory 分割については [2. conoha.yml](#_2-conoha-yml) で詳しく解説します。
:::

::: tip GPU は不要
Supabase は Postgres 読み書き・認証・REST API 処理のみで動作します。推論処理は一切ありません。CPU-only フレーバー（`g2l-t-4`、**4GB RAM 以上推奨**）で十分動作します。
:::

## 完成イメージ

- `https://supabase-selfhost.example.com` に Supabase API が公開され、`@supabase/supabase-js` でそのまま接続できる（`/rest/v1/*`・`/auth/v1/*` など SDK の標準パスが Kong 経由でルーティングされる）
- `https://admin.supabase-selfhost.example.com` に Studio 管理 UI が公開され、ブラウザから Table Editor・SQL Editor・Auth ユーザー管理・Database 設定が利用できる
- テーブル作成・RLS ポリシー設定・Auth プロバイダー（メール/パスワード、OAuth2 など）の設定が Studio から GUI で完結する
- `ANON_KEY` / `SERVICE_ROLE_KEY` を使い分けることで Row Level Security が機能し、ユーザーごとのデータアクセス制御が Kong 経由で正しく適用される
- Next.js / SvelteKit / Flutter など Supabase 公式 SDK に対応したフレームワークから自前 FQDN を使って接続できる

## アーキテクチャ

```
   ブラウザ ──HTTPS──► conoha-proxy (ACME Let's Enc)
   (2 FQDN)               │  (blue/green slots)
                           │
                           ├──→ kong:8000   (supabase-selfhost.example.com — root web)
                           │       ├── /auth/v1/*  → auth:9999   (GoTrue)
                           │       ├── /rest/v1/*  → rest:3000   (PostgREST)
                           │       └── /pg/*       → meta:8080   (postgres-meta)
                           │
                           └──→ studio:3000  (admin.supabase-selfhost.example.com)
                                   blue_green: false
                                   └── Table Editor / SQL Editor / Auth 管理

                         auth  (accessory) ─┐
                         rest  (accessory) ─┤
                         meta  (accessory) ─┼─ compose 内部通信のみ
                         db    (accessory) ─┘
```

| レイヤー | サービス | 技術 | blue/green |
|---|---|---|---|
| API ゲートウェイ | `kong` | Kong 3.9 — 宣言型設定、key-auth + CORS | yes（root FQDN） |
| 管理 UI | `studio` | supabase/studio — Next.js | `blue_green: false`（postgres-meta 接続プール） |
| 認証 | `auth` | supabase/gotrue v2.170 | accessory のみ |
| REST API | `rest` | postgrest/postgrest v12.2 | accessory のみ |
| メタデータ API | `meta` | supabase/postgres-meta v0.88 | accessory のみ |
| データベース | `db` | supabase/postgres 15.8 | accessory のみ |

## 前提条件

- conoha-cli **≥ v0.6.1** がインストール・ログイン済み（[はじめに](/guide/getting-started)）
  - `expose:` ブロックの `blue_green: false` が proxy に正しくルーティングされるのは v0.6.1 以降です（[conoha-cli#163](https://github.com/crowdy/conoha-cli/issues/163)）
- **CPU フレーバー**（GPU 不要）— **RAM 4GB 以上推奨**（Kong + Studio + GoTrue + PostgREST + postgres-meta + PostgreSQL の合計で 3〜4GB 使用）（[サーバー管理](/guide/server)）
- **2 つの DNS A レコード**をサーバー IP に向けていること（[DNS / TLS](/guide/dns-tls)）:
  - `supabase-selfhost.example.com`（Kong — クライアント SDK / REST / Auth の入口）
  - `admin.supabase-selfhost.example.com`（Studio 管理 UI）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）

## 1. compose.yml

完全版は [`supabase-selfhost/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/supabase-selfhost/compose.yml)。重要部分を抜粋します。

```yaml
services:
  kong:
    image: kong:3.9
    expose:
      - "8000"           # No host port: conoha-proxy injects at deploy time
    environment:
      - KONG_DATABASE=off
      - KONG_DECLARATIVE_CONFIG=/home/kong/kong.yml
      - KONG_PLUGINS=request-transformer,cors,key-auth,acl,basic-auth
      - SUPABASE_ANON_KEY=${ANON_KEY:?required}
      - SUPABASE_SERVICE_KEY=${SERVICE_ROLE_KEY:?required}
    volumes:
      - ./kong.yml:/home/kong/kong.yml:ro

  studio:
    image: supabase/studio:latest
    expose:
      - "3000"
    environment:
      - STUDIO_PG_META_URL=http://meta:8080
      - SUPABASE_URL=http://kong:8000
      - SUPABASE_ANON_KEY=${ANON_KEY:?required}
      - SUPABASE_SERVICE_KEY=${SERVICE_ROLE_KEY:?required}
    depends_on:
      - meta

  # auth (GoTrue), rest (PostgREST), meta (postgres-meta) — accessory only
  # All reference ${POSTGRES_PASSWORD:?required} and ${JWT_SECRET:?required}
  # via environment; API_EXTERNAL_URL / GOTRUE_SITE_URL flow through env_file.
  # Full definitions: supabase-selfhost/compose.yml

  db:
    image: supabase/postgres:15   # pinned in full compose.yml
    expose:
      - "5432"           # Internal only — never add ports: here
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:?required}
      - JWT_SECRET=${JWT_SECRET:?required}
    volumes:
      - supabase_db:/var/lib/postgresql/data
      - ./init/set-role-passwords.sh:/docker-entrypoint-initdb.d/zzz-set-role-passwords.sh:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U supabase_admin"]
      interval: 5s
      retries: 5

volumes:
  supabase_db:
```

::: warning `expose` を `ports` にしないこと
proxy モードでは `expose:` を使ってコンテナ側ポートだけを宣言します。`ports:` で公開すると blue/green スロットが衝突します。`db:5432` も `expose:` のまま残し、絶対に `ports:` で外部公開しないでください。詳しくは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。
:::

## 2. conoha.yml

```yaml
name: supabase-selfhost
# Replace with your own FQDNs before running `conoha app init`.
# Only the root web host goes here. Subdomains (e.g. admin.example.com)
# are declared per-block under `expose:` below — listing them here too
# fails validation ("host duplicates an entry in hosts[]"). The proxy
# ACMEs both the root and each expose host independently as long as
# DNS A records exist for them.
hosts:
  - supabase-selfhost.example.com
web:
  service: kong
  port: 8000
# Kong is the API gateway — Supabase client SDKs call `<FQDN>/rest/*`,
# `<FQDN>/auth/*`, etc., all routed through Kong on the root FQDN.
# Kong's `/rest/v1/` route requires the `apikey` header, so a plain
# probe against `/` returns 404 from Kong (no matching route). Probe
# the auth service health endpoint, which Kong proxies through and
# returns 200 without auth.
health:
  path: /auth/v1/health
  unhealthy_threshold: 24    # 24 × 5s = 120s; Supabase first-boot is slow
# Supabase Studio (admin UI) lives on its own subdomain so the
# browser can reach Table Editor / SQL Editor over HTTPS. Studio is
# a single-instance Next.js app with no slot-aware state, but its
# in-memory connection pool to postgres-meta isn't designed for
# parallel slots either, so blue_green:false matches spec §4.5.1.
expose:
  - label: admin
    host: admin.example.com
    service: studio
    port: 3000
    blue_green: false
    # Studio is a Next.js app; `/` returns 200 once the server is
    # accepting requests. (No `/up` or `/healthz` route ships with
    # supabase/studio — smoke would refine this if Studio gains a
    # cheaper probe endpoint upstream.)
    health:
      path: /
# `db` (PostgreSQL), `auth` (GoTrue), `rest` (PostgREST), and `meta`
# (postgres-meta) stay accessory-only. They're reached via Kong on
# the root FQDN (auth/rest) or by Studio internally (meta), and must
# never be exposed publicly — `db:5432` in particular has no auth in
# front of it beyond Postgres roles.
accessories:
  - auth
  - rest
  - meta
  - db
```

**root FQDN と Kong を `web` サービスに指定する理由：** Supabase クライアント SDK（`@supabase/supabase-js`）はすべての API 呼び出しをルートの FQDN に対して送ります — `<FQDN>/rest/v1/<table>`（PostgREST）、`<FQDN>/auth/v1/signup`（GoTrue）、`<FQDN>/auth/v1/token`（JWT 更新）など。これらのパスはすべて Kong が宣言型設定（`kong.yml`）に従ってバックエンドコンテナにルーティングします。したがって `web.service: kong` を指定することで、root FQDN への全トラフィックが Kong のポート 8000 に集約されます。Kong 以外のサービス（auth / rest / meta）を直接 web に据えると SDK の URL 体系が崩れます。

**`/auth/v1/health` プローブを使う理由：** Kong の root パス（`/`）にはデフォルトルートが存在しません。`kong.yml` に定義されているのは `/auth/v1/`・`/rest/v1/`・`/pg/` の 3 つのルートのみであり、いずれも一致しない `/` へのリクエストは Kong が `404 No Route matched with those values` を返します。このため conoha-proxy のデフォルトヘルスプローブ `/up` は使えません。`/auth/v1/health` は GoTrue の `/health` エンドポイントを Kong が `key-auth` プラグインなし（cors プラグインのみ）でプロキシするルートで、`apikey` ヘッダーなしで 200 を返します。これが Kong が認証不要で 200 を返せる唯一の実用的なプローブパスです。

**`unhealthy_threshold: 24` の理由：** conoha-proxy のデフォルト `unhealthy_threshold` は **3**（3 × 5 秒 = 15 秒）です。Supabase の初回起動は PostgreSQL の初期化スクリプト（Supabase 固有のロール・エクステンション設定）と GoTrue のマイグレーションが直列で走るため、Kong が `/auth/v1/health` に 200 を返せるようになるまでに 60〜120 秒かかることがあります。デフォルトの 15 秒では待ちきれず unhealthy 判定で初回デプロイが失敗します。`unhealthy_threshold: 24`（24 × 5 秒 = 120 秒）に設定することで、初回起動の遅さを安全に吸収できます。

**Studio サブドメインと `blue_green: false`：** `expose:` ブロックの `label: admin` エントリが `admin.supabase-selfhost.example.com` への HTTPS ルートを定義し、Let's Encrypt 証明書を root FQDN とは独立して自動取得します。Studio は Next.js アプリであるため、root FQDN の Kong ルーティングとは名前空間を分離することで、Kong の設定に Studio 向けルートを追加する必要がなくなります。`blue_green: false` を指定する理由は Studio の postgres-meta への接続プールです — Studio は起動時に `meta:8080` に対してインメモリ接続プールを確立しますが、このプールは blue/green の並列スロットを考慮した設計ではなく、2 スロットが同時に動くと接続状態が分断されます。`blue_green: false` により Studio は 1 インスタンスに固定されます。

**4 accessory 分割の理由：** `auth`（GoTrue）・`rest`（PostgREST）・`meta`（postgres-meta）・`db`（PostgreSQL）はすべて `accessories:` に入れており、外部から直接到達できません。`auth` と `rest` は Kong の `kong.yml` ルート定義（`/auth/v1/` → `auth:9999`、`/rest/v1/` → `rest:3000`）により root FQDN 経由で間接的に到達できます。`meta` は compose 内部で Studio だけが利用します。`db:5432` は compose ネットワーク内専用であり、Postgres ロール認証しか前段保護がないため、**絶対に外部公開してはいけません**。psql が必要な場合は `ssh root@<vps>` 後に `docker exec -it $(docker ps -q -f name=db) psql -U postgres` で接続してください。

## 3. 環境変数 (`.env`)

`conoha app env set` で以下の変数を設定します。`JWT_SECRET` を先に決め、それを使って 2 つの JWT を発行し、3 つまとめて投入することが重要です（順序を間違えると Kong の key-auth で 401 になります）。

| 変数 | 説明 |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL パスワード（必須）— `$(openssl rand -base64 32)` で生成 |
| `JWT_SECRET` | GoTrue・PostgREST の JWT 署名鍵（必須）— `$(openssl rand -base64 64)` で生成。**`ANON_KEY` / `SERVICE_ROLE_KEY` は両方ともこの鍵で署名された JWT のため、`JWT_SECRET` を変更すると両キーが無効になる** |
| `ANON_KEY` | anon ロールの JWT（必須）— `JWT_SECRET` から生成。手順: [Supabase 公式ドキュメント](https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys) |
| `SERVICE_ROLE_KEY` | service_role ロールの JWT（必須）— `JWT_SECRET` から生成。RLS をバイパスするフルアクセスキー（クライアントコードに埋め込まないこと） |
| `DASHBOARD_USERNAME` | Studio Basic 認証ユーザー名（任意だが推奨）— Studio アクセス制御の第一線 |
| `DASHBOARD_PASSWORD` | Studio Basic 認証パスワード（任意だが推奨） |
| `API_EXTERNAL_URL` | `https://supabase-selfhost.example.com`（必須）— GoTrue が OAuth2 コールバック URL などに使用 |
| `GOTRUE_SITE_URL` | `https://supabase-selfhost.example.com`（必須）— メール確認リンクのベース URL |
| `SUPABASE_PUBLIC_URL` | `https://supabase-selfhost.example.com`（必須）— Studio が接続文字列スニペットに表示する URL |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | メール認証（サインアップ確認・パスワードリセット）が必要な場合のみ設定 |

`ANON_KEY` / `SERVICE_ROLE_KEY` の生成は [Supabase セルフホスト — API キー生成](https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys) を参照してください。JWT ツールを使う場合は `role: "anon"` / `role: "service_role"` クレームと `iss: "supabase-demo"` を含む payload を `JWT_SECRET` で HS256 署名します。

## 4. デプロイ

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/supabase-selfhost

# conoha.yml の 2 つの FQDN を書き換える:
#   hosts[0]               → supabase-selfhost.example.com
#   expose[label=admin].host → admin.supabase-selfhost.example.com
$EDITOR conoha.yml
```

::: warning 2 つの DNS A レコードが必要（頻出ミス）
`supabase-selfhost.example.com` と `admin.supabase-selfhost.example.com` の **両方** の A レコードを VPS IP に向けてください。`admin.` を忘れると Let's Encrypt の証明書発行が失敗し、Studio が SSL エラーで開けなくなります。2 つとも同じ IP を指せば問題ありません。

```bash
# 伝播確認（2 つとも同じ IP が返ること）
dig +short supabase-selfhost.example.com
dig +short admin.supabase-selfhost.example.com
```
:::

```bash
conoha proxy boot --acme-email you@example.com myserver   # サーバーごとに 1 回

conoha app init myserver

# JWT_SECRET を先に決め、それを使って ANON_KEY / SERVICE_ROLE_KEY を生成してから 3 つまとめて投入する
conoha app env set myserver \
  POSTGRES_PASSWORD=$(openssl rand -base64 32) \
  JWT_SECRET=$(openssl rand -base64 64) \
  ANON_KEY=<JWT_SECRET から生成した anon ロールの JWT> \
  SERVICE_ROLE_KEY=<JWT_SECRET から生成した service_role ロールの JWT> \
  DASHBOARD_USERNAME=admin \
  DASHBOARD_PASSWORD=$(openssl rand -base64 32) \
  API_EXTERNAL_URL=https://supabase-selfhost.example.com \
  GOTRUE_SITE_URL=https://supabase-selfhost.example.com \
  SUPABASE_PUBLIC_URL=https://supabase-selfhost.example.com

conoha app deploy myserver   # 初回は image pull + Postgres 初期化 + service warm-up で 5–10 分
```

初回デプロイは Kong・Studio・GoTrue・PostgREST・postgres-meta・PostgreSQL のイメージ pull と Postgres 初期化スクリプト・GoTrue マイグレーションのため 5〜10 分かかります。`conoha app logs myserver` でログを確認しながら待機してください。

## 5. 動作確認

```bash
# GoTrue ヘルスチェック（Kong 経由）— {"status":"ok"} が返れば起動完了
curl -i https://supabase-selfhost.example.com/auth/v1/health

# PostgREST ヘルスチェック（ANON_KEY 必要）
curl -i -H "apikey: <ANON_KEY>" \
  https://supabase-selfhost.example.com/rest/v1/

# Studio 管理 UI
curl -o /dev/null -s -w "%{http_code}\n" \
  https://admin.supabase-selfhost.example.com/
```

ブラウザで `https://admin.supabase-selfhost.example.com/` を開くと Studio のダッシュボードが表示されます（`DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` で Basic 認証）。Table Editor から新規テーブルを作成して保存されることを確認してください。

::: warning admin サブドメインのアクセス制御
`https://admin.supabase-selfhost.example.com/` に到達できる相手は誰でも Studio を操作できます（Studio 自体は SERVICE_ROLE_KEY でフルアクセスする前提のため）。`DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` による Basic 認証はあくまで第一の防御線です。本番運用では IP 許可リスト・VPN・SSH トンネルなどの追加保護を検討してください。
:::

## 6. 初期セットアップ (SDK 接続)

Supabase JS SDK（`npm install @supabase/supabase-js`）をインストールして自前の FQDN に接続します:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://supabase-selfhost.example.com',
  '<ANON_KEY>'   // anon ロール — RLS で制限される公開キー
)

// テーブルに行を挿入（RLS policy で INSERT が許可されている場合）
const { data, error } = await supabase
  .from('todos')
  .insert({ title: '最初のタスク', done: false })

// 行を取得
const { data: todos } = await supabase
  .from('todos')
  .select('*')
```

認証フローは `supabase.auth.signUp({ email, password })` / `supabase.auth.signInWithPassword({ email, password })` で完結します。サインイン後は SDK が JWT を自動付与し、RLS policy の `auth.uid()` でユーザー固有のデータアクセス制御が機能します。メール確認を有効にするには `SMTP_*` 環境変数を設定してください。開発中は Studio の「Auth > Configuration」から確認メールを無効化できます。

## カスタマイズ

- **OAuth2 プロバイダーの追加**: Studio の「Authentication > Providers」から GitHub・Google・Discord などの OAuth2 プロバイダーを設定できます。OAuth2 コールバック URL は `https://supabase-selfhost.example.com/auth/v1/callback` に固定されており、各プロバイダーの管理コンソールでこの URL を許可 URI として登録してください。
- **Storage の有効化**: `compose.yml` に `supabase/storage-api` コンテナを追加し、`kong.yml` に `/storage/v1/` ルートを追加することで S3 互換ストレージが利用できます。
- **Realtime の有効化**: `supabase/realtime` コンテナを追加し、PostgreSQL の `wal_level=logical` を設定することで WebSocket サブスクリプションが利用できます。
- **カスタムドメイン**: `conoha.yml` の FQDN と `API_EXTERNAL_URL` / `GOTRUE_SITE_URL` / `SUPABASE_PUBLIC_URL` を変更してから `conoha app deploy` を再実行します。GoTrue がメール確認リンクに使う URL が変わるため、既存ユーザーのセッションへの影響を確認してください。
- **`JWT_SECRET` のローテーション**: `JWT_SECRET`・`ANON_KEY`・`SERVICE_ROLE_KEY` の 3 つを同時に更新し、クライアントアプリの `ANON_KEY` も更新してください（詳細は[ハマりどころ](#ハマりどころ)）。

## ハマりどころ

### 2 DNS A レコード忘れ（admin サブドメインを見落としがち）

`supabase-selfhost.example.com` の A レコードは設定しても `admin.supabase-selfhost.example.com` を忘れやすいです。症状はデプロイ自体は完了するが Studio が SSL エラーで開けないことです。Let's Encrypt は各 FQDN の A レコードがないと証明書を発行できません。2 つとも同じ VPS IP を指せば問題ありません。

```bash
# 伝播確認（両方とも同じ IP が返ること）
dig +short supabase-selfhost.example.com
dig +short admin.supabase-selfhost.example.com
```

### Kong の `/` は 404 — ヘルスプローブに使わないこと

`/` を直接 curl すると `404 No Route matched with those values` が返ります。これは Kong の動作として正常です。`kong.yml` に定義されているルートは `/auth/v1/`・`/rest/v1/`・`/pg/` のみであり、`/` にマッチするルートは存在しません。デプロイが「unhealthy」のままスタックした場合は、カスタムヘルスプローブを `/auth/v1/health` に設定しているか確認してください。`conoha.yml` の `web.health.path` が `/auth/v1/health` になっていれば正常です（サンプルで設定済み）。

```bash
# Kong が正常でも 404 が返る（正常な動作）
curl -i https://supabase-selfhost.example.com/
# → HTTP 404

# 正しいヘルスチェックパス（200 が返れば Kong + GoTrue 起動完了）
curl -i https://supabase-selfhost.example.com/auth/v1/health
# → HTTP 200  {"status":"ok"}
```

### `JWT_SECRET` ローテーションで `ANON_KEY` / `SERVICE_ROLE_KEY` が無効になる

`ANON_KEY` と `SERVICE_ROLE_KEY` はどちらも `JWT_SECRET` で HS256 署名された JWT です。`JWT_SECRET` を変更すると、Kong が既存の `ANON_KEY`・`SERVICE_ROLE_KEY` を検証できなくなり、すべての API 呼び出しが `401 Unauthorized` になります。ローテーション手順:

1. 新しい `JWT_SECRET` を生成する
2. 新しい `JWT_SECRET` を使って新しい `ANON_KEY` / `SERVICE_ROLE_KEY` を生成する
3. `conoha app env set myserver` で新しい `JWT_SECRET` / `ANON_KEY` / `SERVICE_ROLE_KEY` の 3 つを同時更新する
4. `conoha app deploy myserver` でデプロイする
5. クライアントアプリの `ANON_KEY` を新しい値に更新する

### `db:5432` を絶対に外部公開しない

`compose.yml` の `db` サービスは `expose: ["5432"]`（コンテナ間通信のみ）で宣言されています。`ports: ["5432:5432"]` に変更すると PostgreSQL がインターネットに直接露出し、Postgres ロール認証しか防御がなくなります。psql が必要な場合は必ず SSH 経由で接続してください:

```bash
ssh root@<vps-ip> -- 'docker exec -it $(docker ps -q -f name=supabase-selfhost-db) psql -U postgres'
```

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の supabase-selfhost](https://github.com/crowdy/conoha-cli-app-samples/tree/main/supabase-selfhost)
- 検証記: Qiita — *公開後にリンク追加*
- Supabase: [supabase.com](https://supabase.com/) / [supabase/supabase](https://github.com/supabase/supabase)
- 関連サンプル:
  - [Dify (AI ワークフロー)](/examples/dify-https) — マルチ FQDN `expose:` パターンのペア
  - [nginx リバースプロキシ](/examples/nginx-reverse-proxy) — ゲートウェイパターンの基礎
  - [Outline (OIDC チーム Wiki)](/examples/outline) — Phase 2b ペア
  - [音声エージェント (WebRTC + L4 GPU)](/examples/voice-agent-conoha-l4) — マルチアクセサリーパターンのペア
