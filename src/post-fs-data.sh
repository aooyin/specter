#!/system/bin/sh
set -e
MODDIR=${0%/*}

. "$MODDIR/lib/common.sh"
. "$MODDIR/lib/paths.sh"
. "$MODDIR/lib/config_env.sh"

resolve_conflicts
