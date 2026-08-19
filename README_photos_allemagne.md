# Photos des joueurs — Allemagne

## Résultat

J'ai retrouvé la photo officielle de **113 joueurs sur 131** (86%) sur les
fiches individuelles de kingsleague.pro, pour les 8 clubs de la Kings
League Allemagne (ERA Colonia, G2 FC, Istanbul United, Kaktus Kickers,
No Rules FC, Tiki Tacker FF, Vice Versa FC, Youniors F.C.).

Pour 18 joueurs, pas de photo disponible (absents de l'effectif actuel du
club sur le site officiel, ou fiche sans photo réelle) : ils garderont
leurs initiales, comme prévu par le jeu. Liste complète dans
`allemagne_not_found.txt`.

## Comment l'utiliser

1. Copie `download_and_push.ps1` (si tu ne l'as pas déjà, c'est le même
   script générique utilisé pour l'Italie), `allemagne_manifest.csv` et
   `allemagne_not_found.txt` à la racine de ton clone local du repo
   `kings-manager` (à côté de `index.html`).
2. Dans le terminal PowerShell :
   ```
   powershell -ExecutionPolicy Bypass -File .\download_and_push.ps1 -Country allemagne
   ```
3. Il télécharge chaque photo dans
   `images/players/allemagne/<club>/<joueur>.png`, puis te propose de
   commit + push automatiquement.

## Prochaine étape

Dis-moi quand c'est fait et je passe au Mexique.
