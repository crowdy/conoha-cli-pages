# DNS / TLS

proxy モードで HTTPS 付きアプリを公開するには、DNS の A レコードを VPS の IP に向けて、conoha-proxy が Let's Encrypt から証明書を取得できる状態にする必要があります。本ガイドはその一連の流れを示します。

## 前提条件

- ドメインを 1 つ用意している (ConoHa DNS 管理外でも可、ただし手動 A レコード追加が必要)
- conoha-proxy をブート済み ([conoha-proxy セットアップ](/guide/proxy-setup))
- VPS のセキュリティグループで 80 / 443 が開いている (`--for proxy` プリセットで作成すれば自動で開いています)

## ConoHa DNS でドメインを管理する場合

### 1. ドメインを登録

```bash
conoha dns domain create --name example.com --email ops@example.com
```

ドメイン ID が出力されます。以後 `<domain-id>` で参照します。

### 2. A レコードを追加

VPS の IP は `conoha server show <name>` で確認できます。

```bash
IP=$(conoha server show myproxy --format json | jq -r '.addresses[0].ip')
conoha dns record create --domain-id <domain-id> \
  --name app.example.com --type A --data "$IP"
```

複数ホスト名を VPS に向ける場合は同様に複数の A レコードを追加します。

### 3. 伝播を確認

```bash
dig +short app.example.com
```

VPS の IP が返ってくれば OK。

DNS のキャッシュ反映には数十秒〜数分かかります。Let's Encrypt の HTTP-01 検証は伝播後に走るため、proxy 側でブート前に DNS が反映されているのが望ましい状態です。

## 外部 DNS を使う場合

ConoHa DNS を使わず、レジストラや Cloudflare で DNS を管理しているなら CLI 操作は不要です。レジストラの管理画面で A レコードを追加してください。

ConoHa DNS の `dns domain` / `dns record` コマンドは ConoHa DNS サービス専用なので、外部 DNS には使えません。

## Let's Encrypt (HTTP-01)

conoha-proxy は ACME クライアントを内蔵しており、`proxy boot --acme-email <email>` で渡したメールアドレスで Let's Encrypt に登録します。証明書発行は以下の流れで起こります。

1. `app init` でアプリのホスト名を proxy に登録
2. proxy が当該ホスト名で HTTP-01 チャレンジを開始
3. Let's Encrypt が `http://<host>/.well-known/acme-challenge/<token>` を取得しに来る
4. レスポンスが正しければ証明書が発行され、proxy が `/var/lib/conoha-proxy/` 配下に保存
5. 以降の HTTPS 接続でその証明書が提示される

### 失敗時の症状と原因

| 症状 | 主な原因 |
|---|---|
| ブラウザで TLS ハンドシェイク段階で接続失敗 | 該当ホスト用の証明書が未発行 (DNS が VPS を指していない、または HTTP-01 チャレンジが届いていない) |
| `proxy logs` に `acme:` で `unauthorized` | DNS の A レコードが間違っている / TTL が長くて旧 IP が残っている |
| `proxy logs` に `acme:` で `connection refused` | 80 番ポートが閉じている (UFW、セキュリティグループ、または別プロセスが占有) |

### 診断手順

```bash
# 1. DNS が VPS を指しているか
dig +short app.example.com

# 2. 80 番ポートが外から開いているか (curl は HTTP 503/404 でも OK、接続できれば充分)
curl -v http://app.example.com/.well-known/acme-challenge/test 2>&1 | head -10

# 3. proxy 側のログで ACME 処理を追う
conoha proxy logs my-server -f | grep -i acme

# 4. 登録済みサービスを確認
conoha proxy services my-server
```

### 証明書の自動更新

conoha-proxy は内部のスケジューラで証明書の有効期限を監視し、残り 30 日を切ると自動で更新します。手動操作は不要です。更新失敗時は `proxy logs` に warning が出力されるので、定期的に確認するか、別途監視ツールでログを拾ってください。

## 関連ページ

- [conoha-proxy セットアップ](/guide/proxy-setup) — proxy 自体のブートと運用
- [アプリデプロイ](/guide/app-deploy) — proxy モードでのアプリ登録
- [`dns` リファレンス](/reference/dns) — ConoHa DNS のコマンド
