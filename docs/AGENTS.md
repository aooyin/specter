# AI Agent Instructions — Specter

## Build & Lint

```sh
npm run build          # vite build → copy files → zip module → module.zip
npm run dev            # Vite dev server for WebUI (hot-reload)
```

Lint shell scripts before committing:
```sh
find src/ -name '*.sh' -exec shellcheck {} +
```

## Source Layout

| Directory | Purpose |
|---|---|
| `src/lib/` | Shared shell libraries — single source of truth |
| `src/features/` | One file = one feature, run by orchestrator |
| `src/pipelines/` | Text files listing features to run in order |
| `src/webroot/js/` | WebUI ES modules (20 files, Vite-bundled) |
| `src/webroot/common/` | Scripts triggered from WebUI directly |
| `src/rka/` | Remote Key Attestation (jsonarray.sh) |
| `Module/` | **Build output — never edit directly** |

## Shell Script Conventions

### `exit` vs `return`

| Context | Use |
|---|---|
| `features/*.sh` | `exit` (run as subprocess) |
| `orchestrator.sh`, `service.sh`, `boot-completed.sh` | `exit` |
| `customize.sh`, `uninstall.sh` | `return` (sourced by installer) |
| `action.sh` | `exit` (standalone — Magisk/KSU runs as subprocess) |
| `lib/*.sh` | Never call `exit` or `return` at top level |

### Path Resolution

| Script location | Path to `lib/common.sh` |
|---|---|
| `features/*.sh` | `"$MODDIR/../lib/common.sh"` |
| Root scripts (`service.sh`, `orchestrator.sh`, etc.) | `"$MODDIR/lib/common.sh"` |
| `webroot/common/*.sh` | Strip 3 levels via `MODDIR="${MODDIR%/*}"`, then `lib/common.sh` |

### Feature Script Contract

```sh
#!/system/bin/sh
set -e
MODDIR=${0%/*}
. "$MODDIR/../lib/common.sh"
. "$MODDIR/../lib/paths.sh"

log "FEATURE" "Start"
# idempotent, check prerequisites first
log "FEATURE" "Finish"
exit 0
```

- End every feature script with `exit 0`
- All executable scripts use `set -e` — intentionally failing commands must use `|| true`
- Never `exit 1` without a `log "ERROR"` message first
- Check prerequisites with `check_network`, `[ -f ... ]` before doing work

## Git Conventions

Commit format: `type: description`

Types: `fix:`, `feat:`, `refactor:`, `chore:`, `docs:`, `test:`

## Constraints

- **NEVER** edit `Module/` or `module/` — these are build artifacts
- **NEVER** commit secrets, API tokens, or keybox files
- **NEVER** use `su -c` in feature scripts — module already runs as root
- **NEVER** hardcode `/data/adb/modules/Specter` — use `$MODDIR`
