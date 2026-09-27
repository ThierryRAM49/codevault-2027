#!/usr/bin/env bash
# Scanne les réseaux Wi-Fi réellement visibles depuis CETTE machine (via nmcli)
# et les envoie à un serveur SécuriShield pour affichage dans l'onglet Wi-Fi.
#
# À lancer sur une machine qui a une vraie carte Wi-Fi (pas sur le serveur
# distant lui-même — voir le README du dossier "securishield PRO - v.01").
#
# Usage :
#   ./scripts/wifi-real-scan.sh
#   SECURISHIELD_SERVER=http://localhost:4000 SECURISHIELD_USER=admin ./scripts/wifi-real-scan.sh
#
# Pré-requis : nmcli (NetworkManager), curl, et jq OU python3 pour construire le JSON.
# Si le serveur SécuriShield tourne sur une machine distante, ouvre d'abord un
# tunnel SSH (ex: ssh -L 4000:localhost:4000 <user>@<serveur>) avant de lancer ce script.

set -euo pipefail

SERVER="${SECURISHIELD_SERVER:-http://localhost:4000}"
USERNAME="${SECURISHIELD_USER:-admin}"

echo "=== SécuriShield — Import Wi-Fi réel ==="
echo "Serveur : $SERVER"

if ! command -v curl >/dev/null 2>&1; then
  echo "Erreur : curl est requis." >&2
  exit 1
fi
if ! command -v nmcli >/dev/null 2>&1; then
  echo "Erreur : nmcli introuvable. Installe NetworkManager (ex: sudo apt install network-manager)." >&2
  exit 1
fi
HAVE_JQ=0
HAVE_PY=0
command -v jq >/dev/null 2>&1 && HAVE_JQ=1
command -v python3 >/dev/null 2>&1 && HAVE_PY=1
if [ "$HAVE_JQ" -eq 0 ] && [ "$HAVE_PY" -eq 0 ]; then
  echo "Erreur : jq ou python3 est requis pour construire le JSON." >&2
  exit 1
fi

json_get() {
  # $1 = json string, $2 = clé
  if [ "$HAVE_JQ" -eq 1 ]; then
    printf '%s' "$1" | jq -r --arg k "$2" '.[$k] // empty'
  else
    python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get(sys.argv[2],'') or '')" "$1" "$2"
  fi
}

read -r -s -p "Mot de passe SécuriShield (\"$USERNAME\") : " PASSWORD
echo

LOGIN_JSON=$(curl -sf -X POST "$SERVER/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}") || {
  echo "Échec de connexion à $SERVER — le serveur est-il bien lancé et accessible (tunnel SSH ouvert) ?" >&2
  exit 1
}

ACCESS_TOKEN=$(json_get "$LOGIN_JSON" "accessToken")
if [ -z "$ACCESS_TOKEN" ]; then
  echo "Identifiants refusés." >&2
  exit 1
fi
echo "Connecté."

echo "Scan Wi-Fi en cours (nmcli)..."
nmcli device wifi rescan >/dev/null 2>&1 || true
sleep 2

RAW=$(nmcli -m multiline -f SSID,BSSID,SIGNAL,SECURITY device wifi list)

NETWORKS_JSON="[]"
ssid="" bssid="" signal="0" security=""

emit_network() {
  [ -z "$ssid" ] && return
  local dbm=$(( (signal / 2) - 100 ))
  local sec="${security:-Ouvert}"
  if [ "$HAVE_JQ" -eq 1 ]; then
    NETWORKS_JSON=$(printf '%s' "$NETWORKS_JSON" | jq --arg ssid "$ssid" --arg bssid "$bssid" \
      --argjson signal "$dbm" --arg security "$sec" \
      '. + [{ssid:$ssid, bssid:$bssid, signal:$signal, security:$security}]')
  else
    NETWORKS_JSON=$(python3 -c "
import json,sys
arr = json.loads(sys.argv[1])
arr.append({'ssid': sys.argv[2], 'bssid': sys.argv[3], 'signal': int(sys.argv[4]), 'security': sys.argv[5]})
print(json.dumps(arr))
" "$NETWORKS_JSON" "$ssid" "$bssid" "$dbm" "$sec")
  fi
}

while IFS= read -r line; do
  key="${line%%:*}"
  value="${line#*:}"
  value="${value//\\:/:}"
  case "$key" in
    SSID)
      emit_network
      ssid="$value"; bssid=""; signal="0"; security=""
      ;;
    BSSID) bssid="$value" ;;
    SIGNAL) signal="$value" ;;
    SECURITY) security="$value" ;;
  esac
done <<< "$RAW"
emit_network

if [ "$HAVE_JQ" -eq 1 ]; then
  COUNT=$(printf '%s' "$NETWORKS_JSON" | jq 'length')
else
  COUNT=$(python3 -c "import json,sys; print(len(json.loads(sys.argv[1])))" "$NETWORKS_JSON")
fi
echo "$COUNT réseau(x) détecté(s). Envoi à SécuriShield..."

RESULT=$(curl -sf -X POST "$SERVER/api/wifi/import" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"networks\": $NETWORKS_JSON}") || {
  echo "Échec de l'envoi au serveur." >&2
  exit 1
}

echo "Terminé : $RESULT"
