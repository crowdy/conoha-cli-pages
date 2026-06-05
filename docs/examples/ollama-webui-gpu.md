# Ollama + Open WebUI (L4 GPU) デプロイ

[Ollama](https://ollama.com/) と [Open WebUI](https://github.com/open-webui/open-webui) を NVIDIA L4 GPU の ConoHa VPS にデプロイし、ブラウザから Gemma 4 / Llama 3 などの大規模モデルと会話できる環境を構築するサンプルです。CPU 版 ([Ollama + Open WebUI (CPU)](/examples/ollama-webui)) との最大の違いは **モデルが GPU に常駐し続ける** 点です — Gemma 4 31B は 20GB 超のデータをロードするため、コンテナ再起動のたびに pull し直すのは現実的ではありません。

本サンプルでは `conoha.yml` の `accessories:` パターンを使い、`ollama` サービスを blue/green スロット対象から外しています。これにより、`webui` のコード変更で再デプロイしても GPU に温めたモデルがそのまま残ります。

::: tip 本例は proxy モード対応 (`conoha.yml` 同梱)
HTTPS 終端は conoha-proxy が担当します。`accessories: [ollama]` の仕組みについては [2. conoha.yml](#_2-conoha-yml) で詳しく解説します。
:::

## 完成イメージ

- ブラウザで `https://ollama-webui-gpu.example.com` にアクセスすると Open WebUI のチャット画面が表示される
- Gemma 4 / Llama 3.1 / Qwen 2.5 などのモデルをドロップダウンから選択して会話できる
- HTTPS は Let's Encrypt 証明書が自動発行される（conoha-proxy 経由）
- blue/green 再デプロイ後もモデルは GPU に残ったまま — 再ダウンロード不要
- Open WebUI の設定・チャット履歴は `webui_data` ボリュームに永続保存される

## 前提条件

- ConoHa CLI がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- **L4 GPU フレーバー**（`g2l-t-c20m128g1-l4` など `g2l-*-l4` 系）のサーバーが作成済み（[サーバー管理](/guide/server)）
- DNS A レコードをサーバー IP に向けている（[DNS / TLS](/guide/dns-tls)）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）
- サーバーに **NVIDIA Container Toolkit と driver が入っている** こと（cloud-init で自動セットアップする例を後述）

## スタック

| 役割 | 採用ソフトウェア |
|---|---|
| LLM ランタイム | Ollama (`ollama/ollama:latest`、GPU 対応) |
| チャット UI | Open WebUI (`ghcr.io/open-webui/open-webui:main`) |
| HTTPS / リバースプロキシ | conoha-proxy (Let's Encrypt 自動 TLS) |
| GPU | NVIDIA L4 (24GB VRAM) |

## 1. compose.yml

完全版は [`ollama-webui-gpu/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/ollama-webui-gpu/compose.yml)。要点だけ抜粋します。

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama
    entrypoint: ["/bin/sh", "-c", "ollama serve & sleep 10 && ollama pull gemma4:31b && wait"]
    healthcheck:
      test: ["CMD", "ollama", "list"]
      interval: 30s
      timeout: 10s
      retries: 20
      start_period: 600s
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

  webui:
    image: ghcr.io/open-webui/open-webui:main
    expose:
      - "8080"
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
      - WEBUI_AUTH=false
    volumes:
      - webui_data:/app/backend/data
    depends_on:
      ollama:
        condition: service_healthy

volumes:
  ollama_data:
  webui_data:
```

::: warning `expose` を `ports` にしないこと
proxy モードでは `expose:` を使ってコンテナ側ポートだけを宣言します。`ports:` で公開すると blue/green スロットが衝突します。詳しくは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。
:::

## 2. conoha.yml

```yaml
name: ollama-webui-gpu
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - ollama-webui-gpu.example.com
web:
  service: webui
  port: 8080
# `ollama` is marked as an accessory: the GPU-resident model takes
# minutes to reload, so we keep it alive across blue/green swaps —
# only `webui` is duplicated per slot.
accessories:
  - ollama
```

`hosts:` は自分の FQDN に書き換えてください。

**`accessories: [ollama]` とは:** `accessories:` に列挙したサービスは blue/green スロットの外に置かれる共有インスタンスです。Gemma 4 31B は 20GB 超あるため、blue/green 切替のたびに GPU へのロードをやり直すのは現実的ではありません。`ollama` を accessory にすることで、コンテナを停止・再起動せずに GPU 常駐モデルをそのまま提供し続けます。`webui` だけが新旧スロット間でローリングされるため、UI の更新は素早く、モデルの再ロードは発生しません。

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
  --name ollama-webui-gpu-test \
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
cd conoha-cli-app-samples/ollama-webui-gpu

# conoha.yml の hosts: を自分の FQDN に書き換える
$EDITOR conoha.yml

# proxy がブートしていなければ（サーバーごとに 1 回だけ）
conoha proxy boot --acme-email you@example.com <サーバー名>

# アプリ登録（初回のみ）
conoha app init <サーバー名>

# デプロイ（初回は gemma4:31b の pull で数十分かかります）
conoha app deploy <サーバー名>
```

初回デプロイは Gemma 4 31B（約 20GB）の pull が含まれるため 20–40 分かかります。`conoha app logs <サーバー名>` でダウンロードの進捗を確認できます。

## 5. 動作確認

### ブラウザで開く

`https://ollama-webui-gpu.example.com` を開くとチャット画面が表示されます。初回は Let's Encrypt 証明書発行に数十秒かかる場合があります。

1. 画面上部のモデル選択ドロップダウンからモデルを選ぶ
2. メッセージを入力して送信するとストリーミングで返答が表示される

### モデルを追加で pull する

コンテナ内から直接 `ollama pull` できます。

```bash
docker compose exec ollama ollama pull gemma4:e4b
```

pull 完了後、Open WebUI のドロップダウンに即座に表示されます。

### Ollama API を確認する

```bash
# ロード済みモデルの一覧
curl http://localhost:11434/api/tags
```

サーバー上で実行するか、`ssh -L 11434:localhost:11434 <サーバー名>` でポートフォワードして確認できます。

## モデルを変更する

`compose.yml` の `ollama pull gemma4:31b` を別のモデルに書き換え、再デプロイします。モデルデータは `ollama_data` ボリューム (`/root/.ollama`) に永続化されるため、一度 pull したモデルは再起動後も残ります。

```yaml
entrypoint: ["/bin/sh", "-c", "ollama serve & sleep 10 && ollama pull gemma4:e4b && wait"]
```

L4 (24GB VRAM) で動作するモデルの目安:

| モデル | ファイルサイズ | 必要 VRAM | 備考 |
|---|---|---|---|
| `gemma4:31b` | 約 20GB | 22GB+ | デフォルト。L4 ギリギリ収まる |
| `gemma4:e4b` | 約 9.6GB | 12GB+ | 軽量版。複数モデルを並べるとき向き |
| `llama3.1:8b` | 約 5GB | 8GB+ | Meta の汎用モデル |
| `qwen2.5:14b` | 約 9GB | 12GB+ | 日本語・コード生成に強い |

変更後は `conoha app deploy <サーバー名>` で再デプロイします。ただし `ollama` は accessory のため `compose.yml` の `ollama:` ブロックへの変更は自動反映されません — 詳細は [ハマりどころ](#ハマりどころ) を参照してください。

## ハマりどころ

### `ollama` は accessory のためスロットローテーションされない

`accessories:` に列挙したサービスは blue/green の外に置かれるため、`compose.yml` の `ollama:` ブロックへの変更（モデル変更・環境変数・GPU 設定など）は `conoha app deploy` だけでは反映されません。変更を適用するにはデプロイ後にサーバー上で `docker compose up -d ollama` を手動実行してください。

### モデルのダウンロードに時間がかかる

Gemma 4 31B は約 20GB あり、初回 pull に 20–40 分かかります。この間 `ollama` の healthcheck が失敗し続けると `webui` の起動も待機されます。`compose.yml` の `start_period: 600s`（サンプルで設定済み）は最低限の猶予です — 大きなモデルに変更した場合はさらに延ばす必要があります（例: `start_period: 2400s`）。

### Open WebUI の初回オンボーディング

`WEBUI_AUTH=false`（デフォルト）では認証なしで全員がアクセスできます。公開環境では `WEBUI_AUTH=true` に変更してください。`true` にすると初回アクセス時に管理者アカウントの作成画面が表示され、2 人目以降はデフォルトで signup が無効になります（管理者が手動で有効化できます）。

### GPU メモリの競合

1 台の L4 (24GB) では同時に複数の大型モデルを GPU にロードできません。Ollama は `OLLAMA_KEEP_ALIVE` 環境変数でモデルを GPU に保持する時間を制御します（デフォルト: `5m`）。複数モデルを切り替えながら使う場合は値を調整してください。

```yaml
services:
  ollama:
    environment:
      - OLLAMA_KEEP_ALIVE=30m   # 30 分間 GPU に保持
```

この環境変数は `ollama` サービスに追加します。`ollama` は accessory のため `conoha app deploy` では反映されません — 変更後は `docker compose up -d ollama` を手動で実行してください。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の ollama-webui-gpu](https://github.com/crowdy/conoha-cli-app-samples/tree/main/ollama-webui-gpu)
- Ollama 公式: [ollama.com](https://ollama.com/) / [ollama/ollama](https://github.com/ollama/ollama)
- Open WebUI: [open-webui/open-webui](https://github.com/open-webui/open-webui)
- 関連サンプル:
  - [Ollama + Open WebUI (CPU)](/examples/ollama-webui) — GPU なし・軽量モデル向け
  - [vLLM (OpenAI 互換, L4 GPU)](/examples/vllm-gpu) — OpenAI 互換 API サーバーとして使う場合
