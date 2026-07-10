# quickwit-otel デプロイ

Grafana・OpenTelemetry Collector・Quickwit（クラウドネイティブ検索エンジン）を組み合わせたログ・トレース収集基盤を ConoHa VPS にデプロイする手順です。proxy モードで **2 つの FQDN** を公開します。root FQDN では Grafana の UI にアクセスし、`otel.` サブドメインでは外部エージェントからの OTLP HTTP（traces / logs / metrics）を受け付けます。

OTLP 受信部分は素の OpenTelemetry Collector を直接公開するのではなく、軽量な Caddy サイドカー（`otel-edge`）を前段に置く構成です。理由は下の「設定ポイント」で解説します。

## 完成イメージ

- `https://quickwit-otel.example.com` で Grafana にログイン、Quickwit をデータソースにログ・トレースを検索
- `https://otel.example.com/v1/{traces,logs,metrics}` に外部から OTLP HTTP で送信すると Quickwit に取り込まれる
- `otel-collector` と `quickwit` は accessory として 1 インスタンス固定、`grafana` と `otel-edge` は proxy 配下でルーティングされる

## 前提条件

- ConoHa CLI がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[`--for proxy` プリセット推奨](/guide/server#プリセット-for)）
- **2 つの DNS A レコード**を同一サーバーの IP に向けている（[DNS / TLS](/guide/dns-tls)）
  - root: `quickwit-otel.example.com`（Grafana UI）
  - subdomain: `otel.example.com`（OTLP HTTP 受信エンドポイント）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）

## デプロイ手順

### 1. clone してディレクトリへ移動

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/quickwit-otel
```

### 2. conoha.yml を自分の FQDN に書き換える

```yaml
name: quickwit-otel
# Replace with your own FQDN before running `conoha app init`.
# Only the root web host goes here. Subdomains (e.g. otel.example.com)
# are declared per-block under `expose:` below — listing them here too
# fails validation ("host duplicates an entry in hosts[]"). The proxy
# ACMEs both the root and each expose host independently as long as
# DNS A records exist for them.
hosts:
  - quickwit-otel.example.com
web:
  service: grafana
  port: 3000
# Grafana's `/api/health` returns 200 once the server is up. First
# start unpacks plugins and seeds the sqlite DB, so allow a wider
# unhealthy window than the default 15s.
health:
  path: /api/health
  unhealthy_threshold: 24    # 24 × 5s = 120s
# OpenTelemetry Collector OTLP HTTP receiver, exposed on its own
# subdomain so external agents can push traces/logs/metrics over
# HTTPS. blue_green: false because the collector is stateless but
# pipeline reconfiguration / port rebind across slots would drop
# in-flight batches; running a single instance avoids that.
#
# OTLP gRPC (:4317) is intentionally NOT exposed here. conoha-proxy
# fronts HTTP/1.1, and OTLP gRPC requires HTTP/2 + ALPN end-to-end
# (and ideally H2C upstream). Adding gRPC support is tracked
# separately as a future "proxy gRPC support" RFC. Until then,
# external agents must use OTLP HTTP at https://otel.example.com/v1/*.
expose:
  - label: otel
    host: otel.example.com
    # Target is the `otel-edge` caddy sidecar, not otel-collector
    # itself. The collector's OTLP HTTP receiver only handles POST
    # /v1/{traces,logs,metrics} — GET / 404s, which would fail
    # conoha-proxy's deploy-time probe. Caddy answers GET / with 200
    # and reverse-proxies OTLP traffic to otel-collector:4318
    # untouched. See compose.yml + Caddyfile.
    service: otel-edge
    port: 4318
    blue_green: false
    health:
      path: /
# `quickwit` (log / trace search backend) and `otel-collector` only
# serve compose-internal traffic (Grafana / otel-edge talk to them
# over the docker network) and shouldn't be duplicated per blue/green
# slot.
accessories:
  - quickwit
  - otel-collector
```

書き換えるのは `hosts:`（root FQDN）と `expose[].host`（otel サブドメイン）の 2 箇所です。サブドメインを `hosts:` にも重複登録すると `conoha app init` がバリデーションエラー（`host duplicates an entry in hosts[]`）になります。

### 3. compose.yml / Caddyfile（抜粋）

完全版は [`quickwit-otel/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/quickwit-otel/compose.yml) と [`quickwit-otel/Caddyfile`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/quickwit-otel/Caddyfile) を参照してください。`otel-edge`（Caddy）は `otel-collector:4318` の前段に立つだけの薄いサイドカーです。

