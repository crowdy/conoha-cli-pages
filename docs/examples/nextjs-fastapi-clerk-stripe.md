# Next.js + FastAPI + Clerk + Stripe (SaaS) デプロイ

Next.js 16（App Router / shadcn/ui）+ FastAPI + PostgreSQL 17 を土台に、**Clerk によるユーザー認証**と**Stripe によるサブスクリプション課金**を組み込んだ本番構成の SaaS デモです。会員登録 → 料金プラン選択 → Stripe Checkout での決済 → プラン別にゲートされたダッシュボード → Stripe Customer Portal での自己解約・プラン変更、という SaaS の課金フローを一通り実装しています。[nextjs-fastapi-postgresql](/examples/nextjs-fastapi-postgresql) の単一 FQDN 構成から一歩進み、**2 つの FQDN**（ルート + `api.` サブドメイン）を `expose:` で公開することで、Clerk / Stripe からの Webhook がリクエストボディを一切改変されずに FastAPI へ届くようにしているのが最大の特徴です。

`conoha-cli >= v0.6.1` が必要です（`expose:` ブロックの blue/green スロット登録に関するバグ修正が含まれるため）。

::: tip 本例は proxy モード対応（`conoha.yml` 同梱）
`hosts:` にルート FQDN、`expose:` に `api.` サブドメインを 1 本登録するマルチ FQDN パターンです。詳しくは [1. conoha.yml](#_1-conoha-yml) で解説します。
:::

::: warning このページの環境変数はすべてマスクされたプレースホルダーです
Clerk / Stripe のキー・Webhook Signing Secret・Price ID・DB パスワードは、このドキュメント上では一切実値を掲載していません（`${VAR:?required}` 表記）。実際の値は `conoha app env set` で設定し、リポジトリや Slack など平文でどこにも残さないでください。
:::

## 完成イメージ

- `/sign-up` で会員登録（Clerk の日本語 UI）
- `/pricing` に Free / Pro（¥980/月）/ Enterprise（¥4,980/月）の 3 プランが表示される
- 「このプランを選択」をクリックすると Stripe Checkout（日本語）へ遷移し、テストカード `4242 4242 4242 4242` で決済できる
- `/dashboard` に現在のサブスクリプション状態が反映される
- 「サブスクリプション管理」から Stripe Customer Portal を開き、プラン変更・解約が自己完結する
- `https://api.<FQDN>/api/health` が `{"status":"ok"}` を返す

## アーキテクチャ

```
                        ┌───────────────────────────────┐
   ブラウザ ──HTTPS──▶  │ conoha-proxy (Caddy + ACME)   │
                        └──┬─────────────────────────┬──┘
                           │ <root>.example.com      │ api.example.com
                           ▼                          ▼
                        frontend (Next.js :3000)   backend (FastAPI :8000)
                           │                          │
                           │  BACKEND_INTERNAL_URL    │
                           └────▶ backend:8000 ◀──────┘
                                                      │
   Clerk / Stripe Webhook ─────HTTPS─────────────────┘
   POST https://api.example.com/api/webhooks/{clerk,stripe}
                                                      │
                                                      ▼
                                                    db (Postgres, accessory)
```

| レイヤー | サービス | 技術 | blue/green |
|---|---|---|---|
| フロントエンド | `frontend`（ルート FQDN） | Next.js 16（App Router）+ shadcn/ui + Clerk 認証 | yes（`web` サービス） |
| API | `backend`（`api.` FQDN） | FastAPI + Uvicorn — Stripe Checkout/Portal、Clerk/Stripe Webhook 処理 | yes（`expose:` の `api` ブロック） |
| データベース | `db` | PostgreSQL 17 — ユーザー・サブスクリプション状態 | accessory のみ（スロット間で共有） |

バックエンドのルーターは `checkout.py`（Stripe Checkout / Customer Portal セッション作成）、`subscription.py`（サブスクリプション状態の取得）、`webhooks.py`（Clerk・Stripe の Webhook 受信）の 3 本。Webhook エンドポイントは `POST /api/webhooks/clerk`（`user.created`）と `POST /api/webhooks/stripe`（`checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted`）です。API 呼び出しは Clerk が発行する JWT を `Authorization: Bearer` ヘッダーで送り、`CLERK_JWKS_URL` に対して署名検証します。

**Webhook が `api.` サブドメインに直接届く理由：** [nextjs-fastapi-postgresql](/examples/nextjs-fastapi-postgresql) のような単一 FQDN + Next.js `rewrites` 構成では、Next.js がリクエストを一度受け取ってから `backend` へ転送するためボディが再シリアライズされます。Clerk / Stripe の Webhook 署名検証（HMAC）はリクエストボディの**バイト列がそのまま**であることを前提にしているため、rewrite を経由すると署名不一致で 400 が返ります。このサンプルが 2 つ目の FQDN（`expose:`）を用意しているのは、まさにこの問題を回避するためです。

## 前提条件

- conoha-cli **>= v0.6.1** がインストール・ログイン済み（[はじめに](/guide/getting-started)）
  - v0.6.1 未満では `expose:` ブロックの blue/green スロットが proxy のターゲットとして正しく登録されない既知の不具合があります
- ConoHa VPS3 アカウント、SSH キーペア設定済み
- CPU フレーバー（GPU 不要）— **`g2l-t-2`（2GB）で十分動作**（[サーバー管理](/guide/server)）
- **2 つの DNS A レコード**をサーバー IP に向けていること（[DNS / TLS](/guide/dns-tls)）: ルート FQDN（`nextjs-fastapi-clerk-stripe.example.com`）と `api.` サブドメイン（`api.example.com`）— 両方が同一サーバーの IP を指す必要があります
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）

### 外部サービスの準備 (Clerk / Stripe)

このサンプルは Clerk・Stripe のアカウントとダッシュボード設定が**デプロイ前提**になっています。`conoha app deploy` の前に済ませておいてください。

**Clerk（認証）**

1. [Clerk Dashboard](https://dashboard.clerk.com) でアプリケーションを作成し、Publishable Key / Secret Key を取得
2. Webhooks を作成:
   - エンドポイント URL: `https://api.<あなたの FQDN>/api/webhooks/clerk`
   - イベント: `user.created`
   - 発行された Signing Secret を取得
3. JWKS URL を取得（`https://<your-clerk-frontend-api>/.well-known/jwks.json`）— バックエンドが Clerk 発行の JWT を検証するために使う
4. Allowed origins / Redirect URLs に本番の FQDN（ルート FQDN）を登録 — 登録しないとログイン後のリダイレクトが `accounts.dev` に向いてしまいます

**Stripe（サブスクリプション課金・テストモード）**

1. [Stripe Dashboard](https://dashboard.stripe.com/test) でテストモードを確認し、Product を 2 つ作成:
   - **Pro**: ¥980/月（recurring, JPY）
   - **Enterprise**: ¥4,980/月（recurring, JPY）
2. 各 Product に紐づく Price ID を取得
3. Webhooks を作成:
   - エンドポイント URL: `https://api.<あなたの FQDN>/api/webhooks/stripe`
   - 受信するイベント: `checkout.session.completed`、`customer.subscription.updated`、`customer.subscription.deleted`
   - 発行された Signing Secret を取得
4. **Customer Portal を有効化**（Stripe ダッシュボードの設定項目のみ、API では有効化できません）

## 1. conoha.yml

```yaml
name: nextjs-fastapi-clerk-stripe
# Replace with your own FQDN before running `conoha app init`.
# Only the root web host goes here. Subdomains (e.g. api.example.com)
# are declared per-block under `expose:` below — listing them here too
# fails validation ("host duplicates an entry in hosts[]"). The proxy
# ACMEs both the root and each expose host independently as long as
# DNS A records exist for them.
hosts:
  - nextjs-fastapi-clerk-stripe.example.com
web:
  service: frontend
  port: 3000
# FastAPI backend, exposed on its own subdomain so Clerk / Stripe can
# deliver webhooks directly to /api/webhooks/* without going through
# Next.js's rewrite (which mutates the request body and breaks HMAC
# signature verification). blue_green defaults to true — FastAPI is
# stateless, so slot rotation is safe; Postgres state lives in the
# `db` accessory and is shared across slots.
expose:
  - label: api
    host: api.example.com
    service: backend
    port: 8000
    # Proxy default `/up` 404s on FastAPI; the app exposes /api/health.
    health:
      path: /api/health
# `db` (PostgreSQL) only serves other compose services internally
# and shouldn't be duplicated per blue/green slot.
accessories:
  - db
```

`hosts:` にはルート FQDN のみを書きます。`api.` サブドメインは `hosts:` に重複登録すると `conoha app init` がバリデーションエラー（`host duplicates an entry in hosts[]`）になるため、必ず `expose:` ブロック側だけに書きます。`expose[].blue_green` は既定で `true` なので、`backend` は `frontend` と同様にデプロイごとに新スロットへ切り替わります（FastAPI はステートレスなので安全）。状態を持つ `db` だけが `accessories:` に残り、スロット間で共有されます。

## 2. compose.yml（抜粋）

完全版は [`nextjs-fastapi-clerk-stripe/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/nextjs-fastapi-clerk-stripe/compose.yml)。重要部分を抜粋します（`POSTGRES_PASSWORD` を含む DB 接続文字列は、このドキュメントでは `${POSTGRES_PASSWORD:?required}` としてマスクしています。実際の compose.yml には固定値が入っているため本番運用前に必ず変更してください）。

```yaml
services:
  frontend:
    build:
      context: ./frontend
      args:
        - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:?required}
    expose:
      - "3000"
    environment:
      - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:?required}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY:?required}
      - BACKEND_INTERNAL_URL=http://backend:8000
      - NEXT_PUBLIC_API_URL=http://localhost/api
      - NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
      - NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
      - NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
      - NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
    depends_on:
      backend:
        condition: service_healthy

  backend:
    build: ./backend
    # Exposed externally on api.example.com via conoha.yml `expose:` so
    # Clerk / Stripe can POST webhooks with intact body bytes (Next.js
    # rewrites would mutate the body and break HMAC verification).
    expose:
      - "8000"
    # NOTE: do NOT add `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` /
    # `CLERK_WEBHOOK_SECRET` / `CLERK_JWKS_URL` / `STRIPE_PRO_PRICE_ID`
    # / `STRIPE_ENTERPRISE_PRICE_ID` to `environment:` — compose's
    # `${VAR}` interpolates at parse time and overrides values supplied
    # via `env_file`. CLI's slot override injects `.env.server` as
    # `env_file`, so leaving these out lets `conoha app env set` values
    # flow through. `DATABASE_URL` stays because it's purely an
    # internal compose-network address with the same default the `db`
    # service uses.
    environment:
      - DATABASE_URL=postgresql+asyncpg://appuser:${POSTGRES_PASSWORD:?required}@db:5432/appdb
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"]
      interval: 5s
      timeout: 5s
      retries: 5

  db:
    image: postgres:17
    environment:
      - POSTGRES_DB=appdb
      - POSTGRES_USER=appuser
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:?required}
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser -d appdb"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  db_data:
```

`frontend` の `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` は `build.args` と `environment` の両方に書かれています。これは重複ではありません — Next.js の standalone ビルドは `NEXT_PUBLIC_*` をクライアントバンドルに**ビルド時に焼き込む**ため `build.args` が必要で、SSR（Server Components）がサーバープロセス内で同じ値を参照するために `environment` も必要という、2 つの別の要求です。`CLERK_SECRET_KEY` は SSR のセッション検証にのみ使うため `environment` だけで足ります。

`backend` に Stripe/Clerk のシークレットが一切ないことに注目してください。これは意図的な設計です（詳しくは compose 内のコメントと [4. 環境変数](#_4-環境変数) を参照）。

## 3. Webhook エンドポイントとリクエストの流れ

`backend` の `webhooks.py` は 2 本のエンドポイントを持ちます。

| エンドポイント | 送信元 | 検証イベント |
|---|---|---|
| `POST /api/webhooks/clerk` | Clerk | `user.created` |
| `POST /api/webhooks/stripe` | Stripe | `checkout.session.completed`、`customer.subscription.updated`、`customer.subscription.deleted` |

いずれも `https://api.<FQDN>/...` に直接届きます。ルート FQDN（`frontend`）を経由しないため、Next.js の `rewrites` によるボディの再シリアライズが発生せず、Clerk / Stripe が送信した生バイト列のまま FastAPI の HMAC 検証ロジックに渡ります。この直結を成立させているのが `conoha.yml` の `expose:` ブロックです。

