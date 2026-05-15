# Specter Test Suite

## Conflict Resolution System

Tests the entire conflict resolution pipeline — registry parsing, module detection, feature claiming, toggle recalculation, and the `_feature_should_run()` runtime gate.

### Running

```sh
bash tests/test_conflicts.sh
```

No Android device needed. Runs on any Linux box. 14 tests covering:

| # | Test | What it verifies |
|---|------|------------------|
| 1 | `tc01_no_conflicts` | No modules → all toggles default to 1 |
| 2 | `tc02_passive_detected` | Passive module (NoHello) blocks its claimed features |
| 3 | `tc03_aggressive_detected` | Aggressive module (TSupport) scripts renamed to .bak, Specter handles |
| 4 | `tc04_both_types` | Passive + aggressive + passive → correct combined state |
| 5 | `tc05_toggle_passive` | Flipping passive to priority_specter unblocks features |
| 6 | `tc06_toggle_aggressive` | Flipping aggressive to priority_module blocks features + restores scripts |
| 7 | `tc07_feature_should_run` | `_feature_should_run()` respects both config + conflict state |
| 8 | `tc08_json_output` | `conflict_status_json()` outputs valid JSON |
| 9 | `tc09_yurikey` | Yurikey (aggressive) correctly detected |
| 10 | `tc10_integritybox` | Integrity Box requires both `playintegrityfix` + `Box-Brain` dirs |
| 11 | `tc11_invalid_choice` | `conflict_set_choice` rejects invalid values |
| 12 | `tc12_resolve_idempotent` | Running `resolve_conflicts` twice doesn't change state |
| 13 | `tc13_action_toggles` | `toggle_action_*` values updated by conflict system |
| 14 | `tc14_passive_sensitive_props` | Sensitive Props passive module claims boot_hardening + suspicious_props |

### How it works

1. A temp directory (`/tmp/specter_test.XXXXXX`) is created per test
2. Mock module directories are created under `$TEST_ROOT/modules/`
3. The real `lib/common.sh` is sourced — all conflict functions are tested as-is
4. `tests/mocks/android.sh` remaps paths from `/data/adb/` to `$TEST_ROOT/` and stubs Android-native commands
5. Config persists to flat files under `$TEST_ROOT/Specter/config/`
6. After each test, the temp directory is destroyed

### Adding a test

```sh
tcXX_my_test() {
  remove_all_modules; reset_config
  create_module "some_module" "service.sh"
  resolve_conflicts
  assert_eq "some check" "expected" "$(cfg_get "toggle_X" 1)" || return 1
}
```

Add the function name to the `tests` array at the bottom of `test_conflicts.sh`.
