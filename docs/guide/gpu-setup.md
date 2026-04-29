# GPU セットアップ

GPU 付き ConoHa VPS を NVIDIA データセンタードライバ + Container Toolkit で初期化するワンショットコマンド `conoha gpu setup` の使い方を案内します。

## 前提条件

- GPU 付きフレーバー (例: `g2l-t-c12m48n-h100-1`) で作成された VPS
- Ubuntu 22.04 / 24.04
- Docker と docker compose plugin がインストール済み

::: tip 推奨イメージ
ConoHa が提供する `vmi-docker-*-ubuntu-*-amd64` イメージは Docker と Compose が事前導入されています。

```bash
conoha image list --filter name~vmi-docker
```
:::

## ワンショット実行

```bash
conoha gpu setup my-gpu-server
```

成功するまで以下の 6 フェーズを順に実行します。

1. apt ロック解放を待機 (初回起動直後の `unattended-upgrades` を避ける)
2. NVIDIA Container Toolkit インストール (apt repo 追加 → `nvidia-ctk runtime configure` → docker 再起動)
3. NVIDIA データセンタードライバインストール (`ubuntu-drivers install --gpgpu`)
4. サーバー再起動
5. ACTIVE + SSH 復活を待機 (デフォルト 5 分)
6. `nvidia-utils` インストール → `nvidia-smi` で確認

各ステップは冪等で、再実行すると既に適用済みのものはスキップされます。

## オプション

| オプション | 説明 |
|-----------|------|
| `--skip-reboot` | 再起動をスキップ (後で `conoha server reboot --wait` を手動実行) |
| `--reboot-timeout` | 再起動 → SSH 復活までの待機タイムアウト (デフォルト: `5m`) |
| `--identity`, `-i` | SSH 秘密鍵パス (未指定時は自動検出) |
| `--user`, `-l` / `--port`, `-p` | SSH ユーザーとポート |

詳細は [`gpu` リファレンス](/reference/gpu) を参照してください。

## 動作確認

setup 完了後、`nvidia-smi` で GPU が見えれば成功:

```bash
conoha server ssh my-gpu-server -- nvidia-smi
```

Docker 経由でも CUDA コンテナを動かして確認:

```bash
conoha server ssh my-gpu-server -- docker run --rm --gpus all \
  nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi
```

## トラブルシューティング

### apt ロックで止まる

初回起動直後の `unattended-upgrades` がロックを保持している可能性があります。`conoha gpu setup` は最大 5 分待機しますが、それでも解放されない場合は SSH 接続して `systemctl status unattended-upgrades` を確認してください。

### `--skip-reboot` 後に `nvidia-smi` がない

ドライバを反映するために手動で再起動が必要です。

```bash
conoha server reboot my-gpu-server --wait
conoha server ssh my-gpu-server -- nvidia-smi
```

### ドライババージョンを固定したい

`conoha gpu setup` は `ubuntu-drivers install --gpgpu` を呼ぶだけで、ドライババージョンの個別固定はサポートしていません。固定が必要なら `--skip-reboot` で setup → SSH で `apt install nvidia-driver-<version>-server` 等を手動実行してください。

## 関連ページ

- [`gpu` リファレンス](/reference/gpu) — フラグ詳細
- [サーバー管理](/guide/server) — サーバー作成と SSH 接続
