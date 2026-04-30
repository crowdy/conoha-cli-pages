# ConoHa CLI Documentation

![ConoHa CLI](docs/public/banner.svg)

[`conoha-cli`](https://github.com/crowdy/conoha-cli) 公式ドキュメントサイトのソース。VitePress で構築し、GitHub Pages にデプロイされます。

**サイト**: https://crowdy.github.io/conoha-cli-pages/

## 対応言語

- 日本語 (デフォルト): `/`
- English: `/en/`
- 한국어: `/ko/`

## 開発

```bash
npm install
npm run docs:dev      # 開発サーバー起動 (hot reload)
npm run docs:build    # 本番ビルド → docs/.vitepress/dist/
npm run docs:preview  # 本番ビルドのプレビュー
```

## ディレクトリ構成

```
docs/
├── .vitepress/config/   # VitePress 設定 (shared / ja / en / ko)
├── guide/               # ハウツーガイド
├── examples/            # フレームワーク・アプリのデプロイ例
├── reference/           # CLI コマンドリファレンス
└── public/              # 静的アセット
```

サイドバーの構成は `docs/.vitepress/config/{ja,en,ko}.ts` に定義されています。ページや項目を追加する場合は 3 ファイルすべてを更新してください。

## 関連リポジトリ

- CLI 本体: https://github.com/crowdy/conoha-cli
- アプリサンプル集: https://github.com/crowdy/conoha-cli-app-samples

## デプロイ

`main` への push で GitHub Actions が自動的にビルド・デプロイします (`.github/workflows/`)。PR の段階でビルドが通ること (`npx vitepress build docs`) を確認してください。

## ライセンス

ドキュメントの内容については各リポジトリのライセンスに準じます。