```yaml
services:
  otel-edge:
    image: caddy:2-alpine
    expose:
      - "4318"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
    depends_on:
      - otel-collector
```

```
:4318 {
	@probe path /
	handle @probe {
		respond "ok" 200
	}
	reverse_proxy otel-collector:4318
}
```

`grafana` サービスは `GF_SECURITY_ADMIN_PASSWORD` をあえて `environment:` に書いていません。compose の変数展開は `env_file`（CLI が注入する `.env.server`）より先に評価されるため、ここに書くと `conoha app env set` の値が上書きされてしまうからです（サンプルで設定済み）。

### 4. init・環境変数・デプロイ

```bash
conoha proxy boot --acme-email you@example.com myserver   # サーバーごとに 1 回

conoha app init myserver

# Grafana admin パスワードは必ず自分で設定する
conoha app env set myserver \
  GF_SECURITY_ADMIN_PASSWORD=${GF_SECURITY_ADMIN_PASSWORD:?required}

conoha app deploy myserver
```

::: tip 設定ポイント

**(a) `expose:` サブドメインと otel-edge サイドカーの理由**

`otel.example.com` は `conoha.yml` の `expose:` ブロックで `otel-edge` サービス（`:4318`）にルーティングされます。`otel-collector` を直接公開しない理由は conoha.yml のコメントに明記されています。

> Target is the `otel-edge` caddy sidecar, not otel-collector itself. The collector's OTLP HTTP receiver only handles POST /v1/{traces,logs,metrics} — GET / 404s, which would fail conoha-proxy's deploy-time probe. Caddy answers GET / with 200 and reverse-proxies OTLP traffic to otel-collector:4318 untouched. See compose.yml + Caddyfile.

**(b) OTLP gRPC (`:4317`) を公開していない理由**

> OTLP gRPC (:4317) is intentionally NOT exposed here. conoha-proxy fronts HTTP/1.1, and OTLP gRPC requires HTTP/2 + ALPN end-to-end (and ideally H2C upstream). Adding gRPC support is tracked separately as a future "proxy gRPC support" RFC. Until then, external agents must use OTLP HTTP at https://otel.example.com/v1/*.

外部エージェントは常に OTLP **HTTP**（`https://otel.example.com/v1/*`）を使ってください。VPS 内部の他コンテナからは compose ネットワーク経由で `otel-collector:4317`（gRPC）にも送信できます。

**(c) DNS A レコードは 2 本必要**

root（`quickwit-otel.example.com`）と subdomain（`otel.example.com`）の両方が同じサーバー IP を指している必要があります。片方だけだと該当 FQDN の ACME 証明書発行に失敗します。

```bash
dig +short quickwit-otel.example.com
dig +short otel.example.com
```

:::

## 動作確認

ブラウザで `https://quickwit-otel.example.com` を開き、`admin` と手順 4 で設定したパスワードで Grafana にログインします。[quickwit-quickwit-datasource](https://grafana.com/grafana/plugins/quickwit-quickwit-datasource/) プラグインを追加し、URL `http://quickwit:7280` でデータソースを登録してください。

OTLP HTTP で外部からトレースを送信して取り込みを確認します。

```bash
curl -X POST https://otel.example.com/v1/traces \
  -H 'Content-Type: application/json' \
  -d '{"resourceSpans":[]}'
```

送信後、Grafana の Explore から Quickwit データソースを選び、該当インデックスにトレースが取り込まれていることを確認してください。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の quickwit-otel](https://github.com/crowdy/conoha-cli-app-samples/tree/main/quickwit-otel)
- Quickwit: [quickwit.io](https://quickwit.io/) — クラウドネイティブ検索エンジン
- OpenTelemetry: [opentelemetry.io](https://opentelemetry.io/) — OTLP / Collector
- conoha-cli: [はじめに](/guide/getting-started)