ブラウザ／SSR から `backend` への通常の API 呼び出し（`/dashboard` の状態取得など）は Clerk が発行した JWT を `Authorization: Bearer <token>` で送信し、`backend` は `CLERK_JWKS_URL` から公開鍵を取得して署名を検証します。

## 4. 環境変数

`.env.example` に定義されている変数はすべて `conoha app env set` で設定します。このページでは実値の代わりに `${VAR:?required}` 表記でプレースホルダーを示します。

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:?required}
CLERK_SECRET_KEY=${CLERK_SECRET_KEY:?required}
CLERK_WEBHOOK_SECRET=${CLERK_WEBHOOK_SECRET:?required}
CLERK_JWKS_URL=${CLERK_JWKS_URL:?required}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:?required}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:?required}
STRIPE_PRO_PRICE_ID=${STRIPE_PRO_PRICE_ID:?required}
STRIPE_ENTERPRISE_PRICE_ID=${STRIPE_ENTERPRISE_PRICE_ID:?required}
```

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key（ビルド時にフロントエンドへ焼き込み） |
| `CLERK_SECRET_KEY` | Clerk Secret Key（SSR でのセッション検証） |
| `CLERK_WEBHOOK_SECRET` | Clerk Webhook（`user.created`）の HMAC 署名検証用シークレット |
| `CLERK_JWKS_URL` | Clerk が発行する JWT の検証に使う JWKS エンドポイント |
| `STRIPE_SECRET_KEY` | Stripe Checkout / Customer / Portal API 呼び出し用のシークレットキー |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook の HMAC 署名検証用シークレット |
| `STRIPE_PRO_PRICE_ID` | Pro プラン（¥980/月）の Stripe Price ID |
| `STRIPE_ENTERPRISE_PRICE_ID` | Enterprise プラン（¥4,980/月）の Stripe Price ID |

::: warning 実際のキー・Secret・Price ID は絶対にリポジトリや文書に書かないこと
Clerk の Publishable Key / Secret Key、Stripe の Secret Key / Webhook Secret / Price ID はすべて機密情報です。`.env.example` はプレースホルダー（`xxxxx`）のみを含み、実値は `conoha app env set` コマンドの引数として渡すか、シェル履歴に残らないよう `.env.server` 相当のファイルから読み込んでください。
:::

## 5. デプロイ

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/nextjs-fastapi-clerk-stripe

# conoha.yml の hosts:（ルート）と expose[].host（api.）を自分の FQDN に書き換える
$EDITOR conoha.yml
```

