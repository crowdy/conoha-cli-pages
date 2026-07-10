# LINE CLI (Go) — line-api-mock 操作用CLIクライアント

::: tip このサンプルはデプロイ対象ではありません
これは line-api-mock を操作する Go 製 CLI クライアントで、`conoha app deploy` の対象ではなく、ローカル（またはサーバー上）でビルドして使うツールです。リンク: [line-api-mock](/examples/line-api-mock)
:::

LINE公式のGo SDK（[line-bot-sdk-go](https://github.com/line/line-bot-sdk-go) v8）を使い、line-api-mockが実装する全エンドポイントをコマンドラインから叩けるCLIツールです。トークン発行・メッセージ送信・リッチメニュー管理などをスクリプトやターミナルから操作でき、line-api-mockとペアで使うことを前提にしています。

## 完成イメージ

- チャンネルアクセストークンの発行・検証・失効（v2 / v2.1）をCLIから実行
- push / reply / multicast / broadcast / narrowcast の各方式でメッセージ送信
- リッチメニューの作成・画像アップロード・ユーザーへのリンク・エイリアス管理
- 全コマンド共通の `--json` フラグでJSON出力に切り替え

## 前提条件

- Go 1.26以降のツールチェイン（`go.mod` は `go 1.26.1` を要求）
- 起動済みの line-api-mock インスタンス（ローカルまたはConoHaサーバー上）
- (任意) `jq` — `--json` の出力をパースする場合に便利

## 使い方

```bash
# line-api-mock と同じリポジトリに含まれています
git clone https://github.com/crowdy/conoha-cli-app-samples.git
cd conoha-cli-app-samples/line-cli-go
go build -o line-cli-go .

cp .env.example .env
# .env を編集し、チャンネルID・チャンネルシークレットに <PLACEHOLDER> を設定

./line-cli-go token issue
./line-cli-go message push --to <PLACEHOLDER> --text "Hello from Go CLI!"
```

設定ファイル派の場合は `.line-cli.yaml.example` を `.line-cli.yaml` にコピーして編集する方法も使えます。ConoHa上で動くline-api-mockに向ける場合は `base_url` を書き換えるだけです。設定の優先順位は 環境変数 → 設定ファイル → CLIフラグ です。

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `token issue` | v2 チャンネルアクセストークン発行 |
| `token verify` / `token revoke` | トークン検証 / 失効 |
| `message push` / `reply` | プッシュ / リプライ送信 |
| `message multicast` / `broadcast` / `narrowcast` | 複数宛先への配信 |
| `profile get` | ユーザープロフィール取得 |
| `webhook set` / `test` | Webhookエンドポイント設定 / 疎通確認 |
| `richmenu create` / `list` / `get` | リッチメニュー作成 / 一覧 / 取得 |
| `richmenu set-image` / `set-default` | 画像アップロード / 既定設定 |
| `richmenu link` / `bulk-link` | ユーザーへのリンク（単体 / 一括） |

全コマンド一覧はリポジトリのREADMEを参照してください。

## 動作確認

1. line-api-mock を起動し、ログに出るチャンネルIDとシークレットを `.env` に設定する
2. `./line-cli-go token issue` でアクセストークンが返ることを確認
3. `./line-cli-go message push --to <PLACEHOLDER> --text "..."` を実行し、line-api-mock側のログ（または `/v2/bot/message/push` 相当のモックエンドポイント）で受信を確認

## 関連リンク

- Recipe: https://github.com/crowdy/conoha-cli-app-samples/tree/main/line-cli-go
- 連動サンプル: [line-api-mock](/examples/line-api-mock)
- [line-bot-sdk-go](https://github.com/line/line-bot-sdk-go)
