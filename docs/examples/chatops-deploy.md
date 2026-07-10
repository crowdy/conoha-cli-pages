# ChatOps デプロイ

PR コメントに `/deploy` と書いた瞬間に、セルフホステッドランナー経由で ConoHa VPS へデプロイが走る ChatOps サンプルです。「チャット」は Slack などの外部プラットフォームではなく **GitHub 自身**（`issue_comment` イベント）で、GitHub Environments の staging / production を使い分けます。本例は proxy モードで動作します。

::: tip 前提サンプル
[`gitops-pipeline`](/examples/gitops-pipeline)・[`multi-env-deploy`](/examples/multi-env-deploy)・[GitHub Actions セルフホステッドランナー](/examples/github-actions-runner) を先に読むと構成が理解しやすいです。
:::

## 完成イメージ

- PR に `/deploy` / `/deploy staging` / `/deploy production` とコメントすると、bot が 👀 → 🚀 → ✅ / ❌ の順にコメントを積んでいく
- `production` への deploy は GitHub Environment の Required reviewers 承認を経てから実行
- アプリは `https://chatops.example.com` で TLS 付きアクセス可能（proxy モード）
- コメント投稿者の権限（`write` 以上）チェック・fork PR 拒否・script injection 対策の 4 重ガード付き

## 前提条件

- ConoHa CLI がインストール・ログイン済み（セルフホステッドランナー上に `v0.6.0` 以上）
- ドメイン（例: `chatops.example.com`）の A レコードを VPS の IP に向けている（[DNS / TLS](/guide/dns-tls)）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）
- [`github-actions-runner`](/examples/github-actions-runner) サンプルでセルフホステッドランナーが稼働中
- GitHub Environments に `staging` / `production` を作成し、各 Secrets（`CONOHA_TENANT_ID` / `CONOHA_USERNAME` / `CONOHA_PASSWORD` / `CONOHA_SSH_PRIVATE_KEY`）と Variables（`CONOHA_SERVER_NAME` / `CONOHA_SERVER_HOST`）を登録済み（`production` には Required reviewers を設定推奨）

## デプロイ手順

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples.git
cd conoha-cli-app-samples/chatops-deploy
```

`conoha.yml` の `hosts:` を実際のドメインに変更します:

```yaml
name: chatops-deploy
hosts:
  - chatops.example.com
web:
  service: web
  port: 3000
```

一度だけ手動で init し、proxy に登録します:

```bash
conoha app init <サーバー名> --app-name chatops-deploy
```

サンプルの `.github/workflows/deploy.yml` を自分のアプリリポジトリへコピーし（`.github/workflows/` はリポジトリルート直下でのみ有効です）、上記の Environment Secrets / Variables を登録した状態でデフォルトブランチへ push します。以降は `/deploy` コメントが `conoha app deploy` を自動実行します。

```bash
cp -r chatops-deploy/. /path/to/your-repo/
```

`compose.yml`（全文は [GitHub](https://github.com/crowdy/conoha-cli-app-samples/blob/main/chatops-deploy/compose.yml) 参照）は、ワークフローの「per-deploy `.env`」ステップが都度書き出す `DEPLOY_ENV` / `DEPLOY_SHA` を `environment:` で読み込みます（ローカルで未設定の場合のフォールバック値あり）。

::: tip 設定ポイント
- **Webhook URL の登録は不要**: `issue_comment` は GitHub Actions ネイティブのイベントで、外部 Webhook を別途登録する必要はありません。署名検証も GitHub 側の実行基盤に委ねられます。
- **bot が反応するコマンド**: `/deploy`（既定で staging）/ `/deploy staging` / `/deploy production`。`/deployment` のような紛らわしい文字列は `==` または `startsWith('/deploy ')` の厳密一致で弾かれます。
- **トリガー元の認可**: Webhook 署名の代わりに `getCollaboratorPermissionLevel` でコメント投稿者の権限（`write` 以上）を確認し、さらに fork PR からのコメントは拒否します。
- **ConoHa 資格情報は GitHub Environment Secrets 経由のみ**: `CONOHA_TENANT_ID=${CONOHA_TENANT_ID:?required}` / `CONOHA_USERNAME=${CONOHA_USERNAME:?required}` / `CONOHA_PASSWORD=${CONOHA_PASSWORD:?required}` / `CONOHA_SSH_PRIVATE_KEY=${CONOHA_SSH_PRIVATE_KEY:?required}` をワークフロー内にハードコードしないこと（サンプルで設定済み）。
- **コメント本文は env 変数経由でのみ参照**: `github.event.comment.body`（GitHub Actions 式）を直接シェルへ展開せず `env: COMMENT_BODY: ...` を経由させ、script injection を防止しています。
:::

## 動作確認

対象 PR に以下をコメントします:

```
/deploy staging
```

bot が 👀 リアクションを付け、続けて `🚀 Deploying <SHA> to **staging**…` → `✅ Deployed <SHA> to **staging**.` とコメントされれば成功です。ブラウザで `https://chatops.example.com` にアクセスし、`DEPLOY_SHA` が更新されていることを確認してください。

```bash
conoha app status <サーバー名> --app-name chatops-deploy
conoha app logs <サーバー名> --app-name chatops-deploy
```

## 関連リンク

- Recipe: [conoha-cli-app-samples/chatops-deploy](https://github.com/crowdy/conoha-cli-app-samples/tree/main/chatops-deploy)
- [multi-env-deploy](/examples/multi-env-deploy) — ブランチ分岐型 (push トリガー) の環境分離
- [gitops-pipeline](/examples/gitops-pipeline) — シングル環境のシンプルな自動デプロイ
