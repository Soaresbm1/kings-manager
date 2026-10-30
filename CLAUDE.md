# Kings Manager 7v7

> Ce fichier est lu automatiquement par Claude Code au début de chaque session dans ce
> dossier. **Tiens-le à jour** à chaque changement structurel notable (nouveau système,
> refonte d'un écran, changement de mécanique de jeu) — mais reste concis : le détail
> d'implémentation se retrouve en lisant le code ou `git log`, pas ici.

## Le projet

Jeu de gestion de football en solo, inspiré du format 7v7 de la **Kings League**. Une
carrière se joue dans **une seule ligue à la fois** (choisie à la création) parmi
**France, Brésil, Espagne, Italie, Allemagne, Mexique** (ce dernier = Kings League Mexico,
une ligue multi-nationale hispanophone/latino-américaine basée au Mexique, pas 100%
mexicaine — cf. `data.js:MEXICO_TEAMS`). 100% client-side : HTML/CSS/JS vanilla, aucun
build, aucun backend. Lancement : ouvrir `index.html` ou servir le dossier avec un serveur
statique.

## Architecture (chargement dans cet ordre, tout en portée globale — pas de modules)

1. **`data.js`** — données statiques : `LEAGUES` (les 6 ligues, chacune avec ses
   équipes/joueurs, ex. `FRANCE_TEAMS`, `SPAIN_TEAMS`...), `FORMATIONS` / `FORMATION_SLOTS`,
   `ATTACK_PLANS` / `DEFENSE_PLANS`, `SECRET_CARDS`.
2. **`player-photos.js`** — portraits officiels et index d'identité, générés hors ligne depuis
   `research/player-photo-observations.json` par `scripts/sync-player-photos.cjs`. Les images
   originales restent sur le CDN officiel ; aucune attribution approximative d'un homonyme.
3. **`matchengine-actions.js`** — moteur d'actions pur (pas de DOM, pas de `STATE`) : décide et
   résout, ACTION PAR ACTION, ce qui se passe pendant une possession (porteur → décision → passe/
   dribble/centre/tir → xG → issue), via `simulatePossessionChain()`. Contient aussi les constantes
   d'équilibrage centralisées (`MATCH_BALANCE`), les attributs dérivés (`computePassingRating`,
   `computeDribblingRating`, `computeFinishingRating`, `computeDefendingRating`,
   `computeGoalkeepingRating`) et la géométrie du terrain (`PITCH_W`, `clamp`,
   `computeSideAnchors`...). Chargé avant `engine.js` : ordre technique arbitraire (ce sont des
   déclarations de fonctions/constantes globales, jamais exécutées au chargement), mais reflète la
   dépendance logique — `engine.js` appelle ce module, jamais l'inverse.
