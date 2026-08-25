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
   (`developPlayer`), et toute l'**IA** (voir section dédiée). Produit aussi, pour le match
   humain, la chorégraphie animée de chaque minute (`simulateMinute(minute,
   {withSequence:true})`) — voir section dédiée.
3. **`matchchoreo.js`** — module d'interpolation pur (pas de DOM) qui anime la chorégraphie
   produite par `engine.js` (positions des joueurs/du ballon frame par frame), façon Football
   Manager Mobile. Voir section dédiée.
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
(`{season, leagueName, rank, totalTeams, tournamentResult, topScorer, topAssister}` — les deux
derniers capturés depuis les stats de SAISON du club juste avant que `startNewSeason()` ne les
remette à zéro ; jamais remis à zéro sauf `startCareer` — contrairement à `lastSeasonPrize` qui ne
garde que la toute dernière saison) : le panneau "Palmarès" en haut de l'onglet Statistiques
(`renderPalmaresPanel`) en tire un résumé de carrière (titres de champion, titres internationaux,
finales perdues), le détail saison par saison (avec le meilleur buteur du club affiché sur chaque
ligne), et les **records de club** (meilleur total de buts/passes décisives en une seule saison,
recalculés à l'affichage en comparant `topScorer`/`topAssister` de toutes les entrées entre elles —
pas besoin de les stocker séparément).

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

## Simulation animée du match humain (`engine.js` + `matchchoreo.js`)

Le match du joueur n'est plus jouable directement (l'ancien plateau physique à tour de rôle,
façon Soccer Stars, a été retiré) : il se déroule **automatiquement**, minute par minute, comme
une simulation Football Manager Mobile — le joueur règle sa tactique avant/pendant le match et
regarde les actions s'enchaîner seules (passes, dribbles, tirs). Les matchs IA vs IA en
arrière-plan (`simulateMatch`/`simulateAIMatch`/`simulateRoundAI`) sont **strictement inchangés**
et continuent de se résoudre instantanément par tirage au sort via `engine.js:simulateMinute`.