```bash
# 2 つとも同じサーバー IP を指していることを確認
dig +short nextjs-fastapi-clerk-stripe.example.com
dig +short api.example.com
```

```bash
conoha proxy boot --acme-email you@example.com myserver   # サーバーごとに 1 回

conoha app init myserver

conoha app env set myserver \
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:?required} \
  CLERK_SECRET_KEY=${CLERK_SECRET_KEY:?required} \
  CLERK_WEBHOOK_SECRET=${CLERK_WEBHOOK_SECRET:?required} \
  CLERK_JWKS_URL=${CLERK_JWKS_URL:?required} \
  STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:?required} \
  STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:?required} \
  STRIPE_PRO_PRICE_ID=${STRIPE_PRO_PRICE_ID:?required} \
  STRIPE_ENTERPRISE_PRICE_ID=${STRIPE_ENTERPRISE_PRICE_ID:?required}

conoha app deploy myserver
```

Webhook を登録する前に一度デプロイしておくと、`https://api.<FQDN>/api/health` に対する Let's Encrypt 証明書の発行が済み、Clerk / Stripe のダッシュボードから Webhook 到達確認（テスト送信）が通るようになります。

## 6. 動作確認

```bash
# api ヘルスチェック（{"status":"ok"} が返れば起動完了）
curl https://api.example.com/api/health

# frontend の応答確認
curl -o /dev/null -s -w "%{http_code}\n" https://nextjs-fastapi-clerk-stripe.example.com/
```

