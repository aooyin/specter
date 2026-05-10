# Specter Changelog

## v1.2.1

### download() / Network
- Swapped priority: **wget first, curl fallback** — wget ships with Android (toybox), curl does not. Reduces unnecessary errors and timeouts on devices without curl.
- `check_network()` also updated to try wget first for consistency.

### Keybox Script Fixes
- **Unguarded curl in fallback probe** (`keybox.sh:76`): added `command -v` guard + `2>/dev/null` to both curl and wget calls. Previously, `2>/dev/null` only covered wget and curl had no existence check — shell would print `curl: inaccessible or not found` on devices without curl.
- **`sort -R` removed** (`keybox.sh:81`): `sort -R` is a GNU extension, not available on busybox/toybox Android builds. Replaced with POSIX-compatible `awk` random selection.
- **Custom keybox detection** (`app.ts:552`): hardcoded curl in the shell command string replaced with wget-first fallback — same priority pattern as `download()`.

### Play Store Clear Data
- **`kill_play_store.sh`** and **`gms.sh`**: replaced `cmd package trim-caches 999999999 com.android.vending` with `pm clear com.android.vending`.
- `trim-caches` only accepts a size argument (ignores package name) and only clears system cache files — never touches app data. `pm clear` actually deletes the app's private data, forcing Play Store to re-register the device after a keybox swap.

### Installer (customize.sh)
- **Timeout on all vol-key prompts**: each prompt now defaults after 8 seconds of no input — skip keybox install, skip target.txt generation, default to Specter priority for module conflicts. Uses `timeout` (toybox) to poll `getevent` at 1-second intervals.
- **Download timeout guard**: keybox download wrapped in background + kill loop with 30-second hard cap — prevents endless waits if network hangs.
- **Target.txt prompt**: new prompt after keybox installation — asks whether to run `target.sh` immediately.

### Boot Hash Fix
- **Priority reordered** (`boot_hash.sh`): `read_vbmeta()` (real block device) now runs before checking the cached `/data/adb/boot_hash` file. Previously, a transient `read_vbmeta()` failure on first boot would write `0000...0000` to the cache, and the cached file permanently blocked re-reading the real partition on subsequent boots. Now: user override → block device → cached fallback → zeros.
- **`service.sh` guard removed**: the `[ ! -f "/data/adb/boot_hash" ]` guard that skipped setting `ro.boot.vbmeta.digest` from the live block device when cache existed was removed. The digest is always set from the real partition during early boot.
- **`boot-completed.sh`**: added `_feature_enabled toggle_boot_hardening`, `toggle_boot_hash`, `toggle_security_patch`, `toggle_suspicious_props`, `toggle_rom_spoof` gates — previously ran all boot-time features unconditionally on KSU/APatch, ignoring conflict resolution.

### Conflict Resolution
- **`apply_conflict_toggles()` now writes both `toggle_*` AND `toggle_action_*`** — previously only wrote `toggle_*`, so the action pipeline (`action.sh`) bypassed conflict resolution entirely. Now when a conflicting module claims a feature, both the boot-time and pipeline toggles are set to 0.
- **NoHello registry narrowed**: `zygisk_nohello` claims reduced from 7 features to just `boot_hardening` — NoHello only sets boot props; the other 6 phantom claims (`boot_hash`, `security_patch`, `suspicious_props`, `lsposed`, `rom_spoof`, `bootloader_spoofer`) were incorrect and caused Specter features to go missing when NoHello was prioritized.
- **`refreshControlToggles()`**: added missing `toggle-recovery` entry — the recovery toggle was not synced after a conflict change.

### Feature Script Self-Guards Removed
- **`boot_hash.sh`** and **`security_patch.sh`**: removed internal `cfg_get toggle_* = "0" && exit 0` guard. These scripts are called from multiple contexts (service, boot-completed, action pipeline) each with their own toggle gate. The self-guard was redundant and wrong — e.g., `toggle_boot_hash=0` would block the action pipeline even when `toggle_action_boot_hash=1`.

### PIF Default Off
- `toggle_action_pif` now defaults to `0` (disabled) — PIF has its own update mechanism and shouldn't run from Specter's pipeline unless the user explicitly enables it in Control → Action Pipeline.
- WebUI toggle defaults updated accordingly in both `wireControlToggles` and `refreshControlToggles`.

### Action Pipeline Message
- Changed misleading `"Meets Strong Integrity with Specter"` to `"Full integrity pipeline completed"` — the pipeline runs the steps but doesn't verify the actual Play Integrity result.

