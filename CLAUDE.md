# Kings Manager 7v7

> Ce fichier est lu automatiquement par Claude Code au début de chaque session dans ce
> dossier — pas besoin de le mentionner explicitement. **Tiens-le à jour** : à chaque
> changement structurel notable (nouveau système, refonte d'un écran, changement de
> mécanique de jeu), ajoute/modifie la section concernée avant de terminer la tâche.

## Le projet

Jeu de gestion de football en solo, inspiré du format 7v7 de la **Kings League**. Une
carrière se joue dans **une seule ligue à la fois** (choisie à la création) parmi
**France, Brésil, Espagne, Italie, Allemagne, Mexique** (ce dernier correspond à la vraie
Kings League Mexico — anciennement "Américas" — une ligue multi-nationale hispanophone/
latino-américaine basée au Mexique, pas une ligue 100% mexicaine ; ses équipes viennent de
plusieurs pays, cf. `data.js:MEXICO_TEAMS`). 100% client-side : HTML/CSS/JS vanilla, aucun
build, aucun backend. Lancement : ouvrir `index.html` ou servir le dossier avec un serveur
statique.

## Architecture (chargement dans cet ordre, tout en portée globale — pas de modules)

1. **`data.js`** — données statiques : `LEAGUES` (les 6 ligues ci-dessus, chacune avec ses
   équipes/joueurs, ex. `FRANCE_TEAMS`, `SPAIN_TEAMS`...), `FORMATIONS` / `FORMATION_SLOTS`,
   `ATTACK_PLANS` / `DEFENSE_PLANS`, `SECRET_CARDS`.
2. **`engine.js`** — moteur de simulation pur (pas de DOM) : calendrier
   (`generateSchedule`), simulation minute par minute (`createMatchEngine`,
   `simulateMatch`), classement (`computeStandings`), progression des joueurs
   (`developPlayer`), et toute l'**IA** (voir section dédiée).
3. **`matchphysics.js`** — moteur physique pur (pas de DOM) du plateau persistant sur lequel se
   joue le match humain en direct (`createTurnMatch`), façon Soccer Stars. Voir section dédiée.
4. **`app.js`** — état du jeu (`STATE`), rendu des écrans, gestion des événements DOM,
   sauvegardes (`localStorage` + export/import JSON).
5. **`index.html` / `style.css`** — structure des écrans et mise en forme.

