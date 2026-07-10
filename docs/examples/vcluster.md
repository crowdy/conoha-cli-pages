# vCluster（マルチテナント仮想 Kubernetes）デプロイ

[vCluster](https://github.com/loft-sh/vcluster)（loft-sh, Apache-2.0）は、ホスト Kubernetes クラスタの **1 つの namespace の中に「独自 API サーバを持つ仮想 k8s クラスタ」** を立てる OSS です。コントロールプレーンはテナントごとに隔離しつつ、ノード（データプレーン）はホストと共有するため、テナントに cluster-admin を渡しても安全、テナントごとに独自 CRD を持てる、実クラスタを複数立てるより軽量、というマルチテナンシーの有力な解になります。

このサンプルは、素の Linux ボックスである ConoHa VPS 1 台に **k3s（軽量シングルノード k8s）** を入れ、その上に vCluster で 2 つの隔離された仮想クラスタ（`tenant-a` / `tenant-b`）を立て、隔離を実際のコマンドで実証します。`dokploy` と同じく、`conoha app deploy` を使わない non-compose サンプルです。`conoha.yml` も `compose.yml` も持たず、`conoha server create` + `conoha server ssh` + シェルスクリプトだけで完結します。

::: warning このサンプルはデプロイ対象ではありません
`conoha app deploy` は使いません。本例には `conoha.yml` も `compose.yml` もなく、`conoha server create` で VPS を作り、`conoha server ssh` で入ってリポジトリ同梱のスクリプト（k3s インストール → vCluster 作成 → 隔離検証）を実行するだけの構成です。デプロイモードの違いは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を、同種の non-compose サンプルは [Dokploy](/examples/dokploy) を参照してください。
:::

## 完成イメージ

- ConoHa VPS 1 台の上で、`team-a` / `team-b` という 2 つの host namespace にそれぞれ仮想クラスタ `tenant-a` / `tenant-b` が立ち上がる
- `tenant-a` にだけ独自 CRD（`crontabs.stable.example.com`）を投入しても、`tenant-b` からも host からも見えない（CRD 隔離）
- `tenant-a` 内で cluster-admin 権限を持っていても、host に直接作った namespace（`host-only-ns`）や host の k3s システム Pod（`local-path-provisioner`）には触れない・見えない（cluster-admin 隔離）
- 両テナントのデモ Pod（nginx）は、syncer 経由で host の **同じノード** にスケジュールされる（データプレーン共有の実証）
- `scripts/03-verify.sh` を実行すると上記 3 種すべてが検証され、最終的に `ALL ISOLATION CHECKS PASSED` が出力される
- 仮想クラスタの作成自体は数秒〜数十秒で完了し、VPS をもう 1 台立てるよりはるかに軽量

## 位置づけ

マルチテナント Kubernetes には複数のアプローチがあり、vCluster はその中間に位置します。

| アプローチ | 隔離モデル | 代表実装 |
|---|---|---|
| ホスティッドコントロールプレーン | テナントごとに専用の control plane（API サーバ・etcd 等）を別ホストで動かす | Kamaji (Clastix) / k0smotron (Mirantis) |
| namespace 隔離 | 1 つの control plane を共有し、namespace 単位でポリシー・クォータを分離する | Capsule (Clastix) |
| **namespace 内の仮想コントロールプレーン** | ホストの 1 namespace の中に、テナント専用の仮想 API サーバを立てる | **vCluster** |

vCluster は namespace 隔離よりも強い分離（テナントに cluster-admin と独自 CRD / API バージョンを安全に渡せる）を持ちながら、ホスティッドコントロールプレーンほど重くない、という中間の特性を持ちます。データプレーン（ノード）は host と共有するため、実クラスタを複数用意するより軽量・高速に多数のテナント環境を用意できます。

## 前提条件

- conoha-cli がインストール・ログイン済み（[はじめに](/guide/getting-started)）
- ConoHa VPS3 アカウント、SSH キーペアが登録済み（`conoha keypair list` で名前を確認できる。[サーバー管理](/guide/server)）
- **`g2l-t-c4m4`（4 vCPU / 4GB）を推奨** / 最小 `g2l-t-c3m2`（3 vCPU / 2GB）。k3s + vcluster 2〜3 個なら 2〜4GB で足りる
  - **フレーバー名・イメージ名はリージョンや時期により異なる** — `conoha flavor list` / `conoha image list` で実在する名前を必ず確認すること
- **GPU 不要** — k3s + vCluster はいずれも CPU のみで動作する
- 手元に `git` / `bash` / `python3`
- SSH（ポート 22）を開けたセキュリティグループが必要。後述の `00-provision.sh` はデフォルトで `default IPv4v6-SSH` をアタッチする（`SECURITY_GROUPS` 環境変数で変更可能）

## セットアップ手順

リポジトリを取得し、`.env` を用意します。

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/vcluster
cp .env.example .env
```

`.env.example`（値は自分の環境に合わせて書き換える）を確認します。

```bash
# --- ConoHa server ---
SERVER_NAME=vcluster-host
FLAVOR=g2l-t-c4m4
IMAGE=ubuntu-24.04
KEY_NAME=<YOUR_KEYPAIR_NAME>
SECURITY_GROUPS=default IPv4v6-SSH

# --- Versions (pinned for reproducibility) ---
K3S_VERSION=v1.31.5+k3s1
VCLUSTER_VERSION=v0.24.1

# --- Virtual cluster namespaces on the host ---
TENANT_A_NS=team-a
TENANT_B_NS=team-b
```

`KEY_NAME` は自分の `conoha keypair list` に存在するキーペア名に書き換えてください。`FLAVOR` / `IMAGE` はリージョンや時期によって実在しない値になっている場合があるため、`conoha flavor list` / `conoha image list` で確認・置き換えてから進めます。

構成ファイルは以下の 6 本のスクリプトと 3 本の manifest です。

| ファイル | 実行場所 | 役割 |
|---|---|---|
| `scripts/00-provision.sh` | ローカル | `conoha server create` + SSH 到達待ち |
| `scripts/01-setup-host.sh` | VPS 上 | k3s + kubectl + vcluster CLI 導入 |
| `scripts/02-create-vclusters.sh` | VPS 上 | `tenant-a` / `tenant-b` 作成、デモ Pod・CRD 投入 |
| `scripts/03-verify.sh` | VPS 上 | 隔離 3 種の検証 |
| `scripts/smoke-test.sh` | ローカル | 上記を SSH 経由で束ねる e2e |
| `scripts/teardown.sh` | ローカル | 撤去（`--delete-server` で VPS も破棄） |
| `manifests/demo-pod.yaml` | — | 両テナントに投入する nginx デモ Pod |
| `manifests/tenant-a-crd.yaml` | — | `tenant-a` にのみ投入する CRD（`CronTab`） |
| `manifests/tenant-a-cr.yaml` | — | 上記 CRD のカスタムリソース |

### 自動 e2e（推奨）

`smoke-test.sh` は「作成 → k3s + vcluster 導入 → 仮想クラスタ 2 つ作成 → 隔離検証」までを一気に実行します。

```bash
bash scripts/smoke-test.sh
```

最後に `SMOKE TEST PASSED` が出れば成功です。

### 手動手順（各ステップを理解しながら進める場合）

```bash
# 1) VPS を作成し SSH 到達を待つ（ローカル実行）
bash scripts/00-provision.sh
```

`00-provision.sh` は `conoha server create` でサーバーを作成し（同名サーバーが既にあれば作成をスキップ）、`ACTIVE` になるまでポーリングしたあと、`ssh-keyscan` で新規ホストキーを `known_hosts` に登録して `conoha server ssh` が非対話で通ることを確認します。

```bash
# 2) VPS にログインし、リポジトリを clone
conoha server ssh vcluster-host

# --- 以降は VPS 上 ---
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/vcluster

# 3) k3s + kubectl + vcluster CLI を導入
bash scripts/01-setup-host.sh
```

`01-setup-host.sh` は `get.k3s.io` インストーラで k3s（`K3S_VERSION`、`--write-kubeconfig-mode 644`）を入れ、`kubectl` を `k3s` バイナリへのシンボリックリンクとして用意し、host ノードが `Ready` になるまで待機したあと、GitHub Releases から `vcluster` CLI（`VCLUSTER_VERSION`）を取得してインストールします。冪等に作られているため、既に導入済みなら該当ステップはスキップされます。

```bash
# 4) tenant-a / tenant-b を作成し、デモ Pod と CRD を投入
bash scripts/02-create-vclusters.sh
```

`02-create-vclusters.sh` は次の順に実行します。

1. `vcluster create tenant-a --namespace team-a --connect=false` / `vcluster create tenant-b --namespace team-b --connect=false` で 2 つの仮想クラスタを作成し、それぞれの control plane Pod が `Running` になるまで待機
2. `tenant-a` に **のみ** `manifests/tenant-a-crd.yaml`（`CronTab` CRD）を適用し、`kubectl wait --for=condition=Established` で確立を確認してから `manifests/tenant-a-cr.yaml`（カスタムリソース）を適用
3. 両テナントに `manifests/demo-pod.yaml`（nginx）を適用

```bash
# 5) 隔離 3 種を検証
bash scripts/03-verify.sh
```

## 隔離の確認

`scripts/03-verify.sh` が実行する検証を、実際のコマンドで手を動かして確認することもできます。

**1. CRD の隔離** — `tenant-a` に入れた CRD が `tenant-b` からも host からも見えないこと。

```bash
vcluster connect tenant-a --namespace team-a -- kubectl get crd crontabs.stable.example.com
# tenant-b からは見えない（NotFound になるはず）
vcluster connect tenant-b --namespace team-b -- kubectl get crd crontabs.stable.example.com
# host からも見えない（NotFound になるはず）
kubectl get crd crontabs.stable.example.com
```

**2. cluster-admin の隔離** — `tenant-a` 内の cluster-admin でも、host に直接作った namespace や host の k3s システム Pod には触れない・見えない。

```bash
kubectl create namespace host-only-ns
# tenant-a からは見えない（NotFound になるはず）
vcluster connect tenant-a --namespace team-a -- kubectl get namespace host-only-ns
# tenant-a の kube-system は仮想。host の local-path-provisioner は含まれない
vcluster connect tenant-a --namespace team-a -- kubectl get pods -n kube-system
```

**3. host ノードの共有** — 両テナントのデモ Pod が、syncer 経由で host の **同じノード** にスケジュールされる。

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get pods -n team-a -o wide   # tenant-a の同期実 Pod
kubectl get pods -n team-b -o wide   # tenant-b の同期実 Pod（同じ NODE 列になるはず）
```

`bash scripts/03-verify.sh` を実行すればこれらすべてを自動でチェックし、いずれかが崩れていれば非ゼロ終了で失敗理由を表示します。全て通れば `ALL ISOLATION CHECKS PASSED` が出力されます。

仮想クラスタに対話的に入りたい場合は、クラウド VPS には LoadBalancer が無いため vCluster 内蔵の port-forward を使います。

```bash
vcluster connect tenant-a --namespace team-a
# 別ターミナルで:
kubectl get pods -A     # tenant-a から見た「自分専用クラスタ」
# 終了:
vcluster disconnect
```

## カスタマイズ

- **3 つ目のテナントを追加する**: 同じ流れで `tenant-c` を host namespace `team-c` に作成できます。

  ```bash
  vcluster create tenant-c --namespace team-c --connect=false
  vcluster connect tenant-c --namespace team-c -- kubectl apply -f manifests/demo-pod.yaml
  ```

  必要なら `manifests/tenant-a-crd.yaml` / `manifests/tenant-a-cr.yaml` を `tenant-c` にも適用し、CRD 隔離が 3 テナント間でも保たれることを確認できます。

- **テナントごとのリソース制限**: 各仮想クラスタの control plane（vCluster 自身の Pod）のリソース要求・上限は `vcluster create` の `--values` / `--set` オプションで調整できます（詳細は vCluster 公式ドキュメント参照）。またデータプレーン側は、各テナントが host の 1 namespace（`team-a` / `team-b`）に対応しているため、host 側でその namespace に通常の Kubernetes `ResourceQuota` / `LimitRange` を適用すれば、テナントが消費できる CPU・メモリの総量を制限できます。

## ハマりどころ

::: warning RAM が足りないと k3s ごと OOM する
最小構成の `g2l-t-c3m2`（3 vCPU / 2GB）は k3s 本体だけでも 2GB のうち相当量を消費します。仮想クラスタを 2〜3 個までなら 2〜4GB で足りますが、テナントを増やしたりワークロードを載せたりする場合は `g2l-t-c4m4`（4 vCPU / 4GB）以上を推奨します。
:::

::: warning フレーバー名・イメージ名はリージョン・時期でずれる
`.env.example` の `FLAVOR=g2l-t-c4m4` / `IMAGE=ubuntu-24.04` はあくまで参考値です。実際には `ubuntu-24.04` という素の Ubuntu ベースイメージが存在しない環境もあります。作成に失敗したら `conoha flavor list` / `conoha image list` で実在する名前・ID を確認し、`.env` を書き換えてください。
:::

::: warning k3s / vcluster のバージョンはピン止め
再現性のため `K3S_VERSION=v1.31.5+k3s1` / `VCLUSTER_VERSION=v0.24.1` に固定されています。新しいバージョンを試す場合は `.env` の値を書き換えてから `01-setup-host.sh` を再実行してください（`latest` 追従は推奨しません）。
:::

::: warning API サーバを NodePort で外部公開するのは危険
外部の kubectl から直接繋ぎたい場合、`vcluster connect --expose` で NodePort/LoadBalancer 経由の kubeconfig を生成できますが、API サーバをそのまま外部公開するのは危険です。ConoHa のセキュリティグループで接続元 IP を必ず絞り、検証が終わったら閉じるか `bash scripts/teardown.sh --delete-server` で VPS ごと破棄してください。
:::

::: warning VPS を作り直すと SSH ホストキーが変わる
ConoHa の public IP は VPS を削除すると別のサーバーに再利用されることがあります。`00-provision.sh` はサーバー IP に対する `known_hosts` の古いエントリを `ssh-keygen -R` で毎回削除してから `ssh-keyscan` を登録し直すため通常は問題になりませんが、`conoha server ssh` を手動実行して "host key verification failed" が出た場合はこの節を思い出してください。
:::

## 撤去

```bash
# 仮想クラスタ削除 + k3s アンインストール（VPS は残す）
bash scripts/teardown.sh

# VPS ごと破棄（ブートボリュームも削除）
bash scripts/teardown.sh --delete-server
```

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の vcluster](https://github.com/crowdy/conoha-cli-app-samples/tree/main/vcluster)
- vCluster 公式: [vcluster.com/docs](https://www.vcluster.com/docs) / [loft-sh/vcluster](https://github.com/loft-sh/vcluster)
- conoha-cli: [はじめに](/guide/getting-started)
- 関連サンプル:
  - [KubeVirt プロビジョナー (k3s + VM)](/examples/kubevirt-provisioner) — 同じ k3s ホスト上で仮想マシンを管理する、`conoha app deploy`（proxy モード）対応のもう 1 つの Kubernetes サンプル
  - [Dokploy (セルフホスティング PaaS)](/examples/dokploy) — 本例と同じく `conoha server create` + `conoha server ssh` + スクリプトで完結する non-compose パターン