### Early Boot Conflict Resolution
- **New `post-fs-data.sh`**: runs `resolve_conflicts()` at the earliest boot stage (`post-fs-data`), before other modules' scripts execute. This ensures conflicting modules are renamed to `.bak` before they can set their own boot props.
- **`service.sh`**: removed duplicate `resolve_conflicts()` call — now handled by `post-fs-data.sh`.

### Translations
- **Added 24 missing Control page keys** to all 4 translations (ar, zh, ru, es) — the entire "Boot Behavior", "Action Pipeline", and "Conflict Resolution" sections were previously missing from non-English translations.
- **Fixed `menu_force_clear_desc`** — updated outdated text across all translations to match the new description (Play Store, Chrome, GMS, GSF, Wallet, DroidGuard).
- **Fixed `update_desc`** — was empty in all 4 translations, now translated.
- **Fixed `advance_fix_detect_pif`** — removed spurious `(1)` suffix from Chinese and Russian.
- **Translated previously untranslated keys**: `dialog_cancel`, `tools_danger_zone`, `tools_danger_zone_desc`, `danger_confirm_msg` now localized in all languages.
- **Translated navbar labels**: `nav_tools` and `nav_control` were still raw English — now localized (tools/control in all 4 languages).
- **Translated color names**: all 9 `theme_preset_*` color names now localized (ar: أزرق/أحمر/أخضر..., zh: 蓝色/红色/绿色..., ru: Синий/Красный/Зелёный..., es: Azul/Rojo/Verde...).
- **Translated tool page descriptions**: 25 remaining description keys translated across all languages (Scan & Clean, Customize Per-App Targeting, Filter Blacklisted Apps, Set Custom Keybox, and all supporting texts).
- **Translated `home_security_patch`** — "Security Patch" label now localized in all 4 languages.
- **Fixed `danger_confirm`** in Arabic — now translated to متابعة.
- **Added 26 new i18n keys** for previously hardcoded UI text: file browser (empty state, show all), conflict toasts (Module handles it / Specter handles it), "Priority →" prefix, keybox provider dropdown, custom keybox description, toast messages for blacklist/smartmerge/recovery/detection, time labels (Today at / Yesterday at), history buttons (Copy/Copied/Failed), device status labels (TEE Sim, Not Installed, Private Keybox, Latest, Generic).
- **Fixed 5 hardcoded English strings** in code: `index.html` (Auto dropdown), `app.ts` (conflict hint + toast), `file-browser.ts` (empty state + show all).
- All 4 translations now at 180 keys — fully synced with source, no missing or extra keys, no empty values.

## v1.0.0

### Architecture
- Migrated from vanilla JS to strict TypeScript with Vite bundling
- Replaced BeerCSS with Material Web Components (Google MWC)
- Replaced static color presets with dynamic Material Color Utilities (+ Monet system accent extraction)
- Pipeline-driven orchestration via `orchestrator.sh` instead of hardcoded sequential scripts
- Shared shell library (`lib/common.sh`) with reusable helpers
- Centralized config persistence via `ksud module config` with file-based fallback
- Bridge abstraction layer (`bridge.ts`) for KernelSU API

### Keybox Management
- Keybox revocation checking sourced directly from Google's attestation endpoint
- Multi-source keybox catalog with provider selection
- Custom keybox installation via file browser, URL, or device path
- Private keybox support with serial detection before install
- Keybox status card with source, version, format, and revocation info
- Keybox backup and restore on module update/uninstall

### Security Spoofing
- Delayed spoofing (120s) — re-applies critical props after boot completion
- Early boot property setup via `post-fs-data.sh` (ROM props, VBMeta, CROM detection)
- Boot completion handler for KernelSU/APatch hardening
- Comprehensive property management (~40+ props) with `resetprop_if_diff`/`resetprop_if_match`
- Persistent property setting across reboots (`persistprop`)
- VBMeta reading from real block device instead of hardcoded values
- CROM spoof hook detection to disable conflicting ROM-level spoofing