Dossiers `images/players/<dossier-ligue>/<club-slug>/<joueur-slug>.png` (photos, avec
fallback initiales si absentes ; le nom du dossier de ligue peut différer de la clé interne
— voir `app.js:LEAGUE_IMAGE_FOLDER`, ex. clé `brazil` → dossier `bresil`, clé `spain` →
dossier `espagne`) et `joueurs/` (fichiers `.txt` sources utilisés pour construire `data.js`
à la main — pas chargés par le jeu). Équipes/joueurs de France et Brésil : vraies données
saisies à la main par l'utilisateur. Espagne/Italie/Allemagne/Mexique : vraies équipes et
vrais noms de joueurs (recherchés via agents web), mais **âges et attributs (vitesse/
technique/physique/mental) générés proceduralement** — ce ne sont pas des ratings publiés
officiellement (aucune source de ce type n'existe pour la Kings League), à l'image de la
façon dont les attributs France/Brésil ont eux aussi été estimés à la main plutôt que tirés
d'une base officielle. Pas de photos ni blasons fournis pour ces 4 ligues pour l'instant
(fallback initiales/dégradé actif) — fichiers `_images-a-ajouter.txt` /
`_logos-a-ajouter.txt` générés dans chaque dossier pour indiquer les noms de fichiers
exacts attendus si des photos sont ajoutées plus tard.

## Ligues en arrière-plan (`app.js` : `buildOtherLeagues` / `advanceOtherLeagues` / `finalizeOtherLeagues`)

Les 5 ligues que le joueur ne pilote pas (`STATE.otherLeagues`, un tableau `{ key, name,
league: {teams, results}, schedule, currentRound }` par ligue) jouent chacune leur propre
saison IA vs IA en parallèle de celle du joueur, construites par `buildOtherLeagues()` (appelé
à `startCareer()` et à chaque `startNewSeason()`). `advanceOtherLeagues()` les fait avancer
d'un cran à chaque jour qui passe dans `advanceOneDayStep` (même barème `matchDayForRound` que
la ligue du joueur, indépendant du nombre d'équipes — chaque ligue termine donc sa saison à son
propre rythme selon sa taille). `simulateOtherLeagueRound(ol)` déclenche aussi le mercato IA
(`simulateAITransfers(ol.league, null)` — `humanTeamId=null` car aucune équipe de ces ligues
n'appartient au joueur) sur SA propre fenêtre de journées (`isMercatoWindowRound`, factorisée avec
`updateTopbar` mais évaluée indépendamment par ligue puisque chacune a son propre calendrier/nombre
d'équipes). `finalizeOtherLeagues()` (idempotente) termine
instantanément toute ligue pas encore finie dès que la saison du joueur se termine
(`renderCalendarTab`, filet de sécurité aussi dans `startNewSeason`), pour garantir un
classement final partout au même moment — pensé pour le futur tournoi de fin de saison (top 2
de chaque ligue, bracket à élimination directe — voir section suivante). `getOtherLeaguesStandings()`
expose ces classements. Sauvegardé/restauré comme le reste de `STATE` ; les sauvegardes
antérieures à cette fonctionnalité se voient regénérer des ligues fraîches au chargement
(`applySaveData`).

## Stats joueur : saison vs carrière (`data.js:player()`, `engine.js`)

Chaque joueur porte deux jeux de stats en parallèle, mis à jour ensemble à chaque match (user ou
IA) par `engine.js:applyMatchPlayerStats`/`updateFormAfterMatch` : `goals`/`assists`/`matches`/
`ratingSum` (**saison courante**, remis à zéro à chaque `startNewSeason()`, alimentent
`computeTopScorers`/`computeTopAssists`/`computeTopRatings` de l'onglet Statistiques) et
`careerGoals`/`careerAssists`/`careerMatches`/`careerRatingSum` (**cumulés sur toute la carrière**,
jamais remis à zéro sauf `startCareer()`/`buildOtherLeagues()` — une nouvelle carrière ne doit pas
hériter des vraies stats 2025/26 encodées via `withStats()` dans data.js, cf. `backfillSeasonStats`
pour la migration équivalente côté stats de saison). Affichées côte à côte dans la fiche joueur
(`app.js:buildPlayerCardHTML`, section "Carrière" sous les stats de saison).

## Prime de fin de saison (`app.js:awardSeasonPrizeMoney`, `STATE.lastSeasonPrize`)

Versée une seule fois par saison (`STATE.seasonPrizeAwarded`, remis à `false` par `startCareer`/
`startNewSeason`), dès que le championnat ET le tournoi de fin de saison (section suivante) sont
terminés — déclenchée depuis `renderCalendarTab` au moment où le panneau "Saison terminée" affiche
le champion international. Deux composantes qui s'additionnent au budget de l'équipe du joueur :
classement final du championnat (20 000€ à 150 000€ selon le rang) + parcours dans le tournoi (0€
si non qualifié, jusqu'à 150 000€ pour le titre — `getUserTournamentResult()`/
`TOURNAMENT_PRIZE_BY_RESULT`). Pousse aussi une entrée dans `STATE.trophyHistory`
(`{season, leagueName, rank, totalTeams, tournamentResult}`, jamais remis à zéro sauf
`startCareer` — contrairement à `lastSeasonPrize` qui ne garde que la toute dernière saison) :
le panneau "Palmarès" en haut de l'onglet Statistiques (`renderPalmaresPanel`) en tire un résumé de
carrière (titres de champion, titres internationaux, finales perdues) et le détail saison par saison.

## Enjeu de club : objectif de la direction (`STATE.seasonObjective`, `generateSeasonObjective`)

Généré à chaque début de saison (`startCareer`/`startNewSeason`, plus une migration silencieuse
dans `applySaveData` pour les sauvegardes créées avant cette fonctionnalité) et annoncé par une
notification (type `"boardObjective"`). Le palier d'ambition (`SEASON_OBJECTIVE_TIERS`, du titre au
simple maintien) est choisi par percentile de rang : basé sur le classement final de la saison
précédente (`STATE.trophyHistory`) si elle existe, sinon (1ère saison de la carrière) sur la force
moyenne de l'effectif par rapport aux autres clubs de la ligue (`estimateSquadStrength`). Affiché en
continu dans un badge de la topbar (`#topbar-objective`). Ne va JAMAIS jusqu'au licenciement (hors
scope, delibéré) — juste une conséquence financière : `awardSeasonPrizeMoney` compare le rang final
à `targetRank` et applique un bonus (+25%) ou un malus (-15%) sur la prime de fin de saison déjà en
place, puis grave le résultat (`objectiveMet`) dans l'entrée `STATE.trophyHistory` de la saison —
affiché aussi bien dans le panneau "Saison terminée" que dans le palmarès (`renderPalmaresPanel`).

