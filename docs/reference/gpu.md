# gpu

GPU 付き VPS の初期プロビジョニングを支援するコマンドグループです。現在は `gpu setup` のみ提供されています。

## gpu setup

GPU 付き VPS に NVIDIA Container Toolkit + データセンター向けドライバを一気にインストールし、再起動して `nvidia-smi` で動作確認するワンショットコマンドです。

### 使い方

```bash
conoha gpu setup <server> [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--user`, `-l` | SSH ユーザー（デフォルト: `root`） |
| `--port`, `-p` | SSH ポート（デフォルト: `22`） |
| `--identity`, `-i` | SSH 秘密鍵のパス（未指定時は `~/.ssh/conoha_<KeyName>` を自動検出） |
| `--skip-reboot` | インストールのみ実行し、再起動はスキップ（後で手動再起動が必要） |
| `--reboot-timeout` | 再起動 → SSH 復活までの待機タイムアウト（デフォルト: `5m`） |

### 動作

1. apt ロック解放を待機（初回起動直後の `unattended-upgrades` を回避）
2. NVIDIA Container Toolkit をインストール（apt repo 追加 → `nvidia-ctk runtime configure` → `systemctl restart docker`）
3. NVIDIA データセンタードライバをインストール（`ubuntu-drivers install --gpgpu`）
4. サーバーを再起動（`--skip-reboot` でスキップ可能）
5. ACTIVE 復帰 + SSH 復活を待機
6. `nvidia-utils` をインストールして `nvidia-smi` を実行

各ステップは冪等で、再実行すると既に適用済みのものはスキップされます (例: docker daemon に `nvidia` ランタイムが登録済みなら再設定しない)。

### 前提条件

- Ubuntu 22.04 / 24.04
- Docker がインストール済み (ConoHa の `vmi-docker-*` イメージを推奨)
- GPU 付きフレーバー (例: `g2l-t-c12m48n-h100-1`)

### 例

```bash
# 標準: インストール → 再起動 → 検証
conoha gpu setup my-gpu

# 検証用に再起動スキップ
conoha gpu setup my-gpu --skip-reboot

# カスタムキー
conoha gpu setup my-gpu --identity ~/.ssh/custom_key
```

`--skip-reboot` を指定した場合、後で手動で再起動して `nvidia-smi` を実行する必要があります。

```bash
conoha server reboot my-gpu --wait
ssh -i ~/.ssh/conoha_<key> root@<ip> nvidia-smi
```

### Docker での GPU 動作確認

setup 完了後、CUDA コンテナでスモークテストできます:

```bash
docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi
```
