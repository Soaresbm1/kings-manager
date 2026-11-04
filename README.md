# Kings Manager 7v7 — 1.6

Jeu de gestion de football en solo inspiré du format 7v7 de la Kings League : France, Brésil, Espagne, Italie, Allemagne et Mexique. Les matchs et la gestion fonctionnent dans le navigateur, avec des carrières locales exportables en JSON et une synchronisation chiffrée facultative.

## Nouveautés de la version 1.6

- **Promesses suivies** : chaque accord affiche son objectif avant la réponse. Temps de jeu, repos, titularisation et rôle offensif sont évalués sur les rencontres effectivement validées. L’accord ne donne plus de bonus immédiat ; une promesse tenue donne +2 de forme, une promesse manquée −3, dans les limites habituelles. Les indisponibilités et départs sont pris en compte. Le suivi voyage dans les sauvegardes et reste borné à 12 000 caractères.
- **Entraînement facultatif** : une séance par journée de championnat, avec sélection des joueurs, aperçu des effets et confirmation. La récupération donne +2 de forme. Technique et physique coûtent 2 de forme et donnent un point d’attribut après quatre séances du même type, avec recalcul selon la valorisation existante. Aucun entraînement automatique ni guérison artificielle.
- **PC et mobile** : dans Mes carrières → Synchroniser PC et mobile, active une carrière puis saisis son code personnel sur l’autre appareil. Les données sont chiffrées avant l’envoi au stockage privé. Les versions concurrentes déclenchent un choix explicite ; télécharger une version crée une carrière distincte. Le jeu continue hors ligne, puis les sauvegardes locales vérifiées sont envoyées avec la connexion. L’installation seule n’active pas la synchronisation.
- **Règlements épinglés** : les profils de championnat et de tournoi sont enregistrés par compétition et saison. Le format historique reste le défaut des anciennes et nouvelles carrières. Une adaptation du guide général Kings League vérifié le 4 novembre 2026 peut être choisie explicitement ; elle ne prétend pas certifier le règlement particulier de chaque ligue. Les choix pour la saison suivante ne changent pas les matchs en cours.

Le code personnel donne accès à la carrière distante : garde-le privé. Il est mémorisé localement lors de l’appairage et exclu des exports JSON. Sans ce code, aucune récupération du coffre chiffré n’est possible. Un code correspond à une carrière ; déconnecter un appareil conserve les copies, supprimer la copie distante exige une confirmation et une révision encore à jour.

### Déploiement du service facultatif

`api/career-sync.js` utilise Node.js et `@vercel/blob`, avec un store **privé** connecté au projet Vercel. Le jeton `BLOB_READ_WRITE_TOKEN` reste une variable serveur ; aucune variable publique ni clé cloud ne doit être ajoutée au dépôt. Les espaces `production` et `preview` sont séparés. Le serveur local renvoie une indisponibilité explicite tant qu’un véritable stockage n’est pas configuré.

Les écritures sont atomiques avec précondition ETag, et les lectures privées désactivent le cache. Les réponses API et le service worker excluent ces transferts du cache hors ligne. Le chiffrement AES-GCM emploie une clé dérivée par HKDF distincte de la capacité d’accès envoyée au serveur ; le serveur ne reçoit pas le secret maître. Les copies sont compressées lorsque le navigateur le permet, avec des limites de 4 Mio décompressés et 3 Mio pour la requête. Un limiteur en mémoire complète les protections Vercel sans constituer une limite distribuée. Une panne ou un quota distant ne remplace jamais la sauvegarde locale.

Après une sauvegarde vérifiée, l’envoi attend 30 secondes sans nouvelle écriture. Le rechargement et le retour en ligne reprennent les envois depuis la carrière locale, sans dupliquer les grosses sauvegardes dans une seconde file. Les anciennes photos, sauvegardes locales et fichiers JSON continuent de fonctionner sans service distant.

## Nouveautés de la version 1.5

- **Recrutement ciblé** : dans Mercato → Rechercher, un panneau propose jusqu’à trois joueurs selon les besoins de la composition enregistrée, les rôles et le budget. Les raisons sont affichées, avec accès à la fiche, à la comparaison, au suivi et aux offres existantes. Les valeurs sont indicatives ; les négociations et leurs probabilités restent inchangées.
- **Progression observée** : l’onglet Effectif et les fiches des joueurs suivis présentent les relevés de note globale, attributs, forme, valeur et matchs en carrière. Le suivi commence à la création ou à la reprise, sans reconstituer des données anciennes. Les relevés voyagent avec les sauvegardes, exports et restaurations ; leur volume reste limité à 48 000 caractères, 80 joueurs et 60 observations par joueur.
- **Assistant de banc** : les énergies individuelles et alertes sont issues des séquences déjà présentées. Jusqu’à deux remplacements compatibles et plus frais sont proposés dans les ajustements tactiques ; une confirmation est nécessaire et les commandes existantes vérifient encore les disponibilités. Les exclusions ne peuvent pas être contournées. Aucune décision automatique ni modification des calculs de simulation.

