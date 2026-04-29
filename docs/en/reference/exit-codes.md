# Exit codes

Defined in `internal/errors/exitcodes.go`. Use these for error handling in scripts and CI.

| Code | Name | Meaning |
|------|------|------|
| `0` | OK | Success |
| `1` | General | Generic failure (no specific category) |
| `2` | Auth | Authentication failed (not logged in, expired token, authorization error) |
| `3` | NotFound | Resource not found (server / image / volume by ID or name) |
| `4` | Validation | Validation error (flag-value format, `conoha.yml` schema, etc.) |
| `5` | API | API error (5xx etc.) |
| `6` | Network | Network error (DNS, refused, timeout) |
| `7` | ModeConflict | `app` commands: `--proxy` / `--no-proxy` disagrees with the server-side marker |
| `8` | NotInitialized | `app` commands: server-side marker missing (`app init` not run) |
| `10` | Cancelled | User cancellation (N at confirm prompt, Ctrl-C) |

`7` and `8` were added in v0.6.1 ([#111](https://github.com/crowdy/conoha-cli/issues/111)). Earlier versions returned `1`.

## Bash example

```bash
conoha app deploy my-server
case $? in
  0)  echo "OK" ;;
  3)  echo "Server not found — check server create" ;;
  7)  echo "Mode conflict — check --proxy/--no-proxy or marker" ;;
  8)  echo "Not initialized — run app init first" ;;
  10) echo "Cancelled by user" ;;
  *)  echo "Other error (code: $?)" ;;
esac
```

## Related

- [Global flags / env vars](/en/reference/global-flags) — `--no-input` / `--yes` for non-interactive runs
- [`app` reference](/en/reference/app) — mode-related behavior