### New Features
- Blacklist system — exclude detector apps from target.txt (editable with defaults)
- SmartMerge — per-app targeting suffixes (! force, ? conditional, #disable)
- Developer mode — show raw script names with terminal output
- In-app terminal — live streaming execution logs
- Boot behavior toggle — auto-hide recovery folders (TWRP, OrangeFox, etc.)
- File browser — browse device filesystem for custom keybox
- Keybox detection — checks serial against remote catalog before install
- Rich toasts with icons, action buttons, types (success/error/info)
- 9 color presets (blue, yellow, red, purple, green, orange, pink, cyan, grey) + Monet
- Dark/light/auto theme modes with segmented button selector
- Page transition animations

### Shell Scripting
- Pipeline system (`pipelines/full_integrity`, `pipelines/root_hide`)
- 16 modular feature scripts replacing monolithic Yuri/ directory
- DroidGuard process killer in service loop
- Multi-root support (Magisk / KernelSU / APatch) with runtime detection
- Comprehensive uninstall — cleans configs, boot hash, RKA, migration markers
- Module path discovery via JSON fallback chain

### WebUI
- TypeScript with strict mode, typed interfaces for all data structures
- Material 3 floating pill navigation with animated indicator
- 5 language translations (en, zh, ru, es, ar)
- MWC components throughout (cards, dialogs, chips, selects, switches, buttons)
- Real-time clock with configurable format
- Network status indicator with offline detection
- Project contributors grid
- Developer mode toggle with terminal output
- `prefers-reduced-motion` support

### CI/CD
- GitHub Actions build and release workflow
- TypeScript type checking on CI
- Automated module zip packaging
- Automatic `update.json` version bump on release
- Vite development server for local WebUI dev
- Dev mock for browser-only development

### Other
- Rebranded from Yurikey to Specter
- Updated module ID, author, and repository URLs
- Removed 23 unused language translations (kept 5 most relevant)
- Removed snackbar color customization tool
- Removed "Set Necessary App" feature
- Removed app icon and banner image
- Cleaned up dead code and unused dependencies

## v1.1.0

### GMS & Boot Stability
- Removed multi-package GMS force-stop from boot loop — was logging users out of Google accounts and causing root manager crashes. Replaced with lightweight Play Store-only kill via `kill_play_store.sh`.
- Added `detect_root_solution()` call in `service.sh` and `boot-completed.sh` so `$ROOT_SOL` is properly set before prop operations.
- Replaced inline installer-env root detection in `customize.sh` with `detect_root_solution()`.

### Property System
- Replaced `resetprop_if_diff` / `resetprop_if_match` with streamlined `sp_try()`.
- Renamed `persistprop` → `sp_persist()`.
- Added `disable_bootloader_spoofer()` — scans for 3 packages (bootloader spoofer, HyperCeiler, LuckyTool).

### HMA-OSS
- Uses `$HMA_DIR`/`$HMA_FILE` from centralized `paths.sh`.
- Built-in fallback template with 60 apps using proper HMA-OSS schema.

### Boot Hash
- Guarded `read_vbmeta()` with command availability check — no more exit 127 on devices without sha256sum/blockdev.

### Target Script
- TEESimulator locked.xml section rewritten — uses `sed`+`grep -Fvxf` with temp files (compatible with Android's mksh).
- Props in `service.sh` reorganized into logical groups.

### New Files
- `features/kill_play_store.sh` — Play Store kill moved here, out of boot loop.
- `features/suspicious_props.sh` — scanner for persistent prop artifacts.
- `lib/package_list.sh` — extended with centralized package lists.

### Removed
- `post-fs-data.sh` — merged into `service.sh`.
- `webroot/js/clock.ts` — dead file.
- Orphaned i18n keys cleaned up from 4 translation files.

### WebUI
- Navigation restructured: replaced Actions/Advanced/Keybox/Tools with Home/Setup/Maintain/Settings — clearer per-tab purpose.
- Added Danger Zone section under Maintain tab — red error-colored header for destructive operations.
- Added confirmation dialog for all destructive actions — error-colored alert with Cancel/Continue.
- URL hash routing (`#home`, `#setup`, `#maintain`, `#settings`) with `popstate` listener for back/forward.
- Tab persistence — last visited tab saved to localStorage, restored on reload.
- Removed active-tab guard — re-tapping navigates to the tab (acts as refresh).
- Increased section title font sizes for better readability.
- Danger Zone description spacing tightened.
- RTL centering for nav-bar and toast.
- Synced missing i18n keys across all translations, cleaned up orphaned keys.
- Removed hardcoded module path fallback.

### Logging
- Most feature scripts follow `[TAG] Start` / `[TAG] Finish` pattern (16/18; `cleanup.sh` and `kill_play_store.sh` use alternative wording).
- `pif.sh`: rewritten to detect variant by script presence on disk, logs variant and per-script results.
- `pif2.sh`: logs spoof engine detection status.
- `zygisk_next.sh`: state-aware loop, reports N/3 settings applied.

### Other
- curl binary verification before use — falls back to wget if broken.

## v1.2.0

### Feature Toggle System
- Added Control page — new nav tab with per-feature enable/disable toggles.
- Boot Behavior section — toggle recovery folder hiding, boot hardening, bootloader spoofer block, ROM spoof engine block, and LSPosed ODEX cleanup individually.
- Action Pipeline section — toggle individual action-button steps: kill Play Store, regenerate target, set security patch, set verified boot hash, set fingerprint.
- Toggle values stored as config files via `cfg_get`/`cfg_set` — survive reboots and app uninstalls.
- Every feature script sources `config_env.sh` and gates itself against its toggle before running.

### Conflict Resolution System
- Data-driven conflict registry (`_conflict_registry`) in `common.sh` — single source of truth for module metadata, scripts, and feature claims.
- `_conflict_claimed()` iterates all registry entries dynamically — adding a new conflicting module requires one line in the registry. No hardcoded case blocks.
- `resolve_conflicts()` and `_conflict_claimed()` are now fully data-driven loops over the registry instead of per-module hardcoded blocks.
- `apply_conflict_toggles()` now correctly enables Specter features when no module claims priority, and disables them when any `priority_module` claims the feature.
- `conflict_set_choice()` — saves choice to module config, renames/restores the conflicting module's boot scripts, and recalculates all toggles.
- Config migration: old `/data/adb/Specter/config/conflict_*.val` files are automatically migrated to module config on first boot.
- Conflict backup system restored — `conflict_backups.txt` tracks renamed scripts so `uninstall.sh` can restore them.
- WebUI integration: `conflicts.sh` helper script exposes JSON status and set commands to the WebUI.
- Removed hardcoded module lists from TypeScript — all conflict data comes from shell registry via JSON.
- Toggle states refresh live after conflict change — no page reload needed.
- `apply_prop_hardening()` now consistently returns 0 — prevents `set -e` exits in cleanup.sh.

### WebUI Restructure
- Merged Setup and Maintain pages into single Tools page — 5 nav tabs reduced to 4 for better phone fit.
- Old `#setup` and `#maintain` URL hashes automatically migrate to `#tools` on first load.
- Last-visited tab persistence migrated accordingly.

### Navigation
- Double-tap nav tab: 1 tap switches page (no scroll reset), 2 taps on same tab scrolls to top.
- Nav bar right-padding clipping fixed — removed `max-width` constraint.

### Install Behavior
- Removed forced `target.sh` execution on module flash — no longer overwrites user's custom target.txt on reinstall.
- Conflict detection prompt during install — detects bootloader spoofer, HyperCeiler, LuckyTool packages and asks whether to block them at boot.

### Action Pipeline
- Replaced monolithic `orchestrator.sh` call in `action.sh` with individually gated feature calls — skipped features log nothing and don't abort the pipeline.
- `block_rom_spoof_engines` wrapped in background subshell for boot safety.

### Feature Script Improvements
- `gms.sh`: DroidGuard process kill by name pattern — kills droidguard processes even if their packages aren't listed.
- `target.sh`: TEESimulator detection refactored to use `_is_teesimulator` helper instead of fragile module.prop author parsing.
- `boot_hash.sh`: persists computed boot hash via `cfg_set stored_boot_hash`.
- `package_list.sh`: `GMS_KILL_LIST` deduplicated and reorganized — removed redundant entries, added safetycore.
- `disable_bootloader_spoofer` respects user's install-time conflict choice flag.

### Dialog Redesign (Material Design 3)
- `confirmDestructive`: Rewritten per M3 alert dialog spec — added `warning` icon in error-container circle, action name as headline, `md-filled-button` with error tokens for confirm action. Removed all inline styles.
- `openFileBrowser`: Complete rewrite — replaced 40+ inline style attributes with CSS classes, removed inline `onmouseenter`/`onmouseleave` event handlers (now CSS `:hover`), fixed button from `md-filled-tonal-button` to `md-filled-button`, added XSS-safe `escapeHtml()`.
- `privateChoice`: Both buttons changed to `md-text-button` (equal binary choice), removed `type="alert"`, removed all inline styles.
- `detectedDialog`: Added `type="alert"`, changed confirm button to `md-filled-button`, replaced all inline styles with CSS classes.
- `showErrorDialog`: Added `type="alert"` for proper alertdialog ARIA role, renamed generic class.
- `runDevAction`: Scoped generic class names to avoid conflicts.
- `danger_confirm` translation changed from `"Continue"` to `"Proceed"` across all 5 languages.

### README
- Updated screenshot grid to match new nav structure — replaced `setup.png`/`maintain.png` with `tools.png`/`control.png`.

### Documentation
- Added Legal disclaimer — educational purposes only, no liability for misuse.
- Added Warning section — outlines risks (warranty void, boot loops, app bans, etc.).
- Added Support section with Ko-fi, PayPal, BTC, and ETC donation options.
- Added `docs/CONFLICTS.md` — conflict handling policy with per-module resolution table.

### Other
- README simplified — replaced verbose background with quick start, streamlined features list, added screenshot grid.
- Removed CI badge from README.
