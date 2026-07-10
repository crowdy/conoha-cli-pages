# GitHub Actions セルフホステッドランナー

GitHub Actions のセルフホステッドランナーを ConoHa VPS 上に構築します。ランナーは GitHub に対して **outbound 接続のみ** を行い、外部からの HTTP リクエストを受け付けません。そのため `conoha.yml`（FQDN・TLS・proxy 設定）は作成せず、**no-proxy モード**でデプロイします。

::: tip no-proxy 補足
本例は conoha-proxy（Host ベースルーティング + TLS 終端）も blue/green 切替も使いません。理由は、ランナーが GitHub へ outbound 接続するだけで inbound の HTTP を受け取らないためです。モードの違いは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。
:::

## 完成イメージ

- プライベートリポジトリの CI/CD を自前の ConoHa VPS 上で実行
- [myoung34/docker-github-actions-runner](https://github.com/myoung34/docker-github-actions-runner) による Docker-in-Docker 対応ランナー
- ワークフローで `runs-on: self-hosted` を指定してジョブを実行

## 前提条件

- conoha-cli がインストール・ログイン済み
- ConoHa VPS3 アカウント
- SSH キーペアが設定済み
- GitHub Personal Access Token（`repo` スコープ、または fine-grained token）

## デプロイ手順

```bash
# 1. サーバー作成
conoha server create --name <サーバー名> --flavor g2l-t-2 --image ubuntu-24.04 --key-name <キー名>

# 2. アプリ初期化（--no-proxy モード。conoha.yml は作成されません）
conoha app init --no-proxy --app-name github-actions-runner <サーバー名>

# 3. 環境変数を設定（GitHub PAT は必須）
conoha app env set --app-name github-actions-runner <サーバー名> \
  REPO_URL=<GitHubリポジトリのURL> \
  ACCESS_TOKEN=${ACCESS_TOKEN:?required}

# 4. デプロイ（--no-proxy モード）
conoha app deploy --no-proxy --app-name github-actions-runner <サーバー名>
```

## compose.yml（抜粋）

```yaml
services:
  runner:
    image: myoung34/github-runner:2.333.1
    environment:
      - REPO_URL=${REPO_URL}
      - ACCESS_TOKEN=${ACCESS_TOKEN}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - runner_work:/tmp/runner/work
    restart: unless-stopped
```

全文は [compose.yml（GitHub）](https://github.com/crowdy/conoha-cli-app-samples/blob/main/github-actions-runner/compose.yml) を参照してください。

::: tip 設定ポイント
- `ACCESS_TOKEN` には GitHub PAT（`repo` スコープ、または fine-grained token）を渡します。実際のトークン文字列をコマンド履歴やファイルに残さないよう、`${ACCESS_TOKEN:?required}` の形で参照すると未設定時にエラーとなり安全です。本番運用では fine-grained token を推奨します。
- `REPO_URL` は対象リポジトリの URL に置き換えます。組織レベルのランナーにする場合はリポジトリではなく組織の URL を指定します。
- `/var/run/docker.sock` をマウントしているため、ランナー内から Docker ビルドが可能です（Docker-in-Docker）。
- ランナー名やラベル（`RUNNER_NAME` / `LABELS`）はサンプルの compose.yml でデフォルト値が設定済みです（サンプルで設定済み）。GPU ジョブ用など独自のラベル（例: `gpu,large`）を付けたい場合は環境変数で上書きします。
:::

## 動作確認

GitHub リポジトリの **Settings > Actions > Runners** でランナーが **Idle** 状態になっていることを確認します。

```bash
conoha app status --app-name github-actions-runner <サーバー名>
conoha app logs --app-name github-actions-runner <サーバー名>
```

ワークフロー側で `runs-on: self-hosted` を指定すればジョブがこのランナー上で実行されます。

## 関連リンク

- Recipe: [github-actions-runner（GitHub）](https://github.com/crowdy/conoha-cli-app-samples/tree/main/github-actions-runner)
- [GitHub Actions セルフホステッドランナー ドキュメント](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners)
