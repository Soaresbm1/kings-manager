# Photos des joueurs — Espagne (pilote)

## Ce que j'ai fait

J'ai parcouru les pages officielles de chaque joueur sur **kingsleague.pro**
(les 12 équipes de la Kings League Espagne 2025/26) et retrouvé la photo
officielle de **163 joueurs sur 202** (81%).

Je ne peux pas télécharger les fichiers image directement depuis mon
environnement (accès réseau limité aux registres de paquets, pas au web
public), donc voici un petit script à lancer **une seule fois, en local**,
qui fait le travail à ta place : téléchargement + rangement dans les bons
dossiers + commit/push si tu veux.

## Contenu de ce zip

- `download_and_push.sh` — le script à exécuter
- `espagne_manifest.csv` — la liste des 163 photos trouvées (fichier cible + URL source)
- `espagne_not_found.txt` — les 39 joueurs pour qui je n'ai pas trouvé de photo
  officielle (ils garderont leurs initiales, comme prévu par le jeu)

## Comment l'utiliser

1. Ouvre un terminal et place-toi à la racine de ton clone local du repo
   `kings-manager` (le dossier qui contient `index.html`, `data.js`, etc.)
2. Copie les 3 fichiers de ce zip dans ce dossier.
3. Lance :
   ```
   bash download_and_push.sh
   ```
4. Le script télécharge chaque photo dans
   `images/players/espagne/<club>/<joueur>.png`, avec le nom exact attendu
   par le jeu (voir `_images-a-ajouter.txt`).
5. À la fin, il te demande si tu veux qu'il fasse `git add` + `git commit` +
   `git push` automatiquement. Réponds `y` pour tout pousser d'un coup, ou
   `n` si tu préfères vérifier les images avant de committer toi-même.

Pas besoin de me donner de token GitHub pour ça — le script utilise ton
authentification Git locale existante.

## Pourquoi certains joueurs n'ont pas de photo

Pour 39 joueurs, soit :
- ils n'apparaissent plus sur la page d'effectif actuelle de leur club sur
  kingsleague.pro (joueurs partis, historique, etc.),
- soit leur page de profil existe mais n'a pas de photo (image "placeholder"
  ou champ vide côté site officiel).

Je n'ai pas deviné ni mis de photo d'un autre joueur à la place. Ces
joueurs garderont l'affichage par initiales déjà géré par le jeu.

## Si le pilote Espagne te convient

Dis-le moi et je fais le même travail pour l'Italie, l'Allemagne et le
Mexique (~525 photos supplémentaires), avec le même format de livraison.