Les nouvelles aides restent disponibles hors ligne. Les périodes sans relevé sont inconnues, et les observations les plus anciennes peuvent être retirées pour maintenir des sauvegardes raisonnables. Le classement de recrutement est une aide de lecture, pas un bonus ou une garantie de performance.

## Nouveautés de la version 1.4

- **Application installable** : manifeste, icônes adaptées à l’écran d’accueil et lancement autonome. Le panneau « Installation et hors ligne » propose le bouton d’installation quand le navigateur le permet, ainsi que les instructions Chrome, Edge et Safari.
- **Jeu hors ligne** : après un premier chargement connecté et l’indication « Prêt hors ligne », création et reprise de carrière, tactiques, matchs, historique, sauvegardes et imports/exports restent disponibles. Le cœur du jeu, les polices et les blasons sont conservés localement. Les portraits consultés sont mis en cache dans une limite de 72 photos ; une photo absente garde le rendu de remplacement existant.
- **Mises à jour différées** : chaque version possède une copie cohérente de ses fichiers, vérifiés par SHA-256 avant l’installation. Une version attendante ne recharge jamais une partie. L’application de la mise à jour se fait depuis l’accueil, après la fin des imports et des éventuelles sauvegardes en échec, avec les autres onglets fermés. Fermer toutes les fenêtres du jeu permet aussi la mise à jour au prochain lancement.

Les carrières restent dans le stockage existant du navigateur, séparé du cache applicatif. L’installation seule ne synchronise pas plusieurs appareils ou navigateurs : la synchronisation facultative de la version 1.6 ou l’export/import permet leur transfert. Un navigateur peut libérer son cache sous pression de stockage ; l’application vérifie sa disponibilité et propose de le préparer de nouveau. Conserver un export de ses carrières reste possible sans connexion.

Après toute modification d’un fichier précaché, exécuter `npm run pwa:build`, puis `npm run pwa:check`. La suite de tests vérifie aussi que l’inventaire est à jour. Les polices locales conservent leurs licences OFL dans `assets/fonts/` ; leurs sources et les scripts de génération des icônes sont documentés sur place.

## Nouveautés de la version 1.3

- **Rapport adverse** : les cinq derniers résultats réellement joués, les séances de tirs au but, les buteurs de la saison, les absences et la comparaison des lignes sont disponibles dans la préparation du match. En tournoi, les résultats proviennent de la ligue de l’adversaire. Les données absentes restent signalées ; aucune composition IA n’est annoncée comme certaine.
- **Débrief tactique** : le résumé et les nouveaux rapports archivés présentent la chronologie des faits marquants, des formats Kings et des décisions humaines. Les statistiques sont relevées aux frontières de séquences et pendant l’avance rapide ; les fenêtres avant/après reposent uniquement sur ces relevés. Elles décrivent une évolution sans prouver un lien causal. Les anciens rapports et les matchs IA sans relevés conservent leurs faits réels, sans courbe inventée.
- **Sauvegardes vérifiées** : la confirmation apparaît après écriture et relecture. Le point précédent de chaque carrière peut être restauré depuis Mes carrières après confirmation ; l’état remplacé devient le nouveau point de retour. Les erreurs de quota, de lecture ou de stockage restent visibles. Le nouvel essai sauvegarde la progression en mémoire ; l’export reste possible. Une progression non enregistrée est protégée à la sortie. Une importation refusée ne peut pas annoncer un succès.

Les sauvegardes principales gardent leur format et leur clé existants. Un journal local séparé, compacté sans perte, conserve au maximum une révision précédente par carrière et permet de reconnaître une écriture interrompue ; une donnée corrompue n’est jamais remplacée automatiquement par une carrière vide. Les anciens journaux non compactés restent lisibles. La version 1.3 n’ajoutait pas encore de service de synchronisation.

## Nouveautés de la version 1.2

