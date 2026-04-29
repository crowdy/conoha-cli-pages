# アプリデプロイ

`conoha app` は同一 VPS 上で共存可能な 2 つのデプロイモードを提供します。`app init` 時にサーバー側マーカー (`/opt/conoha/<name>/.conoha-mode`) が書かれ、以降の `deploy` / `status` / `logs` / `stop` / `restart` / `destroy` / `rollback` は自動的にそのモードで動作するため、2 回目以降はモードフラグを再指定する必要はありません。

## モードの比較

|  | proxy (blue/green) | no-proxy (flat) |
|---|---|---|
| 既定 | ✓ |  |
| 用途 | 公開アプリ + HTTPS | テスト・社内・非HTTP |
| `conoha.yml` | 必要 | 不要 |
| `conoha proxy boot` | 必要 | 不要 |
| DNS | 必要 | 不要 |
| TLS | Let's Encrypt 自動 | 自前で |
| レイアウト | `/opt/conoha/<name>/<slot>/` | `/opt/conoha/<name>/` |
| rollback | ✓ (drain 窓内) | × |

## proxy モード

[conoha-proxy](https://github.com/crowdy/conoha-proxy) が Let's Encrypt HTTPS、Host ヘッダールーティング、drain 窓内の即時ロールバックを提供します。proxy 自体のセットアップは [conoha-proxy セットアップ](/guide/proxy-setup) を参照してください。

### conoha.yml の作成

レポジトリルートに `conoha.yml` を置きます。

```yaml
name: myapp                   # DNS-1123 ラベル (小文字英数字とハイフン、1-63 文字)
hosts:
  - app.example.com           # 複数指定可、重複不可
web:
  service: web                # compose ファイル内のサービス名と一致必須
  port: 8080                  # コンテナ側のリッスンポート (1-65535)
# --- 以下は任意 ---
compose_file: docker-compose.yml   # 未指定時は conoha-docker-compose.yml → docker-compose.yml → compose.yml の順で自動検出
accessories: [db, redis]           # web と同じネットワークに接続する副次サービス
health:
  path: /healthz
  interval_ms: 1000
  timeout_ms: 500
  healthy_threshold: 2
  unhealthy_threshold: 3
deploy:
  drain_ms: 5000                   # 旧スロットを落とすまでの drain 窓 (ミリ秒、未指定時は 30000)
```

### proxy をブートしてアプリを登録

```bash
# 1. proxy コンテナを VPS にブート (既に済んでいればスキップ)
conoha proxy boot my-server --acme-email ops@example.com

# 2. DNS の A レコードを VPS の IP に向ける
#    (DNS が VPS を指していないと app init 自体は成功しても証明書発行が失敗し、
#     ブラウザは TLS ハンドシェイク段階で接続失敗を表示します)

# 3. アプリを proxy に登録してデプロイ
conoha app init my-server
conoha app deploy my-server
```

ロールバック (drain 窓内のみ、旧スロットへ即時戻し):

```bash
conoha app rollback my-server
```

### slot の自動 suffix

`--slot <id>` で slot ID を固定できます。規則は `[a-z0-9][a-z0-9-]{0,63}`、既定は git short SHA または timestamp。

`--slot` を省略した場合、既定値が既存の compose プロジェクトと衝突したら CLI が自動で `-2` / `-3` と suffix を付けて衝突を回避します。drain 中のスロットを破壊的に上書きすることはありません。`--slot` を明示的に再利用したときだけ作業ディレクトリを削除してから再展開します。

### multi-host / expose ブロック

ルートと別ホスト名で公開したいサブドメイン (Dex / admin UI / webhook 受信など) は `expose:` ブロックで宣言できます。各ブロックは独立した proxy service (`<name>-<label>`) として登録されます。

```yaml
name: gitea
hosts: [gitea.example.com]
web:
  service: gitea
  port: 3000
expose:
  - label: dex                    # proxy service name サフィックス (<name>-<label>)
    host: dex.example.com         # hosts[] 重複不可 / 他 expose とも重複不可
    service: dex                  # compose service 名 (accessories / web.service と排他)
    port: 5556
    blue_green: false             # true (既定) なら slot 回転対象、false はアクセサリ扱い (単発起動)
accessories: [db]
```

- `app status <server>` はルートと各 expose ブロックを 1 表にまとめ、`--format json` で `{root, expose: [...]}` を返します。
- `app rollback <server>` は既定でルート → expose 逆順で全ブロックをロールバックします。`--target=<label>` (または `--target=web`) で個別指定も可能。drain 窓が閉じているブロックは警告のみでスキップされ、残りのブロックは継続して処理されます。
- 旧 CLI (< v0.6.0) は `expose:` を silently 無視します。multi-host を使う場合は CI で CLI の最低バージョンを v0.6.0 以上に固定してください。

## no-proxy モード

`conoha.yml` / proxy / DNS が不要な最短経路。`docker compose up -d --build` をリモートで叩くのと等価で、TLS / Host ベースルーティングが不要なケース (テスト、社内ツール、非 HTTP サービス、ホビー用途) に向きます。

```bash
# 初期化 (Docker / Compose の存在を検証してマーカーを書き込む。インストールは行わない)
conoha app init my-server --app-name myapp --no-proxy

# デプロイ (カレントディレクトリを tar 転送 → /opt/conoha/myapp/ に展開 → docker compose up -d --build)
conoha app deploy my-server --app-name myapp --no-proxy
```

`init` 時にマーカーが書かれるので、以降の `status` / `logs` / `stop` / `restart` / `destroy` はモードを再指定する必要はありません。

::: warning Docker は事前導入が必要
no-proxy `app init` は Docker / Compose の存在を **検証するだけ** でインストールはしません。Docker 未導入の VPS では `conoha server create --user-data ./install-docker.sh` 等で事前にインストールしてください。
:::

再デプロイ時の tar 展開は **上書きのみ** 行い、リポジトリから消したファイルはサーバー上に残り続けます (`.env.server` や名前付きボリュームの bind mount を守るため意図的にそうしています)。古いファイルを掃除する場合は `ssh <server> rm /opt/conoha/<name>/<path>` で個別に削除してください。

no-proxy モードには blue/green swap が存在しないため、`rollback` は利用できません (実行すると `rollback is not supported in no-proxy mode` エラー)。履歴から戻したい場合は該当コミットを checkout して `deploy` し直してください。

## モードの切り替え

既存のアプリのモードを変更するには、一度破棄してから反対のモードで再 `init` します。

```bash
conoha app destroy my-server --app-name myapp          # マーカーとディレクトリを削除
conoha app init my-server --app-name myapp --no-proxy  # 反対モードで再初期化
```

同一 VPS 上で `<app-name>` が異なれば proxy / no-proxy を並列に共存させられます。

## 環境変数

`conoha app env set` は両モードで動作してサーバー側の `/opt/conoha/<app>.env.server` に書き込みますが、**現状 `app env` による値の反映はデプロイ時 `.env` 合成を行う no-proxy モードでのみ有効です**。proxy モードで `app env set` すると `warning: app env has no effect on proxy-mode deployed slots; see #94 for the redesign` が出ます ([#94](https://github.com/crowdy/conoha-cli/issues/94) で再設計予定)。proxy モードでは当面 compose ファイルの `environment:` / `env_file:` でアプリ設定を渡してください。

詳細は [アプリ管理](/guide/app-management) を参照してください。

## 関連ページ

- [conoha-proxy セットアップ](/guide/proxy-setup) — proxy 側のインストール・運用
- [アプリ管理](/guide/app-management) — 環境変数・削除・一覧
- [`app` リファレンス](/reference/app) — フラグ詳細
- [`proxy` リファレンス](/reference/proxy) — proxy コマンドのフラグ詳細
