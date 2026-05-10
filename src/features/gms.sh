#!/system/bin/sh
set -e
MODDIR=${0%/*}
. "$MODDIR/../lib/common.sh"
. "$MODDIR/../lib/config_env.sh"
[ "$(cfg_get toggle_gms 1)" = "0" ] && exit 0
. "$MODDIR/../lib/package_list.sh"

log "GMS" "Start"

_installed_pkgs=$(pm list packages 2>/dev/null) || log "GMS" "Warning: Failed to list installed packages"
_count=0

# Kill known droidguard processes by name pattern (regardless of install status)
for _pid in $(pgrep -f 'droidguard\|com\.google\.android\.gms\b' 2>/dev/null); do
  kill -9 "$_pid" 2>/dev/null || true
  _count=$((_count + 1))
done
unset _pid

for _pkg in $GMS_KILL_LIST; do
  echo "$_installed_pkgs" | grep -Fq "package:$_pkg" || continue
  log "GMS" "Force-stopping $_pkg"
  am force-stop "$_pkg" >/dev/null 2>&1 || log "GMS" "Warning: Failed to force-stop $_pkg"
  _count=$((_count + 1))
done

if echo "$_installed_pkgs" | grep -q "package:com.android.vending"; then
  log "GMS" "Clearing Play Store data..."
  pm clear com.android.vending >/dev/null 2>&1 || log "GMS" "Warning: Failed to clear Play Store data"
  log "GMS" "Play Store data cleared"
fi
unset _installed_pkgs

log "GMS" "Force-stopped $_count packages"
log "GMS" "Finish"
exit 0
