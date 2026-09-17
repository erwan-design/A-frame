#!/bin/zsh
# Export vidéo d'une navigation scénarisée sur le site (voir record.py pour le scénario).
#
#   zsh tools/video/build.sh [sortie.mp4] [largeur] [hauteur] [durée]
#
# Prérequis : serveur local sur le port 4560 (python3 tools/serve.py 4560 .), un Python avec PIL
# (variable PYTHON), swiftc (outils en ligne de commande Xcode). Aucun ffmpeg.
set -e
HERE=${0:A:h}
OUT=${1:-"$HOME/Downloads/aframe-navigation-1740x1140.mp4"}
WORK=$(mktemp -d -t aframe-video)
trap 'rm -rf "$WORK"' EXIT
${PYTHON:-python3} "$HERE/record.py" "$WORK/frames" ${2:-1740} ${3:-1140} ${4:-10}
swiftc -O "$HERE/encode.swift" -o "$WORK/encode"
FPS=60 BITRATE=${BITRATE:-20000000} "$WORK/encode" "$WORK/frames" "$OUT" "${CHECK:-$WORK/check}"
echo "-> $OUT"