## Blessures (`engine.js:INJURY_SEVERITY_TIERS`, `app.js:decayInjuries`)

L'événement rare "blessure" (0,4% de chance par minute, dans le même bookkeeping de phase partagé
par les matchs IA et le match humain en direct — voir la section sur le plateau physique) tirait
avant juste un flavor de commentaire sans aucun effet ; il pose maintenant réellement
`injuryDaysLeft`/`injurySeverity`/`injured` sur le joueur, avec une gravité tirée au sort
(`INJURY_SEVERITY_TIERS` : légère 1-3j, modérée 4-8j, grave 9-20j — jamais raccourcie si le joueur
était déjà blessé plus longtemps). Décompté d'un jour à chaque jour simulé
(`app.js:decayInjuries`, appelée dans `advanceOneDayStep`, sur toutes les ligues pour rester
cohérent si un joueur blessé change de club). Tout le monde repart apte à `startNewSeason()` (pas
de blessure qui déborderait sur la saison suivante). Un joueur blessé (`p.injured`) reste visible
dans le banc/effectif (badge 🩹 rouge avec le nombre de jours restants) mais ne peut pas être ajouté
à une composition — `renderBench` désactive sa ligne (`.player-row-injured`) tant qu'il n'est pas
déjà titulaire ; s'il l'était déjà (blessé en cours de saison), il reste normalement retirable.
Volontairement scopé au seul effectif du joueur : l'IA (`chooseAiFormation`) n'en tient pas compte
pour ses propres compositions, aucun effet visible pour elle donc pas utile de complexifier.

## Rumeurs de mercato sur la liste de suivi (`app.js:computeShortlistInterest`)

Complète `checkShortlistTransferAlerts` (réactif : prévient APRÈS qu'un joueur suivi a été acheté
par l'IA) avec un signal PROACTIF affiché en continu dans "Ma liste" (badge 👀/🔥/🔥🔥 sur la ligne
compacte et dans la fiche détaillée) : combien de clubs de TA ligue auraient un intérêt réel pour ce
joueur. Reprend EXACTEMENT le critère utilisé par `simulateAITransfers` pour se renforcer (overall
du joueur > meilleur joueur actuel du club à ce poste + 2, et budget suffisant) — ce n'est donc pas
du flavor gratuit : le nombre affiché correspond à de vrais clubs qui l'achèteraient réellement s'ils
en avaient l'occasion au prochain mercato. Scopé à `STATE.league` comme les alertes (les 5 autres
ligues ne comptent pas, un joueur qui y est convoité ne te concerne pas directement).

## Bug corrigé : joueurs dupliqués après un changement de saison (`resetLeagueForNewSeason`, `dedupePlayersById`)

`startNewSeason()` appelait `buildOtherLeagues()` pour les 5 ligues en arrière-plan — cette
fonction est réservée à `startCareer()` (recrée les clubs depuis data.js pour une toute nouvelle
carrière) : appelée aussi à chaque saison, elle effaçait tout transfert déjà survenu dans ces ligues
(y compris tes propres achats), donc un joueur que tu avais acheté réapparaissait dans son club
d'origine — avec le MÊME id (cloné depuis le même objet source), donc rachetable une seconde fois
et créant un vrai doublon avec collision d'id dans ton effectif (bug remonté par l'utilisateur :
"j'ai 2 Kelvin Oliveira"). Remplacé par `resetLeagueForNewSeason(league)`, qui régénère juste
calendrier/résultats et les stats de SAISON des joueurs déjà en place, sans recréer les clubs — donc
transferts et budgets survivent au changement de saison. `dedupePlayersById()` (appelée dans
`applySaveData`, idempotente) nettoie les sauvegardes déjà touchées par le bug : la ligue du joueur
est scannée en premier, donc en cas de collision c'est toujours ta copie qui est conservée.

