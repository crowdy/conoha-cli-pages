# Slurm REST API (シングルノード HPC クラスタ) デプロイ

[Slurm](https://slurm.schedmd.com/) のシングルノードクラスタを ConoHa VPS (L4 GPU フレーバー) にデプロイし、JWT 認証付き REST API (`slurmrestd`) 経由でジョブを投入・監視するサンプルです。`slurmrestd` は `/openapi/v3` を含む全エンドポイントに JWT を要求するため、conoha-proxy の素の 2xx ヘルスチェックには応答できません。そこで薄い Caddy サイドカー `slurm-edge` を web サービスとして手前に置き、`/healthz` だけを認証なしで返しつつ、それ以外は `slurmrestd` へそのまま転送します。

CPU パーティションと GPU パーティション (L4) を単一ホスト上で共存させ、同じ REST API から CPU ジョブと CUDA ジョブの両方をスケジュールできる構成になっています。

## 完成イメージ

- `https://slurm.example.com/slurm/v0.0.42/...` に JWT 認証付き REST API としてアクセス可能
- `/healthz` は認証不要で 200 を返し、conoha-proxy のヘルスチェック対象になる
- `cpu` と `gpu` の2パーティションが同一 L4 ホスト上で稼働し、両方に同じ API からジョブを投入できる
- Python CLI (`examples/cli/slurm_cli.py`) でジョブの submit / status / cancel / history を操作できる
- NumPy 行列積・sklearn アレイジョブ (cpu) と torch CUDA チェック (gpu) の実行サンプル付き

## 前提条件

- ConoHa CLI がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- **L4 GPU フレーバー `g2l-t-c20m128g1-l4`**（20 vCPU / 128GB RAM / L4 24GB）のサーバーが作成済み（[サーバー管理](/guide/server)）— このサンプルは重量級で、`gpu-worker` が常時 GPU を占有するため CPU-only フレーバーでは起動しません
- サーバーに **NVIDIA Container Toolkit とドライバ** が入っていること（`conoha gpu setup` で自動セットアップ可能）
- ドメイン（例: `slurm.example.com`）の A レコードを VPS の IP に向け、conoha-proxy がブート済み（[DNS / TLS](/guide/dns-tls)、[conoha-proxy セットアップ](/guide/proxy-setup)）

## デプロイ手順

```bash
# 1. サンプルを取得
git clone https://github.com/crowdy/conoha-cli-app-samples.git
cd conoha-cli-app-samples/slurm-rest-api

# 2. NVIDIA Container Toolkit + ドライバをセットアップ（初回のみ、再起動あり）
conoha gpu setup <サーバー名> --identity ~/.ssh/conoha_mykey

# 3. .env を用意（SLURM_DB_PASSWORD / MARIADB_ROOT_PASSWORD を設定。使用可能文字は [A-Za-z0-9_-] のみ）
cp .env.example .env

# 4. conoha.yml の hosts: を自分の FQDN に書き換える
#    hosts:
#      - slurm.example.com

# 5. 初期化してデプロイ
conoha app init <サーバー名>
conoha app deploy <サーバー名>
```

`conoha.yml` はサンプルに同梱済み（抜粋、コメントは原文のまま）:

```yaml
name: slurm-rest-api
hosts:
  - slurm.example.com
web:
  # `slurm-edge` is a tiny Caddy sidecar that fronts slurmrestd: it answers
  # GET /healthz with 200 (so the proxy's strict 2xx probe passes) and
  # reverse-proxies everything else to the slurmrestd accessory. slurmrestd
  # itself requires JWT on /openapi/v3, so it can't serve the probe directly.
  service: slurm-edge
  port: 6820
  # The cluster behind the edge is stateful (running jobs, queues, munge
  # key, accounting DB). Pin to a single slot so the volumes don't race —
  # same pattern as outline / gitea / hydra-python-api.
  blue_green: false
health:
  path: /healthz
  # 24 × 5s = 120s, covers: mariadb → slurmdbd → slurmctld → cpu-worker
  # → slurmrestd → slurm-edge.
  unhealthy_threshold: 24
# All Slurm services live in the accessories project so they share the
# named volumes (etc_munge, etc_slurm, var_log_slurm, slurm_jobdir).
# Compose can't share named volumes across projects, which is why
# slurmrestd is NOT the web service here — only the thin caddy edge is.
accessories:
  - mariadb
  - slurmdbd
  - slurmctld
  - cpu-worker
  - gpu-worker
  - slurmrestd
```

`compose.yml` の web サービス定義（抜粋。`mariadb` / `slurmdbd` / `slurmctld` / `cpu-worker` / `gpu-worker` / `slurmrestd` を含む全体は [GitHub の `compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/slurm-rest-api/compose.yml) を参照）:

```yaml
services:
  slurm-edge:
    image: caddy:2-alpine
    expose:
      - "6820"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
    restart: unless-stopped
```

::: tip 設定ポイント

**なぜ `slurm-edge` の Caddy サイドカーが必要か**: conoha-proxy は `/healthz` を厳密な 2xx としてプローブしますが、`slurmrestd` は `/openapi/v3` を含む全エンドポイントで JWT を要求するため、認証なしのプローブに応答できません。上記 `conoha.yml` のコメントの通り、`slurm-edge` が `/healthz` に 200 を返しつつそれ以外を `slurmrestd` へ透過的にリバースプロキシすることで、この矛盾を解決しています。

**なぜ `blue_green: false` か**: `slurm-edge` の背後には稼働中のジョブ・キュー・munge キー・アカウンティング DB を抱えたステートフルなクラスタがあります。`etc_munge` / `etc_slurm` / `var_log_slurm` / `slurm_jobdir` はすべて accessories プロジェクトの named volume として共有されており、複数スロットが同時に存在するとレースの原因になります。そのため単一スロットに固定しています — `outline` / `gitea` / `hydra-python-api` と同じパターンです。

**JWT 認証フロー**: トークンは SSH 経由で `scontrol token username=<u> lifespan=<s>` を実行して発行し（同梱の `examples/get-token.sh` がこれをラップ）、リクエストには `X-SLURM-USER-NAME` と `X-SLURM-USER-TOKEN` の2ヘッダーを付与します。`slurmrestd` の JWT プラグインは `Authorization` と `X-SLURM-USER-TOKEN` の両方式が同時に提示されると拒否するため、この構成では意図的に `Authorization` ヘッダーは使いません。

:::

## 動作確認

```bash
# ヘルスチェック（認証不要、slurm-edge が応答）
curl https://slurm.example.com/healthz

# JWTトークンを発行（初回のみ。有効期限は秒単位で指定）
conoha server ssh <サーバー名> -- ./examples/get-token.sh slurm 86400 \
  > ~/.slurm-api/token

# JWT認証付きで OpenAPI スキーマを取得
curl -H "X-SLURM-USER-NAME: slurm" \
     -H "X-SLURM-USER-TOKEN: <PLACEHOLDER>" \
     https://slurm.example.com/openapi/v3 | jq
```

`nodes` エンドポイントで `c1` (cpu パーティション) と `g1` (gpu パーティション、`Gres=gpu:nvidia:1`) がいずれも `IDLE` であれば正常です。

## 関連リンク

- Recipe: [github.com/crowdy/conoha-cli-app-samples/tree/main/slurm-rest-api](https://github.com/crowdy/conoha-cli-app-samples/tree/main/slurm-rest-api)
- [Slurm REST API (slurmrestd) 公式ドキュメント](https://slurm.schedmd.com/rest.html)
- [Outline](/examples/outline) — 同じ `blue_green: false` パターン
- [Gitea](/examples/gitea) — 同じ `blue_green: false` パターン
- [Hydra Python API](/examples/hydra-python-api) — 同じ `blue_green: false` パターン
- [vLLM (GPU)](/examples/vllm-gpu) — 別の L4 GPU サンプル
