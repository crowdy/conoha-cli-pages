# Meilisearch デプロイ

Meilisearch（Algolia 代替の高速セルフホスティング全文検索エンジン）を ConoHa VPS にデプロイする手順です。本例は proxy モード（blue/green + Let's Encrypt HTTPS）で公開します。タイポ耐性・ファセット検索・日本語トークナイザーを備えた検索 API を、自分のサーバーで運用したい方向け。

## 完成イメージ

- Meilisearch の REST API とミニダッシュボードが `https://<あなたの FQDN>` で TLS 付きアクセス可能
- インデックスデータは `meilisearch_data` ボリュームで永続化
- `MEILI_MASTER_KEY`（サンプルで設定済みの手順に沿えば安全な値）で API を保護
- `conoha app deploy` で blue/green 無停止デプロイ

## 前提条件

- ConoHa CLI がインストール・ログイン済み ([はじめに](/guide/getting-started))
- 公開したい FQDN（例: `search.example.com`）の DNS A レコードをサーバー IP に向けている ([DNS / TLS](/guide/dns-tls))
- conoha-proxy がブート済み ([conoha-proxy セットアップ](/guide/proxy-setup))

## デプロイ手順

```bash
# 1. サンプルを取得
git clone https://github.com/crowdy/conoha-cli-app-samples.git
cd conoha-cli-app-samples/meilisearch

# 2. conoha.yml の hosts を自分の FQDN に書き換える
#    （エディタで meilisearch.example.com を置き換える）

# 3. アプリ登録
conoha app init <サーバー名>

# 4. マスターキーを設定（自分で生成した値を使う。省略不可）
conoha app env set <サーバー名> MEILI_MASTER_KEY=${MEILI_MASTER_KEY:?required}

# 5. デプロイ
conoha app deploy <サーバー名>
```

`conoha.yml` はこの構成です（[全文は GitHub](https://github.com/crowdy/conoha-cli-app-samples/blob/main/meilisearch/conoha.yml)）:

```yaml
name: meilisearch
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - meilisearch.example.com
web:
  service: meilisearch
  port: 7700
```

`compose.yml` の抜粋（[全文は GitHub](https://github.com/crowdy/conoha-cli-app-samples/blob/main/meilisearch/compose.yml)）:

```yaml
services:
  meilisearch:
    image: getmeili/meilisearch:v1.13
    expose:
      - "7700"
    environment:
      - MEILI_MASTER_KEY=${MEILI_MASTER_KEY:?required}
      - MEILI_ENV=production
    volumes:
      - meilisearch_data:/meili_data
    restart: unless-stopped
```

::: tip 設定ポイント
- `MEILI_MASTER_KEY` は本番環境では必須です。`compose.yml` 側は `${MEILI_MASTER_KEY:?required}` のように「未設定ならエラーで止まる」形にし、リテラルな鍵をコミットしないでください。値は `conoha app env set` で自分が生成したものを渡します。
- `MEILI_ENV=production` にするとダッシュボードが無効化され、API のみが有効になります（開発中は `development` も選べます）。
- インデックスデータは `meilisearch_data` ボリュームに永続化されるため、`conoha app deploy` で再デプロイしてもデータは消えません。
:::

## 動作確認

```bash
# ヘルスチェック
curl "https://<あなたの FQDN>/health"

# サンプルインデックスへドキュメント追加
curl -X POST "https://<あなたの FQDN>/indexes/movies/documents" \
  -H "Authorization: Bearer <MEILI_MASTER_KEY>" \
  -H "Content-Type: application/json" \
  --data-binary '[
    {"id": 1, "title": "千と千尋の神隠し", "genre": "アニメ"},
    {"id": 2, "title": "もののけ姫", "genre": "アニメ"}
  ]'

# 検索（タイポ耐性あり）
curl "https://<あなたの FQDN>/indexes/movies/search?q=千と千尋" \
  -H "Authorization: Bearer <MEILI_MASTER_KEY>"
```

`<MEILI_MASTER_KEY>` は前述の `conoha app env set` に渡した値に置き換えてください。ブラウザで `https://<あなたの FQDN>` にアクセスするとミニダッシュボードも確認できます（初回は証明書発行に数十秒かかる場合があります）。

## 関連リンク

- Recipe: [conoha-cli-app-samples/meilisearch](https://github.com/crowdy/conoha-cli-app-samples/tree/main/meilisearch)
- [Meilisearch 公式ドキュメント](https://www.meilisearch.com/docs)
