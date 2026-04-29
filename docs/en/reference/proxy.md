# proxy

Manage the [conoha-proxy](https://github.com/crowdy/conoha-proxy) reverse proxy on a ConoHa VPS. `proxy boot` is required before `conoha app deploy` in proxy mode.

## Common SSH flags

Apply to every `proxy` subcommand:

| Flag | Description |
|---|---|
| `--user`, `-l` | SSH user (default: `root`) |
| `--port`, `-p` | SSH port (default: `22`) |
| `--identity`, `-i` | SSH private key path |

---

## proxy boot

Install and start conoha-proxy on the server. Sets up Let's Encrypt automatic HTTPS, opens UFW 80/443, and applies `net.ipv4.ip_unprivileged_port_start=0` sysctl.

### Usage

```bash
conoha proxy boot <server> --acme-email <email> [flags]
```

### Options

| Flag | Description |
|---|---|
| `--acme-email` | Let's Encrypt registration email (**required**) |
| `--image` | conoha-proxy Docker image (default: `ghcr.io/crowdy/conoha-proxy:latest`) |
| `--data-dir` | Host data directory (default: `/var/lib/conoha-proxy`) |
| `--container` | Docker container name (default: `conoha-proxy`) |
| `--wait-timeout` | Max wait for healthy (default: `30s`; `0` disables) |

### Behavior

1. Verify Docker / docker compose are present
2. Create `--data-dir` and chown to UID 65532 (nonroot)
3. Open UFW 80/443 and write `net.ipv4.ip_unprivileged_port_start=0` to `/etc/sysctl.d/99-conoha-proxy.conf`
4. `docker run` the proxy container (Admin Unix socket at `<data-dir>/admin.sock`)
5. Wait for 3 consecutive `running` + `/healthz` 200 within `--wait-timeout`. On timeout, last 20 container log lines are sent to stderr.

---

## proxy reboot

Pull the latest image and recreate the container. **All boot flags must be re-specified** (container settings are not preserved).

```bash
conoha proxy reboot <server> --acme-email <email> [flags]
```

Same options as `boot` (`--acme-email`, `--image`, `--data-dir`, `--container`, `--wait-timeout`).

---

## proxy start / stop / restart

Start, stop, or restart the running container without pulling a new image or reapplying settings.

```bash
conoha proxy start   <server> [--container <name>]
conoha proxy stop    <server> [--container <name>]
conoha proxy restart <server> [--container <name>]
```

| Flag | Description |
|---|---|
| `--container` | Container name (default: `conoha-proxy`) |

---

## proxy remove

Remove the container. The data volume is kept by default — registered services / certificates / state survive. Use `--purge` to wipe.

### Usage

```bash
conoha proxy remove <server> [flags]
```

### Options

| Flag | Description |
|---|---|
| `--container` | Container name (default: `conoha-proxy`) |
| `--data-dir` | Host data dir (default: `/var/lib/conoha-proxy`) |
| `--purge` | Also delete the data dir (certificates / services / state all gone) |

---

## proxy logs

```bash
conoha proxy logs <server> [flags]
```

| Flag | Description |
|---|---|
| `--container` | Container name (default: `conoha-proxy`) |
| `--follow`, `-f` | Live tail |
| `--tail` | Trailing line count (default: `0` = all) |

---

## proxy details

Show conoha-proxy version and readiness via the Admin API `/version` over the Unix socket.

```bash
conoha proxy details <server> [--data-dir <path>]
```

| Flag | Description |
|---|---|
| `--data-dir` | Host data dir (default: `/var/lib/conoha-proxy`) |

---

## proxy services

List proxy services registered on the server. `app init`-ed apps and their `expose:` blocks appear as `<app-name>` / `<app-name>-<label>`.

```bash
conoha proxy services <server> [--data-dir <path>]
```
