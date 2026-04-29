# app

Application deploy and management commands. Most subcommands accept `--proxy` / `--no-proxy` to force a specific mode (errors if it disagrees with the server-side marker).

## app init

Register the app with conoha-proxy (proxy mode) or write a no-proxy marker.

### Usage

```bash
conoha app init <server> [flags]
```

### Options

| Flag | Description |
|---|---|
| `--app-name` | Application name |
| `--proxy` | Force proxy mode (errors if conflicting with marker) |
| `--no-proxy` | Force no-proxy mode (mutually exclusive with `--proxy`) |
| `--data-dir` | Server-side conoha-proxy data directory (default: `/var/lib/conoha-proxy`) |
| `--insecure` | Skip known_hosts verification (disables TOFU) |
| `--identity`, `-i` | SSH private key path |
| `--user`, `-l` | SSH user (default: `root`) |
| `--port`, `-p` | SSH port (default: `22`) |

---

## app deploy

Deploy the current directory.

### Usage

```bash
conoha app deploy <server> [flags]
```

### Options

| Flag | Description |
|---|---|
| `--app-name` | Application name |
| `--proxy` / `--no-proxy` | Force a mode |
| `--slot` | Pin the slot ID (default: git short SHA / timestamp; format `[a-z0-9][a-z0-9-]{0,63}`). Reusing an existing slot removes its work dir before re-extracting; pending drain-teardowns auto-skip. |
| `--data-dir` | Server-side proxy data dir (default: `/var/lib/conoha-proxy`) |
| `--insecure` | Skip known_hosts TOFU |
| `--identity`, `-i` / `--user`, `-l` / `--port`, `-p` | SSH connection flags |

### Behavior

1. `tar` the project dir (excluding `.dockerignore` patterns and `.git/`)
2. Upload over SSH
3. (no-proxy only) Compose `.env` from repo `.env` then `.env.server` (last wins)
4. `docker compose up -d --build`

---

## app rollback

Swap back to the previous slot within the drain window. **proxy mode only.** For multi-host apps with `expose:` blocks, default rolls back root + all blocks in reverse declaration order.

### Usage

```bash
conoha app rollback <server> [flags]
```

### Options

| Flag | Description |
|---|---|
| `--app-name` | Application name |
| `--proxy` / `--no-proxy` | Force a mode |
| `--target` | Roll back a single block: `web` or an `expose:` label (default: all blocks) |
| `--drain-ms` | Override drain window (ms) for the swapped-back target (`0` = proxy default) |
| `--data-dir` | Server-side proxy data dir (default: `/var/lib/conoha-proxy`) |
| `--insecure` | Skip known_hosts TOFU |
| SSH flags | Same as `app deploy` |

### Behavior

1. Confirm the previous slot is still draining
2. Swap target_url back via the proxy admin API
3. Reset the drain window to `--drain-ms` (or default)
4. For multi-host without `--target`, roll back expose blocks in reverse declaration order; closed-window blocks are warned and skipped

### Limitations

- Not available in no-proxy mode (`rollback is not supported in no-proxy mode`)
- Slots past the drain window cannot be rolled back. Check out the prior commit and re-deploy.

---

## app logs

Show app container logs.

### Usage

```bash
conoha app logs <server> [flags]
```

### Options

| Flag | Description |
|---|---|
| `--app-name` | Application name |
| `--follow`, `-f` | Live tail |
| `--tail` | Trailing line count (default: 100) |
| `--service` | Specific compose service |
| SSH + mode flags | Same as other app commands |

---

## app status

Show container status.

### Usage

```bash
conoha app status <server> [flags]
```

### Options

| Flag | Description |
|---|---|
| `--app-name` | Application name |
| `--proxy` / `--no-proxy` | Force a mode |
| `--data-dir` | Server-side proxy data dir |
| `--insecure` | Skip TOFU |
| SSH flags | Same as above |

### `--format json` schema

```json
{
  "root": { "service": "web", "containers": [...] },
  "expose": [
    { "label": "dex", "service": "dex", "containers": [...] }
  ]
}
```

`expose: []` for non-multi-host apps. When `conoha.yml` is unavailable, only `root` is returned and the `expose` field is omitted (v0.7.0+ graceful degrade).

---

## app stop / app restart

Stop or restart containers.

```bash
conoha app stop    <server> [flags]
conoha app restart <server> [flags]
```

Both accept `--app-name`, `--proxy` / `--no-proxy`, `--insecure`, and the SSH flags.

---

## app env set / get / list / unset

Manage server-side environment variables stored at `/opt/conoha/<app>.env.server`.

```bash
conoha app env set   <server> --app-name <app> KEY=VALUE [KEY=VALUE...]
conoha app env get   <server> --app-name <app> KEY
conoha app env list  <server> --app-name <app>
conoha app env unset <server> --app-name <app> KEY [KEY...]
```

::: warning proxy-mode limitation
`app env` writes the file in both modes but **proxy-mode deploys do not currently consume it** ([#94](https://github.com/crowdy/conoha-cli/issues/94) tracks the redesign). Use compose `environment:` / `env_file:` for proxy-mode apps.
:::

---

## app list

List deployed apps on a server.

```bash
conoha app list <server> [flags]
```

---

## app destroy

Destroy an app and its data.

### Usage

```bash
conoha app destroy <server> [flags]
```

### Options

| Flag | Description |
|---|---|
| `--app-name` | Application name |
| `--yes`, `-y` | Skip confirmation prompt |
| `--proxy` / `--no-proxy` | Force a mode |
| `--data-dir` | Server-side proxy data dir |
| `--insecure` | Skip TOFU |
| SSH flags | Same as above |

### Removed

- Containers (stopped + removed)
- Work directory (`/opt/conoha/<app>/`)
- Git repo (`/opt/conoha/<app>.git/`)
- env file (`/opt/conoha/<app>.env.server`)

---

## app reset

`app destroy` → `app init` → `app deploy` in one command.

### Usage

```bash
conoha app reset <server> [flags]
```

### Options

Accepts the same flags as `app destroy` plus `--slot` (deploy phase) and `--data-dir`.
