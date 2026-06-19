#!/system/bin/sh
set -e
MODDIR=${0%/*}
. "$MODDIR/../lib/common.sh"
. "$MODDIR/../lib/paths.sh"
. "$MODDIR/../lib/config_env.sh"

[ "$(cfg_get toggle_vbmeta 1)" = "0" ] && exit 0

# If custom boot hash is configured, use it directly instead of computing from partition
_custom_hash=$(cfg_get custom_boot_hash "")
if [ -n "$_custom_hash" ]; then
  ensure_dir "$SPECTER_DIR"
  echo "$_custom_hash" > "$VBMETA_DIGEST"
  log "VBMETA" "Using custom boot hash"
else
  if [ ! -f "$VBMETA_DIGEST" ]; then
    . "$MODDIR/../lib/vbmeta.sh"
    _vbmeta_slot=$(getprop ro.boot.slot_suffix 2>/dev/null || echo "")
    _vbmeta_dev="/dev/block/by-name/vbmeta${_vbmeta_slot}"
    [ -b "$_vbmeta_dev" ] || _vbmeta_dev="/dev/block/by-name/vbmeta"
    _hash=$(vbmeta_digest "$_vbmeta_dev" 2>/dev/null || true)
    if [ -n "$_hash" ]; then
      ensure_dir "$SPECTER_DIR"
      echo "$_hash" > "$VBMETA_DIGEST"
    fi
    unset _hash _vbmeta_slot _vbmeta_dev
  fi
fi
unset _custom_hash