- **`engine.js:simulateMinute(minute, { withSequence })`** — même moteur de décision qu'avant
  (force d'équipe, forme, plan tactique, `weightedPick`, `registerGoal`...), enrichi pour
  "raconter" chaque possession plutôt que de juste trancher un résultat. `withSequence` par
  défaut `false` (chemin des matchs IA, **zéro** coût de séquence) ; `true` (match humain) fait
  en plus construire `buildPossessionBeats(...)` — une chaîne de beats par possession : 0-2
  passes de construction (jamais un joueur qui se passe le ballon à lui-même — `buildLength` est
  plafonné au nombre de coéquipiers réellement distincts disponibles), PUIS un porté de balle en
  2-3 touches "slalom" (beats `"dribble"` en zig-zag, TOUJOURS présent, même en 1v1 sans aucune
  passe possible) pendant qu'UN défenseur précis le prend en chasse via `beat.mark` (mouvement
  secondaire du défenseur, indépendant du porteur/ballon — voir `matchchoreo.js`), puis enfin un
  tir dont l'issue reste celle déjà décidée par le tirage au sort, ou un tacle du défenseur qui
  chassait (logiquement le même) si aucune occasion n'a été retenue — remplace le retour
  silencieux d'`attemptAttack`. Un **beat** : `{ type, side, playerId, toPlayerId, gkId, mark,
  from:{x,y}, to:{x,y}, duration, event }` — `from`/`to` = trajectoire du ballon (ou du porteur en
  dribble) pendant ce beat (repère 0-100×0-100 hérité de l'ancien plateau, `y=0` but domicile) ;
  `event` = l'événement de commentaire existant (but/arrêt/tir raté/carton/blessure/annonce de
  phase), porté par le beat qui le "produit" visuellement, `null` pour un beat de pur enchaînement.
  Résultat renvoyé par
  `simulateMinute` : `minuteEvents.sequence = [...]` (même précédent que
  `minuteEvents.possession`, déjà attaché à l'array événements). Les annonces de phase
  (escalier, Ballon Spécial, Dé Géant, Matchball, sub après carton rouge) et les événements
  aléatoires (blessure/carton) deviennent aussi des beats `type:"phase"` portant leur `event`.
  `activateCard`/`triggerPresidentPenalty` (jamais appelées depuis le tirage au sort des matchs
  IA) construisent systématiquement leur propre `evts.sequence`, sans avoir besoin du flag.
  **Jeu continu** : le tirage au sort qui décide si un camp obtient une VRAIE occasion ce tour-ci
  reste inchangé (même probabilité, même effet sur le score/les stats) — mais quand il échoue,
  le camp concerné reçoit quand même une possession "ambiante" (`buildPossessionBeats(...,
  outcome:null)`, purement visuelle, aucun `Math.random()` supplémentaire ne pouvant influer sur
  le score) plutôt que rien du tout. Sans ça, la plupart des minutes (le tirage échoue plus
  souvent qu'il ne réussit) n'affichaient aucune action, donnant l'impression d'un match haché/
  trop rapide plutôt que d'un vrai jeu continu.
- **Positionnement des joueurs** (`computeSideAnchors`, dans `engine.js`) : en formation complète
  (7v7), reprend directement `FORMATION_SLOTS[setup.formation]` (`data.js`) + `setup.assignments`
  — la formation choisie par le joueur/l'IA façonne donc littéralement les positions affichées à
  l'écran. Le camp SANS le ballon (`possessing=false`) utilise `setup.formationOOP`/
  `assignmentsOOP` s'ils ont été personnalisés (onglet Tactique), PUIS applique en plus un repli
  automatique vers sa propre ligne de but (`DEFENSIVE_COMPACTION`, ~40% du trajet restant) —
  nécessaire car l'IA ne personnalise jamais de formation "sans balle" distincte : sans ce repli
  générique, une équipe qui défend resterait visuellement identique à quand elle attaque.
  `lastHomePossession` (mis à jour à chaque minute simulée) détermine quel camp est considéré
  "avec balle" pour tout le reste de LA MÊME minute (granularité volontairement grossière, pas
  béat par beat). En dehors du 7v7 (escalier, Dé Géant, escalier inversé du Matchball), repli sur
  `computeOutfieldAnchors`/`anchorToY`/`gkAnchorY` (helpers génériques migrés depuis l'ancien
  `matchphysics.js`, `engine.js` en a besoin lui-même pour ces phases à effectif variable).
  `engine.js:getFormationAnchors(side, minute)` expose cette carte (GK inclus) à `app.js`.
- **`matchchoreo.js:createChoreographer()`** — module d'interpolation pur (pas de DOM, aucun
  `Math.random()` : une séquence de beats déjà fixée s'anime de façon entièrement déterministe).
  `setAnchors(homeAnchors, awayAnchors)` synchronise le roster affiché (ne téléporte jamais un
  joueur déjà en jeu, ne positionne que les nouveaux entrants — même contrat que l'ancien
  `applySideLineup`). `loadSequence(beats)` charge la chorégraphie de la minute à venir.
  `step(dt)` interpole (lerp + easing, PAS de physique/collision) la position du ballon et des
  joueurs impliqués dans le beat courant ; easing `easeOut` sur un beat `"shot"` (le tireur
  ralentit avant de frapper) et `easeIn` sur le beat d'issue qui suit
  (`"goal"`/`"save"`/`"miss"`/`"owngoal"`, le ballon accélère vers le but). Un beat `"phase"`
  (annonce d'escalier/carton/blessure) ne déplace JAMAIS le ballon (il reste où il était) — ces
  beats portent souvent `from`/`to` égaux à `{50,50}` par convention, et sans cette exception le
  ballon aurait été téléporté au centre à chaque annonce. Les joueurs **non impliqués** dans le
  beat courant sont rappelés en douceur (lissage exponentiel) vers leur ancre de formation
  courante — jamais figés. `consumeFinishedEvents()` renvoie les `event` des beats
  qui viennent de se terminer (pour qu'`app.js` pousse le commentaire/mette à jour le score au
  moment exact où l'action s'affiche, pas tout d'un coup en début de minute).
  `insertNext(newBeats)` intercale des beats juste après celui en cours de lecture (Arme
  Secrète/Penalty du Président activés en cours de match) sans jamais réinitialiser
  `beatIndex`/`beatElapsed` — le beat en cours finit normalement, les nouveaux beats jouent,
  puis la lecture reprend le reste de la séquence déjà chargée.
- **Boucle côté `app.js`** : `runMinute()`/`advanceToMinute(minute)` demandent au moteur la
  minute à venir (après avoir vérifié `maybeAskPhaseLineup` — la composition de l'escalier/Dé
  Géant/Matchball reste demandée AVANT que la phase ne commence, comme avant), évaluent
  `maybeActivateAiCard`/`maybeActivatePresidentPenaltyAi`/`maybeAdjustAiTactics` (leurs éventuels
  beats sont préfixés à la séquence de la minute), puis chargent le tout via `playSequence(beats,
  onDone)`. La boucle continue `pitchFrameLoop` (`requestAnimationFrame`) fait avancer
  `choreo.step(dt * matchState.playbackSpeed)` tant que `!matchState.paused`, redessine le canvas
  `#match-pitch-canvas` (superposé au SVG statique du terrain) à partir de `choreo.getState()`,
  pousse au commentaire les `event` fraîchement terminés, et appelle `onDone` (→ `runMinute()`
  pour la minute suivante) une seule fois `choreo.isSequenceDone()` — plus de notion de "tour" ni
  d'alternance stricte, seule la vitesse de lecture (`btn-match-speed`, x1/x2/x4) affecte le
  rythme. **Pause/reprise** (`togglePauseMatch`, Tactique, Arme Secrète, modal de composition de
  phase) : `matchState.paused=true` gèle simplement la boucle à l'instant courant, sans perdre la
  progression ; `resumeMatchFlow()` relève la pause (sauf pause manuelle de l'utilisateur) puis
  `continueMatchFlow()` ne fait quelque chose que si une minute restait en attente
  (`matchState.pendingMinute`, cas de la composition de phase demandée en pleine pause) — sinon
  la lecture reprend simplement là où elle en était.
- **Arme Secrète / Penalty du Président en cours de match** : ne mettent plus le match "en
  pause de tour" — `executeUserPresidentPenalty`/`confirmSecretCard` appellent
  `choreo.insertNext(...)` pour intercaler l'animation de l'effet dans la séquence déjà en
  lecture (ou déjà chargée si le match était par ailleurs en pause pour le formulaire de la
  carte), sans perturber le `onDone` de la minute en cours.
- **"Avancer rapidement"** (`skipMatch`) — **inchangé dans son principe** : boucle
  `matchEngine.simulateMinute(minute)` **sans** `withSequence` (aussi rapide qu'avant, zéro coût
  de séquence) jusqu'à la fin, puis arrête la boucle d'animation et affiche le résultat final.

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
tactique (`chooseAiFormation`/`chooseAiPlans`), la géométrie de terrain migrée dans `engine.js`
(`clamp`/`computeOutfieldAnchors`/`anchorToY`/`gkAnchorY`), la chorégraphie du match humain
(`simulateMinute(minute, {withSequence:true})` — structure des beats, bornes des positions,
cohérence des ids joueurs) et son interpolation (`matchchoreo.js:createChoreographer` — voir
section dédiée plus haut). `data.js`/`engine.js` utilisent `Math.random()` : leurs tests
vérifient des invariants structurels (conservation, bornes, "jamais de match nul"...) plutôt que
des valeurs exactes, sauf pour les fonctions déterministes (`generateSchedule`,
`computeStandings`, `value()`). `matchchoreo.js` n'utilise AUCUN `Math.random()` (une séquence de
beats déjà fixée s'anime de façon entièrement déterministe) : ses tests comparent donc des
valeurs exactes (`assertClose`, tolérance flottante) plutôt que de se contenter d'invariants.
`tests.js` définit
`test()`/`assert()`/`assertEqual()`/`assertClose()`/`runAllTests()` (pas de framework) ;
**`tests.html`** l'exécute dans un navigateur sans aucune dépendance (ouverture directe du fichier,
comme `index.html`) — c'est le point d'entrée à utiliser en priorité vu l'indisponibilité fréquente
de `node` dans cet environnement ; **`tests-node.js`** (`node tests-node.js`) fait la même chose via
`vm.runInContext` quand `node` est disponible, avec un code de sortie non-nul si un test échoue
(utilisable par un futur hook CI/pre-commit). Ajouter un nouveau test = un nouvel appel à
`test("...", () => { ... })` dans `tests.js`, rien à toucher ailleurs.