## Historique des transferts (`STATE.transferLog`, sous-onglet Mercato "Historique")

`engine.js:fillPositionGaps`/`simulateAITransfers` restent des fonctions pures (pas de STATE) : elles
RENVOIENT la liste des transferts qu'elles ont effectués (`{type:"transfer"|"release", playerId,
playerName, pos, fromTeamId, fromTeamName, toTeamId, toTeamName, amount}`) plutôt que de les
journaliser elles-mêmes. `app.js:logTransferEvents(events, fromLeagueKey, toLeagueKey)` les ajoute
à `STATE.transferLog` avec le jour/la saison courante, capé à `TRANSFER_LOG_MAX` (150) entrées les
plus récentes. `fromLeagueKey`/`toLeagueKey` sont distincts (pas un seul `leagueKey` partagé) car un
achat peut traverser deux ligues différentes (recrue d'une autre ligue) ; nécessaire pour résoudre
le bon blason de chaque club à l'affichage via `findLeagueTeam` (`renderTransferHistoryTab` — la
ligne est cliquable pour rouvrir la fiche technique à jour du joueur via `findPlayerAnywhere`, pas
figée au moment du transfert). Seuls sont journalisés : tes propres achats/ventes
(`submitOffer`/`sellPlayer`/`respondToTransferRequest`, n'importe quelle ligue) et les transferts IA
au sein de TA ligue (`simulateRoundAI` — les transferts internes aux 5 autres ligues, en
arrière-plan, ne le sont pas : trop nombreux, peu pertinents). Même mécanisme (`events` renvoyés par
`simulateAITransfers`) alimente `checkShortlistTransferAlerts` : si un joueur de `STATE.shortlist`
(Mercato → Ma liste) est transféré par l'IA vers un autre club de ta ligue, une notification
(`STATE.notifications`, type `"shortlistMoved"`, voir `renderCurrentNotification`) l'annonce plutôt
que de le laisser changer de club silencieusement (la liste de suivi résout toujours le club ACTUEL
du joueur, donc rien ne signalait avant ce changement). `formatGameDate(day, season)` accepte
un paramètre `season` optionnel pour afficher une date figée dans une saison passée plutôt que la
saison courante de `STATE`. Le type `"release"` (joueur vendu par l'IA sans acheteur identifié)
n'arrive plus qu'en filet de sécurité théorique : `simulateAITransfers` cherche maintenant un
`neediestTeamForPosition` avant de libérer un joueur faible, pour qu'il rejoigne toujours un vrai
club plutôt que de disparaître du jeu (sinon `findPlayerAnywhere` échoue et sa ligne d'historique
devient impossible à cliquer pour ouvrir sa fiche technique — bug remonté par l'utilisateur).

## Tournoi de fin de saison (`app.js`, `STATE.tournament`, écran `#screen-tournament`)

