# Effectifs vérifiés le 26 octobre 2026

Les six fichiers `mercato-*.json` conservent les observations et leurs sources. Ils décrivent une inscription ou une apparition dans une compétition donnée; ils ne prouvent pas nécessairement un contrat permanent. Le fichier `rosters-baseline.json` archive les données du jeu avant cette réconciliation, y compris leurs attributs et âges hérités.

| Ligue | Couverture appliquée |
| --- | --- |
| Brésil | Pages officielles Kings Cup 2026/27, dix équipes. Kelvin Oliveira reste au G3X avec son indisponibilité officielle conservée dans `availability`; les entrées inutilisées mais toujours publiées restent signalées. |
| Italie | Pages officielles Kings Cup 2026/27, douze équipes. Les cinq profils classés wildcards restent présents: cette classification seule ne prouve ni une apparition unique ni une expiration. |
| Mexique | Pages officielles Kings Cup 2026/27, dix équipes actives. Los Aliens et Simios restent dans l'archive, pas dans les nouvelles carrières. Les deux légendes invitées séparées par la recherche ne sont pas ajoutées comme inscriptions permanentes. |
| France | Sept effectifs domestiques complets du Split 2; Karasu reste partiel et conserve sa base avec les corrections corroborées. Les wildcards présents dans les effectifs publiés restent inclus. |
| Espagne | Couverture partielle: le sélecteur domestique vérifié s'arrête à 2025/26. Les onze destinations Italie/Brésil corroborées priment; les autres profils historiques sont conservés et marqués non vérifiés pour octobre. Les effectifs de la World Cup ne deviennent pas des transferts domestiques. |
| Allemagne | Couverture partielle: anciennes pages domestiques et corrections de profils vérifiées. Le mercato de février n'écrase pas un effectif complet plus récent. Les huit affiliations MENA observées restent des observations; elles n'inventent ni départ exclusif ni résiliation. |

## Régénérer et vérifier

```sh
node scripts/sync-rosters.cjs
node scripts/sync-rosters.cjs --check
node tests-rosters.js
npm test
```

Le générateur exige les six dossiers de preuves et n'utilise aucun accès réseau. Il remplace uniquement le bloc balisé des effectifs dans `data.js`; les constantes `LEAGUES`, les tableaux des ligues et la fonction `player()` restent disponibles sans autre script dans le navigateur. Réexécuter le générateur produit les mêmes octets.

Une liste complète remplace l'ancien effectif. Une liste partielle corrige les profils déjà présents sans inventer de nouveaux joueurs non vérifiés. Les noms ont des correspondances explicites; aucune comparaison approximative ne fusionne deux personnes. Les listes officielles complètes récentes priment sur les références historiques d'autres compétitions. Chaque dédoublonnage figure dans `ROSTER_REVISION.identityDecisions`, y compris les doublons historiques dont la situation reste incertaine. Pau Fer de Jijantes et Pau Fernández d'El Barrio restent distincts. Les anciens attributs et valeurs du profil choisi restent identiques, même après un transfert; `baselineOrigin` permet de contrôler ce choix lorsqu'une ancienne base contenait plusieurs références. Une date de naissance officielle valide corrige l'âge au 26 octobre 2026, y compris pour un joueur déjà connu; en son absence, l'âge hérité reste conservé.

Pour un nouveau joueur, les quatre attributs et la valeur sont des estimations de jeu déterministes, jamais des notes officielles. L'âge utilise une date de naissance officielle seulement lorsqu'elle est disponible; sinon il s'agit aussi d'une estimation. `attributesSource`, `ageSource` et `estimatedFields` rendent cette distinction explicite. Les attributs et âges de l'ancienne base portent `legacy-game`; leur conservation ne leur confère aucune exactitude officielle. Les positions proviennent des observations officielles lorsqu'elles sont disponibles.

`LEAGUES[key].rosterRevision` expose la date, la compétition, le statut complet/partiel, les sources, les incertitudes et le nombre de profils historiques conservés. Chaque joueur porte ses identifiants de sources et son statut. `photoClub`, `photoLeague` et `photoName` conservent l'origine du visuel connu malgré un changement de club ou d'alias.

L'indisponibilité officielle de Kelvin Oliveira est une métadonnée descriptive. Le générateur n'invente aucune durée médicale et ne transforme pas cette information en compteur `injuryDaysLeft`; elle ne bloque donc pas, à elle seule, sa sélection dans le moteur du jeu.

Cette mise à jour modifie les données initiales des nouvelles carrières. Elle ne réécrit aucun fichier de sauvegarde exporté et ne remplace pas les effectifs d'une carrière déjà enregistrée. Les anciennes équipes mexicaines restent consultables dans les archives JSON de recherche.
