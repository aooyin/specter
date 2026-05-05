# Development Guide — Specter

For full architecture reference, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Quick Reference

| Area | Files | Lines |
|---|---|---|
| `src/lib/` | 5 shared libraries | ~340 total |
| `src/features/` | 16 feature scripts | varies |
| `src/webroot/js/` | 20 ES modules | ~2100 total |
| `src/webroot/css/app.css` | 1 stylesheet | ~790 |
| `src/webroot/index.html` | 1 HTML page | ~460 |

## WebUI Architecture

### Bridge (`src/webroot/js/bridge.js`)

Single bridge tier: `window.ksu.exec` — KernelSU/APatch native bridge. Spawn support via `window.ksu.spawn` if available, else emulated via raw exec.

Returns an event emitter with `on('data')` and `on('exit')` for live streaming to the terminal. `exec()` returns `{ stdout, stderr }` for simple commands.

### Config Persistence (`src/webroot/js/cfg.js`)

```js
cfgGet(key, default)     # ksud module config get → cat config/*.val
cfgSet(key, value)       # ksud module config set → printf > config/*.val (batched + debounced)
```

Mirrors `lib/config_env.sh` on the shell side. Uses single-quote shell escaping to prevent injection. Batches writes with 500ms debounce timer.

### Script Execution (`src/webroot/js/app.js`)

Two modes:
- **Simple mode**: progress dialog, toast on completion, output history saved
- **Dev mode**: live terminal with real-time stdout/stderr, toggled via dev-mode switch

### Theme (`src/webroot/js/theme.js`)

MWC Material 3 via CSS custom properties. 8 color presets (blue, yellow, red, purple, green, orange, pink, cyan, grey). Auto dark/light detection. Monet dynamic colors from wallpaper (Android 12+).

## Pipeline System

Pipelines are text files in `src/pipelines/` listing feature scripts to run:

```
# src/pipelines/full_integrity
gms.sh
target.sh
security_patch.sh
boot_hash.sh
keybox.sh
pif.sh?
```

```
# src/pipelines/root_hide
hma.sh
zygisk_next.sh?
```

- `?` suffix = optional (skipped if file missing, pipeline continues)
- Any script exiting non-zero **aborts** the pipeline
- Feature names are sanitized against `[!/a-zA-Z0-9_-]` before execution
- The `orchestrator.sh` reads the pipeline file line by line

To create a new pipeline: write a text file in `src/pipelines/`, then call `sh orchestrator.sh <name>`.

## Boot Flow

```
KernelSU / APatch:
  service.sh         → immediate ro.* property resets
  boot-completed.sh  → apply_boot_hardening(), override.description

Magisk:
  service.sh         → ro.* resets + poll sys.boot_completed + GMS kill
                       + recovery hiding + 120s delayed re-spoof
```

The `apply_boot_hardening()` function (in `lib/common.sh`) runs `settings put` and `resetprop --delete` for security hardening.

## Config Persistence (`lib/config_env.sh`)

Dual-layer approach:
- **KernelSU**: uses `ksud module config get/set/delete`
- **Magisk/APatch**: falls back to flat files in `/data/adb/Specter/config/*.val`

Both layers are controlled by the same `cfg_get`/`cfg_set`/`cfg_delete` API. The WebUI mirrors this via shell `exec()`.

## Feature Script Patterns

### Idempotency

All features must be safe to run multiple times. Check prerequisites before acting:

```sh
check_network || { log "FEATURE" "Error: No internet"; exit 1; }
[ -d "/data/adb/tricky_store" ] || { log "FEATURE" "Error: Tricky Store not found"; exit 1; }
```

### set -e

All executable scripts use `set -e`. Commands whose failure is expected must be guarded with `|| true`.

### Logging

Use the `log()` function from `lib/common.sh`:

```sh
log "FEATURE" "Start"
log "FEATURE" "Downloading..."
log "FEATURE" "Finish"
```

Format: `[FEATURE] message`

## RKA Subsystem

`src/rka/jsonarray.sh` is a pure-awk JSON array manipulation library. Used by `features/rka.sh` to provision Remote Key Attestation config for the PassIt app. The config file lives at `/data/user/<UID>/io.github.mhmrdd.libxposed.ps.passit/files/rka_configs.json`.
