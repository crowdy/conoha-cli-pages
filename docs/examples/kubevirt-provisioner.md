# KubeVirt Provisioner デプロイ

このサンプルは 1 台の ConoHa VPS の中だけで「Kubernetes クラスタ + 仮想マシンホスト」を丸ごと動かします。**k3s**（軽量 Kubernetes、単一の特権コンテナとして実行）の上に **[KubeVirt](https://kubevirt.io/)** を載せ、その上で FastAPI 製の provisioner API が Ubuntu の仮想マシンを作成・起動・停止・削除します。ブラウザからはシリアルコンソール（xterm.js）でゲスト OS に直接ログインでき、VM の中身を触りながら KubeVirt の動作を体験できます。proxy モードの `conoha app deploy` 1 発でこの構成全体（k3s・KubeVirt・provisioner API）が組み上がるのが見どころです。

最大の特徴は **ソフトウェアエミュレーションではなくハードウェア KVM で動く**ことです。ConoHa VPS3 は `/dev/kvm` をゲストに露出しており、これを k3s コンテナへそのまま渡すことで、KubeVirt はソフトウェアエミュレーション（10〜100 倍遅い）ではなく本物のハードウェア仮想化でゲストを起動します。実測でゲストの初回起動は ~80 秒（コンテナイメージの pull を含む）、2 回目以降の再起動は ~15 秒です。

::: tip proxy モードで動作します（`conoha.yml` 同梱）
HTTPS 終端は conoha-proxy が担当します。ただし `k3s` はステートフルかつ特権コンテナのため `blue_green: false` で固定インスタンス運用です。proxy モードと `--no-proxy` の違いは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。
:::

## 完成イメージ

- `https://<あなたの FQDN>` を開くと、上部バナーに KubeVirt の状態（初期化中 → ready）が表示される
- 「Create VM」ボタンで Ubuntu VM を作成すると、一覧に行が増え status が `Starting` → `Running` に遷移する
- 「Console」ボタンでブラウザ内シリアルコンソール（xterm.js）が開き、ゲスト Ubuntu に `ubuntu` ユーザーでログインできる
- VM の起動・停止（start/stop）・削除がすべて Web UI 上のワンクリック操作で完結する
- REST API（`GET /api/vms` など）を直接叩いて VM の一覧・状態を取得できる

![kubevirt-provisioner の画面。VM 一覧とシリアルコンソールが表示されている](/examples/kubevirt-provisioner/screenshot.png)

## アーキテクチャ

```
  ブラウザ ──HTTPS(conoha-proxy:443)──▶ api (FastAPI :8080, web)
                                          │  REST: VM 作成/一覧/起動/停止/削除
                                          │  WS  : /api/vms/{name}/console (xterm.js)
                                          │  kubeconfig(共有ボリューム, server→https://k3s:6443, クライアント証明書)
                                          ▼
                          k3s (単一特権コンテナ = クラスタ全体)
                            ├ KubeVirt control plane (virt-operator/api/controller/handler)
                            └ vms ns: VirtualMachine ─▶ VMI ─▶ virt-launcher pod (QEMU + /dev/kvm)
                                          ▲
                  kubevirt-bootstrap (one-shot): KubeVirt を apply して終了
```

| サービス | 役割 | 種別 |
|---|---|---|
| `api` | FastAPI provisioner + Web UI + コンソールブリッジ | `web`（`blue_green: false`） |
| `k3s` | クラスタ全体（KubeVirt control plane と VM がここで動く） | accessory（特権コンテナ） |
| `kubevirt-bootstrap` | KubeVirt を 1 回 apply して終了する one-shot ジョブ | accessory |

`api` は Kubernetes / KubeVirt の API サーバーを直接叩く薄いレイヤーです。VM の実体（`VirtualMachine` → `VirtualMachineInstance` → `virt-launcher` Pod）はすべて `k3s` コンテナの中に存在し、`api` はそこへの操作窓口とシリアルコンソールの WebSocket ブリッジ（KubeVirt の serial-console subresource、subprotocol `plain.kubevirt.io`）だけを提供します。

## 前提条件

- conoha-cli がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- conoha-proxy がブート済み（[conoha-proxy セットアップ](/guide/proxy-setup)）
- **1 つの DNS A レコード**をサーバー IP に向けていること（`conoha.yml` の `hosts:` を自分の FQDN に書き換える。[DNS / TLS](/guide/dns-tls)）
- **ConoHa VPS3 が `/dev/kvm` を露出していること** — 本サンプルはこれを前提にハードウェア KVM でゲストを動かします（[ハマりどころ](#ハマりどころ) で確認方法を解説）
- k3s + KubeVirt + VM ゲストを同時に動かせるだけの CPU/RAM を持つフレーバー（推奨 `g2l-t-c6m8` = 6 vCPU / 8GB。KVM 加速のため 8GB で 1〜2 VM が快適に動く。[サーバー管理](/guide/server)）

## compose.yml (抜粋)

完全版は [`kubevirt-provisioner/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/kubevirt-provisioner/compose.yml)。重要部分を抜粋します。

```yaml
services:
  # The whole Kubernetes cluster in one privileged container. Runs the KubeVirt
  # control plane and the guest virt-launcher pods (with hardware KVM). Stateful +
  # privileged single instance — cannot be duplicated per blue/green slot.
  k3s:
    image: rancher/k3s:v1.31.5-k3s1
    privileged: true
    # virt-handler bind-mounts /var/run/kubevirt with Bidirectional propagation,
    # which requires /var/run (a tmpfs here) to be a SHARED mount. Make the tmpfs
    # mounts rshared BEFORE k3s starts, or virt-handler fails CreateContainerError
    # ("not a shared mount") and KubeVirt never goes Available. (See SPIKE_NOTES.md.)
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        mount --make-rshared / 2>/dev/null || true
        mount --make-rshared /run 2>/dev/null || true
        mount --make-rshared /var/run 2>/dev/null || true
        exec /bin/k3s server \
          --disable=traefik \
          --disable=servicelb \
          --disable=metrics-server \
          --tls-san=k3s \
          --write-kubeconfig=/output/kubeconfig.yaml \
          --write-kubeconfig-mode=644
    tmpfs:
      - /run
      - /var/run
    devices:
      # Hardware KVM. Present on ConoHa VPS3. On a host without /dev/kvm, remove
      # this line and apply manifests/kubevirt-cr-emulation.yaml (slow emulation).
      - /dev/kvm:/dev/kvm
    volumes:
      - k3s-data:/var/lib/rancher/k3s
      - kubeconfig:/output
      - /lib/modules:/lib/modules:ro

  # One-shot: applies pinned KubeVirt and exits. Re-running is idempotent.
  kubevirt-bootstrap:
    build: ./bootstrap
    volumes:
      - kubeconfig:/output
      - ./manifests:/manifests:ro
    depends_on:
      k3s:
        condition: service_healthy
    restart: "no"

  # FastAPI provisioner = the conoha `web` service.
  api:
    build: .
    environment:
      - SOURCE_KUBECONFIG=/output/kubeconfig.yaml
      - K3S_SERVER=https://k3s:6443
      - GUEST_IMAGE=${GUEST_IMAGE:-quay.io/containerdisks/ubuntu:24.04}
      - GUEST_MEMORY=${GUEST_MEMORY:-2Gi}
      - GUEST_CPU=${GUEST_CPU:-1}
      - MAX_RUNNING_VMS=${MAX_RUNNING_VMS:-1}
    expose:
      - "8080"
    volumes:
      - kubeconfig:/output:ro
    depends_on:
      # service_started (NOT service_healthy): api boots and answers /health (200)
      # immediately so the conoha-proxy probe passes; the entrypoint waits for the
      # kubeconfig file and routes return 503 until the cluster is reachable.
      k3s:
        condition: service_started
```

`api` は自分の kubeconfig を持たず、`k3s` サービスが `--write-kubeconfig` で書き出したファイルを共有ボリューム（`kubeconfig` volume）経由で読み込みます。`entrypoint.sh` はこのファイルが現れるまで待機してから `uvicorn` を起動します。認証はこの kubeconfig に含まれる k3s admin のクライアント証明書で行われ、REST 操作とシリアルコンソールの WebSocket ブリッジの両方に使われます。

## conoha.yml

```yaml
name: kubevirt-provisioner
# Replace with your own FQDN before running `conoha app init`.
hosts:
  - kubevirt.example.com
web:
  service: api
  port: 8080
  # k3s is a privileged, stateful single instance (cluster state + containerd
  # images live in the k3s-data volume); slots cannot be duplicated.
  blue_green: false
health:
  path: /health
  # 120 x 5s = 600s. Headroom for the cold first-boot k3s image pull + start.
  # /health returns 200 as soon as the api process is up (api uses
  # depends_on service_started); KubeVirt readiness is /api/status.
  unhealthy_threshold: 120
accessories:
  - k3s
  - kubevirt-bootstrap
```

**`blue_green: false` の理由：** `k3s` コンテナはこのサンプルの中で唯一かつ全体を構成するクラスタそのものです。クラスタの状態（etcd 相当のデータ）とコンテナイメージのキャッシュは `k3s-data` ボリュームに永続化されており、`privileged: true` で動く特権コンテナでもあります。blue/green スロットを複製すると、クラスタが 2 つできてしまい `kubeconfig` がどちらを指すか不定になる、あるいは `/dev/kvm` のような特権デバイスを 2 つのコンテナが同時に奪い合うといった破綻が起きます。そのため `web.blue_green: false` で `api` を含めクラスタ全体を単一インスタンス固定にしています。

**`unhealthy_threshold: 120`（600 秒）の理由：** 初回デプロイでは `k3s` イメージの pull、k3s の起動、`kubevirt-bootstrap` による KubeVirt の apply が順に走ります。`api` プロセス自体は kubeconfig の有無を待たずすぐに `/health` へ 200 を返しますが（`depends_on: service_started` なので）、conoha-proxy のプローブがコールドスタート中の重い pull 処理と競合しないよう、デフォルトの `unhealthy_threshold: 3`（15 秒）よりはるかに広い 600 秒の余裕を持たせています。KubeVirt そのものの準備状況は `/health` ではなく `/api/status` で個別に確認します。

## デプロイ

```bash
conoha server create --name kubevirt --flavor g2l-t-c6m8 --image ubuntu-24.04 --key mykey

git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/kubevirt-provisioner

# conoha.yml の hosts[0] を自分の FQDN に書き換える
$EDITOR conoha.yml
```

```bash
# 伝播確認
dig +short kubevirt.example.com
```

```bash
conoha proxy boot --acme-email you@example.com kubevirt   # サーバーごとに 1 回

conoha app init kubevirt

conoha app deploy kubevirt   # 初回は k3s + KubeVirt のイメージ pull で数分かかる
```

`conoha app logs kubevirt` でログを確認しながら待機してください。完了後 `https://kubevirt.example.com` を開きます。

## 動作確認

ブラウザで `https://kubevirt.example.com` を開き、上部バナーが `ready` になるのを確認してから:

1. 「Create VM」で任意の名前・パスワードを入力し、VM を作成する
2. 一覧の status が `Starting` → `Running` に変わるのを待つ（初回は ~80 秒、2 回目以降は ~15 秒）
3. 「Console」をクリックし、ブラウザ内シリアルコンソール（xterm.js）でログインプロンプトが表示されることを確認する（`ubuntu` ユーザー / 作成時に入力したパスワード）
4. Start / Stop / Delete の各操作が一覧上で反映されることを確認する

REST API を直接叩くこともできます:

```bash
# KubeVirt の準備状況
curl -s https://kubevirt.example.com/api/status

# VM 一覧
curl -s https://kubevirt.example.com/api/vms

# VM 作成
curl -s -X POST https://kubevirt.example.com/api/vms \
  -H 'Content-Type: application/json' \
  -d '{"name": "demo", "password": "your-guest-password"}'
```

## カスタマイズ

- **ゲストイメージの変更**: `GUEST_IMAGE` 環境変数（既定値 `quay.io/containerdisks/ubuntu:24.04`）を `conoha app env set` で上書きすると、別の [containerDisk](https://kubevirt.io/user-guide/virtual_machines/disks_and_volumes/#containerdisk) イメージを使えます
- **ゲストのスペック変更**: `GUEST_MEMORY`（既定 `2Gi`）・`GUEST_CPU`（既定 `1`）でゲスト 1 台あたりのメモリ・vCPU 数を調整できます。VPS のフレーバー上限を超えないよう注意してください
- **同時起動 VM 数の上限**: `MAX_RUNNING_VMS`（既定 `1`）で RAM 保護のための同時起動上限を変更できます。8GB フレーバーで 1〜2 VM が目安です

```bash
conoha app env set kubevirt \
  GUEST_IMAGE=quay.io/containerdisks/ubuntu:24.04 \
  GUEST_MEMORY=4Gi \
  GUEST_CPU=2 \
  MAX_RUNNING_VMS=2

conoha app deploy kubevirt
```

## ハマりどころ

::: warning `/dev/kvm` が無い環境ではソフトウェアエミュレーションが必要
本サンプルは ConoHa VPS3 が `/dev/kvm` をゲストに露出していることを前提にしています。別のホストで動かす場合、`compose.yml` の `k3s` サービスから `devices: ["/dev/kvm:/dev/kvm"]` を外し、`manifests/kubevirt-cr.yaml` の代わりに `manifests/kubevirt-cr-emulation.yaml`（`useEmulation: true`）を apply してください。ソフトウェアエミュレーションは 10〜100 倍遅くなります。ConoHa VPS3 では不要な対応です。`/dev/kvm` の存在確認は `conoha app exec kubevirt -- ls -la /dev/kvm`（`k3s` コンテナ内）で行えます。
:::

::: warning 初回起動は最大 600 秒かかる
`unhealthy_threshold: 120`（120 × 5 秒 = 600 秒）は伊達ではありません。初回デプロイでは `k3s` イメージの pull、k3s 自体の起動、`kubevirt-bootstrap` による KubeVirt の apply が順番に走るため、`/api/status` が `available: true` を返すまで数分かかることがあります。焦らず `conoha app logs kubevirt` でログを追ってください。
:::

::: warning `blue_green: false` を外さないこと
`k3s` はクラスタの状態（`k3s-data` ボリューム）を持つ特権のステートフルコンテナです。`web.blue_green` を `true` に変更してデプロイすると、クラスタが二重化されて `kubeconfig` の指す先が不定になったり、`/dev/kvm` のような特権デバイスの奪い合いが発生したりします。本サンプルの構成では常に `false` のままにしてください。
:::

::: warning `privileged: true` はセキュリティ上重要な妥協
`k3s` サービスはホスト上で `privileged: true` かつ `/dev/kvm` を直接マウントして動作します。KubeVirt が仮想マシンを起動するために必須の構成ですが、実質的にホストへの強い権限を持つコンテナです。信頼できないゲストイメージを動かさない、`api` への外部アクセスを適切に制限するなど、通常の Docker アプリよりも一段強い運用上の注意が必要です。
:::

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の kubevirt-provisioner](https://github.com/crowdy/conoha-cli-app-samples/tree/main/kubevirt-provisioner)
- KubeVirt: [kubevirt.io](https://kubevirt.io/) / [kubevirt/kubevirt](https://github.com/kubevirt/kubevirt)
- k3s: [k3s.io](https://k3s.io/)
- 関連サンプル:
  - [vCluster (マルチテナント仮想 k8s)](/examples/vcluster) — 同じ「1 台の VPS で k8s を動かす」系統の別アプローチ（仮想クラスタによるマルチテナント分離）
