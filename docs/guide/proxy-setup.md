# conoha-proxy のセットアップ

`conoha-proxy` は ConoHa VPS 上で動作するリバースプロキシです。HTTPS 自動発行（Let's Encrypt）、ブルー/グリーンデプロイ、複数ホスト名ルーティングを必要とする proxy モードでは、`conoha app deploy` の前にこのセットアップが必要です。

## 前提条件

- VPS に Docker および docker compose がインストール済みであること
- ポート 80 / 443 がインターネットから到達可能であること（UFW や ConoHa セキュリティグループで開放）
- Let's Encrypt ACME 登録用のメールアドレス

## proxy boot

VPS に conoha-proxy をインストールして起動するには `proxy boot` を実行します。

```bash
conoha proxy boot my-server --acme-email ops@example.com
```

実行すると CLI はサーバー上で以下を順に行います。

- Docker / docker compose のインストールを確認します
- `/var/lib/conoha-proxy` を作成し、UID 65532（nonroot）に所有権を委譲します
- UFW で 80/443 を開放し、`net.ipv4.ip_unprivileged_port_start=0` を `/etc/sysctl.d/99-conoha-proxy.conf` に書き込みます
- `docker run` でコンテナを起動します
- `--wait-timeout`（デフォルト `30s`）内にコンテナが healthy になることを確認します

タイムアウトした場合は直近 20 行のコンテナログが stderr に出力されます。フラグの全一覧は [proxy リファレンス](/reference/proxy) を参照してください。

::: tip
proxy のブートが終わったら、`conoha.yml` を用意して `conoha app init` → `conoha app deploy` でアプリをデプロイできます。詳細は [アプリデプロイ](/guide/app-deploy) を参照してください。
:::

## ライフサイクル運用

### proxy reboot

最新イメージをプルしてコンテナを再作成します。

```bash
conoha proxy reboot my-server --acme-email ops@example.com
```

::: warning
起動時のすべてのフラグ（`--acme-email` / `--image` / `--data-dir` など）を再指定する必要があります。コンテナ設定は引き継がれません。
:::

### proxy start / stop / restart

起動中のコンテナを停止・再起動します。ACME 設定はデータディレクトリに残るため再指定は不要です。

```bash
conoha proxy stop    my-server
conoha proxy start   my-server
conoha proxy restart my-server
```

### proxy remove

コンテナを削除します。データディレクトリは既定で残るため、登録済みサービスと証明書は保持されます。

```bash
conoha proxy remove my-server
```

証明書・登録済みサービス・状態ファイルを含めて完全に消去するには `--purge` を指定します。

```bash
conoha proxy remove my-server --purge
```

## 観測

### proxy logs

コンテナのログを表示します。`-f` でリアルタイムフォローできます。

```bash
conoha proxy logs my-server
conoha proxy logs my-server -f
```

### proxy details

バージョンと readiness を確認します。Admin API を Unix socket 経由で取得した結果を出力します。

```bash
conoha proxy details my-server
```

```
Version: v0.6.2
Ready: true
Services: 3 registered
```

### proxy services

登録されているプロキシサービスの一覧を表示します。

```bash
conoha proxy services my-server
```

```
NAME                 PHASE      ACTIVE                         HOSTS
myapp                green      http://127.0.0.1:9001          app.example.com
gitea                green      http://127.0.0.1:9012          gitea.example.com
gitea-dex            green      http://127.0.0.1:9015          dex.example.com
```

`conoha app init` 済みのアプリと expose ブロックが `<アプリ名>` / `<アプリ名>-<label>` 形式で並びます。

## トラブルシューティング

### ACME 発行に失敗する

DNS の A レコードが VPS を指していないか、ポート 80 がインターネットから到達できない状態です。`proxy logs -f` でログをフォローし、`acme:` を含む行を確認してください。

```bash
conoha proxy logs my-server -f
```

### healthy 待機がタイムアウトする

`--wait-timeout` を伸ばして再試行します。

```bash
conoha proxy boot my-server --acme-email ops@example.com --wait-timeout 120s
```

タイムアウト時は直近 20 行のログが出力されるので内容を確認してください。メモリ不足が疑われる場合はフレーバーを昇格させてから再試行します。

```bash
conoha server resize my-server --flavor g2l-4
```

### TLS ハンドシェイクで失敗する

DNS が VPS を指していないため、そのホスト名の証明書が発行されていない可能性があります。`dig` で A レコードを確認し、`proxy details` で readiness を確認してください。

```bash
dig app.example.com
conoha proxy details my-server
```

### `/var/lib/conoha-proxy` のパーミッション

UID 65532 がデータディレクトリに書き込めない場合は所有権を修正します。

```bash
sudo chown -R 65532:65532 /var/lib/conoha-proxy
```

## 関連ページ

- [アプリデプロイ](/guide/app-deploy)
- [proxy リファレンス](/reference/proxy)
