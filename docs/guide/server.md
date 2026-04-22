# サーバー管理

ConoHa CLIでサーバーの作成から管理まですべて行えます。

## サーバー一覧

```bash
conoha server list
```

## サーバー作成

### フレーバー（スペック）を選ぶ

```bash
conoha flavor list
```

主なフレーバー:

| フレーバー | CPU | メモリ | ディスク |
|-----------|-----|--------|---------|
| g2l-t-c1m05d30 | 1 vCPU | 512MB | 30GB |
| g2l-t-c2m1d100 | 2 vCPU | 1GB | 100GB |
| g2l-t-c3m2d100 | 3 vCPU | 2GB | 100GB |
| g2l-t-c4m4d100 | 4 vCPU | 4GB | 100GB |

### イメージを選ぶ

```bash
conoha image list
```

### SSHキーペアを作成

```bash
conoha keypair create mykey
```

秘密鍵は `~/.ssh/conoha_mykey` に自動保存されます。保存先を変更したい場合は `-o` オプションを指定してください:

```bash
conoha keypair create mykey -o ~/.ssh/my-custom-path
```

### サーバーを作成

```bash
conoha server create \
  --name myserver \
  --flavor g2l-t-c2m1d100 \
  --image ubuntu-24.04 \
  --key-name mykey
```

作成完了まで1〜2分かかります。

## サーバーの起動・停止

```bash
# 停止
conoha server stop <サーバー名またはID>

# 起動
conoha server start <サーバー名またはID>

# 再起動
conoha server reboot <サーバー名またはID>
```

## SSHログイン

```bash
conoha server ssh <サーバー名> --key ~/.ssh/conoha_mykey
```

## IPアドレスの確認

```bash
conoha server ips <サーバー名>
```

## サーバー削除

```bash
conoha server delete <サーバー名またはID>
```

::: warning
削除したサーバーは復元できません。
:::

## 次のステップ

- [アプリデプロイ](/guide/app-deploy) — Dockerアプリをサーバーにデプロイ