- **Rapports persistants** : ouvre les rapports depuis le calendrier ou l’historique des rencontres, filtré par saison et par club. Les matchs joués à partir de cette version conservent leurs statistiques, participants, notes et événements importants, y compris les rencontres IA de ta ligue et du tournoi international. Les noms restent ceux du jour du match après un transfert ou un renommage. Les anciens scores restent disponibles sans statistiques inventées. Les 200 derniers rapports sont conservés, dans une enveloppe maximale de 900 000 caractères JSON ; aucune animation complète n’est enregistrée.
- **Trois tactiques nommées** : Habituel, Protéger l’avance et Revenir au score. Enregistrer une configuration dans l’onglet Tactique active cet emplacement ; les changements suivants y sont sauvegardés automatiquement. Charger depuis l’avant-match ou les ajustements en direct reste temporaire. Un enregistrement explicite permet de conserver ces ajustements. Les compositions sont réparées si un joueur a quitté le club ou est blessé, et un chargement en match respecte les exclusions.
- **Phases Kings préparées** : choisis à l’avance l’ordre d’entrée de l’Escalier et les priorités du Matchball, avec aperçu des joueurs de champ et gardien indiqué séparément. Le premier joueur de la liste entre d’abord ou reste le plus longtemps. Les priorités suivent les identités malgré les changements de composition ; les exclusions temporaires n’effacent pas l’ordre. Sans préparation, le choix pendant le match reste proposé. Les ordres sont aussi respectés en avance rapide.

Les anciennes carrières migrent leur tactique dans **Habituel** ; les deux autres emplacements commencent vides. Les rapports et les tactiques voyagent avec l’export/import JSON et les rapports survivent au changement de saison.

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
- `interface.js` / `interface.css` — accessibilité des fenêtres, tableaux mobiles et présentation commune ; aucune logique de simulation
- `career-history.js`, `tactic-presets.js`, `kings-preparation.js` — rapports compacts, emplacements tactiques et préparation des phases, avec leurs feuilles CSS et tests autonomes
- `career-tools.js` / `career-tools.css` — intégration de ces outils dans la carrière et les écrans existants
- `opponent-report.js`, `tactical-debrief.js`, `career-storage.js` — rapport adverse, analyse des relevés et stockage vérifié, avec leurs styles et tests purs
- `manager-tools.js` / `manager-tools.css` — branchement des analyses, retours de sauvegarde et restauration dans les écrans existants
- `prototypes/` — laboratoires isolés, sans accès aux carrières enregistrées

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

## Interface et laboratoires de comparaison

Le centre de match garde le score et les commandes accessibles sur téléphone. Le porteur du ballon est repéré sur le terrain ; les annonces suivent les événements déjà joués. La pause suspend le dessin continu. Les préférences de mouvement réduit suppriment les effets décoratifs, tout en conservant les déplacements utiles à la lecture du match.

Le marché affiche 40 joueurs par page. Les filtres et le tri portent toujours sur l'ensemble des joueurs. Sur mobile, l'effectif et le marché proposent une vue synthétique et un bouton **Toutes les statistiques**. Les fenêtres gèrent le focus et Échap ; un geste tactique ou un sélecteur de poste garde la priorité pour son annulation.

Avec `npm run dev`, ouvrir :

- [Variantes du centre de match](http://127.0.0.1:4173/prototypes/match-center/) — touches 1–3, flèches et R pour rejouer ; `?v=2` conserve la sélection.
- [Laboratoire de robustesse](http://127.0.0.1:4173/prototypes/robustness/) — données normales, difficiles, vides ou uniques, sur les composants réels. L'écran et le jeu de données sont conservés dans l'URL.

| Variante | Axe | Compromis |
| --- | --- | --- |
| Banc du coach | Terrain dominant et consignes à proximité | Moins de place pour les statistiques |
| Régie du match | Observation, avec fil du match repliable | Un geste supplémentaire pour ouvrir les détails |
| Analyse tactique | Chronologie et indicateurs plus présents | Lecture plus dense |

Les laboratoires exécutent le vrai jeu dans une iframe d'origine opaque, avec un stockage en mémoire et une graine fixe. Ils ne sont pas importés par l'application. Les trois variantes restent disponibles pour comparaison ; aucune sélection n'est imposée à la carrière.

`node scripts/profile-interface.cjs` compare le HEAD Git et les fichiers de travail dans Chromium, avec un processeur ralenti ×4 et le réseau externe bloqué. Le rapport est écrit dans `test-results/interface-profile.json`. Ces mesures de bureau ne remplacent pas une vérification sur téléphone physique : clavier virtuel, encoche, barres du navigateur, défilement et gestes.

