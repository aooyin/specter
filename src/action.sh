#!/system/bin/sh
# shellcheck shell=sh
set -e
MODDIR=${0%/*}

# shellcheck disable=SC3040
set +o standalone
unset ASH_STANDALONE

. "$MODDIR/lib/common.sh"
. "$MODDIR/lib/config_env.sh"

_action_feature_enabled() {
  local key="$1" default="${2:-1}"
  [ "$(cfg_get "$key" "$default")" != "0" ]
}

log "ACTION" "Running full integrity pipeline"

_action_feature_enabled toggle_action_gms && sh "$MODDIR/features/kill_play_store.sh" 2>/dev/null || true
_action_feature_enabled toggle_action_target && sh "$MODDIR/features/target.sh" 2>/dev/null || true
_action_feature_enabled toggle_action_security_patch && sh "$MODDIR/features/security_patch.sh" 2>/dev/null || true
_action_feature_enabled toggle_action_keybox && sh "$MODDIR/features/keybox.sh" 2>/dev/null || true
_action_feature_enabled toggle_action_pif 0 && sh "$MODDIR/features/pif.sh" 2>/dev/null || true

run_device_info "$MODDIR"

log "ACTION" "Full integrity pipeline completed"

[ "${0##*/}" = "action.sh" ] && exit 0 || return 0
