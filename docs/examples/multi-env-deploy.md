# マルチ環境デプロイ (staging / production)

同じアプリを staging・production の 2 台の ConoHa VPS へ、環境ごとに異なる FQDN でデプロイするパターンです。本例は proxy モード (blue/green + Let's Encrypt HTTPS) を前提とし、`--app-name` を環境ごとに使い分けることで 1 つのリポジトリから複数の宛先を管理します。

## 完成イメージ

- `https://staging.example.com` と `https://example.com` に、同じコードベースが別々の VPS で稼働
- 各環境は `conoha app init --app-name <env>` で独立管理され、片方への操作がもう片方に影響しない
- blue/green 切り替えのため各環境で無停止デプロイ・rollback が可能

## 前提条件

- ConoHa CLI がインストール・ログイン済み ([はじめに](/guide/getting-started))
- staging・production それぞれの VPS が作成済み ([`--for proxy` プリセット推奨](/guide/server#プリセット-for))
- 各環境の FQDN (例: `staging.example.com` / `example.com`) を用意し、それぞれの VPS の IP へ A レコードを向けている ([DNS / TLS](/guide/dns-tls))
- 両方の VPS で conoha-proxy がブート済み ([conoha-proxy セットアップ](/guide/proxy-setup))

## デプロイ手順

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/multi-env-deploy
```

`conoha.yml` の `hosts:` は初期値のままにせず、デプロイ先ごとに書き換えます。

```yaml
name: multi-env-deploy
web:
  service: web
  port: 3000
```

staging と production、それぞれ別サーバーへ `--app-name` を分けて初期化・デプロイします。

```bash
# staging
conoha app init <staging-サーバー名> --app-name staging
# conoha.yml の hosts を staging.example.com に書き換えてから
conoha app deploy <staging-サーバー名> --app-name staging

# production
conoha app init <production-サーバー名> --app-name production
# conoha.yml の hosts を example.com に書き換えてから
conoha app deploy <production-サーバー名> --app-name production
```

compose.yml は proxy モードのため外部ポートを直接バインドしません。

```yaml
services:
  web:
    build: .
    expose:
      - "3000"
```

環境変数など残りの定義は [GitHub 上の完全な compose.yml](https://github.com/crowdy/conoha-cli-app-samples/blob/main/multi-env-deploy/compose.yml) を参照してください。

::: tip 設定ポイント
- **`--app-name` + FQDN の使い分け**: 1 つのコードベースでも `--app-name staging` / `--app-name production` のように名前を分ければ、`conoha app` 系コマンドが環境ごとに独立したアプリとして扱います。各環境の `conoha.yml` の `hosts:` をその環境の FQDN に書き換えることで、staging と production を完全に分離できます。
- **`hosts` は初期値に過ぎない**: サンプルの `conoha.yml` には次のコメントが付いています（GitHub 上の [`conoha.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/multi-env-deploy/conoha.yml) より抜粋、原文ママ）。

  ```
  # Replace with your own FQDNs before running `conoha app init`.
  # `hosts` here is just a default — the actual hostname per environment
  # typically differs (e.g. staging.example.com vs example.com). Override
  # this file in each target VPS if needed, or rely on the workflow's
  # `--app-name` and per-environment FQDN configuration.
  ```

  つまり `hosts:` の値をそのまま使い回してはいけません。デプロイ先の VPS ごとに `conoha.yml` を上書きするか、CI ワークフロー側で `--app-name` と環境別 FQDN を組み合わせて解決してください。
- **staging と production の分離**: サーバー自体を分ける (VPS 単位の分離) のに加え、`--app-name` を分けることでアプリ管理の単位も分離されます。誤って production 側の `conoha app deploy` を staging に向けて実行する事故を防げます。
:::

## 動作確認

まず staging にデプロイして確認し、問題なければ production にデプロイします。

```bash
# staging を確認
conoha app status <staging-サーバー名> --app-name staging
curl -I https://staging.example.com

# production へ反映
conoha app deploy <production-サーバー名> --app-name production
conoha app status <production-サーバー名> --app-name production
curl -I https://example.com
```

それぞれの FQDN で TLS 付きアクセスができ、`conoha app status` が healthy を返せば完了です。

## 関連リンク

- Recipe: [multi-env-deploy](https://github.com/crowdy/conoha-cli-app-samples/tree/main/multi-env-deploy)
- [GitOps パイプライン](/examples/gitops-pipeline)
- [ChatOps デプロイ](/examples/chatops-deploy)
