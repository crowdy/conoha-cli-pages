# storage

オブジェクトストレージ (Swift 互換) のコンテナとオブジェクトを管理するコマンドグループです。

## storage account

アカウントの集計情報 (コンテナ数 / オブジェクト数 / 使用量) を表示します。

### 使い方

```bash
conoha storage account
```

---

## storage container

### list

コンテナ一覧を表示します (`Name` / `Count` / `Size`)。

```bash
conoha storage container list
```

### create

コンテナを新規作成します。

```bash
conoha storage container create <name>
```

### delete

コンテナを削除します (確認プロンプトあり)。**配下のオブジェクトもすべて削除されます。**

```bash
conoha storage container delete <name>
```

---

## storage ls

コンテナ内のオブジェクト一覧を表示します (`Name` / `ContentType` / `Size` / `LastModified`)。

### 使い方

```bash
conoha storage ls <container>
```

---

## storage cp

ローカルとオブジェクトストレージの間でファイルをコピーします。コピー方向は引数の存在から自動判定されます: ソースがローカルに存在すればアップロード、しなければダウンロード。

### 使い方

```bash
conoha storage cp <src> <dst> [-r]
```

リモートパスは `container/object` 形式で指定します。

### オプション

| オプション | 説明 |
|-----------|------|
| `--recursive`, `-r` | ディレクトリを再帰的にコピー |

### 例

```bash
# アップロード
conoha storage cp myfile.txt mycontainer/myfile.txt

# ダウンロード
conoha storage cp mycontainer/myfile.txt ./myfile.txt

# 再帰アップロード（ディレクトリ全体）
conoha storage cp -r ./dir mycontainer/prefix

# 再帰ダウンロード
conoha storage cp -r mycontainer/prefix ./dir
```

### 動作

再帰モードでは進捗が `Copying [N/M] <path>` の形式で stderr に出力されます。個別ファイルの失敗は warning として記録され、最後に `Done: N/M files ...` で集計されます。1 件以上失敗するとコマンドの終了コードは非 0。

---

## storage rm

オブジェクトを削除します (確認プロンプトあり)。

### 使い方

```bash
conoha storage rm <container/object>
```

---

## storage publish

コンテナを公開状態にし、HTTP で読み取り可能にします。`X-Container-Read: .r:*` を設定する操作と等価。

### 使い方

```bash
conoha storage publish <container>
```

成功すると公開 URL が stderr に出力されます:

```
Container mycontainer is now public
Public URL: https://object-storage.<region>.conoha.io/v1/AUTH_<tenant>/mycontainer
```

---

## storage unpublish

コンテナの公開を取り消し、再び非公開にします。

### 使い方

```bash
conoha storage unpublish <container>
```
