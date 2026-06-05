# Fish Speech TTS (L4 GPU) デプロイ

[Fish Speech](https://github.com/fishaudio/fish-speech) は Fish Audio が開発するオープンソースの音声合成（TTS）エンジンです。10〜30 秒の参照音声を登録するだけで特定の声を再現する**音声クローニング**機能を持ち、ファインチューニング不要で日本語・英語・韓国語・中国語など多言語に対応します。本サンプルは **NVIDIA L4 GPU** の ConoHa VPS 上に Fish Speech をデプロイし、Gradio WebUI で音声クローニング TTS を試せる環境を構築します。

デプロイするコンテナは Gradio UI（ポート 7860）と REST API（ポート 8080）の 2 ポートを公開しますが、`conoha-proxy` が外部に公開できる HTTP ポートは `web:` ブロックごとに 1 つだけです。そのため Gradio UI のみ HTTPS で外部公開し、REST API はコンテナネットワーク内に留めます。REST API を使う場合はサーバーに SSH でログインしてコンテナ内から実行してください。バッチ処理や自動化を目的とした**Go 製 CLI クライアント**が同梱されており、`--server http://localhost:8080` でコンテナ内から直接呼び出せます。

::: tip 本例は proxy モード対応 (`conoha.yml` 同梱)
HTTPS 終端は conoha-proxy が担当します。`web.port: 7860` で Gradio UI を外部公開します。REST API（8080）は意図的に内部専用です。`web:` ブロックと proxy モードについては [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。
:::

## 完成イメージ

- `https://fish-speech-tts-gpu.example.com` を開くと Fish Speech の Gradio WebUI が HTTPS で表示される
- 参照音声（WAV / MP3）とそのテキストをアップロードして「Generate」を押すと、クローンされた声で読み上げた WAV がダウンロードできる
- SSH でサーバーにログインし、コンテナ内の Go CLI から REST API を呼び出してバッチ TTS をスクリプト化できる
- 複数の参照音声をライブラリとして登録・管理し、生成時に `--ref <名前>` で切り替えられる
- 生成済み音声は `.wav`（または mp3 / opus）でダウンロード

## 前提条件

- ConoHa CLI がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- **L4 GPU フレーバー**（`g2l-t-c20m128g1-l4` など `g2l-*-l4` 系）のサーバーが作成済み（[サーバー管理](/guide/server)）
- DNS A レコードをサーバー IP に向けている（[DNS / TLS](/guide/dns-tls)）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）
- サーバーに **NVIDIA Container Toolkit と driver が入っている** こと（cloud-init で自動セットアップする例を後述）
- **SSH アクセス**が可能なこと（REST API をコンテナ内から呼び出すために必要）
- Go ≥ 1.23（CLI クライアントをローカルでビルドする場合のみ。VPS 上でビルドする場合は VPS 側に Go をインストールしてください）

## スタック

| コンポーネント | 役割 |
|---|---|
| **Fish Speech** (`fishaudio/fish-speech:latest-webui-cuda`) | TTS エンジン + Gradio WebUI + REST API |
| **Gradio WebUI** (ポート 7860) | ブラウザから参照音声をアップロード・TTS 生成 |
| **REST API** (ポート 8080) | `/v1/tts` など — コンテナネットワーク内専用 |
| **Go CLI クライアント** (`cli/`) | REST API のバッチ呼び出し・音声クローニング管理 |
| **NVIDIA L4 GPU** (24GB VRAM) | 推論用 GPU（GPU メモリ使用量 ≈ 1.75GB） |
| **conoha-proxy** | Gradio UI の HTTPS 終端 + Let's Encrypt 自動 TLS |

## 1. compose.yml

完全版は [`fish-speech-tts-gpu/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/fish-speech-tts-gpu/compose.yml)。要点を抜粋します。

```yaml
services:
  fish-speech:
    image: fishaudio/fish-speech:latest-webui-cuda
    entrypoint: ["/bin/bash", "/app/custom-entrypoint.sh"]
    # No host-side ports: conoha-proxy injects 127.0.0.1:0:7860 (WebUI)
    # at deploy time. Port 8080 (REST API) stays on the compose network
    # only — inspect it from the VPS via `docker exec` after SSH login.
    expose:
      - "7860"
      - "8080"
    volumes:
      - ./entrypoint.sh:/app/custom-entrypoint.sh:ro
      - model_data:/app/checkpoints
      - references:/app/references
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    environment:
      - COMPILE=1
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 20
      start_period: 600s    # 初回モデル DL の猶予（サンプルで設定済み）
    restart: unless-stopped

volumes:
  model_data:
  references:
```

::: warning `expose` を `ports` にしないこと
proxy モードでは `expose:` を使ってコンテナ側ポートだけを宣言します。`ports:` で公開すると blue/green スロットが衝突します。詳しくは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。
:::

## 2. conoha.yml

```yaml
name: fish-speech-tts-gpu
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - fish-speech-tts-gpu.example.com
web:
  service: fish-speech
  # WebUI (Gradio) port. The container also listens on 8080 for the REST
  # API used by the bundled Go CLI client, but proxy can only front one
  # HTTP port — see README for SSH-tunnel access to the API.
  port: 7860
```

`hosts:` は自分の FQDN に書き換えてください。

**`web.port: 7860` が Gradio UI のみを外部公開する理由:** `conoha-proxy` の `web:` ブロックは 1 アプリにつき 1 HTTP ポートしかルーティングできません。そのため Gradio UI（7860）を外部公開し、REST API（8080）はコンテナネットワーク内に留めています。REST API を外部公開したい場合は別の FQDN + 別の `conoha.yml` で 8080 を `web.port:` に指定する追加プロジェクトが必要です（[ハマりどころ](#ハマりどころ) を参照）。

## 3. NVIDIA セットアップ (cloud-init)

このスクリプトは [vLLM (OpenAI 互換, L4 GPU)](/examples/vllm-gpu) と同じ内容です — L4 GPU 対応の ConoHa VPS であれば共通して利用できます。

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

フレーバー / イメージの UUID は `conoha flavor list` / `conoha image list` で取得してください。

```bash
conoha server create \
  --name fish-speech-tts-gpu-test \
  --flavor 1ff846c5-... \    # g2l-t-c20m128g1-l4 (20 vCPU / 128GB / L4 GPU)
  --image  722c231f-... \    # vmi-docker-29.2-ubuntu-24.04-amd64
  --key-name <YOUR_KEY> \
  --security-group <YOUR_SG> \
  --user-data /tmp/nvidia-cloudinit.sh \
  --no-input --wait
```

## 4. デプロイ

cloud-init 完了後（初回ブートから 5–10 分、`shutdown -r +1` の再起動を含む）、以下の手順でデプロイします。

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/fish-speech-tts-gpu

# conoha.yml の hosts: を自分の FQDN に書き換える
$EDITOR conoha.yml

# proxy がブートしていなければ（サーバーごとに 1 回だけ）
conoha proxy boot --acme-email you@example.com <サーバー名>

# アプリ登録（初回のみ）
conoha app init <サーバー名>

# デプロイ
conoha app deploy <サーバー名>
```

初回デプロイは Fish Speech のモデルをダウンロードするため時間がかかります。`compose.yml` の `start_period: 600s`（サンプルで設定済み）はその猶予です。`conoha app logs <サーバー名>` でダウンロードの進捗を確認してください。healthcheck が `healthy` になってから Gradio WebUI にアクセスしてください。

## 5. 動作確認

### ブラウザで Gradio を使う

`https://fish-speech-tts-gpu.example.com` を開くと Fish Speech の Gradio WebUI が表示されます。初回は Let's Encrypt 証明書発行に数十秒かかる場合があります。

1. **参照音声のアップロード**: 10〜30 秒程度の WAV または MP3 をアップロードし、その音声のテキスト書き起こしを入力
2. **テキスト入力**: 合成したいテキストを「Input Text」フィールドに入力
3. **「Generate」を押す**: 数秒〜数十秒で音声が生成される
4. **ダウンロード**: 生成完了後に表示される WAV をダウンロード

### REST API をコンテナ内から叩く

REST API（8080）はコンテナネットワーク内専用です。サーバーに SSH でログインし、実行中のコンテナ内から `curl` で呼び出してください。

```bash
# サーバーに SSH でログイン
ssh ubuntu@<SERVER_IP>

# コンテナ名を確認
docker ps --filter label=com.docker.compose.service=fish-speech --format '{{.Names}}'

# コンテナ内でヘルスチェック
docker exec <コンテナ名> curl -s http://localhost:8080/v1/health

# テキスト → WAV（コンテナ内で出力ファイルに保存）
docker exec <コンテナ名> \
  curl -s -X POST http://localhost:8080/v1/tts \
  -H 'Content-Type: application/json' \
  -d '{"text": "こんにちは、世界！", "format": "wav"}' \
  -o /tmp/output.wav

# コンテナからホストに WAV をコピー
docker cp <コンテナ名>:/tmp/output.wav ./output.wav
```

### Go CLI クライアントを使う

同梱の Go CLI クライアント（`cli/` ディレクトリ）は REST API（8080）に直接接続します。コンテナネットワーク内から到達できるため、CLI はサーバー上でビルド・実行してください。

```bash
# サーバーに SSH でログイン後、サンプルをクローン（未クローンの場合）
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/fish-speech-tts-gpu/cli

# ビルド（Go 1.23 以上が必要）
go build -o fish-speech-cli .

# ヘルスチェック
./fish-speech-cli health --server http://localhost:8080

# テキスト → WAV ファイルに保存
./fish-speech-cli tts -t "こんにちは、世界！" -o hello.wav --server http://localhost:8080

# 参照音声を登録（音声クローニング）
./fish-speech-cli ref add \
  --name my-voice \
  --file voice.wav \
  --text "音声のテキスト書き起こし" \
  --server http://localhost:8080

# 登録した声でクローニング TTS
./fish-speech-cli tts \
  -t "クローニングされた声で読み上げます" \
  --ref my-voice \
  --server http://localhost:8080 \
  -o cloned.wav

# 参照音声の一覧
./fish-speech-cli ref list --server http://localhost:8080

# 参照音声の削除
./fish-speech-cli ref delete --name my-voice --server http://localhost:8080
```

全サブコマンド: `tts`, `health`, `ref` (add / list / delete / update), `encode`, `decode`

`--server` フラグを省略した場合、CLI は `http://localhost:8080` を使います（サーバー上から実行する場合はそのままで OK）。

## カスタマイズ

### モデルの変更

`entrypoint.sh` のモデルパスを変更することで別のモデルを使用できます。現在は `fishaudio/s2-pro` をダウンロードする設定になっています。Fish Speech 1.5 に切り替えたい場合は `entrypoint.sh` の `MODEL_DIR` と `huggingface-cli download` のリポジトリ名を変更してください。

::: warning S2 Pro / openaudio-s1-mini が動かない場合
Docker イメージのトークナイザーバグ（[fishaudio/fish-speech#1266](https://github.com/fishaudio/fish-speech/issues/1266)）により、S2 Pro や openaudio-s1-mini で `AttributeError: 'NoneType' object has no attribute 'encode'` が発生するケースが報告されています。その場合は `fishaudio/fish-speech:v1.5.1` イメージ + `fish-speech-1.5` モデルに切り替えてください。
:::

### torch.compile の無効化

`COMPILE=1`（サンプルで設定済み）は `torch.compile` 最適化を有効にします。初回起動時のコンパイル時間が長い場合は `COMPILE=0` に変更してください。

```yaml
environment:
  - COMPILE=0
```

### サンプリング温度と生成パラメータ

Go CLI の `tts` サブコマンドでは以下のフラグでパラメータを調整できます。

| フラグ | デフォルト | 説明 |
|---|---|---|
| `--temperature` | `0.8` | 生成の多様性（0.1〜1.0）。低いほど安定した発音 |
| `--top-p` | `0.8` | トップ P サンプリング（0.1〜1.0） |
| `--format` | `wav` | 出力フォーマット（`wav` / `mp3` / `opus`） |

## ハマりどころ

### REST API は proxy 経由では公開されない

`conoha-proxy` の `web:` ブロックは 1 プロジェクトにつき 1 HTTP ポートしかルーティングできません。Gradio UI（7860）を `web.port:` に指定しているため、REST API（8080）は外部から到達できません。

また `compose.yml` では `expose:` のみを使用しており、ホスト側ポートバインドがないため、SSH ポートフォワード（`ssh -L 8080:localhost:8080 ...`）では **ホスト側の 8080 に何もバインドされておらず到達できません**。REST API へのアクセスは `docker exec` でコンテナ内から直接行う方法（[5. 動作確認](#_5-動作確認) 参照）を使ってください。

REST API を外部から直接叩きたい場合は、別の FQDN を用意して `web.port: 8080` を指定した追加の `conoha.yml` プロジェクトを作る必要があります。その場合、API はデフォルトで**認証なし**のため、必ず `entrypoint.sh` に `--api-key` フラグを追加してから公開してください。

### 初回起動のモデルダウンロードに時間がかかる

`entrypoint.sh` は起動時にモデルを HuggingFace からダウンロードします（fish-speech-1.5 モデルで約 1.5GB、s2-pro はさらに大きい）。`compose.yml` の `start_period: 600s`（サンプルで設定済み）はダウンロードが完了するまでの healthcheck 猶予です。ネットワーク速度が遅い場合はさらに延ばしてください（例: `start_period: 900s`）。2 回目以降は sentinel ファイル（`.download_complete`）により即起動します。

```bash
# ダウンロードの進捗を確認
conoha app logs <サーバー名>
```

### 参照音声のフォーマット制約

音声クローニングの品質は参照音声に大きく依存します。

- **長さ**: 10〜30 秒が推奨。短すぎると声の特徴を捉えられず、長すぎても効果は変わりません
- **品質**: バックグラウンドノイズが少ないクリーンな音声が望ましい
- **フォーマット**: WAV（16kHz または 44.1kHz、モノラル・ステレオ両対応）を推奨

### GPU OOM（長いテキストの生成）

長いテキストを一度に合成しようとすると GPU OOM になる場合があります。その場合は `chunk_length` パラメータでテキストを分割してください（REST API の `chunk_length` フィールド）。L4 GPU (24GB VRAM) では fish-speech-1.5 の GPU メモリ使用量は約 1.75GB と小さいため、通常のユースケースでは OOM は起きにくいですが、バッチ並列実行時は注意してください。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の fish-speech-tts-gpu](https://github.com/crowdy/conoha-cli-app-samples/tree/main/fish-speech-tts-gpu)
- 検証記: Qiita — *公開後にリンク追加*
- Fish Speech: [fishaudio/fish-speech](https://github.com/fishaudio/fish-speech)
- 関連サンプル:
  - [vLLM (OpenAI 互換, L4 GPU)](/examples/vllm-gpu) — 同じ L4 GPU + cloud-init パターン
  - [Hunyuan3D-2 (画像→3D, L4 GPU)](/examples/hunyuan3d-gpu) — Gradio + L4 GPU の兄弟サンプル
