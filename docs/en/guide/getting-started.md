# Getting Started

ConoHa CLI is a command-line tool for operating ConoHa VPS3 from your terminal.

## Install

### macOS (Homebrew)

```bash
brew install crowdy/tap/conoha-cli
```

### Scoop (Windows)

```powershell
scoop bucket add crowdy https://github.com/crowdy/crowdy-bucket
scoop install conoha
```

### Linux / macOS (manual)

Download the binary for your OS / architecture from [GitHub Releases](https://github.com/crowdy/conoha-cli/releases).

```bash
# Example: Linux amd64
VERSION=$(curl -s https://api.github.com/repos/crowdy/conoha-cli/releases/latest | grep tag_name | cut -d '"' -f4)
curl -Lo conoha.tar.gz "https://github.com/crowdy/conoha-cli/releases/download/${VERSION}/conoha-cli_${VERSION#v}_linux_amd64.tar.gz"
tar xzf conoha.tar.gz conoha
sudo mv conoha /usr/local/bin/
rm conoha.tar.gz
```

### Windows (manual)

```powershell
$version = (Invoke-RestMethod https://api.github.com/repos/crowdy/conoha-cli/releases/latest).tag_name
$v = $version -replace '^v', ''
Invoke-WebRequest -Uri "https://github.com/crowdy/conoha-cli/releases/download/$version/conoha-cli_${v}_windows_amd64.zip" -OutFile conoha.zip
Expand-Archive conoha.zip -DestinationPath .
Remove-Item conoha.zip
```

## Verify

```bash
conoha version
```

## Login

Use your ConoHa API username, password, and tenant ID. Find these on the [ConoHa Control Panel](https://manage.conoha.jp/) under the "API" page.

```bash
conoha auth login
```

You will be prompted for:

- **API User**: API username
- **Password**: API password
- **Tenant ID**: tenant ID
- **Region**: `tyo3` (Tokyo)

Example:

```
$ conoha auth login
Tenant ID: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
API Username: gncu12345678
API Password: *********************
Authenticating as gncu12345678...
Logged in to profile "default" (token expires 2026-03-31T02:16:10Z / 2026-03-31 11:16 JST)
```

::: tip
Use `--profile` to manage multiple accounts.

```bash
conoha auth login --profile work
conoha auth login --profile personal
conoha auth switch work
```
:::

## Check status

```bash
conoha auth status
```

## Basic usage

```bash
# List servers
conoha server list

# JSON output
conoha server list --format json

# Help
conoha --help
conoha server --help
conoha server create --help
```

Example output of `conoha server list`:

```
ID                                    NAME            STATUS   FLAVOR         TAG
1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d  my-web-server   ACTIVE   g2l-t-c3m2     production
2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e  my-api-server   ACTIVE   g2l-t-c2m1     staging
3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f  test-server     SHUTOFF  g2l-t-c2m1     test
```

## Output formats

All commands accept `--format`.

| Format | Description |
|--------|------|
| `table` | Tabular (default) |
| `json` | JSON |
| `yaml` | YAML |
| `csv` | CSV |

## Next steps

- [App Deploy](/en/guide/app-deploy) — Deploy a Docker app via proxy or no-proxy mode
- [`server` Reference](/en/reference/server) — Server commands
- [`app` Reference](/en/reference/app) — App commands
- [`proxy` Reference](/en/reference/proxy) — conoha-proxy commands

The Japanese version of the docs has additional content (Quickstart, Server / App Management guides, additional reference pages, examples). See the language switcher to access them.
