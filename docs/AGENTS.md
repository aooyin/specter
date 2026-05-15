# AI Agent Instructions - Specter

## Build & Check

```sh
npm run build          # vite build → copy files → zip module → module.zip
npm run dev            # Vite dev server for WebUI (hot-reload)
npx tsc --noEmit       # TypeScript strict type check (run before committing)
```

Lint shell scripts before committing:
```sh
find src/ -name '*.sh' -exec shellcheck {} +
```

## Source Layout

| Directory | Purpose |
|---|---|
| `src/lib/` | Shared shell libraries - single source of truth |
| `src/features/` | One file = one feature, run by orchestrator |
| `src/pipelines/` | Text files listing features to run in order |
| `src/webroot/js/` | WebUI TypeScript modules (21 .ts files, Vite-bundled) |
| `src/webroot/common/` | Scripts triggered from WebUI directly |
| `src/rka/` | Remote Key Attestation (jsonarray.sh) |
| `Module/` | **Build output - never edit directly** |

## Shell Script Conventions

### `exit` vs `return`

| Context | Use |
|---|---|
| `features/*.sh` | `exit` (run as subprocess) |
| `orchestrator.sh`, `service.sh`, `boot-completed.sh` | `exit` |
| `post-fs-data.sh` | `exit` (subprocess, blocking stage) |
| `customize.sh`, `uninstall.sh` | `return` (sourced by installer) |
| `action.sh` | `exit` (standalone - Magisk/KSU runs as subprocess) |
| `lib/*.sh` | Never call `exit` or `return` at top level |

### Feature Gating

Boot scripts use `_feature_enabled()` for toggle guards:

```sh
_feature_enabled() { [ "$(cfg_get "$1" "${2:-1}")" != "0" ]; }

_feature_enabled toggle_boot_hardening && apply_boot_hardening
_feature_enabled toggle_dev_options 0 && disable_dev_options  # default off
```

The second argument is the default value (defaults to `1` if omitted).

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
- All executable scripts use `set -e` - intentionally failing commands must use `|| true`
- Never `exit 1` without a `log "ERROR"` message first
- Check prerequisites with `check_network`, `[ -f ... ]` before doing work

## Keybox Revocation

- **Google's endpoint** is the authority for revocation: `check_google_revocation(serial)` downloads Google's attestation status list and checks if the serial is present
- **Private keyboxes** (`kb_private=true`) are also checked against Google's endpoint
- Revocation is a **warning**, not a block - the keybox is installed but the UI shows a "Revoked" badge
- The rawbin catalog is used only for identity (source/version/text/up-to-date), not revocation

## Git Conventions

Commit format: `type: description`

Types: `fix:`, `feat:`, `refactor:`, `chore:`, `docs:`, `test:`

## Constraints

- **NEVER** edit `Module/` or `module/` - these are build artifacts
- **NEVER** commit secrets, API tokens, or keybox files
- **NEVER** use `su -c` in feature scripts - module already runs as root
- **NEVER** hardcode `/data/adb/modules/Specter` - use `$MODDIR`
- **NEVER** edit `.js` files - the WebUI is TypeScript; edit the `.ts` source files in `src/webroot/js/`

### Boot Script Safety

All boot-time features are dispatched from `lib/boot_core.sh`, sourced by both `service.sh` (Magisk) and `boot-completed.sh` (KSU/APatch) after `sys.boot_completed=1`. The ONLY blocking stage is `post-fs-data.sh` (Magisk only, 40s timeout).

**Safe at all boot stages** — every call has `2>/dev/null || true` guards:
- `apply_boot_props()` — data-driven, uses `sp_try()` with full guards
- `apply_boot_hardening()` — `settings put` + `resetprop --delete` with `|| true`
- `hide_recovery_folders()` — file ops only, checks exist first
- `disable_bootloader_spoofer()` — `pm`/`cmd`/`grep`, every op guarded
- `_feature_enabled()`, `_feature_should_run()`, `_conflict_claimed()` — config reads only

**Safe only via feature script subprocess** (dispatched with `|| true`, not called inline):
- `block_rom_spoof_engines()` — uses `sp_persist()` (persistent storage write). Boot core runs it in a background subshell: `( sh features/rom_spoof.sh ) &`. The feature script inherits `set -e` but the exit code is never checked.
- `hexpatch_deleteprop()` — uses `magiskboot hexpatch` with `resetprop -p --delete` fallback. Called from `features/suspicious_props.sh` with `|| true`.

**Never call from boot scripts** (on-demand only, called from `cleanup.sh` or WebUI):
- `apply_prop_hardening()` — no inline guards. Can abort with `set -e`.
- `check_prop()` — no `|| true` on resetprop. Can abort at blocking stage.

**Bootloop risk summary:**
- `post-fs-data.sh` (blocking, 40s timeout): only calls `resolve_conflicts()` which uses `cfg_get`/`cfg_set` (file reads/writes) and `disable_bootloader_spoofer()` (fully guarded). No unguarded `resetprop`. No bootloop risk.
- `boot_core.sh` (non-blocking, after boot completed): dispatches feature scripts with `|| true`. Feature script failures are logged and ignored. No bootloop risk.