Une fois la saison du joueur terminée (`renderCalendarTab`, juste après `finalizeOtherLeagues`),
`buildTournamentBracket()` qualifie le top 2 de chacune des 6 ligues (classement + équipe réelle,
avec un flag `isUser` sur le qualifieur qui est l'équipe du joueur) et construit un bracket à
élimination directe. 12 équipes n'étant pas une puissance de 2 : les seeds 1-4 (les 4 champions de
ligue au plus de points) reçoivent un bye direct en quarts, les seeds 5-12 (le reste, champions
d'abord puis vice-champions, triés par points) se départagent en barrage (5v12, 6v11, 7v10, 8v9).
4 tours : Barrage → Quarts → Demies → Finale.

- `resolveTournamentRoundMatches()` simule automatiquement (`simulateAIMatch`, comme les ligues en
  arrière-plan) tout match du tour courant qui n'implique pas l'équipe du joueur, et fait avancer
  le bracket (`advanceTournamentRound()`) dès que le tour est complet. `processTournamentAutoRounds()`
  enchaîne cette résolution tour après tour jusqu'à tomber sur un match du joueur en attente
  (`findPendingUserTournamentMatch()`) ou jusqu'à la fin du tournoi — donc si le joueur ne s'est pas
  qualifié, tout se résout en une seule fois à l'ouverture de l'écran.
- Si l'équipe du joueur est qualifiée, son match se joue **normalement** (plateau physique
  interactif) : `openTournamentLineupScreen(match)` fait exactement ce que fait `openLineupScreen()`
  pour un match de championnat, mais dérive l'adversaire du match du bracket plutôt que de
  `STATE.schedule` (l'adversaire peut appartenir à n'importe laquelle des 5 autres ligues).
  `STATE.tournamentMatchRef` indique à `startMatch()` (lookup de l'adversaire) et
  `continueAfterMatch()` (branchement : résout le match du bracket et réaffiche l'écran du tournoi,
  au lieu d'enregistrer un résultat de championnat) qu'on est dans ce contexte plutôt que dans un
  match de championnat classique.
- `team.photoLeague` (posé par `buildOtherLeagues`) permet à `playerPhotoUrl`/`teamCrestUrl` de
  résoudre le bon dossier d'images pour une équipe qui n'appartient pas à `STATE.leagueKey` —
  sans ça, toute équipe adverse du tournoi aurait cherché ses photos dans le mauvais dossier de
  ligue.
- Récompense : uniquement honorifique (`STATE.tournament.champion` affiché en fin de bracket et
  dans le panneau "Saison terminée"), aucun effet sur le budget ni les joueurs.
- `relinkTournamentTeamRefs()` (appelée dans `applySaveData`) : les qualifieurs du bracket
  référencent directement les objets équipe réels (pas des copies) pour que les stats se mettent à
  jour sur la vraie équipe pendant le tournoi ; un rechargement de sauvegarde casse ces références
  (JSON les remplace par des copies), d'où ce ré-appariement par id après le chargement des ligues.
- `STATE.tournament = null` à chaque `startNewSeason()` : un nouveau bracket se reconstruit à la
  fin de la saison suivante.

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

- `chooseAiFormation(team)` — teste les 3 formations, retient celle qui maximise la
  force du meilleur onze possible avec l'effectif actuel (pas de formation figée).
- `chooseAiPlans(teamStrength, oppStrength)` — plan offensif/défensif pondéré par le
  rapport de force avec l'adversaire (favori = possession/pressing, outsider =
  direct/transition + bloc bas).
- `simulateAIMatch` (matchs entre IA) et le choix d'adversaire dans `app.js:startMatch`
  utilisent ces deux fonctions.
- `app.js:maybeAdjustAiTactics(minute)` — l'IA réévalue son plan toutes les 5 minutes à
  partir de la 25e (offensive si menée, prudente si elle protège une avance après 30').
- `app.js:maybeActivateAiCard` / `maybeActivatePresidentPenaltyAi` — activation des
  cartes secrètes et du Penalty du Président selon le score (déjà situationnel).
- Mercato IA : `fillPositionGaps` (comble les postes sous le minimum requis) +
  `simulateAITransfers` (vend occasionnellement un joueur faible, et 25% de chance de
  renforcer le poste le plus faible via `weakestPosition` si une nette amélioration est
  abordable chez une autre IA — jamais chez l'équipe humaine).
- `app.js:chooseAiTurn(state, aiSide, aiTeam)` — IA du plateau physique (match humain en tours,
  voir section dédiée) : heuristique tir/passe/dégagement/dribble pilotée par les stats du
  joueur qui exécute, indépendante de l'IA "macro" ci-dessus.

## Match humain en tours sur plateau physique (`matchphysics.js`)

Le match du joueur ne se "simule" plus minute par minute : c'est une seule partie de disques
persistante, du coup d'envoi à la fin, avec **alternance stricte de tours** entre le joueur et
l'IA (chacun flique UN de ses disques à son tour — jamais le ballon directement). Les matchs
IA vs IA en arrière-plan (`simulateMatch`/`simulateAIMatch`/`simulateRoundAI`) sont **inchangés**
et continuent de se résoudre instantanément par tirage au sort via `engine.js:simulateMinute`.

- **`engine.js`** garde la responsabilité de tout le bookkeeping de règles (escalier, Ballon
  Spécial, Dé Géant, Matchball, cartons, blessures, fenêtres Cartes Secrètes/Penalty du
  Président), mais `simulateMinute` est scindée : la partie bookkeeping est extraite dans
  `advancePhaseState(minute)` (sans le tirage au sort des occasions ni le but contre son camp
  aléatoire, remplacés par le plateau physique), exposée pour le match humain via
  `advancePhase(minute)` sur le handle. `simulateMinute` (occasions par dés) reste utilisée
  telle quelle par les matchs IA. `recordGoalFromPlay(side, minute, scorerId, assisterId, gkId)` /
  `recordOwnGoalFromPlay(concedingSide, minute, scorerId)` / `recordSaveFromPlay(side, minute,
  takerId, gkId)` enregistrent un but/csc/arrêt réellement produit par le plateau (mêmes bonus
  Carte But Double/Joueur Étoile/Ballon Spécial via `registerGoal`, même construction
  d'événement via `resolveAttackOutcome` — partagée avec `attemptAttack`).
- **1 round (un tour joueur + un tour IA) = 1 minute** : `app.js` incrémente `matchState.minute`
  une fois les DEUX camps passés dans le round, puis appelle `advancePhase(minute)` — préserve
  exactement les seuils existants (`ESCALIER_END_MINUTE=5`, `DOUBLE_GOAL_START_MINUTE=17`,
  `MATCHBALL_START_MINUTE=36`...) sans recalibrage. Un match régulier tient donc en ~40 rounds
  (80 tirs individuels) avant que le Matchball (round 36+) ne tranche.
- **`matchphysics.js:createTurnMatch()`** — moteur physique pur (pas de DOM), terrain complet
  0–100 × 0–100 (même convention que l'ancien terrain : `y=0` but domicile, `y=100` but
  extérieur), un disque par joueur actif de chaque équipe (`setActiveLineups`, même contrat que
  l'ancien `matchVisualizer.setActiveLineups` — ne téléporte jamais un disque déjà en jeu, ne
  positionne que les nouveaux entrants). `step(dt)` : friction, collisions cercle-cercle
  élastiques (disque-disque et disque-ballon), rebond amorti sur les 4 bords sauf dans l'axe des
  buts (`GOAL_X_MIN`/`GOAL_X_MAX`) où une sortie devient un but. `shoot(discId, vx, vy)` flique
  un disque (le contrôle de qui a le droit de jouer vit côté `app.js`, pas ici).
  `consumeTurnOutcome()` renvoie `null` (tour terminé normalement) / `{type:"goal"|"owngoal",
  scoringSide, concedingSide, scorerId, assisterId}` (remise en jeu automatique) /
  `{type:"save", side, takerId, gkId}` (flavor pur) — scorer/assist dérivés du réel historique de
  touches par côté, y compris les buts contre son camp (dernier disque à toucher le ballon
  appartenant au camp qui encaisse). Contient aussi les petits helpers génériques hérités de
  l'ancien `matchvisual.js` (`computeOutfieldAnchors`, `anchorToY`, `gkAnchorY`, `clamp`),
  toujours utiles pour la formation de coup d'envoi/remise en jeu. **Pas de mécanique de passe** :
  chaque flick, quoi qu'il touche (coéquipier, adversaire, gardien, rien), vaut un tour complet et
  cède la main normalement — un système "la balle s'arrête sur un coéquipier et l'équipe rejoue" a
  été tenté puis abandonné (gels récurrents du plateau, non résolus malgré plusieurs correctifs) ;
  `chooseAiTurn` peut toujours *viser* un coéquipier plus avancé (`AI_PASS_POWER`, dans `app.js`),
  c'est une simple heuristique de visée, ça ne déclenche aucun arrêt/contrôle particulier.
- **Boucle de tours côté `app.js`** : `pitchFrameLoop` (`requestAnimationFrame` continu) fait
  avancer `turnMatch.step(dt)` et redessine le canvas `#match-pitch-canvas` (superposé au SVG
  statique des tracés du terrain) à chaque frame ; dès que le plateau redevient immobile après
  un tir, `handleTurnSettled()` traite l'issue (`matchEngine.recordGoalFromPlay`/
  `recordOwnGoalFromPlay`/`recordSaveFromPlay`), vérifie `isMatchDecided()` (le Matchball peut
  trancher au milieu d'un round). **Un but termine le round IMMÉDIATEMENT** (peu importe si le
  buteur a ouvert ou clos ce round) via `matchState.forcedRoundStartSide` = le camp qui encaisse :
  celui-ci relance systématiquement au round suivant, jamais celui qui vient de marquer — comme
  un vrai coup d'envoi après un but. Sinon (pas de but), alterne `matchState.turnSide` normalement
  (le round se termine quand le camp qui n'a PAS ouvert ce round vient de jouer —
  `matchState.roundStartSide`) ; une fois les deux camps passés (ou immédiatement après un but),
  `finishRoundAdvance(minute)` fait le bookkeeping de round (voir ci-dessus), resynchronise
  `syncTurnMatchLineups`, puis — si `advancePhase` a produit un événement `type:"phase"` en
  dehors de l'escalier de départ et de l'escalier inversé du Matchball (Ballon Spécial, Dé Géant,
  début du Matchball ; ni les événements aléatoires blessure/carton/penalty, ni l'escalier qui
  ajoute/retire un seul joueur par round — un reset systématique y serait trop fréquent) — appelle
  `turnMatch.resetFormation()` pour relancer le plateau en formation de coup d'envoi, comme un
  vrai changement de phase Kings League (même chose à la reprise de la mi-temps via
  `continueAfterHalfTime`). Vérifie ensuite mi-temps/fin de match, puis détermine qui ouvre le
  round suivant : `matchState.forcedRoundStartSide` (le camp qui vient d'encaisser un but) est
  toujours PRIORITAIRE sur l'alternance générique ; à défaut, et **uniquement si le plateau a été
  réellement réinitialisé ce round** (`matchState.resetOccurredThisRound`, changement de phase
  ponctuel), fait alterner `matchState.roundStartSide` (une réinitialisation sur deux démarre côté
  domicile, l'autre côté extérieur), pour que ce ne soit jamais systématiquement le même camp qui
  joue en premier sur une formation fraîchement réinitialisée. Ne s'applique délibérément PAS à
  l'escalier de départ/inversé (`resetFormation()` déjà exclu pour ces phases, voir plus haut) :
  sans cette garde, l'ordre de tir changerait à chaque nouvelle entrée/sortie de joueur alors que
  rien n'a été remis en jeu. `beginTurn()` ne fait rien si c'est le tour du joueur (on attend son
  glisser-relâcher sur ses propres disques, câblé une fois pour toutes par
  `setupMatchPitchPointerEvents()`) ; sinon programme `executeAiTurn()` après un court délai
  (`chooseAiTurn`, heuristique simple pilotée par les stats du joueur qui exécute — vise "à
  travers" le ballon via `aimThroughBall`, jamais un flick direct dessus).
- **Reprise après pause/modal** : `resumeTurnFlow()` est le point de reprise unique (pause,
  mi-temps, tactique, Arme Secrète, modal de composition de phase) — termine d'abord un
  changement de round resté en attente (`matchState.pendingRoundMinute`, cas où la
  demande de composition s'est ouverte pendant une pause utilisateur), sinon relance simplement
  `beginTurn()`.
- **"Avancer rapidement"** (`skipMatch`) abandonne le plateau physique pour le reste du match :
  termine les minutes restantes par tirage au sort via `matchEngine.simulateMinute`, exactement
  comme un match IA vs IA, à partir du score/état déjà à jour de `matchEngine`.
- Cartes Secrètes / Penalty du Président / pénalties restent résolus par dés comme avant (hors
  périmètre du plateau physique) — seul le jeu au pied (dribble/passe/tir) est physique.

## Conventions

- Code et commentaires en français, identifiants en anglais.
- Pas de framework, pas de transpileur : du JS directement exécutable par le navigateur.
- `localStorage` pour les sauvegardes (multi-carrières), export/import en JSON.
- **La page ne défile jamais** (`html, body { overflow: hidden; }`, `#app` fixé à `height: 100vh`
  en `display:flex; flex-direction:column`) : tout le défilement se fait à l'intérieur des blocs.
  `.screen.active` et `.tab.active` sont `flex:1; min-height:0` par défaut avec leur propre
  `overflow-y:auto` (Accueil, Résumé, Classement, Effectif, Mercato défilent donc eux-mêmes tels
  quels). Les écrans/onglets à mise en page plus riche désactivent ce défilement de premier niveau
  (`overflow:hidden` sur `#screen-main.active`, `#screen-lineup.active`, `#screen-match.active`,
  `#tab-calendar.active`, `#tab-tactics.active`) et le délèguent à un sous-panneau borné plus bas
  dans la chaîne flex (`#calendar-list`, `.tactics-bench-list`, `#commentary`, `.table-scroll`...).
  Pour tout nouvel écran/onglet avec une mise en page interne (colonnes, panneaux multiples) :
  chaîner `flex:1` + `min-height:0` jusqu'au conteneur qui doit réellement défiler, puis lui
  ajouter `overflow-y:auto` — jamais laisser le défilement remonter jusqu'à la page. Si un panneau
  ne remplit pas la hauteur disponible, vérifier d'abord une `margin-bottom` héritée de `.panel`
  qui casse la chaîne flex (déjà neutralisée sur `.tactics-pitch-panel` et `.tactics-bench-panel`).

## Outils de test disponibles dans cet environnement

- `node` est censé être disponible (pas `python`, `chromium-cli` ni `playwright`), mais
  vérifier d'abord (`where node` / `Get-Command node`) — absent du PATH lors d'une session
  récente malgré cette note ; dans ce cas, relire le code attentivement à la place des tests
  automatisés et le signaler à l'utilisateur plutôt que de bloquer. Si présent : pour un test
  rapide de la logique (sans navigateur), charger `data.js` + `engine.js` dans un
  `vm.runInContext` Node et appeler les fonctions directement (voir l'historique de
  conversation pour un exemple de smoke test IA). Pour servir les fichiers statiques en
  local, utiliser un petit serveur Node fait main (`http.createServer` + lecture de
  fichiers) plutôt que `python -m http.server`.

## Suite de tests (`tests.js`, `tests.html`, `tests-node.js`)

Couvre la couche pure du jeu (`data.js` + `engine.js` + `matchphysics.js`, aucun DOM) : intégrité
des données (les 6 ligues, effectif minimum par poste, attributs/ids valides), calendrier
(`generateSchedule`), classement (`computeStandings`), moteur de match
(`simulateMatch`/`simulateAIMatch` — pas de match nul, notes attribuées), séparation stats
saison/carrière (`applyMatchPlayerStats`), mercato IA
(`simulateAITransfers`/`neediestTeamForPosition`/`weakestPosition` — conservation du nombre de
joueurs ET de l'argent total de la ligue sur 30 fenêtres enchaînées), classements individuels, IA
tactique (`chooseAiFormation`/`chooseAiPlans`), et le plateau physique du match humain
(`clamp`/`computeOutfieldAnchors`/`anchorToY`/`clampSpeed`/`resolveCollision`/`bounceWalls`/
`createTurnMatch` — voir section dédiée plus haut). `data.js`/`engine.js` utilisent `Math.random()` :
leurs tests vérifient des invariants structurels (conservation, bornes, "jamais de match nul"...)
plutôt que des valeurs exactes, sauf pour les fonctions déterministes (`generateSchedule`,
`computeStandings`, `value()`). `matchphysics.js` n'utilise AUCUN `Math.random()` (trajectoire
entièrement déterministe) : ses tests comparent donc des valeurs exactes (`assertClose`, tolérance
flottante) en reproduisant l'intégration par sous-pas de `step()` plutôt que de se contenter
d'invariants — `getState()` n'exposant pas les vitesses, le plafonnement de `shoot()`/la friction
sont vérifiés indirectement via le déplacement observé après un `step()`. `tests.js` définit
`test()`/`assert()`/`assertEqual()`/`assertClose()`/`runAllTests()` (pas de framework) ;
**`tests.html`** l'exécute dans un navigateur sans aucune dépendance (ouverture directe du fichier,
comme `index.html`) — c'est le point d'entrée à utiliser en priorité vu l'indisponibilité fréquente
de `node` dans cet environnement ; **`tests-node.js`** (`node tests-node.js`) fait la même chose via
`vm.runInContext` quand `node` est disponible, avec un code de sortie non-nul si un test échoue
(utilisable par un futur hook CI/pre-commit). Ajouter un nouveau test = un nouvel appel à
`test("...", () => { ... })` dans `tests.js`, rien à toucher ailleurs.
