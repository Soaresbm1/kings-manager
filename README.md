# Kings Manager 7v7 — 1.1

Jeu de gestion de football en solo inspiré du format 7v7 de la Kings League : France, Brésil, Espagne, Italie, Allemagne et Mexique. Le jeu fonctionne entièrement dans le navigateur, avec des carrières sauvegardées localement et exportables en JSON.

## Nouveautés de la version 1.1

- **Matchs continus** : le porteur, le ballon et les positions sont conservés entre les actions et les minutes. Une interception déclenche une vraie transition ; atteindre la limite d'une séquence ne fait plus perdre le ballon.
- **Reprises visibles** : engagements, relances, touches, corners, coups francs et shootouts se raccordent au terrain. Le placement affiché est celui utilisé par le moteur.
- **Banc de touche** : possession, tirs, xG, énergie et contexte de jeu en direct. Les trois intentions — prudente, équilibrée, offensive — modifient les risques, les projections, le rythme et la dépense d'énergie.
- **Décisions cohérentes** : l'IA réagit au score en fin de match. Les cartes et le penalty du président attendent la fin de la séquence déjà jouée ; le score ne révèle plus les buts à venir.
- **Effectifs et statistiques fiables** : compositions de secours hors poste, blessures prises en compte, remplacements sans doublon et notes pour tous les joueurs ayant participé.
- **Contrôles automatiques** : simulations reproductibles et vrais parcours du jeu sur Chromium, Firefox et WebKit ; vérification quotidienne du moteur sur GitHub Actions.

## Effectifs vérifiés le 26 octobre 2026

Les six ligues ont été contrôlées à partir des publications officielles. Les effectifs publiés
des Kings Cup 2026/27 du Brésil, d'Italie et du Mexique remplacent l'ancienne base ; le Mexique
compte dix clubs actifs. En France, Espagne et Allemagne, les corrections et mouvements
confirmés sont intégrés avec une couverture partielle signalée sur l'accueil. Les inscriptions
temporaires et les sources historiques sont distinguées dans le [dossier de recherche](research/README.md).

Ces effectifs s'appliquent aux **nouvelles carrières**. Les parties existantes conservent leurs
équipes et leur mercato. Les notes sont celles du jeu ; les nouveaux attributs et âges non
vérifiés restent des estimations identifiées dans les données.

Pour reconstruire la base après une correction documentée : `node scripts/sync-rosters.cjs`.
Pour contrôler sa cohérence sans la modifier : `node scripts/sync-rosters.cjs --check`.

## Lancer le jeu

Les portraits sont associés aux joueurs par les identifiants des fiches officielles Kings League,
avec des alias vérifiés pour les anciennes carrières et les joueurs transférés. Ils se chargent
depuis le CDN officiel ; une connexion est nécessaire pour les nouveaux portraits. Les cas sans
portrait publié ou avec une identité ambiguë gardent leurs initiales, sans photo inventée.
Les correspondances et limites sont détaillées dans [le rapport des portraits](research/player-photos-report.json).

Contrôle hors ligne des correspondances : `node scripts/sync-player-photos.cjs --check`.
Récupération et contrôle des fichiers originaux dans un cache local : `node scripts/verify-player-photos.cjs`.

Aucune installation requise. Ouvre simplement `index.html` dans ton navigateur (Chrome, Firefox, Edge...).

Pour éviter d'éventuels soucis de chargement de fichiers locaux, tu peux aussi lancer un petit serveur local :

```
# avec Python
python -m http.server 8000
```

puis ouvre `http://localhost:8000` dans ton navigateur.

Avec Node.js, `npm run dev` démarre également le jeu sur `http://127.0.0.1:4173`. Les images du dépôt restent servies localement. `npm run dev:assets` est réservé à une copie de développement sans images : il autorise leur chargement depuis le site publié.

## Comment jouer

1. **Accueil** : choisis ta ligue et ton équipe, ou reprends une carrière existante.
2. **Calendrier** : consulte le calendrier complet aller-retour, prépare ton prochain match.
3. **Avant le match** : sélectionne tes 7 joueurs dont un gardien, une formation, un plan offensif, un plan défensif et une intention. Le symbole ↔ indique un joueur utilisé hors de son poste habituel.
4. **Simulation** : observe les enchaînements sur le terrain, ajuste ton intention au banc de touche et consulte les statistiques. Les xG décrivent la qualité cumulée des occasions, sans garantir le résultat. Utilise "Avancer rapidement" pour terminer le match instantanément.
5. **Résumé** : score final, possession, tirs, notes des joueurs.
6. **Classement** : suis ta progression et celle des autres équipes.
7. **Effectif** : consulte les statistiques et la forme de tes joueurs.
8. **Mercato** : fenêtres ouvertes à la mi-saison et en fin de saison. Achète des joueurs (offres négociables) et vends les tiens pour financer ton effectif.

## Structure des fichiers

- `index.html` — interface du jeu
- `style.css` — mise en forme
- `data.js` — données des ligues, équipes, joueurs, formations et plans tactiques
- `engine.js` — moteur de simulation (calendrier, matchs, classement, IA)
- `app.js` — logique de l'interface et gestion de l'état du jeu

## Notes

- Le budget de départ dépend du club.
- La forme des joueurs évolue selon leurs performances et résultats.
- Les autres équipes jouent et font des transferts automatiquement ; les autres ligues avancent aussi pendant ta carrière.

## Développement et vérification

```sh
npm ci
npm test                 # moteur, données, interface et régressions, graine reproductible
npm run test:matrix      # trois graines indépendantes
npm run test:e2e         # vrais parcours du jeu dans trois navigateurs
```

La CI exécute les simulations avant les tests navigateur pour chaque push et pull request. Un contrôle quotidien teste aussi le moteur ; il ne modifie ni les données ni les sauvegardes. Aucun service payant ni backend n'est requis.

