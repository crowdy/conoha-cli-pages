# Top Page CLI Demo Section Design

## Overview

既存のトップページ (hero + feature カード) の下に、CLI の使い方を5ステップで見せるデモセクションを追加する。目的は「こんなに簡単にデプロイできる」というインパクトを初見ユーザーに伝えること。

## Design Decisions

- **配置**: 既存の hero + feature カードはそのまま維持。その下に追加
- **ステップ数**: 5 (インストール → ログイン → キーペア → サーバー作成 → デプロイ)
- **スタイル**: 各ステップに番号付き見出し + 一言説明 + コマンド + 最小出力 (1〜2行)
- **出力の詳細度**: 最小限。成功メッセージのみ。詳細はクイックスタートへ誘導
- **実装方法**: `docs/index.md` の frontmatter 後に Markdown で直接記述。VitePress の `layout: home` は frontmatter 後の Markdown を feature カードの下にレンダリングする。カスタム CSS・コンポーネント不要

## Content

```markdown
## 5ステップでデプロイ

### 1. インストール

$ brew install crowdy/tap/conoha-cli
✓ conoha-cli installed

### 2. ログイン

$ conoha auth login
✓ Logged in successfully

### 3. キーペアを作成

$ conoha keypair create my-key
✓ Keypair my-key created

### 4. サーバーを作成

$ conoha server create --name my-server --wait
✓ Server my-server is ACTIVE (163.xx.xx.xx)

### 5. アプリをデプロイ

$ conoha app deploy my-server
✓ App is running at http://163.xx.xx.xx:3000
```

末尾にクイックスタートへのリンクを配置。

## Scope

- `docs/index.md` の変更のみ
- 新規ファイル・コンポーネント・CSS の追加なし
- 他ページへの影響なし
