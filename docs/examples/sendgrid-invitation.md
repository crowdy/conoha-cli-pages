# SendGrid 招待メール デプロイ

組織の管理者がメンバー候補に招待メールを送るシンプルな Web アプリを ConoHa VPS にデプロイする手順です。Next.js の招待フォームで宛先・名前・メッセージを受け取り、FastAPI が SendGrid 経由でメールを送信します。本例は proxy モード（blue/green + Let's Encrypt HTTPS）で公開し、nginx がフォーム全体に Basic Auth をかけます。

## 完成イメージ

- `https://<あなたの FQDN>/` に Basic Auth 付きでアクセス可能
- 招待フォームに宛先メール・名前・メッセージを入力すると SendGrid 経由でメールが届く
- nginx が Next.js（frontend）と FastAPI（backend）をリバースプロキシ
- `conoha app deploy` で blue/green 切り替え（ただし対象範囲に注意点あり、後述）

## 前提条件

- ConoHa CLI がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み（[`--for proxy` プリセット推奨](/guide/server#プリセット-for)）
- 公開したい FQDN の DNS A レコードがサーバー IP を指している（[DNS / TLS](/guide/dns-tls)）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）
- SendGrid アカウントと Mail Send 権限の API キー、認証済みの送信元メールアドレス

## デプロイ手順

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples.git
cd conoha-cli-app-samples/sendgrid-invitation
```

`conoha.yml` の `hosts:` を自分の FQDN に書き換えます。

```yaml
name: sendgrid-invitation
hosts:
  - <あなたのFQDN>          # 例: invite.example.com（サンプルで設定済みのドメイン名から変更）
web:
  service: nginx
  port: 80
# `frontend` (Next.js) and `backend` (FastAPI) are accessories — the
# in-container nginx proxies to them on the compose network. NOTE:
# only `nginx` is duplicated per blue/green slot. Code changes to
# frontend/backend ride on whatever build the slot was created with;
# the inner services are *not* re-rolled on a fresh `app deploy`. If
# you need separate blue/green for the inner services, structure them
# as their own conoha.yml projects fronted directly by conoha-proxy.
accessories:
  - frontend
  - backend
```

```bash
# nginx の Basic Auth 用パスワードファイルを作成（apt install apache2-utils 等）
htpasswd -c nginx/.htpasswd admin

# アプリ登録（初回のみ）
conoha app init <サーバー名>

# backend が読む SendGrid 資格情報を設定（必須 — 未設定だと送信時にエラーになります）
conoha app env set <サーバー名> \
  SENDGRID_API_KEY=${SENDGRID_API_KEY:?required} \
  FROM_EMAIL=<認証済み送信元メールアドレス> \
  FROM_NAME=<組織名>

# デプロイ
conoha app deploy <サーバー名>
```

::: tip 設定ポイント

**SendGrid API キーは `${SENDGRID_API_KEY:?required}` で必須化する** — `backend` サービスの `compose.yml` は元々 `SENDGRID_API_KEY=${SENDGRID_API_KEY:-}` のように未設定時は空文字へフォールバックし、アプリ側でエラーを表面化させる設計です。本ドキュメントではさらに明示的に `:?required` としています。いずれにせよ API キーを `conoha.yml` や compose.yml に平文で書かず、`conoha app env set` 経由で渡してください。

**web は nginx のみ、frontend/backend は accessory** — `conoha.yml` の `web.service` は `nginx` だけで、`frontend`（Next.js）と `backend`（FastAPI）は `accessories` です。上記 `conoha.yml` のコメントの通り、`conoha app deploy` で blue/green 再作成されるのは nginx だけで、frontend/backend のイメージは再ビルドされません。つまりフォームの見た目や API ロジックを変更しても、それだけでは新スロットに反映されないということです。frontend/backend のコードを更新したい場合は、コメントにある通り「structure them as their own conoha.yml projects fronted directly by conoha-proxy」——つまり frontend/backend をそれぞれ独立した `conoha.yml` プロジェクトとして conoha-proxy 直下に並べる構成に書き換えてください。
:::

## 動作確認

1. ブラウザで `https://<あなたのFQDN>/` にアクセス（初回は証明書発行に数十秒かかることがあります）
2. Basic Auth のユーザー名・パスワードを入力
3. 招待フォームに宛先メール・名前・メッセージを入力して送信
4. 宛先に SendGrid からの招待メールが届くことを確認

```bash
conoha app status <サーバー名>
conoha app logs <サーバー名>
```

## 関連リンク

- [Recipe: sendgrid-invitation](https://github.com/crowdy/conoha-cli-app-samples/tree/main/sendgrid-invitation)
- [SendGrid API キーの作成](https://docs.sendgrid.com/ui/account-and-settings/api-keys)
- [Next.js デプロイ（proxy モード）](/examples/nextjs)
- [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較)
