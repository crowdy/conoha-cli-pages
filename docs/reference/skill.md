# skill

Claude Code スキルの管理を行うコマンドグループです。

[conoha-cli-skill](https://github.com/crowdy/conoha-cli-skill) をインストール・更新・削除できます。

::: tip 前提条件
`git` がインストールされている必要があります。
:::

## skill install

conoha-cli-skill をインストールします。

### 使い方

```bash
conoha skill install
```

### 動作

1. `git` の存在を確認
2. `~/.claude/skills/conoha-cli-skill/` に git clone

### 実行例

```
$ conoha skill install
Cloning into '/Users/username/.claude/skills/conoha-cli-skill'...
remote: Enumerating objects: 20, done.
remote: Counting objects: 100% (20/20), done.
remote: Compressing objects: 100% (16/16), done.
remote: Total 20 (delta 4), reused 20 (delta 4), pack-reused 0 (from 0)
Receiving objects: 100% (20/20), 16.76 KiB | 8.38 MiB/s, done.
Resolving deltas: 100% (4/4), done.
Installed conoha-cli-skill successfully.
```

::: warning
既にインストール済みの場合はエラーになります。更新するには `conoha skill update` を使用してください。
:::

---

## skill update

conoha-cli-skill を最新バージョンに更新します。

### 使い方

```bash
conoha skill update
```

### 動作

1. インストール先が存在し、git リポジトリであることを確認
2. `git pull` で最新化

### 実行例

```
$ conoha skill update
Already up to date.
Updated conoha-cli-skill successfully.
```

---

## skill remove

conoha-cli-skill を削除します。

### 使い方

```bash
conoha skill remove [flags]
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--yes`, `-y` | 確認をスキップ |

### 実行例

```
$ conoha skill remove
Remove conoha-cli-skill? [y/N]: y
Removed conoha-cli-skill successfully.
```
