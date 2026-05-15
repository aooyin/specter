# Mocks for Android-specific functions.
# All paths are remapped from /data/adb/ to $TEST_ROOT/ for non-root test execution.

[ -n "$TEST_ROOT" ] || { echo "TEST_ROOT not set" >&2; exit 1; }

# Remap hardcoded paths
SPECTER_DIR="$TEST_ROOT/specter_data"
CONFLICT_BACKUP_FILE="$SPECTER_DIR/conflict_backups.txt"

detect_root_solution() { ROOT_SOL="test"; }

# Bypass ksud — pure flat file config
cfg_get() {
  _cg_key="$1" _cg_default="$2"
  _cg_val=$(cat "$CONFIG_DIR/$_cg_key.val" 2>/dev/null)
  printf '%s' "${_cg_val:-$_cg_default}"
  unset _cg_key _cg_default _cg_val
}

cfg_set() {
  _cs_key="$1" _cs_val="$2"
  mkdir -p "$CONFIG_DIR" 2>/dev/null
  printf '%s' "$_cs_val" > "$CONFIG_DIR/$_cs_key.val"
  unset _cs_key _cs_val
}

# Override _conflict_detect to use $TEST_ROOT/modules/ instead of /data/adb/modules/
_conflict_detect() {
  _cd_modid="$1"
  case "$_cd_modid" in
    integritybox)
      [ -d "$TEST_ROOT/modules/playintegrityfix" ] && [ -d "$TEST_ROOT/Box-Brain" ]
      ;;
    *)
      [ -d "$TEST_ROOT/modules/$_cd_modid" ]
      ;;
  esac
}

# Override rename/restore to map paths from /data/adb/ to $TEST_ROOT/
_conflict_rename_bak() {
  _cr_path="$1"
  _cr_path="${_cr_path#/data/adb/}"
  _cr_path="$TEST_ROOT/$_cr_path"
  [ -f "$_cr_path" ] || return 0
  [ -f "$_cr_path.bak" ] && return 0
  mv "$_cr_path" "$_cr_path.bak" 2>/dev/null || true
  echo "$_cr_path" >> "$CONFLICT_BACKUP_FILE" 2>/dev/null || true
  unset _cr_path
}

_conflict_restore_bak() {
  _cr_path="$1"
  _cr_path="${_cr_path#/data/adb/}"
  _cr_path="$TEST_ROOT/$_cr_path"
  [ -f "$_cr_path.bak" ] || return 0
  mv "$_cr_path.bak" "$_cr_path" 2>/dev/null || true
  unset _cr_path
}

# Stub native Android commands
resetprop() { return 0; }
getprop()  { return 0; }
setprop()  { return 0; }
settings() { return 0; }
cmd()      { return 0; }
pm()       { return 0; }
am()       { return 0; }
toybox()   { return 0; }
pgrep()    { return 1; }
busybox()  { return 1; }
awk()      { return 0; }
sha256sum(){ return 0; }
