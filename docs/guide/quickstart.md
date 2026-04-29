# クイックスタート

VPS を作って HTTPS 付きで Web アプリを公開するまでの最短経路を示します。proxy モード (blue/green) を既定として案内し、より単純な no-proxy モードを後段に置きます。

::: tip 前提条件
- ConoHa CLI がインストール済み ([インストール手順](/guide/getting-started#インストール))
- ドメインを 1 つ用意できる (proxy モードのみ)
:::

## 1. 認証

```bash
conoha auth login
conoha auth status
```

## 2. サーバーを作成

`--for proxy` プリセットでフレーバー・イメージ・セキュリティグループを一括指定できます。

```bash
conoha server create --no-input --yes --wait \
  --name myproxy --key-name my-key --for proxy
```

`--for proxy` は内部で次を当てます。明示フラグは常に優先されます。

- `--flavor g2l-t-c3m2`
- `--image` 最新の `vmi-docker-*-ubuntu-*-amd64`
- `--security-group default,IPv4v6-SSH,IPv4v6-Web,IPv4v6-ICMP`

詳細は [サーバー管理](/guide/server) を参照してください。

## Path A: proxy モード (HTTPS あり)

[conoha-proxy](https://github.com/crowdy/conoha-proxy) が Let's Encrypt HTTPS と blue/green ロールバックを提供します。

### 2-1. proxy をブート

```bash
conoha proxy boot myproxy --acme-email ops@example.com
```

UFW で 80/443 を開放、`net.ipv4.ip_unprivileged_port_start=0` 適用、コンテナ起動と healthy 確認まで自動で行われます。詳細は [conoha-proxy セットアップ](/guide/proxy-setup) を参照してください。

### 2-2. DNS の A レコードを VPS の IP に向ける

```bash
conoha server show myproxy
```

表示された IP をドメインプロバイダで A レコードに設定します。Let's Encrypt の HTTP-01 検証は DNS が VPS を指していないと失敗します (証明書未発行のホストへの HTTPS は TLS ハンドシェイク段階で接続失敗)。

### 2-3. リポジトリに conoha.yml を置く

```yaml
name: hello
hosts:
  - hello.example.com
web:
  service: web
  port: 8080
```

`compose.yml` のサービス名・ポートと一致させます。詳細スキーマは [アプリデプロイ](/guide/app-deploy#conoha-yml-の作成) を参照してください。

### 2-4. デプロイ

```bash
conoha app init myproxy
conoha app deploy myproxy
```

完了後 `https://hello.example.com` で TLS 付きアクセス可能になります。drain 窓内なら旧スロットへ即時ロールバック:

```bash
conoha app rollback myproxy
```

## Path B: no-proxy モード (より単純)

DNS / TLS が不要、または既存 Docker ホストで動かしたい場合の最短経路。`docker compose up -d --build` をリモートで叩くのと等価です。

::: warning Docker は事前導入が必要
no-proxy `app init` は Docker / Compose の存在を検証するだけ。Docker 未導入の VPS では `conoha server create --user-data ./install-docker.sh` 等で事前にインストールしてください。
:::

```bash
# 初期化 (マーカーを書き込む)
conoha app init my-server --app-name hello --no-proxy

# デプロイ
conoha app deploy my-server --app-name hello --no-proxy
```

`compose.yml` で公開したポートに VPS の IP でアクセスできます。HTTPS は別途自前で構成してください。

## 次に読む

- [アプリデプロイ](/guide/app-deploy) — モードの違いと multi-host (`expose:`) ブロック
- [conoha-proxy セットアップ](/guide/proxy-setup) — proxy のライフサイクル運用とトラブルシューティング
- [サーバー管理](/guide/server) — スペック変更、メタデータ、SSH
- [`app` リファレンス](/reference/app) / [`proxy` リファレンス](/reference/proxy)
- [実践例](/examples/nextjs) — Next.js / Rails / WordPress などのデプロイ例