4. **`engine.js`** — orchestration du match (pas de DOM) : calendrier (`generateSchedule`),
   bookkeeping minute par minute (`createMatchEngine`, règles Kings League, cartons, score,
   fatigue — voir plus bas), résolution instantanée (`simulateMatch`), classement
   (`computeStandings`), progression des joueurs (`developPlayer`), IA (voir plus bas). Délègue à
   `matchengine-actions.js` la simulation de chaque possession via `attemptRealAttack()` (interne),
   qu'il s'agisse d'un match IA instantané ou du match humain animé
   (`simulateMinute(minute, {withSequence:true})`, qui demande en plus les beats d'animation).
   `runBalanceSimulation(homeTeam, awayTeam, n)` simule un grand nombre de matchs et agrège les
   moyennes utiles (buts/tirs/xG par match, taux de passes réussies, avantage du terrain, taux de
   victoire du favori...) pour ajuster `MATCH_BALANCE` sans y jouer à la main.
   Cet outil croise les cinq profils de jeu pour isoler l'effet du niveau des joueurs ;
   `{ clubStyles: true }` en quatrième argument mesure les profils propres aux deux clubs.
   Conserve `possessionState` (camp, porteur, ballon, positions, reprise) entre les
   séquences et les minutes. `getPossessionState`/`getLiveStats` renvoient des copies
   de lecture ; ne jamais appeler `finalize` pour rafraîchir une statistique en direct.
5. **`matchchoreo.js`** — module d'interpolation pur (pas de DOM, aucun `Math.random()`)
   qui anime la chorégraphie produite par `engine.js`/`matchengine-actions.js` (positions
   joueurs/ballon frame par frame), façon Football Manager Mobile : `createChoreographer()`,
   `setAnchors`, `loadSequence`, `step(dt)`, `insertNext` (pour intercaler Arme Secrète/Penalty en
   cours de séquence). Ne décide jamais rien : consomme des "beats" déjà résolus (pass/cross/carry/
   dribble/tackle/interception/clear/out/shot/goal/save/miss/owngoal/phase).
   Les receveurs, gardiens et presseurs partent de leur position affichée ; la durée
   d'animation est prolongée si nécessaire pour respecter la vitesse des joueurs.
   Une passe interceptée porte `interceptorId`/`interceptorFrom`/`interceptorTo` : le
   défenseur rejoint le point de contact pendant le vol du ballon.
   Les beats récents possèdent `positionsBefore`/`positionsAfter`, qui font autorité
   pour tous les joueurs. Le placement décoratif historique n'est utilisé que pour
   les anciens beats sans instantané. `restart` et `recovery` matérialisent les reprises.
6. **`app.js`** — état du jeu (`STATE`), rendu des écrans, gestion des événements DOM,
   sauvegardes (`localStorage` + export/import JSON).
7. **`index.html` / `style.css`** — structure des écrans et mise en forme.

Dossiers `images/players/<dossier-ligue>/<club-slug>/<joueur-slug>.png` (photos, fallback
initiales si absentes ; le nom du dossier de ligue peut différer de la clé interne — voir
`app.js:LEAGUE_IMAGE_FOLDER`, ex. clé `brazil` → dossier `bresil`) et `joueurs/` (fichiers
`.txt` historiques, pas chargés par le jeu). Les effectifs sont désormais générés hors ligne
par `scripts/sync-rosters.cjs` à partir de `research/mercato-*.json` et d'une base historique
conservant les attributs du jeu. Les sources, dates, alias et incertitudes sont documentés
dans `research/README.md`. `ROSTER_REVISION` / `LEAGUES[key].rosterRevision` indiquent la
couverture complète ou partielle ; ne jamais transformer une inscription wildcard en départ
sans preuve. Les nouveaux profils portent leurs champs estimés, les anciens conservent leurs
notes du jeu (aucune note officielle Kings League). Les photos utilisent aussi `photoName`
pour conserver le fichier d'origine quand un joueur est renommé ou transféré.

`officialPlayerPhoto` privilégie l'identifiant officiel, puis l'identité du jeu ; une ancienne
carrière peut être reconnue par un alias exact et son club d'origine. `playerPhotoUrl` utilise
ce portrait confirmé ; les identités explicitement non résolues gardent leurs initiales. Le
chemin historique de `legacyPlayerPhotoUrl` reste en repli pour les joueurs des anciennes
carrières hors du catalogue actuel. Une origine ambiguë ne peut être déduite du club acheteur.
Les images
génériques officielles sont exclues du catalogue. `research/player-photos-report.json` détaille
les absences et ambiguïtés. `node scripts/verify-player-photos.cjs` récupère et contrôle les
originaux dans `.cache/player-photos/` (ignoré par Git) sans retouche ni modification des carrières.

La base vérifiée le 26/10/2026 concerne les nouvelles carrières. Le Mexique compte désormais
10 clubs actifs ; les sauvegardes existantes conservent leurs clubs, effectifs et transferts.
Ne jamais réappliquer le mercato réel sur une carrière déjà commencée.
Lorsqu'une très ancienne sauvegarde n'a aucune ligue secondaire, les ligues reconstruites
excluent les copies des joueurs déjà présents dans sa carrière (identité officielle ou alias
publié non ambigu). Les ligues déjà sauvegardées conservent leurs transferts simulés.

## Mécaniques de jeu (règles Kings League encodées dans `engine.js`)

- Match de 40 minutes (2 x 20), pas de match nul (tirs au but si égalité).
- **Escalier de départ** (0'-5') : montée progressive jusqu'au 7v7.
- **Ballon spécial** (17'-20') : tous les buts comptent double.
- **Dé Géant** (21'-23' à la reprise) : 1 à 3 joueurs de champ, plus un gardien
  par équipe (l'affichage du format inclut toujours le gardien).
- **Matchball** (dès 36') : escalier inversé, la première équipe à atteindre le score
  du leader + 1 but gagne immédiatement.
- **Cartes Secrètes** (une par équipe/match) et **Penalty du Président** (un par
  équipe/match) : fenêtres d'activation 5'-17' et 23'-35/36'.

## IA (dans `engine.js`, utilisée aussi par `app.js`)

- `chooseAiFormation(team)` — teste les 3 formations, retient celle qui maximise la force
  du meilleur onze possible avec l'effectif actuel.
- `getTeamStyle(team)` / `TEAM_STYLES` (`data.js`) — cinq profils de jeu générés, stables
  par identifiant de club : maîtrise, pressing, contre-attaque, bloc compact, jeu sur les côtés.
  Ce sont des identités de carrière, pas des descriptions documentaires des clubs réels.
- `chooseAiPlans(teamStrength, oppStrength, team)` et `chooseAiFormation(team)` conservent
  ce profil, tout en tenant compte de l'effectif et du rapport de force. `autoCoach` adapte
  l'intention au score sans effacer la personnalité du club.
- `PLAYER_ROLES` / `setup.playerRoles` — neuf rôles affectés par identité de joueur selon
  son poste de terrain. `normalizePlayerRoles` filtre les joueurs vendus et rétablit un rôle
  compatible après un changement de ligne. L'onglet sauvegarde les rôles ; les ajustements
  d'avant-match ou du match restent temporaires. Les anciennes carrières reçoivent les défauts.
  Le rôle agit sur courses, choix d'action, receveurs et dépense d'énergie ; le style agit sur
  largeur, profondeur, pression et rythme. Aucune hausse artificielle de notes ou de xG.
  Les instantanés du moteur font autorité pour l'animation et la simulation instantanée.
- `app.js:maybeAdjustAiTactics(minute)` — réévaluation du plan toutes les 5 min dès la 25e.
- `setup.autoCoach` active désormais cette adaptation dans le moteur commun aux
  matchs animés et aux ligues simulées ; le contrôle humain garde `autoCoach:false`.
- `setup.mentality` : `cautious`, `balanced` (repli des anciennes sauvegardes),
  `attacking`. Risque de passe, profondeur, rythme, exposition et énergie sont liés.
- `app.js:maybeActivateAiCard` / `maybeActivatePresidentPenaltyAi` — activation
  situationnelle selon le score.
- Mercato IA : `fillPositionGaps` (comble les postes sous le minimum) +
  `simulateAITransfers` (vend occasionnellement un joueur faible, renforce parfois le poste
  le plus faible — jamais chez l'équipe humaine).
- `app.js:chooseAiTurn` — IA du plateau physique en match humain, indépendante de l'IA
  "macro" ci-dessus.

## Simulation du match : action par action, façon Football Manager Mobile

Les duels exigent un défenseur à portée (`MATCH_BALANCE.dribble.duelDistance`) ;
sans adversaire proche, le porteur conduit librement. Les interceptions vérifient
la distance au segment de passe et le temps de déplacement disponible ; une passe
ratée sans intercepteur atteignable sort du terrain. Le Matchball interrompt toute
action dès la décision, y compris les possessions restantes de la même minute.

`simulatePossessionChain` accepte `initialState` et `ownGK`, et renvoie `endState`
(prochain camp, porteur, ballon, positions, type de reprise et point de sortie).
L'épuisement du budget d'actions conserve la possession (`retained`). Le moteur
enchaîne le prochain propriétaire réel ; il n'alterne plus arbitrairement les camps.
Les déplacements sans ballon sont calculés dans le moteur d'actions et les mêmes
instantanés alimentent l'animation. Le chemin sans animation prend les mêmes
décisions et consomme le même hasard, sans fabriquer les instantanés des beats.

Les événements de résultat portent `score:{homeGoals,awayGoals}`. L'interface
n'affiche que les événements déjà animés, puis actualise les statistiques à la
fin de séquence. Les demandes humaines de cartes/penalty président sont mises
en attente jusqu'à cette limite afin de ne pas modifier rétroactivement le jeu.

Une possession n'est plus un simple tirage au sort narré après coup : elle est construite,
action par action, par `matchengine-actions.js:simulatePossessionChain()` — choix du porteur,
positionnement (formations avec/sans balle, `computeSideAnchors`), décision cohérente (passe
courte/progressive/en profondeur, conduite, dribble, centre, tir, dégagement — voir
`chooseActionType`), résolution en comparant les attributs des joueurs concernés (voir les
`compute*Rating` dérivés), déplacement réel du ballon, puis éventuellement une occasion avec son
xG (`computeShotXG`) et sa résolution face au gardien (`resolveShotOutcome`). Une possession
s'arrête sur un tir, un dégagement, une interception ou un tacle — jamais de téléportation, jamais
de passe vers un adversaire. `engine.js:attemptRealAttack` (interne à `createMatchEngine`) appelle
ce moteur et applique le résultat à l'état du match (score, bonus "but double", stats détaillées,
fatigue — `MATCH_BALANCE.stamina`) ; **le même chemin de décision/résolution sert aussi bien aux
matchs IA instantanés (`simulateMatch`/`simulateAIMatch`, sans beats) qu'au match humain animé**
(`engine.js:simulateMinute(minute, {withSequence:true})`, qui demande en plus les beats
d'animation). Les tactiques (plan offensif/défensif, formation avec/sans balle) influencent
directement les poids de décision et la pression subie — jamais rétroactivement sur une action déjà
jouée. Voir `matchchoreo.js` pour l'interpolation déterministe de ces beats à l'écran — c'est le
système le plus dense du code, à relire directement plutôt que de dupliquer ici. L'ancien plateau à
tour de rôle façon Soccer Stars a été retiré depuis longtemps ; le joueur ne pilote plus aucune
action individuelle, il règle la tactique et regarde le match se dérouler.

### Déplacement collectif des joueurs sans ballon (`matchchoreo.js`)

Les ancres de formation (`engine.js:getFormationAnchors`, transmises via `setAnchors`) ne sont
qu'une **structure de départ** ("slot" de base + poste `pos`) — un joueur non impliqué dans le beat
en cours n'y reste jamais figé. Sa position CIBLE réelle est recalculée à chaque frame
(`computeDynamicTarget`) à partir de ce slot + un coulissement latéral vers le ballon
(`lateralPullAttack`/`lateralPullDefend`) + une montée/repli du bloc selon la possession/le poste/le
plan défensif (`depthShift`, `depthShiftDefendFactor`) + un ajustement de rôle temporaire
(`assignRoles` : `shortSupport`/`forwardRunner`/`wideSupport`/`restDefense` en possession,
`primaryPresser`/`coverDefender`/`farSideCompact`/`holdShape` sans le ballon), puis rejointe
PROGRESSIVEMENT par `steerTowards` (vitesse maximale, accélération bornée, jamais de saut). Les
joueurs impliqués dans le beat en cours (porteur/receveur/gardien, voir `computeInvolvedIds`) ne
passent pas par ce système : ils suivent le ballon par construction (`applyBeatFrame`, inchangé).
`getState()` expose `role`/`targetX`/`targetY`/`involvedIds`/`possessionSide`/`currentBeat` pour le
mode de débogage visuel (touche **D** pendant un match, voir `app.js:PITCH_DEBUG`/
`renderPitchDebugOverlay`) — cibles, rôles, porteur/presseur, limites du bloc, trajectoire du beat.

## Autres systèmes notables (chercher le nom de fonction dans `app.js`/`engine.js` au besoin)

- **Tableau tactique** : consignes, terrain horizontal et effectif filtrable dans trois panneaux.
  Le gardien est à gauche, l'attaque à droite ; seule la projection d'affichage change.
  La classe `coach-pitch` partage ce terrain horizontal avec la préparation et les
  ajustements en match. Leurs terrains se dimensionnent dans l'espace disponible ;
  sur petit écran, le terrain de 600 px défile horizontalement, l'écran ou le modal
  reste seul responsable du défilement vertical. Les coordonnées du moteur restent intactes.
  Une seule composition et un seul bouton de poste par joueur servent dans l'onglet,
  en préparation et pendant le match. `sanitizeTactic` reprend la composition principale
  des anciennes carrières ; `syncSingleComposition` maintient `formationOOP` et
  `assignmentsOOP` comme miroirs exacts pour le moteur, même avec `persist:false`.
  Le glisser-déposer des trois éditeurs échange les joueurs ou aligne un remplaçant.
  Le modal de match verrouille les exclusions via `getUnavailablePlayers`, conserve le
  retour des jaunes et les priorités des formats réduits. Le roster visuel se synchronise
  après la séquence déjà calculée, avant la suivante ; aucune action jouée n'est réécrite.
  `planTacticDrop` valide l'opération avant toute mutation (gardien uniquement au but).
  Souris, appui tactile prolongé et sélection de deux cartes au clavier sont disponibles ;
  Échap ou un dépôt hors poste annule le geste. Les cartes seules capturent le tactile,
  avec défilement au bord ; le terrain défile horizontalement sur mobile. Les portraits
  réutilisent l'identité officielle. Filtres et sélection restent transitoires.
- **5 ligues en arrière-plan** (`STATE.otherLeagues`) : IA vs IA en parallèle de la ligue du
  joueur, `buildOtherLeagues`/`advanceOtherLeagues`/`finalizeOtherLeagues`.
- **Stats saison vs carrière** par joueur (`goals`/`careerGoals`, etc.) — saison remise à
  zéro à `startNewSeason()`, carrière jamais.
- **Tournoi de fin de saison** (`STATE.tournament`, écran `#screen-tournament`) : bracket à
  élimination directe entre le top 2 des 6 ligues ; une prime récompense le parcours.
- **Prime de fin de saison** (`awardSeasonPrizeMoney`) + **objectif de la direction**
  (`STATE.seasonObjective`) qui bonifie/pénalise cette prime selon le rang atteint.
- **Blessures** (`INJURY_SEVERITY_TIERS`, `decayInjuries`) : indisponibilité pour
  l'humain et l'IA, remplacement en match. Les compositions incomplètes utilisent
  des joueurs de champ hors poste avec une pénalité ; un second gardien n'est
  jamais aligné dans le champ. Un gardien de fortune couvre une sortie sans remplaçant.
- **Participation** : `result.participants` et `minutesPlayed` conservent les joueurs
  sortis ; notes, statistiques et progression s'appliquent aux participants réels.
  Le résumé utilise cette liste par camp, et affiche « — » si une ancienne note
  manque, sans bloquer la validation du résultat.
- **Historique des transferts** (`STATE.transferLog`) et **alertes/intérêt sur la liste de
  suivi** (`computeShortlistInterest`, `checkShortlistTransferAlerts`).
- Attention aux sauvegardes anciennes : plusieurs migrations silencieuses vivent dans
  `applySaveData` (dédup joueurs, régénération de ligues manquantes, etc.) — si un nouveau
  champ `STATE` est ajouté, penser à y ajouter la migration correspondante.

## Conventions

- Code et commentaires en français, identifiants en anglais.
- Pas de framework, pas de transpileur : du JS directement exécutable par le navigateur.
- `localStorage` pour les sauvegardes (multi-carrières), export/import en JSON.
- **La page ne défile jamais** (`html, body { overflow: hidden; }`, `#app` fixé à
  `height: 100vh` en `display:flex; flex-direction:column`) : tout le défilement se fait à
  l'intérieur des blocs. `.screen.active`/`.tab.active` sont `flex:1; min-height:0` par
  défaut avec leur propre `overflow-y:auto`. Les écrans/onglets à mise en page plus riche
  désactivent ce défilement de premier niveau et le délèguent à un sous-panneau plus bas
  dans la chaîne flex (`#calendar-list`, `.tactics-bench-list`, `#commentary`,
  `.table-scroll`...). Pour tout nouvel écran/onglet avec mise en page interne : chaîner
  `flex:1` + `min-height:0` jusqu'au conteneur qui doit réellement défiler, puis lui ajouter
  `overflow-y:auto` — jamais laisser le défilement remonter jusqu'à la page. Si un panneau
  ne remplit pas la hauteur disponible, vérifier d'abord une `margin-bottom` héritée de
  `.panel` qui casse la chaîne flex.

## Outils de test disponibles dans cet environnement

- `node` est censé être disponible (pas `python`, `chromium-cli` ni `playwright`), mais
  vérifier d'abord (`where node` / `Get-Command node`) — a déjà manqué au PATH lors d'une
  session malgré cette note ; dans ce cas, relire le code attentivement à la place des tests
  automatisés et le signaler à l'utilisateur plutôt que de bloquer. Si présent : pour un test
  rapide de la logique (sans navigateur), charger `data.js` + `matchengine-actions.js` +
  `engine.js` dans un `vm.runInContext` Node (voir `tests-node.js` pour l'ordre exact). Pour
  servir les fichiers statiques en local, un petit serveur Node fait main (`http.createServer`)
  plutôt que `python -m http.server`.

## Suite de tests (`tests.js`, `tests.html`, `tests-node.js`)

Couvre la couche pure du jeu (`data.js` + `matchengine-actions.js` + `engine.js` +
`matchchoreo.js`, aucun DOM) : intégrité des données, calendrier, classement, moteur de match,
moteur d'actions (structure des beats, continuité du porteur/ballon, passes uniquement vers un
coéquipier actif, interception/tacle = changement de possession, xG borné [0,1], but jamais sans
tir réel, cohérence des stats d'attaque, comportement à effectif réduit), stats saison/carrière,
mercato IA, IA tactique, géométrie de terrain, équilibrage (`runBalanceSimulation` — moyennes de
buts/tirs/xG/passes réussies, avantage du terrain, victoire du favori, influence des tactiques sur
`chooseActionType`, bornes larges mais réelles pour capter une dérive de réglage), chorégraphie du
match humain (tous les types de beats, y compris cross/carry/interception/clear/out/press) et son
interpolation, déplacement collectif des joueurs sans ballon (cible valide et dans le terrain,
plusieurs joueurs bougent à la fois, montée/repli du bloc selon la possession, coulissement latéral
vers le ballon, un seul presseur à la fois, cibles jamais toutes identiques, vitesse maximale
jamais dépassée, transition progressive). Pas de framework
(`test()`/`assert()`/`assertEqual()`/`assertClose()`/`runAllTests()` définis dans `tests.js`).
**`tests.html`** est le point d'entrée à utiliser en priorité (ouverture directe dans un
navigateur, aucune dépendance) vu l'indisponibilité fréquente de `node` ; **`tests-node.js`**
(`node tests-node.js`) fait la même chose via `vm.runInContext` avec un code de sortie non-nul si
un test échoue. Ajouter un test = un nouvel appel à `test("...", () => { ... })` dans `tests.js`,
rien à toucher ailleurs.

Régressions ciblées du réalisme (Node, sans dépendances) :
`node tests-simulation-actions.js`, `node tests-simulation-choreo.js` et
`node tests-simulation-engine.js`. Elles couvrent les duels/interceptions,
les trajectoires distinctes ballon/receveur et la fin immédiate du Matchball.

`npm test` découvre toutes les suites `tests-*.js` (dont continuité et interface).
`npm run test:matrix` contrôle trois graines ; `tests-node.js` isole chaque test
pour qu'un ajout ne décale pas tous les tirages suivants. `npm run test:e2e`
exécute les vrais parcours Kings Manager sur Chromium/Firefox/WebKit. Le workflow
GitHub lance les simulations avant le navigateur et un contrôle quotidien du moteur.
`npm run dev` sert le dépôt sur localhost:4173, `dev:assets` autorise explicitement
le repli vers les images de production pour une copie partielle de développement.

