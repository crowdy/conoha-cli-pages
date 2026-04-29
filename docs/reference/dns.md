# dns

ConoHa DNS のドメインとレコードを管理するコマンドグループです。proxy モードで Let's Encrypt の HTTP-01 検証を通すには、対象ホストの A レコードを VPS の IP に向ける必要があります。

## dns domain

### list

ドメイン一覧を表示します (`ID` / `Name` / `TTL`)。

```bash
conoha dns domain list
```

### show

特定ドメインの詳細を表示します。

```bash
conoha dns domain show <id>
```

### create

ドメインを新規作成します。

```bash
conoha dns domain create --name <domain> --email <admin-email> [--ttl <sec>]
```

| オプション | 説明 |
|-----------|------|
| `--name` | ドメイン名（**必須**） |
| `--email` | 管理者メールアドレス（**必須**） |
| `--ttl` | TTL 秒（デフォルト: `3600`） |

### delete

ドメインを削除します (確認プロンプトあり、`--yes` で省略可)。**配下のレコードもすべて削除されます。**

```bash
conoha dns domain delete <id>
```

---

## dns record

### list

特定ドメインのレコード一覧を表示します。

```bash
conoha dns record list --domain-id <id>
```

| オプション | 説明 |
|-----------|------|
| `--domain-id` | ドメイン ID（**必須**） |

### create

レコードを新規作成します。

```bash
conoha dns record create \
  --domain-id <id> \
  --name <name> \
  --type <type> \
  --data <data> \
  [--ttl <sec>] [--priority <n>]
```

| オプション | 説明 |
|-----------|------|
| `--domain-id` | ドメイン ID（**必須**） |
| `--name` | レコード名（**必須**、FQDN） |
| `--type` | レコード種別（**必須**、`A` / `AAAA` / `CNAME` / `MX` / `TXT` 等） |
| `--data` | レコード値（**必須**、IP アドレス・ホスト名・テキスト等） |
| `--ttl` | TTL 秒（デフォルト: `3600`） |
| `--priority` | プライオリティ（MX レコードのみ） |

### 例

A レコード:

```bash
conoha dns record create --domain-id abc... \
  --name app.example.com --type A --data 133.88.116.147
```

MX レコード:

```bash
conoha dns record create --domain-id abc... \
  --name example.com --type MX --data mail.example.com --priority 10
```

### delete

レコードを削除します (確認プロンプトあり)。

```bash
conoha dns record delete <record-id> --domain-id <domain-id>
```

| オプション | 説明 |
|-----------|------|
| `--domain-id` | ドメイン ID（**必須**） |

---

## ID と UUID の互換性

DNS API のレスポンス JSON には `id` と `uuid` の両方が混在しますが、conoha-cli は両方のキーを受け付けます (v0.7.0+ 以降、修正 [#170](https://github.com/crowdy/conoha-cli/issues/170))。
