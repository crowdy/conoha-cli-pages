# App Deploy

`conoha app` provides two coexisting deploy modes on the same VPS. After `app init` writes a server-side marker (`/opt/conoha/<name>/.conoha-mode`), every subsequent `deploy` / `status` / `logs` / `stop` / `restart` / `destroy` / `rollback` auto-detects that mode — you don't repeat the mode flag.

## Mode comparison

|  | proxy (blue/green) | no-proxy (flat) |
|---|---|---|
| Default | ✓ |  |
| Use case | Public apps with HTTPS | Test, internal, non-HTTP |
| `conoha.yml` | required | not used |
| `conoha proxy boot` | required | not used |
| DNS | required | not required |
| TLS | Let's Encrypt automatic | bring your own |
| Layout | `/opt/conoha/<name>/<slot>/` | `/opt/conoha/<name>/` |
| rollback | ✓ (within drain window) | × |

## proxy mode

[conoha-proxy](https://github.com/crowdy/conoha-proxy) provides Let's Encrypt HTTPS, host-header routing, and instant in-window rollback. For proxy-side setup see the Japanese guide ([conoha-proxy セットアップ](/guide/proxy-setup)).

### Create `conoha.yml`

Place it at the repo root.

```yaml
name: myapp                   # DNS-1123 label (lowercase alnum + hyphen, 1-63 chars)
hosts:
  - app.example.com           # multiple allowed; no duplicates
web:
  service: web                # must match a service in your compose file
  port: 8080                  # container-side listen port (1-65535)
# --- optional ---
compose_file: docker-compose.yml   # auto-detected: conoha-docker-compose.yml → docker-compose.yml → compose.yml
accessories: [db, redis]           # joined to the web slot's network
health:
  path: /healthz
  interval_ms: 1000
  timeout_ms: 500
  healthy_threshold: 2
  unhealthy_threshold: 3
deploy:
  drain_ms: 5000                   # old slot drain window (ms; default 30000)
```

### Boot proxy and register the app

```bash
# 1. Boot proxy on the VPS (skip if already running)
conoha proxy boot my-server --acme-email ops@example.com

# 2. Point DNS A records at the VPS IP
#    If DNS does not resolve to the VPS, app init still succeeds but
#    Let's Encrypt issuance will fail and HTTPS will not work for that host.

# 3. Register and deploy
conoha app init my-server
conoha app deploy my-server
```

Rollback (within drain window only):

```bash
conoha app rollback my-server
```

### Slot auto-suffix

`--slot <id>` pins the slot ID. Format: `[a-z0-9][a-z0-9-]{0,63}`. Default is git short SHA or timestamp.

If the default collides with an existing compose project, the CLI auto-appends `-2` / `-3` to avoid clobbering a still-draining slot. Explicit `--slot` reuse removes the work directory before re-extracting.

### multi-host / `expose:` blocks

Subdomains served on separate hostnames (admin UI, webhook receivers, etc.) can be declared in `expose:`. Each block registers as an independent proxy service `<name>-<label>`.

```yaml
name: gitea
hosts: [gitea.example.com]
web:
  service: gitea
  port: 3000
expose:
  - label: dex                    # proxy service-name suffix (<name>-<label>)
    host: dex.example.com         # must not duplicate hosts[] or other expose entries
    service: dex                  # compose service name (mutually exclusive with web.service / accessories)
    port: 5556
    blue_green: false             # true (default) joins the slot rotation; false = accessory (single-shot)
accessories: [db]
```

- `app status` shows the root and each expose block; `--format json` returns `{root, expose: [...]}`.
- `app rollback` rolls back the root + all expose blocks in reverse declaration order by default. Use `--target=<label>` (or `--target=web`) for a single block. Blocks past their drain window are warned and skipped.
- CLI versions before v0.6.0 silently ignore `expose:`. Pin v0.6.0+ in CI when using multi-host.

## no-proxy mode

The shortest path: no `conoha.yml`, no proxy, no DNS. Equivalent to running `docker compose up -d --build` over SSH.

```bash
# Init (verifies Docker / Compose presence and writes a marker; does NOT install Docker)
conoha app init my-server --app-name myapp --no-proxy

# Deploy (tar your dir, upload to /opt/conoha/myapp/, docker compose up -d --build)
conoha app deploy my-server --app-name myapp --no-proxy
```

After `init` writes the marker, you don't need `--no-proxy` again on `status` / `logs` / `stop` / `restart` / `destroy`.

::: warning Docker must be pre-installed
no-proxy `app init` only verifies Docker / Compose presence. Install Docker up front (e.g., `conoha server create --user-data ./install-docker.sh`) before running `app init`.
:::

Re-deploy is overwrite-only: files removed from the repo stay on the server (intentional, to protect `.env.server` and named-volume bind mounts). Clean up old files manually with `ssh <server> rm /opt/conoha/<name>/<path>`.

no-proxy mode has no blue/green swap, so `rollback` is unavailable (`rollback is not supported in no-proxy mode`). Roll back by checking out the prior commit and running `app deploy` again.

## Switching modes

Destroy then re-init in the opposite mode.

```bash
conoha app destroy my-server --app-name myapp
conoha app init my-server --app-name myapp --no-proxy
```

Different `<app-name>`s on the same VPS can run in different modes side by side.

## Environment variables

`conoha app env set` works in both modes and writes to `/opt/conoha/<app>.env.server` on the server. **Currently, env values only take effect in no-proxy mode** ([#94](https://github.com/crowdy/conoha-cli/issues/94) tracks the proxy-mode redesign). For proxy-mode apps, pass settings via the compose `environment:` / `env_file:` blocks instead.

## Related

- [`app` Reference](/en/reference/app) — Flag-level details
- [`proxy` Reference](/en/reference/proxy) — proxy command details
- [`server` Reference](/en/reference/server) — Server commands incl. `--for proxy` preset
