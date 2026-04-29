# Global flags / environment variables

Persistent flags and environment variables available on every command.

## Global flags

Defined in `cmd/root.go` `PersistentFlags()`.

| Flag | Description |
|---|---|
| `--profile` | Profile name to use |
| `--format` | Output format: `table` / `json` / `yaml` / `csv` |
| `--no-input` | Disable interactive prompts (CI / scripts) |
| `--yes`, `-y` | Auto-approve confirmation prompts |
| `--quiet` | Suppress non-essential output |
| `--verbose`, `-v` | Verbose output |
| `--no-color` | Disable color output |
| `--no-headers` | Hide table / CSV headers |
| `--filter` | Filter rows (repeatable; see operators below) |
| `--sort-by` | Sort by field name |
| `--insecure` | Disable SSH host-key verification (not recommended; lab / throwaway VPS only) |

### Wait flags

Commands invoking `cmdutil.AddWaitFlags()` add:

| Flag | Description |
|---|---|
| `--wait` | Wait for operation to complete |
| `--wait-timeout` | Max wait time (default: `5m`) |

---

## `--filter` operators

`--filter` accepts `key<op>value` and may be repeated (AND-combined).

| Operator | Meaning | Example |
|---|---|---|
| `=` | Exact match | `--filter status=ACTIVE` |
| `~` | Substring (contains) | `--filter name~web` |
| `~=` | Regex match | `--filter name~=^prod-` |

`~` and `~=` are available since v0.6.1.

```bash
conoha server list --filter status=ACTIVE
conoha server list --filter name~web
conoha server list --filter 'name~=^prod-'
conoha server list --filter status=ACTIVE --filter name~web
```

---

## Environment variables

| Variable | Description |
|---|---|
| `CONOHA_PROFILE` | Profile name |
| `CONOHA_TENANT_ID` | Tenant ID |
| `CONOHA_USERNAME` | API username |
| `CONOHA_PASSWORD` | API password |
| `CONOHA_TOKEN` | Pre-issued auth token |
| `CONOHA_FORMAT` | Output format |
| `CONOHA_CONFIG_DIR` | Config directory |
| `CONOHA_NO_INPUT` | Non-interactive mode (`1` / `true`) |
| `CONOHA_YES` | Auto-approve confirmations (`1` / `true`) |
| `CONOHA_NO_COLOR` | Disable colors (`1` / `true`; also reads `NO_COLOR`) |
| `CONOHA_ENDPOINT` | Override API endpoint |
| `CONOHA_ENDPOINT_MODE` | `int` for internal-API mode (service name in path) |
| `CONOHA_DEBUG` | Debug logs (`1` / `api`) |
| `CONOHA_SSH_INSECURE` | Disable SSH host-key verification (`1` / `true`) |

### Precedence

```
env > flag > profile > default
```

---

## Related

- [Exit codes](/en/reference/exit-codes)
- `config` reference (ja-only) — see [`config`](/reference/config) for profile management
