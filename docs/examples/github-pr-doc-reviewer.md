# GitHub PR Doc Reviewer デプロイ

spec レポジトリの PR を Claude が自動レビューする、AI 搭載の GitHub Actions self-hosted runner です。`myoung34/github-runner` ベースのコンテナに `claude` CLI をプリインストールし、GitHub に対して outbound 接続のみ行います。

::: tip 本例は no-proxy モードで動作します
このランナーは HTTP リクエストを受け取らないため（GitHub へのポーリングのみ）、[github-actions-runner](/examples/github-actions-runner) と同様に `conoha.yml` を作らず `--no-proxy` でデプロイします。詳細は [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。
:::

## 完成イメージ

- spec レポジトリで PR を開くと、self-hosted runner が拾って `quick` モード（mechanical チェックのみ、LLM 呼び出しなし）を自動実行
- `deep-review` ラベルを付けると `deep` モードに切り替わり、Claude が古さ・不足・ADR との不整合・用語ぶれ・コード/仕様ドリフトを分析
- 結果は sticky コメント（quick）またはインライン PR review（deep）として投稿される

## 前提条件

- ConoHa CLIがインストール・ログイン済み
- ConoHa VPS3 アカウント + SSH キーペア
- GitHub Personal Access Token（`repo` スコープ、または対象レポジトリに絞った fine-grained token）
- Anthropic Pro または Max サブスクリプション（API キーは不要）

## デプロイ手順

```bash
# 1. サーバー作成
conoha server create --name doc-reviewer --flavor g2l-t-2 --image ubuntu-24.04 --key-name mykey

# 2. アプリ初期化（--no-proxy モード。conoha.yml は作成しません）
conoha app init doc-reviewer --app-name github-pr-doc-reviewer --no-proxy

# 3. 環境変数を設定
#    GitHub PAT の値は事前にシェル変数 ACCESS_TOKEN へ export しておき、
#    コマンドやシェル履歴に平文で残らないようにしてください。
conoha app env set doc-reviewer --app-name github-pr-doc-reviewer \
  REPO_URL=<YOUR_SPEC_REPO_URL> \
  ACCESS_TOKEN=${ACCESS_TOKEN:?required}

# 4. デプロイ（--no-proxy モード）
conoha app deploy doc-reviewer --app-name github-pr-doc-reviewer --no-proxy
```

デプロイ後、1回だけ Claude の OAuth 認証が必要です。

```bash
conoha server ssh doc-reviewer -i ~/.ssh/conoha_mykey
docker exec -it $(docker ps -qf name=runner) claude
# デバイスコード → ブラウザで認証 → ~/.claude/ に永続化（claude_home ボリューム）
```

compose.yml の抜粋（runner サービスのみ。全文は [GitHub 上の compose.yml](https://github.com/crowdy/conoha-cli-app-samples/blob/main/github-pr-doc-reviewer/compose.yml) を参照）:

```yaml
services:
  runner:
    build: .
    environment:
      - REPO_URL=${REPO_URL}
      - ACCESS_TOKEN=${ACCESS_TOKEN}
      - RUN_AS_ROOT=false
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - claude_home:/home/runner/.claude
      - runner_work:/tmp/runner/work
    restart: unless-stopped
```

::: tip 設定ポイント
- `ACCESS_TOKEN` と `REPO_URL` は上記のようにプレースホルダーのまま掲載しています。実際のPATやレポジトリURLは絶対にコミットしないでください（サンプルで設定済み）。
- Anthropic 認証はサブスクリプション（Pro/Max）の OAuth ベースで、API キーは不要です。上記の1回だけの `claude` 対話ログインで完結します。
- `quick` モード（既定）は mechanical チェックのみで LLM 呼び出しなし。PR に `deep-review` ラベルを付けると `deep` モードになり Claude の意味解析が走ります。
- ワークフローテンプレート（`workflow-template/doc-review.yml`）を自分の spec レポジトリの `.github/workflows/doc-review.yml` にコピーしてください。`@main` ではなく commit SHA / タグへの pin を推奨します。
:::

## 動作確認

対象の spec レポジトリで PR を開くと、runner が拾ってジョブを開始します。

```bash
conoha app logs doc-reviewer --app-name github-pr-doc-reviewer
# "[doc-reviewer] Claude OAuth credentials detected" が出力されていることを確認
```

GitHub 側では Settings > Actions > Runners でランナーが `Idle`→ジョブ実行中になり、PR に quick（sticky コメント）または deep（インラインレビュー）の結果が投稿されます。

```bash
conoha app status doc-reviewer --app-name github-pr-doc-reviewer
```

## 関連リンク

- レシピ全文: <https://github.com/crowdy/conoha-cli-app-samples/tree/main/github-pr-doc-reviewer>
- [GitHub Actions Runner デプロイ](/examples/github-actions-runner)
