# Outline (OIDC チーム Wiki) デプロイ

[Outline](https://www.getoutline.com/) は Notion ライクなオープンソースのチーム向け Wiki・ナレッジベースです。リアルタイム共同編集、Markdown エディタ、充実した REST API を備え、データを完全に自社管理できます。Slack/Notion からの移行先として実績のある選択肢であり、AI によるドキュメント自動生成や CI パイプラインとのナレッジ連携にも活用されています。

Outline をセルフホストする際の最大のハードルは **ログインに SSO が必須** という点です。メール/パスワードによるローカル認証はサポートされておらず、Slack・Google・Azure AD・OIDC などの外部プロバイダーの設定なしではログイン画面が一切表示されません。このサンプルでは軽量 OIDC プロバイダー **[Dex](https://dexidp.io/)** を同梱することで、外部サービスへの依存なしで即座にログインできる構成にしています。

Dex は Outline とは **別サブドメイン** (`dex.outline.example.com`) で公開します。OIDC の仕様上、プロバイダーの `iss`（issuer）URL はトークン発行時に bake-in されます。Outline のパス名前空間と同居させると `iss` URL が Outline のルートパスと衝突しうるため、独立したサブドメインに配置することで issuer URL を安定させています。conoha-proxy は `hosts:` のルート FQDN と `expose:` ブロックのサブドメインを独立した HTTPS エンドポイントとして管理し、それぞれ Let's Encrypt 証明書を自動取得します。

::: tip 本例は proxy モード対応 (`conoha.yml` 同梱)
HTTPS 終端と blue/green スロット切替は conoha-proxy が担当します。`expose:` ブロックを使ったマルチ FQDN パターン（root + Dex サブドメイン）については [2. conoha.yml](#_2-conoha-yml) で詳しく解説します。
:::

::: tip GPU は不要
Outline は静的アセット配信・PostgreSQL への読み書き・Redis を介したリアルタイム同期で動作します。推論処理は一切ありません。CPU-only フレーバー（`g2l-t-2`、2GB RAM 以上）で十分動作します。
:::

## 完成イメージ

- `https://outline.example.com` にアクセスすると OIDC ログインボタンが表示され、Dex 経由で認証できる
- リアルタイム共同編集が動作し、複数ユーザーが同じドキュメントを同時編集するとカーソル位置がリアルタイムで表示される
- スラッシュコマンド (`/`) によるリッチテキストエディタで Markdown・テーブル・コードブロック・画像の埋め込みが可能
- ドキュメント全体にわたる全文検索が動作する
- REST API (`POST /api/documents.create`、`POST /api/documents.search` など) が公開される

## アーキテクチャ

```
   ブラウザ ──HTTPS──► conoha-proxy (ACME Let's Enc)
   (2 FQDN)               │  (blue/green slots)
                           │
                           ├──→ outline:3000   (outline.example.com — root web)
                           │       │ server-to-server OIDC
                           │       ├── dex:5556/dex/token
                           │       └── dex:5556/dex/userinfo
                           │
                           └──→ dex:5556      (dex.outline.example.com — expose:)
                                   │  blue_green: false
                                   └── /var/dex/dex.db (sqlite3, persistent vol)

                         db    (accessory) ─┐
                         redis (accessory) ─┴─ compose 内部通信のみ
```

| レイヤー | サービス | 技術 | blue/green |
|---|---|---|---|
| Wiki | `outline` | outlinewiki/outline v0.82 | yes（root FQDN） |
| OIDC プロバイダー | `dex` | dexidp/dex v2.39.1 | `blue_green: false`（sqlite セッション） |
| データベース | `db` | PostgreSQL 16-alpine | accessory のみ |
| キャッシュ | `redis` | Redis 7-alpine | accessory のみ |

## 前提条件

- conoha-cli **≥ v0.6.1** がインストール・ログイン済み（[はじめに](/guide/getting-started)）
  - `expose:` ブロックの `blue_green: false` が proxy に正しくルーティングされるのは v0.6.1 以降です（[conoha-cli#163](https://github.com/crowdy/conoha-cli/issues/163)）
- **CPU フレーバー**（GPU 不要）— **RAM 2GB 以上**（`g2l-t-2` 以上推奨）（[サーバー管理](/guide/server)）
- **2 つの DNS A レコード**をサーバー IP に向けていること（[DNS / TLS](/guide/dns-tls)）:
  - `outline.example.com`（Outline UI — root FQDN）
  - `dex.outline.example.com`（Dex OIDC issuer — `expose:` ブロック）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）

## 1. compose.yml

完全版は [`outline/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/outline/compose.yml)。重要部分を抜粋します。

```yaml
services:
  outline:
    image: outlinewiki/outline:0.82.0
    expose:
      - "3000"   # No host port: conoha-proxy injects at deploy time
    environment:
      - DATABASE_URL=postgres://outline:${DB_PASSWORD:-outline}@db:5432/outline
      - REDIS_URL=redis://redis:6379
      - SECRET_KEY=${SECRET_KEY:-please-change-me-use-openssl-rand-hex-32}
      - UTILS_SECRET=${UTILS_SECRET:-please-change-me-use-openssl-rand-hex-32}
      - FILE_STORAGE=local
      - PGSSLMODE=${PGSSLMODE:-disable}
      - FORCE_HTTPS=false
      - OIDC_CLIENT_ID=outline
      # OIDC server-to-server calls go directly to dex (compose-internal)
      - OIDC_TOKEN_URI=http://dex:5556/dex/token
      - OIDC_USERINFO_URI=http://dex:5556/dex/userinfo
      - OIDC_DISPLAY_NAME=Dex Login
      # URL, OIDC_AUTH_URI, OIDC_CLIENT_SECRET come from env_file (.env.server)
      # Do NOT add them here — compose's ${VAR:-default} would shadow env_file.
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  dex:
    image: dexidp/dex:v2.39.1
    entrypoint: ["sh", "-c"]
    command:
      - |
        sed \
          -e "s|__DEX_ISSUER_HOST__|$$DEX_ISSUER_HOST|g" \
          -e "s|__OUTLINE_HOST__|$$OUTLINE_HOST|g" \
          -e "s|__OIDC_CLIENT_ID__|$$OIDC_CLIENT_ID|g" \
          -e "s|__OIDC_CLIENT_SECRET__|$$OIDC_CLIENT_SECRET|g" \
          /etc/dex/config.template.yaml > /tmp/dex.yml &&
        exec dex serve /tmp/dex.yml
    expose:
      - "5556"
    volumes:
      - ./dex-config.yml:/etc/dex/config.template.yaml:ro
      - dex_data:/var/dex   # sqlite3 session storage — persists across restarts

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=outline
      - POSTGRES_PASSWORD=${DB_PASSWORD:-outline}
      - POSTGRES_DB=outline
    volumes:
      - outline_db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U outline"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - outline_redis:/data
```

::: warning `expose` を `ports` にしないこと
proxy モードでは `expose:` を使ってコンテナ側ポートだけを宣言します。`ports:` で公開すると blue/green スロットが衝突します。詳しくは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。
:::

## 2. conoha.yml

```yaml
name: outline
# Replace with your own FQDN before running `conoha app init`.
# Only the root web host goes here. Subdomains (e.g. dex.example.com)
# are declared per-block under `expose:` below — listing them here too
# fails validation ("host duplicates an entry in hosts[]"). The proxy
# ACMEs both the root and each expose host independently as long as
# DNS A records exist for them.
hosts:
  - outline.example.com
web:
  service: outline
  port: 3000
# Outline has no `/up` (proxy default), but `/_health` returns 200
# once the server is reachable — use it for the probe. First start
# runs DB migrations and can take ~30s, so allow a wider unhealthy
# window than the default 15s.
health:
  path: /_health
  unhealthy_threshold: 24    # 24 × 5s = 120s
# Dex OIDC provider, exposed on its own subdomain so the browser
# discovery + redirect flow can reach it under HTTPS. blue_green: false
# because Dex isn't slot-aware (sqlite-backed sessions / approval state
# would diverge across slots otherwise).
expose:
  - label: dex
    host: dex.example.com
    service: dex
    port: 5556
    blue_green: false
    # Dex's default `/up` 404s; `/dex/healthz` returns 200 once OIDC is up.
    health:
      path: /dex/healthz
# `db` (PostgreSQL) and `redis` only serve compose-internal traffic
# and shouldn't be duplicated per blue/green slot.
accessories:
  - db
  - redis
```

**root FQDN と `/_health` プローブ、`unhealthy_threshold: 24`：** Outline には conoha-proxy のデフォルトプローブパス `/up` が存在しません。代わりにサーバーが起動・到達可能になった時点で 200 を返す `/_health` エンドポイントを使います。初回デプロイ時は Outline が PostgreSQL のスキーママイグレーションを実行するため、コンテナ起動から HTTP 応答までに最大 30 秒かかります。conoha-proxy のデフォルト `unhealthy_threshold: 3`（3 × 5 秒 = 15 秒）では DB マイグレーション完了を待ちきれず unhealthy 判定で初回デプロイが失敗します。`unhealthy_threshold: 24`（24 × 5 秒 = 120 秒）に設定することで、マイグレーションを安全に待機できます。

**`expose:` ブロックで Dex サブドメインを独立公開：** Outline のブラウザログインフローは OIDC Authorization Code Flow を使い、ブラウザが直接 Dex の `/.well-known/openid-configuration` を取得（discovery）してから `https://dex.outline.example.com/dex/auth` にリダイレクトします。このブラウザからのリクエストを HTTPS で完結させるため、Dex は独立した FQDN を持つ必要があります。OIDC の `iss` URL（`https://dex.outline.example.com/dex`）はトークンに bake-in されるため、一度デプロイした後にこのサブドメインを変えると既存トークンが無効になります（[ハマりどころ](#ハマりどころ) 参照）。Outline サービス自体のサーバー間通信（`OIDC_TOKEN_URI`、`OIDC_USERINFO_URI`）は compose 内部ネットワークの `dex:5556` を直接使うため外部 FQDN を経由しません。

**`blue_green: false` on Dex：** Dex はセッション状態と OAuth2 承認状態を sqlite3 ファイル（`/var/dex/dex.db`）に保存します。blue/green が `true` の場合、blue スロットと green スロットがそれぞれ別の sqlite ファイルを持つことになり、セッションが分断されてログインループが発生します。`blue_green: false` を指定することで Dex は 1 インスタンスに固定されます。ただし、これは **Dex のコード・設定変更が `conoha app deploy` のスロット切替に乗らない** ことを意味します。`dex-config.yml` を変更した場合はデプロイ完了後に手動で再起動してください:

```bash
ssh myserver -- 'docker compose -p outline restart dex'
```

## 3. 環境変数 (`.env`)

`conoha app env set` で以下の変数を設定します:

| 変数 | 説明 |
|---|---|
| `SECRET_KEY` | Cookie 暗号化キー（必須）— `openssl rand -hex 32` で生成。変更するとログイン中ユーザーが全員ログアウト |
| `UTILS_SECRET` | ユーティリティ用シークレット（必須）— `openssl rand -hex 32` で生成 |
| `URL` | Outline 公開 FQDN（必須）— `https://outline.example.com`。OIDC redirect URI の基準値になるため正確に設定 |
| `OIDC_AUTH_URI` | Dex の認可エンドポイント（必須）— `https://dex.outline.example.com/dex/auth`。ブラウザがリダイレクトする先 |
| `OIDC_CLIENT_ID` | OIDC クライアント ID（サンプルで設定済み: `outline`）— `dex-config.yml` の `staticClients[].id` と一致させる |
| `OIDC_CLIENT_SECRET` | Outline ↔ Dex 間のクライアントシークレット（必須）— `dex-config.yml` の `staticClients[].secret` と一致させる |
| `DEX_ISSUER_HOST` | Dex の公開 FQDN（必須）— `dex.outline.example.com`。`dex-config.yml` の `issuer` URL 組み立てに使用 |
| `OUTLINE_HOST` | Outline の公開 FQDN（必須）— `outline.example.com`。Dex の `redirectURIs` 組み立てに使用 |
| `DB_PASSWORD` | PostgreSQL パスワード（サンプルで設定済み: `outline`）— 本番では必ず変更 |

`dex-config.yml`（`dex-config.yml` の実体はサンプルリポジトリに同梱）のプレースホルダは compose の `entrypoint` で `sed` により実行時に置換されます。`staticPasswords` のパスワードハッシュは以下で生成できます:

```bash
# bcrypt ハッシュ生成（例: 'mypassword'）
htpasswd -bnBC 10 "" 'mypassword' | tr -d ':\n'
```

`dex-config.yml` の構造（参考）:

```yaml
issuer: https://__DEX_ISSUER_HOST__/dex

storage:
  type: sqlite3
  config:
    file: /var/dex/dex.db

web:
  http: 0.0.0.0:5556

oauth2:
  skipApprovalScreen: true

staticClients:
  - id: __OIDC_CLIENT_ID__
    redirectURIs:
      - "https://__OUTLINE_HOST__/auth/oidc.callback"
    name: Outline
    secret: __OIDC_CLIENT_SECRET__

enablePasswordDB: true

staticPasswords:
  - email: admin@example.com
    hash: "$2a$10$2b2cU8CPhOTaGrs1HRQuAueS7JTT5ZHsHSzYiFPm1leZck7Mc8T4W"
    username: admin
    userID: "08a8684b-db88-4b73-90a9-3cd1661f5466"
```

## 4. デプロイ

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/outline

# conoha.yml の 2 つの FQDN を書き換える:
#   hosts[0]           → outline.example.com
#   expose[0].host     → dex.outline.example.com
$EDITOR conoha.yml
```

::: warning 2 つの DNS A レコードが必要（頻出ミス）
`outline.example.com` と `dex.outline.example.com` の **両方** の A レコードを VPS IP に向けてください。`dex.outline.example.com` を忘れると Let's Encrypt の証明書発行が失敗し、OIDC リダイレクト時に SSL エラーになります。2 つとも同じ IP を指せば問題ありません。

```bash
# 伝播確認（2 つとも同じ IP が返ること）
dig +short outline.example.com
dig +short dex.outline.example.com
```
:::

```bash
conoha proxy boot --acme-email you@example.com myserver   # サーバーごとに 1 回

conoha app init myserver

conoha app env set myserver \
  SECRET_KEY=$(openssl rand -hex 32) \
  UTILS_SECRET=$(openssl rand -hex 32) \
  DB_PASSWORD=$(openssl rand -base64 32) \
  OIDC_CLIENT_ID=outline \
  OIDC_CLIENT_SECRET=$(openssl rand -base64 32) \
  URL=https://outline.example.com \
  OIDC_AUTH_URI=https://dex.outline.example.com/dex/auth \
  DEX_ISSUER_HOST=dex.outline.example.com \
  OUTLINE_HOST=outline.example.com

conoha app deploy myserver   # 初回は image pull + DB migration で 5–10 分
```

初回デプロイは Outline・Dex・PostgreSQL・Redis のイメージ pull と DB マイグレーションのため 5〜10 分かかります。`conoha app logs myserver` でログを確認しながら待機してください。

## 5. 動作確認

```bash
# Outline ヘルスチェック（200 が返れば起動完了）
curl -i https://outline.example.com/_health

# Dex OIDC ヘルスチェック（200 が返れば Dex 起動完了）
curl -i https://dex.outline.example.com/dex/healthz
```

ブラウザで `https://outline.example.com` を開くと **Continue with Dex Login** ボタンが表示されます（`OIDC_DISPLAY_NAME=Dex Login` 由来）。

1. **Continue with Dex Login** をクリック → `https://dex.outline.example.com/dex/auth` にリダイレクト
2. `admin@example.com` / `password` を入力（`dex-config.yml` の `staticPasswords` デフォルト値）
3. Outline に戻り、ユーザー名・チームスペース名を設定
4. ホーム画面に到達することを確認
5. 新規ドキュメントを作成して保存されることを確認

## 6. 初期セットアップ (Dex + 管理者ユーザー)

### Dex 静的ユーザーの設定

サンプルの `dex-config.yml` には `admin@example.com` / `password` のテスト用ユーザーが定義されています。**本番公開前に必ず変更してください。**

ユーザーを追加・変更するには `staticPasswords` エントリを編集します:

```bash
# bcrypt ハッシュ生成（例: 'your-secure-password'）
htpasswd -bnBC 10 "" 'your-secure-password' | tr -d ':\n'
```

生成したハッシュを `dex-config.yml` の `hash:` フィールドに設定し、`userID` は任意の UUID 文字列（重複しなければ形式は自由）を使用します。変更後は手動で Dex を再起動してください（`conoha app deploy` は `blue_green: false` の Dex をスロット切替しないため）:

```bash
ssh myserver -- 'docker compose -p outline restart dex'
```

### OIDC クライアントシークレットの確認

`OIDC_CLIENT_SECRET`（`conoha app env set` で設定した値）と `dex-config.yml` の `staticClients[].secret`（`__OIDC_CLIENT_SECRET__` プレースホルダ）は一致している必要があります。compose の `entrypoint` が `sed` で実行時に置換するため、`dex-config.yml` の `__OIDC_CLIENT_SECRET__` はそのまま残して問題ありません。

### 最初のユーザーを管理者に昇格

Outline は初回ログインしたユーザーが自動的に管理者になります。チームスペース作成後、2 人目以降は「Settings > Members」から手動で権限を付与してください。

## カスタマイズ

- **Dex を外部 IdP に差し替える**: `dex-config.yml` の `connectors:` セクションで GitHub・Google・Azure AD・LDAP などと連携できます。本番環境では `staticPasswords` を削除して外部 IdP コネクタのみを残すことを推奨します
- **ストレージバックエンドの変更**: `FILE_STORAGE=s3` + S3 関連環境変数（または `FILE_STORAGE=s3` + MinIO エンドポイント）でオブジェクトストレージに切り替え可能です
- **SMTP（招待メール）**: `SMTP_HOST`・`SMTP_USERNAME` などの環境変数を設定すると Magic Link ログインと招待メールが有効になります
- **マルチチームセットアップ**: `TEAM_SUBDOMAIN` 環境変数でサブドメインごとにチームを分割できます
- **Dex を使わず外部 SSO に直接接続**: Google Workspace・GitHub・Slack の OIDC/OAuth2 設定を Outline の `OIDC_*` 環境変数で直接指定することも可能です（Dex 不要）

## ハマりどころ

### 2 DNS A レコード忘れ（最頻出）

`dex.outline.example.com` の A レコードを忘れると、Outline のログインボタンをクリックした際に Dex の HTTPS 証明書発行が済んでおらず `ERR_CERT_AUTHORITY_INVALID` または `SSL_ERROR_RX_RECORD_TOO_LONG` が表示されます。`outline.example.com` と `dex.outline.example.com` は**両方とも同じ VPS IP** を指すだけで十分です。DNS 伝播後（通常数分以内）にデプロイしてください。

### Dex は accessories ではない（設定変更時に手動再起動が必要）

`dex` は `expose:` ブロックに `blue_green: false` で登録されており、`accessories:` ではありません。`conoha app deploy` は Dex コンテナを認識しますが、`blue_green: false` のためスロット切替は行いません。つまり、`dex-config.yml` を変更してデプロイしても **Dex は自動的に再起動されません**。設定変更後は以下を手動実行してください:

```bash
ssh myserver -- 'docker compose -p outline restart dex'
```

### `SECRET_KEY` を変更するとログイン中ユーザーが全員ログアウト

`SECRET_KEY` は Outline が Cookie を暗号化するために使用します。値を変更すると既存のセッション Cookie が無効になり、ログイン中のユーザーが全員ログアウトされます。一度設定した後は変更しないことを推奨します。変更が必要な場合はメンテナンス時間帯に実施してください。

### OIDC `iss` URL を変更すると既存トークンが無効になる

Dex を `https://dex.outline.example.com/dex` で起動すると、この URL が発行するすべてのトークンの `iss` クレームに bake-in されます。後からサブドメインを変更（例: `dex2.outline.example.com` に移行）すると、Outline が保持している既存の OIDC トークンの `iss` が不一致となりログインが壊れます。初回デプロイ前に FQDN を確定させてください。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の outline](https://github.com/crowdy/conoha-cli-app-samples/tree/main/outline)
- 検証記: Qiita — *公開後にリンク追加*
- Outline: [getoutline.com](https://www.getoutline.com/) / [outline/outline](https://github.com/outline/outline)
- Dex: [dexidp/dex](https://github.com/dexidp/dex)
- 関連サンプル:
  - [Ory Hydra + FastAPI (OAuth2)](/examples/hydra-python-api) — 代替 OIDC プロバイダーを使うパターン
  - [Gitea (OIDC)](/examples/gitea) — 他の OIDC 対応セルフホスト SaaS
  - [Dify (AI ワークフロー)](/examples/dify-https) — マルチ FQDN `expose:` パターンのペア
  - [音声エージェント (WebRTC + L4 GPU)](/examples/voice-agent-conoha-l4) — マルチアクセサリーパターンのペア