ブラウザで `https://<ルート FQDN>` を開き、「無料で始める」から `/sign-up` に進んで会員登録します（初回は証明書発行に数十秒かかる場合があります）。登録が完了すると Clerk の `user.created` Webhook が `api.<FQDN>` に届き、ユーザーが DB に作成されます。`/pricing` で Pro または Enterprise を選択すると Stripe Checkout に遷移し、テストカード `4242 4242 4242 4242` で決済できます。決済完了後は Stripe Webhook が `subscriptions` テーブルを更新し、`/dashboard` に反映されます。「サブスクリプション管理」から Customer Portal を開き、プラン変更や解約が行えることを確認してください。

## カスタマイズ

- **プラン追加・価格変更**: Stripe ダッシュボードで Product / Price を追加・変更し、対応する `STRIPE_*_PRICE_ID` を `conoha app env set` で更新します（Pro / Enterprise の 2 段構成をコード側で前提にしている箇所は `checkout.py` を要確認）
- **Webhook イベントの追加**: `backend/webhooks.py` にイベントハンドラを追加し、Stripe / Clerk ダッシュボード側の Webhook 設定に該当イベントを追加登録します
- **UI のブランディング**: `frontend/app/globals.css` の shadcn/ui テーマ変数、`frontend/app/pricing/` の料金表コンポーネントを編集

