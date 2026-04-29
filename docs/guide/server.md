# サーバー管理

ConoHa CLI でサーバーの作成から管理までを行います。フラグの完全な詳細は [`server` リファレンス](/reference/server) を参照してください。

## サーバー一覧

```bash
conoha server list
```

## サーバー作成

### フレーバー (スペック) を選ぶ

```bash
conoha flavor list
```

主なフレーバー:

| フレーバー | CPU | メモリ | ディスク |
|-----------|-----|--------|---------|
| g2l-t-c1m05d30 | 1 vCPU | 512MB | 30GB |
| g2l-t-c2m1d100 | 2 vCPU | 1GB | 100GB |
| g2l-t-c3m2d100 | 3 vCPU | 2GB | 100GB |
| g2l-t-c4m4d100 | 4 vCPU | 4GB | 100GB |

`--flavor` には UUID とフレーバー名 (例: `g2l-t-c2m1d100`) のどちらでも指定できます (v0.6.1+ 以降)。

### イメージを選ぶ

```bash
conoha image list
```

### SSH キーペアを作成

```bash
conoha keypair create mykey
```

秘密鍵は `~/.ssh/conoha_mykey` に自動保存されます。`-o` で別パスに変更可能。

```bash
conoha keypair create mykey -o ~/.ssh/my-custom-path
```

### 基本作成

```bash
conoha server create \
  --name myserver \
  --flavor g2l-t-c2m1d100 \
  --image ubuntu-24.04 \
  --key-name mykey
```

作成完了まで 1〜2 分かかります。`--wait` でアクティブになるまで待機できます。

## プリセット (`--for`)

`--for <preset>` でフレーバー / イメージ / セキュリティグループを一括指定できます。明示フラグは常に優先されます。

| プリセット | 用途 |
|---|---|
| `proxy` | conoha-proxy 用 (`g2l-t-c3m2` + 最新 docker イメージ + Web/SSH/ICMP SG) |

```bash
conoha server create --no-input --yes --wait \
  --name myproxy --key-name my-key --for proxy
```

詳細・上書き挙動は [`server create --for`](/reference/server#プリセット-for) を参照してください。

## 起動スクリプト

サーバー作成時に初期設定スクリプトを指定できます。`--user-data` / `--user-data-raw` / `--user-data-url` のいずれか 1 つを使用できます (最大 16 KiB)。

```bash
# ファイルから
conoha server create --name my-server --user-data ./init.sh

# インライン
conoha server create --name my-server --user-data-raw '#!/bin/bash
apt update && apt install -y nginx'

# URL 指定 (#include でラップ)
conoha server create --name my-server --user-data-url https://example.com/setup.sh
```

## ポート開放

開発中によくある「ポートだけサクッと開けたい」を 1 コマンドで:

```bash
# 80, 443 を全世界から開放
conoha server open-port my-server 80,443

# ポート範囲を社内 CIDR から限定
conoha server open-port my-server 8080-8090 --remote-ip 10.0.0.0/8

# UDP も可
conoha server open-port my-server 51820 --protocol udp
```

サーバーにカスタム SG が無ければ `<server-name>-sg` を自動作成してアタッチします。詳細は [`server open-port`](/reference/server#server-open-port) を参照。

## 起動 / 停止 / 再起動

```bash
conoha server stop    <サーバー名またはID>
conoha server start   <サーバー名またはID>
conoha server reboot  <サーバー名またはID>
conoha server reboot  <サーバー名またはID> --hard   # ハードリブート
```

## SSH ログイン

```bash
# 自動: ~/.ssh/conoha_<KeyName> が検出される
conoha server ssh my-server

# 明示
conoha server ssh my-server --identity ~/.ssh/conoha_mykey

# コマンド実行
conoha server ssh my-server -- uptime
```

初回接続時は `~/.ssh/known_hosts` にホスト鍵を保存する **TOFU (Trust On First Use)** で動作します (v0.6.1+)。検証をスキップするには `--insecure` (推奨されません)。

## IP アドレスの確認

```bash
conoha server ips <サーバー名>
```

## セキュリティグループ

```bash
# 追加 / 削除
conoha server add-security-group    my-server --name IPv4v6-Web
conoha server remove-security-group my-server --name IPv4v6-Web
```

v0.5.3 以降は Neutron port API を経由してセキュリティグループを反映します。

## サーバー削除

```bash
conoha server delete <サーバー名またはID>
```

ブートボリュームを孤立させないために `--delete-boot-volume` を併用すると、サーバー削除時に対応するブートボリュームも削除します。

```bash
conoha server delete my-server --delete-boot-volume -y
```

::: warning
削除したサーバー (および `--delete-boot-volume` を付けた場合のボリューム) は復元できません。
:::

## 次のステップ

- [アプリデプロイ](/guide/app-deploy) — Docker アプリをサーバーにデプロイ
- [conoha-proxy セットアップ](/guide/proxy-setup) — `--for proxy` で作ったサーバーで HTTPS リバースプロキシを起動
- [GPU セットアップ](/guide/gpu-setup) — GPU フレーバーで NVIDIA ドライバをインストール
