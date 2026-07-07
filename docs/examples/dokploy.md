# Dokploy (セルフホスティング PaaS) デプロイ

[Dokploy](https://dokploy.com/) は Heroku / Vercel / Netlify のオープンソース代替となるセルフホスティング PaaS です。ConoHa VPS 1 台に Dokploy をインストールすれば、その後は Dokploy の管理 UI から *別のアプリケーション* をいくつでもビルド・デプロイできる、自分専用のデプロイ基盤が手に入ります。

このサンプルは他の多くのサンプルと構図が違います。Dokploy 自身が Docker Swarm を必須とする PaaS コントローラであり、公式インストーラが Swarm 初期化・overlay ネットワーク作成・Swarm secret 生成・複数の Swarm サービス起動を一括で行うため、`compose.yml` を書いて `conoha app deploy` に渡すモデルとは噛み合いません。代わりに `conoha server create` でサーバーを作り、`conoha server ssh` で入って公式インストーラのラッパースクリプトを実行する、という conoha-cli のもう半分の使い方（アプリデプロイではなくサーバー運用）を学ぶサンプルです。

::: warning 本例は `conoha app deploy` を使いません
Dokploy が同梱する Traefik はホストモードで `:80` / `:443` を直接バインドします。これは conoha-proxy が担っている役割そのものであり、両者を同時に立てるとポートが競合します。また Dokploy のインストールには Docker Swarm（`docker service` / Swarm secret）が必須で、単一ホスト向けの `docker compose` では再現できません。そのため本例には `conoha.yml` も `compose.yml` もなく、`conoha proxy boot` の手順もありません。
:::

## 完成イメージ

- `http://<SERVER_IP>:3000` を開くと Dokploy のダッシュボードが表示される
- 初回アクセス時に管理者アカウント（Email + Password）を作成できる
- 1 台の 4GB VPS 上で Traefik + PostgreSQL + Redis + Docker Swarm を備えた自分専用のセルフホスト PaaS が動いている
- このリポジトリの `hello-world` サンプルを Dokploy UI 経由でデプロイし、`*.traefik.me` / `<server-ip>.nip.io` の自動生成ドメインでアクセスできる
- 独自ドメインを使う場合は Let's Encrypt による自動 HTTPS も Traefik がそのまま担当する
- **Templates** マーケットプレースから Pocketbase / Plausible / Cal.com などの OSS もワンクリックでデプロイできる

## アーキテクチャ

```
   ブラウザ ──:80/:443──► dokploy-traefik (host mode, docker run)
                              │ overlay network "dokploy-network"
   ブラウザ ──:3000────────────┼──► dokploy (svc, Web UI, Swarm ingress mesh)
                              │      Traefik を経由せず直接公開される
                    ┌─────────┴─────────┐
              dokploy-postgres (svc)  dokploy-redis (svc)
                 :5432 メタデータ         :6379 キュー

           すべて 1 台の Docker Swarm マネージャノード上で動作
```

| レイヤー | サービス | 技術 | 起動方式 |
|---|---|---|---|
| リバースプロキシ | `dokploy-traefik` | Traefik v3.6.x（Dokploy 同梱） | `docker run`（host mode, :80/:443） |
| PaaS コントローラ | `dokploy` | Dokploy v0.28.8（固定） | `docker service`（Web UI :3000） |
| データベース | `dokploy-postgres` | PostgreSQL 16（Dokploy 同梱） | `docker service`（:5432） |
| キャッシュ・キュー | `dokploy-redis` | Redis 7（Dokploy 同梱） | `docker service`（:6379） |
| ランタイム | Docker + Docker Swarm | 28.x（`install.sh` が導入） | Swarm マネージャ 1 ノード |

`dokploy` の Web UI (`:3000`) は Traefik を経由せず、Swarm の ingress mesh によって直接公開される点に注意してください。Traefik が前段に立つのは Dokploy が *デプロイする側のアプリ* だけです。

## 前提条件

- conoha-cli がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- ConoHa VPS3 アカウント、SSH キーペアが設定済み（[サーバー管理](/guide/server)）
- **`g2l-t-4`（4GB）以上を推奨** — Dokploy 本体 + 同梱 Postgres/Redis/Traefik + 最初のアプリのビルドで概ね 2〜3GB を使うため、2GB では OOM のリスクがある
- **ConoHa Ubuntu 24.04 イメージ** — `iproute2` の `ip` コマンドが `ADVERTISE_ADDR` の自動検出に必要
- **`conoha proxy boot` は不要** — Dokploy 同梱の Traefik が :80/:443 を直接処理する
- DNS は最初は不要 — `*.traefik.me` または `<server-ip>.nip.io` で開始できる。独自ドメインを使う場合のみ A レコードが必要（[DNS / TLS](/guide/dns-tls)）

## 1. サーバー作成

```bash
conoha server create \
  --name dokploy-host \
  --flavor g2l-t-4 \
  --image ubuntu-24.04 \
  --key-name mykey \
  --wait
```

`--for proxy` プリセットは使いません。conoha-proxy を前提としたセキュリティグループ（Web/SSH/ICMP）は本例にも問題なく使えますが、Dokploy 自身がポート開放を要求するわけではないため素の作成で十分です。作成後の IP は `conoha server ips dokploy-host` で確認できます。

## 2. インストール

`conoha server ssh` でサーバーに接続し、ConoHa 向けラッパースクリプトを root で実行します。

```bash
conoha server ssh dokploy-host

# 接続後（サーバー内で実行）
curl -fsSL https://raw.githubusercontent.com/crowdy/conoha-cli-app-samples/main/dokploy/install-on-conoha.sh \
  | sudo -E bash
```

`install-on-conoha.sh` は公式 `https://dokploy.com/install.sh` を薄くラップしたもので、以下の 3 点を追加しています。

1. **バージョン固定** — `DEFAULT_DOKPLOY_VERSION="v0.28.8"`。`DOKPLOY_VERSION` 環境変数で上書き可能。
2. **ConoHa 向け Swarm CIDR** — `DEFAULT_SWARM_INIT_ARGS="--default-addr-pool 10.20.0.0/16 --default-addr-pool-mask-length 24"`。`DOCKER_SWARM_INIT_ARGS` で上書き可能。
3. **`ADVERTISE_ADDR` の自動検出** — ConoHa VPS3 は public IPv4 のみを持ち private IP がないため、公式インストーラ内部の `get_private_ip()` が失敗して Swarm init 前に止まってしまいます。ラッパーの `ensure_advertise_addr()` は次の順に判定します。
   1. `ADVERTISE_ADDR` が環境変数で既に設定されていれば、それをそのまま使う（RFC1918 チェックも public IP 取得もスキップ）
   2. 設定がなく、ホストに RFC1918 の私設 IP（`10.x` / `172.16-31.x` / `192.168.x`）があれば、公式インストーラ自身の検出に任せる
   3. どちらでもなければ、`ifconfig.io` → `icanhazip.com` → `ipecho.net/plain` の順に public IPv4 を取得し、`ADVERTISE_ADDR` として export して公式インストーラに渡す

これらを設定した後、`require_root()` でroot権限を確認し、`export DOKPLOY_VERSION DOCKER_SWARM_INIT_ARGS` してから公式 `install.sh` を呼び出します。公式インストーラ自体が Docker のインストール、`docker swarm init`、overlay ネットワーク `dokploy-network` の作成、Swarm secret `dokploy_postgres_password` の生成、`dokploy` / `dokploy-postgres` / `dokploy-redis` サービスと `dokploy-traefik` コンテナの起動までを一括で行います。

::: tip `sudo -E` を忘れずに
`-E` を付けないと sudo が `DOKPLOY_VERSION` / `DOCKER_SWARM_INIT_ARGS` / `ADVERTISE_ADDR` を剥がしてしまい、export した値が静かに無視されます。詳しくは [ハマりどころ](#ハマりどころ) を参照してください。
:::

### 代替: リポジトリをクローンして実行

`curl | sudo -E bash` のパイプ実行に抵抗がある場合は、リポジトリをクローンしてスクリプトの内容を確認した上で実行できます。

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples.git
cd conoha-cli-app-samples/dokploy
sudo -E bash install-on-conoha.sh
```

## 3. 初期セットアップ

インストールが完了したら、ブラウザで `http://<SERVER_IP>:3000` を開きます。

1. 初回アクセス時に表示される画面で初期管理者アカウント（Email + Password）を作成する
2. ダッシュボードが表示されれば成功

この Email + Password が本サンプルにおける唯一の運用シークレットです（ファイルには残らず、ブラウザで入力するのみ）。Swarm secret `dokploy_postgres_password` は公式インストーラが自動生成し、外部には表示されません。

ここまでの動作確認チェックリスト:

- [ ] `conoha server create --flavor g2l-t-4 ...` が成功する
- [ ] `install-on-conoha.sh` がエラーなく完走する
- [ ] `http://<SERVER_IP>:3000` で Dokploy のダッシュボードが見える
- [ ] 初期管理者アカウントを作成できる

## 4. 動作確認 / アプリをデプロイ

Dokploy が立ち上がっただけでは「セルフホスト PaaS を建てた」で終わってしまうので、このリポジトリの `hello-world` サンプルを Dokploy 経由でデプロイして動作を確認します。

1. ダッシュボードで **Create Project** → 名前を `demo` として作成する
2. `demo` プロジェクトを開き、**Create Application** をクリック（アプリケーション名は任意、例: `hello-world`）
3. アプリの設定画面で **Provider: Public Git** を選び、以下を入力する

| 項目 | 値 |
|---|---|
| Repository URL | `https://github.com/crowdy/conoha-cli-app-samples` |
| Branch | `main` |
| Build Path | `hello-world` |
| Build Type | `Dockerfile` |

4. **Domains** タブで **Add Domain** をクリック。Dokploy が自動生成する `*.traefik.me` のホスト名を採用すれば外部 DNS なしでアクセスできる。`*.traefik.me` が解決しない環境では `<server-ip>.nip.io`（ワイルドカード DNS）を指定する
5. **Deploy** ボタンをクリックし、ビルドログを確認する（`hello-world` の Dockerfile を nginx + 静的 HTML としてビルド）
6. 完了後、ドメインをブラウザで開き「Hello World」ページが表示されれば成功

::: tip モノレポのサブディレクトリ指定が動かない場合
現バージョンの Dokploy で Build Path によるサブディレクトリ指定がうまく効かないケースがあります。その場合はリポジトリをフォークして `hello-world/` だけを残したものを Repository URL に指定してください。他のサンプル（`vite-react` や `hono-drizzle-postgresql` など）も同じ手順で Build Path を変えるだけでデプロイできます。
:::

ここまでで、ConoHa VPS 1 台の上に Dokploy 本体 + Traefik + 自動 HTTPS 基盤 + メタデータ DB が動き、さらにその上で `hello-world` アプリが Dokploy 経由でビルド・デプロイされ、Traefik 経由で公開されている状態になります。

## カスタマイズ

- **バージョンの更新**: `DOKPLOY_VERSION` を export してから同じ one-liner を再実行する（`sudo -E` を忘れないこと）。

  ```bash
  export DOKPLOY_VERSION=v0.29.0
  curl -fsSL https://raw.githubusercontent.com/crowdy/conoha-cli-app-samples/main/dokploy/install-on-conoha.sh \
    | sudo -E bash
  ```

  既存ホストのアップグレードのみを行いたい場合は `curl -fsSL https://dokploy.com/install.sh | bash -s update` を使う（事前に `DOKPLOY_VERSION` を export しておけばそのバージョンへ、指定なしなら最新安定版へ更新される）。再現性のため `latest` や `canary` の追従運用は推奨しない。

- **独自ドメイン + 自動 HTTPS**: DNS の A レコードをサーバー IP に向けたうえで、Dokploy の Domain 設定で **HTTPS** と **Certificate Provider: Let's Encrypt** を選ぶだけで、Traefik が証明書の取得・更新を自動で行う（conoha-proxy の ACME 機構とは独立）。
- **Swarm overlay CIDR の変更**: デフォルトの `10.20.0.0/16` が社内 VPN などと衝突する場合は、`DOCKER_SWARM_INIT_ARGS` を上書きしてから初回インストールを実行する。

  ```bash
  export DOCKER_SWARM_INIT_ARGS="--default-addr-pool 172.30.0.0/16 --default-addr-pool-mask-length 24"
  sudo -E bash install-on-conoha.sh
  ```

- **バックアップ**: Dokploy の **Settings** から `dokploy-postgres` ボリュームの定期バックアップを設定できる。
- **テンプレートマーケットプレース**: **Templates** メニューから Pocketbase / Plausible / Cal.com など人気の OSS をワンクリックでデプロイできる。試しに 1 つ入れてみると Dokploy の運用イメージがつかみやすい。

## アンインストール

完全に元に戻したい場合は、root 権限（例: `sudo -i` で root シェルに入る）で以下を順に実行します。

```bash
# Dokploy のサービスを削除
docker service rm dokploy dokploy-postgres dokploy-redis

# Swarm はサービス削除後もタスクコンテナを非同期に reap するため、
# 全タスクコンテナが消えるまで待つ（これがないと次の volume rm が
# "volume is in use" で失敗する）
while docker ps -aq --filter "label=com.docker.swarm.service.name" | grep -q .; do sleep 1; done

# Traefik コンテナを削除
docker rm -f dokploy-traefik

# Swarm secret を削除
docker secret rm dokploy_postgres_password

# Overlay ネットワークを削除
docker network rm dokploy-network

# データボリュームを削除（永続データも消える）
docker volume rm dokploy dokploy-postgres dokploy-redis

# Swarm モードを抜ける
docker swarm leave --force

# Dokploy の設定ディレクトリを削除
rm -rf /etc/dokploy
```

`docker info | grep "Swarm: inactive"` が表示されれば Swarm モードから完全に抜けたことを確認できます。手順の途中でコマンドを打ち間違えた場合も、上から順にやり直せば安全に収束します（`docker service rm` や `docker volume rm` は対象が既に存在しなければエラーになるだけで、副作用はありません）。

## ハマりどころ

::: warning `sudo -E` を忘れて環境変数が剥がれる
最も多いハマりです。`-E` がないと sudo が `DOKPLOY_VERSION` / `ADVERTISE_ADDR` / `DOCKER_SWARM_INIT_ARGS` を剥がしてしまい、export した値が静かに無視されます。「バージョンを固定したはずなのに反映されない」「`ADVERTISE_ADDR` を指定したのに無視される」といった症状が出たら、まず `-E` の付け忘れを疑ってください。
:::

::: warning ポート競合でインストールが落ちる
公式 `install.sh` は `:80` / `:443` / `:3000` のいずれかが既に使われていると停止します。`ss -tulnp` で何が使っているか確認し、`systemctl stop` 等で止めてから再実行してください。
:::

::: warning Swarm overlay の CIDR 衝突
デフォルトの `10.20.0.0/16` が社内 VPN など既存のネットワークと衝突する場合があります。[カスタマイズ](#カスタマイズ) の手順で `DOCKER_SWARM_INIT_ARGS` を別の範囲（例: `172.30.0.0/16`）に上書きしてください。
:::

::: warning ConoHa VPS3 に private IP がない
公式インストーラの `get_private_ip()` は RFC1918 の私設アドレスを前提にしており、public IPv4 のみの ConoHa VPS3 では検出に失敗します。`install-on-conoha.sh` が自動で public IPv4 を検出して解決しますが、自動検出が失敗した場合は `ADVERTISE_ADDR=<SERVER_IP> sudo -E bash install-on-conoha.sh` のように明示的に指定してください。
:::

::: warning アンインストール時の "volume is in use"
`docker service rm` の直後に `docker volume rm` すると、Swarm がタスクコンテナを非同期に reap している最中のため失敗することがあります。[アンインストール](#アンインストール) の `while` ループで全タスクコンテナが消えるのを待ってから volume を削除してください。
:::

`/etc/dokploy` が `chmod 777` になっているのは公式インストーラの仕様です。Dokploy 本体と Traefik コンテナがそれぞれ非 root ユーザでこのディレクトリを読み書きするための設計であり、バグではありません。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の dokploy](https://github.com/crowdy/conoha-cli-app-samples/tree/main/dokploy)
- Dokploy 公式: [dokploy.com](https://dokploy.com/) / ドキュメント: [docs.dokploy.com](https://docs.dokploy.com/)
- conoha-cli: [はじめに](/guide/getting-started)
- 関連サンプル:
  - [Coolify (セルフホスティング PaaS)](/examples/coolify) — もう 1 つの PaaS パターン。Coolify は `conoha app deploy` で conoha-proxy 配下（:8000）にデプロイするのに対し、dokploy は `server ssh` + インストーラで自前の Traefik（:80/:443）を Docker Swarm 上に立てる、という好対照になっている
  - [Hello World](/examples/hello-world) — 本例で Dokploy 経由でデプロイするアプリ本体
