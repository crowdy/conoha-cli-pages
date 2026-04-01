# Claude Code スキル

`conoha skill` コマンドで [conoha-cli-skill](https://github.com/crowdy/conoha-cli-skill) をインストールすると、Claude Code から ConoHa VPS3 の操作をより便利に行えるようになります。

## スキルとは

conoha-cli-skill は、Claude Code 向けのスキルパッケージです。インストールすると、Claude Code が ConoHa VPS3 のインフラ構築・管理に関する専門知識を持つようになります。

## インストール

```bash
conoha skill install
```

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

インストール先: `~/.claude/skills/conoha-cli-skill/`

## 更新

スキルを最新バージョンに更新するには:

```bash
conoha skill update
```

## アンインストール

スキルを削除するには:

```bash
conoha skill remove
```

確認プロンプトが表示されます。`--yes` フラグで確認をスキップできます。

```bash
conoha skill remove --yes
```

::: tip
スキルの詳細やソースコードは [conoha-cli-skill リポジトリ](https://github.com/crowdy/conoha-cli-skill) で確認できます。
:::
