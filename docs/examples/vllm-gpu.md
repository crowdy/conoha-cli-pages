# vLLM (OpenAI 互換 LLM サーバー) デプロイ

[vLLM](https://github.com/vllm-project/vllm) を NVIDIA L4 GPU の ConoHa VPS にデプロイし、OpenAI 互換 API (`/v1/chat/completions` など) を立てるサンプルです。フロントは Caddy が HTTPS 終端と SSE ストリーミングの面倒を見ます。

::: tip 本例は no-proxy モードで動作します
Caddy が直接 80/443 を握る構成なので `conoha.yml` を持たず、[no-proxy モード](/guide/app-deploy#モードの比較) でデプロイします。HTTPS / blue-green を使う通常の流れは [Hello World](/examples/hello-world) や [Next.js](/examples/nextjs) を参照してください。
:::

## 完成イメージ

- ブラウザの `/docs` で Swagger UI が開き、API キーを入れて対話的に検証できる
- OpenAI Python / TypeScript SDK の `base_url` を差し替えるだけでそのまま叩ける
- Qwen2.5-7B AWQ がデフォルトで、L4 24GB に対し KV キャッシュにも余裕がある
- `stream=true` で SSE 配信、Caddy 側でバッファ・gzip を回避

## 前提条件

- ConoHa CLI がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- **L4 GPU フレーバー**（`g2l-*-l4` 系）のサーバーが作成済み
- サーバーに **NVIDIA Container Toolkit と driver が入っている** こと（cloud-init で自動セットアップする例を後述）

## 1. compose.yml

完全版は [`vllm-gpu/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/vllm-gpu/compose.yml)。要点だけ抜粋します。

```yaml
services:
  vllm:
    image: vllm/vllm-openai:v0.20.1
    command:
      - --model
      - ${MODEL_NAME:-Qwen/Qwen2.5-7B-Instruct-AWQ}
      - --gpu-memory-utilization
      - "${GPU_MEMORY_UTILIZATION:-0.90}"
      - --quantization
      - ${QUANTIZATION:-awq_marlin}
      - --served-model-name
      - default
      - --api-key
      - ${VLLM_API_KEY:-}
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:8000/health"]
      start_period: 1200s    # 初回モデル DL の猶予 (Qwen 7B AWQ で約 9GB)

  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    depends_on:
      vllm: { condition: service_healthy }
```

::: warning `start_period` は省略しないこと
初回起動で Qwen 7B AWQ (約 9GB) を DL している途中に healthcheck が走り出すと再起動ループに入ります。`start_period: 1200s`（20 分）以上は確保してください。
:::

`vllm` サービスはホスト側にポートを公開しません（外向きの口は Caddy のみ）。`--api-key` は空文字なら認証 OFF です（vLLM が空文字を falsy 判定）。

## 2. Caddyfile

```caddyfile
{$DOMAIN_NAME} {
	reverse_proxy vllm:8000 {
		flush_interval -1
	}

	# stream=true 時のみ Accept: text/event-stream を見て gzip を外す
	@no_sse {
		not header Accept *text/event-stream*
	}
	encode @no_sse gzip
}
```

`stream=true` の SSE 配信を壊さないように 2 点配慮しています。

1. `flush_interval -1` で reverse_proxy のレスポンスバッファを切る (write 即 flush)
2. `Accept: text/event-stream` リクエストには gzip を外す

`DOMAIN_NAME` を `:80` のままにすれば HTTP-only、実 FQDN を入れれば Caddy が Let's Encrypt の証明書を自動発行します。

## 3. .env

```bash
MODEL_NAME=Qwen/Qwen2.5-7B-Instruct-AWQ
QUANTIZATION=awq_marlin    # MODEL_NAME に揃える (FP16 モデルなら none)
VLLM_API_KEY=              # 空なら認証 OFF。本番では必ず設定
HF_TOKEN=                  # Llama 系などゲートモデル時のみ
DOMAIN_NAME=:80            # 実 FQDN を入れると Caddy が自動 TLS
```

## 4. NVIDIA セットアップ (cloud-init)

ConoHa の `vmi-docker-29.2-ubuntu-24.04-amd64` イメージは Docker は入っていますが、NVIDIA driver と Container Toolkit は入っていません。サーバー作成時の `--user-data` で以下のスクリプトを渡しておくと、初回ブート時にまとめて準備できます。

```bash
#!/bin/bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

# NVIDIA Container Toolkit のリポジトリ
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
apt-get update
apt-get install -y nvidia-container-toolkit ubuntu-drivers-common

# headless GPU driver
ubuntu-drivers install --gpgpu

# docker に nvidia runtime を登録
nvidia-ctk runtime configure --runtime=docker
systemctl restart docker

# kernel module 反映のため再起動
shutdown -r +1
```

::: warning `nvidia-smi` が見つからない時
`ubuntu-drivers install --gpgpu` が入れる `nvidia-headless-no-dkms-XXX-server-open` には `nvidia-smi` が含まれません。確認用には別途 `apt-get install -y nvidia-utils-XXX-server` を入れてください（`XXX` は driver シリーズ番号）。
:::

サーバー作成例:

```bash
conoha server create \
  --name vllm-gpu-test \
  --flavor 1ff846c5-... \    # g2l-t-c4m16g1-l4 (4 vCPU / 16GB / L4)
  --image  722c231f-... \    # vmi-docker-29.2-ubuntu-24.04-amd64
  --key-name <YOUR_KEY> \
  --security-group <YOUR_SG> \
  --user-data /tmp/vllm-gpu-cloudinit.sh \
  --no-input --wait
```

## 5. デプロイ

cloud-init 完了後、`compose.yml` のあるディレクトリで:

```bash
conoha app deploy <サーバー名> --app-name vllm-gpu --no-proxy
```

::: tip `--no-proxy` は必須
本サンプルは `conoha.yml` を持たないため、付けないと

```
read conoha.yml: open conoha.yml: no such file or directory
```

で蹴られます。詳しくは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。
:::

ログに `vllm-gpu-vllm-1 Healthy` が出れば OK。初回はモデル DL 込みで 5–15 分ほどかかります。

## 6. 動作確認

### smoke-test

3 つの主要エンドポイントを一気に検証します（[`scripts/smoke-test.sh`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/vllm-gpu/scripts/smoke-test.sh)）。

```bash
BASE_URL=http://<サーバーIP> \
VLLM_API_KEY=<キー> \
bash vllm-gpu/scripts/smoke-test.sh
# [1/3] GET .../v1/models                 ok
# [2/3] POST .../v1/chat/completions     ok
# [3/3] POST .../v1/completions          ok
```

### Swagger UI でブラウザ検証

vLLM は内部で FastAPI を使っており、`/docs` に Swagger UI が自動マウントされます。ブラウザで `http://<サーバーIP>/docs` を開くと、

1. 右上の **Authorize** ボタンに `VLLM_API_KEY` の値だけを入れる（`Bearer ` 接頭辞は自動付与）
2. `/v1/chat/completions` の **Try it out** にリクエストを貼って `Execute`

```json
{
  "model": "default",
  "messages": [{"role": "user", "content": "こんにちは"}],
  "max_tokens": 200,
  "stream": false
}
```

`stream` を `true` にすると SSE で chunk が逐次表示されます。Caddy の `flush_interval -1` と `@no_sse` マッチャが正しく効いているかの確認はこの画面で完結します。

### 認証なしで開いている公開エンドポイント

| パス | 認証 | 用途 |
|---|---|---|
| `/health` | 不要 | liveness probe (HTTP 200 のみ) |
| `/docs` | 不要（呼び出し時は要） | Swagger UI |
| `/openapi.json` | 不要 | OpenAPI 3.1 スキーマ |
| `/v1/*` | 必要 (Bearer) | 推論エンドポイント |

`/openapi.json` は LangChain や TypeScript の OpenAPI クライアント生成にそのまま流せます。

## モデルを変更する

`.env` の `MODEL_NAME` を切り替えます。

| モデル | 必要 GPU | メモ |
|---|---|---|
| `Qwen/Qwen2.5-7B-Instruct-AWQ` | L4 24GB | デフォルト、AWQ INT4 で約 9GB |
| `Qwen/Qwen2.5-32B-Instruct-AWQ` | L4 24GB / 24GB+ | 上限ギリギリ、`MAX_MODEL_LEN` を下げる |
| `meta-llama/Llama-3.1-8B-Instruct` | L4 24GB | FP16, `HF_TOKEN` 必要、`QUANTIZATION=none` |
| `google/gemma-2-9b-it` | L4 24GB | FP16, `HF_TOKEN` を要する場合あり、`QUANTIZATION=none` |

::: warning `QUANTIZATION` を MODEL_NAME に揃える
非 AWQ モデル (Llama / Gemma など FP16) に切り替える時は `QUANTIZATION=none` に **必ず** 変えてください。`awq_marlin` のままだと vLLM 起動時にコケます。
:::

変更後は再デプロイで反映されます。

```bash
conoha app deploy <サーバー名> --app-name vllm-gpu --no-proxy
```

## HTTPS を有効にする

DNS で `vllm.example.com` をサーバー IP に向け、`.env` で:

```bash
DOMAIN_NAME=vllm.example.com
```

セキュリティグループで 443 を開けて再デプロイすれば Caddy が Let's Encrypt 証明書を自動発行します。

## API キーで保護

```bash
VLLM_API_KEY=$(openssl rand -hex 32)
```

`/v1/*` への全リクエストに `Authorization: Bearer <key>` が必須になります。`/health`、`/docs`、`/openapi.json` は認証対象外です。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の vllm-gpu](https://github.com/crowdy/conoha-cli-app-samples/tree/main/vllm-gpu)
- 検証記: [Qiita — ConoHa L4 GPU に OpenAI 互換 vLLM サーバーをデプロイ](https://qiita.com/crowdy/items/c62b19ae232f03f42218)
- vLLM 公式: [vllm-project/vllm](https://github.com/vllm-project/vllm)
- Caddy `encode`: [https://caddyserver.com/docs/caddyfile/directives/encode](https://caddyserver.com/docs/caddyfile/directives/encode)
