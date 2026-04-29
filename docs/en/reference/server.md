# server

Server (VM) management commands.

## Server identifiers

Most server commands accept `<server-name-or-id>`:

| Form | Example | Notes |
|---|---|---|
| UUID | `1a2b3c4d-...-1e2f3a4b5c6d` | Server ID (exact match) |
| VM name | `vps-1234567` | Auto-assigned by ConoHa |
| Name tag | `my-web-server` | User-set name (`instance_name_tag`) |

If a VM name and a name tag have the same string, VM name wins. Multiple servers sharing a name tag → error; use UUID.

---

## server list

```bash
conoha server list
```

Examples:

```bash
conoha server list --format json
conoha server list --filter status=ACTIVE
```

---

## server show

```bash
conoha server show <server>
```

---

## server create

### Usage

```bash
conoha server create [flags]
```

### Options

| Flag | Description | Required |
|---|---|---|
| `--name` | Server name | ○ |
| `--flavor` | Flavor ID or name (e.g. `g2l-t-c2m1d100`; interactive if omitted) |  |
| `--image` | Image name or ID (interactive if omitted) |  |
| `--key-name` | SSH key name (interactive if omitted) |  |
| `--volume` | Existing boot volume ID |  |
| `--security-group` | Security group name (repeatable; interactive if omitted) |  |
| `--for` | Preset name (fills flavor / image / security-group; see below) |  |
| `--admin-pass` | Admin password |  |
| `--user-data` / `--user-data-raw` / `--user-data-url` | Startup script (file / inline / URL via `#include`) — pick at most one, max 16 KiB |  |
| `--wait` / `--wait-timeout` | Wait for ACTIVE |  |

::: tip Non-interactive mode
For TTY-less environments (CI / scripts), pass `--flavor` / `--image` / `--key-name` / `--security-group` explicitly. The boot volume is auto-created as `<server-name>-boot` (size derived from the flavor; `g2l-t-c2m1d100` → 100 GB). Use `--yes` to skip confirmation.
:::

### Preset (`--for`) {#preset-for}

`--for <preset>` fills in flavor / image / security-group in one go. Explicit flags always win — note that explicit `--security-group` **replaces** (does not append to) the preset list.

| Preset | Use case | flavor | image | security-group |
|---|---|---|---|---|
| `proxy` | conoha-proxy host VPS | `g2l-t-c3m2` | latest active `vmi-docker-*-ubuntu-*-amd64` | `default,IPv4v6-SSH,IPv4v6-Web,IPv4v6-ICMP` |

The image is resolved at preset-apply time via `ListImages` (lex-descending match on active images), so the binary doesn't carry stale image IDs.

```bash
conoha server create --no-input --yes --wait \
  --name myproxy --key-name my-key --for proxy
```

---

## server delete

Delete a server (confirmation prompt).

### Usage

```bash
conoha server delete <server> [flags]
```

### Options

| Flag | Description |
|---|---|
| `--delete-boot-volume` | Also delete the boot volume after the server is removed (combine with `-y` for non-interactive) |

::: tip Avoid orphaned boot volumes
Boot volumes auto-created in non-interactive mode survive a server delete. Re-creating with the same name then bumps into the volume duplicate-name warning. Use `--delete-boot-volume` to clean up both at once.
:::

---

## server start / stop / reboot

```bash
conoha server start  <server>
conoha server stop   <server>
conoha server reboot <server> [--hard]
```

| Flag | Description |
|---|---|
| `--hard` | Hard reboot |

---

## server resize / rebuild / rename

```bash
conoha server resize  <server> --flavor <id-or-name>
conoha server rebuild <server> --image <id-or-name>
conoha server rename  <server> --name <new-name>
```

---

## server ssh

SSH into a server.

### Usage

```bash
conoha server ssh <server> [-- command...]
```

### Options

| Flag | Description |
|---|---|
| `--identity`, `-i` | Private key path (auto-detected from `~/.ssh/conoha_<KeyName>` if omitted) |
| `--user`, `-l` | User (default: `root`) |
| `--port`, `-p` | SSH port (default: `22`) |

### known_hosts / TOFU

All SSH-using commands (including `server ssh`, `app init`, `app deploy`) verify host keys against `~/.ssh/known_hosts` since v0.6.1. The first connection records the key (Trust On First Use). Use the global `--insecure` flag to skip verification (not recommended; for lab / throwaway VPS only).

---

## server deploy

Run a script on the server via SSH.

```bash
conoha server deploy <server> --script <local-script>
```

---

## server console

Get the VNC console URL.

```bash
conoha server console <server>
```

---

## server ips / metadata

```bash
conoha server ips      <server>
conoha server metadata <server>
```

---

## server add-security-group / remove-security-group

Aliases: `add-sg` / `remove-sg`. Since v0.5.3 these route through the Neutron port API; verify with `server show`.

```bash
conoha server add-security-group    <server> --name <sg>
conoha server remove-security-group <server> --name <sg>
```

| Flag | Description | Required |
|---|---|---|
| `--name` | Security group name | ○ |

---

## server open-port

Open ingress ports by adding rules to a custom security group attached to the server. If no custom SG exists, one named `<server-name>-sg` is created and attached.

### Usage

```bash
conoha server open-port <server> <ports> [flags]
```

`<ports>` is comma-separated single ports or ranges:

```
7860
7860,8080
7860,8080,9000-9010
```

### Options

| Flag | Description |
|---|---|
| `--sg` | SG name (default: `<server-name>-sg`; auto-created if missing) |
| `--remote-ip` | Allowed CIDR (default: `0.0.0.0/0`; IPv6 supported) |
| `--protocol` | `tcp` or `udp` (default: `tcp`; `icmp` not supported) |

### Examples

```bash
conoha server open-port my-server 80,443
conoha server open-port my-dev 8080-8090 --remote-ip 10.0.0.0/8
conoha server open-port my-vpn 51820 --protocol udp
```

---

## server attach-volume / detach-volume

```bash
conoha server attach-volume <server-id> <volume-id>
conoha server detach-volume <server-id> <volume-id>
```
