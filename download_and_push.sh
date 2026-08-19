#!/usr/bin/env bash
#
# Télécharge les photos des joueurs Kings League Espagne (source officielle
# kingsleague.pro) et les place au bon endroit dans le repo kings-manager,
# puis (optionnel) commit + push.
#
# Utilisation :
#   1. Place ce script, "espagne_manifest.csv" et "espagne_not_found.txt"
#      à la racine de ton clone local du repo kings-manager (le dossier qui
#      contient index.html, data.js, etc.)
#   2. Lance :  bash download_and_push.sh
#   3. Le script télécharge les photos trouvées dans
#      images/players/espagne/<club>/<joueur>.png
#   4. Il te propose ensuite de commit + push automatiquement (réponds "n"
#      pour le faire toi-même à la main).
#
set -uo pipefail

MANIFEST="espagne_manifest.csv"
TARGET_DIR="images/players/espagne"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

if [ ! -f "$MANIFEST" ]; then
  echo "Erreur : $MANIFEST introuvable. Lance ce script depuis le dossier où tu l'as téléchargé,"
  echo "et vérifie que espagne_manifest.csv est bien à côté."
  exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
  echo "Erreur : le dossier $TARGET_DIR n'existe pas ici."
  echo "Lance ce script depuis la racine de ton clone local du repo kings-manager."
  exit 1
fi

OK_LOG="$(mktemp)"
FAIL_LOG="$(mktemp)"

while IFS=, read -r file url; do
  [ -z "$file" ] && continue
  [ "$file" = "file" ] && continue   # skip header
  outpath="$TARGET_DIR/$file"
  mkdir -p "$(dirname "$outpath")"
  printf 'Téléchargement : %s ... ' "$file"
  if curl -sSL -A "$UA" --retry 2 --retry-delay 1 -o "$outpath.tmp" "$url" \
     && [ -s "$outpath.tmp" ] \
     && file "$outpath.tmp" | grep -qi "image"; then
    mv "$outpath.tmp" "$outpath"
    echo "OK"
    echo "$file" >> "$OK_LOG"
  else
    rm -f "$outpath.tmp"
    echo "ECHEC"
    echo "$file" >> "$FAIL_LOG"
  fi
done < "$MANIFEST"

ok_count=$(wc -l < "$OK_LOG" | tr -d ' ')
fail_count=$(wc -l < "$FAIL_LOG" | tr -d ' ')

echo ""
echo "Terminé : $ok_count photos téléchargées, $fail_count échecs."
if [ "$fail_count" -gt 0 ]; then
  echo "Fichiers en échec (réseau/URL invalide) :"
  cat "$FAIL_LOG"
fi
echo ""
echo "Les joueurs sans photo officielle disponible (39) sont listés dans espagne_not_found.txt"
echo "(le jeu affiche automatiquement leurs initiales, rien à faire de plus pour eux)."
echo ""

read -r -p "Committer et pousser ces changements sur GitHub maintenant ? [y/N] " reply
if [[ "$reply" =~ ^[Yy]$ ]]; then
  git add "$TARGET_DIR"
  git commit -m "Ajout des photos des joueurs Espagne (Kings League, source officielle kingsleague.pro)"
  git push
  echo "Poussé sur GitHub."
else
  echo "Pas de commit automatique. Les fichiers sont prêts dans $TARGET_DIR, tu peux commit/push toi-même."
fi

rm -f "$OK_LOG" "$FAIL_LOG"
