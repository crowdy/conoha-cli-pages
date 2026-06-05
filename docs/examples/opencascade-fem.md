# OpenCascade FEM デプロイ

CAD 形状を組み → メッシュを切り → 線形弾性 FEM を解いて → ブラウザに 3D 表示。商用 CAE の中で完結するワークフローを、すべてオープンソース + 単一 Docker コンテナで再現するサンプルです。

::: tip 本例は proxy モード対応 (`conoha.yml` 同梱)
HTTPS 終端は conoha-proxy が担当します。no-proxy で動かす場合は末尾の [no-proxy で動かす](#no-proxy-で動かす) を参照してください。
:::

## 完成イメージ

- ブラウザで `bracket` / `plate_hole` / `cantilever_ibeam` の 3 形状をパラメトリックに調整
- 「実行」を押すと SSE で `queued → shape → mesh → assemble → solve → postproc → done` の進捗が逐次配信される
- vtk.js で von Mises 応力分布を 3D 表示・回転・ズーム
- ジョブ完了後 30 分は結果が残り、TTL リーパで自動掃除

![opencascade-fem screenshot](/examples/opencascade-fem/screenshot.png)

## 前提条件

- ConoHa CLI がインストール・ログイン済み ([はじめに](/guide/getting-started))
- サーバーが作成済み ([`--for proxy` プリセット推奨](/guide/server#プリセット-for))
- ドメインを用意し、A レコードを VPS の IP に向けている ([DNS / TLS](/guide/dns-tls))
- conoha-proxy がブート済み ([conoha-proxy セットアップ](/guide/proxy-setup))

::: warning RAM 推奨
gmsh + scikit-fem + OpenCascade を同時に動かすため、**2GB 以上のメモリ** を推奨します (`g2l-t-2` 以上)。デフォルト設定の `MAX_CONCURRENT=2` でピーク時 ~1.5GB を消費します。
:::

## スタック

| 役割 | 採用ライブラリ |
|---|---|
| CAD | pythonocc-core 7.9 (OpenCascade の Python バインディング、conda-forge) |
| Mesh | gmsh 4.15 (OpenCascade ジオメトリを四面体メッシュ化) |
| Solver | scikit-fem 10.x + `scipy.sparse.linalg.spsolve` (線形弾性、CPU) |
| API | FastAPI + uvicorn (SSE 進捗ストリーミング) |
| Frontend | vanilla JS + vtk.js (CDN ESM、importmap で依存解決) |
| Container | micromamba ベース、約 1GB の単一イメージ |

## 1. compose.yml

完全版は [`opencascade-fem/compose.yml`](https://github.com/crowdy/conoha-cli-app-samples/blob/main/opencascade-fem/compose.yml)。要点だけ抜粋します。

```yaml
services:
  web:
    build: .
    expose: ["8000"]   # ホストには公開しない (proxy が振り分ける)
    environment:
      OCFEM_MAX_CONCURRENT: "2"
      OCFEM_MAX_ELEMENTS: "200000"
      OCFEM_SOLVER_TIMEOUT_SECONDS: "60"
      OCFEM_JOB_TTL_SECONDS: "1800"
    volumes:
      - jobs:/app/jobs   # 結果ファイルの一時保管 (TTL リーパが定期掃除)
volumes:
  jobs: {}
```

::: warning `expose` を `ports` にしないこと
proxy モードでは `expose:` を使ってコンテナ側ポートだけを宣言します。`ports:` で公開すると blue/green スロットが衝突します。詳しくは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。
:::

## 2. conoha.yml

```yaml
name: opencascade-fem
hosts:
  - opencascade-fem.example.com
web:
  service: web
  port: 8000
```

`hosts:` は自分の FQDN に書き換えてください。`port: 8000` は compose の `expose: ["8000"]` と一致させます。

## 3. デプロイ

```bash
git clone https://github.com/crowdy/conoha-cli-app-samples
cd conoha-cli-app-samples/opencascade-fem

# conoha.yml の hosts: を自分のドメインに編集
$EDITOR conoha.yml

# proxy がブートしていなければ
conoha proxy boot --acme-email you@example.com <サーバー名>

conoha app init <サーバー名>
conoha app deploy <サーバー名>
```

初回ビルドは micromamba + OpenCascade + gmsh のセットアップで 5〜10 分かかります。2 回目以降はレイヤキャッシュで 1 分以内に収まります。

## 4. 動作確認

### ブラウザで開く

`https://opencascade-fem.example.com/` でフロントエンドが表示されます。

1. 左ペインで形状 (`bracket` / `plate_hole` / `cantilever_ibeam`) を選択
2. パラメータ (寸法・厚み・穴半径など) を調整
3. **実行** を押すと右ペインで SSE 進捗が流れ、完了後に応力分布が 3D 表示される

### API を直接叩く

ジョブ投入:

```bash
curl -X POST https://opencascade-fem.example.com/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "shape": {"kind": "plate_hole", "params": {"length": 100, "width": 50, "thickness": 5, "hole_radius": 10}},
    "mesh_size": 5.0,
    "material": {"E": 210e9, "nu": 0.3},
    "load": {"magnitude": 1e7}
  }'
# => {"job_id": "..."}
```

SSE で進捗を購読:

```bash
curl -N https://opencascade-fem.example.com/jobs/<JOB_ID>/events
# data: {"stage": "queued", ...}
# data: {"stage": "shape", "t_ms": 42, ...}
# data: {"stage": "mesh", "t_ms": 1234, ...}
# data: {"stage": "assemble", ...}
# data: {"stage": "solve", ...}
# data: {"stage": "done", ...}
```

結果ダウンロード (VTP 形式):

```bash
curl -O https://opencascade-fem.example.com/jobs/<JOB_ID>/result.vtp
```

### `/shapes` カタログ

```bash
curl https://opencascade-fem.example.com/shapes | jq .
```

3 形状それぞれのパラメータレンジと境界条件メタデータが返ります。

## ギャラリーの 3 形状

| kind | パラメータ | 境界条件 |
|---|---|---|
| `bracket` | base_len, base_thk, wall_h, wall_thk, width | 底面 fixed / 壁面上端に +Z 方向 traction |
| `plate_hole` | length, width, thickness, hole_radius | 短辺 X=0 fixed / X=L で +X 方向引張 (Kirsch 応力集中) |
| `cantilever_ibeam` | length, height, flange_w, flange_t, web_t | 壁面 X=0 fixed / 自由端 X=L で +X 方向引張 |

## チューニング

| 環境変数 | デフォルト | 説明 |
|---|---|---|
| `OCFEM_MAX_CONCURRENT` | 2 | 同時実行ジョブの上限 |
| `OCFEM_MAX_ELEMENTS` | 200000 | 1 ジョブのメッシュ要素数の上限 |
| `OCFEM_SOLVER_TIMEOUT_SECONDS` | 60 | ソルバーのウォールクロック上限 |
| `OCFEM_JOB_TTL_SECONDS` | 1800 | ジョブディレクトリの保持時間 |

CPU コア数に応じて `OCFEM_MAX_CONCURRENT` を増やす場合、メモリも線形に伸びる点に注意 (1 ジョブあたり 200k 要素で ~700MB)。

## ハマりどころ

### ソルバータイムアウトはバックグラウンドジョブを止めない

`OCFEM_SOLVER_TIMEOUT_SECONDS` は HTTP 応答だけ打ち切ります。CPython の `ThreadPoolExecutor` スレッドは協調的にしか停止できないため、実際の計算はバックグラウンドで継続します。タイムアウトしたジョブが連続すると CPU を占有したままになる可能性があります。

**対策**: `OCFEM_MAX_ELEMENTS` を保守的に保ち、フロントエンドからの `mesh_size` 検証で長時間ジョブを未然に弾く。本サンプルはこの方針を採用しています。

### vtk.js には Unstructured Grid Reader が無い

結果ファイルは表面 PolyData (VTP) のみ。テト体積メッシュではなく境界三角形だけをエクスポートします。

- 応力集中などの**表面現象**は十分可視化できる
- **内部の体積場**は表示されない

### 線形・小変形・等方性のみ

塑性・接触・動解析・モーダル・流体・熱は対象外。本サンプルは「単一コンテナで CAD → FEM → 可視化が一通り動く」ことを示すデモであって、商用 CAE の置き換えではありません。

### ジョブ状態はインメモリ

コンテナ再起動でジョブ履歴は消失します。永続化が必要なら結果 VTP を S3 互換ストレージへ流す、または PostgreSQL でジョブメタデータを保持するなどの拡張が必要です。

## no-proxy で動かす

HTTPS が不要 (社内・開発用) で proxy を立てたくない場合は `--no-proxy` を明示します。

```bash
conoha app deploy <サーバー名> --no-proxy
```

このサンプルは `conoha.yml` を同梱しているため、no-proxy 指定は明示的に必要です。proxy / no-proxy の使い分けは [アプリデプロイ — モードの比較](/guide/app-deploy#モードの比較) を参照してください。

## 関連リンク

- レシピ本体: [crowdy/conoha-cli-app-samples の opencascade-fem](https://github.com/crowdy/conoha-cli-app-samples/tree/main/opencascade-fem)
- 検証記: [Qiita — ConoHa VPS3 + conoha-cli で OpenCascade + scikit-fem の CAE Web アプリを 1 台にデプロイ](https://qiita.com/crowdy)
- pythonocc-core: [tpaviot/pythonocc-core](https://github.com/tpaviot/pythonocc-core)
- gmsh: [gmsh.info](https://gmsh.info/)
- scikit-fem: [scikit-fem ドキュメント](https://scikit-fem.readthedocs.io/)
- vtk.js: [vtk.js ドキュメント](https://kitware.github.io/vtk-js/)
- 関連サンプル: [vLLM (OpenAI 互換 LLM サーバー)](/examples/vllm-gpu) — SSE ストリーミングつながり
