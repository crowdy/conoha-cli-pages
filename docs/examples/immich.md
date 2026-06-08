# Immich (写真管理) デプロイ

[Immich](https://immich.app/) は Google フォトの完全なセルフホスティング代替です。モバイルアプリ（iOS / Android）からの自動バックアップ、顔認識・被写体検出・地図表示などの ML 機能、タイムラインビュー、アルバム共有をすべて自前の VPS 上で完結させることができます。写真・動画ファイルもメタデータも外部に一切送信されず、XMP メタデータを含む撮影情報はすべて自社管理の PostgreSQL（pgvecto-rs）に保存されます。

Immich は ML 推論・データベース・ジョブキューを内包しており、単純な Web アプリよりも起動が重厚です。`conoha.yml` の `accessories:` パターンを使うことで、blue/green デプロイ時に ML モデルキャッシュ・写真メタデータ・ジョブキューをそのまま維持し、`immich-server` だけをゼロダウンタイムで入れ替えます。

::: tip 本例は proxy モード対応 (`conoha.yml` 同梱)
HTTPS 終端は conoha-proxy が担当します。`accessories: [immich-machine-learning, db, redis]` の 3 サービスが blue/green スロットの外に常駐する仕組みについては [2. conoha.yml](#_2-conoha-yml) で詳しく解説します。
:::

::: tip GPU は不要
`immich-machine-learning` は CPU 推論で動作します。デフォルト設定で顔認識・被写体検出が有効になっています。大規模なライブラリ（数万枚以上）では L4 GPU への移行で ML 処理が大幅に高速化します — GPU 環境の準備については [Ollama + Open WebUI (L4 GPU)](/examples/ollama-webui-gpu) の GPU セットアップセクションを参照してください。
:::

## 完成イメージ

- `https://immich.example.com` にアクセスすると写真ライブラリの HTTPS Web UI が表示される
- iOS / Android の公式モバイルアプリからサーバー URL を設定して自動バックアップが始まる
- アップロード後 ML 処理が非同期で走り、顔認識・被写体検出・CLIP テキスト検索が利用できる
- アルバム共有リンクを発行して特定の写真を外部公開できる
- タイムライン・マップ・統計ビューで撮影情報を整理閲覧できる
- XMP メタデータ（撮影日時・GPS 座標・カメラ機種など）が保持され検索・絞り込みに使える

## 前提条件

- ConoHa CLI がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- サーバーが作成済み — **RAM 5GB 以上推奨**（`g2l-t-8` など）。`db` + `immich-machine-learning` + `immich-server` + `redis` が同時に常駐するため、他のサンプルより重いです（[サーバー管理](/guide/server)）
- DNS A レコード 1 件（`immich.example.com`）をサーバー IP に向けていること（[DNS / TLS](/guide/dns-tls)）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）
- **ディスク容量の事前計画が重要** — 写真ライブラリは際限なく成長します。10GB からスタートしても数百 GB に達することはよくあります。テスト用なら Docker 管理ボリューム（デフォルト）で始められますが、本番運用では ConoHa の追加ブロックストレージを VPS にアタッチして専用マウントポイントを確保することを推奨します。`UPLOAD_LOCATION` を絶対パスで指定する手順は [環境変数](#_3-環境変数-env) を参照してください

## スタック

| 役割 | サービス | 技術 |
|---|---|---|
| Web UI / API | `immich-server` | Immich Server (Next.js + NestJS) |
| ML 推論 | `immich-machine-learning` | Immich ML (CLIP 顔認識・被写体検出) |
| データベース | `db` | tensorchord/pgvecto-rs pg16 — PostgreSQL + ベクトル拡張 |
| ジョブキュー | `redis` | Redis 7-alpine |
| HTTPS / リバースプロキシ | conoha-proxy | Let's Encrypt 自動 TLS |

## 1. compose.yml

完全版は [`immich/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/immich/compose.yml)。重要部分を抜粋します。

```yaml
services:
  immich-server:
    image: ghcr.io/immich-app/immich-server:v1.131.3
    # No host-side port: conoha-proxy injects a randomly-bound
    # 127.0.0.1:0:2283 mapping at deploy time so two slots (blue/green)
    # can coexist. Publishing explicitly here would conflict.
    expose:
      - "2283"
    environment:
      - DB_HOSTNAME=db
      - DB_USERNAME=immich
      - DB_PASSWORD=${DB_PASSWORD:?required}
      - DB_DATABASE_NAME=immich
      - REDIS_HOSTNAME=redis
    volumes:
      - immich_uploads:/usr/src/app/upload
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped

  immich-machine-learning:
    image: ghcr.io/immich-app/immich-machine-learning:v1.131.3
    volumes:
      - immich_ml_cache:/cache
    restart: unless-stopped

  db:
    image: tensorchord/pgvecto-rs:pg16-v0.4.0
    environment:
      - POSTGRES_USER=immich
      - POSTGRES_PASSWORD=${DB_PASSWORD:?required}
      - POSTGRES_DB=immich
      - POSTGRES_INITDB_ARGS=--data-checksums
    volumes:
      - immich_db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U immich"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - immich_redis:/data

volumes:
  immich_uploads:
  immich_ml_cache:
  immich_db:
  immich_redis:
```

::: warning `expose` を `ports` にしないこと
proxy モードでは `expose:` を使ってコンテナ側ポートだけを宣言します。`ports:` で公開すると blue/green スロットが衝突します。詳しくは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。
:::

## 2. conoha.yml

```yaml
name: immich
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - immich.example.com
web:
  service: immich-server
  port: 2283
# `immich-machine-learning`, `db` (pgvecto-rs), and `redis` are marked
# as accessories: ML model cache, photo metadata, and the job queue
# all live in their volumes and must not be reset on redeploy.
# Only `immich-server` is duplicated per blue/green slot.
accessories:
  - immich-machine-learning
  - db
  - redis
```

**`immich-machine-learning` を accessory にする理由:** CLIP 顔認識・被写体検出モデルは初回起動時に Hugging Face から数 GB のウェイトをダウンロードします（`immich_ml_cache` ボリュームに保存）。blue/green 切替のたびにコンテナをリセットすると、このダウンロードが毎デプロイ時に再発します。accessory にすることでモデルキャッシュが deploy を跨いで保持され、2 回目以降のデプロイで ML サービスは即座に起動します。CPU 推論のため、大量の写真がある場合は ML ジョブが数時間かかることもありますが、キャッシュを保持しておくことで途中状態も維持されます。

**`db`（pgvecto-rs）を accessory にする理由:** `tensorchord/pgvecto-rs` は通常の PostgreSQL に pgvecto-rs ベクトル拡張を組み込んだ専用イメージです。写真メタデータ・タグ・顔 ID・CLIP 埋め込みベクトルをすべて保持します。blue/green 切替でコンテナをリセットすると DB が初期化され、蓄積されたすべての写真メタデータと顔埋め込みが失われます。顔認識の再インデックスは大規模ライブラリで数時間に達することがあり、その間 ML 機能が一切利用できません。accessory として固定することで、`immich-server` のコード変更がある際も DB は温かいまま維持されます。

**`redis` を accessory にする理由:** Redis は Immich のジョブキュー（サムネイル生成・ML 解析・EXIF 抽出など）の状態を保持します。blue/green 切替でコンテナをリセットするとキューに積まれていたジョブが失われ、進行中の写真アップロードや ML 処理が中断されます。`immich-server` のコード変更は `redis` を再起動する必要がないため、ワーカーは中断した場所からジョブを継続して処理します。

## 3. 環境変数 (`.env`)

```bash
# DB_PASSWORD: 必須。デフォルト値はパブリックリポジトリに公開されているため
# 必ず変更してください。
DB_PASSWORD=$(openssl rand -base64 32)

# UPLOAD_LOCATION: 写真ライブラリの保存先。
# デフォルト ./library はテスト用。本番では絶対パスで外部ディスクを指定する。
# 例: ConoHa 追加ブロックストレージを /mnt/photos にマウントした場合
UPLOAD_LOCATION=/mnt/photos/immich

# IMMICH_VERSION: イメージタグ。`release` は moving tag のため
# 再現性のある本番デプロイには特定バージョンを固定することを推奨。
IMMICH_VERSION=v1.131.3

# DB_DATA_LOCATION: Postgres データの保存先。
# UPLOAD_LOCATION と同様、本番では外部ディスク or 専用パスを推奨。
DB_DATA_LOCATION=/mnt/photos/immich-db
```

`conoha app env set` で投入する場合:

```bash
conoha app env set myserver \
  DB_PASSWORD=$(openssl rand -base64 32)
```

`UPLOAD_LOCATION` と `DB_DATA_LOCATION` は `compose.yml` のボリューム設定（`immich_uploads` / `immich_db`）と連動します。Docker 管理ボリュームを使う場合はデフォルトのまま（変数設定不要）で問題ありません。外部マウントポイントに切り替える場合は `compose.yml` のボリューム定義を `bind` マウントに変更してください。

## 4. デプロイ

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/immich

# conoha.yml の hosts: を自分の FQDN に書き換える
$EDITOR conoha.yml

# proxy 起動（サーバーごとに 1 回だけ）
conoha proxy boot --acme-email you@example.com myserver

# アプリ登録（初回のみ）
conoha app init myserver

# DB パスワードを設定（必須 — デフォルト値はパブリックリポジトリに公開されています）
conoha app env set myserver DB_PASSWORD=$(openssl rand -base64 32)

# デプロイ
conoha app deploy myserver
```

**初回デプロイ所要時間:** `immich-server`・`immich-machine-learning`（ML モデル含む）・`tensorchord/pgvecto-rs`・`redis` のイメージ pull と ML モデルキャッシュのダウンロードが重なるため、**初回は 15〜20 分かかります**。`conoha app logs myserver` でダウンロードの進捗を確認できます — 止まっているように見えても大容量ファイルを転送中の可能性が高いです（[ハマりどころ](#ハマりどころ) を参照）。

## 5. 動作確認

```bash
# Immich ヘルスチェック（200 が返れば起動完了）
curl -i https://immich.example.com/api/server/ping
# → {"res":"pong"} が返れば正常
```

ブラウザで `https://immich.example.com` を開くと **管理者アカウント作成フォーム** が表示されます。Immich はメール確認なしで管理者を作成します（デフォルトでは送信メールサーバーが設定されていないため、確認メールは届きません — これは仕様通りです）。

1. 名前・メールアドレス・パスワードを入力して「サインアップ」
2. ライブラリ画面に到達したら、テスト写真を 1 枚ドラッグアンドドロップ
3. アップロード完了後、バックグラウンドで ML ジョブが走り始める（管理コンソール「Jobs」で進捗を確認できる）

## 6. 初期セットアップ (管理者 + クライアント接続)

### 管理者ユーザーの作成

初回アクセス時に表示されるサインアップフォームで作成したユーザーが自動的に管理者になります。2 人目以降は通常ユーザーとして作成され、管理者が「Administration > Users」から権限を変更できます。

### モバイルアプリの設定

1. App Store / Google Play から「Immich」を検索してインストール
2. アプリを開き「サーバー URL」に `https://immich.example.com` を入力
3. 作成した管理者メールアドレス・パスワードでログイン
4. 「バックアップ」設定を開き、自動バックアップを有効化（Wi-Fi のみ推奨）

### デスクトップクライアント（任意）

Immich は Windows / macOS / Linux 向けデスクトップクライアントを公式提供しています。[immich.app/docs/features/bulk-upload](https://immich.app/docs/features/bulk-upload) から取得し、同じサーバー URL・認証情報で接続できます。既存の大量の写真を一括インポートする際に便利です。

### 最初の写真アップロード

Web UI からのドラッグアンドドロップ、モバイルアプリの自動バックアップ、デスクトップクライアントによる一括インポートのいずれかでアップロードできます。アップロード後、「Administration > Jobs」画面で以下のジョブが自動的にキューに積まれます:

- **EXIF 抽出** — 撮影日時・GPS・カメラ機種の読み取り
- **サムネイル生成** — タイムライン表示用の縮小版
- **ML 解析** — 顔認識・被写体検出（`immich-machine-learning` が担当）

## カスタマイズ

### ストレージバックエンドの変更

デフォルトは Docker 管理ボリューム（`immich_uploads`）です。本番運用では以下の選択肢を検討してください:

- **追加ブロックストレージ（推奨）**: ConoHa コントロールパネルからブロックストレージを作成し VPS にアタッチ。`/mnt/photos` などにマウントして `UPLOAD_LOCATION=/mnt/photos/immich` を設定します
- **S3 互換オブジェクトストレージ**: Immich は S3 互換ストレージへの外部保存をサポートします。管理 UI の「Administration > Storage Template > External Library」から設定できます（詳細: [immich.app/docs/administration/storage-template](https://immich.app/docs/administration/storage-template)）

### ML モデルの変更

Immich は CLIP モデルを差し替えることで検索精度・速度をトレードオフできます。`immich-machine-learning` サービスの環境変数でモデルを指定します:

```yaml
immich-machine-learning:
  environment:
    - IMMICH_MACHINE_LEARNING_CLIP_MODEL=XLM-Roberta-Large-Vit-B-16Plus
```

利用可能なモデル一覧と各モデルの精度・速度比較は [immich.app/docs/features/ml-clip](https://immich.app/docs/features/smart-search) を参照してください。`immich-machine-learning` は accessory のため、モデル変更後は `conoha app deploy` だけでは反映されません — サーバー上で `docker compose up -d immich-machine-learning` を手動実行してください。

### L4 GPU による ML 高速化

大規模ライブラリ（数万枚以上）では CPU 推論がボトルネックになります。L4 GPU フレーバーへの移行と GPU ドライバーのセットアップについては [Ollama + Open WebUI (L4 GPU)](/examples/ollama-webui-gpu) を参照してください。GPU 利用時は `immich-machine-learning` サービスに `deploy.resources.reservations.devices` を追加します。

### OIDC / OAuth2 によるシングルサインオン

Immich は OIDC をサポートしており、管理 UI の「Administration > Authentication > OAuth」から設定できます。Google・Keycloak・Authentik など OIDC に対応した IdP と連携できます。OIDC 設定後も既存のローカルアカウントは継続利用できます（詳細: [immich.app/docs/administration/oauth](https://immich.app/docs/administration/oauth)）。

## ハマりどころ

### ML 初回ダウンロードが巨大

`immich-machine-learning` は初回起動時に Hugging Face から CLIP モデルを複数ダウンロードします（合計数 GB）。このダウンロードが完了するまで ML 機能は利用できませんが、**デプロイ自体は正常に進んでいます**。

```bash
# ML サービスのダウンロード進捗を確認
docker compose logs immich-machine-learning -f
```

ダウンロード完了後、`immich_ml_cache` ボリュームにモデルが永続化されるため、以降のデプロイではモデルキャッシュが再利用され再ダウンロードは発生しません。`healthcheck` に `start_period` が設定されていない場合、ダウンロード中に unhealthy 判定されることがあります。

### `db` の pgvecto-rs は通常の PostgreSQL ではない

`tensorchord/pgvecto-rs:pg16-v0.4.0` は pgvecto-rs ベクトル拡張が組み込まれた専用イメージです。通常の `postgres:16-alpine` に差し替えると Immich の起動時に拡張ロードが失敗してクラッシュします。

バックアップ・リストア時も注意が必要です — `pg_dump` で取得したダンプを `pg_restore` でリストアする際に、リストア先にも `pgvecto-rs` ランタイムが必要です。通常の PostgreSQL 環境ではベクトル型カラムの復元に失敗します。

### 写真ライブラリのディスク計画は事前に

`UPLOAD_LOCATION` のデフォルトは Docker 管理ボリュームです。Immich の設計上、ライブラリサイズに上限はなく、アップロードしたオリジナルファイルに加えてサムネイルや変換済みビデオが同じ場所に保存されます。ConoHa の追加ブロックストレージを `/mnt/photos` にマウントして `UPLOAD_LOCATION=/mnt/photos/immich` に変更することで、VPS の root ディスクをライブラリで枯渇させる問題を回避できます。

### `IMMICH_VERSION=release` は moving tag

`release` は常に最新リリースを指す可変タグです。`IMMICH_VERSION=release` のままデプロイすると、再デプロイのたびに異なるバージョンが起動する可能性があり、再現性のない環境になります。特に Immich はバージョン間で DB マイグレーションが走ることがあるため、意図せずマイグレーションが適用されてロールバックが困難になります。本番では `v1.131.3` のような具体的なバージョンタグを固定してください。アップグレード前は [Immich 公式 Changelog](https://github.com/immich-app/immich/releases) で breaking changes を確認してください。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の immich](https://github.com/crowdy/conoha-cli-app-samples/tree/main/immich)
- 検証記: Qiita — *公開後にリンク追加*
- Immich: [immich.app](https://immich.app/) / [immich-app/immich](https://github.com/immich-app/immich)
- 関連サンプル:
  - [Ollama + Open WebUI (L4 GPU)](/examples/ollama-webui-gpu) — accessory パターンのペア（single accessory）
  - [音声エージェント (WebRTC + L4 GPU)](/examples/voice-agent-conoha-l4) — マルチアクセサリーパターンのペア（3 accessories）
  - [Outline (OIDC チーム Wiki)](/examples/outline) — Phase 2b ペア
  - [Supabase Self-host](/examples/supabase-selfhost) — DB ヘビーな SaaS ペア
