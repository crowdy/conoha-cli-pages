# lb

ロードバランサー (Octavia 互換) を管理するコマンドグループです。LB 本体 + listener + pool + member + health monitor の 5 階層で構成されます。

各 `create` コマンドは `--wait` で `provisioning_status` が `ACTIVE` になるまで待機できます。`ERROR` ステータスを検知するとエラー終了します。

## lb

### list

LB 一覧を表示します (`ID` / `Name` / `provisioning_status` / `vip_address`)。

```bash
conoha lb list
```

### show

LB の詳細を表示します。

```bash
conoha lb show <id>
```

### create

LB を新規作成します。

```bash
conoha lb create --name <name> --subnet-id <id>
```

| オプション | 説明 |
|-----------|------|
| `--name` | LB 名（**必須**） |
| `--subnet-id` | VIP のサブネット ID（**必須**） |

### delete

LB を削除します (確認プロンプトあり)。

```bash
conoha lb delete <id>
```

---

## lb listener

LB に紐づく listener (受信ポート) を管理します。

### list / show

```bash
conoha lb listener list
conoha lb listener show <id>
```

### create

```bash
conoha lb listener create --name <name> --protocol <proto> --port <n> --lb-id <id>
```

| オプション | 説明 |
|-----------|------|
| `--name` | listener 名（**必須**） |
| `--protocol` | プロトコル: `TCP` / `UDP`（**必須**） |
| `--port` | ポート番号（**必須**） |
| `--lb-id` | LB ID（**必須**） |
| `--wait` / `--wait-timeout` | `ACTIVE` になるまで待機 |

### delete

```bash
conoha lb listener delete <id>
```

---

## lb pool

listener にトラフィックを振り分けるバックエンド pool を管理します。

### list / show

```bash
conoha lb pool list
conoha lb pool show <id>
```

### create

```bash
conoha lb pool create \
  --name <name> --protocol <proto> \
  --lb-algorithm <algo> --listener-id <id>
```

| オプション | 説明 |
|-----------|------|
| `--name` | pool 名（**必須**） |
| `--protocol` | プロトコル: `TCP` / `UDP`（**必須**） |
| `--lb-algorithm` | アルゴリズム: `ROUND_ROBIN` / `LEAST_CONNECTIONS`（**必須**） |
| `--listener-id` | listener ID（**必須**） |
| `--wait` / `--wait-timeout` | `ACTIVE` になるまで待機 |

### delete

```bash
conoha lb pool delete <id>
```

---

## lb member

pool に登録されるバックエンドサーバー (member) を管理します。

### list / show

```bash
conoha lb member list --pool-id <id>
conoha lb member show <id> --pool-id <id>
```

| オプション | 説明 |
|-----------|------|
| `--pool-id` | 対象 pool の ID（**必須**） |

### create

```bash
conoha lb member create \
  --name <name> --address <ip> --port <n> --pool-id <id> [--weight <n>]
```

| オプション | 説明 |
|-----------|------|
| `--name` | member 名（**必須**） |
| `--address` | バックエンド IP アドレス（**必須**） |
| `--port` | バックエンドポート（**必須**） |
| `--pool-id` | pool ID（**必須**） |
| `--weight` | 負荷分散重み（デフォルト: `1`） |
| `--wait` / `--wait-timeout` | `ACTIVE` になるまで待機 |

### delete

```bash
conoha lb member delete <id> --pool-id <id>
```

---

## lb healthmonitor

pool 配下の member の死活監視を行う health monitor を管理します。

### list / show

```bash
conoha lb healthmonitor list
conoha lb healthmonitor show <id>
```

### create

```bash
conoha lb healthmonitor create \
  --name <name> --pool-id <id> --type <type> \
  --delay <sec> --timeout <sec> --max-retries <n> \
  [--url-path <path>] [--expected-codes <codes>]
```

| オプション | 説明 |
|-----------|------|
| `--name` | health monitor 名（**必須**） |
| `--pool-id` | pool ID（**必須**） |
| `--type` | 監視種別: `TCP` / `HTTP` / `HTTPS` / `PING` / `UDP-CONNECT`（**必須**） |
| `--delay` | チェック間隔（秒、**必須**） |
| `--timeout` | チェックタイムアウト（秒、**必須**） |
| `--max-retries` | 失敗判定までのリトライ数（**必須**） |
| `--url-path` | HTTP 監視時のパス |
| `--expected-codes` | 正常とみなす HTTP ステータス（例: `200` / `200-299`） |
| `--wait` / `--wait-timeout` | `ACTIVE` になるまで待機 |

### delete

```bash
conoha lb healthmonitor delete <id>
```
