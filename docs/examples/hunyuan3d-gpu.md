# Hunyuan3D-2 (画像→3D, L4 GPU) デプロイ

[Tencent Hunyuan3D-2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) は、1 枚の画像から 3D メッシュ + テクスチャを生成するオープンソースの大規模 3D 拡散モデルです。Hunyuan3D-DiT でメッシュ形状を生成し、Hunyuan3D-Paint でテクスチャを塗る 2 段階パイプラインにより、GLB / OBJ / PLY 形式の 3D モデルをブラウザからダウンロードできます。出力は古典的な CAD ではなく **生成 3D** — 画像からの推論で形状を作るため、パラメトリック CAD とは本質的に異なるアプローチです。

本サンプルでは Gradio WebUI（ポート 7860）をホストに直接バインドし、画像のアップロードから GLB のダウンロードまでをターミナル 1 コマンドで完結させます。ConoHa VPS3 の L4 GPU フレーバーを使うことで、shape only モードでは実機検証で **27 秒**、shape + texture モードでは 60〜120 秒での生成を確認しています。

::: tip 本例は no-proxy モードで動作します
Gradio が `:7860` を直接ホストにバインドするため `conoha.yml` を持たず、[no-proxy モード](/guide/app-deploy#モードの比較) でデプロイします。HTTPS / blue-green を使う通常の流れは [Hello World](/examples/hello-world) や [Next.js](/examples/nextjs) を参照してください。HTTPS が必要な場合は [HTTPS を有効にする](#https-を有効にする) を参照してください。
:::

## 完成イメージ

- ブラウザで `http://<サーバーIP>:7860` を開くと Hunyuan3D-2 の Gradio WebUI が表示される
- PNG / JPG をドラッグ＆ドロップして「Gen Shape」を押すだけで GLB が出力される（背景単色・被写体中央の画像が最も品質が高い）
- L4 GPU (24GB VRAM) で shape only モード 27〜60 秒、shape + texture モード 60〜120 秒の生成時間
- ダウンロードした GLB は Blender や [glTF Viewer](https://gltf-viewer.donmccurdy.com/) で開いて確認できる
- 生成物はビジュアライゼーション用途として十分な品質 — 工業 CAD の代替ではなく、プロトタイピング・VR・3D 印刷の入力素材として利用する

## 前提条件

- ConoHa CLI がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- **L4 GPU フレーバー**（`g2l-t-c20m128g1-l4` など `g2l-*-l4` 系）のサーバーが作成済み（[サーバー管理](/guide/server)）
- サーバーに **NVIDIA Container Toolkit と driver が入っている** こと（cloud-init で自動セットアップする例を後述）
- セキュリティグループで **ポート 7860** が開いていること（`3000-9999` グループで OK）
- **ディスク空き容量**: モデル重み (~10GB) + Docker イメージ (~8GB) + 出力ファイルの分を合計し、**25GB 以上** の空き領域を推奨。`g2l-t-c20m128g1-l4` のブートボリューム（100GB）では十分ですが、デプロイ前に `df -h` で確認してください

## スタック

| コンポーネント | 役割 |
|---|---|
| **Hunyuan3D-2**（Tencent） | 画像 → 3D メッシュ + テクスチャ生成モデル |
| **Gradio WebUI** | ブラウザから画像をアップロード、GLB をダウンロード |
| **PyTorch 2.4 + CUDA 12.4** | ベースイメージ（`pytorch/pytorch:2.4.0-cuda12.4-cudnn9-devel`） |
| **NVIDIA L4 GPU** | 推論用 GPU（24GB VRAM、SM 8.9） |
| **ConoHa VPS3** `g2l-t-c20m128g1-l4` | 20 vCPU / 128GB RAM / L4 24GB |

## 1. compose.yml

完全版は [`hunyuan3d-gpu/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/hunyuan3d-gpu/compose.yml)。要点だけ抜粋します。

```yaml
services:
  hunyuan3d:
    build: .
    image: hunyuan3d-gpu:local
    ports:
      - "7860:7860"
    volumes:
      - hf_cache:/root/.cache/huggingface
      - outputs:/app/outputs
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    environment:
      - HF_HOME=/root/.cache/huggingface
      - TORCH_CUDA_ARCH_LIST=8.9
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7860/"]
      interval: 30s
      timeout: 10s
      retries: 30
      start_period: 900s    # 初回モデル DL (~10GB) の猶予（サンプルで設定済み）
    restart: unless-stopped

volumes:
  hf_cache:
  outputs:
```

::: warning `start_period` は省略しないこと
初回起動で Hunyuan3D-2 のモデル重み (~10GB) をダウンロードしている最中に healthcheck が走り出すと再起動ループに入ります。`start_period: 900s`（15 分）以上は確保してください。2 回目以降は sentinel ファイルガードでダウンロードをスキップするため即起動します。
:::

`TORCH_CUDA_ARCH_LIST=8.9` は L4 専用ビルド指定で、C++ 拡張（custom rasterizer / differentiable renderer）のコンパイル時間を短縮します。C++ 拡張はイメージビルド時に焼き込まれるため、初回起動時の処理はモデルダウンロードのみに絞られます。

## 2. NVIDIA セットアップ (cloud-init)

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
  --name hunyuan3d-test \
  --flavor 1ff846c5-... \    # g2l-t-c20m128g1-l4 (20 vCPU / 128GB / L4 GPU)
  --image  722c231f-... \    # vmi-docker-29.2-ubuntu-24.04-amd64
  --key-name <YOUR_KEY> \
  --security-group <YOUR_SG> \
  --user-data /tmp/nvidia-cloudinit.sh \
  --no-input --wait
```

## 3. デプロイ

cloud-init 完了後（初回ブートから 5–10 分、`shutdown -r +1` の再起動を含む）、以下の手順でデプロイします。

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/hunyuan3d-gpu

conoha app deploy <サーバー名> --app-name hunyuan3d-gpu --no-proxy
```

::: tip `--no-proxy` が必須
本サンプルは `conoha.yml` を持たないため、`--no-proxy` を付けないと

```
read conoha.yml: open conoha.yml: no such file or directory
```

で蹴られます。詳しくは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。
:::

初回は Docker イメージのビルド（~10 分）+ モデルダウンロード（~10GB、~8 分）で合計 **約 18 分** かかります。`docker compose ps` の healthcheck が `healthy` になるまで待ってください。

## 4. 動作確認

ブラウザで `http://<サーバーIP>:7860` にアクセスすると Hunyuan3D-2 の Gradio WebUI が表示されます。

1. **画像のアップロード**: `assets/example_images/004.png` のような被写体中央・背景単色の画像をアップロード（PNG / JPG 対応）
2. **生成モードの選択**: shape only モード（30〜60 秒）または shape + texture モード（60〜120 秒）
3. **「Gen Shape」を押す**: 生成中は進捗バーが表示される
4. **GLB をダウンロード**: 生成完了後に表示されるダウンロードリンクから取得

::: warning 初回起動のディスク / メモリ圧
初回起動直後はモデルのダウンロード中のため、ブラウザからアクセスしても `502` または接続拒否になります。`docker compose ps` で `healthy` になるまで（最大 15 分）待ってください。
:::

生成された GLB は [glTF Viewer](https://gltf-viewer.donmccurdy.com/) や Blender で開いて確認できます。Blender の場合は「ファイル → インポート → glTF 2.0 (.glb/.gltf)」で読み込めます。

## チューニング

| 環境変数 | サンプル値 | 説明 |
|---|---|---|
| `HF_HOME` | `/root/.cache/huggingface` | モデルキャッシュの保存先（サンプルで設定済み） |
| `TORCH_CUDA_ARCH_LIST` | `8.9` | L4 専用ビルド（SM 8.9）で C++ 拡張のコンパイルを高速化（サンプルで設定済み） |
| `MODEL_REPO` | `tencent/Hunyuan3D-2` | entrypoint で参照するモデルリポジトリ（サンプルで設定済み） |

**テクスチャ生成と GPU OOM**: texture モードは shape only より VRAM を多く消費します。L4 24GB でも高解像度設定では OOM になる場合があります。その場合は shape only モードに切り替えてください。

**生成後のディスク掃除**: GLB は `outputs` ボリューム（`/app/outputs`）に蓄積されます。長期運用する場合は定期的に削除してください。

```bash
docker compose exec hunyuan3d find /app/outputs -name "*.glb" -mtime +7 -delete
```

`hf_cache` ボリュームにはモデル重み (~10GB) が入っています。ボリュームを削除するとモデルが再ダウンロードされるため、**クリーンアップ目的でボリュームを削除しないこと**を推奨します。

## ハマりどころ

### ディスク不足で初回デプロイが失敗する

Docker イメージのビルド（~8GB）+ モデル重み (~10GB) で合計 ~18GB 以上の空きが必要です。デプロイ前に必ず確認してください。

```bash
df -h /
```

空きが 20GB 未満の場合は不要なイメージを削除してから再試行してください。

```bash
docker image prune -f
```

### `healthcheck` が `healthy` にならず再起動ループになる

初回起動でモデルをダウンロードしている最中に `start_period` を超えると、Docker が再起動ループに入ります。`compose.yml` の `start_period: 900s`（サンプルで設定済み）でほとんどの環境をカバーしますが、ネットワークが遅い場合はさらに延ばしてください（例: `start_period: 1800s`）。

```bash
# ダウンロードの進捗を確認
docker compose logs -f hunyuan3d
```

### `gradio_app.py` の `GRADIO_SERVER_*` 環境変数が効かない

`gradio_app.py` は `demo.launch()` ではなく `uvicorn.run()` で起動するため、`GRADIO_SERVER_NAME` / `GRADIO_SERVER_PORT` 環境変数は完全に無視されます。`argparse` の既定値が支配するため、本サンプルでは `entrypoint.sh` で明示的に `--host 0.0.0.0 --port 7860 --cache-path /app/outputs` を渡しています。環境変数で制御しようとすると Gradio が argparse 組み込みの `8080` を listen してヘルスチェックが永遠に失敗します。

### GLB のレンダリング品質とメッシュ法線

出力 GLB は glTF 2.0 準拠ですが、UV マップや法線の品質は入力画像に大きく依存します。透明素材・光沢が強い素材・極端なポーズの被写体は形状の崩れが出やすくなります。本サンプルの出力は **ビジュアライゼーション / プロトタイピング用途** であり、工業設計 CAD や印刷用の精密モデルの代替ではありません。品質が不十分な場合は Blender で手作業のリトポロジーを行うことを検討してください。

## HTTPS を有効にする

本サンプルは HTTP のみ対応です（ポート 7860 をホストに直接バインド）。HTTPS が必要な場合は、Caddy または nginx をリバースプロキシとして `:7860` の前段に立ててください。アーキテクチャパターンは [nginx リバースプロキシ](/examples/nginx-reverse-proxy) を参照してください。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の hunyuan3d-gpu](https://github.com/crowdy/conoha-cli-app-samples/tree/main/hunyuan3d-gpu)
- 検証記: Qiita — *公開後にリンク追加*
- 公式: [Tencent-Hunyuan/Hunyuan3D-2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2)
- Gradio: [gradio.app](https://www.gradio.app/)
- 関連サンプル:
  - [vLLM (OpenAI 互換, L4 GPU)](/examples/vllm-gpu) — 同じ no-proxy + L4 GPU パターン
  - [OpenCascade FEM (CAD→CAE→3D)](/examples/opencascade-fem) — 異なる 3D の物語（パラメトリック CAD・FEM・ブラウザ可視化）との比較
