---
layout: home
hero:
  name: ConoHa CLI
  text: ConoHa VPS3をコマンドラインから操作
  tagline: サーバー作成からアプリデプロイまで、すべてターミナルから
  image:
    src: /banner.svg
    alt: ConoHa CLI
  actions:
    - theme: brand
      text: はじめに
      link: /guide/getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/crowdy/conoha-cli
features:
  - title: かんたんインストール
    details: Go製のシングルバイナリ。ダウンロードしてすぐ使えます。
  - title: アプリデプロイ
    details: Dockerfileがあれば conoha app deploy の一発でデプロイ完了。
  - title: フル機能
    details: サーバー・ネットワーク・DNS・ストレージ・ロードバランサーまで全API対応。
---

## 5ステップでデプロイ

### 1. インストール

```bash
brew install crowdy/tap/conoha-cli
```
```
✓ conoha-cli installed
```

### 2. ログイン

```bash
conoha auth login
```
```
✓ Logged in successfully
```

### 3. キーペアを作成

```bash
conoha keypair create my-key
```
```
✓ Keypair my-key created
```

### 4. サーバーを作成

```bash
conoha server create --name my-server \
  --flavor g2l-t-c2m1d100 --image ubuntu-24.04 \
  --key-name my-key --security-group IPv4v6-SSH --wait
```
```
✓ Server my-server is ACTIVE (163.xx.xx.xx)
```

### 5. アプリをデプロイ

```bash
conoha app deploy my-server
```
```
✓ App is running at http://163.xx.xx.xx:3000
```

::: tip 詳しくは
[クイックスタート](/guide/quickstart) で実際の出力を見ながら試せます。
:::
