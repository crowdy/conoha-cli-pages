# network

ネットワーク、サブネット、ポート、セキュリティグループなどの管理を行うコマンドグループです。

## network list

ネットワーク一覧を表示します。

### 使い方

```bash
conoha network list
```

---

## network create

ネットワークを作成します。

### 使い方

```bash
conoha network create --name <ネットワーク名>
```

---

## network delete

ネットワークを削除します。

### 使い方

```bash
conoha network delete <ネットワークID>
```

---

## network subnet

サブネットの管理を行います。

### network subnet list

サブネット一覧を表示します。

```bash
conoha network subnet list
```

### network subnet create

サブネットを作成します。

```bash
conoha network subnet create [flags]
```

| オプション | 説明 | 必須 |
|-----------|------|------|
| `--network-id` | ネットワークID | ○ |
| `--cidr` | CIDR | ○ |
| `--name` | サブネット名 | |
| `--ip-version` | IPバージョン（4 or 6、デフォルト: 4） | |

### network subnet delete

サブネットを削除します。

```bash
conoha network subnet delete <サブネットID>
```

---

## network port

ポートの管理を行います。

### network port list

ポート一覧を表示します。

```bash
conoha network port list
```

### network port create

ポートを作成します。

```bash
conoha network port create [flags]
```

| オプション | 説明 | 必須 |
|-----------|------|------|
| `--network-id` | ネットワークID | ○ |
| `--name` | ポート名 | |

### network port delete

ポートを削除します。

```bash
conoha network port delete <ポートID>
```

---

## network security-group

セキュリティグループの管理を行います。

エイリアス: `sg`

### network security-group list

セキュリティグループ一覧を表示します。

```bash
conoha network security-group list
```

### network security-group show

セキュリティグループの詳細（ルール一覧を含む）を表示します。

```bash
conoha network security-group show <セキュリティグループ名またはID>
```

### network security-group create

セキュリティグループを作成します。

```bash
conoha network security-group create --name <名前> [--description <説明>]
```

| オプション | 説明 | 必須 |
|-----------|------|------|
| `--name` | セキュリティグループ名 | ○ |
| `--description` | 説明 | |

### network security-group delete

セキュリティグループを削除します。

```bash
conoha network security-group delete <セキュリティグループ名またはID>
```

---

## network security-group-rule

セキュリティグループルールの管理を行います。

エイリアス: `sgr`

### network security-group-rule list

全セキュリティグループルールの一覧を表示します。

```bash
conoha network security-group-rule list
```

### network security-group-rule create

ルールを作成します。

```bash
conoha network security-group-rule create \
  --security-group-id <セキュリティグループID> \
  --direction ingress \
  --protocol tcp \
  --port-min 80 \
  --port-max 80
```

| オプション | 説明 | 必須 |
|-----------|------|------|
| `--security-group-id` | セキュリティグループID | ○ |
| `--direction` | `ingress` または `egress`（デフォルト: ingress） | |
| `--protocol` | プロトコル（`tcp`, `udp`, `icmp`） | |
| `--port-min` | ポート範囲の開始 | |
| `--port-max` | ポート範囲の終了 | |
| `--ethertype` | `IPv4` または `IPv6`（デフォルト: IPv4） | |
| `--remote-ip` | リモートIPプレフィックス（CIDR） | |

### network security-group-rule delete

ルールを削除します。

```bash
conoha network security-group-rule delete <ルールID>
```

---

## network qos

QoSポリシーの一覧を表示します。

### 使い方

```bash
conoha network qos list
```
