#!/system/bin/sh
MODDIR=${0%/*}
. "$MODDIR/../lib/common.sh"
. "$MODDIR/../lib/paths.sh"
. "$MODDIR/../lib/urls.sh"

KEYBOX_FILE="/data/adb/tricky_store/keybox.xml"
INFO_PATH="$MODDIR/../webroot/json/keybox_info.json"

ensure_dir "$(dirname "$INFO_PATH")"

_installed=false
_source=""
_source_version=""
_up_to_date=false
_revoked=false

# Extract serial number from hex-encoded DER certificate
_parse_serial() {
  _h="$1"
  case "$_h" in 30*) _h="${_h#30}" ;; *) return 1 ;; esac
  _l_hex="${_h:0:2}" _l_dec=$((16#$_l_hex))
  [ $_l_dec -ge 128 ] && _h="${_h:2 + ($_l_dec - 128) * 2}" || _h="${_h:2}"

  case "$_h" in 30*) _h="${_h#30}" ;; *) return 1 ;; esac
  _l_hex="${_h:0:2}" _l_dec=$((16#$_l_hex))
  [ $_l_dec -ge 128 ] && _h="${_h:2 + ($_l_dec - 128) * 2}" || _h="${_h:2}"

  case "$_h" in
    a0*)
      _ctx_len_hex="${_h:2:2}"
      _ctx_len=$((16#$_ctx_len_hex))
      _h="${_h:4 + _ctx_len * 2}"
      ;;
  esac

  case "$_h" in 02*) _h="${_h#02}" ;; *) return 1 ;; esac
  _l_hex="${_h:0:2}" _l_dec=$((16#$_l_hex))
  if [ $_l_dec -ge 128 ]; then
    _n=$((_l_dec - 128))
    _sl=$((16#${_h:2:_n * 2}))
    _serial_hex="${_h:2 + _n * 2:$_sl * 2}"
  else
    _serial_hex="${_h:2:$_l_dec * 2}"
  fi

  _serial=$(echo "$_serial_hex" | sed 's/^0*//')
  [ -z "$_serial" ] && _serial="0"
  return 0
}

if [ -f "$KEYBOX_FILE" ]; then
  _installed=true

  _b64=$(sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' "$KEYBOX_FILE" | head -20 | grep -v 'CERTIFICATE' | tr -d '\n')
  if [ -n "$_b64" ] && _hex=$(echo "$_b64" | base64 -d 2>/dev/null | od -v -tx1 | awk 'BEGIN{ORS=""} {for(i=2;i<=NF;i++) printf "%s", $i}') && _parse_serial "$_hex"; then
    log "KEYBOX_INFO" "Serial: $_serial"

    if check_network; then
      _history_json=$(download "$CATALOG_URL" 2>/dev/null)
      log "KEYBOX_INFO" "History response length: ${#_history_json}"

      if [ -n "$_history_json" ]; then
        # Find matching entry by serial
        _match=$(echo "$_history_json" | grep -o '"serial":"'"$_serial"'"')
        if [ -n "$_match" ]; then
          _source=$(echo "$_history_json" | grep -o '"source":"[^"]*"[^}]*"serial":"'"$_serial"'"' | sed 's/.*"source":"\([^"]*\)".*/\1/')
          _source_version=$(echo "$_history_json" | grep -o '"version":"[^"]*"[^}]*"serial":"'"$_serial"'"' | sed 's/.*"version":"\([^"]*\)".*/\1/')
          _revoked=$(echo "$_history_json" | grep -o '"revoked":\(true\|false\)[^}]*"serial":"'"$_serial"'"' | sed 's/.*"revoked":\(true\|false\).*/\1/')
          [ -z "$_source" ] && _source="yuri"
          [ -z "$_source_version" ] && _source_version="?"
          [ -z "$_revoked" ] && _revoked=false
          log "KEYBOX_INFO" "Found: source=$_source version=$_source_version revoked=$_revoked"

          # Check if up-to-date by comparing with latest for this source
          _latest_for_source=$(echo "$_history_json" | grep -o '"'"$_source"'":"[0-9]*"' | sed 's/.*":"//;s/"//')
          if [ -n "$_source_version" ] && [ "$_source_version" = "$_latest_for_source" ]; then
            _up_to_date=true
          fi
        else
          log "KEYBOX_INFO" "Not found in history"
        fi
      fi
    else
      log "KEYBOX_INFO" "Network check failed"
    fi
  fi
fi

cat <<EOF > "$INFO_PATH"
{
  "installed": $_installed,
  "source": "$(_escape_json "$_source")",
  "source_version": "$(_escape_json "$_source_version")",
  "up_to_date": $_up_to_date,
  "revoked": $_revoked
}
EOF

unset _installed _source _source_version _up_to_date _revoked _b64 _hex _serial _serial_hex _history_json _match _ctx_len_hex _ctx_len _l_hex _l_dec _n _sl _latest_for_source
exit 0
