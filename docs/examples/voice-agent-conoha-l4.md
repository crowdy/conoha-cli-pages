# 自前音声エージェント (WebRTC + L4 GPU) デプロイ

[`voice-agent-conoha-l4`](https://github.com/crowdy/conoha-cli-app-samples/tree/main/voice-agent-conoha-l4) は、電話・SIP トランク・コールセンター HW を一切使わず、QR コードをスキャンしてブラウザのマイクから話しかけるだけで AI が音声を聞き取り、注文を Google Sheets に書き込み、別ブラウザにリアルタイム配信するデモを **1 台の ConoHa L4 GPU VPS** で完結させるサンプルです。STT・LLM・TTS すべてを自己ホストし、OpenAI など外部 AI サービスへの通信は一切ありません。社内利用制限で OpenAI を使えない案件や、音声データを社外に出せない案件にそのまま適用できます。

本サンプルは `voice-agent-webrtc-realtime`（OpenAI Realtime API ベース）の後継です。同じユースケース・同じ 3 モードの「○○食堂の注文受付 AI」を、外部 AI 依存を排除した完全自己ホスト構成で実現します。音声会話は Pipecat + aiortc による WebRTC チャネルを通じて双方向に流れ、STT (faster-whisper) → LLM (vLLM + Qwen2.5-7B-AWQ) → TTS (Style-BERT-VITS2) のパイプラインが L4 GPU 上でエンドツーエンドに動作します。

ブラウザのトップページには 3 枚の QR コードが並び、それぞれ `emergency`（救急通信センター）・`military`（作戦司令部）・`callcenter`（飲食店電話注文受付）の 3 ペルソナに対応した `/talk?mode=...` ページに誘導します。QR スキャンひとつで音声会話が始まり、約 2 秒のラウンドトリップで AI が応答し、会話結果が Google Sheets に記録されるところまでをデモできます。

::: tip 本例は proxy モード対応 (`conoha.yml` 同梱)
HTTPS 終端は conoha-proxy が担当します。`accessories: [backend, llm, agent]` の仕組みについては [2. conoha.yml](#_2-conoha-yml) で詳しく解説します。

**proxy は必須です。** WebRTC の `getUserMedia`（マイクアクセス）はブラウザのセキュリティポリシーにより HTTPS コンテキストでしか動作しません。no-proxy モードで HTTP のまま動かしても、ブラウザがマイクを許可しないため音声会話は成立しません。Let's Encrypt 証明書の自動取得を含む conoha-proxy を必ず起動してからデプロイしてください。
:::

## 完成イメージ

- トップページの QR コードをスキャンすると `/talk?mode=callcenter`（または他のモード）が開き、ブラウザがマイクの許可を求める
- 「親子丼を 1 つ」のような短い発話をすると、約 2 秒で AI が音声で応答する（STT → LLM → TTS のラウンドトリップ）
- 注文が確定すると Google Sheets に行が追加され、別ブラウザで開いた OrderTicker ボードにリアルタイムで反映される
- 3 ペルソナ（emergency / military / callcenter）は system prompt だけが異なり、同一の注文 API・同一の TTS を共有する
- blue/green 再デプロイでも GPU 常駐の LLM と WebRTC 接続を保持した agent はそのまま残り、Next.js フロントエンドだけが入れ替わる

## アーキテクチャ

```
                    ┌────────────────── ConoHa L4 24GB VPS ──────────────────┐
                    │                                                        │
   ┌─────────┐      │  ┌──────────────────┐                                  │
   │ Browser │◄─TLS─┤  │ conoha-proxy     │                                  │
   │ /talk   │HTTPS │  │ (ACME Let's Enc) │                                  │
   └────┬────┘      │  └────────┬─────────┘                                  │
        │ WebRTC    │           │                                            │
        │ (Opus     │           ▼                                            │
        │  双方向)  │  ┌──────────────────┐  ┌──────────────────┐            │
        ├──────────►│  │ frontend         │  │ agent            │            │
        │           │  │ Next.js 16       │  │ Pipecat + aiortc │            │
        │           │  │ QR / talk UI     │  │ ┌──────────────┐ │            │
        │  DataCh   │  └──────────────────┘  │ │ Silero VAD   │ │            │
        │◄──────────┤                        │ ├──────────────┤ │            │
        │ user_txt  │  ┌──────────────────┐  │ │faster-whisper│ │  ┌───────┐ │
        │ tool_call │  │ backend          │  │ │  (STT 16kHz) │ │  │Google │ │
        │ persisted │  │ FastAPI          │◄─┤ ├──────────────┤ ├─►│Sheets │ │
        │           │  │ ┌──────────────┐ │  │ │ → vLLM Qwen  │ │  └───────┘ │
        │           │  │ │ orders REST  │ │  │ │  2.5-7B-AWQ  │ │            │
        │           │  │ │ Sheets sync  │ │  │ ├──────────────┤ │            │
        │           │  │ │ WS broker    │ │  │ │Style-BERT-   │ │            │
        │           │  │ └──────────────┘ │  │ │  VITS2 (TTS) │ │            │
        │           │  └──────┬───────────┘  │ └──────────────┘ │            │
        │ WS /events│         │              └──────────────────┘            │
        └──────────►│         │                                              │
                    │  ┌──────▼──────────────────────────────────────────┐   │
                    │  │ llm: vLLM (Qwen2.5-7B-Instruct-AWQ, 8GB VRAM)  │   │
                    │  └─────────────────────────────────────────────────┘   │
                    │                GPU: ~13GB / 24GB 使用（5 セッション想定）│
                    └────────────────────────────────────────────────────────┘
```

各サービスの役割:

| レイヤー | サービス | 技術 |
|---|---|---|
| フロント | `frontend` | Next.js 16 (App Router, standalone) — QR ランディング + `/talk` WebRTC クライアント |
| 音声エージェント | `agent` | Pipecat + aiortc + Silero VAD + ConversationLoop — WebRTC サーバーサイド、ターンテーキング、STT→LLM→TTS パイプライン |
| LLM | `llm` | vLLM + Qwen2.5-7B-Instruct-AWQ — OpenAI 互換 API、function calling 対応 |
| バックエンド | `backend` | FastAPI — 注文 REST API + Google Sheets 書き込み + WebSocket ブロードキャスト |

## 前提条件

- conoha-cli **≥ v0.8.0** がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- **L4 GPU フレーバー** `g2l-t-c4m16g1-l4`（4 vCPU / 16GB RAM / L4 24GB）のサーバー — `flavor:` ピン機能により、このフレーバー以外のサーバーへのデプロイは `conoha app deploy` の時点で拒否されます
- DNS A レコードをサーバー IP に向け、伝播が完了していること（[DNS / TLS](/guide/dns-tls)）
- **conoha-proxy がブート済み**（WebRTC に HTTPS は必須）（[conoha-proxy セットアップ](/guide/proxy-setup)）
- サーバーに **NVIDIA Container Toolkit と driver が入っている** こと（後述の cloud-init スクリプトで自動セットアップ）
- **Google サービスアカウント**と、そのアカウントに共有済みの Google スプレッドシート（Sheets 連携は省略可能だが、デモフローでは前提）

## 1. compose.yml

完全版は [`voice-agent-conoha-l4/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/voice-agent-conoha-l4/compose.yml)。操作上重要な部分を抜粋します。

```yaml
services:
  frontend:
    build:
      context: ./frontend
      args:
        PUBLIC_BASE_URL: ${PUBLIC_BASE_URL:?PUBLIC_BASE_URL must be set in .env}
    expose: ["3000"]
    env_file: [.env]
    depends_on:
      agent: { condition: service_healthy }
      backend: { condition: service_healthy }

  agent:
    build: ./agent
    expose: ["8080"]
    env_file: [.env]
    volumes:
      - models-agent:/models        # SBV2 weights をマウント
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    healthcheck:
      test: ["CMD-SHELL", "python3.12 -c \"import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8080/healthz').status==200 else 1)\""]
      interval: 10s
      retries: 30
      start_period: 180s            # faster-whisper + SBV2 ロード猶予
    depends_on:
      backend: { condition: service_healthy }
      llm: { condition: service_healthy }

  llm:
    build: ./llm
    expose: ["8000"]
    env_file: [.env]
    volumes:
      - models-llm:/root/.cache/huggingface
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:8000/v1/models || exit 1"]
      interval: 10s
      retries: 60
      start_period: 240s            # Qwen 7B AWQ (~9GB) DL + ロード猶予

  backend:
    build: ./backend
    expose: ["8000"]
    env_file: [.env]
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz')\""]
      interval: 5s
      retries: 5
      start_period: 10s

volumes:
  models-agent:   # SBV2 weights 永続化
  models-llm:     # Qwen 7B AWQ weights 永続化
```

::: warning `expose` を `ports` にしないこと
proxy モードでは `expose:` を使ってコンテナ側ポートだけを宣言します。`ports:` で公開すると blue/green スロットが衝突します。詳しくは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。
:::

`agent` と `llm` の両方が `driver: nvidia / count: 1` で GPU を予約していますが、L4 は単一 GPU です。vLLM が ~8GB、faster-whisper (medium) と SBV2 が合計 ~5GB を使い、合計約 13GB / 24GB VRAM の範囲に収まります。

## 2. conoha.yml

```yaml
name: voice-agent-conoha-l4

# Replace with your own FQDN before running `conoha app init`.
hosts:
  - voice-agent.example.com

# Required GPU flavor — the agent and llm services need an L4.
flavor: g2l-t-c4m16g1-l4

web:
  service: frontend
  port: 3000

# These stay alive across blue/green swaps (only frontend is duplicated).
accessories:
  - backend
  - llm
  - agent
```

`hosts:` は自分の FQDN に書き換えてください。

**`flavor: g2l-t-c4m16g1-l4` ピン機能:** `conoha.yml` に `flavor:` フィールドを書くと、`conoha app deploy` 実行時にサーバーの実際のフレーバーと照合します。フレーバーが一致しない場合はデプロイを即座に拒否します。これは GPU サンプルのセーフガードです — GPU のない安価なフレーバーに誤ってデプロイして「コンテナが起動しない」とハマるのを防ぎます。別サイズの GPU VPS に意図的にデプロイしたい場合は `flavor:` 行を削除するか、正しいフレーバー名に書き換えてください。

**`accessories: [backend, llm, agent]` — なぜ 3 サービスが accessory なのか:** `accessories:` に列挙したサービスは blue/green スロットの外に置かれる共有インスタンスです。それぞれに warm に保つ必要がある理由があります。

- **`llm`**: Qwen2.5-7B-AWQ モデルが GPU VRAM に常駐しています。blue/green 切替のたびに ~9GB のモデルを再ロードすると数分かかり、その間 STT→LLM→TTS パイプラインが止まります。
- **`agent`**: Pipecat + aiortc が WebRTC の PeerConnection 状態（SDP、ICE candidate、DataChannel）を in-memory で保持します。コンテナが再起動すると進行中の音声セッションが全て切断されます。
- **`backend`**: FastAPI が注文の in-memory キャッシュと WebSocket 接続を保持します。再起動すると OrderTicker の WS ブロードキャストが切れ、未確定注文が失われる可能性があります。

`frontend`（Next.js standalone）だけが blue/green の各スロットで複製されます。フロントエンドのコード変更はゼロダウンタイムで切り替わりますが、バックエンド・LLM・エージェントは温かいまま残ります。

**`web.service: frontend` / `port: 3000`:** conoha-proxy は `frontend` の Next.js サーバー（ポート 3000）だけを HTTPS でフロントします。`agent`（WebRTC）・`backend`（REST + WS）・`llm`（vLLM API）は `frontend` の API Routes 経由でプロキシされ、直接外部に露出しません。

## 3. 環境変数 (`.env`)

`.env.example` をコピーして `.env` を作成し、値を埋めてください。

```bash
cp .env.example .env
$EDITOR .env
```

必須の変数:

| 変数 | 説明 | 例 |
|---|---|---|
| `PUBLIC_BASE_URL` | デプロイ先 FQDN（`https://` を含む） | `https://voice-agent.example.com` |
| `ALLOWED_ORIGINS` | `PUBLIC_BASE_URL` と同じ値（CSRF 保護）| `https://voice-agent.example.com` |
| `SHEET_ID` | Google スプレッドシートの ID（URL の `/d/<ID>/` 部分） | `<SHEET_ID>` |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | サービスアカウント JSON を 1 行に圧縮したもの | `<SERVICE_ACCOUNT_JSON>` |

チューニング用変数（デフォルトで動作する）:

| 変数 | デフォルト | 説明 |
|---|---|---|
| `OFFER_RATE_LIMIT_PER_MIN` | `3` | `/offer` エンドポイント（WebRTC セッション確立）のレート制限 |
| `MAX_CONCURRENT_SESSIONS` | `5` | 同時 WebRTC セッション数の上限 |
| `SESSION_MAX_DURATION_SEC` | `600` | セッションの最大継続時間（秒） |
| `WHISPER_MODEL_SIZE` | `medium` | faster-whisper のモデルサイズ（`tiny` / `base` / `medium` / `large`） |
| `LLM_MODEL` | `Qwen/Qwen2.5-7B-Instruct-AWQ` | vLLM が使う HuggingFace モデル名 |
| `GPU_MEMORY_UTILIZATION` | `0.40` | vLLM の GPU メモリ利用率（llm と agent でメモリを分け合うため低め） |
| `RESTAURANT_NAME` | `カフェ・コノハ` | callcenter ペルソナの店名（system prompt に埋め込まれる） |

## 4. NVIDIA セットアップ (cloud-init)

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
  --name voice-agent-l4 \
  --flavor 1ff846c5-... \    # g2l-t-c4m16g1-l4 (4 vCPU / 16GB RAM / L4 GPU)
  --image  722c231f-... \    # vmi-docker-29.2-ubuntu-24.04-amd64
  --key-name <YOUR_KEY> \
  --security-group default \
  --security-group IPv4v6-SSH \
  --security-group IPv4v6-Web \
  --security-group IPv4v6-ICMP \
  --user-data /tmp/nvidia-cloudinit.sh \
  --no-input --wait
```

## 5. デプロイ

cloud-init 完了後（初回ブートから 5–10 分、`shutdown -r +1` の再起動を含む）、以下の順序でデプロイします。

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/voice-agent-conoha-l4

# 1. conoha.yml の hosts: を自分の FQDN に書き換える
$EDITOR conoha.yml

# 2. .env を作成（PUBLIC_BASE_URL, SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS_JSON 等）
cp .env.example .env
$EDITOR .env

# 3. DNS A レコードが伝播していることを確認
dig +short voice-agent.example.com    # サーバー IP と一致するまで待機

# 4. proxy 起動（ACME 証明書の自動取得）— サーバーごとに 1 回だけ
conoha proxy boot --acme-email you@example.com voice-agent-l4

# 5. アプリ初期化（Docker volume を作成）— 初回のみ
conoha app init voice-agent-l4

# 6. SBV2 weights を事前配置（初回のみ、init 後すぐに実行）
#    volume 作成後でないとパスが存在しないため、必ず init の後に行う
ssh root@<SERVER_IP> 'bash -s' < scripts/fetch-sbv2-weights.sh

# 7. デプロイ（初回は GPU image pull + Qwen モデル DL + SBV2 weights で 10–15 分）
conoha app deploy voice-agent-l4

# 8. /healthz が 200 を返したら起動完了（モデル warmup に 90–120 秒かかる）
curl https://voice-agent.example.com/healthz
```

**SBV2 weights 事前配置（ステップ 6）について:** `scripts/fetch-sbv2-weights.sh` は `voice-agent-conoha-l4_models-agent` ボリュームに `litagin/style_bert_vits2_jvnv` モデル（約 500MB）を git clone します。この事前配置をスキップすると、初回デプロイ後に agent コンテナが起動する際に改めてダウンロードが走り、healthcheck の `start_period: 180s` を超えてコンテナが unhealthy 判定される場合があります。詳細は [ハマりどころ](#ハマりどころ) を参照してください。

## 6. 動作確認

### healthcheck

デプロイ完了後、`/healthz` が 200 を返すまで待ちます。モデルの warmup（faster-whisper + SBV2 のロード、vLLM の CUDA グラフキャプチャ）に 90–120 秒かかります。

```bash
curl -i https://voice-agent.example.com/healthz
# HTTP/2 200 が返ったら起動完了
```

### スモークテスト

```bash
# 注文 POST（callcenter モードで 1 件）
ORDER=$(curl -fsS -X POST https://voice-agent.example.com/api/orders \
  -H "Content-Type: application/json" \
  -H "Origin: https://voice-agent.example.com" \
  -d '{"mode":"callcenter","language":"ja","items":[{"name":"親子丼","qty":1}]}')
echo "$ORDER" | jq .

OID=$(echo "$ORDER" | jq -r .order_id)

# 注文更新 PATCH
curl -fsS -X PATCH https://voice-agent.example.com/api/orders/${OID} \
  -H "Content-Type: application/json" \
  -H "Origin: https://voice-agent.example.com" \
  -d '{"items":[{"name":"親子丼","qty":2}],"notes":"smoke test"}' | jq .

# Origin 拒否テスト — 403 が返ることを確認
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://voice-agent.example.com/api/offer \
  -H "Origin: https://evil.example.com" \
  -H "Content-Type: application/json" \
  -d '{"sdp":"x","type":"offer","mode":"callcenter"}'
# 期待: 403
```

`<ORDER_ID>` のような UUID がレスポンスに返り、Google Sheets に行が追加されていれば正常です。

### ブラウザでの会話デモ

1. `https://voice-agent.example.com` を開くと 3 枚の QR コードが並ぶ
2. スマートフォンでいずれかの QR をスキャンすると `/talk?mode=callcenter`（または `emergency` / `military`）が開く
3. ブラウザがマイクの許可を求めるので許可する
4. 「親子丼を 1 つ」のように発話すると、約 2 秒で AI が音声で応答する
5. 注文が確定すると別ブラウザで開いた OrderTicker ボードがリアルタイムで更新される

## 3 つのモード (ペルソナ)

同じ「○○食堂の注文受付 AI」を 3 つの通信プロトコル風の人格でスキニングしています。技術スタックもツール（`add_order` / `update_order` / `close_order` / `list_orders`）も共通で、**system prompt の文字列だけが違います**。

| モード | 人格イメージ | ユースケース例 |
|---|---|---|
| `emergency` | 救急通信センター — 冷静・簡潔・医療従事者口調 | 救急隊員が現場から音声で患者情報を入力 |
| `military` | 作戦司令部 — 無線連絡風、復唱を含む | 無線交信風の補給品目報告 |
| `callcenter` | 飲食店コールセンター — 丁寧で温かい接客口調 | 飲食店の電話注文受付（実用シナリオ） |

実装は `agent/app/personas.py` の `PERSONAS` 辞書で定義されており、system prompt の文字列だけが 3 モードで異なります。「system prompt を 1 行変えるだけで全く別の業務シミュレーターに見える」という UI 設計の発見を、このデモで体感できます。

## カスタマイズ

### LLM モデルの変更

`.env` の `LLM_MODEL` を変更して再デプロイします。Qwen2.5 シリーズは L4 24GB に収まるバリアントが複数あります。

| モデル | VRAM 目安 | 特徴 |
|---|---|---|
| `Qwen/Qwen2.5-7B-Instruct-AWQ` | ~8GB | デフォルト。日本語・function calling に強い |
| `Qwen/Qwen2.5-14B-Instruct-AWQ` | ~14GB | 高精度。agent の STT/TTS と合わせると VRAM がタイトになる |
| `Qwen/Qwen2.5-3B-Instruct-AWQ` | ~4GB | 軽量。レイテンシ優先の場合 |

`llm` サービスは `accessories:` 内にあるため、`compose.yml` の変更後は `conoha app deploy` だけでは反映されません。サーバー上で `docker compose up -d llm` を手動実行してください。

### TTS 音声の変更

デフォルトは `litagin/style_bert_vits2_jvnv`（jvnv 系ライセンス許容音声）です。SBV2 が対応する別の音声モデルに変更するには、`scripts/fetch-sbv2-weights.sh` の clone URL を変更して再実行します。変更後は `agent` コンテナの再起動が必要です（`docker compose restart agent`）。

### STT モデルサイズの変更

`.env` の `WHISPER_MODEL_SIZE` を `tiny` / `base` / `medium` / `large` から選択します。`medium`（デフォルト、約 1.5GB）はレイテンシと精度のバランスが取れています。`large` に変更すると日本語精度が上がりますが VRAM を追加消費し、ロード時間も増加します。

### レート制限の調整

公開デモでは GPU 資源の枯渇を防ぐために `OFFER_RATE_LIMIT_PER_MIN`（デフォルト `3`）と `MAX_CONCURRENT_SESSIONS`（デフォルト `5`）を必ず確認してください。社内限定用途ではこれらを緩和できますが、外部公開時は必ず `ALLOWED_ORIGINS` を自分の FQDN のみに制限してください。

## ハマりどころ

### HTTPS / TLS は必須

WebRTC の `getUserMedia`（マイクアクセス）はブラウザのセキュリティポリシーにより **HTTPS コンテキストでのみ動作します**。`localhost` を除き、HTTP で配信されたページではブラウザがマイクへのアクセスを拒否するため、音声エージェントとして機能しません。

conoha-proxy が Let's Encrypt 証明書を自動取得して HTTPS 終端を担当します。デプロイ前に必ず `conoha proxy boot` を実行し、DNS 伝播が完了していることを確認してください。no-proxy モード（HTTP のまま）での運用はこのサンプルでは非対応です。

### `ALLOWED_ORIGINS` を絶対に空にしない

`ALLOWED_ORIGINS` が空のままだと、任意のサイトから `/offer` エンドポイントを呼び出すことができ、GPU 資源が外部に消費されます。README のセキュリティ節に明記されているとおり、`ALLOWED_ORIGINS` は必ず自分の FQDN（`PUBLIC_BASE_URL` と同じ値）に設定してください。

```bash
# 正しい設定例
PUBLIC_BASE_URL=https://voice-agent.example.com
ALLOWED_ORIGINS=https://voice-agent.example.com
```

### `flavor:` ミスマッチ

`conoha.yml` に `flavor: g2l-t-c4m16g1-l4` が書かれている状態で、別のフレーバーのサーバーに `conoha app deploy` を実行するとデプロイが拒否されます。

```
Error: server flavor "g2-t-c2m4" does not match required flavor "g2l-t-c4m16g1-l4" in conoha.yml
```

修正方法は 2 つあります。正しい L4 フレーバーのサーバーを作り直すか、意図的に別サイズで動かしたい場合は `conoha.yml` の `flavor:` 行を削除（または正しいフレーバー名に書き換え）してください。ただし GPU のないフレーバーに `agent` や `llm` をデプロイすると、コンテナ起動時に NVIDIA デバイスが見つからずクラッシュします。

### SBV2 weights を事前配置していないと起動が失敗する

`conoha app init` 後に `scripts/fetch-sbv2-weights.sh` を実行せずに `conoha app deploy` した場合、agent コンテナが起動時に SBV2 モデルをダウンロードしようとして `start_period: 180s` 内に完了しない可能性があります。その場合、healthcheck が unhealthy を返し、`frontend` の起動もブロックされます。

デプロイが止まっているように見えたら `conoha app logs voice-agent-l4` で agent コンテナのログを確認し、`SBV2 weights placed at` の行が出るまで待つか、手動で weights を配置してコンテナを再起動してください。

### 個人情報は入力しない

音声通話の内容（テキスト書き起こし）は Google Sheets に書き込まれます。**個人情報や機密情報は入力しないこと** — これは README のセキュリティ節に明記されている注意事項です。デモ用途では架空のメニュー名と数量のみを使ってください。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の voice-agent-conoha-l4](https://github.com/crowdy/conoha-cli-app-samples/tree/main/voice-agent-conoha-l4)
- 検証記: Qiita — *公開後にリンク追加*
- 公式ライブラリ:
  - Pipecat: [pipecat-ai/pipecat](https://github.com/pipecat-ai/pipecat)
  - faster-whisper: [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper)
  - Style-BERT-VITS2 (SBV2): [litagin02/Style-Bert-VITS2](https://github.com/litagin02/Style-Bert-VITS2)
  - aiortc: [aiortc/aiortc](https://github.com/aiortc/aiortc)
- 関連サンプル:
  - [vLLM (OpenAI 互換, L4 GPU)](/examples/vllm-gpu) — 同じ vLLM + Qwen2.5 LLM スタック
  - [Fish Speech TTS (L4 GPU)](/examples/fish-speech-tts-gpu) — 代替 TTS（SBV2 なし、音声クローニング対応）
  - [Ollama + Open WebUI (L4 GPU)](/examples/ollama-webui-gpu) — `accessories:` パターンの兄弟サンプル
