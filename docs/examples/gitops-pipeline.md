# GitOps パイプライン

GitHub の `main` ブランチへのマージをトリガーに、セルフホステッドランナー上で `conoha app deploy` を実行し、Next.js アプリを ConoHa VPS へ自動デプロイする構成です。本例は **proxy モード**（blue/green + Let's Encrypt HTTPS）を前提とします。

::: tip 2 台構成です
ランナー用 VPS（[GitHub Actions セルフホステッドランナー](/examples/github-actions-runner)）とデプロイ先のアプリ用 VPS を分離します。ランナーがデプロイ対象と同じ VPS を壊すリスクを避けるためです。1 台に統合することも可能ですが推奨しません。
:::

## 完成イメージ

- `main` に push（PR マージ）すると自動的にビルド → デプロイ
- ページにデプロイされたコミット SHA とタイムスタンプが表示される
- `conoha-proxy` の blue/green 切替で無停止デプロイ

## 前提条件

- conoha-cli v0.6.0 以上（ランナーのホストにインストール済み）
- ConoHa VPS3 アカウント（テナント ID / API ユーザー名・パスワード）
- セルフホステッドランナーが稼働中（[GitHub Actions セルフホステッドランナー](/examples/github-actions-runner) 参照）
- アプリ用 VPS が `conoha app init` 済み（[`--for proxy` プリセット推奨](/guide/server#プリセット-for)）
- ドメイン（例: `gitops.example.com`）を用意し、A レコードをアプリ用 VPS の public IP に向けている
- `conoha-proxy` がアプリ用 VPS でブート済み
- ランナー → アプリ用 VPS への SSH キーペア

## デプロイ手順

```bash
# 1. サンプルを取得し、自分のリポジトリへコピー
git clone https://github.com/crowdy/conoha-cli-app-samples.git
cp -r conoha-cli-app-samples/gitops-pipeline/. /path/to/your-repo/
cd /path/to/your-repo
```

`conoha.yml` の `hosts:` を自分の FQDN に書き換えます。

```yaml
name: gitops-pipeline
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - gitops.example.com
web:
  service: web
  port: 3000
```

```bash
# 2. アプリ用 VPS を初期化
conoha app init --app-name gitops-pipeline <アプリ用サーバー名>

# 3. 変更を push
git init && git add . && git commit -m "initial"
git remote add origin https://github.com/<you>/<your-repo>.git
git push -u origin main
```

GitHub リポジトリの **Settings > Secrets and variables > Actions** で以下を登録します。

| 種別 | 名前 | 内容 |
|---|---|---|
| Secret | `CONOHA_TENANT_ID` | ConoHa テナント ID |
| Secret | `CONOHA_USERNAME` | ConoHa API ユーザー名 |
| Secret | `CONOHA_PASSWORD` | ConoHa API パスワード |
| Secret | `CONOHA_SSH_PRIVATE_KEY` | ランナー → アプリ用 VPS の SSH 秘密鍵（PEM 本体） |
| Variable | `CONOHA_SERVER_NAME` | アプリ用 VPS 名（`conoha server list` で確認） |
| Variable | `CONOHA_SERVER_HOST` | アプリ用 VPS の public IP または FQDN |

## compose.yml（抜粋）

```yaml
services:
  web:
    build: .
    # No host-side port: conoha-proxy injects a randomly-bound
    # 127.0.0.1:0:3000 mapping at deploy time so two slots (blue/green)
    # can coexist.
    expose:
      - "3000"
```

全文は [compose.yml（GitHub）](https://github.com/crowdy/conoha-cli-app-samples/blob/main/gitops-pipeline/compose.yml) を参照してください。

::: tip 設定ポイント
- トリガーは GitHub Actions の `push`（`main` へのマージ）イベントです。独自の webhook や署名検証用シークレットは不要で、GitHub 標準の Actions 認証機構がそのまま使われます。
- ワークフローは `conoha auth login` を `CONOHA_TENANT_ID` / `CONOHA_USERNAME` / `CONOHA_PASSWORD` と `CONOHA_NO_INPUT=1` で非対話実行し、`CONOHA_SSH_PRIVATE_KEY` を使ってランナーからアプリ用 VPS へ SSH します。上表のシークレットはすべて `${VAR:?required}` 相当（未設定ならジョブが失敗）として扱われ、値そのものをリポジトリに残しません。
- 反映（reconcile）の実体は `conoha app deploy` です。カレントディレクトリを tar.gz 化して SSH 経由でアプリ用 VPS に転送し、新しい slot（blue/green の片方）で `docker compose up -d` を実行、`conoha-proxy` がヘルスチェック後にトラフィックを新 slot へ切り替えます。
- proxy モードでは `conoha app env set` の値が blue/green slot に確実に反映される保証がないため、設計上 `DEPLOY_SHA` / `DEPLOY_TIMESTAMP` はワークフローが生成する `.env` に載せてデプロイ tar に同梱します。`.env` は `.gitignore` 済みでリポジトリには残りません。
- 即時ロールバックは `git revert` → push による再デプロイに頼る設計です。旧 slot へすぐ戻したい場合はランナーにログインして `conoha app rollback <サーバー名>` を手動実行してください。
- **注意**: ランナーはデプロイ用の API 資格情報と SSH 秘密鍵を保持します。public リポジトリで self-hosted runner を使うと PR からの任意コード実行で漏洩し得るため避けてください。
:::

## 動作確認

適当にブランチを切って `app/page.tsx` を編集し、Pull Request を開くと型チェック + ビルドの `test` ジョブが走ります。レビュー後 `main` にマージすると `deploy` ジョブが起動します。

```bash
# 手動でワークフローを発火する場合
gh workflow run deploy.yml
gh run list --workflow deploy.yml

# ターゲット VPS 上のスロット状態
conoha app status --app-name gitops-pipeline <アプリ用サーバー名>
```

ブラウザで `https://gitops.example.com/` にアクセスし、ページに直前のコミット SHA とデプロイ時刻が表示されれば成功です。

## 関連リンク

- Recipe: [gitops-pipeline（GitHub）](https://github.com/crowdy/conoha-cli-app-samples/tree/main/gitops-pipeline)
- [GitHub Actions セルフホステッドランナー](/examples/github-actions-runner)
- [マルチ環境デプロイ](/examples/multi-env-deploy)
- [ChatOps デプロイ](/examples/chatops-deploy)
