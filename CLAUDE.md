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
2. **`engine.js`** — moteur de simulation pur (pas de DOM) : calendrier
   (`generateSchedule`), simulation minute par minute (`createMatchEngine`,
   `simulateMatch`), classement (`computeStandings`), progression des joueurs
   (`developPlayer`), IA (voir plus bas). Pour le match humain, produit aussi une
   chorégraphie animée par minute (`simulateMinute(minute, {withSequence:true})`).
3. **`matchchoreo.js`** — module d'interpolation pur (pas de DOM, aucun `Math.random()`)
   qui anime cette chorégraphie (positions joueurs/ballon frame par frame), façon Football
   Manager Mobile : `createChoreographer()`, `setAnchors`, `loadSequence`, `step(dt)`,
   `insertNext` (pour intercaler Arme Secrète/Penalty en cours de séquence).
4. **`app.js`** — état du jeu (`STATE`), rendu des écrans, gestion des événements DOM,
   sauvegardes (`localStorage` + export/import JSON).
5. **`index.html` / `style.css`** — structure des écrans et mise en forme.

Dossiers `images/players/<dossier-ligue>/<club-slug>/<joueur-slug>.png` (photos, fallback
initiales si absentes ; le nom du dossier de ligue peut différer de la clé interne — voir
`app.js:LEAGUE_IMAGE_FOLDER`, ex. clé `brazil` → dossier `bresil`) et `joueurs/` (fichiers
`.txt` sources pour construire `data.js` à la main — pas chargés par le jeu). France/Brésil :
vraies données saisies à la main. Espagne/Italie/Allemagne/Mexique : vraies équipes/joueurs,
mais âges et attributs générés proceduralement (aucune source officielle de ratings pour la
Kings League) ; pas de photos/blasons pour ces 4 ligues pour l'instant.

## Mécaniques de jeu (règles Kings League encodées dans `engine.js`)

- Match de 40 minutes (2 x 20), pas de match nul (tirs au but si égalité).
- **Escalier de départ** (0'-5') : montée progressive jusqu'au 7v7.
- **Ballon spécial** (17'-20') : tous les buts comptent double.
- **Dé Géant** (21'-23' à la reprise) : format réduit aléatoire (1v1 à 3v3).
- **Matchball** (dès 36') : escalier inversé, la première équipe à atteindre le score
  du leader + 1 but gagne immédiatement.
- **Cartes Secrètes** (une par équipe/match) et **Penalty du Président** (un par
  équipe/match) : fenêtres d'activation 5'-17' et 23'-35/36'.

## IA (dans `engine.js`, utilisée aussi par `app.js`)

- `chooseAiFormation(team)` — teste les 3 formations, retient celle qui maximise la force
  du meilleur onze possible avec l'effectif actuel.
- `chooseAiPlans(teamStrength, oppStrength)` — plan offensif/défensif pondéré par le
  rapport de force (favori = possession/pressing, outsider = direct/bloc bas).
- `app.js:maybeAdjustAiTactics(minute)` — réévaluation du plan toutes les 5 min dès la 25e.
- `app.js:maybeActivateAiCard` / `maybeActivatePresidentPenaltyAi` — activation
  situationnelle selon le score.
- Mercato IA : `fillPositionGaps` (comble les postes sous le minimum) +
  `simulateAITransfers` (vend occasionnellement un joueur faible, renforce parfois le poste
  le plus faible — jamais chez l'équipe humaine).
- `app.js:chooseAiTurn` — IA du plateau physique en match humain, indépendante de l'IA
  "macro" ci-dessus.

## Match humain : simulation animée, pas jouable directement

Le match du joueur se déroule **automatiquement**, minute par minute (tactique réglable
avant/pendant) — l'ancien plateau à tour de rôle façon Soccer Stars a été retiré. Les matchs
IA vs IA restent strictement inchangés (résolution instantanée par tirage au sort). Voir
`engine.js:simulateMinute` (option `withSequence`, construit des "beats" de possession) et
`matchchoreo.js` (interpolation déterministe de ces beats) pour le détail — c'est le système
le plus dense du code, à relire directement plutôt que de dupliquer ici.

## Autres systèmes notables (chercher le nom de fonction dans `app.js`/`engine.js` au besoin)

- **5 ligues en arrière-plan** (`STATE.otherLeagues`) : IA vs IA en parallèle de la ligue du
  joueur, `buildOtherLeagues`/`advanceOtherLeagues`/`finalizeOtherLeagues`.
- **Stats saison vs carrière** par joueur (`goals`/`careerGoals`, etc.) — saison remise à
  zéro à `startNewSeason()`, carrière jamais.
- **Tournoi de fin de saison** (`STATE.tournament`, écran `#screen-tournament`) : bracket à
  élimination directe entre le top 2 des 6 ligues, honorifique (aucun effet budget/joueurs).
- **Prime de fin de saison** (`awardSeasonPrizeMoney`) + **objectif de la direction**
  (`STATE.seasonObjective`) qui bonifie/pénalise cette prime selon le rang atteint.
- **Blessures** (`INJURY_SEVERITY_TIERS`, `decayInjuries`) : rendent un joueur indisponible
  pour la composition pendant N jours, jamais pour l'IA adverse.
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
  rapide de la logique (sans navigateur), charger `data.js` + `engine.js` dans un
  `vm.runInContext` Node. Pour servir les fichiers statiques en local, un petit serveur Node
  fait main (`http.createServer`) plutôt que `python -m http.server`.

## Suite de tests (`tests.js`, `tests.html`, `tests-node.js`)

Couvre la couche pure du jeu (`data.js` + `engine.js` + `matchchoreo.js`, aucun DOM) :
intégrité des données, calendrier, classement, moteur de match, stats saison/carrière,
mercato IA, IA tactique, géométrie de terrain, chorégraphie du match humain et son
interpolation. Pas de framework (`test()`/`assert()`/`assertEqual()`/`assertClose()`/
`runAllTests()` définis dans `tests.js`). **`tests.html`** est le point d'entrée à utiliser
en priorité (ouverture directe dans un navigateur, aucune dépendance) vu l'indisponibilité
fréquente de `node` ; **`tests-node.js`** (`node tests-node.js`) fait la même chose via
`vm.runInContext` avec un code de sortie non-nul si un test échoue. Ajouter un test = un
nouvel appel à `test("...", () => { ... })` dans `tests.js`, rien à toucher ailleurs.
