# 終了コード

`internal/errors/exitcodes.go` で定義されている終了コード一覧です。スクリプトや CI から conoha-cli を呼び出す際のエラーハンドリングに利用できます。

| コード | 名称 | 意味 |
|-------|------|------|
| `0` | OK | 成功 |
| `1` | General | 一般エラー（具体的な分類に当てはまらない場合） |
| `2` | Auth | 認証失敗（ログイン未完了、トークン期限切れ、認可エラー等） |
| `3` | NotFound | リソース未検出（指定 ID / 名前のサーバー / イメージ / ボリュームなどが存在しない） |
| `4` | Validation | バリデーションエラー（フラグ値の形式違反、`conoha.yml` スキーマ違反等） |
| `5` | API | API エラー（5xx 等のサーバー側エラー） |
| `6` | Network | ネットワークエラー（DNS 解決失敗、接続拒否、タイムアウト等） |
| `7` | ModeConflict | `app` 系で `--proxy` / `--no-proxy` がサーバー側マーカーと不一致 |
| `8` | NotInitialized | `app` 系でサーバー側マーカーが見つからない（`app init` 未実行） |
| `10` | Cancelled | ユーザーキャンセル（確認プロンプトで N、Ctrl-C 等） |

`7` と `8` は v0.6.1 以降に追加されました ([#111](https://github.com/crowdy/conoha-cli/issues/111))。それ以前は `1` (General) として返っていました。

## エラーハンドリング例

```bash
conoha app deploy my-server
case $? in
  0)  echo "OK" ;;
  3)  echo "サーバーが見つかりません — server create を確認" ;;
  7)  echo "モード不一致 — --proxy/--no-proxy またはマーカーを確認" ;;
  8)  echo "未初期化 — app init を先に実行" ;;
  10) echo "ユーザーがキャンセルしました" ;;
  *)  echo "その他のエラー (code: $?)" ;;
esac
```

## 関連ページ

- [グローバルフラグ・環境変数](/reference/global-flags) — `--no-input` / `--yes` で非対話実行
- [`app` リファレンス](/reference/app) — モード関連の挙動詳細
