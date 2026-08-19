# Photos des joueurs — Italie

## Résultat

J'ai retrouvé la photo officielle de **186 joueurs sur 196** (95%) sur les
fiches individuelles de kingsleague.pro, pour les 12 clubs de la Kings
League Italie.

Pour 10 joueurs, pas de photo disponible (absents de l'effectif actuel du
club sur le site officiel, ou fiche sans photo réelle) : ils garderont
leurs initiales, comme prévu par le jeu. Liste complète dans
`italie_not_found.txt`.

## Le script a changé (généricisé)

`download_and_push.ps1` fonctionne maintenant pour n'importe quel pays via
un paramètre `-Country`. Tu peux réutiliser ce même fichier pour l'Espagne
si besoin.

## Comment l'utiliser

1. Copie `download_and_push.ps1`, `italie_manifest.csv` et
   `italie_not_found.txt` à la racine de ton clone local du repo
   `kings-manager` (à côté de `index.html`). Remplace l'ancien
   `download_and_push.ps1` par celui-ci.
2. Dans le terminal PowerShell :
   ```
   powershell -ExecutionPolicy Bypass -File .\download_and_push.ps1 -Country italie
   ```
3. Il télécharge chaque photo dans
   `images/players/italie/<club>/<joueur>.png`, puis te propose de
   commit + push automatiquement.

## Prochaine étape

Dis-moi quand c'est fait et je passe à l'Allemagne puis le Mexique.
