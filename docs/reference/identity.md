# identity

API クレデンシャル、サブユーザー、ロールを管理するコマンドグループです。

## identity credential

API アクセスに使うクレデンシャル (ユーザー名・パスワードなど) を管理します。

### list

クレデンシャル一覧を表示します。

```bash
conoha identity credential list
```

### show

特定クレデンシャルの詳細を表示します。

```bash
conoha identity credential show <id>
```

### delete

クレデンシャルを削除します (確認プロンプトあり)。

```bash
conoha identity credential delete <id>
```

`--yes` (グローバルフラグ) で確認をスキップできます。

---

## identity subuser

サブユーザーを管理します。サブユーザーの作成は ConoHa コントロールパネル経由で行います — CLI からは閲覧と削除のみ可能です。

### list

サブユーザー一覧を表示します。

```bash
conoha identity subuser list
```

出力には `ID` / `Name` / `Enabled` が含まれます。

### delete

サブユーザーを削除します (確認プロンプトあり)。

```bash
conoha identity subuser delete <id>
```

---

## identity role

ロール情報を表示します。

### list

ロール一覧を表示します。

```bash
conoha identity role list
```

ロールの作成・変更は API では提供されません — 閲覧のみ可能です。
