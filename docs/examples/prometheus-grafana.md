# Prometheus + Grafana デプロイ

メトリクス収集・可視化の業界標準スタックを ConoHa VPS にデプロイする手順です。本例は proxy モードで動作し、公開されるのは Grafana のみです。Prometheus と node-exporter は accessory として内部でのみ動作し、Grafana が内部ネットワーク経由でメトリクスを取得します。

## 完成イメージ

- Grafana が `https://<あなたの FQDN>` で TLS 付きアクセス可能
- Prometheus・node-exporter は accessory として内部稼働し、外部には公開されない
- Grafana に Prometheus データソースが疎通済み

## 前提条件

- ConoHa CLI がインストール・ログイン済み ([はじめに](/guide/getting-started))
- サーバーが作成済み
- 公開したい FQDN の DNS A レコードがサーバー IP を指している ([DNS / TLS](/guide/dns-tls))
- conoha-proxy がブート済み ([conoha-proxy セットアップ](/guide/proxy-setup))

## デプロイ手順

### 1. リポジトリを取得

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples.git
cd conoha-cli-app-samples/prometheus-grafana
```

### 2. conoha.yml の hosts を編集

```yaml
name: prometheus-grafana
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - prometheus-grafana.example.com
web:
  service: grafana
  port: 3000
# `prometheus` and `node-exporter` are accessories — the proxy only
# routes one public host, and Grafana already queries Prometheus
# internally via the `prometheus:9090` data source, so we don't need
# Prometheus's UI reachable from the browser. If you do need it, use
# `conoha app logs` or an SSH port-forward to /var/run/docker.sock.
accessories:
  - prometheus
  - node-exporter
```

`hosts:` を自分の FQDN に書き換えてください（サンプルで設定済みの値は仮のドメインです）。

### 3. 初期化・環境変数設定・デプロイ

```bash
# 初期化（初回のみ）
conoha app init <サーバー名>

# Grafana 管理者パスワードを設定（必須 — 未設定だと起動しません）
conoha app env set <サーバー名> GF_ADMIN_PASSWORD=$(openssl rand -base64 32)

# デプロイ
conoha app deploy <サーバー名>
```

compose.yml では Grafana の管理者パスワードを次のように定義しています（抜粋、[全文はこちら](https://github.com/crowdy/conoha-cli-app-samples/blob/main/prometheus-grafana/compose.yml)）:

```yaml
services:
  grafana:
    image: grafana/grafana:11.6.0
    expose:
      - "3000"
    environment:
      - GF_SECURITY_ADMIN_USER=${GF_ADMIN_USER:?required}
      - GF_SECURITY_ADMIN_PASSWORD=${GF_ADMIN_PASSWORD:?required}
```

::: tip 設定ポイント
- **Grafana 管理者パスワードを必ず設定する**: `GF_SECURITY_ADMIN_PASSWORD` は `${GF_ADMIN_PASSWORD:?required}` という形にしており、環境変数が未設定だとコンテナ起動時にエラーになります。上流サンプルのデフォルト値のままデプロイすると誰でもログインできてしまうため、必ず `conoha app env set` で値を渡してください。
- **Prometheus・node-exporter は設計上、内部限定公開**: conoha.yml の accessories コメントには次のようにあります。

  > `prometheus` and `node-exporter` are accessories — the proxy only routes one public host, and Grafana already queries Prometheus internally via the `prometheus:9090` data source, so we don't need Prometheus's UI reachable from the browser. If you do need it, use `conoha app logs` or an SSH port-forward to /var/run/docker.sock.

  Prometheus の UI を直接確認したい場合は `conoha app logs` を使うか、SSH 経由でポートフォワードしてください。
:::

## 動作確認

```bash
conoha app status <サーバー名>
conoha app logs <サーバー名>
```

ブラウザで `https://<あなたの FQDN>` にアクセスし、`admin` と手順 3 で設定したパスワードで Grafana にログインできれば完了です。Grafana には Prometheus データソース（`http://prometheus:9090`、コンテナ間の内部 DNS）が疎通済みなので、そのままダッシュボードを作成できます。

## 関連リンク

- Recipe: <https://github.com/crowdy/conoha-cli-app-samples/tree/main/prometheus-grafana>
- [Grafana ドキュメント](https://grafana.com/docs/grafana/latest/)
- [Prometheus ドキュメント](https://prometheus.io/docs/introduction/overview/)
