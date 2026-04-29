# flavor

VPS のフレーバー (CPU / RAM / ディスク構成) を確認するコマンドグループです。フレーバーの作成・変更は API では提供されておらず、CLI からは閲覧のみ可能です。

## flavor list

利用可能なフレーバーを一覧表示します。VCPUs → RAM の昇順でソートされます。

### 使い方

```bash
conoha flavor list [flags]
```

table 出力時には末尾に「一部のフレーバーは利用制限されている場合があります」という注記が出ます。利用できないフレーバーがあれば [ConoHa サポート](https://www.conoha.jp/conoha/contact/) に問い合わせてください。

---

## flavor show

特定フレーバーの詳細を表示します。

### 使い方

```bash
conoha flavor show <id>
```

`<id>` には `flavor list` の `ID` 列の値を指定します。
