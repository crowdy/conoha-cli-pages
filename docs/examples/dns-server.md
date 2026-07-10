# DNS サーバー (PowerDNS + CRUD API) デプロイ

`PowerDNS Authoritative` を使い、自分のドメイン配下にサブドメインを払い出せる権威 DNS サーバーを ConoHa VPS にセルフホストする手順です。管理用の CRUD API（FastAPI 製）は conoha-proxy 経由の proxy モードで HTTPS 公開され、`curl` からサブドメインの作成・削除ができます。一方 `pdns` 本体はホストの `:53/udp,tcp` を直接占有し、名前解決そのものは proxy を経由しません。

## 完成イメージ

- CRUD API が `https://<あなたの FQDN>` で稼働し、トークン認証（Authorization ヘッダー）でサブドメインを作成・削除できる
- 作成したサブドメインは PowerDNS 経由で権威応答され、`dig @<VPSのIP>` で確認できる
- CRUD API (`app`) は blue/green で無停止更新、`pdns` / `db` / `pdns-init` は状態を持つため単一インスタンスのまま
- 初回起動時に `pdns-init` がスキーマ適用と親ゾーン（SOA/NS）の種付けを自動実行する

## 前提条件

- ConoHa CLI がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーの `:53/udp`, `:53/tcp` が空いていること（`systemd-resolved` の DNS スタブリスナー等が専有していないか事前確認。占有時は `DNSStubListener=no` に変更して解放する）
- CRUD API を公開する FQDN の DNS A レコードを VPS の IP に向けている（[DNS / TLS](/guide/dns-tls)）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）

## デプロイ手順

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/dns-server

# conoha.yml の hosts: を自分の FQDN に書き換える
$EDITOR conoha.yml

# アプリ登録（初回のみ）
conoha app init <サーバー名>

# 必須環境変数（POSTGRES_PASSWORD は弱いデフォルトを必ず上書き。
# PARENT_ZONE/PRIMARY_NS/SOA_EMAIL は委任を受けたゾーンに合わせる）
conoha app env set <サーバー名> \
  POSTGRES_PASSWORD=$(openssl rand -base64 32) \
  PARENT_ZONE=users.example.com \
  PRIMARY_NS=ns1.example.com. \
  SOA_EMAIL=admin.example.com.

# デプロイ
conoha app deploy <サーバー名>
```

`conoha.yml`（`hosts:` のみ書き換えます）:

```yaml
name: dns-server
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - api.example.com
web:
  service: app
  port: 8080
# pdns-init seeds the schema and zone, then exits. pdns binds the host's
# :53 directly. db is a single PostgreSQL instance shared by both. None
# of these can be duplicated per blue/green slot — they hold state or
# the only authoritative DNS listener.
health:
  path: /health
  unhealthy_threshold: 24    # 24 × 5s = 120s, covers init + first boot
accessories:
  - pdns
  - db
  - pdns-init
```

`compose.yml` 抜粋（`POSTGRES_PASSWORD` は本ページでは `${POSTGRES_PASSWORD:?required}` としてマスク。実際の compose.yml は弱いデフォルトへフォールバックするため必ず上書きしてください）:

```yaml
services:
  app:
    build: .
    expose:
      - "8080"
    environment:
      - DATABASE_URL=postgres://pdns:${POSTGRES_PASSWORD:?required}@db:5432/pdns
      - PARENT_ZONE=${PARENT_ZONE:?required}
    depends_on:
      pdns-init: { condition: service_completed_successfully }
      db: { condition: service_healthy }

  # network_mode: host so PowerDNS owns :53 directly (can't resolve
  # 'db' via Docker DNS, so pdns.conf points at 127.0.0.1:5432).
  pdns:
    image: powerdns/pdns-auth-49:4.9.14
    network_mode: host
    command:
      - "--gpgsql-password=${POSTGRES_PASSWORD:?required}"

  db:
    image: postgres:17-alpine
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:?required}
    ports:
      # 127.0.0.1 only — pdns (host net) reaches db at localhost:5432.
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pdns"]
```

全文は [GitHub の compose.yml](https://github.com/crowdy/conoha-cli-app-samples/blob/main/dns-server/compose.yml) を参照してください。

::: tip 設定ポイント
- **`pdns` / `db` / `pdns-init` は blue/green の対象外** — `conoha.yml` のコメント: 「pdns-init seeds the schema and zone, then exits. pdns binds the host's :53 directly. db is a single PostgreSQL instance shared by both. None of these can be duplicated per blue/green slot — they hold state or the only authoritative DNS listener.」スロット切り替えの対象は CRUD API (`app`) のみです。
- **拡張された health threshold** — `unhealthy_threshold: 24`（24 × 5s = 120s）は、初回デプロイ時に `pdns-init` のスキーマ適用・親ゾーン種付けが終わり `db` が healthy になるまでの時間を見込んだ設定です。デフォルトの閾値のままだと初回起動が遅い環境で `app` が誤って unhealthy 判定されるおそれがあります。
- **認証トークンと DB パスワードはマスク必須** — `POSTGRES_PASSWORD` は upstream の compose.yml で弱いデフォルト値へフォールバックするため、`conoha app deploy` 前に `conoha app env set` で必ず上書きします。管理 API のトークンは `ADMIN_TOKEN` を空のままデプロイすると `pdns-init` のログに 1 度だけ出力され、明示的に設定する場合は `ADMIN_TOKEN=<PLACEHOLDER>` のように自分の値で上書きします（サンプルに設定済みの値はありません）。
:::

## 動作確認

```bash
# CRUD API のヘルスチェック
curl https://<あなたの FQDN>/health

# 親ゾーンの SOA が引けるか確認（pdns は :53 を直接 listen）
dig @<VPSのIP> users.example.com SOA +short

# 状態確認
conoha app status <サーバー名>
```

`dig` が SOA レコードを返せば `pdns` は正常に権威応答しています。CRUD API 経由でサブドメインを作成した場合は `dig @<VPSのIP> <サブドメイン>.users.example.com A +short` で反映を確認できます（PowerDNS gpgsql バックエンドのキャッシュ満了まで最大 10 秒程度）。

## 関連リンク

- [Recipe: dns-server](https://github.com/crowdy/conoha-cli-app-samples/tree/main/dns-server)
- [PowerDNS Authoritative Server](https://doc.powerdns.com/authoritative/)
- [Next.js デプロイ（proxy モードの基本形）](/examples/nextjs)
- [DNS / TLS](/guide/dns-tls)
- [conoha-proxy セットアップ](/guide/proxy-setup)