## ハマりどころ

### Webhook は必ず `api.` サブドメイン宛に登録する

**最も詰まりやすいポイント。** Clerk / Stripe の Webhook エンドポイントをルート FQDN（`https://<FQDN>/api/webhooks/...`）に登録すると、リクエストが Next.js の rewrite を経由してボディが再シリアライズされ、HMAC 署名検証が失敗して 400 が返ります。Webhook は必ず `https://api.<FQDN>/api/webhooks/clerk` および `https://api.<FQDN>/api/webhooks/stripe` に登録してください。

### Webhook Signing Secret は登録 URL ごとに異なる

`STRIPE_WEBHOOK_SECRET` / `CLERK_WEBHOOK_SECRET` は Webhook エンドポイントの URL ごとに発行される値です。ステージングと本番で別の URL に Webhook を登録した場合、Signing Secret も別々に取得して環境ごとに正しく設定する必要があります。URL とシークレットの組み合わせがずれると署名検証が常に失敗します。

### `NEXT_PUBLIC_*` はビルド時に焼き込まれる

`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` は `compose.yml` の `build.args` を通じてビルド時にクライアントバンドルへ焼き込まれます。`conoha app env set` でキーを変更しても、既存のイメージを再ビルドしない限りブラウザ側には反映されません。キーのローテーションを行う場合は `conoha app deploy` で再ビルドが走ることを確認してください。

### Clerk の allowed origins / redirect URLs 未設定でログイン後に迷子になる

Clerk Dashboard に本番の FQDN を登録していないと、ログイン・登録後のリダイレクトが Clerk の開発用ドメイン（`accounts.dev`）に向いてしまい、ユーザーがアプリに戻ってこられません。デプロイ前に Allowed origins と Redirect URLs の両方に FQDN を追加してください。

### テストキー vs ライブキー

このサンプルは Stripe テストモード + Clerk のテスト用キーを前提にしています。本番公開する際は両サービスとも本番用（ライブ）のキーに切り替え、`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` を含むため再ビルド（`conoha app deploy`）が必要になる点を忘れないでください。

### `backend` の `environment:` に Stripe/Clerk のシークレットを追加しない

`compose.yml` の `backend.environment` には意図的に Stripe/Clerk のシークレットが書かれていません。ここに `${VAR}` 形式で追加すると、compose がパース時に変数展開を行い、CLI が注入する `.env.server`（env_file）経由の値より**先に**評価されてしまい、`conoha app env set` で設定した値が反映されなくなります。シークレットは常に `conoha app env set` だけで管理してください。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の nextjs-fastapi-clerk-stripe](https://github.com/crowdy/conoha-cli-app-samples/tree/main/nextjs-fastapi-clerk-stripe)
- Clerk: [clerk.com](https://clerk.com/) — 認証・ユーザー管理
- Stripe: [stripe.com](https://stripe.com/) — サブスクリプション決済
- conoha-cli: [はじめに](/guide/getting-started)
- 関連サンプル:
  - [nextjs-fastapi-postgresql（ベーステンプレート）](/examples/nextjs-fastapi-postgresql) — 単一 FQDN・認証/課金なしの土台構成
  - [rails-mercari（重量級フルスタックのペア）](/examples/rails-mercari)
