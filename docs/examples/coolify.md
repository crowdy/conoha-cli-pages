# Coolify (セルフホスティング PaaS) デプロイ

[Coolify](https://coolify.io/) は Vercel・Netlify・Heroku のようなワークフロー（Git push で自動デプロイ・ワンクリックでデータベースやサービスを起動・自動 HTTPS）をセルフホストできるオープンソースの PaaS です。1 台の ConoHa VPS 上に Coolify 本体をデプロイすれば、その後は Coolify の管理 UI から *別のアプリケーション* をいくつでもデプロイできるようになります。

このサンプルの見どころは「PaaS を conoha-proxy の *配下* に置く」という構図です。Coolify 自身も内部で HTTP UI・WebSocket 通知・キャッシュ層を持つ小さな分散システムであり、それを 1 枚のリバースプロキシの背後に収めることで、conoha-proxy の blue/green デプロイと Let's Encrypt 証明書管理のメリットをそのまま享受できます。一方で、Coolify のリアルタイム進捗表示が使う WebSocket ポートは公開 FQDN 経由では到達できないという、層状プロキシ構成に特有の制約も現れます。詳しくは [1. conoha.yml](#_1-conoha-yml) と [ハマりどころ](#ハマりどころ) で解説します。

::: tip 本例は proxy モード対応 (`conoha.yml` 同梱)
HTTPS 終端と blue/green スロット切替は conoha-proxy が担当します。`--no-proxy` は realtime WebSocket の制約を回避する*代替ワークアラウンド*として [ハマりどころ](#ハマりどころ) で触れますが、本サンプルの標準フローは常に proxy モードです。
:::

## 完成イメージ

- `https://<あなたの FQDN>` にアクセスし、初期管理者アカウントを作成できる（初回は Let's Encrypt 証明書発行のため表示まで数十秒かかる場合がある）
- Coolify の UI からアプリケーション・データベース・サービスをワンクリックでデプロイできる
- GitHub / GitLab と連携し、Git push を検知して自動デプロイ（CI/CD）が動作する
- Coolify がデプロイしたアプリに対して Let's Encrypt による自動 HTTPS 証明書取得が行われる
- `APP_KEY`（Laravel 暗号化キー）は初回起動時に自動生成される、または事前に設定した値が使われる

## アーキテクチャ

```
   ブラウザ ──HTTPS──► conoha-proxy (ACME Let's Enc)
   (1 FQDN)               │  (blue/green slots)
                           │
                           └──→ coolify:8000   (coolify.example.com — 管理 UI)
                                   │  内部専用（公開 FQDN 経由では届かない）
                                   ├── :6001  Soketi (socket.io)
                                   └── :6002  Laravel Reverb (WebSocket)

                         postgres (accessory) ─┐
                         redis    (accessory) ─┴─ compose 内部通信のみ

   Coolify がデプロイする「他のアプリ」は Coolify 自身の UI で
   ドメイン・HTTPS・自動デプロイを個別に管理する（conoha-proxy の外）
```

| レイヤー | サービス | 技術 | blue/green |
|---|---|---|---|
| PaaS 本体 | `coolify` | ghcr.io/coollabsio/coolify 4.0.0-beta.473 | yes（root FQDN） |
| データベース | `postgres` | PostgreSQL 16-alpine | accessory のみ |
| キャッシュ・キュー | `redis` | Redis 7-alpine | accessory のみ |

## 前提条件

- conoha-cli がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- ConoHa VPS3 アカウント、SSH キーペアが設定済み
- **CPU フレーバー**（GPU 不要）— **RAM 4GB 以上**（`g2l-t-4` 以上推奨。Coolify 本体 + PostgreSQL + Redis + Coolify がデプロイする他アプリのオーバーヘッドを考慮）（[サーバー管理](/guide/server)）
- **1 つの DNS A レコード**をサーバー IP に向けていること（`hosts:` を自分の FQDN に書き換える。[DNS / TLS](/guide/dns-tls)）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）

## 1. conoha.yml

```yaml
name: coolify
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - coolify.example.com
web:
  service: coolify
  # HTTP UI port. The container also exposes 6001 (Soketi / socket.io
  # for realtime UI updates) and 6002 (Laravel Reverb / WebSocket).
  # conoha-proxy fronts HTTP only, so realtime updates in the UI may
  # not work via the public FQDN — see README for details.
  port: 8000
# `postgres` and `redis` are accessories: schema and queue state must
# survive blue/green swaps.
accessories:
  - postgres
  - redis
```

**`postgres` / `redis` を accessory にする理由：** Coolify はプロジェクト定義・デプロイ履歴・ユーザー情報を PostgreSQL に、キューとリアルタイム通知の中間状態を Redis に保存します。これらは Coolify 本体のスキーマ・状態そのものであり、blue/green のスロット切替のたびに再作成されると Coolify の管理データが失われます。`accessories:` に入れることで両サービスは 1 インスタンスに固定され、`coolify` サービスだけがスロット切替の対象になります。

**6001/6002 が `web.port` に含まれない理由：** conoha-proxy は `web.port` で指定した 1 つの HTTP ポートだけを公開 FQDN にルーティングします。Coolify のリアルタイム UI 更新（デプロイ進捗バー、ライブログ）は内部で Soketi（socket.io、6001）と Laravel Reverb（WebSocket、6002）を使いますが、conoha.yml にはこれらのポートを追加公開する手段がありません。UI の基本操作（プロジェクト作成、デプロイ実行、ログ閲覧）自体には影響しませんが、進捗のリアルタイム更新は手動リフレッシュに代わります（[ハマりどころ](#ハマりどころ) 参照）。

## 2. compose.yml (抜粋)

完全版は [`coolify/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/coolify/compose.yml)。重要部分を抜粋します（`DB_PASSWORD` / `REDIS_PASSWORD` はこのドキュメントでは `${VAR:?required}` としてマスクしています。実際の compose.yml では未設定時に弱いデフォルトパスワードへフォールバックする形になっているため、本番運用前に必ず自分の値で上書きしてください — 詳しくは [3. 環境変数](#_3-環境変数) を参照）。

```yaml
services:
  coolify:
    # Coolify v4 is still in beta at time of writing; there is no :4
    # moving tag in ghcr, only concrete beta tags (and :latest / :v3
    # which point at v3). Pin to a published v4 beta so `docker pull`
    # resolves. Bump to a newer beta or switch to :latest once Coolify
    # 4.0.0 ships a stable tag.
    image: ghcr.io/coollabsio/coolify:4.0.0-beta.473
    # No host-side ports: conoha-proxy injects at deploy time. Ports
    # 6001 (Soketi) and 6002 (Reverb) stay on the compose network only.
    expose:
      - "8000"
      - "6001"
      - "6002"
    environment:
      - APP_ID=${APP_ID:-coolify}
      - APP_KEY=${APP_KEY:-}
      - APP_URL=${APP_URL:?APP_URL must be set to https://your-fqdn via `conoha app env set`}
      - DB_PASSWORD=${DB_PASSWORD:?required}
      - REDIS_PASSWORD=${REDIS_PASSWORD:?required}
    volumes:
      - /data/coolify:/data/coolify
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=coolify
      - POSTGRES_PASSWORD=${DB_PASSWORD:?required}
      - POSTGRES_DB=coolify
    volumes:
      - coolify_db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U coolify"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD:?required}
    volumes:
      - coolify_redis:/data
```

::: warning `/var/run/docker.sock` をマウントしている
`coolify` サービスはホストの Docker ソケットをそのままバインドマウントします。Coolify はこれを使ってホスト上に *他のアプリケーション* のコンテナを起動・管理します — PaaS としての本質的な仕組みですが、実質的にホストの Docker デーモンに対するフル制御権限を Coolify コンテナに与えていることになります。信頼できるイメージだけを Coolify 経由でデプロイし、Coolify UI 自体へのアクセスを厳重に管理してください。
:::

::: warning イメージタグの固定
`:latest` や `:v3` タグは Coolify v3 を指します。v4 はまだベータのため、ghcr には移動タグ（`:4` のような）が存在せず、`4.0.0-beta.473` のような具体的なベータタグのみが公開されています。Coolify 4.0.0 の安定版がリリースされたら、手動でタグを更新してください。
:::

## 3. 環境変数 (`.env`)

`conoha app env set` で以下の変数を設定します。compose ファイルはリポジトリ上で公開されており、`DB_PASSWORD` / `REDIS_PASSWORD` にはフォールバックのデフォルト値が定義されています（**このサンプルには掲載しません**）。デフォルト値のままでは誰でもパスワードを知っている状態になるため、必ず個別の値で上書きしてください。

| 変数 | 説明 |
|---|---|
| `APP_URL` | Coolify の公開 HTTPS FQDN（必須・デフォルトなし）— `https://coolify.example.com`。招待リンクや OAuth リダイレクトの基準 URL になるため、正確に設定しないと壊れたリンクが生成される。未設定の場合は起動時に失敗する |
| `APP_KEY` | Laravel 暗号化キー（Secret）— 未設定でも初回起動時に自動生成されるが、`base64:$(openssl rand -base64 32)` で事前に設定することも可能 |
| `DB_PASSWORD` | PostgreSQL パスワード（Secret・必須）— compose のフォールバックデフォルトを必ず上書きする |
| `REDIS_PASSWORD` | Redis `--requirepass`（Secret・必須）— compose のフォールバックデフォルトを必ず上書きする |
| `APP_ID` | インスタンス ID（サンプルで設定済み: `coolify`）— 非シークレットなのでデフォルトのままで問題ない |

```bash
conoha app env set myserver \
  APP_URL=https://coolify.example.com \
  APP_KEY=base64:$(openssl rand -base64 32) \
  DB_PASSWORD=$(openssl rand -base64 32) \
  REDIS_PASSWORD=$(openssl rand -base64 32)
```

## 4. デプロイ

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/coolify

# conoha.yml の hosts[0] を自分の FQDN に書き換える
$EDITOR conoha.yml
```

**1 つの DNS A レコード**を VPS IP に向けてください（`coolify.example.com` → サーバー IP）。

```bash
# 伝播確認
dig +short coolify.example.com
```

```bash
conoha proxy boot --acme-email you@example.com myserver   # サーバーごとに 1 回

conoha app init myserver

conoha app env set myserver \
  APP_URL=https://coolify.example.com \
  APP_KEY=base64:$(openssl rand -base64 32) \
  DB_PASSWORD=$(openssl rand -base64 32) \
  REDIS_PASSWORD=$(openssl rand -base64 32)

conoha app deploy myserver   # 初回は image pull + DB 初期化で数分かかる
```

`conoha app logs myserver` でログを確認しながら待機してください。

## 5. 動作確認

```bash
curl -I https://coolify.example.com
```

ブラウザで `https://coolify.example.com` を開くと Coolify のセットアップ画面が表示されます。初回は Let's Encrypt 証明書発行のため表示まで数十秒かかる場合があります。

## 初期セットアップ

1. ブラウザで初期管理者アカウント（メールアドレス・パスワード）を作成する
2. **Sources** から GitHub / GitLab を連携する（Personal Access Token またはアプリ連携）。連携後、リポジトリを選んで Git push トリガーの自動デプロイを設定できる
3. **Projects** から最初のアプリケーションを作成し、Coolify の UI 経由でデプロイする — Coolify がビルド・コンテナ起動・HTTPS 証明書発行までを自動化する
4. デプロイしたアプリには Coolify 自身が Let's Encrypt でドメインごとに個別の証明書を発行する（conoha-proxy とは独立した経路）

## カスタマイズ

- **イメージタグの更新**: Coolify 4.0.0 の安定版がリリースされたら `compose.yml` の `image:` を更新する（[compose.yml](#_2-compose-yml-抜粋) 参照）
- **リソース制限**: Coolify がデプロイするアプリごとに CPU / メモリの上限を UI から設定できる（大量のアプリを同居させる場合は VPS のフレーバーアップグレードも検討）
- **リアルタイム機能を使いたい場合**: `--no-proxy` モードで Coolify を立て、Coolify 自身に TLS 終端させることで 6001/6002 も含めて全ポートが直接到達可能になる（[ハマりどころ](#ハマりどころ) 参照）。あるいは公式インストールスクリプト（`curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`）を使い、Coolify 同梱の Caddy にルーティングを任せる方法もあるが、これは本サンプルの構成とは別物になる

## ハマりどころ

### リアルタイム UI 更新が公開 FQDN では動かない

conoha-proxy はホストごとに 1 つの HTTP ポートしかフロントしません。Coolify のデプロイ進捗バー・ライブログ更新は内部で socket.io（6001）と Laravel Reverb（6002）を使いますが、これらは公開 FQDN からは到達できません。**通常の操作（プロジェクト作成・デプロイ実行・ログ閲覧）は問題なく動作**しますが、進捗表示やログのリアルタイム更新は手動リフレッシュに代わります。リアルタイム機能が必須の場合は、公式インストールスクリプトでの導入、または `--no-proxy` モードで Coolify 自身に TLS を終端させる方法を検討してください。

### `APP_URL` は必須・デフォルトなし

`APP_URL` を未設定のままデプロイすると起動が失敗します。空文字のまま `http://localhost:8000` のような壊れたリンクが生成されるのを防ぐため、意図的にフェイルファストする設計です。公開 HTTPS FQDN と完全に一致させてください。

### 環境変数の設定は必須ステップ（デフォルトパスワードは公開済み）

compose ファイルは `DB_PASSWORD` / `REDIS_PASSWORD` にフォールバックのデフォルト値を持ちますが、これは公開リポジトリに記載されているため、そのままデプロイするとパスワードが誰でも分かる状態になります。`conoha app deploy` の前に必ず `conoha app env set` で `DB_PASSWORD` / `REDIS_PASSWORD` を個別の値に上書きし、`APP_KEY` / `APP_URL` も併せて設定してください。

### イメージタグの固定を忘れない

`:latest` や `:v3` は Coolify v3 を指すため、`:4` のような移動タグを期待して省略すると意図しないバージョンが起動します。具体的な v4 ベータタグ（例: `4.0.0-beta.473`）を明示的に指定し、Coolify 4.0.0 安定版がリリースされたら手動でタグを更新してください。

### `/var/run/docker.sock` のマウントはセキュリティ上重要

Coolify はホストの Docker デーモンをそのまま操作できる権限を持ちます。PaaS として他のアプリをオーケストレーションするために必須の仕組みですが、Coolify コンテナ自体が事実上ホストへの管理者権限を持つことになるため、Coolify UI へのアクセス制御（強固なパスワード、必要であれば IP 制限）を怠らないでください。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の coolify](https://github.com/crowdy/conoha-cli-app-samples/tree/main/coolify)
- Coolify: [coolify.io](https://coolify.io/) / [coollabsio/coolify](https://github.com/coollabsio/coolify)
- conoha-cli: [はじめに](/guide/getting-started)
- 関連サンプル:
  - [Dokploy (セルフホスティング PaaS)](/examples/dokploy) — もう 1 つの PaaS パターン。proxy モード vs インストーラー方式の対比
  - [Supabase Self-host](/examples/supabase-selfhost) — マルチアクセサリー構成のペア
  - [Dify (AI ワークフロー)](/examples/dify-https) — 複数サービス構成のセルフホストのペア
