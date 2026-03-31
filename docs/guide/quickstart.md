# クイックスタート

キーペア作成 → サーバー作成 → SSH接続までの一連の流れを紹介します。

::: tip 前提条件
- ConoHa CLIがインストール済み（[インストール手順](/guide/getting-started#インストール)）
- `conoha auth login` でログイン済み
:::

## 1. SSHキーペアを作成

```bash
conoha keypair create my-key
```

```
Private key saved to /Users/you/.ssh/conoha_my-key
Public key saved to /Users/you/.ssh/conoha_my-key.pub
Keypair my-key created
```

秘密鍵は `~/.ssh/conoha_my-key` に自動保存されます。

## 2. サーバーを作成

```bash
conoha server create --name my-server
```

対話形式でフレーバー・イメージ・キー・セキュリティグループを選択します：

```
✓ g2l-t-c2m1 (2 vCPU, 1G RAM)
✓ vmi-ubuntu-24.04-amd64
✓ my-key
✓ IPv4v6-SSH

=== Server Create Summary ===
  Name:     my-server
  Flavor:   g2l-t-c2m1 (2 vCPU, 1G RAM)
  Image:    vmi-ubuntu-24.04-amd64
  Volume:   100 GB (c3j1-ds02-boot) [new]
  Key:      my-key

Create this server? [y/N]: y
```

::: warning セキュリティグループの選択
SSH接続するには **IPv4v6-SSH** セキュリティグループを選択してください。これを選ばないとポート22がブロックされ、接続できません。
:::

## 3. サーバーの起動を待つ

作成直後はステータスが `BUILD` です。1〜2分で `ACTIVE` になります。

```bash
conoha server list
```

```
ID                                    NAME        STATUS   FLAVOR      TAG
8b4dfb4b-484b-46bf-9627-0b7e355d2d74  vm-abc123   ACTIVE   g2l-t-c2m1  my-server
```

::: tip --wait オプション
`conoha server create --name my-server --wait` とすると、`ACTIVE` になるまで自動で待機します。
:::

## 4. SSHで接続

```bash
conoha server ssh my-server
```

```
Connecting to root@163.xx.xx.xx...

Welcome to Ubuntu 24.04.4 LTS (GNU/Linux 6.8.0-100-generic x86_64)
root@my-server:~#
```

`conoha server ssh` は `conoha keypair create` で保存した秘密鍵を自動的に検出するため、`-i` オプションは不要です。

## 5. サーバーの停止・削除

```bash
# 停止（課金は継続）
conoha server stop my-server

# 削除（課金停止）
conoha server delete my-server
```

::: warning
削除したサーバーとブートボリュームは復元できません。
:::

## 次のステップ

- [サーバー管理](/guide/server) — スペック変更、リビルド、メタデータ管理
- [アプリデプロイ](/guide/app-deploy) — Dockerアプリのデプロイ
- [実践例](/examples/nextjs) — Next.js / Rails / WordPress のデプロイ例
