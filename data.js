// ===================== DONNÉES DU JEU =====================
// Six ligues: compositions vérifiées le 26/10/2026, couverture partielle signalée par ligue.

const POSITIONS = ["GK", "DEF", "MID", "ATT"];

// Bornes utilisées pour convertir un overall en note "étoiles" (mêmes seuils que
// app.js:STAR_RATING_MIN/MAX — dupliqués ici car data.js charge avant app.js, voir CLAUDE.md).
const VALUE_STAR_MIN = 60;
const VALUE_STAR_MAX = 95;

function player(name, pos, spe, tec, phy, men, age) {
  const overall = Math.round((spe + tec + phy + men) / 4);
  // Grille de valeur alignée sur la note en étoiles plutôt que strictement proportionnelle à
  // l'overall : un profil 5 étoiles coûte relativement plus cher, un profil 3 étoiles et moins
  // coûte relativement moins cher (courbe convexe, x^1.8, au lieu d'un simple ×1000 linéaire).
  const stars = Math.max(0, Math.min(5, (overall - VALUE_STAR_MIN) / (VALUE_STAR_MAX - VALUE_STAR_MIN) * 5));
  const valueMultiplier = 0.55 + 0.85 * Math.pow(stars / 5, 1.8);
  return {
    id: Math.random().toString(36).slice(2, 10),
    name, pos,
    speed: spe, technique: tec, physical: phy, mental: men,
    overall, // note du jeu (0-99), aucune note officielle Kings League
    form: 70 + Math.floor(Math.random() * 20), // 70-90 forme initiale
    age,
    value: Math.round(overall * 1000 * valueMultiplier), // valeur en €
    goals: 0, assists: 0, rating: 0, matches: 0,
    // stats "carrière" : cumulées sur toute la durée de la carrière, jamais remises à zéro par
    // startNewSeason (contrairement à goals/assists/matches/rating ci-dessus) — voir engine.js
    // applyMatchPlayerStats/updateFormAfterMatch et app.js buildPlayerCardHTML.
    careerGoals: 0, careerAssists: 0, careerMatches: 0, careerRatingSum: 0,
    // blessure : injuryDaysLeft décompté d'un jour à la fois par app.js:decayInjuries, injured
    // dérivé (injuryDaysLeft > 0) — voir engine.js pour le tirage au sort (INJURY_SEVERITY_TIERS).
    injured: false, injuryDaysLeft: 0, injurySeverity: null, suspended: false
  };
}

// Applique les statistiques héritées et les métadonnées sourcées par-dessus les attributs du jeu.
function withStats(p, stats) {
  return Object.assign(p, stats);
}

// BEGIN GENERATED ROSTERS — scripts/sync-rosters.cjs
// Compositions sourcées; notes et âges hérités/estimés explicitement.
const FRANCE_TEAMS = [
  { ...{"id":"tsn","name":"360 Nation","color":"#c0392b","budget":300000,"coach":"Mohamed Coulibaly","presidents":["Tchouameni","Koundé","Maignan","Kone","Mbeumo"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["france-tsn-squad"],"officialTeamId":176}, players: [
    withStats(player("Charly Dosso", "GK", 62, 69, 81, 84, 27), {"overall":74,"value":52788,"matches":4,"ratingSum":26,"id":"roster_k48erm","rosterIdentity":"charlydosso","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad","france-draft-10"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Charly Dosso","baselineOrigin":{"league":"france","teamId":"tsn","name":"Charly Dosso"},"registrationType":"registered"}),
    withStats(player("JMK", "GK", 70, 79, 90, 93, 25), {"overall":83,"value":78785,"matches":9,"ratingSum":76,"id":"roster_1ptlm4h","rosterIdentity":"jmk","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad","france-draft-5"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"JMK","baselineOrigin":{"league":"france","teamId":"tsn","name":"JMK"},"registrationType":"registered"}),
    withStats(player("Mamadou Kamissoko", "GK", 60, 65, 76, 75, 24), {"overall":69,"value":43038,"matches":3,"ratingSum":19.5,"id":"roster_14ol766","rosterIdentity":"mamadoukamissoko","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad","france-draft-6"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Mamadou Kamissoko","baselineOrigin":{"league":"france","teamId":"tsn","name":"Mamadou Kamissoko"},"registrationType":"registered"}),
    withStats(player("Chaïb Lahmer", "DEF", 74, 70, 80, 75, 25), {"overall":75,"value":55121,"goals":2,"assists":2,"matches":9,"ratingSum":58.5,"id":"roster_pjuvel","rosterIdentity":"chaiblahmer","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad","france-draft-6"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Chaïb Lahmer","baselineOrigin":{"league":"france","teamId":"tsn","name":"Chaïb Lahmer"},"registrationType":"registered"}),
    withStats(player("Jordy Kalou", "DEF", 76, 71, 82, 76, 26), {"overall":76,"value":57588,"matches":10,"ratingSum":65,"id":"roster_1myq829","rosterIdentity":"jordykalou","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad","france-draft-6"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Jordy Kalou","baselineOrigin":{"league":"france","teamId":"tsn","name":"Jordy Kalou"},"registrationType":"registered"}),
    withStats(player("Mohamed Sangare", "DEF", 71, 67, 78, 72, 23), {"overall":72,"value":48512,"matches":2,"ratingSum":13,"id":"roster_1t4gusr","rosterIdentity":"mohamedsangare","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Mohamed Sangare","baselineOrigin":{"league":"france","teamId":"tsn","name":"Mohamed Sangare"}}),
    withStats(player("Abdallah Yaisien", "MID", 79, 78, 73, 76, 23), {"overall":77,"value":60190,"matches":9,"ratingSum":58.5,"id":"roster_otxtce","rosterIdentity":"abdallahyaisien","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Abdallah Yaisien","baselineOrigin":{"league":"france","teamId":"tsn","name":"Abdallah Yaisien"}}),
    withStats(player("Bilal Marhdaoui", "MID", 88, 90, 83, 87, 24), {"overall":87,"value":94202,"goals":9,"assists":4,"matches":10,"ratingSum":72,"id":"roster_1vqlgf1","rosterIdentity":"bilalmarhdaoui","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad","france-draft-6"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Bilal Marhdaoui","baselineOrigin":{"league":"france","teamId":"tsn","name":"Bilal Marhdaoui"},"registrationType":"registered"}),
    withStats(player("Mahamadou Traore", "MID", 78, 79, 76, 76, 25), {"overall":77,"value":60190,"goals":3,"matches":10,"ratingSum":65,"id":"roster_1qbkq1l","rosterIdentity":"mahamadoutraore","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad","france-draft-6"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Mahamadou Traore","baselineOrigin":{"league":"france","teamId":"tsn","name":"Mahamadou Traore"},"registrationType":"registered"}),
    withStats(player("Marwan Chatar", "MID", 77, 76, 72, 75, 22), {"overall":75,"value":55121,"matches":5,"ratingSum":32.5,"id":"roster_2454gy","rosterIdentity":"marwanchatar","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad","france-draft-6"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Marwan Chatar","baselineOrigin":{"league":"france","teamId":"tsn","name":"Marwan Chatar"},"registrationType":"registered"}),
    withStats(player("Mohamadou Diarra", "MID", 73, 69, 79, 74, 24), {"overall":74,"value":52788,"matches":3,"ratingSum":19.5,"id":"roster_1rv7f85","rosterIdentity":"mohamadoudiarra","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad","france-draft-6"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Mohamadou Diarra","baselineOrigin":{"league":"france","teamId":"tsn","name":"Mohamadou Diarra"},"registrationType":"registered"}),
    withStats(player("Hamed Karamoko", "MID", 80, 81, 75, 77, 24), {"overall":78,"value":62930,"assists":1,"matches":5,"ratingSum":40.5,"id":"roster_7pc797","rosterIdentity":"hamedkaramoko","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad","france-wildcard-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Hamed Karamoko","baselineOrigin":{"league":"france","teamId":"tsn","name":"Hamed Karamoko"},"registrationType":"wildcard"}),
    withStats(player("James Lea Siliki", "MID", 75, 81, 79, 80, 30), {"overall":79,"value":65810,"goals":3,"assists":2,"matches":5,"ratingSum":35,"id":"roster_nu23gc","rosterIdentity":"jamesleasiliki","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"James Lea Siliki","baselineOrigin":{"league":"france","teamId":"tsn","name":"James Lea Siliki"}}),
    withStats(player("Daudet Ndongala", "ATT", 91, 87, 84, 83, 26), {"overall":86,"value":90110,"goals":3,"matches":7,"ratingSum":45.5,"id":"roster_zvl7sm","rosterIdentity":"daudetndongala","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad","france-draft-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Daudet Ndongala","baselineOrigin":{"league":"france","teamId":"tsn","name":"Daudet Ndongala"},"registrationType":"registered"}),
    withStats(player("Patrick Koffi", "ATT", 85, 79, 81, 76, 25), {"overall":80,"value":68834,"matches":3,"ratingSum":19.5,"id":"roster_1koccm","rosterIdentity":"patrickkoffi","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Patrick Koffi","baselineOrigin":{"league":"france","teamId":"tsn","name":"Patrick Koffi"}}),
    withStats(player("Ayoub Sefraoui", "ATT", 87, 78, 77, 75, 23), {"overall":79,"value":65810,"goals":1,"assists":2,"matches":7,"ratingSum":45.5,"id":"roster_ud8jyd","rosterIdentity":"ayoubsefraoui","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Ayoub Sefraoui","baselineOrigin":{"league":"france","teamId":"tsn","name":"Ayoub Sefraoui"}}),
    withStats(player("Bilel Boucheker", "ATT", 84, 80, 76, 75, 24), {"overall":79,"value":65810,"goals":2,"assists":1,"matches":3,"ratingSum":23.1,"id":"roster_1ofo2qh","rosterIdentity":"bilelboucheker","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad","france-wildcard-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Bilel Boucheker","baselineOrigin":{"league":"france","teamId":"tsn","name":"Bilel Boucheker"},"registrationType":"wildcard"}),
    withStats(player("Gregory Ayem", "ATT", 86, 80, 77, 75, 23), {"overall":80,"value":68834,"goals":3,"matches":3,"ratingSum":21.9,"id":"roster_1d6mbx0","rosterIdentity":"gregoryayem","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Gregory Ayem","baselineOrigin":{"league":"france","teamId":"tsn","name":"Gregory Ayem"}}),
    withStats(player("Mustapha Rabou", "ATT", 79, 74, 73, 71, 22), {"overall":74,"value":52788,"matches":1,"ratingSum":6.5,"id":"roster_341yvr","rosterIdentity":"mustapharabou","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad","france-wildcard-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Mustapha Rabou","baselineOrigin":{"league":"france","teamId":"tsn","name":"Mustapha Rabou"},"registrationType":"wildcard"}),
    withStats(player("Yacine Boucharoud", "ATT", 88, 85, 79, 80, 24), {"overall":83,"value":78785,"goals":6,"assists":5,"matches":10,"ratingSum":74,"id":"roster_ohvdpc","rosterIdentity":"yacineboucharoud","rosterStatus":"verified","rosterSourceIds":["france-tsn-squad","france-wildcard-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"360 Nation","photoLeague":"france","photoName":"Yacine Boucharoud","baselineOrigin":{"league":"france","teamId":"tsn","name":"Yacine Boucharoud"},"registrationType":"wildcard"}),
  ] },
  { ...{"id":"adb","name":"Athletic Dragon Blanc","color":"#c4c4c4","budget":300000,"coach":"Habib Boumezoued","presidents":["SDM","Guy2Bezbar"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["france-adb-squad"],"officialTeamId":232}, players: [
    withStats(player("Ismaël Benallal", "GK", 69, 73, 87, 87, 26), {"overall":79,"value":65810,"matches":8,"ratingSum":52,"id":"roster_hvo157","rosterIdentity":"ismaelbenallal","rosterStatus":"verified","rosterSourceIds":["france-adb-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Ismaël Benallal","baselineOrigin":{"league":"france","teamId":"adb","name":"Ismaël Benallal"}}),
    withStats(player("Parfait Mandanda", "GK", 55, 70, 75, 88, 41), {"overall":72,"value":48512,"matches":7,"ratingSum":45.5,"id":"roster_1tmapl0","rosterIdentity":"parfaitmandanda","rosterStatus":"verified","rosterSourceIds":["france-adb-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Parfait Mandanda","baselineOrigin":{"league":"france","teamId":"adb","name":"Parfait Mandanda"}}),
    withStats(player("Karl Masua", "DEF", 75, 71, 82, 76, 26), {"overall":76,"value":57588,"matches":8,"ratingSum":52,"id":"roster_tjv3j0","rosterIdentity":"karlmasua","rosterStatus":"verified","rosterSourceIds":["france-adb-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Karl Masua","baselineOrigin":{"league":"france","teamId":"adb","name":"Karl Masua"}}),
    withStats(player("Sega Keita", "DEF", 74, 70, 81, 75, 24), {"overall":75,"value":55121,"goals":3,"matches":8,"ratingSum":52,"id":"roster_pwn5uj","rosterIdentity":"segakeita","rosterStatus":"verified","rosterSourceIds":["france-adb-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Sega Keita","baselineOrigin":{"league":"france","teamId":"adb","name":"Sega Keita"}}),
    withStats(player("Adama Doucouré", "DEF", 72, 68, 76, 73, 23), {"overall":72,"value":48512,"matches":1,"ratingSum":6.5,"id":"roster_tx3cl1","rosterIdentity":"adamadoucoure","rosterStatus":"verified","rosterSourceIds":["france-adb-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Adama Doucouré","baselineOrigin":{"league":"france","teamId":"adb","name":"Adama Doucouré"}}),
    withStats(player("Alex Monde", "MID", 79, 80, 75, 77, 25), {"overall":78,"value":62930,"goals":1,"matches":7,"ratingSum":45.5,"id":"roster_46ibe6","rosterIdentity":"alexmonde","rosterStatus":"verified","rosterSourceIds":["france-adb-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Alex Monde","baselineOrigin":{"league":"france","teamId":"adb","name":"Alex Monde"}}),
    withStats(player("Brad Onema", "MID", 81, 79, 74, 76, 24), {"overall":78,"value":62930,"goals":1,"matches":8,"ratingSum":52,"id":"roster_3x2srq","rosterIdentity":"bradonema","rosterStatus":"verified","rosterSourceIds":["france-adb-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Brad Onema","baselineOrigin":{"league":"france","teamId":"adb","name":"Brad Onema"}}),
    withStats(player("Johan Dorilas", "MID", 80, 80, 75, 78, 23), {"overall":78,"value":62930,"goals":6,"assists":3,"matches":8,"ratingSum":56,"id":"roster_1362vjv","rosterIdentity":"johandorilas","rosterStatus":"verified","rosterSourceIds":["france-adb-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Johan Dorilas","baselineOrigin":{"league":"france","teamId":"adb","name":"Johan Dorilas"}}),
    withStats(player("Melvin Sitti", "MID", 77, 77, 72, 74, 22), {"overall":75,"value":55121,"goals":4,"matches":7,"ratingSum":49,"id":"roster_1un1s7d","rosterIdentity":"melvinsitti","rosterStatus":"verified","rosterSourceIds":["france-adb-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Melvin Sitti","baselineOrigin":{"league":"france","teamId":"adb","name":"Melvin Sitti"}}),
    withStats(player("Redha Ghaoui", "MID", 73, 69, 79, 74, 23), {"overall":74,"value":52788,"matches":8,"ratingSum":52,"id":"roster_19ws5d2","rosterIdentity":"redhaghaoui","rosterStatus":"verified","rosterSourceIds":["france-adb-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Redha Ghaoui","baselineOrigin":{"league":"france","teamId":"adb","name":"Redha Ghaoui"}}),
    withStats(player("Rayan Belkacem", "MID", 76, 75, 73, 73, 23), {"overall":74,"value":52788,"matches":6,"ratingSum":39,"id":"roster_130ktry","rosterIdentity":"rayanbelkacem","rosterStatus":"verified","rosterSourceIds":["france-adb-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Rayan Belkacem","baselineOrigin":{"league":"france","teamId":"adb","name":"Rayan Belkacem"}}),
    withStats(player("Anthony Adel", "MID", 70, 68, 70, 70, 21), {"overall":70,"value":44740,"id":"roster_1fr26du","rosterIdentity":"anthonyadel","rosterStatus":"verified","rosterSourceIds":["france-adb-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Anthony Adel","baselineOrigin":{"league":"france","teamId":"adb","name":"Anthony Adel"}}),
    withStats(player("Tarek Baïch", "MID", 74, 73, 72, 72, 24), {"overall":73,"value":50586,"matches":2,"ratingSum":13,"id":"roster_1lj3u4n","rosterIdentity":"tarekbaich","rosterStatus":"verified","rosterSourceIds":["france-adb-squad","france-wildcard-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Tarek Baïch","baselineOrigin":{"league":"france","teamId":"adb","name":"Tarek Baïch"},"registrationType":"wildcard"}),
    withStats(player("Sandy Mbala", "MID", 71, 70, 71, 70, 22), {"overall":71,"value":46564,"matches":1,"ratingSum":6.5,"id":"roster_kolg7z","rosterIdentity":"sandymbala","rosterStatus":"verified","rosterSourceIds":["france-adb-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Sandy Mbala","baselineOrigin":{"league":"france","teamId":"adb","name":"Sandy Mbala"}}),
    withStats(player("Alex Séné", "ATT", 85, 80, 80, 76, 24), {"overall":80,"value":68834,"matches":2,"ratingSum":13,"id":"roster_skdti4","rosterIdentity":"alexsene","rosterStatus":"verified","rosterSourceIds":["france-adb-squad","france-wildcard-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Alex Séné","baselineOrigin":{"league":"france","teamId":"adb","name":"Alex Séné"},"registrationType":"wildcard"}),
    withStats(player("Inza Koné", "ATT", 91, 90, 83, 88, 25), {"overall":88,"value":98457,"goals":11,"assists":10,"matches":8,"ratingSum":64,"id":"roster_vtefjc","rosterIdentity":"inzakone","rosterStatus":"verified","rosterSourceIds":["france-adb-squad","france-wildcard-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Inza Koné","baselineOrigin":{"league":"france","teamId":"adb","name":"Inza Koné"},"registrationType":"wildcard"}),
    withStats(player("Aimen Belaid", "ATT", 86, 78, 77, 75, 22), {"overall":79,"value":65810,"goals":1,"matches":2,"ratingSum":13,"id":"roster_tqdt6a","rosterIdentity":"aimenbelaid","rosterStatus":"verified","rosterSourceIds":["france-adb-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Athletic Dragon Blanc","photoLeague":"france","photoName":"Aimen Belaid","baselineOrigin":{"league":"france","teamId":"adb","name":"Aimen Belaid"}}),
  ] },
  { ...{"id":"fcs","name":"FC Silmi","color":"#b8973e","budget":300000,"coach":"Sabry Bezahaf","presidents":["Domingo"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["france-fcs-squad"],"officialTeamId":172}, players: [
    withStats(player("Ali Ahamada", "GK", 62, 75, 88, 93, 35), {"overall":80,"value":68834,"matches":8,"ratingSum":52,"id":"roster_9ysm5k","rosterIdentity":"aliahamada","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Ali Ahamada","baselineOrigin":{"league":"france","teamId":"fcs","name":"Ali Ahamada"}}),
    withStats(player("Damien Mesplé", "GK", 63, 67, 78, 77, 27), {"overall":71,"value":46564,"matches":2,"ratingSum":13,"id":"roster_kx149t","rosterIdentity":"damienmesple","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad","france-wildcard-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Damien Mesplé","baselineOrigin":{"league":"france","teamId":"fcs","name":"Damien Mesplé"},"registrationType":"wildcard"}),
    withStats(player("Florian Forestier", "GK", 64, 73, 85, 86, 26), {"overall":77,"value":60190,"matches":5,"ratingSum":41.5,"id":"roster_ktq00d","rosterIdentity":"florianforestier","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad","france-wildcard-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Florian Forestier","baselineOrigin":{"league":"france","teamId":"fcs","name":"Florian Forestier"},"registrationType":"wildcard"}),
    withStats(player("Axel Bamba", "DEF", 75, 71, 81, 76, 25), {"overall":76,"value":57588,"matches":1,"ratingSum":6.5,"id":"roster_1q35bp2","rosterIdentity":"axelbamba","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Axel Bamba","baselineOrigin":{"league":"france","teamId":"fcs","name":"Axel Bamba"}}),
    withStats(player("Hakim Bacar", "DEF", 73, 69, 80, 74, 24), {"overall":74,"value":52788,"matches":8,"ratingSum":52,"id":"roster_1vyndpy","rosterIdentity":"hakimbacar","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Hakim Bacar","baselineOrigin":{"league":"france","teamId":"fcs","name":"Hakim Bacar"}}),
    withStats(player("Mohammed-Karim Berrabah", "DEF", 74, 70, 82, 76, 26), {"overall":76,"value":57588,"goals":1,"assists":1,"matches":5,"ratingSum":42,"id":"roster_vi428s","rosterIdentity":"mohammedkarimberrabah","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad","france-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Mohammed-Karim Berrabah","baselineOrigin":{"league":"france","teamId":"fcs","name":"Mohammed-Karim Berrabah"},"registrationType":"registered"}),
    withStats(player("Aboubakar Toure", "MID", 78, 79, 74, 76, 24), {"overall":77,"value":60190,"assists":1,"matches":6,"ratingSum":39,"id":"roster_zko1wo","rosterIdentity":"aboubakartoure","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Aboubakar Toure","baselineOrigin":{"league":"france","teamId":"fcs","name":"Aboubakar Toure"}}),
    withStats(player("Adel Berkane", "MID", 84, 86, 80, 84, 23), {"overall":84,"value":82404,"goals":7,"assists":1,"matches":7,"ratingSum":52.5,"id":"roster_1nhwzdb","rosterIdentity":"adelberkane","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Adel Berkane","baselineOrigin":{"league":"france","teamId":"fcs","name":"Adel Berkane"}}),
    withStats(player("Chain Ghrissi", "MID", 77, 78, 74, 75, 24), {"overall":76,"value":57588,"goals":1,"assists":1,"matches":8,"ratingSum":52,"id":"roster_1dquz9","rosterIdentity":"chainghrissi","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Chain Ghrissi","baselineOrigin":{"league":"france","teamId":"fcs","name":"Chain Ghrissi"}}),
    withStats(player("Guilherme Carvalho", "MID", 84, 86, 80, 82, 25), {"overall":83,"value":78785,"goals":6,"assists":2,"matches":5,"ratingSum":36.5,"id":"roster_eq3y9p","rosterIdentity":"guilhermecarvalho","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad","france-draft-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Guilherme Carvalho","baselineOrigin":{"league":"france","teamId":"fcs","name":"Guilherme Carvalho"},"registrationType":"registered"}),
    withStats(player("Kevin Bru", "MID", 76, 80, 72, 78, 28), {"overall":77,"value":60190,"goals":1,"matches":3,"ratingSum":24.9,"id":"roster_2ixd55","rosterIdentity":"kevinbru","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Kevin Bru","baselineOrigin":{"league":"france","teamId":"fcs","name":"Kevin Bru"}}),
    withStats(player("Mehdi Marin", "MID", 76, 77, 73, 74, 23), {"overall":75,"value":55121,"goals":1,"assists":1,"matches":8,"ratingSum":52,"id":"roster_1p2srmh","rosterIdentity":"mehdimarin","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad","france-draft-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Mehdi Marin","baselineOrigin":{"league":"france","teamId":"fcs","name":"Mehdi Marin"},"registrationType":"registered"}),
    withStats(player("Youcef Kara", "MID", 75, 76, 73, 73, 22), {"overall":74,"value":52788,"matches":8,"ratingSum":52,"id":"roster_15a0t5z","rosterIdentity":"youcefkara","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Youcef Kara","baselineOrigin":{"league":"france","teamId":"fcs","name":"Youcef Kara"}}),
    withStats(player("Mohamed Sanou", "ATT", 86, 81, 78, 77, 25), {"overall":81,"value":72002,"matches":2,"ratingSum":13,"id":"roster_6x3v16","rosterIdentity":"mohamedsanou","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad","france-draft-10"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Mohamed Sanou","baselineOrigin":{"league":"france","teamId":"fcs","name":"Mohamed Sanou"},"registrationType":"registered"}),
    withStats(player("Bakary Sako", "ATT", 86, 91, 84, 87, 37), {"overall":87,"value":94202,"goals":16,"assists":2,"matches":8,"ratingSum":64,"id":"roster_1j4p86f","rosterIdentity":"bakarysako","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad","france-wildcard-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Bakary Sako","baselineOrigin":{"league":"france","teamId":"fcs","name":"Bakary Sako"},"registrationType":"wildcard"}),
    withStats(player("Jimmy Briand", "ATT", 65, 80, 70, 85, 40), {"overall":75,"value":55121,"matches":2,"ratingSum":13,"id":"roster_1iuhh9l","rosterIdentity":"jimmybriand","rosterStatus":"verified","rosterSourceIds":["france-fcs-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"FC Silmi","photoLeague":"france","photoName":"Jimmy Briand","baselineOrigin":{"league":"france","teamId":"fcs","name":"Jimmy Briand"}}),
  ] },
  { ...{"id":"gs7","name":"Generation Seven","color":"#4a8c2a","budget":300000,"coach":"Jefferson Roch","presidents":["Michou","Camavinga"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["france-gs7-squad"],"officialTeamId":173}, players: [
    withStats(player("Christian Nsapu", "GK", 63, 67, 82, 82, 26), {"overall":74,"value":52788,"matches":7,"ratingSum":45.5,"id":"roster_1dzn111","rosterIdentity":"christiannsapu","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad","france-draft-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Christian Nsapu","baselineOrigin":{"league":"france","teamId":"gs7","name":"Christian Nsapu"},"registrationType":"registered"}),
    withStats(player("Ilhan Benbraham", "GK", 61, 64, 77, 76, 23), {"overall":70,"value":44740,"matches":1,"ratingSum":7.6,"id":"roster_1gsyn0r","rosterIdentity":"ilhanbenbraham","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Ilhan Benbraham","baselineOrigin":{"league":"france","teamId":"gs7","name":"Ilhan Benbraham"}}),
    withStats(player("Yonni Bouguerra", "GK", 67, 75, 88, 89, 25), {"overall":80,"value":68834,"matches":6,"ratingSum":48,"id":"roster_18o63ug","rosterIdentity":"yonnibouguerra","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Yonni Bouguerra","baselineOrigin":{"league":"france","teamId":"gs7","name":"Yonni Bouguerra"}}),
    withStats(player("Bilal Hadraoui", "DEF", 74, 70, 81, 75, 25), {"overall":75,"value":55121,"assists":1,"matches":4,"ratingSum":28.4,"id":"roster_dkxu9q","rosterIdentity":"bilalhadraoui","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Bilal Hadraoui","baselineOrigin":{"league":"france","teamId":"gs7","name":"Bilal Hadraoui"}}),
    withStats(player("Mehdi Tenniche", "DEF", 73, 69, 80, 74, 24), {"overall":74,"value":52788,"matches":6,"ratingSum":43.8,"id":"roster_593dhm","rosterIdentity":"mehditenniche","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad","france-draft-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Mehdi Tenniche","baselineOrigin":{"league":"france","teamId":"gs7","name":"Mehdi Tenniche"},"registrationType":"registered"}),
    withStats(player("Carl Medjani", "DEF", 58, 74, 82, 86, 41), {"overall":75,"value":55121,"matches":4,"ratingSum":26,"id":"roster_175p48f","rosterIdentity":"carlmedjani","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad","france-wildcard-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Carl Medjani","baselineOrigin":{"league":"france","teamId":"gs7","name":"Carl Medjani"},"registrationType":"wildcard"}),
    withStats(player("Walid Soudi", "DEF", 78, 74, 81, 80, 24), {"overall":78,"value":62930,"goals":3,"assists":2,"matches":7,"ratingSum":51.1,"id":"roster_19o1qe0","rosterIdentity":"walidsoudi","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad","france-draft-5"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Walid Soudi","baselineOrigin":{"league":"france","teamId":"gs7","name":"Walid Soudi"},"registrationType":"registered"}),
    withStats(player("Clément Goguey", "MID", 83, 84, 79, 81, 24), {"overall":82,"value":75318,"goals":4,"matches":7,"ratingSum":57.4,"id":"roster_gw92ld","rosterIdentity":"clementgoguey","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad","france-draft-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Clément Goguey","baselineOrigin":{"league":"france","teamId":"gs7","name":"Clément Goguey"},"registrationType":"registered"}),
    withStats(player("Enzo Dron", "MID", 80, 78, 73, 75, 23), {"overall":77,"value":60190,"goals":1,"matches":6,"ratingSum":49.2,"id":"roster_1pd8sae","rosterIdentity":"enzodron","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad","france-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Enzo Dron","baselineOrigin":{"league":"france","teamId":"gs7","name":"Enzo Dron"},"registrationType":"registered"}),
    withStats(player("Ismaïl Haddou", "MID", 79, 80, 75, 77, 25), {"overall":78,"value":62930,"goals":2,"matches":2,"ratingSum":13,"id":"roster_9abh6d","rosterIdentity":"ismailhaddou","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad","france-draft-5"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Ismaïl Haddou","baselineOrigin":{"league":"france","teamId":"gs7","name":"Ismaïl Haddou"},"registrationType":"registered"}),
    withStats(player("Nyls Gomez", "MID", 77, 77, 72, 74, 22), {"overall":75,"value":55121,"matches":4,"ratingSum":28.4,"id":"roster_4nkanp","rosterIdentity":"nylsgomez","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad","france-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Nyls Gomez","baselineOrigin":{"league":"france","teamId":"gs7","name":"Nyls Gomez"},"registrationType":"registered"}),
    withStats(player("Boucif El Afghani", "MID", 77, 76, 73, 74, 22), {"overall":75,"value":55121,"goals":1,"assists":1,"matches":1,"ratingSum":6.8,"id":"roster_k7xvoq","rosterIdentity":"boucifelafghani","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Boucif El Afghani","baselineOrigin":{"league":"france","teamId":"gs7","name":"Boucif El Afghani"}}),
    withStats(player("Dalvin Fellice", "MID", 74, 73, 71, 71, 21), {"overall":72,"value":48512,"matches":2,"ratingSum":13,"id":"roster_cbbveh","rosterIdentity":"dalvinfellice","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad","france-wildcard-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Dalvin Fellice","baselineOrigin":{"league":"france","teamId":"gs7","name":"Dalvin Fellice"},"registrationType":"wildcard"}),
    withStats(player("Youba Soumaré", "MID", 76, 77, 73, 74, 23), {"overall":75,"value":55121,"goals":1,"assists":1,"matches":7,"ratingSum":45.5,"id":"roster_y07pm5","rosterIdentity":"youbasoumare","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad","france-wildcard-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Youba Soumaré","baselineOrigin":{"league":"france","teamId":"gs7","name":"Youba Soumaré"},"registrationType":"wildcard"}),
    withStats(player("Haris El Mouttaqi", "ATT", 91, 87, 83, 83, 25), {"overall":86,"value":90110,"goals":4,"matches":1,"ratingSum":8.1,"id":"roster_ovd2mx","rosterIdentity":"hariselmouttaqi","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad","france-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Haris El Mouttaqi","baselineOrigin":{"league":"france","teamId":"gs7","name":"Haris El Mouttaqi"},"registrationType":"registered"}),
    withStats(player("Oscar Le Guillou", "ATT", 85, 79, 80, 76, 24), {"overall":80,"value":68834,"goals":1,"matches":4,"ratingSum":30,"id":"roster_pes7p3","rosterIdentity":"oscarleguillou","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad","france-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Oscar Le Guillou","baselineOrigin":{"league":"france","teamId":"gs7","name":"Oscar Le Guillou"},"registrationType":"registered"}),
    withStats(player("Boutaleb Mohamed", "ATT", 85, 80, 77, 78, 24), {"overall":80,"value":68834,"goals":4,"matches":7,"ratingSum":50.4,"id":"roster_13go41g","rosterIdentity":"boutalebmohamed","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Boutaleb Mohamed","baselineOrigin":{"league":"france","teamId":"gs7","name":"Boutaleb Mohamed"}}),
    withStats(player("Mamadou Kebe", "ATT", 87, 78, 77, 75, 22), {"overall":79,"value":65810,"goals":2,"matches":5,"ratingSum":32.5,"id":"roster_gyqb2a","rosterIdentity":"mamadoukebe","rosterStatus":"verified","rosterSourceIds":["france-gs7-squad","france-wildcard-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Generation Seven","photoLeague":"france","photoName":"Mamadou Kebe","baselineOrigin":{"league":"france","teamId":"gs7","name":"Mamadou Kebe"},"registrationType":"wildcard"}),
  ] },
  { ...{"id":"kar","name":"Karasu","color":"#c8501e","budget":300000,"coach":"Mokdad Abdelmalek","presidents":["Kameto","Hamza"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["france-domestic-stats","france-draft-5","france-draft-6","france-draft-10","france-golden-crown-2026-10-25"],"officialTeamId":171}, players: [
    withStats(player("Sasha Bernard", "GK", 69, 76, 92, 94, 26), {"overall":83,"value":78785,"matches":9,"ratingSum":58.5,"id":"roster_1dmbf69","rosterIdentity":"sashabernard","rosterStatus":"retained-unverified","rosterSourceIds":["france-draft-5","france-sasha-profile"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Sasha Bernard","baselineOrigin":{"league":"france","teamId":"kar","name":"Sasha Bernard"},"officialPlayerId":87355,"birthDate":"1999-12-18","registrationType":"registered"}),
    withStats(player("Simon Pontdeme", "GK", 61, 64, 77, 76, 24), {"overall":70,"value":44740,"id":"roster_sc03mv","rosterIdentity":"simonpontdeme","rosterStatus":"retained-unverified","rosterSourceIds":["france-draft-6"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Simon Pontdeme","baselineOrigin":{"league":"france","teamId":"kar","name":"Simon Pontdeme"},"registrationType":"registered"}),
    withStats(player("Vivien Cedille", "GK", 60, 63, 76, 75, 23), {"overall":69,"value":43038,"matches":1,"ratingSum":6.5,"id":"roster_1w7x4gw","rosterIdentity":"viviencedille","rosterStatus":"retained-unverified","rosterSourceIds":["france-draft-10"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Vivien Cedille","baselineOrigin":{"league":"france","teamId":"kar","name":"Vivien Cedille"},"registrationType":"registered"}),
    withStats(player("Mehdi Gacem", "DEF", 80, 76, 87, 81, 26), {"overall":81,"value":72002,"goals":3,"assists":1,"matches":9,"ratingSum":68.4,"id":"roster_ytnpi1","rosterIdentity":"mehdigacem","rosterStatus":"retained-unverified","rosterSourceIds":["france-kar-squad","france-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Mehdi Gacem","baselineOrigin":{"league":"france","teamId":"kar","name":"Mehdi Gacem"},"registrationType":"registered"}),
    withStats(player("Sahir Boumhand", "DEF", 78, 74, 85, 79, 24), {"overall":79,"value":65810,"goals":1,"matches":9,"ratingSum":74.7,"id":"roster_73v5o","rosterIdentity":"sahirboumhand","rosterStatus":"retained-unverified","rosterSourceIds":["france-kar-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Sahir Boumhand","baselineOrigin":{"league":"france","teamId":"kar","name":"Sahir Boumhand"}}),
    withStats(player("Christopher Baptista", "MID", 79, 80, 74, 77, 25), {"overall":78,"value":62930,"id":"roster_78koo8","rosterIdentity":"christopherbaptista","rosterStatus":"retained-unverified","rosterSourceIds":["france-kar-squad","france-draft-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Christopher Baptista","baselineOrigin":{"league":"france","teamId":"kar","name":"Christopher Baptista"},"registrationType":"registered"}),
    withStats(player("Guillaume Yenoussi", "MID", 78, 78, 73, 75, 24), {"overall":76,"value":57588,"matches":2,"ratingSum":13,"id":"roster_diylu9","rosterIdentity":"guillaumeyenoussi","rosterStatus":"retained-unverified","rosterSourceIds":["france-draft-10"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Guillaume Yenoussi","baselineOrigin":{"league":"france","teamId":"kar","name":"Guillaume Yenoussi"},"registrationType":"registered"}),
    withStats(player("Ilyes Kallouche", "MID", 80, 79, 75, 76, 21), {"overall":78,"value":62930,"goals":1,"matches":8,"ratingSum":52,"id":"roster_1skr9xr","rosterIdentity":"ilyeskallouche","rosterStatus":"retained-unverified","rosterSourceIds":["france-ilyes-profile"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Ilyes Kallouche","baselineOrigin":{"league":"france","teamId":"kar","name":"Ilyes Kallouche"},"officialPlayerId":87472,"birthDate":"2005-02-08"}),
    withStats(player("Joseph Evens", "MID", 77, 77, 72, 74, 22), {"overall":75,"value":55121,"assists":1,"matches":1,"ratingSum":6.5,"id":"roster_1m9ai1v","rosterIdentity":"josephevens","rosterStatus":"retained-unverified","rosterSourceIds":["france-draft-5"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Joseph Evens","baselineOrigin":{"league":"france","teamId":"kar","name":"Joseph Evens"},"registrationType":"registered"}),
    withStats(player("Lucas Valeri", "MID", 83, 83, 79, 80, 24), {"overall":81,"value":72002,"goals":2,"assists":1,"matches":7,"ratingSum":45.5,"id":"roster_1afeo3k","rosterIdentity":"lucasvaleri","rosterStatus":"retained-unverified","rosterSourceIds":["france-draft-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Lucas Valeri","baselineOrigin":{"league":"france","teamId":"kar","name":"Lucas Valeri"},"registrationType":"registered"}),
    withStats(player("Driss Khalid", "MID", 76, 73, 83, 79, 25), {"overall":78,"value":62930,"goals":5,"assists":1,"matches":9,"ratingSum":58.5,"id":"roster_poo74n","rosterIdentity":"drisskhalid","rosterStatus":"retained-unverified","rosterSourceIds":["france-kar-squad","france-wildcard-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Driss Khalid","baselineOrigin":{"league":"france","teamId":"kar","name":"Driss Khalid"},"registrationType":"wildcard"}),
    withStats(player("Lyes Hocine", "MID", 74, 73, 72, 72, 21), {"overall":73,"value":50586,"matches":2,"ratingSum":13,"id":"roster_ghe91u","rosterIdentity":"lyeshocine","rosterStatus":"retained-unverified","rosterSourceIds":["france-lyes-profile"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Lyes Hocine","baselineOrigin":{"league":"france","teamId":"kar","name":"Lyes Hocine"},"officialPlayerId":87473}),
    withStats(player("Youssef Hidasse", "MID", 73, 72, 71, 71, 21), {"overall":72,"value":48512,"matches":2,"ratingSum":13,"id":"roster_r1g4nm","rosterIdentity":"youssefhidasse","rosterStatus":"retained-unverified","rosterSourceIds":["france-domestic-stats"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Youssef Hidasse","baselineOrigin":{"league":"france","teamId":"kar","name":"Youssef Hidasse"}}),
    withStats(player("Dramane Kone", "ATT", 83, 78, 76, 75, 22), {"overall":78,"value":62930,"goals":1,"matches":1,"ratingSum":7,"id":"roster_1y637bu","rosterIdentity":"dramanekone","rosterStatus":"retained-unverified","rosterSourceIds":["france-kar-squad","france-draft-5"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Dramane Kone","baselineOrigin":{"league":"france","teamId":"kar","name":"Dramane Kone"},"registrationType":"registered"}),
    withStats(player("Sita Diarra", "ATT", 87, 83, 79, 79, 25), {"overall":82,"value":75318,"matches":9,"ratingSum":58.5,"id":"roster_fycvj3","rosterIdentity":"sitadiarra","rosterStatus":"retained-unverified","rosterSourceIds":["france-kar-squad","france-draft-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Sita Diarra","baselineOrigin":{"league":"france","teamId":"kar","name":"Sita Diarra"},"registrationType":"registered"}),
    withStats(player("Marvin Gakpa", "ATT", 86, 81, 78, 78, 33), {"overall":81,"value":72002,"id":"roster_3qtmp2","rosterIdentity":"marvingakpa","rosterStatus":"retained-unverified","rosterSourceIds":["france-marvin-profile"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Marvin Gakpa","baselineOrigin":{"league":"france","teamId":"kar","name":"Marvin Gakpa"},"officialPlayerId":87580,"birthDate":"1993-01-11"}),
    withStats(player("Ali Ouarti", "ATT", 89, 86, 80, 82, 27), {"overall":84,"value":82404,"goals":10,"assists":4,"matches":9,"ratingSum":70.2,"id":"roster_nvnozv","rosterIdentity":"aliouarti","rosterStatus":"retained-unverified","rosterSourceIds":["france-draft-5","france-ali-profile"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Ali Ouarti","baselineOrigin":{"league":"france","teamId":"kar","name":"Ali Ouarti"},"officialPlayerId":87358,"birthDate":"1999-07-19","registrationType":"registered"}),
    withStats(player("Matisse Henry", "ATT", 92, 91, 84, 87, 23), {"overall":89,"value":102877,"goals":16,"assists":7,"matches":9,"ratingSum":76.5,"id":"roster_p9agst","rosterIdentity":"matissehenry","rosterStatus":"retained-unverified","rosterSourceIds":["france-kar-squad","france-wildcard-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Matisse Henry","baselineOrigin":{"league":"france","teamId":"kar","name":"Matisse Henry"},"registrationType":"wildcard"}),
    withStats(player("Samy Mahour", "ATT", 82, 78, 75, 74, 23), {"overall":77,"value":60190,"goals":1,"matches":4,"ratingSum":28.8,"id":"roster_1tomaov","rosterIdentity":"samymahour","rosterStatus":"retained-unverified","rosterSourceIds":["france-wildcard-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Karasu","photoLeague":"france","photoName":"Samy Mahour","baselineOrigin":{"league":"france","teamId":"kar","name":"Samy Mahour"},"registrationType":"wildcard"}),
  ] },
  { ...{"id":"pas","name":"Panam All Starz","color":"#8c1c2b","budget":300000,"coach":"Yassine Mohammed","presidents":["Pfut"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["france-pas-squad"],"officialTeamId":175}, players: [
    withStats(player("Adama Wagui", "GK", 65, 77, 97, 98, 26), {"overall":84,"value":82404,"matches":9,"ratingSum":65.7,"id":"roster_hhr9hw","rosterIdentity":"adamawagui","rosterStatus":"verified","rosterSourceIds":["france-pas-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Adama Wagui","baselineOrigin":{"league":"france","teamId":"pas","name":"Adama Wagui"}}),
    withStats(player("Hidris Buy-Kante", "GK", 61, 66, 76, 75, 24), {"overall":70,"value":44740,"matches":3,"ratingSum":19.5,"id":"roster_1kalcot","rosterIdentity":"hidrisbuykante","rosterStatus":"verified","rosterSourceIds":["france-pas-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Hidris Buy-Kante","baselineOrigin":{"league":"france","teamId":"pas","name":"Hidris Buy-Kante"}}),
    withStats(player("Souleymane Ouattara", "GK", 60, 65, 77, 75, 24), {"overall":69,"value":43038,"matches":3,"ratingSum":19.5,"id":"roster_pik344","rosterIdentity":"souleymaneouattara","rosterStatus":"verified","rosterSourceIds":["france-pas-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Souleymane Ouattara","baselineOrigin":{"league":"france","teamId":"pas","name":"Souleymane Ouattara"}}),
    withStats(player("Yaya Doucoure", "GK", 62, 66, 76, 74, 22), {"overall":70,"value":44740,"matches":1,"ratingSum":7.5,"id":"roster_12i6xcl","rosterIdentity":"yayadoucoure","rosterStatus":"verified","rosterSourceIds":["france-pas-squad","france-wildcard-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Yaya Doucoure","baselineOrigin":{"league":"france","teamId":"pas","name":"Yaya Doucoure"},"registrationType":"wildcard"}),
    withStats(player("Jordy Gaspar", "DEF", 75, 71, 82, 76, 25), {"overall":76,"value":57588,"assists":1,"matches":5,"ratingSum":32.5,"id":"roster_1a9utxz","rosterIdentity":"jordygaspar","rosterStatus":"verified","rosterSourceIds":["france-pas-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Jordy Gaspar","baselineOrigin":{"league":"france","teamId":"pas","name":"Jordy Gaspar"}}),
    withStats(player("Nzaba Lungituka", "DEF", 81, 77, 88, 85, 25), {"overall":83,"value":78785,"assists":2,"matches":9,"ratingSum":70.2,"id":"roster_p02ktn","rosterIdentity":"nzabalungituka","rosterStatus":"verified","rosterSourceIds":["france-pas-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Nzaba Lungituka","baselineOrigin":{"league":"france","teamId":"pas","name":"Nzaba Lungituka"}}),
    withStats(player("Yazid Ali Abdallah", "DEF", 73, 69, 79, 74, 23), {"overall":74,"value":52788,"matches":8,"ratingSum":52,"id":"roster_sbd28b","rosterIdentity":"yazidaliabdallah","rosterStatus":"verified","rosterSourceIds":["france-pas-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Yazid Ali Abdallah","baselineOrigin":{"league":"france","teamId":"pas","name":"Yazid Ali Abdallah"}}),
    withStats(player("Alaixys Romao", "DEF", 60, 75, 80, 88, 41), {"overall":76,"value":57588,"goals":1,"assists":1,"matches":4,"ratingSum":26,"id":"roster_1sg1smw","rosterIdentity":"alaixysromao","rosterStatus":"verified","rosterSourceIds":["france-pas-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Alaixys Romao","baselineOrigin":{"league":"france","teamId":"pas","name":"Alaixys Romao"}}),
    withStats(player("Rachid Bouhenna", "DEF", 74, 70, 81, 75, 25), {"overall":75,"value":55121,"matches":4,"ratingSum":26,"id":"roster_1kn7rxe","rosterIdentity":"rachidbouhenna","rosterStatus":"verified","rosterSourceIds":["france-pas-squad","france-wildcard-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Rachid Bouhenna","baselineOrigin":{"league":"france","teamId":"pas","name":"Rachid Bouhenna"},"registrationType":"wildcard"}),
    withStats(player("Andre De Oliveira", "MID", 79, 80, 75, 77, 24), {"overall":78,"value":62930,"goals":3,"matches":9,"ratingSum":58.5,"id":"roster_1fw8l7n","rosterIdentity":"andredeoliveira","rosterStatus":"verified","rosterSourceIds":["france-pas-squad","france-draft-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Andre De Oliveira","baselineOrigin":{"league":"france","teamId":"pas","name":"Andre De Oliveira"},"registrationType":"registered"}),
    withStats(player("Daniel Mendy", "MID", 83, 83, 78, 80, 23), {"overall":81,"value":72002,"goals":4,"matches":9,"ratingSum":58.5,"id":"roster_1bzqmg9","rosterIdentity":"danielmendy","rosterStatus":"verified","rosterSourceIds":["france-pas-squad","france-draft-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Daniel Mendy","baselineOrigin":{"league":"france","teamId":"pas","name":"Daniel Mendy"},"registrationType":"registered"}),
    withStats(player("Hamza Chaib", "MID", 85, 79, 77, 75, 23), {"overall":79,"value":65810,"goals":1,"matches":4,"ratingSum":26,"id":"roster_no3ppd","rosterIdentity":"hamzachaib","rosterStatus":"verified","rosterSourceIds":["france-pas-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Hamza Chaib","baselineOrigin":{"league":"france","teamId":"pas","name":"Hamza Chaib"}}),
    withStats(player("Harrison Manzala", "MID", 85, 84, 79, 81, 24), {"overall":82,"value":75318,"goals":1,"matches":3,"ratingSum":19.5,"id":"roster_1vgy6rn","rosterIdentity":"harrisonmanzala","rosterStatus":"verified","rosterSourceIds":["france-pas-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Harrison Manzala","baselineOrigin":{"league":"france","teamId":"pas","name":"Harrison Manzala"}}),
    withStats(player("Mohamed Sakkouh", "MID", 78, 78, 74, 76, 24), {"overall":77,"value":60190,"goals":2,"assists":1,"matches":9,"ratingSum":58.5,"id":"roster_b5xr6","rosterIdentity":"mohamedsakkouh","rosterStatus":"verified","rosterSourceIds":["france-pas-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Mohamed Sakkouh","baselineOrigin":{"league":"france","teamId":"pas","name":"Mohamed Sakkouh"}}),
    withStats(player("Sofiane Ahmed-Kadi", "MID", 77, 77, 72, 74, 22), {"overall":75,"value":55121,"goals":2,"assists":1,"matches":8,"ratingSum":52,"id":"roster_po144e","rosterIdentity":"sofianeahmedkadi","rosterStatus":"verified","rosterSourceIds":["france-pas-squad","france-draft-5"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Sofiane Ahmed-Kadi","baselineOrigin":{"league":"france","teamId":"pas","name":"Sofiane Ahmed-Kadi"},"registrationType":"registered"}),
    withStats(player("Eric Mathieu", "MID", 74, 73, 72, 72, 22), {"overall":73,"value":50586,"matches":4,"ratingSum":26,"id":"roster_1otsiod","rosterIdentity":"ericmathieu","rosterStatus":"verified","rosterSourceIds":["france-pas-squad","france-wildcard-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Eric Mathieu","baselineOrigin":{"league":"france","teamId":"pas","name":"Eric Mathieu"},"registrationType":"wildcard"}),
    withStats(player("Rayan Forsa", "MID", 73, 72, 71, 71, 21), {"overall":72,"value":48512,"matches":2,"ratingSum":13,"id":"roster_v058dv","rosterIdentity":"rayanforsa","rosterStatus":"verified","rosterSourceIds":["france-pas-squad","france-wildcard-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Rayan Forsa","baselineOrigin":{"league":"france","teamId":"pas","name":"Rayan Forsa"},"registrationType":"wildcard"}),
    withStats(player("Walid Betterki", "MID", 83, 81, 77, 79, 23), {"overall":80,"value":68834,"goals":5,"assists":2,"matches":8,"ratingSum":59.2,"id":"roster_1zgrtc","rosterIdentity":"walidbetterki","rosterStatus":"verified","rosterSourceIds":["france-pas-squad","france-wildcard-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Walid Betterki","baselineOrigin":{"league":"france","teamId":"pas","name":"Walid Betterki"},"registrationType":"wildcard"}),
    withStats(player("Emmanuel Louisir", "MID", 72, 70, 71, 70, 21), {"overall":71,"value":46564,"matches":1,"ratingSum":6.5,"id":"roster_14iha8o","rosterIdentity":"emmanuellouisir","rosterStatus":"verified","rosterSourceIds":["france-pas-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Emmanuel Louisir","baselineOrigin":{"league":"france","teamId":"pas","name":"Emmanuel Louisir"}}),
    withStats(player("Elijah Boimbo", "ATT", 87, 82, 78, 78, 24), {"overall":81,"value":72002,"matches":5,"ratingSum":32.5,"id":"roster_1sejiuw","rosterIdentity":"elijahboimbo","rosterStatus":"verified","rosterSourceIds":["france-pas-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Elijah Boimbo","baselineOrigin":{"league":"france","teamId":"pas","name":"Elijah Boimbo"}}),
    withStats(player("Florent Sinama-Pongolle", "ATT", 68, 85, 78, 88, 39), {"overall":80,"value":68834,"matches":1,"ratingSum":6.5,"id":"roster_jsu3b6","rosterIdentity":"florentsinamapongolle","rosterStatus":"verified","rosterSourceIds":["france-pas-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Panam All Starz","photoLeague":"france","photoName":"Florent Sinama-Pongolle","baselineOrigin":{"league":"france","teamId":"pas","name":"Florent Sinama-Pongolle"}}),
  ] },
  { ...{"id":"u3d","name":"Unit3d","color":"#2a6fb0","budget":300000,"coach":"Grégory Campi","presidents":["Djilsi","Maxime Biaggi"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["france-u3d-squad"],"officialTeamId":170}, players: [
    withStats(player("Florian Verplanck", "GK", 62, 68, 82, 83, 28), {"overall":74,"value":52788,"matches":9,"ratingSum":58.5,"id":"roster_1sltym","rosterIdentity":"florianverplanck","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad","france-draft-5"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Florian Verplanck","baselineOrigin":{"league":"france","teamId":"u3d","name":"Florian Verplanck"},"registrationType":"registered"}),
    withStats(player("Jessy Moulin", "GK", 65, 73, 85, 86, 33), {"overall":77,"value":60190,"matches":8,"ratingSum":52,"id":"roster_baapkz","rosterIdentity":"jessymoulin","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad","france-draft-6"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Jessy Moulin","baselineOrigin":{"league":"france","teamId":"u3d","name":"Jessy Moulin"},"registrationType":"registered"}),
    withStats(player("Alseny Sano", "DEF", 80, 76, 87, 81, 25), {"overall":81,"value":72002,"goals":1,"matches":9,"ratingSum":67.5,"id":"roster_rqox9q","rosterIdentity":"alsenysano","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad","france-draft-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Alseny Sano","baselineOrigin":{"league":"france","teamId":"u3d","name":"Alseny Sano"},"registrationType":"registered"}),
    withStats(player("Yannick Mbone", "DEF", 73, 69, 80, 74, 24), {"overall":74,"value":52788,"matches":9,"ratingSum":58.5,"id":"roster_i8az5p","rosterIdentity":"yannickmbone","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad","france-draft-6"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Yannick Mbone","baselineOrigin":{"league":"france","teamId":"u3d","name":"Yannick Mbone"},"registrationType":"registered"}),
    withStats(player("Youssef Khatiri", "DEF", 74, 70, 81, 75, 25), {"overall":75,"value":55121,"goals":1,"matches":9,"ratingSum":64.8,"id":"roster_wrq6wz","rosterIdentity":"youssefkhatiri","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Youssef Khatiri","baselineOrigin":{"league":"france","teamId":"u3d","name":"Youssef Khatiri"}}),
    withStats(player("Bryan Goncalves", "DEF", 74, 72, 80, 76, 24), {"overall":76,"value":57588,"goals":1,"assists":1,"matches":1,"ratingSum":7.2,"id":"roster_1qpyma3","rosterIdentity":"bryangoncalves","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad","france-wildcard-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Bryan Goncalves","baselineOrigin":{"league":"france","teamId":"u3d","name":"Bryan Goncalves"},"registrationType":"wildcard"}),
    withStats(player("Amine Kheche", "MID", 82, 85, 78, 83, 24), {"overall":82,"value":75318,"goals":10,"assists":2,"matches":9,"ratingSum":70.2,"id":"roster_ycsa3j","rosterIdentity":"aminekheche","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Amine Kheche","baselineOrigin":{"league":"france","teamId":"u3d","name":"Amine Kheche"}}),
    withStats(player("José Pereira", "MID", 82, 83, 78, 80, 25), {"overall":81,"value":72002,"matches":8,"ratingSum":61.6,"id":"roster_17roabq","rosterIdentity":"josepereira","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"José Pereira","baselineOrigin":{"league":"france","teamId":"u3d","name":"José Pereira"}}),
    withStats(player("Nicolas Martins", "MID", 84, 85, 80, 82, 23), {"overall":83,"value":78785,"matches":1,"ratingSum":8.3,"id":"roster_1fdudzq","rosterIdentity":"nicolasmartins","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Nicolas Martins","baselineOrigin":{"league":"france","teamId":"u3d","name":"Nicolas Martins"}}),
    withStats(player("Yassine Skira", "MID", 76, 77, 72, 74, 22), {"overall":75,"value":55121,"assists":1,"matches":9,"ratingSum":64.8,"id":"roster_1565823","rosterIdentity":"yassineskira","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad","france-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Yassine Skira","baselineOrigin":{"league":"france","teamId":"u3d","name":"Yassine Skira"},"registrationType":"registered"}),
    withStats(player("Maxime Corain", "MID", 73, 71, 72, 71, 21), {"overall":72,"value":48512,"matches":2,"ratingSum":13,"id":"roster_1uoijoe","rosterIdentity":"maximecorain","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Maxime Corain","baselineOrigin":{"league":"france","teamId":"u3d","name":"Maxime Corain"}}),
    withStats(player("Valère Germain", "ATT", 70, 83, 78, 85, 38), {"overall":79,"value":65810,"goals":6,"assists":4,"matches":8,"ratingSum":60.8,"id":"roster_175h21","rosterIdentity":"valeregermain","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad","france-wildcard-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Valère Germain","baselineOrigin":{"league":"france","teamId":"u3d","name":"Valère Germain"},"registrationType":"wildcard"}),
    withStats(player("Damani Toure", "ATT", 88, 83, 80, 80, 25), {"overall":83,"value":78785,"goals":4,"matches":6,"ratingSum":49.2,"id":"roster_4u3cse","rosterIdentity":"damanitoure","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad","france-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Damani Toure","baselineOrigin":{"league":"france","teamId":"u3d","name":"Damani Toure"},"registrationType":"registered"}),
    withStats(player("Marvin Emmanuel", "ATT", 91, 85, 82, 83, 23), {"overall":85,"value":86178,"goals":5,"assists":5,"matches":5,"ratingSum":41,"id":"roster_kt4g28","rosterIdentity":"marvinemmanuel","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Marvin Emmanuel","baselineOrigin":{"league":"france","teamId":"u3d","name":"Marvin Emmanuel"}}),
    withStats(player("Amara Fofana", "ATT", 88, 83, 81, 80, 22), {"overall":83,"value":78785,"matches":1,"ratingSum":7.6,"id":"roster_dhn08g","rosterIdentity":"amarafofana","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad","france-wildcard-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Amara Fofana","baselineOrigin":{"league":"france","teamId":"u3d","name":"Amara Fofana"},"registrationType":"wildcard"}),
    withStats(player("Clément Dragon", "ATT", 82, 77, 75, 74, 23), {"overall":77,"value":60190,"goals":1,"matches":7,"ratingSum":45.5,"id":"roster_1613aku","rosterIdentity":"clementdragon","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad","france-wildcard-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Clément Dragon","baselineOrigin":{"league":"france","teamId":"u3d","name":"Clément Dragon"},"registrationType":"wildcard"}),
    withStats(player("Enzo Arbona", "ATT", 80, 76, 74, 73, 22), {"overall":76,"value":57588,"assists":1,"matches":4,"ratingSum":26,"id":"roster_1ogfa6w","rosterIdentity":"enzoarbona","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad","france-wildcard-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Enzo Arbona","baselineOrigin":{"league":"france","teamId":"u3d","name":"Enzo Arbona"},"registrationType":"wildcard"}),
    withStats(player("Nassim Labidi", "ATT", 79, 74, 73, 71, 21), {"overall":74,"value":52788,"matches":1,"ratingSum":6.5,"id":"roster_o6schd","rosterIdentity":"nassimlabidi","rosterStatus":"verified","rosterSourceIds":["france-u3d-squad","france-wildcard-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Unit3d","photoLeague":"france","photoName":"Nassim Labidi","baselineOrigin":{"league":"france","teamId":"u3d","name":"Nassim Labidi"},"registrationType":"wildcard"}),
  ] },
  { ...{"id":"wpf","name":"Wolf Pack FC","color":"#5a4d6b","budget":300000,"coach":"Richard Pascal","presidents":["Adil Rami","Naza"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["france-wpf-squad"],"officialTeamId":174}, players: [
    withStats(player("Guillaume Lesec", "GK", 68, 77, 92, 96, 27), {"overall":83,"value":78785,"matches":8,"ratingSum":63.2,"id":"roster_y8fn84","rosterIdentity":"guillaumelesec","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad","france-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Guillaume Lesec","baselineOrigin":{"league":"france","teamId":"wpf","name":"Guillaume Lesec"},"registrationType":"registered"}),
    withStats(player("Sebastien Renot", "GK", 60, 65, 77, 76, 24), {"overall":70,"value":44740,"matches":8,"ratingSum":52,"id":"roster_2jzxlt","rosterIdentity":"sebastienrenot","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Sebastien Renot","baselineOrigin":{"league":"france","teamId":"wpf","name":"Sebastien Renot"}}),
    withStats(player("Mohamed Bencherif", "DEF", 80, 76, 87, 81, 25), {"overall":81,"value":72002,"goals":2,"assists":2,"matches":6,"ratingSum":39,"id":"roster_dbkee6","rosterIdentity":"mohamedbencherif","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad","france-draft-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Mohamed Bencherif","baselineOrigin":{"league":"france","teamId":"wpf","name":"Mohamed Bencherif"},"registrationType":"registered"}),
    withStats(player("Franck Noel", "DEF", 73, 69, 80, 74, 24), {"overall":74,"value":52788,"matches":3,"ratingSum":19.5,"id":"roster_9py5na","rosterIdentity":"francknoel","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Franck Noel","baselineOrigin":{"league":"france","teamId":"wpf","name":"Franck Noel"}}),
    withStats(player("Giannelli Imbula", "MID", 77, 89, 85, 83, 33), {"overall":84,"value":82404,"goals":5,"matches":6,"ratingSum":39,"id":"roster_1lupbri","rosterIdentity":"giannelliimbula","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad","france-draft-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Giannelli Imbula","baselineOrigin":{"league":"france","teamId":"wpf","name":"Giannelli Imbula"},"registrationType":"registered"}),
    withStats(player("Idir Ahmin", "MID", 83, 83, 78, 80, 23), {"overall":81,"value":72002,"matches":8,"ratingSum":61.6,"id":"roster_1ie49ae","rosterIdentity":"idirahmin","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad","france-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Idir Ahmin","baselineOrigin":{"league":"france","teamId":"wpf","name":"Idir Ahmin"},"registrationType":"registered"}),
    withStats(player("Lucas De Ataïde", "MID", 79, 80, 75, 77, 24), {"overall":78,"value":62930,"matches":7,"ratingSum":45.5,"id":"roster_tbqueg","rosterIdentity":"lucasdeataide","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Lucas De Ataïde","baselineOrigin":{"league":"france","teamId":"wpf","name":"Lucas De Ataïde"}}),
    withStats(player("Sofiane Bendaoud", "MID", 85, 84, 80, 82, 23), {"overall":83,"value":78785,"goals":4,"assists":3,"matches":8,"ratingSum":57.6,"id":"roster_ptp5se","rosterIdentity":"sofianebendaoud","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad","france-draft-3"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Sofiane Bendaoud","baselineOrigin":{"league":"france","teamId":"wpf","name":"Sofiane Bendaoud"},"registrationType":"registered"}),
    withStats(player("Théo Chendri", "MID", 79, 75, 86, 80, 25), {"overall":80,"value":68834,"assists":2,"matches":6,"ratingSum":49.8,"id":"roster_kgg2ve","rosterIdentity":"theochendri","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Théo Chendri","baselineOrigin":{"league":"france","teamId":"wpf","name":"Théo Chendri"}}),
    withStats(player("Denis-Will Poha", "MID", 77, 77, 72, 74, 22), {"overall":75,"value":55121,"matches":3,"ratingSum":19.5,"id":"roster_6bkuiy","rosterIdentity":"deniswillpoha","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad","france-wildcard-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Denis-Will Poha","baselineOrigin":{"league":"france","teamId":"wpf","name":"Denis-Will Poha"},"registrationType":"wildcard"}),
    withStats(player("Noé Clerge", "MID", 72, 70, 71, 70, 21), {"overall":71,"value":46564,"matches":1,"ratingSum":6.5,"id":"roster_aqdqzd","rosterIdentity":"noeclerge","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Noé Clerge","baselineOrigin":{"league":"france","teamId":"wpf","name":"Noé Clerge"}}),
    withStats(player("Enzo Ferrara", "MID", 73, 72, 71, 71, 21), {"overall":72,"value":48512,"matches":1,"ratingSum":6.5,"id":"roster_2nk4ha","rosterIdentity":"enzoferrara","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Enzo Ferrara","baselineOrigin":{"league":"france","teamId":"wpf","name":"Enzo Ferrara"}}),
    withStats(player("Souleymane Karamoko", "MID", 71, 69, 70, 70, 21), {"overall":70,"value":44740,"matches":1,"ratingSum":6.5,"id":"roster_19mzes","rosterIdentity":"souleymanekaramoko","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Souleymane Karamoko","baselineOrigin":{"league":"france","teamId":"wpf","name":"Souleymane Karamoko"}}),
    withStats(player("Jonathan Kodjia", "ATT", 78, 82, 80, 78, 35), {"overall":80,"value":68834,"goals":2,"matches":6,"ratingSum":39,"id":"roster_1wgkkru","rosterIdentity":"jonathankodjia","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad","france-draft-5"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Jonathan Kodjia","baselineOrigin":{"league":"france","teamId":"wpf","name":"Jonathan Kodjia"},"registrationType":"registered"}),
    withStats(player("Moussa Sao", "ATT", 90, 85, 82, 83, 25), {"overall":85,"value":86178,"goals":12,"assists":3,"matches":8,"ratingSum":62.4,"id":"roster_1m15iy","rosterIdentity":"moussasao","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Moussa Sao","baselineOrigin":{"league":"france","teamId":"wpf","name":"Moussa Sao"}}),
    withStats(player("Mehdi Chahiri", "ATT", 82, 78, 76, 75, 23), {"overall":78,"value":62930,"goals":2,"matches":5,"ratingSum":32.5,"id":"roster_1267rga","rosterIdentity":"mehdichahiri","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad","france-wildcard-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Mehdi Chahiri","baselineOrigin":{"league":"france","teamId":"wpf","name":"Mehdi Chahiri"},"registrationType":"wildcard"}),
    withStats(player("Sabry Tolgui", "ATT", 80, 76, 74, 73, 22), {"overall":76,"value":57588,"assists":1,"matches":3,"ratingSum":19.5,"id":"roster_kfdom2","rosterIdentity":"sabrytolgui","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Sabry Tolgui","baselineOrigin":{"league":"france","teamId":"wpf","name":"Sabry Tolgui"}}),
    withStats(player("Wanis Aïssa", "ATT", 85, 78, 76, 75, 23), {"overall":79,"value":65810,"matches":1,"ratingSum":6.5,"id":"roster_14x2yk0","rosterIdentity":"wanisaissa","rosterStatus":"verified","rosterSourceIds":["france-wpf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Wolf Pack FC","photoLeague":"france","photoName":"Wanis Aïssa","baselineOrigin":{"league":"france","teamId":"wpf","name":"Wanis Aïssa"}}),
  ] },
];

const BRAZIL_TEAMS = [
  { ...{"id":"g3x","name":"G3X FC","color":"#2f4f7a","budget":300000,"coach":"Velho Vamp","presidents":["Gaules","Kelvin"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["brazil-g3x-squad"],"officialTeamId":49}, players: [
    withStats(player("Gabriel Braga", "GK", 63, 67, 82, 82, 26), {"overall":74,"value":52788,"matches":6,"ratingSum":47.4,"id":"roster_glglu0","rosterIdentity":"gabrielbraga","rosterStatus":"verified","rosterSourceIds":["brazil-g3x-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"G3X FC","photoLeague":"brazil","photoName":"Gabriel Braga","baselineOrigin":{"league":"brazil","teamId":"g3x","name":"Gabriel Braga"},"shirtNumber":1}),
    withStats(player("Wembley Luiz", "DEF", 82, 82, 77, 79, 22), {"overall":80,"value":68834,"matches":12,"ratingSum":98.4,"id":"roster_beox5s","rosterIdentity":"wembleyluiz","rosterStatus":"verified","rosterSourceIds":["brazil-g3x-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"G3X FC","photoLeague":"brazil","photoName":"Wembley Luiz","baselineOrigin":{"league":"brazil","teamId":"g3x","name":"Wembley Luiz"},"shirtNumber":3}),
    withStats(player("Gabriel Messias", "DEF", 73, 69, 80, 74, 24), {"overall":74,"value":52788,"assists":1,"matches":11,"ratingSum":71.5,"id":"roster_jlh0h0","rosterIdentity":"gabrielmessias","rosterStatus":"verified","rosterSourceIds":["brazil-g3x-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"G3X FC","photoLeague":"brazil","photoName":"Gabriel Messias","baselineOrigin":{"league":"brazil","teamId":"g3x","name":"Gabriel Messias"},"shirtNumber":5}),
    withStats(player("Marcelo Vilella", "DEF", 81, 78, 83, 81, 29), {"overall":81,"value":72002,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1i113mn","rosterIdentity":"marcelovilella","rosterStatus":"verified","rosterSourceIds":["brazil-g3x-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"G3X FC","photoLeague":"brazil","photoName":"Marcelo Vilella","shirtNumber":6}),
    withStats(player("Dudu Barbosa", "MID", 79, 82, 73, 77, 27), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_pa3u7d","rosterIdentity":"dudubarbosa","rosterStatus":"verified","rosterSourceIds":["brazil-g3x-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"G3X FC","photoLeague":"brazil","photoName":"Dudu Barbosa","shirtNumber":8}),
    withStats(player("Kelvin Oliveira", "ATT", 94, 94, 87, 92, 23), {"overall":92,"value":117151,"goals":33,"assists":6,"matches":12,"ratingSum":105.6,"id":"roster_1f1mga7","rosterIdentity":"kelvinoliveira","rosterStatus":"verified","rosterSourceIds":["brazil-g3x-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"G3X FC","photoLeague":"brazil","photoName":"Kelvin Oliveira","baselineOrigin":{"league":"brazil","teamId":"g3x","name":"Kelvin Oliveira"},"availability":"injured - officially ruled out of Kings Cup Brazil","shirtNumber":9}),
    withStats(player("Andreas Vaz", "MID", 88, 90, 81, 84, 23), {"overall":86,"value":90110,"goals":10,"assists":3,"matches":12,"ratingSum":98.4,"id":"roster_75ykd0","rosterIdentity":"andreasvaz","rosterStatus":"verified","rosterSourceIds":["brazil-g3x-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"G3X FC","photoLeague":"brazil","photoName":"Andreas Vaz","baselineOrigin":{"league":"brazil","teamId":"g3x","name":"Andreas Vaz"},"shirtNumber":10}),
    withStats(player("Marcos 'Niniu'", "ATT", 82, 79, 72, 73, 25), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_18amnk9","rosterIdentity":"marcosniniu","rosterStatus":"verified","rosterSourceIds":["brazil-g3x-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"G3X FC","photoLeague":"brazil","photoName":"Marcos 'Niniu'","shirtNumber":11}),
    withStats(player("Marquinhos Samora", "MID", 76, 77, 73, 73, 23), {"overall":75,"value":55121,"goals":1,"matches":10,"ratingSum":65,"id":"roster_y6dp8l","rosterIdentity":"marquinhossamora","rosterStatus":"verified","rosterSourceIds":["brazil-g3x-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dendele FC","photoLeague":"brazil","photoName":"Marquinhos Samora","baselineOrigin":{"league":"brazil","teamId":"den","name":"Marquinhos Samora"},"shirtNumber":12}),
    withStats(player("Thiago 'TH'", "MID", 79, 80, 74, 77, 25), {"overall":78,"value":62930,"goals":2,"assists":2,"matches":12,"ratingSum":78,"id":"roster_1jfl1kl","rosterIdentity":"thiagoth","rosterStatus":"verified","rosterSourceIds":["brazil-g3x-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"G3X FC","photoLeague":"brazil","photoName":"Thiago \"TH\" Brito","baselineOrigin":{"league":"brazil","teamId":"g3x","name":"Thiago \"TH\" Brito"},"shirtNumber":33}),
    withStats(player("Aleix Martí", "ATT", 76, 75, 87, 79, 28), {"overall":79,"value":65810,"goals":11,"matches":4,"id":"roster_1rinhut","rosterIdentity":"aleixmarti","rosterStatus":"verified","rosterSourceIds":["brazil-g3x-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Ultimate Móstoles","photoLeague":"spain","photoName":"Aleix Martí","baselineOrigin":{"league":"spain","teamId":"umo","name":"Aleix Martí"},"shirtNumber":92}),
    withStats(player("Josildo Barata", "GK", 75, 80, 85, 87, 24), {"overall":82,"value":75318,"matches":12,"ratingSum":78,"id":"roster_1eeff2k","rosterIdentity":"josildobarata","rosterStatus":"verified","rosterSourceIds":["brazil-g3x-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"G3X FC","photoLeague":"brazil","photoName":"Josildo Barata","baselineOrigin":{"league":"brazil","teamId":"g3x","name":"Josildo Barata"},"shirtNumber":98}),
    withStats(player("Danilo Silva", "ATT", 84, 81, 79, 76, 29), {"overall":80,"value":68834,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1wadovz","rosterIdentity":"danilosilva","rosterStatus":"verified","rosterSourceIds":["brazil-g3x-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"G3X FC","photoLeague":"brazil","photoName":"Danilo Silva","shirtNumber":99}),
  ] },
  { ...{"id":"fur","name":"Furia FC","color":"#4a4a4a","budget":300000,"coach":"Dudu Oliveira","presidents":["Neymar","Cris Guedes"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["brazil-fur-squad"],"officialTeamId":50}, players: [
    withStats(player("Clebinho Silva", "GK", 61, 65, 81, 79, 24), {"overall":72,"value":48512,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1encljg","rosterIdentity":"clebinhosilva","rosterStatus":"verified","rosterSourceIds":["brazil-fur-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Furia FC","photoLeague":"brazil","photoName":"Clebinho Silva","shirtNumber":1}),
    withStats(player("Ruan Major", "MID", 76, 75, 73, 73, 23), {"overall":74,"value":52788,"assists":1,"matches":9,"ratingSum":58.5,"id":"roster_1cfo6bo","rosterIdentity":"ruanmajor","rosterStatus":"verified","rosterSourceIds":["brazil-fur-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dibrados FC","photoLeague":"brazil","photoName":"Ruan Major","baselineOrigin":{"league":"brazil","teamId":"dib","name":"Ruan Major"},"shirtNumber":3}),
    withStats(player("Rafael 'Tambinha'", "MID", 76, 77, 73, 74, 24), {"overall":75,"value":55121,"matches":9,"ratingSum":58.5,"id":"roster_1fpvoss","rosterIdentity":"rafaeltambinha","rosterStatus":"verified","rosterSourceIds":["brazil-fur-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Furia FC","photoLeague":"brazil","photoName":"Rafael \"Tambinha\"","baselineOrigin":{"league":"brazil","teamId":"fur","name":"Rafael \"Tambinha\""},"shirtNumber":5}),
    withStats(player("Drope Oliveira", "ATT", 83, 83, 75, 77, 28), {"overall":80,"value":68834,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_13fk3qs","rosterIdentity":"dropeoliveira","rosterStatus":"verified","rosterSourceIds":["brazil-fur-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Furia FC","photoLeague":"brazil","photoName":"Drope Oliveira","shirtNumber":7}),
    withStats(player("Ruan Silvestre", "ATT", 81, 81, 78, 77, 27), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_8y6vxi","rosterIdentity":"ruansilvestre","rosterStatus":"verified","rosterSourceIds":["brazil-fur-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Furia FC","photoLeague":"brazil","photoName":"Ruan Silvestre","shirtNumber":9}),
    withStats(player("Lipão Pinheiro", "ATT", 90, 88, 81, 83, 25), {"overall":86,"value":90110,"goals":17,"matches":8,"ratingSum":65.6,"id":"roster_2xo87m","rosterIdentity":"lipaopinheiro","rosterStatus":"verified","rosterSourceIds":["brazil-fur-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Furia FC","photoLeague":"brazil","photoName":"Lipão Pinheiro","baselineOrigin":{"league":"brazil","teamId":"fur","name":"Lipão Pinheiro"},"shirtNumber":10}),
    withStats(player("Leleti Garcia", "ATT", 89, 84, 81, 81, 24), {"overall":84,"value":82404,"goals":3,"assists":1,"matches":6,"ratingSum":42,"id":"roster_wgab6n","rosterIdentity":"leletigarcia","rosterStatus":"verified","rosterSourceIds":["brazil-fur-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Furia FC","photoLeague":"brazil","photoName":"Leleti Garcia","baselineOrigin":{"league":"brazil","teamId":"fur","name":"Leleti Garcia"},"shirtNumber":11}),
    withStats(player("Jeffinho Honorato", "MID", 82, 82, 77, 79, 22), {"overall":80,"value":68834,"goals":3,"assists":3,"matches":9,"ratingSum":58.5,"id":"roster_gtf9i4","rosterIdentity":"jeffinhohonorato","rosterStatus":"verified","rosterSourceIds":["brazil-fur-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Furia FC","photoLeague":"brazil","photoName":"Jeffinho Honorato","baselineOrigin":{"league":"brazil","teamId":"fur","name":"Jeffinho Honorato"},"shirtNumber":12}),
    withStats(player("Kenu Leandro", "MID", 79, 80, 75, 77, 24), {"overall":78,"value":62930,"goals":1,"assists":1,"matches":9,"ratingSum":68.4,"id":"roster_jq9mwr","rosterIdentity":"kenuleandro","rosterStatus":"verified","rosterSourceIds":["brazil-fur-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Furia FC","photoLeague":"brazil","photoName":"Kenu Leandro","baselineOrigin":{"league":"brazil","teamId":"fur","name":"Kenu Leandro"},"shirtNumber":13}),
    withStats(player("Matheus 'Dedo'", "DEF", 79, 75, 86, 80, 25), {"overall":80,"value":68834,"goals":6,"assists":2,"matches":9,"ratingSum":65.7,"id":"roster_lbyy8o","rosterIdentity":"matheusdedo","rosterStatus":"verified","rosterSourceIds":["brazil-fur-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Furia FC","photoLeague":"brazil","photoName":"Matheus \"Dedo\"","baselineOrigin":{"league":"brazil","teamId":"fur","name":"Matheus \"Dedo\""},"shirtNumber":14}),
    withStats(player("Jefferson 'Gegeu'", "DEF", 75, 71, 82, 76, 25), {"overall":76,"value":57588,"id":"roster_19p5sks","rosterIdentity":"jeffersongegeu","rosterStatus":"verified","rosterSourceIds":["brazil-fur-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Furia FC","photoLeague":"brazil","photoName":"Jefferson \"Gegeu\" Silva","baselineOrigin":{"league":"brazil","teamId":"fur","name":"Jefferson \"Gegeu\" Silva"},"shirtNumber":19}),
    withStats(player("Victor Hugo", "GK", 66, 70, 82, 81, 24), {"overall":75,"value":55121,"matches":3,"ratingSum":23.7,"id":"roster_gxvkbv","rosterIdentity":"victorhugo","rosterStatus":"verified","rosterSourceIds":["brazil-fur-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Furia FC","photoLeague":"brazil","photoName":"Victor Hugo","baselineOrigin":{"league":"brazil","teamId":"fur","name":"Victor Hugo"},"shirtNumber":33}),
  ] },
  { ...{"id":"flx","name":"Fluxo FC","color":"#1e7fd1","budget":300000,"coach":"Paulo Netto","presidents":["Cerol","Nobru","Toguro"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["brazil-flx-squad"],"officialTeamId":160}, players: [
    withStats(player("Murillo Pulino", "DEF", 75, 71, 82, 76, 25), {"overall":76,"value":57588,"goals":2,"matches":11,"ratingSum":81.4,"id":"roster_gxiqt8","rosterIdentity":"murillopulino","rosterStatus":"verified","rosterSourceIds":["brazil-flx-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"Murillo Pulino","baselineOrigin":{"league":"brazil","teamId":"flx","name":"Murillo Pulino"},"registrationNote":"Listed on current team page, omitted from October 5 final twelve; unused as of Matchday 1. Do not assume departure or active registration.","shirtNumber":3}),
    withStats(player("Paulo 'Pinguinho'", "MID", 83, 84, 78, 80, 25), {"overall":81,"value":72002,"matches":9,"ratingSum":58.5,"id":"roster_l3sd25","rosterIdentity":"paulopinguinho","rosterStatus":"verified","rosterSourceIds":["brazil-flx-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"Paulo \"Pinguinho\"","baselineOrigin":{"league":"brazil","teamId":"flx","name":"Paulo \"Pinguinho\""},"shirtNumber":5}),
    withStats(player("Cleiton Chupeta", "MID", 78, 84, 76, 82, 28), {"overall":80,"value":68834,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_myhqn9","rosterIdentity":"cleitonchupeta","rosterStatus":"verified","rosterSourceIds":["brazil-flx-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"Cleiton Chupeta","shirtNumber":7}),
    withStats(player("Matheus 'Chaveirinho'", "MID", 83, 84, 79, 81, 23), {"overall":82,"value":75318,"goals":6,"assists":6,"matches":11,"ratingSum":79.2,"id":"roster_1kxl7po","rosterIdentity":"matheuschaveirinho","rosterStatus":"verified","rosterSourceIds":["brazil-flx-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"Matheus \"Chaveirinho\"","baselineOrigin":{"league":"brazil","teamId":"flx","name":"Matheus \"Chaveirinho\""},"shirtNumber":10}),
    withStats(player("Gustavinho Henrique", "ATT", 85, 80, 80, 76, 24), {"overall":80,"value":68834,"goals":2,"assists":1,"matches":11,"ratingSum":88,"id":"roster_li2re0","rosterIdentity":"gustavinhohenrique","rosterStatus":"verified","rosterSourceIds":["brazil-flx-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"Gustavinho Henrique","baselineOrigin":{"league":"brazil","teamId":"flx","name":"Gustavinho Henrique"},"shirtNumber":11}),
    withStats(player("Lucas Samurai", "MID", 79, 83, 75, 82, 29), {"overall":80,"value":68834,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_14wmlcj","rosterIdentity":"lucassamurai","rosterStatus":"verified","rosterSourceIds":["brazil-flx-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"Lucas Samurai","shirtNumber":12}),
    withStats(player("Gabriel Felipe Ribas Acosta", "ATT", 87, 81, 77, 79, 29), {"overall":81,"value":72002,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_ppijwk","rosterIdentity":"gabrielfeliperibasacosta","rosterStatus":"verified","rosterSourceIds":["brazil-flx-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"Gabriel Felipe Ribas Acosta","shirtNumber":19}),
    withStats(player("Murilinho Oliveira", "MID", 75, 76, 69, 75, 23), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1yml4gz","rosterIdentity":"murilinhooliveira","rosterStatus":"verified","rosterSourceIds":["brazil-flx-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"Murilinho Oliveira","shirtNumber":20}),
    withStats(player("João Pedro", "GK", 67, 73, 87, 87, 26), {"overall":79,"value":65810,"matches":11,"ratingSum":93.5,"id":"roster_8ghhwc","rosterIdentity":"joaopedro","rosterStatus":"verified","rosterSourceIds":["brazil-flx-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"João Pedro","baselineOrigin":{"league":"brazil","teamId":"flx","name":"João Pedro"},"shirtNumber":22}),
    withStats(player("Luiz Felipe", "MID", 75, 76, 70, 73, 23), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_acq4ug","rosterIdentity":"luizfelipe","rosterStatus":"verified","rosterSourceIds":["brazil-flx-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"Luiz Felipe","shirtNumber":45}),
    withStats(player("Pedro Medina", "DEF", 73, 70, 80, 74, 24), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1unk61p","rosterIdentity":"pedromedina","rosterStatus":"verified","rosterSourceIds":["brazil-flx-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"Pedro Medina","shirtNumber":80}),
    withStats(player("Vinicyus Chacon", "GK", 64, 64, 77, 82, 24), {"overall":72,"value":48512,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1fmiwjr","rosterIdentity":"vinicyuschacon","rosterStatus":"verified","rosterSourceIds":["brazil-flx-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"Vinicyus Chacon","shirtNumber":82}),
    withStats(player("Patrick Habibi", "ATT", 82, 78, 76, 76, 23), {"overall":78,"value":62930,"goals":1,"matches":3,"ratingSum":21.9,"id":"roster_183d7iq","rosterIdentity":"patrickhabibi","rosterStatus":"verified","rosterSourceIds":["brazil-flx-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"Patrick Habibi","baselineOrigin":{"league":"brazil","teamId":"flx","name":"Patrick Habibi"},"shirtNumber":99}),
  ] },
  { ...{"id":"den","name":"Dendele FC","color":"#d4a017","budget":300000,"coach":"Preto","presidents":["Paulinho o Loko","LuqEt4"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["brazil-den-squad"],"officialTeamId":161}, players: [
    withStats(player("Gustavo Húngaro", "GK", 62, 64, 75, 70, 24), {"overall":68,"value":41457,"matches":10,"ratingSum":60,"id":"roster_f6fsn2","rosterIdentity":"gustavohungaro","rosterStatus":"verified","rosterSourceIds":["brazil-den-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dendele FC","photoLeague":"brazil","photoName":"Gustavo Húngaro","baselineOrigin":{"league":"brazil","teamId":"den","name":"Gustavo Húngaro"},"shirtNumber":1}),
    withStats(player("Lyncoln Oliveira", "DEF", 85, 82, 80, 83, 25), {"overall":83,"value":78785,"goals":12,"matches":9,"ratingSum":72,"id":"roster_xqgb33","rosterIdentity":"lyncolnoliveira","rosterStatus":"verified","rosterSourceIds":["brazil-den-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dendele FC","photoLeague":"brazil","photoName":"Lyncoln Oliveira","baselineOrigin":{"league":"brazil","teamId":"den","name":"Lyncoln Oliveira"},"shirtNumber":2}),
    withStats(player("Cristhian 'Canhoto'", "MID", 80, 81, 75, 74, 24), {"overall":78,"value":62930,"goals":4,"assists":3,"matches":9,"ratingSum":64.8,"id":"roster_1n9czqi","rosterIdentity":"cristhiancanhoto","rosterStatus":"verified","rosterSourceIds":["brazil-den-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dendele FC","photoLeague":"brazil","photoName":"Cristhian \"Canhoto\"","baselineOrigin":{"league":"brazil","teamId":"den","name":"Cristhian \"Canhoto\""},"shirtNumber":6}),
    withStats(player("Lucas 'L7'", "ATT", 86, 82, 78, 79, 24), {"overall":81,"value":72002,"goals":6,"assists":4,"matches":10,"ratingSum":73,"id":"roster_xrpbpu","rosterIdentity":"lucasl7","rosterStatus":"verified","rosterSourceIds":["brazil-den-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dendele FC","photoLeague":"brazil","photoName":"Lucas \"L7\"","baselineOrigin":{"league":"brazil","teamId":"den","name":"Lucas \"L7\""},"shirtNumber":7}),
    withStats(player("Christian Santos", "MID", 80, 79, 75, 76, 24), {"overall":78,"value":62930,"goals":8,"assists":3,"matches":11,"ratingSum":80.3,"id":"roster_1bhc9yc","rosterIdentity":"christiansantos","rosterStatus":"verified","rosterSourceIds":["brazil-den-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"DesimpaiN","photoLeague":"brazil","photoName":"Christian Santos","baselineOrigin":{"league":"brazil","teamId":"dpn","name":"Christian Santos"},"shirtNumber":10}),
    withStats(player("Ryan Soares", "ATT", 85, 81, 77, 77, 23), {"overall":80,"value":68834,"goals":6,"assists":1,"matches":10,"ratingSum":72,"id":"roster_thg0oy","rosterIdentity":"ryansoares","rosterStatus":"verified","rosterSourceIds":["brazil-den-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dendele FC","photoLeague":"brazil","photoName":"Ryan Soares","baselineOrigin":{"league":"brazil","teamId":"den","name":"Ryan Soares"},"shirtNumber":11}),
    withStats(player("Nicollas Nascimento", "ATT", 80, 76, 74, 72, 22), {"overall":76,"value":57588,"matches":10,"ratingSum":65,"id":"roster_1fn3wm1","rosterIdentity":"nicollasnascimento","rosterStatus":"verified","rosterSourceIds":["brazil-den-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dendele FC","photoLeague":"brazil","photoName":"Nicollas Nascimento","baselineOrigin":{"league":"brazil","teamId":"den","name":"Nicollas Nascimento"},"shirtNumber":12}),
    withStats(player("Gui Carvalho", "DEF", 75, 71, 82, 78, 25), {"overall":77,"value":60190,"matches":10,"ratingSum":77,"id":"roster_1hsr97s","rosterIdentity":"guicarvalho","rosterStatus":"verified","rosterSourceIds":["brazil-den-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dendele FC","photoLeague":"brazil","photoName":"Gui Carvalho","baselineOrigin":{"league":"brazil","teamId":"den","name":"Gui Carvalho"},"shirtNumber":14}),
    withStats(player("Gabriel Repulho", "ATT", 84, 79, 76, 76, 24), {"overall":79,"value":65810,"matches":8,"ratingSum":62.4,"id":"roster_i66azg","rosterIdentity":"gabrielrepulho","rosterStatus":"verified","rosterSourceIds":["brazil-den-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dendele FC","photoLeague":"brazil","photoName":"Gabriel Repulho","baselineOrigin":{"league":"brazil","teamId":"den","name":"Gabriel Repulho"},"shirtNumber":16}),
    withStats(player("Júlio Carvalho", "GK", 63, 66, 79, 84, 25), {"overall":73,"value":50586,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_10ln30o","rosterIdentity":"juliocarvalho","rosterStatus":"verified","rosterSourceIds":["brazil-den-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Dendele FC","photoLeague":"brazil","photoName":"Júlio Carvalho","shirtNumber":21}),
    withStats(player("Vinicius 'Melequinha' Almeida", "DEF", 77, 73, 81, 80, 27), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1y4yspb","rosterIdentity":"viniciusmelequinhaalmeida","rosterStatus":"verified","rosterSourceIds":["brazil-den-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Dendele FC","photoLeague":"brazil","photoName":"Vinicius 'Melequinha' Almeida","shirtNumber":30}),
    withStats(player("Rubens Tuco", "ATT", 83, 78, 73, 75, 25), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1wo7bgn","rosterIdentity":"rubenstuco","rosterStatus":"verified","rosterSourceIds":["brazil-den-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Dendele FC","photoLeague":"brazil","photoName":"Rubens Tuco","shirtNumber":92}),
  ] },
  { ...{"id":"lou","name":"LOUD SC","color":"#2e8b3d","budget":300000,"coach":"Carlos Pimenta","presidents":["Coringa","Brabox"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["brazil-lou-squad"],"officialTeamId":162}, players: [
    withStats(player("Esaú Nascimento", "GK", 80, 80, 87, 87, 26), {"overall":84,"value":82404,"matches":7,"ratingSum":50.4,"id":"roster_fwe4as","rosterIdentity":"esaunascimento","rosterStatus":"verified","rosterSourceIds":["brazil-lou-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"LOUD SC","photoLeague":"brazil","photoName":"Esaú Nascimento","baselineOrigin":{"league":"brazil","teamId":"lou","name":"Esaú Nascimento"},"shirtNumber":1}),
    withStats(player("Rafinha Cunha", "ATT", 87, 83, 79, 79, 25), {"overall":82,"value":75318,"goals":3,"assists":5,"matches":10,"ratingSum":72,"id":"roster_1rf1y03","rosterIdentity":"rafinhacunha","rosterStatus":"verified","rosterSourceIds":["brazil-lou-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"LOUD SC","photoLeague":"brazil","photoName":"Rafinha Cunha","baselineOrigin":{"league":"brazil","teamId":"lou","name":"Rafinha Cunha"},"shirtNumber":7}),
    withStats(player("Luís Fernando", "DEF", 78, 73, 85, 77, 28), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1pr39g1","rosterIdentity":"luisfernando","rosterStatus":"verified","rosterSourceIds":["brazil-lou-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"LOUD SC","photoLeague":"brazil","photoName":"Luís Fernando","shirtNumber":8}),
    withStats(player("Daniel Shiraishi", "MID", 80, 80, 75, 77, 22), {"overall":78,"value":62930,"goals":4,"assists":1,"matches":10,"ratingSum":70,"id":"roster_11ll1i2","rosterIdentity":"danielshiraishi","rosterStatus":"verified","rosterSourceIds":["brazil-lou-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"LOUD SC","photoLeague":"brazil","photoName":"Daniel Shiraishi","baselineOrigin":{"league":"brazil","teamId":"lou","name":"Daniel Shiraishi"},"shirtNumber":10}),
    withStats(player("Andson 'Romarinho'", "ATT", 82, 81, 79, 76, 28), {"overall":80,"value":68834,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_j1lowd","rosterIdentity":"andsonromarinho","rosterStatus":"verified","rosterSourceIds":["brazil-lou-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"LOUD SC","photoLeague":"brazil","photoName":"Andson 'Romarinho'","shirtNumber":11}),
    withStats(player("Caio Felipe", "MID", 79, 80, 74, 77, 24), {"overall":78,"value":62930,"matches":10,"ratingSum":65,"id":"roster_dh78to","rosterIdentity":"caiofelipe","rosterStatus":"verified","rosterSourceIds":["brazil-lou-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"LOUD SC","photoLeague":"brazil","photoName":"Caio Felipe","baselineOrigin":{"league":"brazil","teamId":"lou","name":"Caio Felipe"},"shirtNumber":12}),
    withStats(player("Arthur Facas", "GK", 61, 64, 77, 76, 24), {"overall":70,"value":44740,"matches":1,"ratingSum":6.5,"id":"roster_1li3hvp","rosterIdentity":"arthurfacas","rosterStatus":"verified","rosterSourceIds":["brazil-lou-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"LOUD SC","photoLeague":"brazil","photoName":"Arthur Facas","baselineOrigin":{"league":"brazil","teamId":"lou","name":"Arthur Facas"},"shirtNumber":14}),
    withStats(player("Gui Marques", "MID", 75, 79, 72, 74, 24), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1hhgyoi","rosterIdentity":"guimarques","rosterStatus":"verified","rosterSourceIds":["brazil-lou-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"LOUD SC","photoLeague":"brazil","photoName":"Gui Marques","shirtNumber":20}),
    withStats(player("Matheus 'Biro'", "DEF", 73, 69, 80, 74, 24), {"overall":74,"value":52788,"goals":1,"assists":2,"matches":10,"ratingSum":65,"id":"roster_1vyztl4","rosterIdentity":"matheusbiro","rosterStatus":"verified","rosterSourceIds":["brazil-lou-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"LOUD SC","photoLeague":"brazil","photoName":"Matheus \"Biro\"","baselineOrigin":{"league":"brazil","teamId":"lou","name":"Matheus \"Biro\""},"shirtNumber":25}),
    withStats(player("Felipe Viana", "ATT", 93, 89, 85, 86, 26), {"overall":88,"value":98457,"goals":12,"assists":2,"matches":10,"ratingSum":75,"id":"roster_1yze8ql","rosterIdentity":"felipeviana","rosterStatus":"verified","rosterSourceIds":["brazil-lou-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"LOUD SC","photoLeague":"brazil","photoName":"Felipe Viana","baselineOrigin":{"league":"brazil","teamId":"lou","name":"Felipe Viana"},"shirtNumber":27}),
    withStats(player("Matheusinho Santos", "MID", 79, 85, 75, 78, 28), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1cmgxdk","rosterIdentity":"matheusinhosantos","rosterStatus":"verified","rosterSourceIds":["brazil-lou-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"LOUD SC","photoLeague":"brazil","photoName":"Matheusinho Santos","shirtNumber":77}),
    withStats(player("Helber Júnior", "ATT", 88, 84, 80, 81, 25), {"overall":83,"value":78785,"goals":11,"assists":1,"matches":11,"ratingSum":81.4,"id":"roster_1ojt7dy","rosterIdentity":"helberjunior","rosterStatus":"verified","rosterSourceIds":["brazil-lou-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"Helber Júnior","baselineOrigin":{"league":"brazil","teamId":"flx","name":"Helber Júnior"},"shirtNumber":96}),
  ] },
  { ...{"id":"nyv","name":"Nyvelados FC","color":"#7a1fb5","budget":300000,"coach":"Dabá","presidents":["Nyvi Estephan","Falcão"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["brazil-nyv-squad"],"officialTeamId":163}, players: [
    withStats(player("Ivo Alves", "GK", 61, 67, 77, 77, 25), {"overall":71,"value":46564,"matches":3,"ratingSum":22.8,"id":"roster_16oz4gk","rosterIdentity":"ivoalves","rosterStatus":"verified","rosterSourceIds":["brazil-nyv-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dibrados FC","photoLeague":"brazil","photoName":"Ivo Alves","baselineOrigin":{"league":"brazil","teamId":"dib","name":"Ivo Alves"},"shirtNumber":1}),
    withStats(player("Luisinho Barreiros", "MID", 78, 78, 73, 75, 23), {"overall":76,"value":57588,"matches":7,"ratingSum":46.9,"id":"roster_gmb7q9","rosterIdentity":"luisinhobarreiros","rosterStatus":"verified","rosterSourceIds":["brazil-nyv-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Nyvelados FC","photoLeague":"brazil","photoName":"Luisinho Barreiros","baselineOrigin":{"league":"brazil","teamId":"nyv","name":"Luisinho Barreiros"},"shirtNumber":5}),
    withStats(player("Marcos 'MV'", "MID", 80, 78, 73, 75, 24), {"overall":77,"value":60190,"matches":10,"ratingSum":65,"id":"roster_2enm5d","rosterIdentity":"marcosmv","rosterStatus":"verified","rosterSourceIds":["brazil-nyv-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"Marcos \"MV\"","baselineOrigin":{"league":"brazil","teamId":"flx","name":"Marcos \"MV\""},"shirtNumber":6}),
    withStats(player("Edipo Felipinho", "ATT", 82, 76, 74, 71, 24), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1e8qdji","rosterIdentity":"edipofelipinho","rosterStatus":"verified","rosterSourceIds":["brazil-nyv-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Nyvelados FC","photoLeague":"brazil","photoName":"Edipo Felipinho","shirtNumber":7}),
    withStats(player("GB Medeiros", "DEF", 75, 75, 79, 75, 26), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_iwsjng","rosterIdentity":"gbmedeiros","rosterStatus":"verified","rosterSourceIds":["brazil-nyv-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Nyvelados FC","photoLeague":"brazil","photoName":"GB Medeiros","shirtNumber":8}),
    withStats(player("Johnny Gomes", "ATT", 85, 81, 76, 78, 28), {"overall":80,"value":68834,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_gjidne","rosterIdentity":"johnnygomes","rosterStatus":"verified","rosterSourceIds":["brazil-nyv-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Nyvelados FC","photoLeague":"brazil","photoName":"Johnny Gomes","shirtNumber":9}),
    withStats(player("Léo 'Gol'", "MID", 80, 79, 75, 76, 24), {"overall":78,"value":62930,"goals":9,"assists":5,"matches":9,"ratingSum":67.5,"id":"roster_11xcj0r","rosterIdentity":"leogol","rosterStatus":"verified","rosterSourceIds":["brazil-nyv-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Nyvelados FC","photoLeague":"brazil","photoName":"Léo \"Gol\"","baselineOrigin":{"league":"brazil","teamId":"nyv","name":"Léo \"Gol\""},"shirtNumber":10}),
    withStats(player("Luizinho Silva", "GK", 65, 68, 83, 84, 29), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1mtj928","rosterIdentity":"luizinhosilva","rosterStatus":"verified","rosterSourceIds":["brazil-nyv-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Nyvelados FC","photoLeague":"brazil","photoName":"Luizinho Silva","shirtNumber":12}),
    withStats(player("Matheus Scooby", "MID", 76, 77, 71, 78, 24), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1habtyb","rosterIdentity":"matheusscooby","rosterStatus":"verified","rosterSourceIds":["brazil-nyv-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Nyvelados FC","photoLeague":"brazil","photoName":"Matheus Scooby","shirtNumber":14}),
    withStats(player("Erick 'Kaká'", "ATT", 78, 76, 73, 72, 22), {"overall":75,"value":55121,"matches":1,"ratingSum":6.5,"id":"roster_1bb0mhf","rosterIdentity":"erickkaka","rosterStatus":"verified","rosterSourceIds":["brazil-nyv-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Capim FC","photoLeague":"brazil","photoName":"Erick \"Kaká\"","baselineOrigin":{"league":"brazil","teamId":"cap","name":"Erick \"Kaká\""},"shirtNumber":18}),
    withStats(player("Maicon Macabeu", "DEF", 74, 70, 81, 75, 25), {"overall":75,"value":55121,"assists":1,"matches":8,"ratingSum":52,"id":"roster_hx0qgg","rosterIdentity":"maiconmacabeu","rosterStatus":"verified","rosterSourceIds":["brazil-nyv-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Nyvelados FC","photoLeague":"brazil","photoName":"Maicon Macabeu","baselineOrigin":{"league":"brazil","teamId":"nyv","name":"Maicon Macabeu"},"shirtNumber":94}),
    withStats(player("Matheus Klynsmann", "ATT", 87, 83, 79, 79, 25), {"overall":82,"value":75318,"goals":1,"assists":1,"matches":9,"ratingSum":63.9,"id":"roster_1o3tz0p","rosterIdentity":"matheusklynsmann","rosterStatus":"verified","rosterSourceIds":["brazil-nyv-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Nyvelados FC","photoLeague":"brazil","photoName":"Matheus Klynsmann","baselineOrigin":{"league":"brazil","teamId":"nyv","name":"Matheus Klynsmann"},"shirtNumber":95}),
  ] },
  { ...{"id":"pod","name":"Podpah Funkbol Clube","color":"#8c1c2b","budget":300000,"coach":"Gustavo da Silva","presidents":["Igão","Michel Elias","MC Hariel"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["brazil-pod-squad"],"officialTeamId":164}, players: [
    withStats(player("LC Paredão", "GK", 66, 67, 82, 83, 27), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_tmb00q","rosterIdentity":"lcparedao","rosterStatus":"verified","rosterSourceIds":["brazil-pod-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Podpah Funkbol Clube","photoLeague":"brazil","photoName":"LC Paredão","shirtNumber":1}),
    withStats(player("William Jesus", "DEF", 75, 71, 82, 76, 25), {"overall":76,"value":57588,"goals":2,"assists":1,"matches":9,"ratingSum":63,"id":"roster_ap93gc","rosterIdentity":"williamjesus","rosterStatus":"verified","rosterSourceIds":["brazil-pod-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Podpah Funkbol Clube","photoLeague":"brazil","photoName":"William Jesus","baselineOrigin":{"league":"brazil","teamId":"pod","name":"William Jesus"},"shirtNumber":3}),
    withStats(player("Thiago Magalhães", "DEF", 77, 73, 83, 78, 23), {"overall":78,"value":62930,"matches":1,"ratingSum":6.5,"id":"roster_8y505u","rosterIdentity":"thiagomagalhaes","rosterStatus":"verified","rosterSourceIds":["brazil-pod-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Podpah Funkbol Clube","photoLeague":"brazil","photoName":"Thiago Magalhães","baselineOrigin":{"league":"brazil","teamId":"pod","name":"Thiago Magalhães"},"shirtNumber":5}),
    withStats(player("Juninho Antunes", "ATT", 88, 84, 80, 81, 26), {"overall":83,"value":78785,"goals":4,"assists":7,"matches":11,"ratingSum":71.5,"id":"roster_1wq4g46","rosterIdentity":"juninhoantunes","rosterStatus":"verified","rosterSourceIds":["brazil-pod-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Podpah Funkbol Clube","photoLeague":"brazil","photoName":"Juninho Antunes","baselineOrigin":{"league":"brazil","teamId":"pod","name":"Juninho Antunes"},"shirtNumber":7}),
    withStats(player("João 'Choco'", "ATT", 85, 78, 76, 75, 23), {"overall":79,"value":65810,"goals":3,"assists":1,"matches":11,"ratingSum":71.5,"id":"roster_11l0ndc","rosterIdentity":"joaochoco","rosterStatus":"verified","rosterSourceIds":["brazil-pod-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Podpah Funkbol Clube","photoLeague":"brazil","photoName":"João \"Choco\"","baselineOrigin":{"league":"brazil","teamId":"pod","name":"João \"Choco\""},"shirtNumber":9}),
    withStats(player("Juninho Maestro", "MID", 76, 80, 72, 80, 26), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1wr835p","rosterIdentity":"juninhomaestro","rosterStatus":"verified","rosterSourceIds":["brazil-pod-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Podpah Funkbol Clube","photoLeague":"brazil","photoName":"Juninho Maestro","shirtNumber":10}),
    withStats(player("Caio Miranda", "MID", 78, 78, 73, 75, 23), {"overall":76,"value":57588,"goals":1,"assists":1,"matches":11,"ratingSum":71.5,"id":"roster_k3c9if","rosterIdentity":"caiomiranda","rosterStatus":"verified","rosterSourceIds":["brazil-pod-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Podpah Funkbol Clube","photoLeague":"brazil","photoName":"Caio Miranda","baselineOrigin":{"league":"brazil","teamId":"pod","name":"Caio Miranda"},"shirtNumber":11}),
    withStats(player("Gustavo Albino", "GK", 65, 69, 81, 84, 27), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_t37g75","rosterIdentity":"gustavoalbino","rosterStatus":"verified","rosterSourceIds":["brazil-pod-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Podpah Funkbol Clube","photoLeague":"brazil","photoName":"Gustavo Albino","shirtNumber":12}),
    withStats(player("Yan 'Coringa'", "ATT", 90, 86, 82, 84, 24), {"overall":86,"value":90110,"goals":7,"assists":3,"matches":11,"ratingSum":81.4,"id":"roster_r8edw6","rosterIdentity":"yancoringa","rosterStatus":"verified","rosterSourceIds":["brazil-pod-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Podpah Funkbol Clube","photoLeague":"brazil","photoName":"Yan \"Coringa\"","baselineOrigin":{"league":"brazil","teamId":"pod","name":"Yan \"Coringa\""},"shirtNumber":14}),
    withStats(player("Teteu Luiz", "MID", 80, 81, 74, 78, 27), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_19063nw","rosterIdentity":"teteuluiz","rosterStatus":"verified","rosterSourceIds":["brazil-pod-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Podpah Funkbol Clube","photoLeague":"brazil","photoName":"Teteu Luiz","shirtNumber":19}),
    withStats(player("Murilo Tudisco", "ATT", 82, 80, 77, 72, 26), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_xhobv6","rosterIdentity":"murilotudisco","rosterStatus":"verified","rosterSourceIds":["brazil-pod-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Podpah Funkbol Clube","photoLeague":"brazil","photoName":"Murilo Tudisco","shirtNumber":33}),
    withStats(player("Vini Alexandre", "MID", 77, 77, 72, 74, 22), {"overall":75,"value":55121,"goals":4,"matches":11,"ratingSum":84.7,"id":"roster_jyican","rosterIdentity":"vinialexandre","rosterStatus":"verified","rosterSourceIds":["brazil-pod-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Podpah Funkbol Clube","photoLeague":"brazil","photoName":"Vini Alexandre","baselineOrigin":{"league":"brazil","teamId":"pod","name":"Vini Alexandre"},"shirtNumber":77}),
  ] },
  { ...{"id":"cap","name":"Capim FC","color":"#5cb82e","budget":300000,"coach":"Charles Cruz","presidents":["Jon Vlogs","Luva de Pedreiro"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["brazil-cap-squad"],"officialTeamId":167}, players: [
    withStats(player("Guilherme Alves", "GK", 64, 66, 83, 82, 26), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_14gduh6","rosterIdentity":"guilhermealves","rosterStatus":"verified","rosterSourceIds":["brazil-cap-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Capim FC","photoLeague":"brazil","photoName":"Guilherme Alves","shirtNumber":1}),
    withStats(player("Welitim Gomes", "ATT", 78, 77, 73, 69, 23), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_4x5ks1","rosterIdentity":"welitimgomes","rosterStatus":"verified","rosterSourceIds":["brazil-cap-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Capim FC","photoLeague":"brazil","photoName":"Welitim Gomes","shirtNumber":3}),
    withStats(player("Jader Vozinha", "MID", 78, 83, 73, 81, 28), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_ugoqle","rosterIdentity":"jadervozinha","rosterStatus":"verified","rosterSourceIds":["brazil-cap-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Capim FC","photoLeague":"brazil","photoName":"Jader Vozinha","shirtNumber":6}),
    withStats(player("Lucas 'Caroço'", "DEF", 75, 71, 82, 76, 25), {"overall":76,"value":57588,"matches":10,"ratingSum":65,"id":"roster_1y7r8xe","rosterIdentity":"lucascaroco","rosterStatus":"verified","rosterSourceIds":["brazil-cap-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Capim FC","photoLeague":"brazil","photoName":"Lucas \"Caroço\"","baselineOrigin":{"league":"brazil","teamId":"cap","name":"Lucas \"Caroço\""},"shirtNumber":7}),
    withStats(player("Caio Henrique", "MID", 79, 86, 73, 81, 29), {"overall":80,"value":68834,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1ij9njm","rosterIdentity":"caiohenrique","rosterStatus":"verified","rosterSourceIds":["brazil-cap-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Capim FC","photoLeague":"brazil","photoName":"Caio Henrique","shirtNumber":8}),
    withStats(player("Lucas Hector", "ATT", 90, 85, 82, 82, 24), {"overall":85,"value":86178,"goals":8,"assists":2,"matches":10,"ratingSum":72,"id":"roster_nwduau","rosterIdentity":"lucashector","rosterStatus":"verified","rosterSourceIds":["brazil-cap-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Capim FC","photoLeague":"brazil","photoName":"Lucas Hector","baselineOrigin":{"league":"brazil","teamId":"cap","name":"Lucas Hector"},"shirtNumber":10}),
    withStats(player("Matheus Gomes", "ATT", 81, 80, 76, 74, 25), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1e3ec5n","rosterIdentity":"matheusgomes","rosterStatus":"verified","rosterSourceIds":["brazil-cap-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Capim FC","photoLeague":"brazil","photoName":"Matheus Gomes","shirtNumber":11}),
    withStats(player("Marcos 'Bolivia'", "GK", 67, 73, 87, 87, 26), {"overall":79,"value":65810,"matches":10,"ratingSum":65,"id":"roster_71plhy","rosterIdentity":"marcosbolivia","rosterStatus":"verified","rosterSourceIds":["brazil-cap-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Capim FC","photoLeague":"brazil","photoName":"Marcos \"Bolivia\"","baselineOrigin":{"league":"brazil","teamId":"cap","name":"Marcos \"Bolivia\""},"shirtNumber":12}),
    withStats(player("Álex Guti", "DEF", 78, 74, 85, 79, 24), {"overall":79,"value":65810,"goals":3,"matches":8,"ratingSum":67.2,"id":"roster_ea0fhm","rosterIdentity":"alexguti","rosterStatus":"verified","rosterSourceIds":["brazil-cap-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Capim FC","photoLeague":"brazil","photoName":"Álex Guti","baselineOrigin":{"league":"brazil","teamId":"cap","name":"Álex Guti"},"shirtNumber":16}),
    withStats(player("Breno Arantes", "DEF", 74, 70, 81, 75, 26), {"overall":75,"value":55121,"goals":1,"matches":6,"ratingSum":47.4,"id":"roster_slpxtp","rosterIdentity":"brenoarantes","rosterStatus":"verified","rosterSourceIds":["brazil-cap-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Capim FC","photoLeague":"brazil","photoName":"Breno Arantes","baselineOrigin":{"league":"brazil","teamId":"cap","name":"Breno Arantes"},"shirtNumber":47}),
    withStats(player("Biel Moreira", "MID", 77, 82, 72, 80, 27), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_e9qqfq","rosterIdentity":"bielmoreira","rosterStatus":"verified","rosterSourceIds":["brazil-cap-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Capim FC","photoLeague":"brazil","photoName":"Biel Moreira","shirtNumber":80}),
    withStats(player("Heltinho Lima", "ATT", 85, 84, 75, 78, 28), {"overall":81,"value":72002,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1wovvi1","rosterIdentity":"heltinholima","rosterStatus":"verified","rosterSourceIds":["brazil-cap-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Capim FC","photoLeague":"brazil","photoName":"Heltinho Lima","shirtNumber":99}),
  ] },
  { ...{"id":"dpn","name":"DesimpaiN","color":"#b34a1f","budget":300000,"coach":"Felipe Góes","presidents":["Renato Vicente"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["brazil-dpn-squad"],"officialTeamId":168}, players: [
    withStats(player("Kaiky Souza", "GK", 65, 76, 97, 98, 22), {"overall":84,"value":82404,"matches":11,"ratingSum":71.5,"id":"roster_1lj3vr8","rosterIdentity":"kaikysouza","rosterStatus":"verified","rosterSourceIds":["brazil-dpn-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"DesimpaiN","photoLeague":"brazil","photoName":"Kaiky Souza","baselineOrigin":{"league":"brazil","teamId":"dpn","name":"Kaiky Souza"},"shirtNumber":1}),
    withStats(player("Victor 'Bolt'", "DEF", 81, 75, 86, 80, 24), {"overall":81,"value":72002,"goals":3,"assists":4,"matches":11,"ratingSum":77,"id":"roster_l5dq5l","rosterIdentity":"victorbolt","rosterStatus":"verified","rosterSourceIds":["brazil-dpn-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"DesimpaiN","photoLeague":"brazil","photoName":"Victor \"Bolt\"","baselineOrigin":{"league":"brazil","teamId":"dpn","name":"Victor \"Bolt\""},"shirtNumber":5}),
    withStats(player("Luisinho Alves", "ATT", 87, 82, 78, 79, 24), {"overall":82,"value":75318,"goals":10,"matches":11,"ratingSum":82.5,"id":"roster_1kaoux5","rosterIdentity":"luisinhoalves","rosterStatus":"verified","rosterSourceIds":["brazil-dpn-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"DesimpaiN","photoLeague":"brazil","photoName":"Luisinho Alves","baselineOrigin":{"league":"brazil","teamId":"dpn","name":"Luisinho Alves"},"shirtNumber":7}),
    withStats(player("Matheus Bueno", "MID", 77, 78, 73, 75, 24), {"overall":76,"value":57588,"id":"roster_acsy5l","rosterIdentity":"matheusbueno","rosterStatus":"verified","rosterSourceIds":["brazil-dpn-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dibrados FC","photoLeague":"brazil","photoName":"Matheus Bueno","baselineOrigin":{"league":"brazil","teamId":"dib","name":"Matheus Bueno"},"shirtNumber":8}),
    withStats(player("Douglinhas Melo", "ATT", 85, 78, 76, 75, 23), {"overall":79,"value":65810,"goals":1,"matches":4,"ratingSum":31.2,"id":"roster_bz6n6a","rosterIdentity":"douglinhasmelo","rosterStatus":"verified","rosterSourceIds":["brazil-dpn-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"DesimpaiN","photoLeague":"brazil","photoName":"Douglinhas Melo","baselineOrigin":{"league":"brazil","teamId":"dpn","name":"Douglinhas Melo"},"shirtNumber":9}),
    withStats(player("Lucas 'Lukinhas' Henrique", "MID", 75, 80, 69, 75, 24), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1n4v9f9","rosterIdentity":"lucaslukinhashenrique","rosterStatus":"verified","rosterSourceIds":["brazil-dpn-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"DesimpaiN","photoLeague":"brazil","photoName":"Lucas 'Lukinhas' Henrique","shirtNumber":11}),
    withStats(player("Gustavo Luiz", "GK", 59, 62, 80, 78, 23), {"overall":70,"value":44740,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1w0er9m","rosterIdentity":"gustavoluiz","rosterStatus":"verified","rosterSourceIds":["brazil-dpn-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"DesimpaiN","photoLeague":"brazil","photoName":"Gustavo Luiz","shirtNumber":12}),
    withStats(player("Danilo Alemão", "DEF", 77, 77, 73, 75, 25), {"overall":76,"value":57588,"goals":4,"assists":2,"matches":10,"ratingSum":70,"id":"roster_1nz7dix","rosterIdentity":"daniloalemao","rosterStatus":"verified","rosterSourceIds":["brazil-dpn-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"DesimpaiN","photoLeague":"brazil","photoName":"Danilo Alemão","baselineOrigin":{"league":"brazil","teamId":"dpn","name":"Danilo Alemão"},"shirtNumber":14}),
    withStats(player("Wellinton 'Gigante'", "DEF", 77, 74, 87, 80, 26), {"overall":80,"value":68834,"goals":5,"assists":1,"matches":11,"ratingSum":77,"id":"roster_wovzik","rosterIdentity":"wellintongigante","rosterStatus":"verified","rosterSourceIds":["brazil-dpn-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"DesimpaiN","photoLeague":"brazil","photoName":"Wellinton \"Gigante\"","baselineOrigin":{"league":"brazil","teamId":"dpn","name":"Wellinton \"Gigante\""},"shirtNumber":16}),
    withStats(player("David 'Brinquinho'", "MID", 72, 83, 74, 78, 21), {"overall":77,"value":60190,"goals":9,"assists":5,"matches":10,"id":"roster_1ed0x9q","rosterIdentity":"davidbrinquinho","rosterStatus":"verified","rosterSourceIds":["brazil-dpn-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"David 'Brinquinho'","baselineOrigin":{"league":"germany","teamId":"you","name":"David 'Brinquinho'"},"shirtNumber":20}),
    withStats(player("Nikxik Ribeiro", "ATT", 81, 80, 74, 73, 25), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1swa5xx","rosterIdentity":"nikxikribeiro","rosterStatus":"verified","rosterSourceIds":["brazil-dpn-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"DesimpaiN","photoLeague":"brazil","photoName":"Nikxik Ribeiro","shirtNumber":33}),
    withStats(player("Ryan Lima", "ATT", 86, 81, 78, 78, 24), {"overall":81,"value":72002,"matches":11,"ratingSum":82.5,"id":"roster_ws48sm","rosterIdentity":"ryanlima","rosterStatus":"verified","rosterSourceIds":["brazil-dpn-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"G3X FC","photoLeague":"brazil","photoName":"Ryan Lima","baselineOrigin":{"league":"brazil","teamId":"g3x","name":"Ryan Lima"},"shirtNumber":77}),
  ] },
  { ...{"id":"dib","name":"Dibrados FC","color":"#6a1b9a","budget":300000,"coach":"Silton Filho","presidents":["Allan Stag","Lucas Tylty"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["brazil-dib-squad"],"officialTeamId":220}, players: [
    withStats(player("Luan Teles", "GK", 69, 75, 88, 85, 26), {"overall":79,"value":65810,"matches":8,"ratingSum":54.4,"id":"roster_1la8xma","rosterIdentity":"luanteles","rosterStatus":"verified","rosterSourceIds":["brazil-dib-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dibrados FC","photoLeague":"brazil","photoName":"Luan Teles","baselineOrigin":{"league":"brazil","teamId":"dib","name":"Luan Teles"},"shirtNumber":1}),
    withStats(player("Filipinho Maia", "GK", 64, 66, 80, 79, 24), {"overall":72,"value":48512,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_iiqlsn","rosterIdentity":"filipinhomaia","rosterStatus":"verified","rosterSourceIds":["brazil-dib-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Dibrados FC","photoLeague":"brazil","photoName":"Filipinho Maia","shirtNumber":2}),
    withStats(player("Sidão Pages", "DEF", 75, 71, 81, 76, 25), {"overall":76,"value":57588,"goals":2,"matches":9,"ratingSum":58.5,"id":"roster_10hzlat","rosterIdentity":"sidaopages","rosterStatus":"verified","rosterSourceIds":["brazil-dib-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dibrados FC","photoLeague":"brazil","photoName":"Sidney Pages","baselineOrigin":{"league":"brazil","teamId":"dib","name":"Sidney Pages"},"shirtNumber":6}),
    withStats(player("Raphael Augusto", "MID", 73, 72, 71, 71, 21), {"overall":72,"value":48512,"matches":2,"ratingSum":13,"id":"roster_wg8b88","rosterIdentity":"raphaelaugusto","rosterStatus":"verified","rosterSourceIds":["brazil-dib-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dibrados FC","photoLeague":"brazil","photoName":"Raphael Augusto","baselineOrigin":{"league":"brazil","teamId":"dib","name":"Raphael Augusto"},"shirtNumber":7}),
    withStats(player("Well Andrade", "MID", 90, 87, 90, 87, 24), {"overall":89,"value":102877,"goals":17,"assists":4,"matches":11,"ratingSum":88,"id":"roster_10bqr3k","rosterIdentity":"wellandrade","rosterStatus":"verified","rosterSourceIds":["brazil-dib-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Fluxo FC","photoLeague":"brazil","photoName":"Well Andrade","baselineOrigin":{"league":"brazil","teamId":"flx","name":"Well Andrade"},"shirtNumber":8}),
    withStats(player("Gutinho Penha", "ATT", 85, 82, 76, 74, 27), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1yjcw47","rosterIdentity":"gutinhopenha","rosterStatus":"verified","rosterSourceIds":["brazil-dib-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Dibrados FC","photoLeague":"brazil","photoName":"Gutinho Penha","shirtNumber":9}),
    withStats(player("Luan 'Mestre'", "MID", 87, 88, 80, 85, 24), {"overall":85,"value":86178,"goals":19,"assists":5,"matches":11,"ratingSum":93.5,"id":"roster_jnrkll","rosterIdentity":"luanmestre","rosterStatus":"verified","rosterSourceIds":["brazil-dib-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Podpah Funkbol Clube","photoLeague":"brazil","photoName":"Luan \"Mestre\"","baselineOrigin":{"league":"brazil","teamId":"pod","name":"Luan \"Mestre\""},"shirtNumber":10}),
    withStats(player("Gabriel Costa", "ATT", 94, 94, 87, 92, 23), {"overall":92,"value":117151,"goals":5,"assists":3,"matches":9,"ratingSum":75.6,"id":"roster_cyff1v","rosterIdentity":"gabrielcosta","rosterStatus":"verified","rosterSourceIds":["brazil-dib-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Dibrados FC","photoLeague":"brazil","photoName":"Gabriel Costa","baselineOrigin":{"league":"brazil","teamId":"dib","name":"Gabriel Costa"},"shirtNumber":11}),
    withStats(player("Ton 'Spider'", "ATT", 90, 87, 83, 84, 24), {"overall":86,"value":90110,"goals":9,"assists":3,"matches":11,"ratingSum":81.4,"id":"roster_jjdb87","rosterIdentity":"tonspider","rosterStatus":"verified","rosterSourceIds":["brazil-dib-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"G3X FC","photoLeague":"brazil","photoName":"Ton \"Spider\"","baselineOrigin":{"league":"brazil","teamId":"g3x","name":"Ton \"Spider\""},"shirtNumber":12}),
    withStats(player("Rodrigo Sheik", "MID", 77, 79, 71, 77, 26), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_obez9t","rosterIdentity":"rodrigosheik","rosterStatus":"verified","rosterSourceIds":["brazil-dib-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Dibrados FC","photoLeague":"brazil","photoName":"Rodrigo Sheik","shirtNumber":19}),
    withStats(player("Daniel Ram", "DEF", 77, 73, 79, 74, 25), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_17cya1e","rosterIdentity":"danielram","rosterStatus":"verified","rosterSourceIds":["brazil-dib-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Dibrados FC","photoLeague":"brazil","photoName":"Daniel Ram","shirtNumber":26}),
    withStats(player("Matheus Rufino", "MID", 80, 79, 75, 76, 24), {"overall":78,"value":62930,"goals":1,"assists":2,"matches":11,"ratingSum":71.5,"id":"roster_lsfyp5","rosterIdentity":"matheusrufino","rosterStatus":"verified","rosterSourceIds":["brazil-dib-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"G3X FC","photoLeague":"brazil","photoName":"Matheus Rufino","baselineOrigin":{"league":"brazil","teamId":"g3x","name":"Matheus Rufino"},"shirtNumber":30}),
  ] },
];

const SPAIN_TEAMS = [
  { ...{"id":"1kf","name":"1K FC","color":"#6a3fa0","budget":300000,"coach":"Manuel Fernández","presidents":["Iker Casillas","Baptistao"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["es-team-1kf","es-index"]}, players: [
    withStats(player("Pol Lechuga", "GK", 61, 66, 75, 75, 18), {"overall":69,"value":43038,"matches":10,"id":"roster_nl2p1r","rosterIdentity":"pollechuga","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-1kf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Pol Lechuga","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Pol Lechuga"}}),
    withStats(player("M. Jiménez", "GK", 68, 66, 76, 79, 23), {"overall":72,"value":48512,"id":"roster_1hk9rug","rosterIdentity":"mjimenez","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"M. Jiménez","baselineOrigin":{"league":"spain","teamId":"1kf","name":"M. Jiménez"}}),
    withStats(player("Iván Rivera", "GK", 83, 82, 92, 95, 29), {"overall":88,"value":98457,"matches":6,"id":"roster_18yfoik","rosterIdentity":"ivanrivera","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-1kf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Iván Rivera","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Iván Rivera"}}),
    withStats(player("Michel Owono", "DEF", 69, 72, 82, 74, 22), {"overall":74,"value":52788,"goals":1,"assists":1,"matches":9,"id":"roster_6wpi87","rosterIdentity":"michelowono","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-1kf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Michel Owono","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Michel Owono"}}),
    withStats(player("Cristian Faura", "DEF", 88, 85, 96, 92, 35), {"overall":90,"value":107464,"goals":1,"assists":2,"matches":6,"id":"roster_t4mhdh","rosterIdentity":"cristianfaura","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-1kf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Cristian Faura","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Cristian Faura"}}),
    withStats(player("Karim Moya", "DEF", 73, 70, 88, 83, 34), {"overall":79,"value":65810,"goals":1,"assists":4,"matches":11,"id":"roster_ywdgbh","rosterIdentity":"karimmoya","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-1kf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Karim Moya","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Karim Moya"}}),
    withStats(player("Pau 'ZZ' Ruiz", "DEF", 76, 67, 76, 79, 26), {"overall":75,"value":55121,"goals":3,"assists":2,"matches":7,"id":"roster_tpaeor","rosterIdentity":"pauzzruiz","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-1kf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Pau 'ZZ' Ruiz","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Pau 'ZZ' Ruiz"}}),
    withStats(player("Achraf Laiti", "DEF", 83, 83, 92, 88, 18), {"overall":87,"value":94202,"goals":2,"matches":11,"id":"roster_zrc87p","rosterIdentity":"achraflaiti","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-1kf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Achraf Laiti","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Achraf Laiti"}}),
    withStats(player("Guelmi Pons", "DEF", 80, 82, 87, 83, 23), {"overall":83,"value":78785,"matches":6,"id":"roster_1nzpdic","rosterIdentity":"guelmipons","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-1kf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Guelmi Pons","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Guelmi Pons"}}),
    withStats(player("Erik Beattie", "MID", 79, 85, 75, 82, 26), {"overall":80,"value":68834,"goals":1,"assists":1,"matches":11,"id":"roster_1w0tr3o","rosterIdentity":"erikbeattie","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-1kf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Erik Beattie","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Erik Beattie"}}),
    withStats(player("Joel Navas", "MID", 94, 97, 82, 92, 31), {"overall":91,"value":112221,"matches":10,"id":"roster_19wx2gg","rosterIdentity":"joelnavas","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-1kf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Joel Navas","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Joel Navas"}}),
    withStats(player("Jordi Ros", "MID", 78, 80, 74, 77, 24), {"overall":77,"value":60190,"id":"roster_jzwj85","rosterIdentity":"jordiros","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Jordi Ros","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Jordi Ros"}}),
    withStats(player("Eric Jiménez", "ATT", 81, 77, 69, 69, 28), {"overall":74,"value":52788,"matches":1,"id":"roster_mpciaq","rosterIdentity":"ericjimenez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-1kf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Eric Jiménez","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Eric Jiménez"},"registrationType":"wildcard"}),
    withStats(player("Isma Reguia", "ATT", 82, 87, 83, 73, 26), {"overall":81,"value":72002,"goals":5,"assists":1,"matches":11,"id":"roster_ut1wzo","rosterIdentity":"ismareguia","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-1kf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Isma Reguia","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Isma Reguia"}}),
    withStats(player("Joel Paredes", "ATT", 93, 93, 81, 87, 33), {"overall":89,"value":102877,"goals":5,"assists":1,"matches":11,"id":"roster_1s6qldf","rosterIdentity":"joelparedes","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-1kf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Joel Paredes","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Joel Paredes"}}),
    withStats(player("Gerard Verge", "MID", 63, 74, 66, 69, 21), {"overall":68,"value":41457,"goals":19,"assists":10,"matches":10,"id":"roster_ytebz3","rosterIdentity":"gerardverge","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-1kf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Gerard Verge","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Gerard Verge"}}),
    withStats(player("Pol Requena", "ATT", 82, 88, 74, 73, 26), {"overall":79,"value":65810,"goals":2,"matches":2,"id":"roster_6acenr","rosterIdentity":"polrequena","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-1kf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"1K FC","photoLeague":"spain","photoName":"Pol Requena","baselineOrigin":{"league":"spain","teamId":"1kf","name":"Pol Requena"},"registrationType":"wildcard"}),
  ] },
  { ...{"id":"ebr","name":"El Barrio","color":"#c0392b","budget":300000,"coach":"Xavi Corominas","presidents":["Adri Contreras"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["es-team-ebr","es-index"]}, players: [
    withStats(player("Sergio Fernández", "GK", 64, 64, 82, 76, 20), {"overall":72,"value":48512,"matches":10,"id":"roster_24pher","rosterIdentity":"sergiofernandez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Sergio Fernández Ortiz","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Sergio Fernández Ortiz"}}),
    withStats(player("Hugo Eyre", "GK", 74, 80, 89, 90, 28), {"overall":83,"value":78785,"matches":5,"id":"roster_jt32cj","rosterIdentity":"hugoeyre","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Hugo Eyre","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Hugo Eyre"}}),
    withStats(player("Marçal Ros", "GK", 74, 77, 88, 82, 29), {"overall":80,"value":68834,"id":"roster_1x5a46v","rosterIdentity":"marcalros","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Marçal Ros","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Marçal Ros"},"registrationType":"wildcard"}),
    withStats(player("Joel Bañuls", "DEF", 70, 75, 85, 75, 25), {"overall":76,"value":57588,"goals":10,"assists":2,"matches":13,"id":"roster_pyg4t6","rosterIdentity":"joelbanuls","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Joel Bañuls","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Joel Bañuls"}}),
    withStats(player("Robert Vallribera", "ATT", 74, 82, 88, 79, 22), {"overall":81,"value":72002,"id":"roster_nry0nh","rosterIdentity":"robertvallribera","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Robert Vallribera","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Robert Vallribera"}}),
    withStats(player("Sergio Herrero", "DEF", 70, 69, 78, 80, 28), {"overall":74,"value":52788,"goals":2,"matches":13,"id":"roster_18y81yr","rosterIdentity":"sergioherrero","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Herrero","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Herrero"}}),
    withStats(player("Carlos Val", "DEF", 84, 90, 94, 87, 27), {"overall":89,"value":102877,"goals":1,"assists":4,"matches":12,"id":"roster_1yo7r74","rosterIdentity":"carlosval","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Carlos Val","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Carlos Val"}}),
    withStats(player("Martín Mantovani", "DEF", 69, 79, 84, 85, 34), {"overall":79,"value":65810,"id":"roster_19v4hp7","rosterIdentity":"martinmantovani","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Martín Mantovani","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Martín Mantovani"}}),
    withStats(player("Pol Molés", "MID", 83, 82, 75, 79, 26), {"overall":80,"value":68834,"goals":7,"assists":4,"matches":13,"id":"roster_au8zs4","rosterIdentity":"polmoles","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Pol Molés","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Pol Molés"}}),
    withStats(player("Ñito Martín", "MID", 77, 84, 80, 80, 25), {"overall":80,"value":68834,"matches":12,"id":"roster_k5gpkq","rosterIdentity":"nitomartin","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Ñito Martín","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Ñito Martín"}}),
    withStats(player("Pablo Saborido", "MID", 79, 82, 70, 75, 21), {"overall":77,"value":60190,"goals":1,"assists":3,"matches":11,"id":"roster_1mklmm2","rosterIdentity":"pablosaborido","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Pablo Saborido","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Pablo Saborido"}}),
    withStats(player("Raúl Inocencio", "ATT", 77, 84, 70, 80, 29), {"overall":78,"value":62930,"goals":1,"matches":2,"id":"roster_v6fy5o","rosterIdentity":"raulinocencio","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Raúl Inocencio","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Raúl Inocencio"}}),
    withStats(player("Gerard Puigvert", "MID", 82, 76, 90, 81, 27), {"overall":82,"value":75318,"goals":1,"assists":6,"matches":10,"id":"roster_sog2am","rosterIdentity":"gerardpuigvert","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Gerard Puigvert","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Gerard Puigvert"}}),
    withStats(player("Valentín Merchán", "MID", 78, 81, 75, 78, 24), {"overall":78,"value":62930,"id":"roster_1v9q9zy","rosterIdentity":"valentinmerchan","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Valentín Merchán","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Valentín Merchán"}}),
    withStats(player("Marc Pérez", "ATT", 83, 76, 74, 74, 20), {"overall":77,"value":60190,"matches":1,"id":"roster_ndlmj0","rosterIdentity":"marcperez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Marc Pérez","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Marc Pérez"},"registrationType":"wildcard"}),
    withStats(player("Haitam Babia", "ATT", 79, 79, 68, 64, 23), {"overall":73,"value":50586,"goals":1,"matches":5,"id":"roster_tc4r20","rosterIdentity":"haitambabia","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Haitam Babia","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Haitam Babia"}}),
    withStats(player("Cristian Ubón", "MID", 89, 91, 80, 82, 18), {"overall":86,"value":90110,"goals":15,"assists":1,"matches":13,"id":"roster_1kitxsu","rosterIdentity":"cristianubon","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Cristian Ubón","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Cristian Ubón"}}),
    withStats(player("Naoufal Talkam", "ATT", 70, 70, 68, 65, 21), {"overall":68,"value":41457,"goals":3,"assists":1,"matches":5,"id":"roster_1jn05yb","rosterIdentity":"naoufaltalkam","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Naoufal Talkam","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Naoufal Talkam"},"registrationType":"wildcard"}),
    withStats(player("Pau Fernández", "ATT", 90, 93, 89, 76, 25), {"overall":87,"value":94202,"goals":9,"assists":2,"matches":13,"id":"roster_1ri12li","rosterIdentity":"paufernandez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ebr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"El Barrio","photoLeague":"spain","photoName":"Pau Fernández","baselineOrigin":{"league":"spain","teamId":"ebr","name":"Pau Fernández"}}),
  ] },
  { ...{"id":"jig","name":"Jijantes FC","color":"#6d1b3a","budget":300000,"coach":"David Biosca","presidents":["Gerard Romero"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["es-team-jig","es-index"]}, players: [
    withStats(player("Mario León", "GK", 73, 76, 88, 86, 21), {"overall":81,"value":72002,"matches":6,"id":"roster_scndgp","rosterIdentity":"marioleon","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"Mario León","baselineOrigin":{"league":"spain","teamId":"jig","name":"Mario León"}}),
    withStats(player("José Segovia", "GK", 87, 83, 97, 90, 29), {"overall":89,"value":102877,"matches":10,"id":"roster_12g2kms","rosterIdentity":"josesegovia","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"José Segovia","baselineOrigin":{"league":"spain","teamId":"jig","name":"José Segovia"}}),
    withStats(player("Víctor Pérez Bello", "DEF", 90, 87, 93, 89, 24), {"overall":90,"value":107464,"goals":3,"assists":2,"matches":9,"id":"roster_yophe4","rosterIdentity":"victorperezbello","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"Víctor Pérez Bello","baselineOrigin":{"league":"spain","teamId":"jig","name":"Víctor Pérez Bello"}}),
    withStats(player("Dani Martí", "DEF", 75, 75, 82, 82, 23), {"overall":79,"value":65810,"goals":1,"matches":11,"id":"roster_xiaky2","rosterIdentity":"danimarti","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"Dani Martí","baselineOrigin":{"league":"spain","teamId":"jig","name":"Dani Martí"}}),
    withStats(player("Ion Vázquez", "DEF", 64, 67, 77, 72, 22), {"overall":70,"value":44740,"matches":5,"id":"roster_1f9aj2v","rosterIdentity":"ionvazquez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"Ion Vázquez","baselineOrigin":{"league":"spain","teamId":"jig","name":"Ion Vázquez"}}),
    withStats(player("Iker Hernández", "DEF", 87, 82, 97, 94, 27), {"overall":90,"value":107464,"assists":1,"matches":8,"id":"roster_1glon3p","rosterIdentity":"ikerhernandez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"Iker Hernández","baselineOrigin":{"league":"spain","teamId":"jig","name":"Iker Hernández"}}),
    withStats(player("Michel Herrero", "MID", 87, 85, 81, 86, 20), {"overall":85,"value":86178,"goals":1,"matches":5,"id":"roster_1peoiqa","rosterIdentity":"michelherrero","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"Michel Herrero","baselineOrigin":{"league":"spain","teamId":"jig","name":"Michel Herrero"}}),
    withStats(player("Pau Fer", "MID", 88, 95, 90, 97, 33), {"overall":93,"value":122256,"goals":4,"assists":2,"matches":11,"id":"roster_2b9dre","rosterIdentity":"paufer","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"Pau Fernández","baselineOrigin":{"league":"spain","teamId":"jig","name":"Pau Fernández"}}),
    withStats(player("Cristian Gómez", "MID", 85, 86, 78, 85, 22), {"overall":84,"value":82404,"matches":2,"id":"roster_1qvgj0m","rosterIdentity":"cristiangomez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"Cristian Gómez","baselineOrigin":{"league":"spain","teamId":"jig","name":"Cristian Gómez"},"registrationType":"wildcard"}),
    withStats(player("Daniel Plaza", "MID", 76, 80, 68, 71, 20), {"overall":74,"value":52788,"assists":1,"matches":8,"id":"roster_lkff50","rosterIdentity":"danielplaza","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"Daniel Plaza","baselineOrigin":{"league":"spain","teamId":"jig","name":"Daniel Plaza"}}),
    withStats(player("Cristian Lobato", "MID", 88, 89, 81, 78, 27), {"overall":84,"value":82404,"goals":8,"assists":2,"matches":11,"id":"roster_a2npfp","rosterIdentity":"cristianlobato","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"Cristian Lobato","baselineOrigin":{"league":"spain","teamId":"jig","name":"Cristian Lobato"}}),
    withStats(player("Álex Cañero", "ATT", 84, 88, 81, 75, 29), {"overall":82,"value":75318,"goals":1,"assists":1,"matches":9,"id":"roster_f3kkbf","rosterIdentity":"alexcanero","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"Alex Cañero","baselineOrigin":{"league":"spain","teamId":"jig","name":"Alex Cañero"}}),
    withStats(player("Marc Montejo", "ATT", 74, 80, 68, 65, 26), {"overall":72,"value":48512,"matches":6,"id":"roster_z9iyvy","rosterIdentity":"marcmontejo","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"Marc Montejo","baselineOrigin":{"league":"spain","teamId":"jig","name":"Marc Montejo"},"registrationType":"wildcard"}),
    withStats(player("David Toro", "ATT", 80, 71, 71, 65, 27), {"overall":72,"value":48512,"goals":1,"matches":6,"id":"roster_1wyjn0v","rosterIdentity":"davidtoro","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"David Toro","baselineOrigin":{"league":"spain","teamId":"jig","name":"David Toro"}}),
    withStats(player("Juanpe Nzo", "MID", 85, 80, 73, 69, 18), {"overall":77,"value":60190,"goals":1,"assists":1,"matches":10,"id":"roster_1306j7p","rosterIdentity":"juanpenzo","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"Juanpe Nzo","baselineOrigin":{"league":"spain","teamId":"jig","name":"Juanpe Nzo"}}),
    withStats(player("Sergi Torres", "ATT", 66, 75, 69, 73, 22), {"overall":71,"value":46564,"goals":13,"assists":4,"matches":10,"id":"roster_1vm4rn0","rosterIdentity":"sergitorres","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-jig"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"Sergi Torres","baselineOrigin":{"league":"spain","teamId":"jig","name":"Sergi Torres"}}),
    withStats(player("Ton Alcover", "ATT", 84, 82, 77, 76, 25), {"overall":80,"value":68834,"id":"roster_1ky574q","rosterIdentity":"tonalcover","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Jijantes FC","photoLeague":"spain","photoName":"Ton Alcover","baselineOrigin":{"league":"spain","teamId":"jig","name":"Ton Alcover"}}),
  ] },
  { ...{"id":"lcc","name":"La Capital CF","color":"#d6417e","budget":300000,"coach":"Arnau Jariod","presidents":["Lamine Yamal","La Cobra"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["es-team-lcc","es-index"]}, players: [
    withStats(player("Roger García", "GK", 73, 72, 83, 83, 28), {"overall":78,"value":62930,"matches":1,"id":"roster_1wp3j7x","rosterIdentity":"rogergarcia","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-lcc"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"La Capital CF","photoLeague":"spain","photoName":"Roger García","baselineOrigin":{"league":"spain","teamId":"lcc","name":"Roger García"},"registrationType":"wildcard"}),
    withStats(player("Manel Jiménez", "GK", 62, 64, 73, 75, 27), {"overall":69,"value":43038,"matches":1,"id":"roster_104y1ti","rosterIdentity":"maneljimenez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-lcc"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"La Capital CF","photoLeague":"spain","photoName":"Manel Jiménez","baselineOrigin":{"league":"spain","teamId":"lcc","name":"Manel Jiménez"}}),
    withStats(player("Sergi Vives", "DEF", 86, 89, 90, 88, 18), {"overall":88,"value":98457,"matches":2,"id":"roster_t00de2","rosterIdentity":"sergivives","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-lcc"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"La Capital CF","photoLeague":"spain","photoName":"Sergi Vives","baselineOrigin":{"league":"spain","teamId":"lcc","name":"Sergi Vives"}}),
    withStats(player("Mario Victorio", "DEF", 71, 70, 83, 76, 29), {"overall":75,"value":55121,"matches":1,"id":"roster_138zv5s","rosterIdentity":"mariovictorio","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-lcc"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"La Capital CF","photoLeague":"spain","photoName":"Mario Victorio","baselineOrigin":{"league":"spain","teamId":"lcc","name":"Mario Victorio"}}),
    withStats(player("Daniel Pérez", "DEF", 76, 79, 74, 72, 21), {"overall":75,"value":55121,"matches":2,"id":"roster_catgy2","rosterIdentity":"danielperez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-lcc"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"La Capital CF","photoLeague":"spain","photoName":"Daniel Pérez","baselineOrigin":{"league":"spain","teamId":"lcc","name":"Daniel Pérez"}}),
    withStats(player("Julen Álvarez", "ATT", 72, 74, 61, 66, 19), {"overall":68,"value":41457,"assists":2,"matches":2,"id":"roster_azw5j0","rosterIdentity":"julenalvarez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-lcc"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"La Capital CF","photoLeague":"spain","photoName":"Julen Álvarez","baselineOrigin":{"league":"spain","teamId":"lcc","name":"Julen Álvarez"}}),
    withStats(player("Sohaib Rektout", "MID", 84, 86, 86, 93, 27), {"overall":87,"value":94202,"goals":2,"assists":2,"matches":2,"id":"roster_1x61a0j","rosterIdentity":"sohaibrektout","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-lcc"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"La Capital CF","photoLeague":"spain","photoName":"Sohaib Rektout","baselineOrigin":{"league":"spain","teamId":"lcc","name":"Sohaib Rektout"}}),
    withStats(player("Iñaki Villalba", "MID", 67, 75, 72, 67, 19), {"overall":70,"value":44740,"matches":2,"id":"roster_1qa76ug","rosterIdentity":"inakivillalba","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-lcc"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"La Capital CF","photoLeague":"spain","photoName":"Iñaki Villalba","baselineOrigin":{"league":"spain","teamId":"lcc","name":"Iñaki Villalba"}}),
    withStats(player("Daouda Bamma", "MID", 80, 79, 74, 78, 23), {"overall":78,"value":62930,"matches":2,"id":"roster_1epsusl","rosterIdentity":"daoudabamma","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-lcc"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"La Capital CF","photoLeague":"spain","photoName":"Daouda Bamma","baselineOrigin":{"league":"spain","teamId":"lcc","name":"Daouda Bamma"}}),
    withStats(player("Antoni Hernández", "ATT", 96, 94, 85, 90, 31), {"overall":91,"value":112221,"goals":2,"matches":2,"id":"roster_r1zisp","rosterIdentity":"antonihernandez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-lcc"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"La Capital CF","photoLeague":"spain","photoName":"Antoni Hernández","baselineOrigin":{"league":"spain","teamId":"lcc","name":"Antoni Hernández"}}),
    withStats(player("Omar Dambelleh", "ATT", 94, 88, 86, 81, 25), {"overall":87,"value":94202,"goals":1,"matches":2,"id":"roster_qp48ec","rosterIdentity":"omardambelleh","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-lcc"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"La Capital CF","photoLeague":"spain","photoName":"Omar Dambelleh","baselineOrigin":{"league":"spain","teamId":"lcc","name":"Omar Dambelleh"}}),
  ] },
  { ...{"id":"ltf","name":"Los Troncos FC","color":"#2f8f3f","budget":300000,"coach":"Eric Bartra","presidents":["Jaume Cremades"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["es-team-ltf","es-index"]}, players: [
    withStats(player("Eloy Amoedo", "GK", 67, 60, 71, 70, 20), {"overall":67,"value":39993,"matches":4,"id":"roster_1gx69x7","rosterIdentity":"eloyamoedo","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ltf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Troncos FC","photoLeague":"spain","photoName":"Eloy Amoedo","baselineOrigin":{"league":"spain","teamId":"ltf","name":"Eloy Amoedo"}}),
    withStats(player("Yaroslav Toporkov", "GK", 70, 79, 85, 82, 32), {"overall":79,"value":65810,"id":"roster_1h2pjt6","rosterIdentity":"yaroslavtoporkov","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ltf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Troncos FC","photoLeague":"spain","photoName":"Yaroslav Toporkov","baselineOrigin":{"league":"spain","teamId":"ltf","name":"Yaroslav Toporkov"}}),
    withStats(player("Alex Cubedo", "DEF", 76, 66, 82, 80, 23), {"overall":76,"value":57588,"matches":3,"id":"roster_szmxcp","rosterIdentity":"alexcubedo","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ltf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Troncos FC","photoLeague":"spain","photoName":"Álex Cubedo","baselineOrigin":{"league":"spain","teamId":"ltf","name":"Álex Cubedo"}}),
    withStats(player("Sagar Escoto", "DEF", 79, 77, 89, 80, 25), {"overall":81,"value":72002,"matches":4,"id":"roster_12q1ig2","rosterIdentity":"sagarescoto","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ltf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Troncos FC","photoLeague":"spain","photoName":"Sagar Escoto","baselineOrigin":{"league":"spain","teamId":"ltf","name":"Sagar Escoto"}}),
    withStats(player("Daniel Tamayo", "DEF", 63, 64, 76, 75, 21), {"overall":70,"value":44740,"id":"roster_cyvq5j","rosterIdentity":"danieltamayo","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Troncos FC","photoLeague":"spain","photoName":"Daniel Tamayo","baselineOrigin":{"league":"spain","teamId":"ltf","name":"Daniel Tamayo"}}),
    withStats(player("Víctor Oribe", "MID", 80, 84, 79, 82, 33), {"overall":81,"value":72002,"matches":4,"id":"roster_1181ipf","rosterIdentity":"victororibe","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Troncos FC","photoLeague":"spain","photoName":"Víctor Oribe","baselineOrigin":{"league":"spain","teamId":"ltf","name":"Víctor Oribe"}}),
    withStats(player("David Reyes", "MID", 78, 81, 72, 74, 25), {"overall":76,"value":57588,"assists":2,"matches":4,"id":"roster_xdeukz","rosterIdentity":"davidreyes","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ltf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Troncos FC","photoLeague":"spain","photoName":"David Reyes","baselineOrigin":{"league":"spain","teamId":"ltf","name":"David Reyes"}}),
    withStats(player("Álvaro Arché", "ATT", 68, 79, 72, 71, 23), {"overall":73,"value":50586,"assists":1,"matches":4,"id":"roster_18hqn8l","rosterIdentity":"alvaroarche","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ltf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Troncos FC","photoLeague":"spain","photoName":"Álvaro Arché","baselineOrigin":{"league":"spain","teamId":"ltf","name":"Álvaro Arché"}}),
    withStats(player("Carlos Contreras", "ATT", 97, 96, 87, 89, 27), {"overall":92,"value":117151,"matches":4,"id":"roster_us1imm","rosterIdentity":"carloscontreras","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ltf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Troncos FC","photoLeague":"spain","photoName":"Carlos Contreras","baselineOrigin":{"league":"spain","teamId":"ltf","name":"Carlos Contreras"}}),
    withStats(player("Mark Sorroche", "MID", 80, 83, 78, 75, 32), {"overall":79,"value":65810,"goals":4,"assists":2,"matches":4,"id":"roster_lkyj5r","rosterIdentity":"marksorroche","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ltf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Troncos FC","photoLeague":"spain","photoName":"Mark Sorroche","baselineOrigin":{"league":"spain","teamId":"ltf","name":"Mark Sorroche"}}),
    withStats(player("Masi Dabo", "ATT", 82, 87, 75, 78, 23), {"overall":81,"value":72002,"goals":1,"matches":4,"id":"roster_wsmg2n","rosterIdentity":"masidabo","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-ltf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Troncos FC","photoLeague":"spain","photoName":"Masi Dabo","baselineOrigin":{"league":"spain","teamId":"ltf","name":"Masi Dabo"}}),
  ] },
  { ...{"id":"pio","name":"PIO FC","color":"#d4711f","budget":300000,"coach":"Pol Font","presidents":["Samantha Rivera"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["es-team-pio","es-index"]}, players: [
    withStats(player("Víctor Montoya", "GK", 60, 67, 68, 74, 26), {"overall":67,"value":39993,"matches":3,"id":"roster_1jfd0fb","rosterIdentity":"victormontoya","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Víctor Montoya","baselineOrigin":{"league":"spain","teamId":"pio","name":"Víctor Montoya"},"registrationType":"wildcard"}),
    withStats(player("Iker Bartolomé", "GK", 70, 77, 89, 89, 27), {"overall":81,"value":72002,"matches":10,"id":"roster_1j0plzd","rosterIdentity":"ikerbartolome","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Iker Bartolomé","baselineOrigin":{"league":"spain","teamId":"pio","name":"Iker Bartolomé"}}),
    withStats(player("Marc Briones", "GK", 78, 82, 89, 93, 26), {"overall":86,"value":90110,"matches":5,"id":"roster_1dszdc2","rosterIdentity":"marcbriones","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Marc Briones","baselineOrigin":{"league":"spain","teamId":"pio","name":"Marc Briones"}}),
    withStats(player("Manel Beneite", "DEF", 72, 65, 82, 70, 28), {"overall":72,"value":48512,"goals":1,"matches":4,"id":"roster_srg06a","rosterIdentity":"manelbeneite","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Manel Beneite","baselineOrigin":{"league":"spain","teamId":"pio","name":"Manel Beneite"},"registrationType":"wildcard"}),
    withStats(player("Gabriel Cichero", "DEF", 89, 84, 93, 89, 23), {"overall":89,"value":102877,"matches":1,"id":"roster_1ftfdu6","rosterIdentity":"gabrielcichero","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Gabriel Cichero","baselineOrigin":{"league":"spain","teamId":"pio","name":"Gabriel Cichero"},"registrationType":"wildcard"}),
    withStats(player("Adrián Frutos", "DEF", 76, 80, 82, 78, 29), {"overall":79,"value":65810,"goals":2,"assists":3,"matches":11,"id":"roster_hbcdm9","rosterIdentity":"adrianfrutos","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Adrián Frutos","baselineOrigin":{"league":"spain","teamId":"pio","name":"Adrián Frutos"}}),
    withStats(player("Joan Luque", "DEF", 85, 88, 82, 73, 23), {"overall":82,"value":75318,"goals":7,"assists":2,"matches":12,"id":"roster_1kzylhb","rosterIdentity":"joanluque","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Joan Luque","baselineOrigin":{"league":"spain","teamId":"pio","name":"Joan Luque"}}),
    withStats(player("Marc Grifell", "DEF", 92, 92, 82, 87, 18), {"overall":88,"value":98457,"matches":5,"id":"roster_mfo9tt","rosterIdentity":"marcgrifell","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Marc Grifell","baselineOrigin":{"league":"spain","teamId":"pio","name":"Marc Grifell"}}),
    withStats(player("Marcel García", "DEF", 80, 88, 78, 75, 21), {"overall":80,"value":68834,"matches":1,"id":"roster_1pwg290","rosterIdentity":"marcelgarcia","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Marcel García","baselineOrigin":{"league":"spain","teamId":"pio","name":"Marcel García"},"registrationType":"wildcard"}),
    withStats(player("Álex Sánchez", "MID", 91, 93, 90, 91, 18), {"overall":91,"value":112221,"matches":9,"id":"roster_1s9rakh","rosterIdentity":"alexsanchez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Álex Sánchez","baselineOrigin":{"league":"spain","teamId":"pio","name":"Álex Sánchez"}}),
    withStats(player("Fernando Velillas", "MID", 86, 86, 84, 75, 26), {"overall":83,"value":78785,"goals":1,"assists":2,"matches":6,"id":"roster_190tsy8","rosterIdentity":"fernandovelillas","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Fernando Velillas","baselineOrigin":{"league":"spain","teamId":"pio","name":"Fernando Velillas"}}),
    withStats(player("Marcos Ibañez", "MID", 85, 89, 84, 83, 30), {"overall":85,"value":86178,"goals":3,"assists":2,"matches":6,"id":"roster_as8pzx","rosterIdentity":"marcosibanez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Marcos Ibañez","baselineOrigin":{"league":"spain","teamId":"pio","name":"Marcos Ibañez"}}),
    withStats(player("Pol Benito", "MID", 80, 81, 68, 69, 35), {"overall":75,"value":55121,"goals":1,"assists":1,"matches":12,"id":"roster_18punap","rosterIdentity":"polbenito","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Pol Benito","baselineOrigin":{"league":"spain","teamId":"pio","name":"Pol Benito"}}),
    withStats(player("Aarón Ropero", "MID", 82, 85, 78, 80, 24), {"overall":81,"value":72002,"id":"roster_i2ihhd","rosterIdentity":"aaronropero","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Aarón Ropero","baselineOrigin":{"league":"spain","teamId":"pio","name":"Aarón Ropero"}}),
    withStats(player("Sergio Mulero", "ATT", 86, 88, 81, 76, 35), {"overall":83,"value":78785,"goals":1,"matches":9,"id":"roster_12rvu2w","rosterIdentity":"sergiomulero","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Sergio Mulero","baselineOrigin":{"league":"spain","teamId":"pio","name":"Sergio Mulero"}}),
    withStats(player("Yeray Muñoz", "ATT", 88, 90, 80, 86, 27), {"overall":86,"value":90110,"goals":6,"assists":3,"matches":12,"id":"roster_gmxcve","rosterIdentity":"yeraymunoz","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Yeray Muñoz","baselineOrigin":{"league":"spain","teamId":"pio","name":"Yeray Muñoz"}}),
    withStats(player("Izan Grande", "ATT", 67, 74, 61, 64, 29), {"overall":67,"value":39993,"goals":1,"matches":2,"id":"roster_yxbsts","rosterIdentity":"izangrande","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-pio"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Izan Grande","baselineOrigin":{"league":"spain","teamId":"pio","name":"Izan Grande"}}),
  ] },
  { ...{"id":"por","name":"Porcinos FC","color":"#c23b8a","budget":300000,"coach":"Narcís Barrera","presidents":["Ibai Llanos","Guanyar"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["es-team-por","es-index"]}, players: [
    withStats(player("Dani Pérez", "GK", 69, 61, 75, 74, 29), {"overall":70,"value":44740,"matches":2,"id":"roster_zxe5nh","rosterIdentity":"daniperez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-por"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Porcinos FC","photoLeague":"spain","photoName":"Dani Pérez","baselineOrigin":{"league":"spain","teamId":"por","name":"Dani Pérez"}}),
    withStats(player("Victor Rodríguez", "GK", 87, 84, 96, 95, 26), {"overall":91,"value":112221,"id":"roster_1x3uhe1","rosterIdentity":"victorrodriguez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-por"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Porcinos FC","photoLeague":"spain","photoName":"Victor Rodríguez","baselineOrigin":{"league":"spain","teamId":"por","name":"Victor Rodríguez"}}),
    withStats(player("David Soriano", "DEF", 75, 79, 87, 87, 21), {"overall":82,"value":75318,"matches":2,"id":"roster_14suwty","rosterIdentity":"davidsoriano","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-por"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Porcinos FC","photoLeague":"spain","photoName":"David Soriano","baselineOrigin":{"league":"spain","teamId":"por","name":"David Soriano"}}),
    withStats(player("Aitor Vives", "DEF", 78, 76, 84, 79, 22), {"overall":79,"value":65810,"id":"roster_1sdy43l","rosterIdentity":"aitorvives","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Porcinos FC","photoLeague":"spain","photoName":"Aitor Vives","baselineOrigin":{"league":"spain","teamId":"por","name":"Aitor Vives"}}),
    withStats(player("Fouad El Amrani", "MID", 93, 97, 85, 97, 22), {"overall":93,"value":122256,"goals":1,"matches":2,"id":"roster_jyk67j","rosterIdentity":"fouadelamrani","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-por"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Porcinos FC","photoLeague":"spain","photoName":"Fouad El Amrani","baselineOrigin":{"league":"spain","teamId":"por","name":"Fouad El Amrani"}}),
    withStats(player("Franc Samaniego", "MID", 66, 72, 71, 72, 25), {"overall":70,"value":44740,"matches":1,"id":"roster_179dpkp","rosterIdentity":"francsamaniego","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-por"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Porcinos FC","photoLeague":"spain","photoName":"Franc Samaniego","baselineOrigin":{"league":"spain","teamId":"por","name":"Franc Samaniego"}}),
    withStats(player("Marc Pelaz", "MID", 74, 71, 65, 77, 24), {"overall":72,"value":48512,"goals":1,"matches":2,"id":"roster_2scola","rosterIdentity":"marcpelaz","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-por"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Porcinos FC","photoLeague":"spain","photoName":"Marc Pelaz","baselineOrigin":{"league":"spain","teamId":"por","name":"Marc Pelaz"}}),
    withStats(player("Oscar Coll", "MID", 70, 72, 64, 76, 25), {"overall":71,"value":46564,"matches":2,"id":"roster_kz0zxt","rosterIdentity":"oscarcoll","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-por"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Porcinos FC","photoLeague":"spain","photoName":"Óscar Coll","baselineOrigin":{"league":"spain","teamId":"por","name":"Óscar Coll"}}),
    withStats(player("Edgar Alvaro", "ATT", 71, 74, 71, 68, 24), {"overall":71,"value":46564,"matches":2,"id":"roster_1bd96al","rosterIdentity":"edgaralvaro","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-por"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Porcinos FC","photoLeague":"spain","photoName":"Edgar Álvaro","baselineOrigin":{"league":"spain","teamId":"por","name":"Edgar Álvaro"}}),
    withStats(player("Roger Carbó", "ATT", 93, 87, 90, 84, 26), {"overall":89,"value":102877,"goals":1,"matches":2,"id":"roster_w284t5","rosterIdentity":"rogercarbo","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-por"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Porcinos FC","photoLeague":"spain","photoName":"Roger Carbó","baselineOrigin":{"league":"spain","teamId":"por","name":"Roger Carbó"}}),
  ] },
  { ...{"id":"rdb","name":"Rayo de Barcelona","color":"#f0c419","budget":300000,"coach":"Robert Cornfield","presidents":["Martí Miràs","Jova"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["es-team-rdb","es-index"]}, players: [
    withStats(player("Jorge Ibáñez", "GK", 79, 78, 92, 92, 18), {"overall":85,"value":86178,"matches":10,"id":"roster_5kyn2j","rosterIdentity":"jorgeibanez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-rdb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Jorge Ibáñez","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Jorge Ibáñez"}}),
    withStats(player("David Moreno", "GK", 69, 69, 79, 80, 22), {"overall":74,"value":52788,"matches":14,"id":"roster_197wp87","rosterIdentity":"davidmoreno","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-rdb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"David Moreno","baselineOrigin":{"league":"spain","teamId":"rdb","name":"David Moreno"}}),
    withStats(player("Ismael González", "DEF", 74, 75, 79, 74, 28), {"overall":76,"value":57588,"matches":1,"id":"roster_1kdlnhy","rosterIdentity":"ismaelgonzalez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-rdb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Ismael González","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Ismael González"}}),
    withStats(player("Adrià Escribano", "MID", 78, 71, 83, 80, 30), {"overall":78,"value":62930,"goals":3,"matches":13,"id":"roster_a9zgd6","rosterIdentity":"adriaescribano","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-rdb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Adrià Escribano","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Adrià Escribano"}}),
    withStats(player("Nil Pradas", "DEF", 72, 69, 82, 74, 26), {"overall":74,"value":52788,"goals":2,"matches":12,"id":"roster_easizn","rosterIdentity":"nilpradas","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-rdb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Nil Pradas","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Nil Pradas"},"registrationType":"wildcard"}),
    withStats(player("I. Sugranyes", "DEF", 74, 71, 90, 78, 20), {"overall":78,"value":62930,"id":"roster_zkafpd","rosterIdentity":"isugranyes","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"I. Sugranyes","baselineOrigin":{"league":"spain","teamId":"rdb","name":"I. Sugranyes"}}),
    withStats(player("Abde Bakkali", "DEF", 81, 76, 89, 87, 21), {"overall":83,"value":78785,"goals":3,"assists":1,"matches":10,"id":"roster_1khyn8y","rosterIdentity":"abdebakkali","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-rdb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Abde Bakkali","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Abde Bakkali"}}),
    withStats(player("Aridai Carrera", "DEF", 80, 82, 86, 84, 24), {"overall":83,"value":78785,"id":"roster_wszt45","rosterIdentity":"aridaicarrera","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Aridai Carrera","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Aridai Carrera"}}),
    withStats(player("Jordi Gómez", "MID", 85, 88, 82, 82, 26), {"overall":84,"value":82404,"goals":17,"assists":16,"matches":13,"id":"roster_1pf47df","rosterIdentity":"jordigomez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-rdb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Jordi Gómez","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Jordi Gómez"}}),
    withStats(player("Carlos Heredia", "MID", 82, 91, 83, 90, 28), {"overall":87,"value":94202,"assists":2,"matches":14,"id":"roster_7qmqyb","rosterIdentity":"carlosheredia","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-rdb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Carlos Heredia","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Carlos Heredia"}}),
    withStats(player("Carlos Omabegho", "ATT", 74, 72, 67, 65, 28), {"overall":70,"value":44740,"goals":7,"assists":4,"matches":14,"id":"roster_1mmmps7","rosterIdentity":"carlosomabegho","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-rdb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Carlos Omabegho","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Carlos Omabegho"}}),
    withStats(player("Adam Tahere", "MID", 75, 80, 74, 80, 28), {"overall":77,"value":60190,"matches":1,"id":"roster_t8xujj","rosterIdentity":"adamtahere","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-rdb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Adam Tahere","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Adam Tahere"},"registrationType":"wildcard"}),
    withStats(player("Gerard Oliva", "ATT", 91, 89, 86, 88, 20), {"overall":89,"value":102877,"goals":6,"assists":3,"matches":13,"id":"roster_8bqk8l","rosterIdentity":"gerardoliva","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-rdb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Gerard Oliva","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Gerard Oliva"}}),
    withStats(player("A. Sisay", "ATT", 88, 84, 81, 78, 26), {"overall":83,"value":78785,"id":"roster_vn347b","rosterIdentity":"asisay","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"A. Sisay","baselineOrigin":{"league":"spain","teamId":"rdb","name":"A. Sisay"}}),
    withStats(player("Guillem 'ZZ' Ruiz", "DEF", 73, 67, 63, 66, 22), {"overall":67,"value":39993,"goals":2,"assists":2,"matches":11,"id":"roster_1p1vnoo","rosterIdentity":"guillemzzruiz","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-rdb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Guillem 'ZZ' Ruiz","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Guillem 'ZZ' Ruiz"}}),
    withStats(player("Mohamed Boullouh", "ATT", 90, 92, 81, 84, 28), {"overall":87,"value":94202,"matches":1,"id":"roster_19klopy","rosterIdentity":"mohamedboullouh","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-rdb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Mohamed Boullouh","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Mohamed Boullouh"},"registrationType":"wildcard"}),
    withStats(player("Alhagi Marie Touray", "ATT", 80, 78, 76, 72, 23), {"overall":77,"value":60190,"id":"roster_9vj2qj","rosterIdentity":"alhagimarietouray","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-rdb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Alhagi Marie Touray","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Alhagi Marie Touray"},"registrationType":"wildcard"}),
  ] },
  { ...{"id":"say","name":"Saiyans FC","color":"#e08b2f","budget":300000,"coach":"Sebastián Marteles","presidents":["David Cánovas"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["es-team-say","es-index"]}, players: [
    withStats(player("Iván Fajardo", "GK", 57, 65, 75, 74, 29), {"overall":68,"value":41457,"id":"roster_19wxtcg","rosterIdentity":"ivanfajardo","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-say"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Saiyans FC","photoLeague":"spain","photoName":"Iván Fajardo","baselineOrigin":{"league":"spain","teamId":"say","name":"Iván Fajardo"}}),
    withStats(player("Gerard Vacas", "GK", 68, 69, 77, 80, 22), {"overall":74,"value":52788,"matches":12,"id":"roster_1okaqjk","rosterIdentity":"gerardvacas","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-say"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Saiyans FC","photoLeague":"spain","photoName":"Gerard Vacas","baselineOrigin":{"league":"spain","teamId":"say","name":"Gerard Vacas"}}),
    withStats(player("Alex Campu", "DEF", 67, 63, 81, 67, 21), {"overall":70,"value":44740,"matches":4,"id":"roster_1fp1f8z","rosterIdentity":"alexcampu","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-say"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Saiyans FC","photoLeague":"spain","photoName":"Alex Campu","baselineOrigin":{"league":"spain","teamId":"say","name":"Alex Campu"}}),
    withStats(player("Dani Santiago", "DEF", 84, 82, 96, 90, 22), {"overall":88,"value":98457,"goals":4,"assists":1,"matches":10,"id":"roster_711vk9","rosterIdentity":"danisantiago","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-say"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Saiyans FC","photoLeague":"spain","photoName":"Dani Santiago","baselineOrigin":{"league":"spain","teamId":"say","name":"Dani Santiago"}}),
    withStats(player("Albert De Verdonces", "DEF", 79, 83, 90, 87, 20), {"overall":85,"value":86178,"matches":1,"id":"roster_14l3gn7","rosterIdentity":"albertdeverdonces","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-say"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Saiyans FC","photoLeague":"spain","photoName":"Albert De Verdonces","baselineOrigin":{"league":"spain","teamId":"say","name":"Albert De Verdonces"},"registrationType":"wildcard"}),
    withStats(player("Borja Montejo", "DEF", 94, 95, 85, 87, 34), {"overall":90,"value":107464,"goals":1,"matches":12,"id":"roster_1x12n5p","rosterIdentity":"borjamontejo","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-say"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Saiyans FC","photoLeague":"spain","photoName":"Borja Montejo","baselineOrigin":{"league":"spain","teamId":"say","name":"Borja Montejo"}}),
    withStats(player("Feliu Torrus", "MID", 92, 91, 85, 82, 28), {"overall":88,"value":98457,"goals":4,"assists":1,"matches":11,"id":"roster_9q6nfj","rosterIdentity":"feliutorrus","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-say"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Saiyans FC","photoLeague":"spain","photoName":"Feliu Torrus","baselineOrigin":{"league":"spain","teamId":"say","name":"Feliu Torrus"}}),
    withStats(player("Juanan Gallego", "MID", 81, 85, 71, 71, 27), {"overall":77,"value":60190,"goals":10,"assists":5,"matches":11,"id":"roster_5fa631","rosterIdentity":"juanangallego","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-say"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Saiyans FC","photoLeague":"spain","photoName":"Juanan Gallego","baselineOrigin":{"league":"spain","teamId":"say","name":"Juanan Gallego"}}),
    withStats(player("Diego Jiménez", "ATT", 77, 81, 84, 84, 31), {"overall":82,"value":75318,"goals":5,"assists":4,"matches":11,"id":"roster_uw73id","rosterIdentity":"diegojimenez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-say"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Saiyans FC","photoLeague":"spain","photoName":"Diego Jiménez","baselineOrigin":{"league":"spain","teamId":"say","name":"Diego Jiménez"}}),
    withStats(player("Pablo Fernández", "ATT", 89, 90, 80, 85, 26), {"overall":86,"value":90110,"goals":5,"assists":3,"matches":12,"id":"roster_13p2ga","rosterIdentity":"pablofernandez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-say"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Saiyans FC","photoLeague":"spain","photoName":"Pablo Fernández","baselineOrigin":{"league":"spain","teamId":"say","name":"Pablo Fernández"}}),
    withStats(player("Sergi Gestí", "ATT", 75, 76, 62, 59, 25), {"overall":68,"value":41457,"goals":18,"assists":1,"matches":12,"id":"roster_g24d0d","rosterIdentity":"sergigesti","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-say"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Saiyans FC","photoLeague":"spain","photoName":"Sergi Gestí","baselineOrigin":{"league":"spain","teamId":"say","name":"Sergi Gestí"}}),
    withStats(player("Isaac Maldonado", "ATT", 96, 97, 89, 84, 18), {"overall":92,"value":117151,"matches":11,"id":"roster_1tcq953","rosterIdentity":"isaacmaldonado","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-say"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Saiyans FC","photoLeague":"spain","photoName":"Isaac Maldonado","baselineOrigin":{"league":"spain","teamId":"say","name":"Isaac Maldonado"}}),
    withStats(player("Gio Ferinu", "ATT", 80, 85, 72, 74, 25), {"overall":78,"value":62930,"matches":12,"id":"roster_11794ij","rosterIdentity":"gioferinu","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-say"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Saiyans FC","photoLeague":"spain","photoName":"Gio Ferinu","baselineOrigin":{"league":"spain","teamId":"say","name":"Gio Ferinu"}}),
    withStats(player("Albert Garcia", "ATT", 86, 84, 80, 82, 26), {"overall":83,"value":78785,"matches":10,"id":"roster_zut9bq","rosterIdentity":"albertgarcia","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-say"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Saiyans FC","photoLeague":"spain","photoName":"Albert García","baselineOrigin":{"league":"spain","teamId":"say","name":"Albert García"}}),
  ] },
  { ...{"id":"skl","name":"Skull FC","color":"#b0202a","budget":300000,"coach":"Marcelo","presidents":["Marcelo","Daniel Alonso"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["es-team-skl","es-index"]}, players: [
    withStats(player("Alberto Arnalot", "GK", 80, 88, 85, 92, 19), {"overall":86,"value":90110,"matches":12,"id":"roster_1i0klyp","rosterIdentity":"albertoarnalot","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Alberto Arnalot","baselineOrigin":{"league":"spain","teamId":"skl","name":"Alberto Arnalot"}}),
    withStats(player("Kevin Zárate", "GK", 63, 66, 73, 81, 20), {"overall":71,"value":46564,"matches":11,"id":"roster_1qhe04h","rosterIdentity":"kevinzarate","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Kevin Zárate","baselineOrigin":{"league":"spain","teamId":"skl","name":"Kevin Zárate"}}),
    withStats(player("Marcelo Vieira", "DEF", 72, 69, 76, 71, 34), {"overall":72,"value":48512,"id":"roster_133avj8","rosterIdentity":"marcelovieira","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Marcelo","baselineOrigin":{"league":"spain","teamId":"skl","name":"Marcelo"}}),
    withStats(player("Víctor Mongil", "DEF", 75, 70, 86, 77, 23), {"overall":77,"value":60190,"goals":1,"assists":2,"matches":9,"id":"roster_1np9vec","rosterIdentity":"victormongil","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Víctor Mongil","baselineOrigin":{"league":"spain","teamId":"skl","name":"Víctor Mongil"}}),
    withStats(player("Roberto Tobe", "DEF", 79, 76, 89, 91, 25), {"overall":84,"value":82404,"matches":3,"id":"roster_2rrnhe","rosterIdentity":"robertotobe","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Roberto Tobe","baselineOrigin":{"league":"spain","teamId":"skl","name":"Roberto Tobe"}}),
    withStats(player("Koke Navares", "DEF", 64, 69, 79, 77, 21), {"overall":72,"value":48512,"matches":8,"id":"roster_1htcqq7","rosterIdentity":"kokenavares","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Koke Navares","baselineOrigin":{"league":"spain","teamId":"skl","name":"Koke Navares"}}),
    withStats(player("David Asensio", "DEF", 74, 72, 80, 76, 24), {"overall":76,"value":57588,"assists":1,"matches":8,"id":"roster_1mygz97","rosterIdentity":"davidasensio","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"David Asensio","baselineOrigin":{"league":"spain","teamId":"skl","name":"David Asensio"}}),
    withStats(player("José Hermosa", "DEF", 70, 68, 76, 72, 25), {"overall":72,"value":48512,"matches":2,"id":"roster_5jrgfd","rosterIdentity":"josehermosa","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"José Hermosa","baselineOrigin":{"league":"spain","teamId":"skl","name":"José Hermosa"},"registrationType":"wildcard"}),
    withStats(player("Israel de la Riva", "MID", 78, 80, 79, 81, 26), {"overall":80,"value":68834,"id":"roster_1rfpjnt","rosterIdentity":"israeldelariva","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Israel de la Riva","baselineOrigin":{"league":"spain","teamId":"skl","name":"Israel de la Riva"}}),
    withStats(player("Jorge Escobar", "MID", 84, 90, 84, 84, 22), {"overall":86,"value":90110,"goals":23,"assists":5,"matches":12,"id":"roster_1390znv","rosterIdentity":"jorgeescobar","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Jorge Escobar","baselineOrigin":{"league":"spain","teamId":"skl","name":"Jorge Escobar"}}),
    withStats(player("Álex Salas", "DEF", 77, 77, 70, 85, 19), {"overall":77,"value":60190,"matches":7,"id":"roster_1569hbv","rosterIdentity":"alexsalas","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Álex Salas","baselineOrigin":{"league":"spain","teamId":"skl","name":"Álex Salas"}}),
    withStats(player("David 'Burrito' Ruiz", "MID", 72, 63, 74, 76, 18), {"overall":71,"value":46564,"assists":1,"matches":3,"id":"roster_1d8g57c","rosterIdentity":"davidburritoruiz","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"David 'Burrito' Ruiz","baselineOrigin":{"league":"spain","teamId":"skl","name":"David 'Burrito' Ruiz"}}),
    withStats(player("Pablo de Castro", "MID", 74, 69, 73, 64, 21), {"overall":70,"value":44740,"goals":3,"matches":12,"id":"roster_1mdouvq","rosterIdentity":"pablodecastro","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Pablo de Castro","baselineOrigin":{"league":"spain","teamId":"skl","name":"Pablo de Castro"}}),
    withStats(player("Manu García", "MID", 74, 76, 72, 73, 23), {"overall":74,"value":52788,"matches":2,"id":"roster_1hjbawv","rosterIdentity":"manugarcia","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Manu García","baselineOrigin":{"league":"spain","teamId":"skl","name":"Manu García"}}),
    withStats(player("Sergio Sánchez", "MID", 73, 74, 72, 72, 24), {"overall":73,"value":50586,"assists":1,"matches":3,"id":"roster_10mwt0s","rosterIdentity":"sergiosanchez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Sergio Sánchez","baselineOrigin":{"league":"spain","teamId":"skl","name":"Sergio Sánchez"}}),
    withStats(player("Dani Santos", "ATT", 93, 87, 84, 87, 23), {"overall":88,"value":98457,"goals":6,"assists":3,"matches":12,"id":"roster_1i6zlgz","rosterIdentity":"danisantos","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Dani Santos","baselineOrigin":{"league":"spain","teamId":"skl","name":"Dani Santos"}}),
    withStats(player("Nano Modrego", "ATT", 67, 69, 62, 59, 24), {"overall":64,"value":36296,"goals":2,"assists":1,"matches":10,"id":"roster_1l1kq9i","rosterIdentity":"nanomodrego","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Nano Modrego","baselineOrigin":{"league":"spain","teamId":"skl","name":"Nano Modrego"}}),
    withStats(player("Raúl Escobar", "ATT", 77, 74, 74, 66, 23), {"overall":73,"value":50586,"matches":11,"id":"roster_1bic7m4","rosterIdentity":"raulescobar","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Raúl Escobar","baselineOrigin":{"league":"spain","teamId":"skl","name":"Raúl Escobar"}}),
    withStats(player("Ayoub El Battioui", "ATT", 84, 80, 74, 72, 22), {"overall":78,"value":62930,"goals":2,"matches":1,"id":"roster_1pv0lh9","rosterIdentity":"ayoubelbattioui","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Ayoub El Battioui","baselineOrigin":{"league":"spain","teamId":"skl","name":"Ayoub El Battioui"}}),
    withStats(player("Samuel Aparicio", "ATT", 88, 89, 80, 79, 24), {"overall":84,"value":82404,"goals":10,"assists":1,"matches":6,"id":"roster_qwzdrk","rosterIdentity":"samuelaparicio","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-skl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Skull FC","photoLeague":"spain","photoName":"Samuel Aparicio","baselineOrigin":{"league":"spain","teamId":"skl","name":"Samuel Aparicio"}}),
  ] },
  { ...{"id":"umo","name":"Ultimate Móstoles","color":"#2c5aa0","budget":300000,"coach":"Alex Martínez","presidents":["Mario Alonso"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["es-team-umo","es-index"]}, players: [
    withStats(player("Víctor Vidal", "GK", 83, 84, 96, 95, 26), {"overall":90,"value":107464,"matches":4,"id":"roster_420tqo","rosterIdentity":"victorvidal","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-umo"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Ultimate Móstoles","photoLeague":"spain","photoName":"Víctor Vidal","baselineOrigin":{"league":"spain","teamId":"umo","name":"Víctor Vidal"}}),
    withStats(player("Juan Lorente", "GK", 76, 85, 92, 89, 21), {"overall":86,"value":90110,"id":"roster_1qwzqdc","rosterIdentity":"juanlorente","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-umo"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Ultimate Móstoles","photoLeague":"spain","photoName":"Juan Lorente","baselineOrigin":{"league":"spain","teamId":"umo","name":"Juan Lorente"}}),
    withStats(player("Marc Granero", "ATT", 84, 92, 92, 91, 22), {"overall":90,"value":107464,"matches":4,"id":"roster_qem6z6","rosterIdentity":"marcgranero","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-umo"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Ultimate Móstoles","photoLeague":"spain","photoName":"Marc Granero","baselineOrigin":{"league":"spain","teamId":"umo","name":"Marc Granero"}}),
    withStats(player("Eloy Pizarro", "DEF", 78, 74, 88, 80, 23), {"overall":80,"value":68834,"assists":1,"matches":4,"id":"roster_1eanfvr","rosterIdentity":"eloypizarro","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-umo"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Ultimate Móstoles","photoLeague":"spain","photoName":"Eloy Pizarro","baselineOrigin":{"league":"spain","teamId":"umo","name":"Eloy Pizarro"}}),
    withStats(player("Alberto de la Bella", "DEF", 68, 78, 82, 84, 35), {"overall":78,"value":62930,"id":"roster_1y71h8k","rosterIdentity":"albertodelabella","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Ultimate Móstoles","photoLeague":"spain","photoName":"Alberto de la Bella","baselineOrigin":{"league":"spain","teamId":"umo","name":"Alberto de la Bella"}}),
    withStats(player("Javi Espinosa", "MID", 76, 79, 80, 80, 33), {"overall":79,"value":65810,"goals":1,"matches":4,"id":"roster_ulxibl","rosterIdentity":"javiespinosa","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-umo"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Ultimate Móstoles","photoLeague":"spain","photoName":"Javi Espinosa","baselineOrigin":{"league":"spain","teamId":"umo","name":"Javi Espinosa"}}),
    withStats(player("Dani Liñares", "MID", 68, 74, 64, 75, 27), {"overall":70,"value":44740,"goals":1,"assists":2,"matches":4,"id":"roster_1rzfjnd","rosterIdentity":"danilinares","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-umo"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Ultimate Móstoles","photoLeague":"spain","photoName":"Dani Liñares","baselineOrigin":{"league":"spain","teamId":"umo","name":"Dani Liñares"}}),
    withStats(player("Aleix Lage", "MID", 80, 87, 84, 86, 25), {"overall":84,"value":82404,"matches":4,"id":"roster_111u0gp","rosterIdentity":"aleixlage","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-umo"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Ultimate Móstoles","photoLeague":"spain","photoName":"Aleix Lage","baselineOrigin":{"league":"spain","teamId":"umo","name":"Aleix Lage"}}),
    withStats(player("Alex 'Capi' Domingo", "DEF", 86, 90, 83, 78, 20), {"overall":84,"value":82404,"matches":4,"id":"roster_10apw0z","rosterIdentity":"alexcapidomingo","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-umo"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Ultimate Móstoles","photoLeague":"spain","photoName":"Alex 'Capi' Domingo","baselineOrigin":{"league":"spain","teamId":"umo","name":"Alex 'Capi' Domingo"}}),
    withStats(player("Mikhail Prokopev", "ATT", 74, 71, 67, 75, 32), {"overall":72,"value":48512,"assists":1,"matches":4,"id":"roster_198i0bm","rosterIdentity":"mikhailprokopev","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-umo"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Ultimate Móstoles","photoLeague":"spain","photoName":"Mikhail Prokopev","baselineOrigin":{"league":"spain","teamId":"umo","name":"Mikhail Prokopev"}}),
    withStats(player("Ferrán Corominas", "ATT", 65, 88, 74, 86, 40), {"overall":78,"value":62930,"id":"roster_1stbone","rosterIdentity":"ferrancorominas","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Ultimate Móstoles","photoLeague":"spain","photoName":"Ferrán Corominas","baselineOrigin":{"league":"spain","teamId":"umo","name":"Ferrán Corominas"}}),
  ] },
  { ...{"id":"xby","name":"xBuyer Team","color":"#2f5fa8","budget":300000,"coach":"Isaac Juárez","presidents":["Javier xBuyer","Eric Ruiz MiniBuyer"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["es-team-xby","es-index"]}, players: [
    withStats(player("Aleix Ruiz", "GK", 87, 88, 97, 90, 21), {"overall":91,"value":112221,"matches":13,"id":"roster_hl88qk","rosterIdentity":"aleixruiz","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Aleix Ruiz","baselineOrigin":{"league":"spain","teamId":"xby","name":"Aleix Ruiz"}}),
    withStats(player("Álex Romero", "GK", 80, 86, 95, 96, 21), {"overall":89,"value":102877,"matches":5,"id":"roster_9c9spz","rosterIdentity":"alexromero","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Álex Romero","baselineOrigin":{"league":"spain","teamId":"xby","name":"Álex Romero"}}),
    withStats(player("Joel Espinosa", "DEF", 78, 82, 92, 86, 30), {"overall":85,"value":86178,"matches":11,"id":"roster_1wrfsc3","rosterIdentity":"joelespinosa","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Joel Espinosa","baselineOrigin":{"league":"spain","teamId":"xby","name":"Joel Espinosa"}}),
    withStats(player("Mario Reyes", "DEF", 87, 82, 97, 87, 18), {"overall":88,"value":98457,"goals":1,"assists":2,"matches":14,"id":"roster_1kdlwyt","rosterIdentity":"marioreyes","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Mario Reyes","baselineOrigin":{"league":"spain","teamId":"xby","name":"Mario Reyes"}}),
    withStats(player("Sergio Campos", "DEF", 79, 90, 75, 79, 33), {"overall":81,"value":72002,"matches":2,"id":"roster_123cuk9","rosterIdentity":"sergiocampos","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Sergio Campos","baselineOrigin":{"league":"spain","teamId":"xby","name":"Sergio Campos"}}),
    withStats(player("Víctor Vargas", "DEF", 72, 70, 82, 75, 26), {"overall":75,"value":55121,"assists":1,"matches":14,"id":"roster_c944xg","rosterIdentity":"victorvargas","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Víctor Vargas","baselineOrigin":{"league":"spain","teamId":"xby","name":"Víctor Vargas"}}),
    withStats(player("Eric Pérez", "DEF", 71, 77, 82, 75, 28), {"overall":76,"value":57588,"matches":1,"id":"roster_1ukqnca","rosterIdentity":"ericperez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Eric Pérez","baselineOrigin":{"league":"spain","teamId":"xby","name":"Eric Pérez"},"registrationType":"wildcard"}),
    withStats(player("Zaid Saban", "DEF", 97, 89, 83, 84, 23), {"overall":88,"value":98457,"matches":4,"id":"roster_11qwu0u","rosterIdentity":"zaidsaban","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Zaid Saban","baselineOrigin":{"league":"spain","teamId":"xby","name":"Zaid Saban"},"registrationType":"wildcard"}),
    withStats(player("Eric Sánchez", "MID", 77, 79, 68, 74, 26), {"overall":75,"value":55121,"goals":2,"matches":14,"id":"roster_1ggdleg","rosterIdentity":"ericsanchez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Eric Sánchez","baselineOrigin":{"league":"spain","teamId":"xby","name":"Eric Sánchez"}}),
    withStats(player("Xavier Cabezas", "MID", 67, 73, 68, 69, 26), {"overall":69,"value":43038,"goals":5,"assists":1,"matches":14,"id":"roster_1xzb6f1","rosterIdentity":"xaviercabezas","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Xavier Cabezas","baselineOrigin":{"league":"spain","teamId":"xby","name":"Xavier Cabezas"}}),
    withStats(player("Héctor Rodríguez", "MID", 77, 79, 73, 76, 25), {"overall":76,"value":57588,"id":"roster_5bckjv","rosterIdentity":"hectorrodriguez","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Héctor Rodríguez","baselineOrigin":{"league":"spain","teamId":"xby","name":"Héctor Rodríguez"}}),
    withStats(player("Pol Tolrà", "MID", 79, 83, 74, 79, 23), {"overall":79,"value":65810,"id":"roster_97tsuu","rosterIdentity":"poltolra","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Pol Tolrà","baselineOrigin":{"league":"spain","teamId":"xby","name":"Pol Tolrà"}}),
    withStats(player("Antonio Domenech", "ATT", 74, 77, 85, 77, 30), {"overall":78,"value":62930,"matches":6,"id":"roster_1kctnfi","rosterIdentity":"antoniodomenech","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Antonio Domenech","baselineOrigin":{"league":"spain","teamId":"xby","name":"Antonio Domenech"}}),
    withStats(player("Galde Hugue", "ATT", 88, 96, 92, 91, 27), {"overall":92,"value":117151,"goals":22,"assists":12,"matches":14,"id":"roster_nnl2nq","rosterIdentity":"galdehugue","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Galde Hugue","baselineOrigin":{"league":"spain","teamId":"xby","name":"Galde Hugue"}}),
    withStats(player("Jacobo Liencres", "ATT", 85, 89, 78, 76, 25), {"overall":82,"value":75318,"goals":14,"assists":10,"matches":14,"id":"roster_17nzjj4","rosterIdentity":"jacoboliencres","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Jacobo Liencres","baselineOrigin":{"league":"spain","teamId":"xby","name":"Jacobo Liencres"}}),
    withStats(player("Javier Comas", "ATT", 75, 73, 75, 67, 24), {"overall":73,"value":50586,"assists":1,"matches":3,"id":"roster_1krrhjf","rosterIdentity":"javiercomas","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Javier Comas","baselineOrigin":{"league":"spain","teamId":"xby","name":"Javier Comas"}}),
    withStats(player("Juanma González", "ATT", 73, 68, 63, 69, 20), {"overall":68,"value":41457,"goals":5,"assists":2,"matches":14,"id":"roster_vzauct","rosterIdentity":"juanmagonzalez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Juanma González","baselineOrigin":{"league":"spain","teamId":"xby","name":"Juanma González"}}),
    withStats(player("Sergio 'Chechi' Costa", "ATT", 84, 88, 71, 86, 23), {"overall":82,"value":75318,"goals":8,"assists":1,"matches":10,"id":"roster_14e1k8a","rosterIdentity":"sergiochechicosta","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Sergio 'Chechi' Costa","baselineOrigin":{"league":"spain","teamId":"xby","name":"Sergio 'Chechi' Costa"}}),
    withStats(player("Albert López", "ATT", 91, 86, 85, 78, 27), {"overall":85,"value":86178,"goals":3,"matches":2,"id":"roster_exklw9","rosterIdentity":"albertlopez","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Albert López","baselineOrigin":{"league":"spain","teamId":"xby","name":"Albert López"},"registrationType":"wildcard"}),
    withStats(player("Marc Gulias", "ATT", 92, 95, 90, 89, 24), {"overall":92,"value":117151,"matches":1,"id":"roster_1qdf1kb","rosterIdentity":"marcgulias","rosterStatus":"retained-unverified","rosterSourceIds":["es-team-xby"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Marc Gulias","baselineOrigin":{"league":"spain","teamId":"xby","name":"Marc Gulias"},"registrationType":"wildcard"}),
    withStats(player("Stelios Orgianos", "ATT", 90, 92, 82, 82, 24), {"overall":87,"value":94202,"id":"roster_1nflvyo","rosterIdentity":"steliosorgianos","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"xBuyer Team","photoLeague":"spain","photoName":"Stelios Orgianos","baselineOrigin":{"league":"spain","teamId":"xby","name":"Stelios Orgianos"}}),
  ] },
];

const ITALY_TEAMS = [
  { ...{"id":"alp","name":"Alpak FC","color":"#d63384","budget":300000,"coach":"Mauro Micheli","presidents":["Frenezy"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["it-team-alp","it-wildcards"]}, players: [
    withStats(player("Luigi Castelli", "GK", 65, 61, 69, 75, 25), {"overall":68,"value":41457,"id":"roster_148638s","rosterIdentity":"luigicastelli","rosterStatus":"verified","rosterSourceIds":["it-team-alp"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Alpak FC","photoLeague":"italy","photoName":"Luigi Castelli","baselineOrigin":{"league":"italy","teamId":"alp","name":"Luigi Castelli"},"registrationType":"registered"}),
    withStats(player("Vittorio Gilli", "GK", 81, 90, 97, 97, 26), {"overall":91,"value":112221,"matches":6,"id":"roster_1cvr5k8","rosterIdentity":"vittoriogilli","rosterStatus":"verified","rosterSourceIds":["it-team-alp"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Alpak FC","photoLeague":"italy","photoName":"Vittorio Gilli","baselineOrigin":{"league":"italy","teamId":"alp","name":"Vittorio Gilli"},"registrationType":"registered"}),
    withStats(player("Alessandro Marocco", "DEF", 59, 64, 75, 73, 28), {"overall":68,"value":41457,"goals":1,"assists":2,"matches":11,"id":"roster_1b1n3ub","rosterIdentity":"alessandromarocco","rosterStatus":"verified","rosterSourceIds":["it-team-alp"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"D-POWER","photoLeague":"italy","photoName":"Alessandro Marocco","baselineOrigin":{"league":"italy","teamId":"dpw","name":"Alessandro Marocco"},"registrationType":"registered"}),
    withStats(player("Thomas Salvaterra", "DEF", 75, 67, 83, 76, 19), {"overall":75,"value":55121,"matches":6,"id":"roster_1033kjc","rosterIdentity":"thomassalvaterra","rosterStatus":"verified","rosterSourceIds":["it-team-alp"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Alpak FC","photoLeague":"italy","photoName":"Thomas Salvaterra","baselineOrigin":{"league":"italy","teamId":"alp","name":"Thomas Salvaterra"},"registrationType":"registered"}),
    withStats(player("Vlad Marin", "DEF", 76, 78, 87, 83, 29), {"overall":81,"value":72002,"goals":2,"matches":6,"id":"roster_19wlhg5","rosterIdentity":"vladmarin","rosterStatus":"verified","rosterSourceIds":["it-team-alp"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Alpak FC","photoLeague":"italy","photoName":"Vlad Marin","baselineOrigin":{"league":"italy","teamId":"alp","name":"Vlad Marin"},"registrationType":"registered"}),
    withStats(player("Niccolò Ferrarese", "MID", 79, 83, 73, 81, 29), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_jkx4gj","rosterIdentity":"niccoloferrarese","rosterStatus":"verified","rosterSourceIds":["it-team-alp"],"rosterCheckedAt":"2026-10-26","photoClub":"Alpak FC","photoLeague":"italy","photoName":"Niccolò Ferrarese","registrationType":"registered"}),
    withStats(player("Nicola Cutrignelli", "MID", 74, 68, 61, 68, 22), {"overall":68,"value":41457,"goals":1,"matches":6,"id":"roster_sqcdnd","rosterIdentity":"nicolacutrignelli","rosterStatus":"verified","rosterSourceIds":["it-team-alp"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Alpak FC","photoLeague":"italy","photoName":"Nicola Cutrignelli","baselineOrigin":{"league":"italy","teamId":"alp","name":"Nicola Cutrignelli"},"registrationType":"registered"}),
    withStats(player("Abdou Doumbia", "ATT", 77, 79, 74, 73, 23), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1cm2ktj","rosterIdentity":"abdoudoumbia","rosterStatus":"verified","rosterSourceIds":["it-team-alp"],"rosterCheckedAt":"2026-10-26","photoClub":"Alpak FC","photoLeague":"italy","photoName":"Abdou Doumbia","registrationType":"registered"}),
    withStats(player("Mauro Veneroso", "ATT", 82, 78, 76, 69, 23), {"overall":76,"value":57588,"goals":2,"assists":2,"matches":6,"id":"roster_1c7ebdg","rosterIdentity":"mauroveneroso","rosterStatus":"verified","rosterSourceIds":["it-team-alp"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Alpak FC","photoLeague":"italy","photoName":"Mauro Veneroso","baselineOrigin":{"league":"italy","teamId":"alp","name":"Mauro Veneroso"},"registrationType":"registered"}),
    withStats(player("Paolo Scienza", "ATT", 73, 79, 71, 61, 20), {"overall":71,"value":46564,"goals":2,"assists":2,"matches":6,"id":"roster_1kjy4fd","rosterIdentity":"paoloscienza","rosterStatus":"verified","rosterSourceIds":["it-team-alp"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Alpak FC","photoLeague":"italy","photoName":"Paolo Scienza","baselineOrigin":{"league":"italy","teamId":"alp","name":"Paolo Scienza"},"registrationType":"registered"}),
    withStats(player("Pietro Arcidiacono", "ATT", 84, 82, 77, 72, 26), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1tzcynu","rosterIdentity":"pietroarcidiacono","rosterStatus":"verified","rosterSourceIds":["it-team-alp"],"rosterCheckedAt":"2026-10-26","photoClub":"Alpak FC","photoLeague":"italy","photoName":"Pietro Arcidiacono","registrationType":"registered"}),
    withStats(player("Simone Lo Faso", "ATT", 82, 78, 68, 73, 20), {"overall":75,"value":55121,"goals":24,"assists":5,"matches":14,"id":"roster_185h8by","rosterIdentity":"simonelofaso","rosterStatus":"verified","rosterSourceIds":["it-team-alp"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Boomers","photoLeague":"italy","photoName":"Simone Lo Faso","baselineOrigin":{"league":"italy","teamId":"boo","name":"Simone Lo Faso"},"registrationType":"registered"}),
    withStats(player("Riccardo Ottaviani", "DEF", 78, 76, 81, 81, 28), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_80fvyt","rosterIdentity":"riccardoottaviani","rosterStatus":"verified","rosterSourceIds":["it-team-alp","it-wildcards"],"rosterCheckedAt":"2026-10-26","photoClub":"Alpak FC","photoLeague":"italy","photoName":"Riccardo Ottaviani","registrationType":"wildcard"}),
  ] },
  { ...{"id":"bbr","name":"BIGBRO","color":"#4a5568","budget":300000,"coach":"Emanuele Di Vittorio","presidents":["Moonryde"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["it-team-bbr","it-wildcards"]}, players: [
    withStats(player("Leandro Casapieri", "GK", 85, 89, 93, 96, 29), {"overall":91,"value":112221,"matches":12,"id":"roster_ffmgkf","rosterIdentity":"leandrocasapieri","rosterStatus":"verified","rosterSourceIds":["it-team-bbr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"BIGBRO","photoLeague":"italy","photoName":"Leandro Casapieri","baselineOrigin":{"league":"italy","teamId":"bbr","name":"Leandro Casapieri"},"registrationType":"registered"}),
    withStats(player("Alessandro Garilli", "DEF", 73, 68, 81, 81, 27), {"overall":76,"value":57588,"goals":4,"matches":12,"id":"roster_8hnxkz","rosterIdentity":"alessandrogarilli","rosterStatus":"verified","rosterSourceIds":["it-team-bbr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"BIGBRO","photoLeague":"italy","photoName":"Alessandro Garilli","baselineOrigin":{"league":"italy","teamId":"bbr","name":"Alessandro Garilli"},"registrationType":"registered"}),
    withStats(player("Diego Albanese", "DEF", 80, 74, 84, 77, 28), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1akj2ra","rosterIdentity":"diegoalbanese","rosterStatus":"verified","rosterSourceIds":["it-team-bbr"],"rosterCheckedAt":"2026-10-26","photoClub":"BIGBRO","photoLeague":"italy","photoName":"Diego Albanese","registrationType":"registered"}),
    withStats(player("Riccardo Bertaglio", "DEF", 86, 84, 94, 81, 24), {"overall":86,"value":90110,"matches":3,"id":"roster_189yp45","rosterIdentity":"riccardobertaglio","rosterStatus":"verified","rosterSourceIds":["it-team-bbr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Underdogs FC","photoLeague":"italy","photoName":"Riccardo Bertaglio","baselineOrigin":{"league":"italy","teamId":"und","name":"Riccardo Bertaglio"},"registrationType":"registered"}),
    withStats(player("Ali Farsane", "MID", 78, 83, 75, 79, 27), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_h1svzp","rosterIdentity":"alifarsane","rosterStatus":"verified","rosterSourceIds":["it-team-bbr"],"rosterCheckedAt":"2026-10-26","photoClub":"BIGBRO","photoLeague":"italy","photoName":"Ali Farsane","registrationType":"registered"}),
    withStats(player("Francesco Messina", "MID", 74, 78, 69, 79, 25), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1o9t9j9","rosterIdentity":"francescomessina","rosterStatus":"verified","rosterSourceIds":["it-team-bbr"],"rosterCheckedAt":"2026-10-26","photoClub":"BIGBRO","photoLeague":"italy","photoName":"Francesco Messina","registrationType":"registered"}),
    withStats(player("Spizzi", "MID", 88, 90, 84, 89, 28), {"overall":88,"value":98457,"goals":8,"assists":3,"matches":10,"id":"roster_u50im4","rosterIdentity":"spizzi","rosterStatus":"verified","rosterSourceIds":["it-team-bbr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"BIGBRO","photoLeague":"italy","photoName":"Spizzi","baselineOrigin":{"league":"italy","teamId":"bbr","name":"Spizzi"},"registrationType":"registered"}),
    withStats(player("Tiziano Merlonghi", "MID", 72, 78, 67, 72, 25), {"overall":72,"value":48512,"goals":7,"assists":3,"matches":11,"id":"roster_cgfsqi","rosterIdentity":"tizianomerlonghi","rosterStatus":"verified","rosterSourceIds":["it-team-bbr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"BIGBRO","photoLeague":"italy","photoName":"Tiziano Merlonghi","baselineOrigin":{"league":"italy","teamId":"bbr","name":"Tiziano Merlonghi"},"registrationType":"registered"}),
    withStats(player("Alessandro Sigurtà", "ATT", 89, 88, 77, 77, 27), {"overall":83,"value":78785,"goals":6,"matches":12,"id":"roster_15th4ai","rosterIdentity":"alessandrosigurta","rosterStatus":"verified","rosterSourceIds":["it-team-bbr"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"BIGBRO","photoLeague":"italy","photoName":"Alessandro Sigurtà","baselineOrigin":{"league":"italy","teamId":"bbr","name":"Alessandro Sigurtà"},"registrationType":"registered"}),
    withStats(player("Brandon Rodriguez", "ATT", 85, 82, 75, 75, 28), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_18eiwge","rosterIdentity":"brandonrodriguez","rosterStatus":"verified","rosterSourceIds":["it-team-bbr"],"rosterCheckedAt":"2026-10-26","photoClub":"BIGBRO","photoLeague":"italy","photoName":"Brandon Rodriguez","registrationType":"registered"}),
    withStats(player("Filippo Gagliardi", "ATT", 81, 81, 75, 77, 27), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_9nmxlm","rosterIdentity":"filippogagliardi","rosterStatus":"verified","rosterSourceIds":["it-team-bbr"],"rosterCheckedAt":"2026-10-26","photoClub":"BIGBRO","photoLeague":"italy","photoName":"Filippo Gagliardi","registrationType":"registered"}),
    withStats(player("Manuel Leone", "ATT", 85, 81, 77, 74, 27), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_gsc468","rosterIdentity":"manuelleone","rosterStatus":"verified","rosterSourceIds":["it-team-bbr"],"rosterCheckedAt":"2026-10-26","photoClub":"BIGBRO","photoLeague":"italy","photoName":"Manuel Leone","registrationType":"registered"}),
    withStats(player("Samuele Curreli", "ATT", 86, 84, 78, 76, 29), {"overall":81,"value":72002,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_zrj42v","rosterIdentity":"samuelecurreli","rosterStatus":"verified","rosterSourceIds":["it-team-bbr"],"rosterCheckedAt":"2026-10-26","photoClub":"BIGBRO","photoLeague":"italy","photoName":"Samuele Curreli","registrationType":"registered"}),
    withStats(player("Roberto Ratti", "ATT", 97, 86, 86, 83, 20), {"overall":88,"value":98457,"goals":4,"matches":11,"id":"roster_1e7ypu","rosterIdentity":"robertoratti","rosterStatus":"verified","rosterSourceIds":["it-team-bbr","it-wildcards"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Gear 7 FC","photoLeague":"italy","photoName":"Roberto Ratti","baselineOrigin":{"league":"italy","teamId":"g7f","name":"Roberto Ratti"},"registrationType":"wildcard"}),
  ] },
  { ...{"id":"boo","name":"Boomers","color":"#c9a227","budget":300000,"coach":"Mattia Mangone","presidents":["Fedez"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["it-team-boo","it-wildcards"]}, players: [
    withStats(player("Roc Bancells", "ATT", 97, 91, 86, 89, 25), {"overall":91,"value":112221,"goals":16,"assists":6,"matches":13,"id":"roster_6vseuh","rosterIdentity":"rocbancells","rosterStatus":"verified","rosterSourceIds":["it-team-boo"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Roc Bancells","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Roc Bancells"},"registrationType":"registered"}),
    withStats(player("Edoardo Ciancio", "GK", 64, 60, 78, 77, 25), {"overall":70,"value":44740,"matches":6,"id":"roster_6s54cd","rosterIdentity":"edoardociancio","rosterStatus":"verified","rosterSourceIds":["it-team-boo"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Boomers","photoLeague":"italy","photoName":"Edoardo Ciancio","baselineOrigin":{"league":"italy","teamId":"boo","name":"Edoardo Ciancio"},"registrationType":"registered"}),
    withStats(player("Jacopo Aiello", "GK", 64, 68, 82, 82, 25), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1c5qcs9","rosterIdentity":"jacopoaiello","rosterStatus":"verified","rosterSourceIds":["it-team-boo"],"rosterCheckedAt":"2026-10-26","photoClub":"Boomers","photoLeague":"italy","photoName":"Jacopo Aiello","registrationType":"registered"}),
    withStats(player("Andrea Tarasco", "DEF", 64, 66, 79, 66, 30), {"overall":69,"value":43038,"goals":1,"matches":14,"id":"roster_107bdqf","rosterIdentity":"andreatarasco","rosterStatus":"verified","rosterSourceIds":["it-team-boo"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Boomers","photoLeague":"italy","photoName":"Andrea Tarasco","baselineOrigin":{"league":"italy","teamId":"boo","name":"Andrea Tarasco"},"registrationType":"registered"}),
    withStats(player("Christian Dimarco", "DEF", 75, 73, 81, 74, 25), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_3sv5dr","rosterIdentity":"christiandimarco","rosterStatus":"verified","rosterSourceIds":["it-team-boo"],"rosterCheckedAt":"2026-10-26","photoClub":"Boomers","photoLeague":"italy","photoName":"Christian Dimarco","registrationType":"registered"}),
    withStats(player("Tommaso Caldera", "DEF", 73, 80, 87, 79, 27), {"overall":80,"value":68834,"goals":1,"matches":2,"id":"roster_cabyez","rosterIdentity":"tommasocaldera","rosterStatus":"verified","rosterSourceIds":["it-team-boo"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Underdogs FC","photoLeague":"italy","photoName":"Tommaso Caldera","baselineOrigin":{"league":"italy","teamId":"und","name":"Tommaso Caldera"},"registrationType":"registered"}),
    withStats(player("Yannick Melseaux", "DEF", 77, 76, 84, 77, 27), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1e2ryvs","rosterIdentity":"yannickmelseaux","rosterStatus":"verified","rosterSourceIds":["it-team-boo"],"rosterCheckedAt":"2026-10-26","photoClub":"Boomers","photoLeague":"italy","photoName":"Yannick Melseaux","registrationType":"registered"}),
    withStats(player("Andrea D'errico", "MID", 76, 75, 69, 75, 27), {"overall":74,"value":52788,"goals":2,"assists":1,"matches":5,"id":"roster_1u8ueei","rosterIdentity":"andreaderrico","rosterStatus":"verified","rosterSourceIds":["it-team-boo"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Zebras FC","photoLeague":"italy","photoName":"Andrea D'errico","baselineOrigin":{"league":"italy","teamId":"zeb","name":"Andrea D'errico"},"registrationType":"registered"}),
    withStats(player("Nicholas Martini", "MID", 83, 92, 86, 90, 27), {"overall":88,"value":98457,"goals":8,"assists":1,"matches":7,"id":"roster_1a99tji","rosterIdentity":"nicholasmartini","rosterStatus":"verified","rosterSourceIds":["it-team-boo"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Boomers","photoLeague":"italy","photoName":"Nicholas Martini","baselineOrigin":{"league":"italy","teamId":"boo","name":"Nicholas Martini"},"registrationType":"registered"}),
    withStats(player("Riccardo Losa", "MID", 77, 82, 71, 77, 25), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1xjrpad","rosterIdentity":"riccardolosa","rosterStatus":"verified","rosterSourceIds":["it-team-boo"],"rosterCheckedAt":"2026-10-26","photoClub":"Boomers","photoLeague":"italy","photoName":"Riccardo Losa","registrationType":"registered"}),
    withStats(player("Assane Faye", "ATT", 82, 77, 75, 72, 24), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_6ks7rb","rosterIdentity":"assanefaye","rosterStatus":"verified","rosterSourceIds":["it-team-boo"],"rosterCheckedAt":"2026-10-26","photoClub":"Boomers","photoLeague":"italy","photoName":"Assane Faye","registrationType":"registered"}),
    withStats(player("Carlo Ferrario", "ATT", 83, 79, 73, 71, 25), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_si6soa","rosterIdentity":"carloferrario","rosterStatus":"verified","rosterSourceIds":["it-team-boo"],"rosterCheckedAt":"2026-10-26","photoClub":"Boomers","photoLeague":"italy","photoName":"Carlo Ferrario","registrationType":"registered"}),
    withStats(player("Manuel Luca Attici", "ATT", 82, 82, 77, 77, 27), {"overall":80,"value":68834,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_kj39ge","rosterIdentity":"manuellucaattici","rosterStatus":"verified","rosterSourceIds":["it-team-boo"],"rosterCheckedAt":"2026-10-26","photoClub":"Boomers","photoLeague":"italy","photoName":"Manuel Luca Attici","registrationType":"registered"}),
  ] },
  { ...{"id":"cir","name":"Circus FC","color":"#7b3fa0","budget":300000,"coach":"Alan Rigo","presidents":["GrenBaud"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["it-team-cir","it-wildcards"]}, players: [
    withStats(player("Iván Torres", "DEF", 82, 85, 84, 82, 25), {"overall":83,"value":78785,"goals":13,"assists":3,"matches":14,"id":"roster_1fi5gko","rosterIdentity":"ivantorres","rosterStatus":"verified","rosterSourceIds":["it-team-cir"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Rayo de Barcelona","photoLeague":"spain","photoName":"Iván Torres","baselineOrigin":{"league":"spain","teamId":"rdb","name":"Iván Torres"},"registrationType":"registered"}),
    withStats(player("David Grifell", "DEF", 65, 62, 79, 74, 19), {"overall":70,"value":44740,"matches":4,"id":"roster_8rtdwy","rosterIdentity":"davidgrifell","rosterStatus":"verified","rosterSourceIds":["it-team-cir","it-wildcards"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Ultimate Móstoles","photoLeague":"spain","photoName":"David Grifell","baselineOrigin":{"league":"spain","teamId":"umo","name":"David Grifell"},"registrationType":"wildcard"}),
    withStats(player("Alessio Salvato", "GK", 59, 63, 77, 79, 23), {"overall":70,"value":44740,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1ctwyt3","rosterIdentity":"alessiosalvato","rosterStatus":"verified","rosterSourceIds":["it-team-cir"],"rosterCheckedAt":"2026-10-26","photoClub":"Circus FC","photoLeague":"italy","photoName":"Alessio Salvato","registrationType":"registered"}),
    withStats(player("Simone Martino", "GK", 84, 84, 93, 93, 24), {"overall":89,"value":102877,"matches":12,"id":"roster_plcti4","rosterIdentity":"simonemartino","rosterStatus":"verified","rosterSourceIds":["it-team-cir"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Circus FC","photoLeague":"italy","photoName":"Simone Martino","baselineOrigin":{"league":"italy","teamId":"cir","name":"Simone Martino"},"registrationType":"registered"}),
    withStats(player("Lorenzo Mantovani", "DEF", 65, 73, 79, 73, 22), {"overall":73,"value":50586,"goals":5,"matches":12,"id":"roster_tus833","rosterIdentity":"lorenzomantovani","rosterStatus":"verified","rosterSourceIds":["it-team-cir"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Circus FC","photoLeague":"italy","photoName":"Lorenzo Mantovani","baselineOrigin":{"league":"italy","teamId":"cir","name":"Lorenzo Mantovani"},"registrationType":"registered"}),
    withStats(player("Marco Bianchi", "DEF", 73, 70, 78, 77, 24), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1s9k2b","rosterIdentity":"marcobianchi","rosterStatus":"verified","rosterSourceIds":["it-team-cir"],"rosterCheckedAt":"2026-10-26","photoClub":"Circus FC","photoLeague":"italy","photoName":"Marco Bianchi","registrationType":"registered"}),
    withStats(player("Tiziano Prinari", "DEF", 87, 83, 96, 94, 19), {"overall":90,"value":107464,"matches":9,"id":"roster_v3jrye","rosterIdentity":"tizianoprinari","rosterStatus":"verified","rosterSourceIds":["it-team-cir"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Gear 7 FC","photoLeague":"italy","photoName":"Tiziano Prinari","baselineOrigin":{"league":"italy","teamId":"g7f","name":"Tiziano Prinari"},"registrationType":"registered"}),
    withStats(player("Nico Federici", "MID", 79, 86, 77, 87, 25), {"overall":82,"value":75318,"goals":2,"assists":3,"matches":11,"id":"roster_cioo49","rosterIdentity":"nicofederici","rosterStatus":"verified","rosterSourceIds":["it-team-cir"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Circus FC","photoLeague":"italy","photoName":"Nico Federici","baselineOrigin":{"league":"italy","teamId":"cir","name":"Nico Federici"},"registrationType":"registered"}),
    withStats(player("Pol Ortega", "MID", 76, 78, 72, 75, 24), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_yts886","rosterIdentity":"polortega","rosterStatus":"verified","rosterSourceIds":["it-team-cir"],"rosterCheckedAt":"2026-10-26","photoClub":"Circus FC","photoLeague":"italy","photoName":"Pol Ortega","registrationType":"registered"}),
    withStats(player("Samuele Pinna", "MID", 76, 77, 70, 77, 24), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_6toi3x","rosterIdentity":"samuelepinna","rosterStatus":"verified","rosterSourceIds":["it-team-cir"],"rosterCheckedAt":"2026-10-26","photoClub":"Circus FC","photoLeague":"italy","photoName":"Samuele Pinna","registrationType":"registered"}),
    withStats(player("Davide Bertocchi", "ATT", 93, 93, 88, 84, 19), {"overall":90,"value":107464,"goals":9,"assists":2,"matches":9,"id":"roster_72zo3d","rosterIdentity":"davidebertocchi","rosterStatus":"verified","rosterSourceIds":["it-team-cir"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Circus FC","photoLeague":"italy","photoName":"Davide Bertocchi","baselineOrigin":{"league":"italy","teamId":"cir","name":"Davide Bertocchi"},"registrationType":"registered"}),
    withStats(player("Lorenzo Berra", "ATT", 90, 89, 76, 77, 22), {"overall":83,"value":78785,"goals":19,"assists":2,"matches":12,"id":"roster_m71pbu","rosterIdentity":"lorenzoberra","rosterStatus":"verified","rosterSourceIds":["it-team-cir"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Circus FC","photoLeague":"italy","photoName":"Lorenzo Berra","baselineOrigin":{"league":"italy","teamId":"cir","name":"Lorenzo Berra"},"registrationType":"registered"}),
    withStats(player("Matteo Siano", "ATT", 82, 81, 79, 74, 31), {"overall":79,"value":65810,"goals":5,"matches":11,"id":"roster_gmxsup","rosterIdentity":"matteosiano","rosterStatus":"verified","rosterSourceIds":["it-team-cir"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"D-POWER","photoLeague":"italy","photoName":"Matteo Siano","baselineOrigin":{"league":"italy","teamId":"dpw","name":"Matteo Siano"},"registrationType":"registered"}),
  ] },
  { ...{"id":"dpw","name":"D-POWER","color":"#b23a2e","budget":300000,"coach":"Umberto Chiaramonte","presidents":["Diletta Leotta","Christian Vieri"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["it-team-dpw","it-wildcards"]}, players: [
    withStats(player("Valerio Vimercati", "GK", 79, 81, 87, 84, 35), {"overall":83,"value":78785,"matches":10,"id":"roster_bh5aq1","rosterIdentity":"valeriovimercati","rosterStatus":"verified","rosterSourceIds":["it-team-dpw"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"D-POWER","photoLeague":"italy","photoName":"Valerio Vimercati","baselineOrigin":{"league":"italy","teamId":"dpw","name":"Valerio Vimercati"},"registrationType":"registered"}),
    withStats(player("Enea Cehu", "DEF", 72, 73, 78, 77, 24), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_r0x46f","rosterIdentity":"eneacehu","rosterStatus":"verified","rosterSourceIds":["it-team-dpw"],"rosterCheckedAt":"2026-10-26","photoClub":"D-POWER","photoLeague":"italy","photoName":"Enea Cehu","registrationType":"registered"}),
    withStats(player("Antonio Altieri", "MID", 79, 84, 73, 80, 28), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_19yfnq9","rosterIdentity":"antonioaltieri","rosterStatus":"verified","rosterSourceIds":["it-team-dpw"],"rosterCheckedAt":"2026-10-26","photoClub":"D-POWER","photoLeague":"italy","photoName":"Antonio Altieri","registrationType":"registered"}),
    withStats(player("Felipe Diogo", "MID", 82, 84, 73, 83, 29), {"overall":81,"value":72002,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1nzur1m","rosterIdentity":"felipediogo","rosterStatus":"verified","rosterSourceIds":["it-team-dpw"],"rosterCheckedAt":"2026-10-26","photoClub":"D-POWER","photoLeague":"italy","photoName":"Felipe Diogo","registrationType":"registered"}),
    withStats(player("Marco Gallizia", "MID", 70, 80, 73, 75, 32), {"overall":75,"value":55121,"matches":1,"id":"roster_x9tuo8","rosterIdentity":"marcogallizia","rosterStatus":"verified","rosterSourceIds":["it-team-dpw"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Zebras FC","photoLeague":"italy","photoName":"Marco Gallizia","baselineOrigin":{"league":"italy","teamId":"zeb","name":"Marco Gallizia"},"registrationType":"registered"}),
    withStats(player("Mattia Pensalfini", "MID", 73, 80, 71, 74, 24), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_bkmx2w","rosterIdentity":"mattiapensalfini","rosterStatus":"verified","rosterSourceIds":["it-team-dpw"],"rosterCheckedAt":"2026-10-26","photoClub":"D-POWER","photoLeague":"italy","photoName":"Mattia Pensalfini","registrationType":"registered"}),
    withStats(player("Riccardo Restelli", "MID", 73, 78, 72, 75, 24), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1vr653c","rosterIdentity":"riccardorestelli","rosterStatus":"verified","rosterSourceIds":["it-team-dpw"],"rosterCheckedAt":"2026-10-26","photoClub":"D-POWER","photoLeague":"italy","photoName":"Riccardo Restelli","registrationType":"registered"}),
    withStats(player("Simone Soprano", "MID", 79, 81, 71, 78, 26), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_i23pis","rosterIdentity":"simonesoprano","rosterStatus":"verified","rosterSourceIds":["it-team-dpw"],"rosterCheckedAt":"2026-10-26","photoClub":"D-POWER","photoLeague":"italy","photoName":"Simone Soprano","registrationType":"registered"}),
    withStats(player("Edoardo Matta", "ATT", 86, 82, 79, 75, 29), {"overall":81,"value":72002,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_14031jk","rosterIdentity":"edoardomatta","rosterStatus":"verified","rosterSourceIds":["it-team-dpw"],"rosterCheckedAt":"2026-10-26","photoClub":"D-POWER","photoLeague":"italy","photoName":"Edoardo Matta","registrationType":"registered"}),
    withStats(player("Elia Ferrario", "ATT", 80, 81, 75, 71, 25), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1fqnbpk","rosterIdentity":"eliaferrario","rosterStatus":"verified","rosterSourceIds":["it-team-dpw"],"rosterCheckedAt":"2026-10-26","photoClub":"D-POWER","photoLeague":"italy","photoName":"Elia Ferrario","registrationType":"registered"}),
    withStats(player("Fallou Cisse", "ATT", 78, 76, 75, 73, 24), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_16ynzrt","rosterIdentity":"falloucisse","rosterStatus":"verified","rosterSourceIds":["it-team-dpw"],"rosterCheckedAt":"2026-10-26","photoClub":"D-POWER","photoLeague":"italy","photoName":"Fallou Cisse","registrationType":"registered"}),
    withStats(player("Federico Scappi", "ATT", 81, 80, 75, 75, 25), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_8x3wr4","rosterIdentity":"federicoscappi","rosterStatus":"verified","rosterSourceIds":["it-team-dpw"],"rosterCheckedAt":"2026-10-26","photoClub":"D-POWER","photoLeague":"italy","photoName":"Federico Scappi","registrationType":"registered"}),
  ] },
  { ...{"id":"cae","name":"FC Caesar","color":"#8c2f5c","budget":300000,"coach":"Emiliano Viviano","presidents":["Er Faina","En3rix"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["it-team-cae","it-wildcards"]}, players: [
    withStats(player("Gabriele Zappalà", "GK", 60, 62, 80, 82, 23), {"overall":71,"value":46564,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_iqmajv","rosterIdentity":"gabrielezappala","rosterStatus":"verified","rosterSourceIds":["it-team-cae"],"rosterCheckedAt":"2026-10-26","photoClub":"FC Caesar","photoLeague":"italy","photoName":"Gabriele Zappalà","registrationType":"registered"}),
    withStats(player("Giovanni Bassi", "GK", 65, 69, 84, 85, 28), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_15jx0y4","rosterIdentity":"giovannibassi","rosterStatus":"verified","rosterSourceIds":["it-team-cae"],"rosterCheckedAt":"2026-10-26","photoClub":"FC Caesar","photoLeague":"italy","photoName":"Giovanni Bassi","registrationType":"registered"}),
    withStats(player("Andrea Pozzi", "DEF", 75, 69, 77, 73, 24), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_lfoqsy","rosterIdentity":"andreapozzi","rosterStatus":"verified","rosterSourceIds":["it-team-cae"],"rosterCheckedAt":"2026-10-26","photoClub":"FC Caesar","photoLeague":"italy","photoName":"Andrea Pozzi","registrationType":"registered"}),
    withStats(player("Christian Mancino", "DEF", 75, 72, 79, 76, 24), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_9quhzv","rosterIdentity":"christianmancino","rosterStatus":"verified","rosterSourceIds":["it-team-cae"],"rosterCheckedAt":"2026-10-26","photoClub":"FC Caesar","photoLeague":"italy","photoName":"Christian Mancino","registrationType":"registered"}),
    withStats(player("Stefano Di Pentima", "DEF", 71, 71, 77, 74, 23), {"overall":73,"value":50586,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1qyft9q","rosterIdentity":"stefanodipentima","rosterStatus":"verified","rosterSourceIds":["it-team-cae"],"rosterCheckedAt":"2026-10-26","photoClub":"FC Caesar","photoLeague":"italy","photoName":"Stefano Di Pentima","registrationType":"registered"}),
    withStats(player("Alessandro Comentale", "MID", 76, 76, 70, 75, 23), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_2idasd","rosterIdentity":"alessandrocomentale","rosterStatus":"verified","rosterSourceIds":["it-team-cae"],"rosterCheckedAt":"2026-10-26","photoClub":"FC Caesar","photoLeague":"italy","photoName":"Alessandro Comentale","registrationType":"registered"}),
    withStats(player("Daniel Esposito", "MID", 77, 82, 70, 77, 26), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_nwl75y","rosterIdentity":"danielesposito","rosterStatus":"verified","rosterSourceIds":["it-team-cae"],"rosterCheckedAt":"2026-10-26","photoClub":"FC Caesar","photoLeague":"italy","photoName":"Daniel Esposito","registrationType":"registered"}),
    withStats(player("Edoardo Massafra", "MID", 79, 81, 72, 80, 26), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1u03wux","rosterIdentity":"edoardomassafra","rosterStatus":"verified","rosterSourceIds":["it-team-cae"],"rosterCheckedAt":"2026-10-26","photoClub":"FC Caesar","photoLeague":"italy","photoName":"Edoardo Massafra","registrationType":"registered"}),
    withStats(player("Hamadi Zakaria", "MID", 79, 84, 74, 78, 27), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_fwmmam","rosterIdentity":"hamadizakaria","rosterStatus":"verified","rosterSourceIds":["it-team-cae"],"rosterCheckedAt":"2026-10-26","photoClub":"FC Caesar","photoLeague":"italy","photoName":"Hamadi Zakaria","registrationType":"registered"}),
    withStats(player("Riccardo Fiorella", "MID", 75, 80, 72, 75, 25), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_xmy1he","rosterIdentity":"riccardofiorella","rosterStatus":"verified","rosterSourceIds":["it-team-cae"],"rosterCheckedAt":"2026-10-26","photoClub":"FC Caesar","photoLeague":"italy","photoName":"Riccardo Fiorella","registrationType":"registered"}),
    withStats(player("Ergys Ballgjini", "ATT", 85, 83, 74, 77, 27), {"overall":80,"value":68834,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1qommqn","rosterIdentity":"ergysballgjini","rosterStatus":"verified","rosterSourceIds":["it-team-cae"],"rosterCheckedAt":"2026-10-26","photoClub":"FC Caesar","photoLeague":"italy","photoName":"Ergys Ballgjini","registrationType":"registered"}),
    withStats(player("Remo Masoello Perlino", "ATT", 80, 80, 73, 74, 26), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_cr3qkr","rosterIdentity":"remomasoelloperlino","rosterStatus":"verified","rosterSourceIds":["it-team-cae"],"rosterCheckedAt":"2026-10-26","photoClub":"FC Caesar","photoLeague":"italy","photoName":"Remo Masoello Perlino","registrationType":"registered"}),
  ] },
  { ...{"id":"g7f","name":"Gear 7 FC","color":"#5a6472","budget":300000,"coach":"Ivan Brocchieri","presidents":["Manuuxo"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["it-team-g7f","it-wildcards"]}, players: [
    withStats(player("Joan Oriol", "DEF", 80, 88, 89, 90, 34), {"overall":87,"value":94202,"goals":5,"matches":4,"id":"roster_hlvxoo","rosterIdentity":"joanoriol","rosterStatus":"verified","rosterSourceIds":["it-team-g7f"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Troncos FC","photoLeague":"spain","photoName":"Joan Oriol","baselineOrigin":{"league":"spain","teamId":"ltf","name":"Joan Oriol"},"registrationType":"registered"}),
    withStats(player("Luis García", "MID", 65, 68, 64, 65, 27), {"overall":66,"value":38646,"goals":16,"assists":8,"matches":11,"id":"roster_173bexr","rosterIdentity":"luisgarcia","rosterStatus":"verified","rosterSourceIds":["it-team-g7f"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Luis García","baselineOrigin":{"league":"spain","teamId":"pio","name":"Luis García"},"registrationType":"registered"}),
    withStats(player("Adri Espinar", "ATT", 68, 69, 64, 59, 23), {"overall":65,"value":37414,"goals":20,"assists":3,"matches":12,"id":"roster_19tl5e3","rosterIdentity":"adriespinar","rosterStatus":"verified","rosterSourceIds":["it-team-g7f"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"PIO FC","photoLeague":"spain","photoName":"Adri Espinar","baselineOrigin":{"league":"spain","teamId":"pio","name":"Adri Espinar"},"registrationType":"registered"}),
    withStats(player("Antonio Iuliano", "GK", 74, 80, 88, 85, 29), {"overall":82,"value":75318,"matches":14,"id":"roster_1tjt2s2","rosterIdentity":"antonioiuliano","rosterStatus":"verified","rosterSourceIds":["it-team-g7f"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Boomers","photoLeague":"italy","photoName":"Antonio Iuliano","baselineOrigin":{"league":"italy","teamId":"boo","name":"Antonio Iuliano"},"registrationType":"registered"}),
    withStats(player("Valerio Anane", "GK", 68, 64, 77, 75, 26), {"overall":71,"value":46564,"matches":10,"id":"roster_ioqthy","rosterIdentity":"valerioanane","rosterStatus":"verified","rosterSourceIds":["it-team-g7f"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Gear 7 FC","photoLeague":"italy","photoName":"Valerio Anane","baselineOrigin":{"league":"italy","teamId":"g7f","name":"Valerio Anane"},"registrationType":"registered"}),
    withStats(player("Angelo Panarello", "DEF", 81, 77, 86, 81, 23), {"overall":81,"value":72002,"goals":4,"matches":11,"id":"roster_1nq1qal","rosterIdentity":"angelopanarello","rosterStatus":"verified","rosterSourceIds":["it-team-g7f"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Gear 7 FC","photoLeague":"italy","photoName":"Angelo Panarello","baselineOrigin":{"league":"italy","teamId":"g7f","name":"Angelo Panarello"},"registrationType":"registered"}),
    withStats(player("Diego de la Mata", "DEF", 89, 80, 92, 94, 31), {"overall":89,"value":102877,"assists":1,"matches":3,"id":"roster_8j8gg2","rosterIdentity":"diegodelamata","rosterStatus":"verified","rosterSourceIds":["it-team-g7f"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"No Rules FC","photoLeague":"germany","photoName":"Diego de la Mata","baselineOrigin":{"league":"germany","teamId":"nrf","name":"Diego de la Mata"},"registrationType":"registered"}),
    withStats(player("Benito Dragone", "MID", 77, 79, 71, 78, 26), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1f7hcle","rosterIdentity":"benitodragone","rosterStatus":"verified","rosterSourceIds":["it-team-g7f"],"rosterCheckedAt":"2026-10-26","photoClub":"Gear 7 FC","photoLeague":"italy","photoName":"Benito Dragone","registrationType":"registered"}),
    withStats(player("Christophe Renault", "MID", 87, 91, 90, 90, 22), {"overall":90,"value":107464,"goals":7,"assists":1,"matches":11,"id":"roster_1mpc5lv","rosterIdentity":"christopherenault","rosterStatus":"verified","rosterSourceIds":["it-team-g7f"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Gear 7 FC","photoLeague":"italy","photoName":"Christophe Renault","baselineOrigin":{"league":"italy","teamId":"g7f","name":"Christophe Renault"},"registrationType":"registered"}),
    withStats(player("Emmanuele Garofalo", "MID", 76, 79, 71, 77, 24), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1vvstdf","rosterIdentity":"emmanuelegarofalo","rosterStatus":"verified","rosterSourceIds":["it-team-g7f"],"rosterCheckedAt":"2026-10-26","photoClub":"Gear 7 FC","photoLeague":"italy","photoName":"Emmanuele Garofalo","registrationType":"registered"}),
    withStats(player("Adrián de la Cruz", "ATT", 82, 79, 76, 73, 26), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1hezk","rosterIdentity":"adriandelacruz","rosterStatus":"verified","rosterSourceIds":["it-team-g7f"],"rosterCheckedAt":"2026-10-26","photoClub":"Gear 7 FC","photoLeague":"italy","photoName":"Adrián de la Cruz","registrationType":"registered"}),
    withStats(player("Jacopo Cerasani", "ATT", 81, 78, 76, 72, 25), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1cz9mhb","rosterIdentity":"jacopocerasani","rosterStatus":"verified","rosterSourceIds":["it-team-g7f"],"rosterCheckedAt":"2026-10-26","photoClub":"Gear 7 FC","photoLeague":"italy","photoName":"Jacopo Cerasani","registrationType":"registered"}),
  ] },
  { ...{"id":"stl","name":"Stallions","color":"#1f5fa8","budget":300000,"coach":"Diego Franzè","presidents":["Blur"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["it-team-stl","it-wildcards"]}, players: [
    withStats(player("Carles Planas", "DEF", 70, 79, 87, 86, 33), {"overall":81,"value":72002,"goals":2,"assists":1,"matches":4,"id":"roster_1s2yx3s","rosterIdentity":"carlesplanas","rosterStatus":"verified","rosterSourceIds":["it-team-stl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Troncos FC","photoLeague":"spain","photoName":"Carles Planas","baselineOrigin":{"league":"spain","teamId":"ltf","name":"Carles Planas"},"registrationType":"registered"}),
    withStats(player("Nico Santos", "ATT", 89, 91, 82, 80, 23), {"overall":86,"value":90110,"goals":1,"matches":2,"id":"roster_1m5s63i","rosterIdentity":"nicosantos","rosterStatus":"verified","rosterSourceIds":["it-team-stl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Porcinos FC","photoLeague":"spain","photoName":"Nico Santos","baselineOrigin":{"league":"spain","teamId":"por","name":"Nico Santos"},"registrationType":"registered"}),
    withStats(player("Alessio Buono", "GK", 84, 85, 87, 92, 27), {"overall":87,"value":94202,"matches":12,"id":"roster_1eodjs6","rosterIdentity":"alessiobuono","rosterStatus":"verified","rosterSourceIds":["it-team-stl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Zeta Como","photoLeague":"italy","photoName":"Alessio Buono","baselineOrigin":{"league":"italy","teamId":"zco","name":"Alessio Buono"},"registrationType":"registered"}),
    withStats(player("Gianluca Bressan", "GK", 78, 84, 86, 91, 21), {"overall":85,"value":86178,"id":"roster_2p03oh","rosterIdentity":"gianlucabressan","rosterStatus":"verified","rosterSourceIds":["it-team-stl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Stallions","photoLeague":"italy","photoName":"Gianluca Bressan","baselineOrigin":{"league":"italy","teamId":"stl","name":"Gianluca Bressan"},"registrationType":"registered"}),
    withStats(player("Alessandro Di Dio", "DEF", 77, 77, 91, 83, 20), {"overall":82,"value":75318,"goals":1,"assists":1,"matches":12,"id":"roster_iq7ohu","rosterIdentity":"alessandrodidio","rosterStatus":"verified","rosterSourceIds":["it-team-stl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"TRM FC","photoLeague":"italy","photoName":"Alessandro Di Dio","baselineOrigin":{"league":"italy","teamId":"trm","name":"Alessandro Di Dio"},"registrationType":"registered"}),
    withStats(player("Marco Evangelisti", "DEF", 86, 86, 97, 90, 19), {"overall":90,"value":107464,"assists":1,"matches":3,"id":"roster_14kgjok","rosterIdentity":"marcoevangelisti","rosterStatus":"verified","rosterSourceIds":["it-team-stl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Stallions","photoLeague":"italy","photoName":"Marco Evangelisti","baselineOrigin":{"league":"italy","teamId":"stl","name":"Marco Evangelisti"},"registrationType":"registered"}),
    withStats(player("Alessandro Gelsi", "MID", 76, 83, 74, 81, 29), {"overall":79,"value":65810,"goals":4,"assists":1,"matches":6,"id":"roster_135zjl7","rosterIdentity":"alessandrogelsi","rosterStatus":"verified","rosterSourceIds":["it-team-stl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Alpak FC","photoLeague":"italy","photoName":"Alessandro Gelsi","baselineOrigin":{"league":"italy","teamId":"alp","name":"Alessandro Gelsi"},"registrationType":"registered"}),
    withStats(player("Ivan Altamura", "MID", 78, 81, 74, 76, 26), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_135xuw4","rosterIdentity":"ivanaltamura","rosterStatus":"verified","rosterSourceIds":["it-team-stl"],"rosterCheckedAt":"2026-10-26","photoClub":"Stallions","photoLeague":"italy","photoName":"Ivan Altamura","registrationType":"registered"}),
    withStats(player("Niccolò Marino", "MID", 77, 72, 66, 71, 23), {"overall":72,"value":48512,"goals":1,"matches":3,"id":"roster_t5myje","rosterIdentity":"niccolomarino","rosterStatus":"verified","rosterSourceIds":["it-team-stl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Stallions","photoLeague":"italy","photoName":"Niccolò Marino","baselineOrigin":{"league":"italy","teamId":"stl","name":"Niccolò Marino"},"registrationType":"registered"}),
    withStats(player("Pietro Brusadelli", "MID", 71, 78, 69, 67, 25), {"overall":71,"value":46564,"matches":2,"id":"roster_1hyu5fb","rosterIdentity":"pietrobrusadelli","rosterStatus":"verified","rosterSourceIds":["it-team-stl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Stallions","photoLeague":"italy","photoName":"Pietro Brusadelli","baselineOrigin":{"league":"italy","teamId":"stl","name":"Pietro Brusadelli"},"registrationType":"registered"}),
    withStats(player("Dennis Stojkovic", "ATT", 79, 84, 74, 76, 18), {"overall":78,"value":62930,"goals":2,"assists":3,"matches":3,"id":"roster_nurpo0","rosterIdentity":"dennisstojkovic","rosterStatus":"verified","rosterSourceIds":["it-team-stl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Stallions","photoLeague":"italy","photoName":"Dennis Stojkovic","baselineOrigin":{"league":"italy","teamId":"stl","name":"Dennis Stojkovic"},"registrationType":"registered"}),
    withStats(player("Matteo Perrotti", "ATT", 77, 78, 76, 70, 35), {"overall":75,"value":55121,"goals":4,"assists":4,"matches":3,"id":"roster_15my8go","rosterIdentity":"matteoperrotti","rosterStatus":"verified","rosterSourceIds":["it-team-stl"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Underdogs FC","photoLeague":"italy","photoName":"Matteo Perrotti","baselineOrigin":{"league":"italy","teamId":"und","name":"Matteo Perrotti"},"registrationType":"registered"}),
  ] },
  { ...{"id":"trm","name":"TRM FC","color":"#c0392b","budget":300000,"coach":"Marco Bertoni","presidents":["TheRealMarzaa"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["it-team-trm","it-wildcards"]}, players: [
    withStats(player("Pablo Beguer", "ATT", 86, 90, 83, 72, 29), {"overall":83,"value":78785,"matches":2,"id":"roster_12ob1sb","rosterIdentity":"pablobeguer","rosterStatus":"verified","rosterSourceIds":["it-team-trm"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"La Capital CF","photoLeague":"spain","photoName":"Pablo Beguer","baselineOrigin":{"league":"spain","teamId":"lcc","name":"Pablo Beguer"},"registrationType":"registered"}),
    withStats(player("Alessandro Vagge", "GK", 73, 67, 76, 85, 21), {"overall":75,"value":55121,"matches":12,"id":"roster_1mwnl99","rosterIdentity":"alessandrovagge","rosterStatus":"verified","rosterSourceIds":["it-team-trm"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"TRM FC","photoLeague":"italy","photoName":"Alessandro Vagge","baselineOrigin":{"league":"italy","teamId":"trm","name":"Alessandro Vagge"},"registrationType":"registered"}),
    withStats(player("Koussay Amari", "GK", 62, 66, 79, 82, 23), {"overall":72,"value":48512,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_vd9wui","rosterIdentity":"koussayamari","rosterStatus":"verified","rosterSourceIds":["it-team-trm"],"rosterCheckedAt":"2026-10-26","photoClub":"TRM FC","photoLeague":"italy","photoName":"Koussay Amari","registrationType":"registered"}),
    withStats(player("Alessio Marcone", "DEF", 77, 74, 86, 82, 20), {"overall":80,"value":68834,"goals":1,"assists":1,"matches":11,"id":"roster_446r40","rosterIdentity":"alessiomarcone","rosterStatus":"verified","rosterSourceIds":["it-team-trm"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"TRM FC","photoLeague":"italy","photoName":"Alessio Marcone","baselineOrigin":{"league":"italy","teamId":"trm","name":"Alessio Marcone"},"registrationType":"registered"}),
    withStats(player("Carlos Filippi", "DEF", 84, 87, 89, 90, 27), {"overall":88,"value":98457,"matches":10,"id":"roster_748qty","rosterIdentity":"carlosfilippi","rosterStatus":"verified","rosterSourceIds":["it-team-trm"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"TRM FC","photoLeague":"italy","photoName":"Carlos Filippi","baselineOrigin":{"league":"italy","teamId":"trm","name":"Carlos Filippi"},"registrationType":"registered"}),
    withStats(player("Gonzalo Escudero", "DEF", 73, 69, 77, 77, 24), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_r1aoln","rosterIdentity":"gonzaloescudero","rosterStatus":"verified","rosterSourceIds":["it-team-trm"],"rosterCheckedAt":"2026-10-26","photoClub":"TRM FC","photoLeague":"italy","photoName":"Gonzalo Escudero","registrationType":"registered"}),
    withStats(player("Matteo Vincenzi", "DEF", 79, 76, 84, 79, 28), {"overall":80,"value":68834,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_14zfsh3","rosterIdentity":"matteovincenzi","rosterStatus":"verified","rosterSourceIds":["it-team-trm"],"rosterCheckedAt":"2026-10-26","photoClub":"TRM FC","photoLeague":"italy","photoName":"Matteo Vincenzi","registrationType":"registered"}),
    withStats(player("Tommaso Conte", "DEF", 76, 88, 88, 86, 22), {"overall":85,"value":86178,"goals":7,"assists":2,"matches":12,"id":"roster_32cnkm","rosterIdentity":"tommasoconte","rosterStatus":"verified","rosterSourceIds":["it-team-trm"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Circus FC","photoLeague":"italy","photoName":"Tommaso Conte","baselineOrigin":{"league":"italy","teamId":"cir","name":"Tommaso Conte"},"registrationType":"registered"}),
    withStats(player("Ernesto Pagliaro", "MID", 76, 84, 73, 77, 27), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_196sjkc","rosterIdentity":"ernestopagliaro","rosterStatus":"verified","rosterSourceIds":["it-team-trm"],"rosterCheckedAt":"2026-10-26","photoClub":"TRM FC","photoLeague":"italy","photoName":"Ernesto Pagliaro","registrationType":"registered"}),
    withStats(player("Simone Isacco", "MID", 77, 82, 76, 82, 28), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_12lmfrm","rosterIdentity":"simoneisacco","rosterStatus":"verified","rosterSourceIds":["it-team-trm"],"rosterCheckedAt":"2026-10-26","photoClub":"TRM FC","photoLeague":"italy","photoName":"Simone Isacco","registrationType":"registered"}),
    withStats(player("Kevin Girgenti", "ATT", 76, 79, 73, 63, 28), {"overall":73,"value":50586,"goals":8,"assists":2,"matches":12,"id":"roster_1amfsix","rosterIdentity":"kevingirgenti","rosterStatus":"verified","rosterSourceIds":["it-team-trm"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Zeta Como","photoLeague":"italy","photoName":"Kevin Girgenti","baselineOrigin":{"league":"italy","teamId":"zco","name":"Kevin Girgenti"},"registrationType":"registered"}),
    withStats(player("Simone Bramante", "ATT", 84, 84, 80, 79, 29), {"overall":82,"value":75318,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_qtspoe","rosterIdentity":"simonebramante","rosterStatus":"verified","rosterSourceIds":["it-team-trm"],"rosterCheckedAt":"2026-10-26","photoClub":"TRM FC","photoLeague":"italy","photoName":"Simone Bramante","registrationType":"registered"}),
  ] },
  { ...{"id":"und","name":"Underdogs FC","color":"#2f8f4f","budget":300000,"coach":"Dario Sibio","presidents":["Mirko Cisco","Il Rosso"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["it-team-und","it-wildcards"]}, players: [
    withStats(player("Nadir Louah", "DEF", 79, 78, 85, 82, 25), {"overall":81,"value":72002,"matches":2,"id":"roster_v1petw","rosterIdentity":"nadirlouah","rosterStatus":"verified","rosterSourceIds":["it-team-und"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Porcinos FC","photoLeague":"spain","photoName":"Nadir Louah","baselineOrigin":{"league":"spain","teamId":"por","name":"Nadir Louah"},"registrationType":"registered"}),
    withStats(player("Alessio D'Aniello", "GK", 63, 68, 82, 83, 25), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_13oq9tf","rosterIdentity":"alessiodaniello","rosterStatus":"verified","rosterSourceIds":["it-team-und"],"rosterCheckedAt":"2026-10-26","photoClub":"Underdogs FC","photoLeague":"italy","photoName":"Alessio D'Aniello","registrationType":"registered"}),
    withStats(player("Gianmarco Chironi", "GK", 81, 88, 91, 97, 25), {"overall":89,"value":102877,"matches":3,"id":"roster_n24qyc","rosterIdentity":"gianmarcochironi","rosterStatus":"verified","rosterSourceIds":["it-team-und"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Underdogs FC","photoLeague":"italy","photoName":"Gianmarco Chironi","baselineOrigin":{"league":"italy","teamId":"und","name":"Gianmarco Chironi"},"registrationType":"registered"}),
    withStats(player("Andrea Calandra", "DEF", 73, 72, 77, 75, 23), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_mevpe6","rosterIdentity":"andreacalandra","rosterStatus":"verified","rosterSourceIds":["it-team-und"],"rosterCheckedAt":"2026-10-26","photoClub":"Underdogs FC","photoLeague":"italy","photoName":"Andrea Calandra","registrationType":"registered"}),
    withStats(player("Andrea Gorgoglione", "DEF", 70, 70, 76, 72, 21), {"overall":72,"value":48512,"matches":3,"id":"roster_8oxhba","rosterIdentity":"andreagorgoglione","rosterStatus":"verified","rosterSourceIds":["it-team-und"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Underdogs FC","photoLeague":"italy","photoName":"Andrea Gorgoglione","baselineOrigin":{"league":"italy","teamId":"und","name":"Andrea Gorgoglione"},"registrationType":"registered"}),
    withStats(player("Omar Nejmi", "DEF", 79, 76, 82, 82, 29), {"overall":80,"value":68834,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_15dm8vh","rosterIdentity":"omarnejmi","rosterStatus":"verified","rosterSourceIds":["it-team-und"],"rosterCheckedAt":"2026-10-26","photoClub":"Underdogs FC","photoLeague":"italy","photoName":"Omar Nejmi","registrationType":"registered"}),
    withStats(player("Alessandro Cannataro", "MID", 83, 88, 84, 90, 24), {"overall":86,"value":90110,"matches":3,"id":"roster_1xldj3w","rosterIdentity":"alessandrocannataro","rosterStatus":"verified","rosterSourceIds":["it-team-und"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Underdogs FC","photoLeague":"italy","photoName":"Alessandro Cannataro","baselineOrigin":{"league":"italy","teamId":"und","name":"Alessandro Cannataro"},"registrationType":"registered"}),
    withStats(player("Domenico Rossi", "MID", 84, 86, 79, 82, 27), {"overall":83,"value":78785,"goals":2,"matches":3,"id":"roster_ql5j23","rosterIdentity":"domenicorossi","rosterStatus":"verified","rosterSourceIds":["it-team-und"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Underdogs FC","photoLeague":"italy","photoName":"Domenico Rossi","baselineOrigin":{"league":"italy","teamId":"und","name":"Domenico Rossi"},"registrationType":"registered"}),
    withStats(player("Gerard Nolla", "ATT", 90, 83, 81, 80, 23), {"overall":84,"value":82404,"goals":10,"assists":4,"matches":10,"ratingSum":83,"id":"roster_t1jrb0","rosterIdentity":"gerardnolla","rosterStatus":"verified","rosterSourceIds":["it-team-und"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Capim FC","photoLeague":"brazil","photoName":"Gerard Nolla","baselineOrigin":{"league":"brazil","teamId":"cap","name":"Gerard Nolla"},"registrationType":"registered"}),
    withStats(player("Jorginho Fernandes", "ATT", 88, 83, 79, 84, 26), {"overall":84,"value":82404,"goals":1,"matches":3,"id":"roster_1p2xsa7","rosterIdentity":"jorginhofernandes","rosterStatus":"verified","rosterSourceIds":["it-team-und"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Underdogs FC","photoLeague":"italy","photoName":"Jorginho Fernandes","baselineOrigin":{"league":"italy","teamId":"und","name":"Jorginho Fernandes"},"registrationType":"registered"}),
    withStats(player("Mattia Invernizzi", "ATT", 82, 80, 74, 72, 24), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_wgnb0h","rosterIdentity":"mattiainvernizzi","rosterStatus":"verified","rosterSourceIds":["it-team-und"],"rosterCheckedAt":"2026-10-26","photoClub":"Underdogs FC","photoLeague":"italy","photoName":"Mattia Invernizzi","registrationType":"registered"}),
    withStats(player("Mirko Montalbano", "ATT", 80, 81, 73, 72, 26), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1mxx5h4","rosterIdentity":"mirkomontalbano","rosterStatus":"verified","rosterSourceIds":["it-team-und"],"rosterCheckedAt":"2026-10-26","photoClub":"Underdogs FC","photoLeague":"italy","photoName":"Mirko Montalbano","registrationType":"registered"}),
  ] },
  { ...{"id":"zeb","name":"Zebras FC","color":"#454545","budget":300000,"coach":"Mareglen Mhillaj","presidents":["Luca Campolunghi"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["it-team-zeb","it-wildcards"]}, players: [
    withStats(player("Alberto Calabrò", "GK", 68, 69, 84, 80, 29), {"overall":75,"value":55121,"matches":11,"id":"roster_rii0ko","rosterIdentity":"albertocalabro","rosterStatus":"verified","rosterSourceIds":["it-team-zeb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Zebras FC","photoLeague":"italy","photoName":"Alberto Calabrò","baselineOrigin":{"league":"italy","teamId":"zeb","name":"Alberto Calabrò"},"registrationType":"registered"}),
    withStats(player("Luca Mascherpa", "GK", 65, 69, 70, 70, 29), {"overall":69,"value":43038,"matches":4,"id":"roster_1diqz7m","rosterIdentity":"lucamascherpa","rosterStatus":"verified","rosterSourceIds":["it-team-zeb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Zebras FC","photoLeague":"italy","photoName":"Luca Mascherpa","baselineOrigin":{"league":"italy","teamId":"zeb","name":"Luca Mascherpa"},"registrationType":"registered"}),
    withStats(player("Fabio Varoli", "DEF", 75, 76, 83, 77, 27), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_6huqor","rosterIdentity":"fabiovaroli","rosterStatus":"verified","rosterSourceIds":["it-team-zeb"],"rosterCheckedAt":"2026-10-26","photoClub":"Zebras FC","photoLeague":"italy","photoName":"Fabio Varoli","registrationType":"registered"}),
    withStats(player("Andrea Meta", "MID", 76, 76, 67, 77, 23), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_5pt60j","rosterIdentity":"andreameta","rosterStatus":"verified","rosterSourceIds":["it-team-zeb"],"rosterCheckedAt":"2026-10-26","photoClub":"Zebras FC","photoLeague":"italy","photoName":"Andrea Meta","registrationType":"registered"}),
    withStats(player("Andrea Schenetti", "MID", 77, 83, 74, 81, 27), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_6deuh1","rosterIdentity":"andreaschenetti","rosterStatus":"verified","rosterSourceIds":["it-team-zeb"],"rosterCheckedAt":"2026-10-26","photoClub":"Zebras FC","photoLeague":"italy","photoName":"Andrea Schenetti","registrationType":"registered"}),
    withStats(player("Daniele Prato", "MID", 76, 80, 70, 76, 23), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_16pl62n","rosterIdentity":"danieleprato","rosterStatus":"verified","rosterSourceIds":["it-team-zeb"],"rosterCheckedAt":"2026-10-26","photoClub":"Zebras FC","photoLeague":"italy","photoName":"Daniele Prato","registrationType":"registered"}),
    withStats(player("Manolo Mosciaro", "MID", 89, 90, 87, 91, 27), {"overall":89,"value":102877,"goals":2,"matches":10,"id":"roster_1k3wep6","rosterIdentity":"manolomosciaro","rosterStatus":"verified","rosterSourceIds":["it-team-zeb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Boomers","photoLeague":"italy","photoName":"Manolo Mosciaro","baselineOrigin":{"league":"italy","teamId":"boo","name":"Manolo Mosciaro"},"registrationType":"registered"}),
    withStats(player("Matia Iervolino", "MID", 81, 78, 80, 81, 31), {"overall":80,"value":68834,"goals":1,"matches":11,"id":"roster_1tz1obq","rosterIdentity":"matiaiervolino","rosterStatus":"verified","rosterSourceIds":["it-team-zeb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Zebras FC","photoLeague":"italy","photoName":"Matia Iervolino","baselineOrigin":{"league":"italy","teamId":"zeb","name":"Matia Iervolino"},"registrationType":"registered"}),
    withStats(player("Emanuele Bardelloni", "ATT", 93, 95, 87, 87, 24), {"overall":91,"value":112221,"goals":13,"assists":3,"matches":13,"id":"roster_24eyhn","rosterIdentity":"emanuelebardelloni","rosterStatus":"verified","rosterSourceIds":["it-team-zeb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Zebras FC","photoLeague":"italy","photoName":"Emanuele Bardelloni","baselineOrigin":{"league":"italy","teamId":"zeb","name":"Emanuele Bardelloni"},"registrationType":"registered"}),
    withStats(player("Emanuele Romanini", "ATT", 79, 79, 71, 73, 23), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1rrjl1g","rosterIdentity":"emanueleromanini","rosterStatus":"verified","rosterSourceIds":["it-team-zeb"],"rosterCheckedAt":"2026-10-26","photoClub":"Zebras FC","photoLeague":"italy","photoName":"Emanuele Romanini","registrationType":"registered"}),
    withStats(player("Giuseppe De Luca", "ATT", 80, 79, 75, 75, 25), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_fxdhwb","rosterIdentity":"giuseppedeluca","rosterStatus":"verified","rosterSourceIds":["it-team-zeb"],"rosterCheckedAt":"2026-10-26","photoClub":"Zebras FC","photoLeague":"italy","photoName":"Giuseppe De Luca","registrationType":"registered"}),
    withStats(player("Nicolas Kalaja", "ATT", 71, 72, 70, 65, 22), {"overall":70,"value":44740,"goals":4,"assists":1,"matches":13,"id":"roster_129kzm0","rosterIdentity":"nicolaskalaja","rosterStatus":"verified","rosterSourceIds":["it-team-zeb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Boomers","photoLeague":"italy","photoName":"Nicolas Kalaja","baselineOrigin":{"league":"italy","teamId":"boo","name":"Nicolas Kalaja"},"registrationType":"registered"}),
    withStats(player("Salvatore Lillo", "ATT", 92, 97, 86, 81, 24), {"overall":89,"value":102877,"goals":9,"assists":3,"matches":11,"id":"roster_1uau8ua","rosterIdentity":"salvatorelillo","rosterStatus":"verified","rosterSourceIds":["it-team-zeb"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Zebras FC","photoLeague":"italy","photoName":"Salvatore Lillo","baselineOrigin":{"league":"italy","teamId":"zeb","name":"Salvatore Lillo"},"registrationType":"registered"}),
    withStats(player("Raoul Squitieri", "DEF", 77, 76, 85, 78, 28), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_11bmkgp","rosterIdentity":"raoulsquitieri","rosterStatus":"verified","rosterSourceIds":["it-team-zeb","it-wildcards"],"rosterCheckedAt":"2026-10-26","photoClub":"Zebras FC","photoLeague":"italy","photoName":"Raoul Squitieri","registrationType":"wildcard"}),
  ] },
  { ...{"id":"zco","name":"Zeta Como","color":"#1e3a5f","budget":300000,"coach":"Cristian Brocchi","presidents":["ZW Jackson","Luca Toni"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["it-team-zco","it-wildcards"]}, players: [
    withStats(player("Andrea Bianchi", "GK", 66, 70, 83, 87, 28), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1ac8916","rosterIdentity":"andreabianchi","rosterStatus":"verified","rosterSourceIds":["it-team-zco"],"rosterCheckedAt":"2026-10-26","photoClub":"Zeta Como","photoLeague":"italy","photoName":"Andrea Bianchi","registrationType":"registered"}),
    withStats(player("Samuele Guddo", "GK", 75, 68, 77, 83, 26), {"overall":76,"value":57588,"matches":3,"id":"roster_560fcy","rosterIdentity":"samueleguddo","rosterStatus":"verified","rosterSourceIds":["it-team-zco"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Stallions","photoLeague":"italy","photoName":"Samuele Guddo","baselineOrigin":{"league":"italy","teamId":"stl","name":"Samuele Guddo"},"registrationType":"registered"}),
    withStats(player("Michael Kabamba", "DEF", 63, 61, 76, 71, 25), {"overall":68,"value":41457,"goals":1,"matches":10,"id":"roster_1axbec7","rosterIdentity":"michaelkabamba","rosterStatus":"verified","rosterSourceIds":["it-team-zco"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Zeta Como","photoLeague":"italy","photoName":"Michael Kabamba","baselineOrigin":{"league":"italy","teamId":"zco","name":"Michael Kabamba"},"registrationType":"registered"}),
    withStats(player("Stefan Kladar", "DEF", 73, 71, 81, 74, 26), {"overall":75,"value":55121,"goals":5,"matches":11,"id":"roster_m6d7sr","rosterIdentity":"stefankladar","rosterStatus":"verified","rosterSourceIds":["it-team-zco"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Zeta Como","photoLeague":"italy","photoName":"Stefan Kladar","baselineOrigin":{"league":"italy","teamId":"zco","name":"Stefan Kladar"},"registrationType":"registered"}),
    withStats(player("Dilan Mojica", "MID", 76, 81, 71, 79, 25), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_5m7e8g","rosterIdentity":"dilanmojica","rosterStatus":"verified","rosterSourceIds":["it-team-zco"],"rosterCheckedAt":"2026-10-26","photoClub":"Zeta Como","photoLeague":"italy","photoName":"Dilan Mojica","registrationType":"registered"}),
    withStats(player("Gabriele Geraci", "MID", 92, 89, 89, 94, 27), {"overall":91,"value":112221,"goals":4,"assists":1,"matches":12,"id":"roster_jxl9ih","rosterIdentity":"gabrielegeraci","rosterStatus":"verified","rosterSourceIds":["it-team-zco"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Zeta Como","photoLeague":"italy","photoName":"Gabriele Geraci","baselineOrigin":{"league":"italy","teamId":"zco","name":"Gabriele Geraci"},"registrationType":"registered"}),
    withStats(player("Imad Tijani", "MID", 80, 81, 79, 80, 21), {"overall":80,"value":68834,"goals":2,"matches":11,"id":"roster_49xsg5","rosterIdentity":"imadtijani","rosterStatus":"verified","rosterSourceIds":["it-team-zco"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"D-POWER","photoLeague":"italy","photoName":"Imad Tijani","baselineOrigin":{"league":"italy","teamId":"dpw","name":"Imad Tijani"},"registrationType":"registered"}),
    withStats(player("Kevin Caporale", "MID", 77, 79, 71, 75, 24), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1qpx8kl","rosterIdentity":"kevincaporale","rosterStatus":"verified","rosterSourceIds":["it-team-zco"],"rosterCheckedAt":"2026-10-26","photoClub":"Zeta Como","photoLeague":"italy","photoName":"Kevin Caporale","registrationType":"registered"}),
    withStats(player("Oussama M'Hamsi", "MID", 96, 91, 90, 91, 22), {"overall":92,"value":117151,"goals":7,"assists":2,"matches":12,"id":"roster_1ezbgnz","rosterIdentity":"oussamamhamsi","rosterStatus":"verified","rosterSourceIds":["it-team-zco"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Zeta Como","photoLeague":"italy","photoName":"Oussama M'Hamsi","baselineOrigin":{"league":"italy","teamId":"zco","name":"Oussama M'Hamsi"},"registrationType":"registered"}),
    withStats(player("Angelo Azzara", "ATT", 79, 76, 71, 69, 23), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_kz7yc4","rosterIdentity":"angeloazzara","rosterStatus":"verified","rosterSourceIds":["it-team-zco"],"rosterCheckedAt":"2026-10-26","photoClub":"Zeta Como","photoLeague":"italy","photoName":"Angelo Azzara","registrationType":"registered"}),
    withStats(player("Gabriele Giacchino", "ATT", 87, 90, 82, 77, 23), {"overall":84,"value":82404,"goals":15,"assists":4,"matches":12,"id":"roster_g5fvi9","rosterIdentity":"gabrielegiacchino","rosterStatus":"verified","rosterSourceIds":["it-team-zco"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Zeta Como","photoLeague":"italy","photoName":"Gabriele Giacchino","baselineOrigin":{"league":"italy","teamId":"zco","name":"Gabriele Giacchino"},"registrationType":"registered"}),
    withStats(player("Giovanni Kean", "ATT", 84, 80, 72, 68, 20), {"overall":76,"value":57588,"goals":5,"assists":1,"matches":8,"id":"roster_1v5a0g1","rosterIdentity":"giovannikean","rosterStatus":"verified","rosterSourceIds":["it-team-zco"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Gear 7 FC","photoLeague":"italy","photoName":"Giovanni Kean","baselineOrigin":{"league":"italy","teamId":"g7f","name":"Giovanni Kean"},"registrationType":"registered"}),
    withStats(player("Marco Longoni", "MID", 79, 82, 76, 81, 29), {"overall":80,"value":68834,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1mnx1xx","rosterIdentity":"marcolongoni","rosterStatus":"verified","rosterSourceIds":["it-team-zco","it-wildcards"],"rosterCheckedAt":"2026-10-26","photoClub":"Zeta Como","photoLeague":"italy","photoName":"Marco Longoni","registrationType":"wildcard"}),
  ] },
];

const GERMANY_TEAMS = [
  { ...{"id":"erc","name":"ERA Colonia","color":"#7a3fa0","budget":300000,"coach":"Ilija Simunovic","presidents":["Zarbex","Filow"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["de-team-erc","mercato-2026"]}, players: [
    withStats(player("Dylan Bos", "GK", 88, 81, 97, 95, 22), {"overall":90,"value":107464,"matches":2,"id":"roster_hksb43","rosterIdentity":"dylanbos","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc","de-player-84669"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Dylan Bos","baselineOrigin":{"league":"germany","teamId":"erc","name":"Dylan Bos"},"officialPlayerId":"84669","birthDate":"2004-02-21"}),
    withStats(player("Daniel Maus", "GK", 63, 71, 84, 81, 32), {"overall":75,"value":55121,"matches":5,"id":"roster_121jj5k","rosterIdentity":"danielmaus","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc","de-player-79888","de-wild-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Daniel Maus","baselineOrigin":{"league":"germany","teamId":"erc","name":"Daniel Maus"},"officialPlayerId":"79888","birthDate":"1994-08-16","registrationType":"wildcard"}),
    withStats(player("Jakov Suver", "DEF", 86, 75, 93, 84, 20), {"overall":85,"value":86178,"matches":2,"id":"roster_pzuzl","rosterIdentity":"jakovsuver","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Jakov Suver","baselineOrigin":{"league":"germany","teamId":"erc","name":"Jakov Suver"},"officialPlayerId":"87044"}),
    withStats(player("Nico Czichi", "DEF", 88, 82, 95, 94, 31), {"overall":90,"value":107464,"matches":6,"id":"roster_wok6ek","rosterIdentity":"nicoczichi","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc","de-player-80040"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Nico Czichi","baselineOrigin":{"league":"germany","teamId":"erc","name":"Nico Czichi"},"officialPlayerId":"80040","birthDate":"1995-02-08"}),
    withStats(player("Joshua Holtby", "MID", 87, 90, 83, 83, 24), {"overall":86,"value":90110,"goals":1,"matches":3,"id":"roster_yi3fmz","rosterIdentity":"joshuaholtby","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Joshua Holtby","baselineOrigin":{"league":"germany","teamId":"erc","name":"Joshua Holtby"},"officialPlayerId":"87397"}),
    withStats(player("Yoel Yilma", "MID", 86, 87, 85, 92, 27), {"overall":88,"value":98457,"matches":7,"id":"roster_139f6y0","rosterIdentity":"yoelyilma","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc","de-player-87043"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Yoel Yilma","baselineOrigin":{"league":"germany","teamId":"erc","name":"Yoel Yilma"},"officialPlayerId":"87043","birthDate":"1999-03-29"}),
    withStats(player("Moritz Leitner", "MID", 89, 90, 89, 90, 33), {"overall":90,"value":107464,"goals":5,"assists":4,"matches":5,"id":"roster_1817jr5","rosterIdentity":"moritzleitner","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc","de-player-79600","de-wild-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Moritz Leitner","baselineOrigin":{"league":"germany","teamId":"erc","name":"Moritz Leitner"},"officialPlayerId":"79600","birthDate":"1992-12-08","registrationType":"wildcard"}),
    withStats(player("Philipp Klement", "MID", 79, 77, 76, 79, 34), {"overall":78,"value":62930,"goals":18,"assists":3,"matches":7,"id":"roster_g5si07","rosterIdentity":"philippklement","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc","de-player-84686","de-wild-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Philipp Klement","baselineOrigin":{"league":"germany","teamId":"erc","name":"Philipp Klement"},"officialPlayerId":"84686","birthDate":"1992-09-09","registrationType":"wildcard"}),
    withStats(player("Abdelaziz Slimi", "ATT", 86, 77, 81, 70, 31), {"overall":79,"value":65810,"assists":1,"matches":7,"id":"roster_bmsc9d","rosterIdentity":"abdelazizslimi","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc","de-player-79636","de-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Abdelaziz Slimi","baselineOrigin":{"league":"germany","teamId":"erc","name":"Abdelaziz Slimi"},"officialPlayerId":"79636","birthDate":"1995-08-14","registrationType":"registered"}),
    withStats(player("Ahmed Azirar", "ATT", 87, 86, 80, 76, 27), {"overall":82,"value":75318,"matches":7,"id":"roster_1u4utl1","rosterIdentity":"ahmedazirar","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc","de-player-84670"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Ahmed Azirar","baselineOrigin":{"league":"germany","teamId":"erc","name":"Ahmed Azirar"},"officialPlayerId":"84670","birthDate":"1999-05-13"}),
    withStats(player("Dennis de Sousa", "ATT", 97, 90, 94, 87, 30), {"overall":92,"value":117151,"goals":3,"assists":1,"matches":5,"id":"roster_1s88022","rosterIdentity":"dennisdesousa","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc","de-player-87394"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Dennis de Sousa","baselineOrigin":{"league":"germany","teamId":"erc","name":"Dennis de Sousa"},"officialPlayerId":"87394","birthDate":"1996-06-26"}),
    withStats(player("Elias Römers", "ATT", 74, 74, 68, 64, 22), {"overall":70,"value":44740,"id":"roster_emuwu9","rosterIdentity":"eliasromers","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc","de-player-87045"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Elias Römers","baselineOrigin":{"league":"germany","teamId":"erc","name":"Elias Römers"},"officialPlayerId":"87045","birthDate":"2004-01-17"}),
    withStats(player("Erkan Kurucam", "ATT", 81, 74, 70, 61, 39), {"overall":72,"value":48512,"matches":2,"id":"roster_1ysntlk","rosterIdentity":"erkankurucam","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc","de-player-87042"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Erkan Kurucam","baselineOrigin":{"league":"germany","teamId":"erc","name":"Erkan Kurucam"},"officialPlayerId":"87042","birthDate":"1987-05-16"}),
    withStats(player("Etienne Reck", "ATT", 78, 70, 69, 67, 21), {"overall":71,"value":46564,"goals":3,"assists":1,"matches":5,"id":"roster_10hf0ym","rosterIdentity":"etiennereck","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc","de-player-84966"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Etienne Reck","baselineOrigin":{"league":"germany","teamId":"erc","name":"Etienne Reck"},"officialPlayerId":"84966","birthDate":"2005-05-04"}),
    withStats(player("Mounir Bouziane", "ATT", 87, 80, 79, 73, 35), {"overall":80,"value":68834,"goals":1,"matches":6,"id":"roster_1k8i5y2","rosterIdentity":"mounirbouziane","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc","de-player-85942"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Mounir Bouziane","baselineOrigin":{"league":"germany","teamId":"erc","name":"Mounir Bouziane"},"officialPlayerId":"85942","birthDate":"1991-02-05"}),
    withStats(player("Fatjon Celani", "ATT", 87, 85, 80, 73, 20), {"overall":81,"value":72002,"matches":1,"id":"roster_kk29pd","rosterIdentity":"fatjoncelani","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-erc"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"ERA Colonia","photoLeague":"germany","photoName":"Fatjon Celani","baselineOrigin":{"league":"germany","teamId":"erc","name":"Fatjon Celani"},"officialPlayerId":"87488"}),
  ] },
  { ...{"id":"g2f","name":"G2 FC","color":"#d9691e","budget":300000,"coach":"Malik Hadziavdic","presidents":["MoAuba","Konygebony"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["de-team-g2f","mercato-2026"]}, players: [
    withStats(player("Ben Zöllner", "GK", 79, 81, 92, 96, 30), {"overall":87,"value":94202,"matches":4,"id":"roster_1kk1cj6","rosterIdentity":"benzollner","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-g2f"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"G2 FC","photoLeague":"germany","photoName":"Ben Zöllner","baselineOrigin":{"league":"germany","teamId":"g2f","name":"Ben Zöllner"},"officialPlayerId":"86944"}),
    withStats(player("Jack Krause", "GK", 73, 74, 93, 93, 22), {"overall":83,"value":78785,"matches":9,"id":"roster_awlapd","rosterIdentity":"jackkrause","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-g2f"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"G2 FC","photoLeague":"germany","photoName":"Jack Krause","baselineOrigin":{"league":"germany","teamId":"g2f","name":"Jack Krause"},"officialPlayerId":"86946"}),
    withStats(player("Ahmed Omairat", "DEF", 85, 80, 90, 88, 24), {"overall":86,"value":90110,"goals":1,"assists":1,"matches":9,"id":"roster_n2eyi7","rosterIdentity":"ahmedomairat","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-g2f","de-player-79640","de-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"G2 FC","photoLeague":"germany","photoName":"Ahmed Omairat","baselineOrigin":{"league":"germany","teamId":"g2f","name":"Ahmed Omairat"},"officialPlayerId":"79640","birthDate":"2002-03-21","registrationType":"registered"}),
    withStats(player("Cihan Ucar", "DEF", 78, 74, 88, 87, 32), {"overall":82,"value":75318,"goals":4,"assists":3,"matches":9,"id":"roster_1mwg6mf","rosterIdentity":"cihanucar","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-g2f","de-player-79646","de-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"G2 FC","photoLeague":"germany","photoName":"Cihan Ucar","baselineOrigin":{"league":"germany","teamId":"g2f","name":"Cihan Ucar"},"officialPlayerId":"79646","birthDate":"1994-07-06","registrationType":"registered"}),
    withStats(player("Mehmet-Can Senocak", "MID", 80, 76, 69, 77, 23), {"overall":76,"value":57588,"goals":21,"assists":1,"matches":9,"id":"roster_9p47d7","rosterIdentity":"mehmetcansenocak","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-g2f","de-player-84668"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"G2 FC","photoLeague":"germany","photoName":"Mehmet-Can Senocak","baselineOrigin":{"league":"germany","teamId":"g2f","name":"Mehmet-Can Senocak"},"officialPlayerId":"84668","birthDate":"2002-11-02"}),
    withStats(player("Staas Mitko", "MID", 84, 90, 87, 93, 34), {"overall":89,"value":102877,"matches":9,"id":"roster_1kguxsr","rosterIdentity":"staasmitko","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-g2f"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"G2 FC","photoLeague":"germany","photoName":"Staas Mitko","baselineOrigin":{"league":"germany","teamId":"g2f","name":"Staas Mitko"},"officialPlayerId":"84666"}),
    withStats(player("Tarik Hadziavdic", "MID", 64, 69, 70, 73, 26), {"overall":69,"value":43038,"goals":4,"assists":5,"matches":9,"id":"roster_15l6m69","rosterIdentity":"tarikhadziavdic","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-g2f","de-player-79643","de-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"G2 FC","photoLeague":"germany","photoName":"Tarik Hadziavdic","baselineOrigin":{"league":"germany","teamId":"g2f","name":"Tarik Hadziavdic"},"officialPlayerId":"79643","birthDate":"2000-10-17","registrationType":"registered"}),
    withStats(player("Smajo Jakupovic", "MID", 78, 81, 71, 81, 31), {"overall":78,"value":62930,"matches":1,"id":"roster_mbih23","rosterIdentity":"smajojakupovic","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-g2f","de-player-87572"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"G2 FC","photoLeague":"germany","photoName":"Smajo Jakupovic","baselineOrigin":{"league":"germany","teamId":"g2f","name":"Smajo Jakupovic"},"officialPlayerId":"87572","birthDate":"1995-08-26"}),
    withStats(player("Dennis Öztürk", "ATT", 90, 89, 91, 89, 25), {"overall":90,"value":107464,"goals":4,"assists":1,"matches":9,"id":"roster_31lltn","rosterIdentity":"dennisozturk","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-g2f","de-player-79562","de-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"G2 FC","photoLeague":"germany","photoName":"Dennis Öztürk","baselineOrigin":{"league":"germany","teamId":"g2f","name":"Dennis Öztürk"},"officialPlayerId":"79562","birthDate":"2001-04-24","registrationType":"registered"}),
    withStats(player("Halit Bacak", "ATT", 93, 92, 88, 82, 35), {"overall":89,"value":102877,"goals":1,"matches":9,"id":"roster_1f93mbz","rosterIdentity":"halitbacak","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-g2f"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"G2 FC","photoLeague":"germany","photoName":"Halit Bacak","baselineOrigin":{"league":"germany","teamId":"g2f","name":"Halit Bacak"},"officialPlayerId":"86945"}),
    withStats(player("Artin Zardoshtian", "ATT", 78, 80, 76, 77, 22), {"overall":78,"value":62930,"goals":4,"assists":4,"matches":4,"id":"roster_8znurs","rosterIdentity":"artinzardoshtian","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-g2f","de-player-84667","de-wild-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"G2 FC","photoLeague":"germany","photoName":"Artin Zardoshtian","baselineOrigin":{"league":"germany","teamId":"g2f","name":"Artin Zardoshtian"},"officialPlayerId":"84667","birthDate":"2004-06-27","registrationType":"wildcard"}),
    withStats(player("Kenan Smajlovic", "ATT", 81, 82, 76, 67, 29), {"overall":77,"value":60190,"goals":4,"matches":9,"id":"roster_9n3exq","rosterIdentity":"kenansmajlovic","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-g2f"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"G2 FC","photoLeague":"germany","photoName":"Kenan Smajlovic","baselineOrigin":{"league":"germany","teamId":"g2f","name":"Kenan Smajlovic"},"officialPlayerId":"86943"}),
    withStats(player("Mohammed Izal", "ATT", 82, 83, 71, 74, 26), {"overall":78,"value":62930,"goals":5,"assists":2,"matches":9,"id":"roster_1wvw0tn","rosterIdentity":"mohammedizal","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-g2f","de-player-84664","de-wild-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"G2 FC","photoLeague":"germany","photoName":"Mohammed Izal","baselineOrigin":{"league":"germany","teamId":"g2f","name":"Mohammed Izal"},"officialPlayerId":"84664","birthDate":"2000-02-26","registrationType":"wildcard"}),
  ] },
  { ...{"id":"ist","name":"Istanbul United","color":"#b8202a","budget":300000,"coach":"","presidents":["Hasan Ali Kaldirim","Mert"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["de-team-ist","mercato-2026"]}, players: [
    withStats(player("Niklas Reichel", "GK", 62, 72, 81, 84, 31), {"overall":75,"value":55121,"matches":7,"id":"roster_gokkaj","rosterIdentity":"niklasreichel","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist","de-player-87189"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Niklas Reichel","baselineOrigin":{"league":"germany","teamId":"ist","name":"Niklas Reichel"},"officialPlayerId":"87189","birthDate":"1995-10-14"}),
    withStats(player("Eric Ulrich", "GK", 73, 79, 85, 85, 23), {"overall":81,"value":72002,"matches":1,"id":"roster_5daw25","rosterIdentity":"ericulrich","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Eric Ulrich","baselineOrigin":{"league":"germany","teamId":"ist","name":"Eric Ulrich"},"officialPlayerId":"87555"}),
    withStats(player("Burak Mus", "DEF", 90, 86, 92, 88, 29), {"overall":89,"value":102877,"goals":1,"matches":6,"id":"roster_1zo6vt","rosterIdentity":"burakmus","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist","de-player-87191"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Burak Mus","baselineOrigin":{"league":"germany","teamId":"ist","name":"Burak Mus"},"officialPlayerId":"87191","birthDate":"1996-12-24"}),
    withStats(player("Kerem Sengün", "DEF", 83, 85, 95, 91, 26), {"overall":89,"value":102877,"goals":5,"assists":2,"matches":7,"id":"roster_6aa303","rosterIdentity":"keremsengun","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist","de-player-87190"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Kerem Sengün","baselineOrigin":{"league":"germany","teamId":"ist","name":"Kerem Sengün"},"officialPlayerId":"87190","birthDate":"2000-01-25"}),
    withStats(player("Mardochee Tchakoumi", "DEF", 75, 64, 76, 73, 28), {"overall":72,"value":48512,"assists":1,"matches":6,"id":"roster_35ysu4","rosterIdentity":"mardocheetchakoumi","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist","de-player-87196"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Mardochee Tchakoumi","baselineOrigin":{"league":"germany","teamId":"ist","name":"Mardochee Tchakoumi"},"officialPlayerId":"87196","birthDate":"1998-08-16"}),
    withStats(player("Burak Özmen", "DEF", 85, 84, 87, 88, 29), {"overall":86,"value":90110,"matches":1,"id":"roster_1fu8m05","rosterIdentity":"burakozmen","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist","de-player-87199"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Burak Özmen","baselineOrigin":{"league":"germany","teamId":"ist","name":"Burak Özmen"},"officialPlayerId":"87199","birthDate":"1997-08-23"}),
    withStats(player("Murat Saglam", "MID", 83, 92, 80, 91, 28), {"overall":87,"value":94202,"goals":5,"assists":3,"matches":8,"id":"roster_vsbsoj","rosterIdentity":"muratsaglam","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist","de-player-87202"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Murat Saglam","baselineOrigin":{"league":"germany","teamId":"ist","name":"Murat Saglam"},"officialPlayerId":"87202","birthDate":"1998-04-10"}),
    withStats(player("Oliver Lanwer", "MID", 80, 76, 74, 72, 35), {"overall":76,"value":57588,"goals":1,"matches":8,"id":"roster_1f2484x","rosterIdentity":"oliverlanwer","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist","de-player-87193"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Oliver Lanwer","baselineOrigin":{"league":"germany","teamId":"ist","name":"Oliver Lanwer"},"officialPlayerId":"87193","birthDate":"1991-03-09"}),
    withStats(player("Yousef Keshta", "MID", 84, 88, 77, 84, 20), {"overall":83,"value":78785,"goals":2,"assists":1,"matches":8,"id":"roster_1s20kqi","rosterIdentity":"yousefkeshta","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Yousef Keshta","baselineOrigin":{"league":"germany","teamId":"ist","name":"Yousef Keshta"},"officialPlayerId":"87194"}),
    withStats(player("Ilias Arssi", "MID", 89, 93, 77, 89, 29), {"overall":87,"value":94202,"assists":1,"matches":4,"id":"roster_ve3mh9","rosterIdentity":"iliasarssi","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist","de-player-87261"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Ilias Arssi","baselineOrigin":{"league":"germany","teamId":"ist","name":"Ilias Arssi"},"officialPlayerId":"87261","birthDate":"1996-10-27"}),
    withStats(player("Max Wilschrey", "ATT", 86, 84, 76, 74, 30), {"overall":80,"value":68834,"goals":1,"assists":1,"matches":6,"id":"roster_ltmylh","rosterIdentity":"maxwilschrey","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist","de-player-87195"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Max Wilschrey","baselineOrigin":{"league":"germany","teamId":"ist","name":"Max Wilschrey"},"officialPlayerId":"87195","birthDate":"1995-12-30"}),
    withStats(player("Umut Yildiz", "ATT", 73, 72, 67, 59, 26), {"overall":68,"value":41457,"goals":3,"matches":8,"id":"roster_1ns5xb","rosterIdentity":"umutyildiz","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Umut Yildiz","baselineOrigin":{"league":"germany","teamId":"ist","name":"Umut Yildiz"},"officialPlayerId":"87192"}),
    withStats(player("Ali Hassan Hammoud", "ATT", 78, 78, 76, 74, 27), {"overall":77,"value":60190,"matches":3,"id":"roster_1drruf4","rosterIdentity":"alihassanhammoud","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist","de-player-87345"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Ali Hassan Hammoud","baselineOrigin":{"league":"germany","teamId":"ist","name":"Ali Hassan Hammoud"},"officialPlayerId":"87345","birthDate":"1999-08-03"}),
    withStats(player("Amir Ahmadi", "ATT", 69, 72, 63, 67, 24), {"overall":68,"value":41457,"goals":4,"assists":1,"matches":7,"id":"roster_vpw19o","rosterIdentity":"amirahmadi","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist","de-player-87198"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Amir Ahmadi","baselineOrigin":{"league":"germany","teamId":"ist","name":"Amir Ahmadi"},"officialPlayerId":"87198","birthDate":"2002-02-18"}),
    withStats(player("Jama Telli", "ATT", 88, 83, 78, 81, 30), {"overall":83,"value":78785,"goals":2,"assists":1,"matches":4,"id":"roster_1xb5cqw","rosterIdentity":"jamatelli","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist","de-player-71716","de-wild-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Jama Telli","baselineOrigin":{"league":"germany","teamId":"ist","name":"Jama Telli"},"officialPlayerId":"71716","birthDate":"1996-03-26","registrationType":"wildcard"}),
    withStats(player("Sangar Aziz", "ATT", 69, 75, 68, 59, 28), {"overall":68,"value":41457,"goals":10,"assists":3,"matches":8,"id":"roster_11ryg4x","rosterIdentity":"sangaraziz","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ist","de-player-87197"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Istanbul United","photoLeague":"germany","photoName":"Sangar Aziz","baselineOrigin":{"league":"germany","teamId":"ist","name":"Sangar Aziz"},"officialPlayerId":"87197","birthDate":"1998-09-27"}),
  ] },
  { ...{"id":"kak","name":"Kaktus Kickers","color":"#3a9d5c","budget":300000,"coach":"Dominic Reinold","presidents":["Trymacs","Nici"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["de-team-kak","mercato-2026"]}, players: [
    withStats(player("Kaan Gökcesin", "GK", 78, 85, 95, 97, 29), {"overall":89,"value":102877,"matches":7,"id":"roster_1ll2t5l","rosterIdentity":"kaangokcesin","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Kaan Gökcesin","baselineOrigin":{"league":"germany","teamId":"kak","name":"Kaan Gökcesin"},"officialPlayerId":"87339"}),
    withStats(player("Lennard Hövel", "GK", 77, 84, 91, 84, 24), {"overall":84,"value":82404,"matches":1,"id":"roster_1ng1p9p","rosterIdentity":"lennardhovel","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Lennard Hövel","baselineOrigin":{"league":"germany","teamId":"kak","name":"Lennard Hövel"},"officialPlayerId":"86952"}),
    withStats(player("Daniel Bleja", "DEF", 74, 72, 80, 74, 26), {"overall":75,"value":55121,"assists":1,"matches":8,"id":"roster_vgorly","rosterIdentity":"danielbleja","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Daniel Bleja","baselineOrigin":{"league":"germany","teamId":"kak","name":"Daniel Bleja"},"officialPlayerId":"86951"}),
    withStats(player("Dario Bezerra", "DEF", 63, 66, 73, 72, 25), {"overall":69,"value":43038,"goals":1,"assists":1,"matches":8,"id":"roster_xo06tf","rosterIdentity":"dariobezerra","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Dario Bezerra","baselineOrigin":{"league":"germany","teamId":"kak","name":"Dario Bezerra"},"officialPlayerId":"86955"}),
    withStats(player("Taner Yalcin", "DEF", 71, 60, 74, 65, 36), {"overall":68,"value":41457,"goals":1,"assists":2,"matches":6,"id":"roster_btmtff","rosterIdentity":"taneryalcin","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak","de-player-84678"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Taner Yalcin","baselineOrigin":{"league":"germany","teamId":"kak","name":"Taner Yalcin"},"officialPlayerId":"84678","birthDate":"1990-02-18"}),
    withStats(player("Fabian Djemail", "DEF", 79, 85, 96, 83, 20), {"overall":86,"value":90110,"matches":4,"id":"roster_9vlgj0","rosterIdentity":"fabiandjemail","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Fabian Djemail","baselineOrigin":{"league":"germany","teamId":"kak","name":"Fabian Djemail"},"officialPlayerId":"86953"}),
    withStats(player("Mohamed Rabia", "DEF", 72, 79, 89, 75, 26), {"overall":79,"value":65810,"goals":1,"matches":4,"id":"roster_1w8g80b","rosterIdentity":"mohamedrabia","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak","de-player-87329"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Mohamed Rabia","baselineOrigin":{"league":"germany","teamId":"kak","name":"Mohamed Rabia"},"officialPlayerId":"87329","birthDate":"2000-08-29"}),
    withStats(player("Thomas Haas", "DEF", 68, 64, 80, 70, 32), {"overall":71,"value":46564,"goals":4,"assists":1,"matches":5,"id":"roster_1laef46","rosterIdentity":"thomashaas","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Thomas Haas","baselineOrigin":{"league":"germany","teamId":"kak","name":"Thomas Haas"},"officialPlayerId":"86947"}),
    withStats(player("Jacob Göker", "MID", 70, 83, 76, 76, 26), {"overall":76,"value":57588,"matches":5,"id":"roster_1pdvx54","rosterIdentity":"jacobgoker","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak","de-player-87462"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Jacob Göker","baselineOrigin":{"league":"germany","teamId":"kak","name":"Jacob Göker"},"officialPlayerId":"87462","birthDate":"2000-01-22"}),
    withStats(player("Nick Mwaura Hirschfeld", "MID", 71, 67, 62, 73, 23), {"overall":68,"value":41457,"matches":2,"id":"roster_16httvr","rosterIdentity":"nickmwaurahirschfeld","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Nick Mwaura Hirschfeld","baselineOrigin":{"league":"germany","teamId":"kak","name":"Nick Mwaura Hirschfeld"},"officialPlayerId":"87463"}),
    withStats(player("Bilal Akgüvercin", "MID", 70, 74, 70, 80, 34), {"overall":74,"value":52788,"matches":1,"id":"roster_1x0xkyk","rosterIdentity":"bilalakguvercin","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak","de-player-87536"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Bilal Akgüvercin","baselineOrigin":{"league":"germany","teamId":"kak","name":"Bilal Akgüvercin"},"officialPlayerId":"87536","birthDate":"1992-07-12"}),
    withStats(player("Bilal Abdallah", "ATT", 86, 89, 81, 80, 30), {"overall":84,"value":82404,"matches":4,"id":"roster_2c2kzc","rosterIdentity":"bilalabdallah","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak","de-player-85147"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Bilal Abdallah","baselineOrigin":{"league":"germany","teamId":"kak","name":"Bilal Abdallah"},"officialPlayerId":"85147","birthDate":"1995-12-06"}),
    withStats(player("Gaspard Fehlinger", "ATT", 91, 88, 87, 81, 28), {"overall":87,"value":94202,"goals":7,"assists":4,"matches":8,"id":"roster_1qb8d8h","rosterIdentity":"gaspardfehlinger","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak","de-player-86959"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Gaspard Fehlinger","baselineOrigin":{"league":"germany","teamId":"kak","name":"Gaspard Fehlinger"},"officialPlayerId":"86959","birthDate":"1998-05-11"}),
    withStats(player("Mohamed Dahas", "ATT", 89, 91, 79, 72, 31), {"overall":83,"value":78785,"goals":3,"assists":4,"matches":6,"id":"roster_1a0ldll","rosterIdentity":"mohameddahas","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak","de-player-86950"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Mohamed Dahas","baselineOrigin":{"league":"germany","teamId":"kak","name":"Mohamed Dahas"},"officialPlayerId":"86950","birthDate":"1995-07-02"}),
    withStats(player("Noah Can", "ATT", 93, 87, 80, 76, 24), {"overall":84,"value":82404,"goals":3,"assists":1,"matches":8,"id":"roster_1lq3mjz","rosterIdentity":"noahcan","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak","de-player-80042"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Noah Can","baselineOrigin":{"league":"germany","teamId":"kak","name":"Noah Can"},"officialPlayerId":"80042","birthDate":"2002-04-16"}),
    withStats(player("Yazid Tambo", "ATT", 88, 94, 88, 83, 23), {"overall":88,"value":98457,"goals":3,"assists":2,"matches":7,"id":"roster_1pxfdfz","rosterIdentity":"yazidtambo","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak","de-player-85146"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Yazid Tambo","baselineOrigin":{"league":"germany","teamId":"kak","name":"Yazid Tambo"},"officialPlayerId":"85146","birthDate":"2003-02-24"}),
    withStats(player("Bernad Gllogjani", "ATT", 94, 97, 86, 81, 34), {"overall":90,"value":107464,"goals":1,"matches":2,"id":"roster_kwpbpg","rosterIdentity":"bernadgllogjani","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Bernad Gllogjani","baselineOrigin":{"league":"germany","teamId":"kak","name":"Bernad Gllogjani"},"officialPlayerId":"87522"}),
    withStats(player("Elias Beck", "ATT", 80, 74, 72, 66, 25), {"overall":73,"value":50586,"goals":8,"assists":2,"matches":6,"id":"roster_1updy3s","rosterIdentity":"eliasbeck","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-kak","de-player-86956"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Kaktus Kickers","photoLeague":"germany","photoName":"Elias Beck","baselineOrigin":{"league":"germany","teamId":"kak","name":"Elias Beck"},"officialPlayerId":"86956","birthDate":"2001-09-23"}),
  ] },
  { ...{"id":"nrf","name":"No Rules FC","color":"#a52020","budget":300000,"coach":"Francisco Copado","presidents":["Brazzos","Bilal Kamarieh","Jordan","Semih"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["de-team-nrf","mercato-2026"]}, players: [
    withStats(player("Fabio Rasic", "GK", 81, 79, 96, 97, 24), {"overall":88,"value":98457,"matches":3,"id":"roster_1f9ykj0","rosterIdentity":"fabiorasic","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-nrf","de-player-71127","de-draft-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"No Rules FC","photoLeague":"germany","photoName":"Fabio Rasic","baselineOrigin":{"league":"germany","teamId":"nrf","name":"Fabio Rasic"},"officialPlayerId":"71127","birthDate":"2002-09-06","registrationType":"registered"}),
    withStats(player("Daniel Jelisic", "DEF", 68, 68, 73, 73, 26), {"overall":71,"value":46564,"assists":1,"matches":3,"id":"roster_aemeyh","rosterIdentity":"danieljelisic","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-nrf","de-player-79494","de-draft-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"No Rules FC","photoLeague":"germany","photoName":"Daniel Jelisic","baselineOrigin":{"league":"germany","teamId":"nrf","name":"Daniel Jelisic"},"officialPlayerId":"79494","birthDate":"2000-02-18","registrationType":"registered"}),
    withStats(player("Diren Günay", "DEF", 85, 79, 93, 91, 23), {"overall":87,"value":94202,"goals":2,"matches":3,"id":"roster_1cbf6a5","rosterIdentity":"direngunay","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-nrf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"No Rules FC","photoLeague":"germany","photoName":"Diren Günay","baselineOrigin":{"league":"germany","teamId":"nrf","name":"Diren Günay"},"officialPlayerId":"87689"}),
    withStats(player("Ensar Skrijelj", "DEF", 78, 81, 88, 87, 26), {"overall":84,"value":82404,"matches":3,"id":"roster_113f4go","rosterIdentity":"ensarskrijelj","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-nrf","de-player-79485","de-draft-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"No Rules FC","photoLeague":"germany","photoName":"Ensar Skrijelj","baselineOrigin":{"league":"germany","teamId":"nrf","name":"Ensar Skrijelj"},"officialPlayerId":"79485","birthDate":"1999-12-16","registrationType":"registered"}),
    withStats(player("Albin Zekiri", "MID", 78, 83, 71, 74, 18), {"overall":77,"value":60190,"matches":3,"id":"roster_1uhm43d","rosterIdentity":"albinzekiri","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-nrf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"No Rules FC","photoLeague":"germany","photoName":"Albin Zekiri","baselineOrigin":{"league":"germany","teamId":"nrf","name":"Albin Zekiri"},"officialPlayerId":"84968"}),
    withStats(player("Amar Cekic", "MID", 78, 79, 74, 82, 28), {"overall":78,"value":62930,"matches":3,"id":"roster_19tv0y1","rosterIdentity":"amarcekic","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"No Rules FC","photoLeague":"germany","photoName":"Amar Cekic","baselineOrigin":{"league":"germany","teamId":"nrf","name":"Amar Cekic"}}),
    withStats(player("Nick Salihamidžić", "MID", 93, 94, 81, 93, 22), {"overall":90,"value":107464,"matches":3,"id":"roster_15rwtke","rosterIdentity":"nicksalihamidzic","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"No Rules FC","photoLeague":"germany","photoName":"Nick Salihamidžić","baselineOrigin":{"league":"germany","teamId":"nrf","name":"Nick Salihamidžić"}}),
    withStats(player("Anthony Manuba", "ATT", 76, 77, 72, 62, 23), {"overall":72,"value":48512,"matches":3,"id":"roster_15yyvzw","rosterIdentity":"anthonymanuba","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-nrf","de-player-71132","de-draft-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"No Rules FC","photoLeague":"germany","photoName":"Anthony Manuba","baselineOrigin":{"league":"germany","teamId":"nrf","name":"Anthony Manuba"},"officialPlayerId":"71132","birthDate":"2003-07-12","registrationType":"registered"}),
    withStats(player("Gilles Vidal", "ATT", 82, 84, 72, 70, 27), {"overall":77,"value":60190,"goals":3,"matches":3,"id":"roster_yj6mot","rosterIdentity":"gillesvidal","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"No Rules FC","photoLeague":"germany","photoName":"Gilles Vidal","baselineOrigin":{"league":"germany","teamId":"nrf","name":"Gilles Vidal"}}),
    withStats(player("Nam Nguyen", "ATT", 77, 80, 68, 72, 24), {"overall":74,"value":52788,"matches":2,"id":"roster_1m1c2vh","rosterIdentity":"namnguyen","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-nrf","de-player-79739","de-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"No Rules FC","photoLeague":"germany","photoName":"Nam Nguyen","baselineOrigin":{"league":"germany","teamId":"nrf","name":"Nam Nguyen"},"officialPlayerId":"79739","birthDate":"2002-06-17","registrationType":"registered"}),
    withStats(player("Serhat Imsak", "ATT", 83, 84, 80, 82, 27), {"overall":82,"value":75318,"goals":2,"assists":1,"matches":3,"id":"roster_106rv11","rosterIdentity":"serhatimsak","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-nrf","de-player-79484","de-draft-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"No Rules FC","photoLeague":"germany","photoName":"Serhat Imsak","baselineOrigin":{"league":"germany","teamId":"nrf","name":"Serhat Imsak"},"officialPlayerId":"79484","birthDate":"1999-07-20","registrationType":"registered"}),
  ] },
  { ...{"id":"ttf","name":"Tiki Tacker FF","color":"#34495e","budget":300000,"coach":"Selçuk Turan","presidents":["Papaplatte","BastiGHG","Jann-Fiete Arp"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["de-team-ttf","mercato-2026"]}, players: [
    withStats(player("Aboubakar Fofana", "GK", 82, 84, 90, 96, 29), {"overall":88,"value":98457,"matches":8,"id":"roster_1nhz82g","rosterIdentity":"aboubakarfofana","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ttf","de-player-80036"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Aboubakar Fofana","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Aboubakar Fofana"},"officialPlayerId":"80036","birthDate":"1997-03-07"}),
    withStats(player("Bennett Schauer", "GK", 79, 80, 89, 95, 27), {"overall":86,"value":90110,"id":"roster_dw4imi","rosterIdentity":"bennettschauer","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ttf","de-player-79553","de-wild-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Bennett Schauer","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Bennett Schauer"},"officialPlayerId":"79553","birthDate":"1999-04-25","registrationType":"wildcard"}),
    withStats(player("Jean Atohoun", "GK", 73, 75, 92, 86, 25), {"overall":82,"value":75318,"matches":2,"id":"roster_186xni5","rosterIdentity":"jeanatohoun","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ttf","de-player-86965"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Jean Atohoun","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Jean Atohoun"},"officialPlayerId":"86965","birthDate":"2001-08-27"}),
    withStats(player("Finn Hanke", "DEF", 75, 72, 85, 81, 32), {"overall":78,"value":62930,"goals":4,"assists":1,"matches":8,"id":"roster_dhh7rz","rosterIdentity":"finnhanke","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ttf","de-player-79545","de-draft-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Finn Hanke","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Finn Hanke"},"officialPlayerId":"79545","birthDate":"1994-04-22","registrationType":"registered"}),
    withStats(player("Nikola Stankovic", "DEF", 69, 73, 84, 79, 34), {"overall":76,"value":57588,"matches":4,"id":"roster_1lyon4z","rosterIdentity":"nikolastankovic","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ttf","de-player-84676"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Nikola Stankovic","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Nikola Stankovic"},"officialPlayerId":"84676","birthDate":"1992-08-20"}),
    withStats(player("Noah Dahaba", "DEF", 74, 73, 86, 79, 23), {"overall":78,"value":62930,"goals":2,"matches":8,"id":"roster_1oby3ya","rosterIdentity":"noahdahaba","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ttf","de-player-86967"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Noah Dahaba","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Noah Dahaba"},"officialPlayerId":"86967","birthDate":"2003-05-25"}),
    withStats(player("Philip Koch", "DEF", 82, 86, 87, 88, 35), {"overall":86,"value":90110,"goals":2,"matches":6,"id":"roster_t9vo8g","rosterIdentity":"philipkoch","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ttf","de-player-86969"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Philip Koch","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Philip Koch"},"officialPlayerId":"86969","birthDate":"1990-11-24"}),
    withStats(player("Zinedine Hukporti", "DEF", 80, 81, 89, 77, 29), {"overall":82,"value":75318,"goals":9,"assists":9,"matches":8,"id":"roster_1sm17xh","rosterIdentity":"zinedinehukporti","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Zinedine Hukporti","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Zinedine Hukporti"}}),
    withStats(player("Ephrahim Asante", "DEF", 71, 69, 82, 76, 28), {"overall":75,"value":55121,"matches":7,"id":"roster_c8n6xl","rosterIdentity":"ephrahimasante","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ttf","de-player-87264"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Ephrahim Asante","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Ephrahim Asante"},"officialPlayerId":"87264","birthDate":"1998-05-29"}),
    withStats(player("Farukhan Bulut", "DEF", 84, 90, 92, 92, 23), {"overall":90,"value":107464,"goals":3,"assists":3,"matches":6,"id":"roster_1pfx6ol","rosterIdentity":"farukhanbulut","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ttf","de-player-87396"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Farukhan Bulut","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Farukhan Bulut"},"officialPlayerId":"87396","birthDate":"2003-07-24"}),
    withStats(player("Lionel Lingani", "DEF", 86, 76, 91, 86, 25), {"overall":85,"value":86178,"matches":2,"id":"roster_2pahgk","rosterIdentity":"lionellingani","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ttf","de-player-87041"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Lionel Lingani","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Lionel Lingani"},"officialPlayerId":"87041","birthDate":"2001-10-17"}),
    withStats(player("Luca Freese", "DEF", 75, 74, 79, 79, 21), {"overall":77,"value":60190,"matches":3,"id":"roster_b6owwo","rosterIdentity":"lucafreese","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ttf","de-player-86963"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Luca Freese","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Luca Freese"},"officialPlayerId":"86963","birthDate":"2005-01-06"}),
    withStats(player("Diego Larralde", "MID", 89, 92, 85, 87, 24), {"overall":88,"value":98457,"goals":2,"assists":1,"matches":8,"id":"roster_vx8s9a","rosterIdentity":"diegolarralde","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ttf","de-player-84973"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Diego Larralde","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Diego Larralde"},"officialPlayerId":"84973","birthDate":"2002-03-27"}),
    withStats(player("Fabio Lopes", "MID", 90, 95, 89, 91, 27), {"overall":91,"value":112221,"goals":5,"matches":8,"id":"roster_1phsle5","rosterIdentity":"fabiolopes","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ttf","de-player-87263"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Fabio Lopes","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Fabio Lopes"},"officialPlayerId":"87263","birthDate":"1998-12-12"}),
    withStats(player("Marko Tadic", "ATT", 80, 72, 68, 64, 26), {"overall":71,"value":46564,"goals":3,"assists":1,"matches":8,"id":"roster_1fsd62a","rosterIdentity":"markotadic","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ttf","de-player-86966"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Marko Tadic","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Marko Tadic"},"officialPlayerId":"86966","birthDate":"2000-09-03"}),
    withStats(player("Mustafa Zazai", "ATT", 91, 81, 80, 74, 33), {"overall":82,"value":75318,"matches":1,"id":"roster_z15xnh","rosterIdentity":"mustafazazai","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-ttf","de-player-84675","de-wild-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Tiki Tacker FF","photoLeague":"germany","photoName":"Mustafa Zazai","baselineOrigin":{"league":"germany","teamId":"ttf","name":"Mustafa Zazai"},"officialPlayerId":"84675","birthDate":"1993-05-09","registrationType":"wildcard"}),
  ] },
  { ...{"id":"vvf","name":"Vice Versa FC","color":"#a68a3c","budget":300000,"coach":"Sebastian Sander","presidents":["Mario Götze","Ebru Önal","Farooo","Owomoyela"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["de-team-vvf","mercato-2026"]}, players: [
    withStats(player("Marvin Gomoluch", "GK", 65, 72, 78, 74, 26), {"overall":72,"value":48512,"matches":4,"id":"roster_sicdia","rosterIdentity":"marvingomoluch","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf","de-player-84687"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Marvin Gomoluch","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Marvin Gomoluch"},"officialPlayerId":"84687","birthDate":"2000-01-04"}),
    withStats(player("Yannick Marko", "GK", 78, 86, 90, 88, 24), {"overall":86,"value":90110,"matches":4,"id":"roster_3mkfqi","rosterIdentity":"yannickmarko","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf","de-player-84688","de-wild-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Yannick Marko","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Yannick Marko"},"officialPlayerId":"84688","birthDate":"2002-06-15","registrationType":"wildcard"}),
    withStats(player("Ali Alawie", "DEF", 73, 80, 84, 82, 23), {"overall":80,"value":68834,"goals":8,"assists":3,"matches":8,"id":"roster_170yv1k","rosterIdentity":"alialawie","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf","de-player-84691"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Ali Alawie","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Ali Alawie"},"officialPlayerId":"84691","birthDate":"2003-01-13"}),
    withStats(player("Constantin Pennartz", "DEF", 74, 66, 77, 71, 27), {"overall":72,"value":48512,"goals":1,"matches":8,"id":"roster_zuxfm8","rosterIdentity":"constantinpennartz","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf","de-player-84976"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Constantin Pennartz","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Constantin Pennartz"},"officialPlayerId":"84976","birthDate":"1999-01-21"}),
    withStats(player("Hagen Blohm", "DEF", 79, 74, 82, 78, 24), {"overall":78,"value":62930,"goals":10,"assists":2,"matches":8,"id":"roster_fx28l0","rosterIdentity":"hagenblohm","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf","de-player-84689"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Hagen Blohm","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Hagen Blohm"},"officialPlayerId":"84689","birthDate":"2002-10-05"}),
    withStats(player("Jannis Becker", "DEF", 85, 82, 88, 83, 32), {"overall":85,"value":86178,"goals":2,"matches":8,"id":"roster_15sr4q4","rosterIdentity":"jannisbecker","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf","de-player-79759"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Jannis Becker","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Jannis Becker"},"officialPlayerId":"79759","birthDate":"1994-07-09"}),
    withStats(player("Maurice Pluntke", "DEF", 87, 80, 94, 85, 25), {"overall":87,"value":94202,"matches":7,"id":"roster_wrcubg","rosterIdentity":"mauricepluntke","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Maurice Pluntke","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Maurice Pluntke"},"officialPlayerId":"84690"}),
    withStats(player("Saif-Ayadi", "DEF", 65, 64, 76, 75, 31), {"overall":70,"value":44740,"assists":1,"matches":4,"id":"roster_t0rq2c","rosterIdentity":"saifayadi","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf","de-player-86957"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Saif-Ayadi","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Saif-Ayadi"},"officialPlayerId":"86957","birthDate":"1994-11-04"}),
    withStats(player("Bo Lasse Henrichs", "DEF", 80, 70, 80, 75, 24), {"overall":76,"value":57588,"goals":1,"assists":1,"matches":2,"id":"roster_19plpxg","rosterIdentity":"bolassehenrichs","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Bo Lasse Henrichs","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Bo Lasse Henrichs"},"officialPlayerId":"87262"}),
    withStats(player("Nils Schütte", "DEF", 87, 81, 97, 91, 26), {"overall":89,"value":102877,"goals":2,"matches":2,"id":"roster_1ngb47v","rosterIdentity":"nilsschutte","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf","de-player-87271"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Nils Schütte","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Nils Schütte"},"officialPlayerId":"87271","birthDate":"2000-02-04"}),
    withStats(player("Sven Wurm", "DEF", 87, 86, 96, 84, 31), {"overall":88,"value":98457,"goals":3,"assists":1,"matches":6,"id":"roster_4xiz2e","rosterIdentity":"svenwurm","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf","de-player-86958"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Sven Wurm","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Sven Wurm"},"officialPlayerId":"86958","birthDate":"1995-04-11"}),
    withStats(player("Phil Spillmann", "DEF", 86, 80, 86, 90, 18), {"overall":86,"value":90110,"assists":1,"matches":1,"id":"roster_qj0610","rosterIdentity":"philspillmann","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Phil Spillmann","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Phil Spillmann"},"officialPlayerId":"87268"}),
    withStats(player("David Pütz", "MID", 95, 97, 85, 91, 29), {"overall":92,"value":117151,"goals":1,"assists":1,"matches":2,"id":"roster_ujbtgk","rosterIdentity":"davidputz","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf","de-player-79803","de-wild-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"David Pütz","baselineOrigin":{"league":"germany","teamId":"vvf","name":"David Pütz"},"officialPlayerId":"79803","birthDate":"1997-01-26","registrationType":"wildcard"}),
    withStats(player("Halil Doğan", "MID", 75, 77, 71, 72, 26), {"overall":74,"value":52788,"goals":1,"matches":4,"id":"roster_1ovh89g","rosterIdentity":"halildogan","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf","de-player-79827","de-wild-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Halil Doğan","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Halil Doğan"},"officialPlayerId":"79827","birthDate":"1999-11-19","registrationType":"wildcard"}),
    withStats(player("Thomas Idel", "MID", 82, 85, 78, 81, 24), {"overall":82,"value":75318,"goals":1,"matches":3,"id":"roster_b59swx","rosterIdentity":"thomasidel","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Thomas Idel","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Thomas Idel"},"officialPlayerId":"87395"}),
    withStats(player("Hussain Alawie", "ATT", 90, 84, 83, 78, 36), {"overall":84,"value":82404,"goals":2,"matches":8,"id":"roster_1r1gwjv","rosterIdentity":"hussainalawie","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf","de-player-84692"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Hussain Alawie","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Hussain Alawie"},"officialPlayerId":"84692","birthDate":"1990-09-10"}),
    withStats(player("Yassine Gnondi", "ATT", 86, 86, 79, 79, 28), {"overall":83,"value":78785,"goals":2,"matches":8,"id":"roster_1m1juc6","rosterIdentity":"yassinegnondi","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf","de-player-86962"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Yassine Gnondi","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Yassine Gnondi"},"officialPlayerId":"86962","birthDate":"1998-02-12"}),
    withStats(player("Francisco Garcia", "ATT", 87, 90, 78, 80, 35), {"overall":84,"value":82404,"id":"roster_m4f1x0","rosterIdentity":"franciscogarcia","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf","de-player-86961"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Francisco Garcia","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Francisco Garcia"},"officialPlayerId":"86961","birthDate":"1991-05-29"}),
    withStats(player("Nuredin Ali Khan", "ATT", 83, 79, 72, 72, 33), {"overall":77,"value":60190,"id":"roster_1fo1jmk","rosterIdentity":"nuredinalikhan","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Nuredin Ali Khan","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Nuredin Ali Khan"},"officialPlayerId":"79819"}),
    withStats(player("Cem Sabanci", "ATT", 81, 84, 72, 73, 26), {"overall":78,"value":62930,"matches":1,"id":"roster_11p3p65","rosterIdentity":"cemsabanci","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Cem Sabanci","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Cem Sabanci"},"officialPlayerId":"87461"}),
    withStats(player("Marvin Iskra", "ATT", 94, 94, 89, 83, 33), {"overall":90,"value":107464,"matches":1,"id":"roster_1hcp2j8","rosterIdentity":"marviniskra","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Marvin Iskra","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Marvin Iskra"},"officialPlayerId":"87487"}),
    withStats(player("Shpend Hasani", "ATT", 70, 69, 61, 64, 30), {"overall":66,"value":38646,"matches":1,"id":"roster_102per1","rosterIdentity":"shpendhasani","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-vvf","de-player-84694"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Vice Versa FC","photoLeague":"germany","photoName":"Shpend Hasani","baselineOrigin":{"league":"germany","teamId":"vvf","name":"Shpend Hasani"},"officialPlayerId":"84694","birthDate":"1996-03-24"}),
  ] },
  { ...{"id":"you","name":"Youniors F.C.","color":"#c2185b","budget":300000,"coach":"Mimoun Azaouagh","presidents":["Younes Zarou","LetsHugo"],"rosterStatus":"partial","rosterCheckedAt":"2026-10-26","rosterSourceIds":["de-team-you","mercato-2026"]}, players: [
    withStats(player("Max Wißmann", "GK", 66, 66, 79, 80, 21), {"overall":73,"value":50586,"matches":4,"id":"roster_1taiued","rosterIdentity":"maxwissmann","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-you","de-player-86948"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Max Wißmann","baselineOrigin":{"league":"germany","teamId":"you","name":"Max Wißmann"},"officialPlayerId":"86948","birthDate":"2005-01-16"}),
    withStats(player("Maximilian Krapf", "GK", 82, 91, 95, 97, 23), {"overall":91,"value":112221,"matches":9,"id":"roster_12vjk8s","rosterIdentity":"maximiliankrapf","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-you","de-player-79602","de-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Maximilian Krapf","baselineOrigin":{"league":"germany","teamId":"you","name":"Maximilian Krapf"},"officialPlayerId":"79602","birthDate":"2003-05-12","registrationType":"registered"}),
    withStats(player("Ahmed Azaouagh", "DEF", 69, 72, 76, 71, 32), {"overall":72,"value":48512,"matches":8,"id":"roster_zohml8","rosterIdentity":"ahmedazaouagh","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-you","de-player-53024","de-draft-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Ahmed Azaouagh","baselineOrigin":{"league":"germany","teamId":"you","name":"Ahmed Azaouagh"},"officialPlayerId":"53024","birthDate":"1994-06-20","registrationType":"registered"}),
    withStats(player("Emir Sejdovic", "DEF", 65, 60, 77, 69, 26), {"overall":68,"value":41457,"goals":3,"assists":2,"matches":10,"id":"roster_s7ngcn","rosterIdentity":"emirsejdovic","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-you","de-player-79644","de-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Emir Sejdovic","baselineOrigin":{"league":"germany","teamId":"you","name":"Emir Sejdovic"},"officialPlayerId":"79644","birthDate":"2000-04-25","registrationType":"registered"}),
    withStats(player("Henoc Agbessi", "DEF", 69, 68, 78, 69, 25), {"overall":71,"value":46564,"goals":1,"matches":2,"id":"roster_1sgbmcc","rosterIdentity":"henocagbessi","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-you","de-player-79625","de-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Henoc Agbessi","baselineOrigin":{"league":"germany","teamId":"you","name":"Henoc Agbessi"},"officialPlayerId":"79625","birthDate":"2001-07-24","registrationType":"registered"}),
    withStats(player("Sokratis Papastathopoulos", "DEF", 78, 77, 93, 83, 38), {"overall":83,"value":78785,"matches":3,"id":"roster_1dv02gi","rosterIdentity":"sokratispapastathopoulos","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-you","de-player-79891"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Sokratis Papastathopoulos","baselineOrigin":{"league":"germany","teamId":"you","name":"Sokratis Papastathopoulos"},"officialPlayerId":"79891","birthDate":"1988-06-09"}),
    withStats(player("Danny Blum", "DEF", 85, 86, 88, 88, 35), {"overall":87,"value":94202,"goals":1,"assists":1,"matches":4,"id":"roster_4oq4rt","rosterIdentity":"dannyblum","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-you","de-player-79622","de-wild-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Danny Blum","baselineOrigin":{"league":"germany","teamId":"you","name":"Danny Blum"},"officialPlayerId":"79622","birthDate":"1991-01-07","registrationType":"wildcard"}),
    withStats(player("Christian Clemens", "MID", 69, 70, 67, 67, 35), {"overall":68,"value":41457,"goals":3,"assists":1,"matches":10,"id":"roster_im86pb","rosterIdentity":"christianclemens","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-you","de-player-86954"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Christian Clemens","baselineOrigin":{"league":"germany","teamId":"you","name":"Christian Clemens"},"officialPlayerId":"86954","birthDate":"1991-08-04"}),
    withStats(player("Julien Vercauteren", "MID", 82, 87, 80, 89, 33), {"overall":85,"value":86178,"id":"roster_16yhd4","rosterIdentity":"julienvercauteren","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-you","de-player-53028","de-draft-1"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Julien Vercauteren","baselineOrigin":{"league":"germany","teamId":"you","name":"Julien Vercauteren"},"officialPlayerId":"53028","birthDate":"1993-01-12","registrationType":"registered"}),
    withStats(player("Naoufal Azzagari", "MID", 76, 83, 79, 76, 25), {"overall":79,"value":65810,"goals":5,"assists":2,"matches":7,"id":"roster_1aqumyc","rosterIdentity":"naoufalazzagari","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-you","de-player-86949"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Naoufal Azzagari","baselineOrigin":{"league":"germany","teamId":"you","name":"Naoufal Azzagari"},"officialPlayerId":"86949","birthDate":"2001-01-15"}),
    withStats(player("Luiz 'Pepinho' Souza", "MID", 69, 69, 69, 66, 26), {"overall":68,"value":41457,"goals":10,"assists":3,"matches":10,"id":"roster_1nvl188","rosterIdentity":"luizpepinhosouza","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Luiz 'Pepinho' Souza","baselineOrigin":{"league":"germany","teamId":"you","name":"Luiz 'Pepinho' Souza"}}),
    withStats(player("Jhon Palacios", "ATT", 79, 71, 72, 65, 20), {"overall":72,"value":48512,"goals":5,"assists":1,"matches":9,"id":"roster_18qu39o","rosterIdentity":"jhonpalacios","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Jhon Palacios","baselineOrigin":{"league":"germany","teamId":"you","name":"Jhon Palacios"}}),
    withStats(player("Lordan Handanovic", "ATT", 84, 87, 75, 73, 24), {"overall":80,"value":68834,"goals":1,"matches":4,"id":"roster_1x7k42e","rosterIdentity":"lordanhandanovic","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-you","de-player-79653","de-draft-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Lordan Handanovic","baselineOrigin":{"league":"germany","teamId":"you","name":"Lordan Handanovic"},"officialPlayerId":"79653","birthDate":"2001-11-10","registrationType":"registered"}),
    withStats(player("Marco Terrazzino", "ATT", 93, 95, 90, 81, 35), {"overall":90,"value":107464,"goals":2,"matches":5,"id":"roster_18j3snn","rosterIdentity":"marcoterrazzino","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-you","de-player-80486"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Marco Terrazzino","baselineOrigin":{"league":"germany","teamId":"you","name":"Marco Terrazzino"},"officialPlayerId":"80486","birthDate":"1991-04-15"}),
    withStats(player("Kevin Moreira", "ATT", 83, 82, 74, 72, 27), {"overall":78,"value":62930,"goals":1,"matches":3,"id":"roster_v3exsn","rosterIdentity":"kevinmoreira","rosterStatus":"retained-unverified","rosterSourceIds":["de-team-you","de-player-80492","de-wild-2"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"official-birth-date","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Kevin Moreira","baselineOrigin":{"league":"germany","teamId":"you","name":"Kevin Moreira"},"officialPlayerId":"80492","birthDate":"1999-04-20","registrationType":"wildcard"}),
    withStats(player("Maicon Silva", "ATT", 82, 80, 67, 72, 31), {"overall":75,"value":55121,"goals":1,"assists":1,"matches":6,"id":"roster_1u6l9t7","rosterIdentity":"maiconsilva","rosterStatus":"retained-unverified","rosterSourceIds":[],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Youniors F.C.","photoLeague":"germany","photoName":"Maicon Silva","baselineOrigin":{"league":"germany","teamId":"you","name":"Maicon Silva"}}),
  ] },
];

const MEXICO_TEAMS = [
  { ...{"id":"anq","name":"Aniquiladores FC","color":"#c0392b","budget":300000,"coach":"Sergio Pibe Verdirame","presidents":["Juan Guarnizo"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["mexico-anq-squad"],"officialTeamId":11}, players: [
    withStats(player("Martín 'Cani' Rodríguez", "DEF", 85, 83, 95, 90, 33), {"overall":88,"value":98457,"matches":2,"id":"roster_1p2uh4f","rosterIdentity":"canimartin","rosterStatus":"verified","rosterSourceIds":["mexico-anq-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Aniquiladores FC","photoLeague":"mexico","photoName":"Martín Cani Rodríguez","baselineOrigin":{"league":"mexico","teamId":"anq","name":"Martín Cani Rodríguez"},"shirtNumber":5}),
    withStats(player("Donovan Martínez", "MID", 83, 87, 84, 89, 19), {"overall":86,"value":90110,"goals":2,"assists":5,"matches":13,"id":"roster_o8cj0k","rosterIdentity":"donovanmartinez","rosterStatus":"verified","rosterSourceIds":["mexico-anq-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Raniza FC","photoLeague":"mexico","photoName":"Donovan Martínez","baselineOrigin":{"league":"mexico","teamId":"rnz","name":"Donovan Martínez"},"shirtNumber":9}),
    withStats(player("Daviz Junco", "MID", 74, 78, 74, 78, 35), {"overall":76,"value":57588,"matches":2,"id":"roster_19bbkme","rosterIdentity":"davizjunco","rosterStatus":"verified","rosterSourceIds":["mexico-anq-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Aniquiladores FC","photoLeague":"mexico","photoName":"Daviz Junco","baselineOrigin":{"league":"mexico","teamId":"anq","name":"Daviz Junco"},"shirtNumber":10}),
    withStats(player("Brihan Gutiérrez", "MID", 85, 89, 81, 84, 22), {"overall":85,"value":86178,"goals":1,"matches":2,"id":"roster_dzv6cw","rosterIdentity":"brihangutierrez","rosterStatus":"verified","rosterSourceIds":["mexico-anq-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Aniquiladores FC","photoLeague":"mexico","photoName":"Brihan Gutiérrez","baselineOrigin":{"league":"mexico","teamId":"anq","name":"Brihan Gutiérrez"},"shirtNumber":11}),
    withStats(player("Roberto Pérez", "ATT", 79, 72, 67, 68, 22), {"overall":72,"value":48512,"goals":3,"matches":11,"id":"roster_vzexqu","rosterIdentity":"robertoperez","rosterStatus":"verified","rosterSourceIds":["mexico-anq-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Simios FC","photoLeague":"mexico","photoName":"Roberto Pérez","baselineOrigin":{"league":"mexico","teamId":"sim","name":"Roberto Pérez"},"shirtNumber":14}),
    withStats(player("Ronal Quintero", "MID", 77, 78, 71, 74, 24), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1ye26mk","rosterIdentity":"ronalquintero","rosterStatus":"verified","rosterSourceIds":["mexico-anq-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Aniquiladores FC","photoLeague":"mexico","photoName":"Ronal Quintero","shirtNumber":17}),
    withStats(player("Jacob 'Lobo' Morales", "ATT", 90, 88, 86, 84, 21), {"overall":87,"value":94202,"matches":2,"id":"roster_hzl735","rosterIdentity":"jacoblobomorales","rosterStatus":"verified","rosterSourceIds":["mexico-anq-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Aniquiladores FC","photoLeague":"mexico","photoName":"Jacob Lobo Morales","baselineOrigin":{"league":"mexico","teamId":"anq","name":"Jacob Lobo Morales"},"shirtNumber":19}),
    withStats(player("Patricio 'Pato' Arias", "DEF", 74, 72, 83, 78, 23), {"overall":77,"value":60190,"matches":2,"id":"roster_1u3emxc","rosterIdentity":"patriciopatoarias","rosterStatus":"verified","rosterSourceIds":["mexico-anq-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Aniquiladores FC","photoLeague":"mexico","photoName":"Patricio Pato Arias","baselineOrigin":{"league":"mexico","teamId":"anq","name":"Patricio Pato Arias"},"shirtNumber":21}),
    withStats(player("Luis Robles", "GK", 64, 70, 83, 84, 27), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1mzqabb","rosterIdentity":"luisrobles","rosterStatus":"verified","rosterSourceIds":["mexico-anq-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Aniquiladores FC","photoLeague":"mexico","photoName":"Luis Robles","shirtNumber":30}),
    withStats(player("Andres Valiente", "MID", 73, 75, 69, 77, 23), {"overall":74,"value":52788,"matches":1,"id":"roster_1hhcdnq","rosterIdentity":"andresvaliente","rosterStatus":"verified","rosterSourceIds":["mexico-anq-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Galácticos del Caribe","photoLeague":"mexico","photoName":"Andres Valiente","baselineOrigin":{"league":"mexico","teamId":"gdc","name":"Andres Valiente"},"shirtNumber":32}),
    withStats(player("Erik Fraire", "GK", 63, 73, 77, 79, 30), {"overall":73,"value":50586,"matches":2,"id":"roster_1cbqkq9","rosterIdentity":"erikfraire","rosterStatus":"verified","rosterSourceIds":["mexico-anq-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Aniquiladores FC","photoLeague":"mexico","photoName":"Erik Fraire","baselineOrigin":{"league":"mexico","teamId":"anq","name":"Erik Fraire"},"shirtNumber":58}),
    withStats(player("Diego Martínez", "ATT", 89, 96, 85, 87, 25), {"overall":89,"value":102877,"matches":2,"id":"roster_1mvi1k7","rosterIdentity":"diegomartinez","rosterStatus":"verified","rosterSourceIds":["mexico-anq-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Aniquiladores FC","photoLeague":"mexico","photoName":"Diego Martínez","baselineOrigin":{"league":"mexico","teamId":"anq","name":"Diego Martínez"},"shirtNumber":77}),
    withStats(player("José Hernández", "MID", 66, 79, 66, 70, 32), {"overall":70,"value":44740,"goals":11,"assists":10,"matches":13,"id":"roster_yjuo9h","rosterIdentity":"josehernandez","rosterStatus":"verified","rosterSourceIds":["mexico-anq-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Galácticos del Caribe","photoLeague":"mexico","photoName":"José Hernández","baselineOrigin":{"league":"mexico","teamId":"gdc","name":"José Hernández"},"shirtNumber":88}),
  ] },
  { ...{"id":"atp","name":"Atlético Parceros FC","color":"#b8302a","budget":300000,"coach":"Luis Alfonso Álvarez","presidents":["James Rodríguez","Angerson Pelicanger García"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["mexico-atp-squad"],"officialTeamId":37}, players: [
    withStats(player("Felipe Urán", "GK", 74, 73, 87, 81, 27), {"overall":79,"value":65810,"matches":3,"id":"roster_15c4vt4","rosterIdentity":"felipeuran","rosterStatus":"verified","rosterSourceIds":["mexico-atp-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Atlético Parceros FC","photoLeague":"mexico","photoName":"Felipe Urán","baselineOrigin":{"league":"mexico","teamId":"atp","name":"Felipe Urán"},"shirtNumber":1}),
    withStats(player("Andrés Osorno", "DEF", 70, 62, 77, 68, 25), {"overall":69,"value":43038,"matches":4,"id":"roster_15z5p90","rosterIdentity":"andresosorno","rosterStatus":"verified","rosterSourceIds":["mexico-atp-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Atlético Parceros FC","photoLeague":"mexico","photoName":"Andrés Osorno","baselineOrigin":{"league":"mexico","teamId":"atp","name":"Andrés Osorno"},"shirtNumber":8}),
    withStats(player("Angellot Caro", "ATT", 90, 81, 76, 76, 21), {"overall":81,"value":72002,"goals":2,"assists":1,"matches":4,"id":"roster_1axnq","rosterIdentity":"angellotcaro","rosterStatus":"verified","rosterSourceIds":["mexico-atp-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Atlético Parceros FC","photoLeague":"mexico","photoName":"Angellot Caro","baselineOrigin":{"league":"mexico","teamId":"atp","name":"Angellot Caro"},"shirtNumber":10}),
    withStats(player("Santiago Muñoz", "ATT", 84, 78, 77, 75, 26), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_wmtnqw","rosterIdentity":"santiagomunoz","rosterStatus":"verified","rosterSourceIds":["mexico-atp-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Atlético Parceros FC","photoLeague":"mexico","photoName":"Santiago Muñoz","shirtNumber":11}),
    withStats(player("Simón Duque", "GK", 72, 75, 83, 84, 29), {"overall":79,"value":65810,"matches":4,"id":"roster_17vlxi3","rosterIdentity":"simonduque","rosterStatus":"verified","rosterSourceIds":["mexico-atp-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Atlético Parceros FC","photoLeague":"mexico","photoName":"Simón Duque","baselineOrigin":{"league":"mexico","teamId":"atp","name":"Simón Duque"},"shirtNumber":12}),
    withStats(player("Brayan Mejía", "DEF", 72, 70, 76, 75, 23), {"overall":73,"value":50586,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1c1yb2u","rosterIdentity":"brayanmejia","rosterStatus":"verified","rosterSourceIds":["mexico-atp-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Atlético Parceros FC","photoLeague":"mexico","photoName":"Brayan Mejía","shirtNumber":17}),
    withStats(player("Juan Tilano", "DEF", 78, 85, 90, 91, 33), {"overall":86,"value":90110,"assists":1,"matches":4,"id":"roster_1cs1u7g","rosterIdentity":"juantilano","rosterStatus":"verified","rosterSourceIds":["mexico-atp-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Atlético Parceros FC","photoLeague":"mexico","photoName":"Juan Tilano","baselineOrigin":{"league":"mexico","teamId":"atp","name":"Juan Tilano"},"shirtNumber":18}),
    withStats(player("Marlon Ramírez", "DEF", 89, 89, 97, 91, 27), {"overall":92,"value":117151,"goals":1,"matches":4,"id":"roster_132vdp4","rosterIdentity":"marlonramirez","rosterStatus":"verified","rosterSourceIds":["mexico-atp-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Atlético Parceros FC","photoLeague":"mexico","photoName":"Marlon Ramírez","baselineOrigin":{"league":"mexico","teamId":"atp","name":"Marlon Ramírez"},"shirtNumber":20}),
    withStats(player("Jaaziel Mosquera", "MID", 73, 77, 69, 74, 24), {"overall":73,"value":50586,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_olfx7k","rosterIdentity":"jaazielmosquera","rosterStatus":"verified","rosterSourceIds":["mexico-atp-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Atlético Parceros FC","photoLeague":"mexico","photoName":"Jaaziel Mosquera","shirtNumber":21}),
    withStats(player("Duván González", "DEF", 76, 72, 84, 78, 27), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1tpj9q7","rosterIdentity":"duvangonzalez","rosterStatus":"verified","rosterSourceIds":["mexico-atp-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Atlético Parceros FC","photoLeague":"mexico","photoName":"Duván González","shirtNumber":24}),
    withStats(player("Alex Mosquera", "MID", 75, 77, 71, 75, 24), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_184rh1y","rosterIdentity":"alexmosquera","rosterStatus":"verified","rosterSourceIds":["mexico-atp-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Atlético Parceros FC","photoLeague":"mexico","photoName":"Alex Mosquera","shirtNumber":80}),
    withStats(player("Alexis Gómez", "ATT", 81, 82, 81, 72, 18), {"overall":79,"value":65810,"matches":4,"id":"roster_1xbwqa5","rosterIdentity":"alexisgomez","rosterStatus":"verified","rosterSourceIds":["mexico-atp-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Atlético Parceros FC","photoLeague":"mexico","photoName":"Alexis Gómez","baselineOrigin":{"league":"mexico","teamId":"atp","name":"Alexis Gómez"},"shirtNumber":99}),
  ] },
  { ...{"id":"cdc","name":"Club de Cuervos","color":"#7a1f1f","budget":300000,"coach":"Jorge Cacho González","presidents":["Natalia García","Iván Navarrete"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["mexico-cdc-squad"],"officialTeamId":38}, players: [
    withStats(player("Juan Martos", "GK", 68, 72, 85, 86, 29), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1rt9fgl","rosterIdentity":"juanmartos","rosterStatus":"verified","rosterSourceIds":["mexico-cdc-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Juan Martos","shirtNumber":1}),
    withStats(player("Gustavo 'Furby' Guillén", "MID", 71, 76, 64, 65, 18), {"overall":69,"value":43038,"goals":10,"assists":4,"matches":11,"id":"roster_61u20u","rosterIdentity":"gustavofurbyguillen","rosterStatus":"verified","rosterSourceIds":["mexico-cdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Guerrilla FC","photoLeague":"mexico","photoName":"Gustavo Furby Guillén","baselineOrigin":{"league":"mexico","teamId":"guf","name":"Gustavo Furby Guillén"},"shirtNumber":7}),
    withStats(player("Jorge Olvera", "MID", 76, 78, 68, 74, 24), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_7i0qgb","rosterIdentity":"jorgeolvera","rosterStatus":"verified","rosterSourceIds":["mexico-cdc-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Jorge Olvera","shirtNumber":8}),
    withStats(player("Gerardo Ramírez", "MID", 84, 89, 81, 88, 22), {"overall":86,"value":90110,"goals":4,"matches":10,"id":"roster_921uxl","rosterIdentity":"gerardoramirez","rosterStatus":"verified","rosterSourceIds":["mexico-cdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Guerrilla FC","photoLeague":"mexico","photoName":"Gerardo Ramírez","baselineOrigin":{"league":"mexico","teamId":"guf","name":"Gerardo Ramírez"},"shirtNumber":9}),
    withStats(player("Jonathan Ponce", "MID", 74, 81, 71, 79, 25), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1y8odj1","rosterIdentity":"jonathanponce","rosterStatus":"verified","rosterSourceIds":["mexico-cdc-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Jonathan Ponce","shirtNumber":10}),
    withStats(player("José Campa", "MID", 76, 78, 70, 79, 25), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_17cwyf6","rosterIdentity":"josecampa","rosterStatus":"verified","rosterSourceIds":["mexico-cdc-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"José Campa","shirtNumber":13}),
    withStats(player("Brandon Magaña", "MID", 76, 84, 72, 83, 26), {"overall":79,"value":65810,"goals":4,"matches":15,"id":"roster_lujf0w","rosterIdentity":"brandonmagana","rosterStatus":"verified","rosterSourceIds":["mexico-cdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Brandon Magaña","baselineOrigin":{"league":"mexico","teamId":"cdc","name":"Brandon Magaña"},"shirtNumber":15}),
    withStats(player("Jovany Santana", "ATT", 84, 81, 78, 77, 27), {"overall":80,"value":68834,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1cj1dse","rosterIdentity":"jovanysantana","rosterStatus":"verified","rosterSourceIds":["mexico-cdc-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Jovany Santana","shirtNumber":19}),
    withStats(player("Brayan González", "MID", 84, 96, 90, 87, 20), {"overall":89,"value":102877,"matches":2,"id":"roster_1f6sq7g","rosterIdentity":"brayangonzalez","rosterStatus":"verified","rosterSourceIds":["mexico-cdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Aniquiladores FC","photoLeague":"mexico","photoName":"Brayan González","baselineOrigin":{"league":"mexico","teamId":"anq","name":"Brayan González"},"shirtNumber":20}),
    withStats(player("Edson González", "DEF", 74, 76, 76, 77, 24), {"overall":76,"value":57588,"matches":9,"id":"roster_m6ydlc","rosterIdentity":"edsongonzalez","rosterStatus":"verified","rosterSourceIds":["mexico-cdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Edson González","baselineOrigin":{"league":"mexico","teamId":"cdc","name":"Edson González"},"shirtNumber":21}),
    withStats(player("Edu Maldonado", "DEF", 75, 69, 78, 75, 23), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1n8iv4y","rosterIdentity":"edumaldonado","rosterStatus":"verified","rosterSourceIds":["mexico-cdc-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Edu Maldonado","shirtNumber":37}),
    withStats(player("Luis Carbajal", "DEF", 79, 78, 85, 79, 29), {"overall":80,"value":68834,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_z9e6t4","rosterIdentity":"luiscarbajal","rosterStatus":"verified","rosterSourceIds":["mexico-cdc-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Luis Carbajal","shirtNumber":46}),
    withStats(player("José Gómez", "DEF", 74, 68, 76, 75, 23), {"overall":73,"value":50586,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_11552tk","rosterIdentity":"josegomez","rosterStatus":"verified","rosterSourceIds":["mexico-cdc-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"José Gómez","shirtNumber":99}),
  ] },
  { ...{"id":"gdc","name":"Galácticos del Caribe","color":"#1e3f7a","budget":300000,"coach":"Lucas Ayala","presidents":["Santiago Matías Alofoke","Vincent Pérez","Angelo Valdés"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["mexico-gdc-squad"],"officialTeamId":39}, players: [
    withStats(player("Brian Orozco", "GK", 64, 68, 80, 84, 25), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_ljkxy1","rosterIdentity":"brianorozco","rosterStatus":"verified","rosterSourceIds":["mexico-gdc-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Galácticos del Caribe","photoLeague":"mexico","photoName":"Brian Orozco","shirtNumber":1}),
    withStats(player("Pablo Gómez", "MID", 84, 95, 86, 96, 23), {"overall":90,"value":107464,"goals":17,"assists":4,"matches":13,"id":"roster_lls4qx","rosterIdentity":"pablogomez","rosterStatus":"verified","rosterSourceIds":["mexico-gdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Galácticos del Caribe","photoLeague":"mexico","photoName":"Pablo Gómez","baselineOrigin":{"league":"mexico","teamId":"gdc","name":"Pablo Gómez"},"shirtNumber":9}),
    withStats(player("Diego Franco", "MID", 78, 81, 67, 79, 28), {"overall":76,"value":57588,"goals":2,"matches":12,"id":"roster_11561d6","rosterIdentity":"diegofranco","rosterStatus":"verified","rosterSourceIds":["mexico-gdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Galácticos del Caribe","photoLeague":"mexico","photoName":"Diego Franco","baselineOrigin":{"league":"mexico","teamId":"gdc","name":"Diego Franco"},"shirtNumber":10}),
    withStats(player("Daniel Ramos", "MID", 74, 78, 67, 77, 23), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1d07s0s","rosterIdentity":"danielramos","rosterStatus":"verified","rosterSourceIds":["mexico-gdc-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Galácticos del Caribe","photoLeague":"mexico","photoName":"Daniel Ramos","shirtNumber":14}),
    withStats(player("Erik Vera", "DEF", 75, 74, 87, 77, 22), {"overall":78,"value":62930,"goals":1,"matches":11,"id":"roster_nmm0mm","rosterIdentity":"erikvera","rosterStatus":"verified","rosterSourceIds":["mexico-gdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Aliens FC","photoLeague":"mexico","photoName":"Erik Vera","baselineOrigin":{"league":"mexico","teamId":"lal","name":"Erik Vera"},"shirtNumber":17}),
    withStats(player("Brayam Nazarit", "MID", 82, 84, 82, 82, 34), {"overall":83,"value":78785,"goals":6,"assists":5,"matches":12,"id":"roster_1l1nv08","rosterIdentity":"brayamnazarit","rosterStatus":"verified","rosterSourceIds":["mexico-gdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Aliens FC","photoLeague":"mexico","photoName":"Brayam Nazarit","baselineOrigin":{"league":"mexico","teamId":"lal","name":"Brayam Nazarit"},"shirtNumber":19}),
    withStats(player("Jorge Meléndez", "MID", 65, 69, 67, 72, 28), {"overall":68,"value":41457,"goals":4,"assists":2,"matches":12,"id":"roster_brk2r8","rosterIdentity":"jorgemelendez","rosterStatus":"verified","rosterSourceIds":["mexico-gdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Aliens FC","photoLeague":"mexico","photoName":"Jorge Meléndez","baselineOrigin":{"league":"mexico","teamId":"lal","name":"Jorge Meléndez"},"shirtNumber":20}),
    withStats(player("Orel Ponce", "DEF", 74, 75, 79, 78, 26), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1f6tb0i","rosterIdentity":"orelponce","rosterStatus":"verified","rosterSourceIds":["mexico-gdc-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Galácticos del Caribe","photoLeague":"mexico","photoName":"Orel Ponce","shirtNumber":21}),
    withStats(player("Daniel Mendoza", "DEF", 62, 60, 72, 70, 27), {"overall":66,"value":38646,"goals":1,"assists":1,"matches":13,"id":"roster_1xfrut6","rosterIdentity":"danielmendoza","rosterStatus":"verified","rosterSourceIds":["mexico-gdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Galácticos del Caribe","photoLeague":"mexico","photoName":"Daniel Mendoza","baselineOrigin":{"league":"mexico","teamId":"gdc","name":"Daniel Mendoza"},"shirtNumber":26}),
    withStats(player("Genaro Castillo", "ATT", 80, 81, 81, 79, 34), {"overall":80,"value":68834,"goals":15,"assists":4,"matches":12,"id":"roster_svzato","rosterIdentity":"genarocastillo","rosterStatus":"verified","rosterSourceIds":["mexico-gdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Chamos FC","photoLeague":"mexico","photoName":"Genaro Castillo","baselineOrigin":{"league":"mexico","teamId":"lch","name":"Genaro Castillo"},"shirtNumber":34}),
    withStats(player("Jesús Carbajal", "GK", 69, 79, 81, 86, 25), {"overall":79,"value":65810,"matches":13,"id":"roster_132bfgj","rosterIdentity":"jesuscarbajal","rosterStatus":"verified","rosterSourceIds":["mexico-gdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Galácticos del Caribe","photoLeague":"mexico","photoName":"Jesús Carbajal","baselineOrigin":{"league":"mexico","teamId":"gdc","name":"Jesús Carbajal"},"shirtNumber":46}),
    withStats(player("Julio Torres", "GK", 81, 85, 85, 92, 22), {"overall":86,"value":90110,"matches":12,"id":"roster_w7bzxx","rosterIdentity":"juliotorres","rosterStatus":"verified","rosterSourceIds":["mexico-gdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Aliens FC","photoLeague":"mexico","photoName":"Julio Torres","baselineOrigin":{"league":"mexico","teamId":"lal","name":"Julio Torres"},"shirtNumber":88}),
    withStats(player("Alexis Silva", "ATT", 81, 86, 78, 71, 26), {"overall":79,"value":65810,"goals":17,"assists":8,"matches":13,"id":"roster_1eblu0m","rosterIdentity":"alexissilva","rosterStatus":"verified","rosterSourceIds":["mexico-gdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Raniza FC","photoLeague":"mexico","photoName":"Alexis Silva","baselineOrigin":{"league":"mexico","teamId":"rnz","name":"Alexis Silva"},"shirtNumber":90}),
    withStats(player("Pabel Montes", "MID", 75, 85, 73, 76, 26), {"overall":77,"value":60190,"matches":13,"id":"roster_ot4yyj","rosterIdentity":"pabelmontes","rosterStatus":"verified","rosterSourceIds":["mexico-gdc-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Galácticos del Caribe","photoLeague":"mexico","photoName":"Pabel Montes","baselineOrigin":{"league":"mexico","teamId":"gdc","name":"Pabel Montes"},"shirtNumber":96}),
  ] },
  { ...{"id":"lch","name":"Los Chamos FC","color":"#6d2333","budget":300000,"coach":"Jos Gartland","presidents":["Donato Muñoz","Flavio Broianigo","RDjavi"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["mexico-lch-squad"],"officialTeamId":41}, players: [
    withStats(player("Antonio Monterde", "GK", 80, 74, 91, 91, 24), {"overall":84,"value":82404,"matches":12,"id":"roster_1mt7o4l","rosterIdentity":"antoniomonterde","rosterStatus":"verified","rosterSourceIds":["mexico-lch-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Persas FC","photoLeague":"mexico","photoName":"Antonio Monterde","baselineOrigin":{"league":"mexico","teamId":"per","name":"Antonio Monterde"},"shirtNumber":1}),
    withStats(player("Hatzel Roque", "MID", 72, 76, 76, 82, 34), {"overall":77,"value":60190,"matches":7,"id":"roster_s96t2r","rosterIdentity":"hatzelroque","rosterStatus":"verified","rosterSourceIds":["mexico-lch-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Simios FC","photoLeague":"mexico","photoName":"Hatzel Roque","baselineOrigin":{"league":"mexico","teamId":"sim","name":"Hatzel Roque"},"shirtNumber":5}),
    withStats(player("Christian Lagunas", "MID", 76, 80, 72, 76, 31), {"overall":76,"value":57588,"goals":6,"assists":7,"matches":12,"id":"roster_z6zbi7","rosterIdentity":"christianlagunas","rosterStatus":"verified","rosterSourceIds":["mexico-lch-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Chamos FC","photoLeague":"mexico","photoName":"Christian Lagunas","baselineOrigin":{"league":"mexico","teamId":"lch","name":"Christian Lagunas"},"shirtNumber":6}),
    withStats(player("Luis Amador", "MID", 92, 90, 88, 89, 31), {"overall":90,"value":107464,"goals":3,"assists":1,"matches":9,"id":"roster_12isq1w","rosterIdentity":"luisamador","rosterStatus":"verified","rosterSourceIds":["mexico-lch-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Persas FC","photoLeague":"mexico","photoName":"Luis Amador","baselineOrigin":{"league":"mexico","teamId":"per","name":"Luis Amador"},"shirtNumber":8}),
    withStats(player("Yair Arias", "MID", 67, 75, 67, 72, 24), {"overall":70,"value":44740,"goals":5,"assists":2,"matches":12,"id":"roster_u0uy0a","rosterIdentity":"yairarias","rosterStatus":"verified","rosterSourceIds":["mexico-lch-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Persas FC","photoLeague":"mexico","photoName":"Yair Arias","baselineOrigin":{"league":"mexico","teamId":"per","name":"Yair Arias"},"shirtNumber":10}),
    withStats(player("Román Ramírez", "MID", 92, 95, 86, 91, 27), {"overall":91,"value":112221,"goals":2,"matches":6,"id":"roster_dya57m","rosterIdentity":"romanramirez","rosterStatus":"verified","rosterSourceIds":["mexico-lch-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Chamos FC","photoLeague":"mexico","photoName":"Román Ramírez","baselineOrigin":{"league":"mexico","teamId":"lch","name":"Román Ramírez"},"shirtNumber":11}),
    withStats(player("Paul Cruz", "GK", 65, 70, 84, 85, 27), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1qnx5op","rosterIdentity":"paulcruz","rosterStatus":"verified","rosterSourceIds":["mexico-lch-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Los Chamos FC","photoLeague":"mexico","photoName":"Paul Cruz","shirtNumber":13}),
    withStats(player("Alexis López", "DEF", 69, 59, 69, 73, 27), {"overall":68,"value":41457,"goals":1,"matches":12,"id":"roster_1i5qymj","rosterIdentity":"alexislopez","rosterStatus":"verified","rosterSourceIds":["mexico-lch-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Chamos FC","photoLeague":"mexico","photoName":"Alexis López","baselineOrigin":{"league":"mexico","teamId":"lch","name":"Alexis López"},"shirtNumber":14}),
    withStats(player("Gustavo Gutiérrez", "ATT", 83, 85, 78, 78, 29), {"overall":81,"value":72002,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_16smc2j","rosterIdentity":"gustavogutierrez","rosterStatus":"verified","rosterSourceIds":["mexico-lch-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Los Chamos FC","photoLeague":"mexico","photoName":"Gustavo Gutiérrez","shirtNumber":16}),
    withStats(player("Luis Gutiérrez", "ATT", 81, 81, 76, 77, 27), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_qm6rb3","rosterIdentity":"luisgutierrez","rosterStatus":"verified","rosterSourceIds":["mexico-lch-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Los Chamos FC","photoLeague":"mexico","photoName":"Luis Gutiérrez","shirtNumber":17}),
    withStats(player("Tona Mejía", "DEF", 71, 71, 80, 75, 23), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_4vjvmx","rosterIdentity":"tonamejia","rosterStatus":"verified","rosterSourceIds":["mexico-lch-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Los Chamos FC","photoLeague":"mexico","photoName":"Tona Mejía","shirtNumber":19}),
    withStats(player("Obed Martínez", "MID", 91, 95, 83, 89, 21), {"overall":90,"value":107464,"goals":9,"assists":6,"matches":12,"id":"roster_xajgc9","rosterIdentity":"obedmartinez","rosterStatus":"verified","rosterSourceIds":["mexico-lch-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Persas FC","photoLeague":"mexico","photoName":"Obed Martínez","baselineOrigin":{"league":"mexico","teamId":"per","name":"Obed Martínez"},"shirtNumber":20}),
    withStats(player("Juan Cisneros", "MID", 66, 74, 69, 66, 30), {"overall":69,"value":43038,"goals":5,"assists":2,"matches":11,"id":"roster_8zvo3v","rosterIdentity":"juancisneros","rosterStatus":"verified","rosterSourceIds":["mexico-lch-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Chamos FC","photoLeague":"mexico","photoName":"Juan Cisneros","baselineOrigin":{"league":"mexico","teamId":"lch","name":"Juan Cisneros"},"shirtNumber":22}),
    withStats(player("Pablo Medina", "DEF", 77, 73, 82, 81, 28), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1bfq0et","rosterIdentity":"pablomedina","rosterStatus":"verified","rosterSourceIds":["mexico-lch-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Los Chamos FC","photoLeague":"mexico","photoName":"Pablo Medina","shirtNumber":23}),
  ] },
  { ...{"id":"pca","name":"Peluche Caligari","color":"#e08828","budget":300000,"coach":"Fernando Espinosa","presidents":["Álex Montiel","Gabriel Montiel"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["mexico-pca-squad"],"officialTeamId":44}, players: [
    withStats(player("Moisés Dabbah", "GK", 68, 70, 83, 81, 25), {"overall":76,"value":57588,"matches":12,"id":"roster_1b10vyv","rosterIdentity":"moisesdabbah","rosterStatus":"verified","rosterSourceIds":["mexico-pca-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Peluche Caligari","photoLeague":"mexico","photoName":"Moisés Dabbah","baselineOrigin":{"league":"mexico","teamId":"pca","name":"Moisés Dabbah"},"shirtNumber":1}),
    withStats(player("Roberto Escalante", "DEF", 80, 76, 84, 77, 28), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_102qjjm","rosterIdentity":"robertoescalante","rosterStatus":"verified","rosterSourceIds":["mexico-pca-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Peluche Caligari","photoLeague":"mexico","photoName":"Roberto Escalante","shirtNumber":4}),
    withStats(player("José Askenazi", "MID", 88, 92, 92, 91, 26), {"overall":91,"value":112221,"goals":24,"assists":3,"matches":14,"id":"roster_1moxj9e","rosterIdentity":"joseaskenazi","rosterStatus":"verified","rosterSourceIds":["mexico-pca-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"José Askenazi","baselineOrigin":{"league":"mexico","teamId":"cdc","name":"José Askenazi"},"shirtNumber":7}),
    withStats(player("Miguel Díaz", "MID", 75, 81, 70, 75, 24), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_4np9la","rosterIdentity":"migueldiaz","rosterStatus":"verified","rosterSourceIds":["mexico-pca-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Peluche Caligari","photoLeague":"mexico","photoName":"Miguel Díaz","shirtNumber":8}),
    withStats(player("Hugo Puentes", "ATT", 80, 79, 74, 76, 26), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_n4cxbw","rosterIdentity":"hugopuentes","rosterStatus":"verified","rosterSourceIds":["mexico-pca-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Peluche Caligari","photoLeague":"mexico","photoName":"Hugo Puentes","shirtNumber":9}),
    withStats(player("Santiago Lagarde", "ATT", 90, 90, 88, 81, 28), {"overall":87,"value":94202,"goals":8,"assists":2,"matches":11,"id":"roster_15j5qo1","rosterIdentity":"santiagolagarde","rosterStatus":"verified","rosterSourceIds":["mexico-pca-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Peluche Caligari","photoLeague":"mexico","photoName":"Santiago Lagarde","baselineOrigin":{"league":"mexico","teamId":"pca","name":"Santiago Lagarde"},"shirtNumber":10}),
    withStats(player("Martín Lara", "MID", 78, 80, 74, 77, 25), {"overall":77,"value":60190,"matches":3,"ratingSum":23.7,"id":"roster_1hgxlz8","rosterIdentity":"martinlara","rosterStatus":"verified","rosterSourceIds":["mexico-pca-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Podpah Funkbol Clube","photoLeague":"brazil","photoName":"Martín Lara","baselineOrigin":{"league":"brazil","teamId":"pod","name":"Martín Lara"},"shirtNumber":11}),
    withStats(player("José López", "ATT", 81, 83, 76, 77, 27), {"overall":79,"value":65810,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_126wgki","rosterIdentity":"joselopez","rosterStatus":"verified","rosterSourceIds":["mexico-pca-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Peluche Caligari","photoLeague":"mexico","photoName":"José López","shirtNumber":14}),
    withStats(player("Erick Madrigal", "DEF", 69, 68, 87, 80, 20), {"overall":76,"value":57588,"goals":1,"matches":13,"id":"roster_1ua7x4q","rosterIdentity":"erickmadrigal","rosterStatus":"verified","rosterSourceIds":["mexico-pca-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Galácticos del Caribe","photoLeague":"mexico","photoName":"Erick Madrigal","baselineOrigin":{"league":"mexico","teamId":"gdc","name":"Erick Madrigal"},"shirtNumber":23}),
    withStats(player("Cristian Hernández", "GK", 72, 78, 85, 90, 23), {"overall":81,"value":72002,"matches":12,"id":"roster_1brrwkf","rosterIdentity":"cristianhernandez","rosterStatus":"verified","rosterSourceIds":["mexico-pca-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Chamos FC","photoLeague":"mexico","photoName":"Cristian Hernández","baselineOrigin":{"league":"mexico","teamId":"lch","name":"Cristian Hernández"},"shirtNumber":25}),
    withStats(player("Aarón Del Real", "MID", 72, 84, 79, 80, 23), {"overall":79,"value":65810,"matches":1,"id":"roster_1001ssv","rosterIdentity":"aarondelreal","rosterStatus":"verified","rosterSourceIds":["mexico-pca-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Peluche Caligari","photoLeague":"mexico","photoName":"Aarón Del Real","baselineOrigin":{"league":"mexico","teamId":"pca","name":"Aarón Del Real"},"shirtNumber":31}),
    withStats(player("Iván Muñoz", "GK", 60, 60, 68, 75, 21), {"overall":66,"value":38646,"matches":5,"id":"roster_opm3zq","rosterIdentity":"ivanmunoz","rosterStatus":"verified","rosterSourceIds":["mexico-pca-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Galácticos del Caribe","photoLeague":"mexico","photoName":"Iván Muñoz","baselineOrigin":{"league":"mexico","teamId":"gdc","name":"Iván Muñoz"},"shirtNumber":32}),
    withStats(player("Ricardo Cañez", "MID", 78, 79, 72, 78, 26), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1aqfimg","rosterIdentity":"ricardocanez","rosterStatus":"verified","rosterSourceIds":["mexico-pca-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Peluche Caligari","photoLeague":"mexico","photoName":"Ricardo Cañez","shirtNumber":99}),
  ] },
  { ...{"id":"per","name":"Persas FC","color":"#4a4a4a","budget":300000,"coach":"Gabriela Batocletti","presidents":["Andy Zeein Merino","Nicola Porcella"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["mexico-per-squad"],"officialTeamId":45}, players: [
    withStats(player("James Hernández", "GK", 70, 70, 83, 81, 30), {"overall":76,"value":57588,"matches":1,"id":"roster_al8z26","rosterIdentity":"jameshernandez","rosterStatus":"verified","rosterSourceIds":["mexico-per-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Aliens FC","photoLeague":"mexico","photoName":"James Hernández","baselineOrigin":{"league":"mexico","teamId":"lal","name":"James Hernández"},"shirtNumber":1}),
    withStats(player("Jan Meléndez", "DEF", 76, 73, 79, 76, 24), {"overall":76,"value":57588,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_xrhf52","rosterIdentity":"janmelendez","rosterStatus":"verified","rosterSourceIds":["mexico-per-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Persas FC","photoLeague":"mexico","photoName":"Jan Meléndez","shirtNumber":2}),
    withStats(player("George Corral", "DEF", 76, 73, 85, 83, 25), {"overall":79,"value":65810,"goals":1,"assists":2,"matches":10,"id":"roster_bxnbln","rosterIdentity":"georgecorral","rosterStatus":"verified","rosterSourceIds":["mexico-per-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Simios FC","photoLeague":"mexico","photoName":"George Corral","baselineOrigin":{"league":"mexico","teamId":"sim","name":"George Corral"},"shirtNumber":4}),
    withStats(player("Jorge Escamilla", "DEF", 71, 70, 81, 73, 24), {"overall":74,"value":52788,"goals":4,"matches":10,"id":"roster_14b29u9","rosterIdentity":"jorgeescamilla","rosterStatus":"verified","rosterSourceIds":["mexico-per-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Jorge Escamilla","baselineOrigin":{"league":"mexico","teamId":"cdc","name":"Jorge Escamilla"},"shirtNumber":5}),
    withStats(player("Juan Ramírez", "MID", 91, 88, 79, 86, 25), {"overall":86,"value":90110,"goals":8,"matches":11,"id":"roster_1nzw6et","rosterIdentity":"juanramirez","rosterStatus":"verified","rosterSourceIds":["mexico-per-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Aliens FC","photoLeague":"mexico","photoName":"Juan Ramírez","baselineOrigin":{"league":"mexico","teamId":"lal","name":"Juan Ramírez"},"shirtNumber":7}),
    withStats(player("Jesús 'Chuy' Pérez", "MID", 78, 82, 77, 74, 22), {"overall":78,"value":62930,"goals":9,"assists":3,"matches":12,"id":"roster_yo6qz8","rosterIdentity":"jesuschuyperez","rosterStatus":"verified","rosterSourceIds":["mexico-per-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Aliens FC","photoLeague":"mexico","photoName":"Jesús Chuy Pérez","baselineOrigin":{"league":"mexico","teamId":"lal","name":"Jesús Chuy Pérez"},"shirtNumber":8}),
    withStats(player("Mathías Vidangossy", "MID", 91, 94, 82, 86, 28), {"overall":88,"value":98457,"goals":6,"assists":4,"matches":11,"id":"roster_1pn9hgx","rosterIdentity":"mathiasvidangossy","rosterStatus":"verified","rosterSourceIds":["mexico-per-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Raniza FC","photoLeague":"mexico","photoName":"Mathías Vidangossy","baselineOrigin":{"league":"mexico","teamId":"rnz","name":"Mathías Vidangossy"},"shirtNumber":10}),
    withStats(player("Diego Abella", "ATT", 92, 84, 77, 79, 27), {"overall":83,"value":78785,"goals":3,"assists":2,"matches":11,"id":"roster_l5hibe","rosterIdentity":"diegoabella","rosterStatus":"verified","rosterSourceIds":["mexico-per-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Los Aliens FC","photoLeague":"mexico","photoName":"Diego Abella","baselineOrigin":{"league":"mexico","teamId":"lal","name":"Diego Abella"},"shirtNumber":11}),
    withStats(player("José 'Shaggy' Martínez", "MID", 70, 82, 72, 74, 27), {"overall":75,"value":55121,"assists":3,"matches":11,"id":"roster_fnyhj1","rosterIdentity":"joseshaggymartinez","rosterStatus":"verified","rosterSourceIds":["mexico-per-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Simios FC","photoLeague":"mexico","photoName":"José Shaggy Martínez","baselineOrigin":{"league":"mexico","teamId":"sim","name":"José Shaggy Martínez"},"shirtNumber":12}),
    withStats(player("Alexis Benítez", "ATT", 79, 77, 76, 74, 25), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1vsv5v8","rosterIdentity":"alexisbenitez","rosterStatus":"verified","rosterSourceIds":["mexico-per-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Persas FC","photoLeague":"mexico","photoName":"Alexis Benítez","shirtNumber":21}),
    withStats(player("Leonardo Duque", "MID", 79, 79, 72, 80, 26), {"overall":78,"value":62930,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_18s51gz","rosterIdentity":"leonardoduque","rosterStatus":"verified","rosterSourceIds":["mexico-per-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Persas FC","photoLeague":"mexico","photoName":"Leonardo Duque","shirtNumber":23}),
    withStats(player("Victor Vivia", "GK", 60, 65, 79, 81, 23), {"overall":71,"value":46564,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_hebg8p","rosterIdentity":"victorvivia","rosterStatus":"verified","rosterSourceIds":["mexico-per-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Persas FC","photoLeague":"mexico","photoName":"Victor Vivia","shirtNumber":61}),
  ] },
  { ...{"id":"rnz","name":"Raniza FC","color":"#3a8f4f","budget":300000,"coach":"Manu Lanzarote","presidents":["Alana Flores"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["mexico-rnz-squad"],"officialTeamId":46}, players: [
    withStats(player("Bernaldino Valdovinos", "GK", 56, 65, 69, 68, 29), {"overall":65,"value":37414,"matches":7,"id":"roster_8ni37w","rosterIdentity":"bernaldinovaldovinos","rosterStatus":"verified","rosterSourceIds":["mexico-rnz-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Bernaldino Valdovinos","baselineOrigin":{"league":"mexico","teamId":"cdc","name":"Bernaldino Valdovinos"},"shirtNumber":1}),
    withStats(player("Carlos 'Camello' Valdez", "DEF", 76, 72, 76, 73, 22), {"overall":74,"value":52788,"goals":1,"assists":1,"matches":10,"id":"roster_4rqmcq","rosterIdentity":"carloscamellovaldez","rosterStatus":"verified","rosterSourceIds":["mexico-rnz-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Peluche Caligari","photoLeague":"mexico","photoName":"Carlos Camello Valdez","baselineOrigin":{"league":"mexico","teamId":"pca","name":"Carlos Camello Valdez"},"shirtNumber":6}),
    withStats(player("César Romo", "DEF", 60, 66, 78, 67, 25), {"overall":68,"value":41457,"goals":6,"assists":3,"matches":16,"id":"roster_nw35xi","rosterIdentity":"cesarromo","rosterStatus":"verified","rosterSourceIds":["mexico-rnz-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"César Romo","baselineOrigin":{"league":"mexico","teamId":"cdc","name":"César Romo"},"shirtNumber":7}),
    withStats(player("Roberto Uribe", "MID", 91, 87, 78, 85, 19), {"overall":85,"value":86178,"goals":1,"assists":3,"matches":12,"id":"roster_1dryqy1","rosterIdentity":"robertouribe","rosterStatus":"verified","rosterSourceIds":["mexico-rnz-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Roberto Uribe","baselineOrigin":{"league":"mexico","teamId":"cdc","name":"Roberto Uribe"},"shirtNumber":8}),
    withStats(player("Cristopher Castillo", "ATT", 78, 76, 72, 71, 24), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1jr1b9h","rosterIdentity":"cristophercastillo","rosterStatus":"verified","rosterSourceIds":["mexico-rnz-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Raniza FC","photoLeague":"mexico","photoName":"Cristopher Castillo","shirtNumber":9}),
    withStats(player("César Vallejo", "ATT", 90, 82, 79, 70, 33), {"overall":80,"value":68834,"matches":1,"id":"roster_cytu8c","rosterIdentity":"cesarvallejo","rosterStatus":"verified","rosterSourceIds":["mexico-rnz-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Peluche Caligari","photoLeague":"mexico","photoName":"César Vallejo","baselineOrigin":{"league":"mexico","teamId":"pca","name":"César Vallejo"},"shirtNumber":10}),
    withStats(player("Eddie Sánchez", "ATT", 82, 87, 79, 71, 25), {"overall":80,"value":68834,"matches":7,"id":"roster_1l8spc0","rosterIdentity":"eddiesanchez","rosterStatus":"verified","rosterSourceIds":["mexico-rnz-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Peluche Caligari","photoLeague":"mexico","photoName":"Eddie Sánchez","baselineOrigin":{"league":"mexico","teamId":"pca","name":"Eddie Sánchez"},"shirtNumber":13}),
    withStats(player("Salvador Navarro", "MID", 72, 77, 70, 74, 31), {"overall":73,"value":50586,"goals":2,"matches":11,"id":"roster_1cutrvc","rosterIdentity":"salvadornavarro","rosterStatus":"verified","rosterSourceIds":["mexico-rnz-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Salvador Navarro","baselineOrigin":{"league":"mexico","teamId":"cdc","name":"Salvador Navarro"},"shirtNumber":17}),
    withStats(player("Adriano Nunes", "MID", 76, 82, 71, 80, 26), {"overall":77,"value":60190,"goals":21,"assists":15,"matches":16,"id":"roster_b1erac","rosterIdentity":"adrianonunes","rosterStatus":"verified","rosterSourceIds":["mexico-rnz-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Adriano Nunes","baselineOrigin":{"league":"mexico","teamId":"cdc","name":"Adriano Nunes"},"shirtNumber":19}),
    withStats(player("Hugo Rodríguez", "MID", 92, 87, 81, 84, 28), {"overall":86,"value":90110,"goals":1,"assists":4,"matches":11,"id":"roster_57sq87","rosterIdentity":"hugorodriguez","rosterStatus":"verified","rosterSourceIds":["mexico-rnz-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Peluche Caligari","photoLeague":"mexico","photoName":"Hugo Rodríguez","baselineOrigin":{"league":"mexico","teamId":"pca","name":"Hugo Rodríguez"},"shirtNumber":21}),
    withStats(player("Marlon Castillo", "DEF", 63, 72, 72, 72, 21), {"overall":70,"value":44740,"matches":9,"id":"roster_1h6jmzr","rosterIdentity":"marloncastillo","rosterStatus":"verified","rosterSourceIds":["mexico-rnz-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Marlon Castillo","baselineOrigin":{"league":"mexico","teamId":"cdc","name":"Marlon Castillo"},"shirtNumber":22}),
    withStats(player("Ángel Ayala", "MID", 78, 89, 80, 84, 20), {"overall":83,"value":78785,"goals":5,"assists":2,"matches":13,"id":"roster_i23vg","rosterIdentity":"angelayala","rosterStatus":"verified","rosterSourceIds":["mexico-rnz-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Ángel Ayala","baselineOrigin":{"league":"mexico","teamId":"cdc","name":"Ángel Ayala"},"shirtNumber":93}),
    withStats(player("Luis Valdés", "MID", 82, 91, 86, 92, 20), {"overall":88,"value":98457,"matches":2,"id":"roster_1m3ydhf","rosterIdentity":"luisvaldes","rosterStatus":"verified","rosterSourceIds":["mexico-rnz-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Luis Valdés","baselineOrigin":{"league":"mexico","teamId":"cdc","name":"Luis Valdés"},"shirtNumber":98}),
    withStats(player("Fausto Alemán", "MID", 80, 76, 72, 80, 30), {"overall":77,"value":60190,"matches":4,"id":"roster_n1hnld","rosterIdentity":"faustoaleman","rosterStatus":"verified","rosterSourceIds":["mexico-rnz-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Fausto Alemán","baselineOrigin":{"league":"mexico","teamId":"cdc","name":"Fausto Alemán"},"shirtNumber":99}),
  ] },
  { ...{"id":"kru","name":"KRÜ FC","color":"#d63384","budget":300000,"coach":"Juan Manuel Miranda","presidents":["Sergio Kun Agüero"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["mexico-kru-squad"],"officialTeamId":198}, players: [
    withStats(player("Jeancob Ramírez", "GK", 66, 70, 75, 72, 22), {"overall":71,"value":46564,"matches":11,"id":"roster_1ne9ot3","rosterIdentity":"jeancobramirez","rosterStatus":"verified","rosterSourceIds":["mexico-kru-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"KRÜ FC","photoLeague":"mexico","photoName":"Jeancob Ramírez","baselineOrigin":{"league":"mexico","teamId":"kru","name":"Jeancob Ramírez"},"shirtNumber":1}),
    withStats(player("Dago Campari", "DEF", 66, 75, 78, 72, 24), {"overall":73,"value":50586,"goals":1,"matches":12,"id":"roster_131hzt1","rosterIdentity":"dagocampari","rosterStatus":"verified","rosterSourceIds":["mexico-kru-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"KRÜ FC","photoLeague":"mexico","photoName":"Dago Campari","baselineOrigin":{"league":"mexico","teamId":"kru","name":"Dago Campari"},"shirtNumber":5}),
    withStats(player("Santiago Rotemberg", "MID", 89, 96, 82, 88, 22), {"overall":89,"value":102877,"goals":1,"assists":1,"matches":10,"id":"roster_1v17ok","rosterIdentity":"santiagorotemberg","rosterStatus":"verified","rosterSourceIds":["mexico-kru-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"KRÜ FC","photoLeague":"mexico","photoName":"Santiago Rotemberg","baselineOrigin":{"league":"mexico","teamId":"kru","name":"Santiago Rotemberg"},"shirtNumber":6}),
    withStats(player("Nicolás Vanderhoeven", "ATT", 81, 76, 71, 71, 24), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1r0uks7","rosterIdentity":"nicolasvanderhoeven","rosterStatus":"verified","rosterSourceIds":["mexico-kru-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"KRÜ FC","photoLeague":"mexico","photoName":"Nicolás Vanderhoeven","shirtNumber":7}),
    withStats(player("Fernando Pina", "MID", 77, 82, 73, 77, 27), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1uydlos","rosterIdentity":"fernandopina","rosterStatus":"verified","rosterSourceIds":["mexico-kru-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"KRÜ FC","photoLeague":"mexico","photoName":"Fernando Pina","shirtNumber":8}),
    withStats(player("Edson Trejo", "MID", 90, 90, 84, 88, 33), {"overall":88,"value":98457,"goals":1,"assists":1,"matches":12,"id":"roster_ejxb06","rosterIdentity":"edsontrejo","rosterStatus":"verified","rosterSourceIds":["mexico-kru-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"KRÜ FC","photoLeague":"mexico","photoName":"Edson Trejo","baselineOrigin":{"league":"mexico","teamId":"kru","name":"Edson Trejo"},"shirtNumber":11}),
    withStats(player("Christopher Pedraza", "MID", 83, 84, 73, 76, 24), {"overall":79,"value":65810,"goals":5,"assists":2,"matches":11,"id":"roster_eetfz3","rosterIdentity":"christopherpedraza","rosterStatus":"verified","rosterSourceIds":["mexico-kru-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"KRÜ FC","photoLeague":"mexico","photoName":"Christopher Pedraza","baselineOrigin":{"league":"mexico","teamId":"kru","name":"Christopher Pedraza"},"shirtNumber":13}),
    withStats(player("Donovan Hernández", "GK", 67, 67, 72, 72, 33), {"overall":70,"value":44740,"matches":1,"id":"roster_1bfdz07","rosterIdentity":"donovanhernandez","rosterStatus":"verified","rosterSourceIds":["mexico-kru-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"KRÜ FC","photoLeague":"mexico","photoName":"Donovan Hernández","baselineOrigin":{"league":"mexico","teamId":"kru","name":"Donovan Hernández"},"shirtNumber":18}),
    withStats(player("Valentín Viola", "ATT", 86, 82, 77, 79, 29), {"overall":81,"value":72002,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_d3md5r","rosterIdentity":"valentinviola","rosterStatus":"verified","rosterSourceIds":["mexico-kru-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"KRÜ FC","photoLeague":"mexico","photoName":"Valentín Viola","shirtNumber":20}),
    withStats(player("Ivan Bentivegna", "ATT", 78, 77, 72, 74, 24), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1y2tzj0","rosterIdentity":"ivanbentivegna","rosterStatus":"verified","rosterSourceIds":["mexico-kru-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"KRÜ FC","photoLeague":"mexico","photoName":"Ivan Bentivegna","shirtNumber":22}),
    withStats(player("Hugo Murga", "GK", 76, 81, 84, 92, 21), {"overall":83,"value":78785,"matches":9,"id":"roster_620h6c","rosterIdentity":"hugomurga","rosterStatus":"verified","rosterSourceIds":["mexico-kru-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Club de Cuervos","photoLeague":"mexico","photoName":"Hugo Murga","baselineOrigin":{"league":"mexico","teamId":"cdc","name":"Hugo Murga"},"shirtNumber":23}),
    withStats(player("Gonzalo Lescano", "MID", 69, 66, 69, 70, 27), {"overall":69,"value":43038,"goals":8,"assists":4,"matches":11,"id":"roster_12khog6","rosterIdentity":"gonzalolescano","rosterStatus":"verified","rosterSourceIds":["mexico-kru-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"KRÜ FC","photoLeague":"mexico","photoName":"Gonzalo Lescano","baselineOrigin":{"league":"mexico","teamId":"kru","name":"Gonzalo Lescano"},"shirtNumber":27}),
    withStats(player("Alberto García", "ATT", 74, 73, 72, 68, 24), {"overall":72,"value":48512,"goals":3,"assists":3,"matches":11,"id":"roster_1d6pgw5","rosterIdentity":"albertogarcia","rosterStatus":"verified","rosterSourceIds":["mexico-kru-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"KRÜ FC","photoLeague":"mexico","photoName":"Alberto García","baselineOrigin":{"league":"mexico","teamId":"kru","name":"Alberto García"},"shirtNumber":28}),
    withStats(player("Mauricio Reyna", "DEF", 84, 84, 95, 91, 26), {"overall":89,"value":102877,"assists":1,"matches":12,"id":"roster_gjzi4l","rosterIdentity":"mauricioreyna","rosterStatus":"verified","rosterSourceIds":["mexico-kru-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"KRÜ FC","photoLeague":"mexico","photoName":"Mauricio Reyna","baselineOrigin":{"league":"mexico","teamId":"kru","name":"Mauricio Reyna"},"shirtNumber":45}),
  ] },
  { ...{"id":"guf","name":"Guerrilla FC","color":"#4a5c2f","budget":300000,"coach":"Rodrigo Ávila","presidents":["Mr. Stiven"],"rosterStatus":"complete","rosterCheckedAt":"2026-10-26","rosterSourceIds":["mexico-guf-squad"],"officialTeamId":213}, players: [
    withStats(player("Óscar Medina", "GK", 78, 78, 88, 95, 30), {"overall":85,"value":86178,"matches":10,"id":"roster_hft0on","rosterIdentity":"oscarmedina","rosterStatus":"verified","rosterSourceIds":["mexico-guf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Simios FC","photoLeague":"mexico","photoName":"Óscar Medina","baselineOrigin":{"league":"mexico","teamId":"sim","name":"Óscar Medina"},"shirtNumber":1}),
    withStats(player("Eduardo Velarde", "DEF", 65, 73, 78, 69, 25), {"overall":71,"value":46564,"goals":2,"assists":1,"matches":11,"id":"roster_7rcxjk","rosterIdentity":"eduardovelarde","rosterStatus":"verified","rosterSourceIds":["mexico-guf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Guerrilla FC","photoLeague":"mexico","photoName":"Eduardo Velarde","baselineOrigin":{"league":"mexico","teamId":"guf","name":"Eduardo Velarde"},"shirtNumber":3}),
    withStats(player("Erick Guzmán", "MID", 74, 74, 75, 74, 33), {"overall":74,"value":52788,"goals":4,"assists":3,"matches":13,"id":"roster_9d6965","rosterIdentity":"erickguzman","rosterStatus":"verified","rosterSourceIds":["mexico-guf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Galácticos del Caribe","photoLeague":"mexico","photoName":"Erick Guzmán","baselineOrigin":{"league":"mexico","teamId":"gdc","name":"Erick Guzmán"},"shirtNumber":6}),
    withStats(player("Ivan Pereira Da Silva", "ATT", 78, 76, 71, 73, 24), {"overall":75,"value":55121,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_1e8og1l","rosterIdentity":"ivanpereiradasilva","rosterStatus":"verified","rosterSourceIds":["mexico-guf-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Guerrilla FC","photoLeague":"mexico","photoName":"Ivan Pereira Da Silva","shirtNumber":7}),
    withStats(player("Andrés Suárez", "MID", 88, 84, 81, 88, 27), {"overall":85,"value":86178,"goals":18,"assists":2,"matches":11,"id":"roster_uupil8","rosterIdentity":"andressuarez","rosterStatus":"verified","rosterSourceIds":["mexico-guf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Simios FC","photoLeague":"mexico","photoName":"Andrés Suárez","baselineOrigin":{"league":"mexico","teamId":"sim","name":"Andrés Suárez"},"shirtNumber":10}),
    withStats(player("Patricio Zerecero", "ATT", 80, 79, 70, 72, 28), {"overall":75,"value":55121,"matches":4,"id":"roster_1xb98hj","rosterIdentity":"patriciozerecero","rosterStatus":"verified","rosterSourceIds":["mexico-guf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Guerrilla FC","photoLeague":"mexico","photoName":"Patricio Zerecero","baselineOrigin":{"league":"mexico","teamId":"guf","name":"Patricio Zerecero"},"shirtNumber":11}),
    withStats(player("Eduardo Evangelista", "GK", 64, 66, 81, 83, 25), {"overall":74,"value":52788,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_bp2sys","rosterIdentity":"eduardoevangelista","rosterStatus":"verified","rosterSourceIds":["mexico-guf-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Guerrilla FC","photoLeague":"mexico","photoName":"Eduardo Evangelista","shirtNumber":12}),
    withStats(player("Leonardo Hernández", "MID", 78, 82, 71, 77, 26), {"overall":77,"value":60190,"attributesSource":"estimated","ageSource":"estimated","estimatedFields":["speed","technique","physical","mental","overall","value","age"],"id":"roster_14u5kks","rosterIdentity":"leonardohernandez","rosterStatus":"verified","rosterSourceIds":["mexico-guf-squad"],"rosterCheckedAt":"2026-10-26","photoClub":"Guerrilla FC","photoLeague":"mexico","photoName":"Leonardo Hernández","shirtNumber":15}),
    withStats(player("Adrián Mora", "DEF", 60, 68, 73, 69, 18), {"overall":68,"value":41457,"matches":8,"id":"roster_s9pyx7","rosterIdentity":"adrianmora","rosterStatus":"verified","rosterSourceIds":["mexico-guf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Guerrilla FC","photoLeague":"mexico","photoName":"Adrián Mora","baselineOrigin":{"league":"mexico","teamId":"guf","name":"Adrián Mora"},"shirtNumber":16}),
    withStats(player("Kevin Cardona", "ATT", 68, 76, 68, 62, 20), {"overall":69,"value":43038,"goals":11,"assists":4,"matches":12,"id":"roster_9ng9lc","rosterIdentity":"kevincardona","rosterStatus":"verified","rosterSourceIds":["mexico-guf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Galácticos del Caribe","photoLeague":"mexico","photoName":"Kevin Cardona","baselineOrigin":{"league":"mexico","teamId":"gdc","name":"Kevin Cardona"},"shirtNumber":22}),
    withStats(player("Alejandro Chimal", "DEF", 91, 88, 97, 88, 24), {"overall":91,"value":112221,"goals":1,"matches":4,"id":"roster_npbjdz","rosterIdentity":"alejandrochimal","rosterStatus":"verified","rosterSourceIds":["mexico-guf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Guerrilla FC","photoLeague":"mexico","photoName":"Alejandro Chimal","baselineOrigin":{"league":"mexico","teamId":"guf","name":"Alejandro Chimal"},"shirtNumber":25}),
    withStats(player("Miguel Rebollo", "ATT", 80, 87, 81, 72, 27), {"overall":80,"value":68834,"goals":12,"assists":2,"matches":8,"id":"roster_1yr5zel","rosterIdentity":"miguelrebollo","rosterStatus":"verified","rosterSourceIds":["mexico-guf-squad"],"rosterCheckedAt":"2026-10-26","attributesSource":"legacy-game","ageSource":"legacy-game","estimatedFields":[],"photoClub":"Simios FC","photoLeague":"mexico","photoName":"Miguel Rebollo","baselineOrigin":{"league":"mexico","teamId":"sim","name":"Miguel Rebollo"},"shirtNumber":93}),
  ] },
];

const ROSTER_REVISION = {
  "schemaVersion": 1,
  "checkedAt": "2026-10-26",
  "leagues": {
    "france": {
      "checkedAt": "2026-10-26",
      "season": "2025/26",
      "competition": "Kings League Crédit Agricole France — Split 2",
      "status": "partial",
      "completeTeams": 7,
      "partialTeams": 1,
      "retainedUnverifiedPlayers": 19,
      "sourceIds": [
        "france-teams",
        "france-golden-crown-2026-10-25",
        "france-domestic-stats",
        "france-sasha-profile",
        "france-ilyes-profile",
        "france-ali-profile",
        "france-lyes-profile",
        "france-marvin-profile",
        "france-u3d-squad",
        "france-kar-squad",
        "france-fcs-squad",
        "france-gs7-squad",
        "france-wpf-squad",
        "france-pas-squad",
        "france-tsn-squad",
        "france-adb-squad",
        "france-draft-1",
        "france-draft-2",
        "france-draft-3",
        "france-draft-5",
        "france-draft-6",
        "france-draft-10",
        "france-wildcard-2",
        "france-wildcard-3",
        "france-wildcard-1"
      ],
      "sources": [
        {
          "id": "france-teams",
          "url": "https://kingsleague.pro/fr/france/equipes",
          "title": "Équipes — Kings League France (Split 2)",
          "official": true
        },
        {
          "id": "france-golden-crown-2026-10-25",
          "url": "https://kingsleague.pro/fr/france/actualites/candidats-kings-league-golden-crown-2026-kings-league-france-fr",
          "title": "Moussa Sao, Guillaume Lesec et Matisse Henry, candidats au Kings League Golden Crown 2026",
          "publishedAt": "2026-10-25",
          "official": true
        },
        {
          "id": "france-domestic-stats",
          "url": "https://kingsleague.pro/fr/france/statistiques/defensives",
          "title": "Statistiques par joueur — Split 2 — Défensives",
          "official": true
        },
        {
          "id": "france-sasha-profile",
          "url": "https://www.kingsleague.pro/pt/jogadores/87355-sasha-bernard",
          "title": "Sasha Bernard — Karasu — profil officiel Split 2",
          "official": true
        },
        {
          "id": "france-ilyes-profile",
          "url": "https://kingsleague.pro/fr/joueurs/87472-ilyes-kallouche",
          "title": "Ilyes Kallouche — Karasu — profil officiel",
          "official": true
        },
        {
          "id": "france-ali-profile",
          "url": "https://kingsleague.pro/fr/joueurs/87358-ali-ouarti",
          "title": "Ali Ouarti — Karasu — profil officiel",
          "official": true
        },
        {
          "id": "france-lyes-profile",
          "url": "https://www.kingsleague.pro/pt/jogadores/87473-lyes-hocine",
          "title": "Lyes Hocine — Karasu — profil officiel Split 2",
          "official": true
        },
        {
          "id": "france-marvin-profile",
          "url": "https://kingsleague.pro/en/players/87580-marvin-gakpa",
          "title": "Marvin Gakpa — Karasu — profil officiel",
          "official": true
        },
        {
          "id": "france-u3d-squad",
          "url": "https://kingsleague.pro/fr/equipes/170-unit3d",
          "title": "Unit3d — official team page (2025/26 Split 2)",
          "official": true
        },
        {
          "id": "france-kar-squad",
          "url": "https://kingsleague.pro/fr/equipes/171-karasu",
          "title": "Karasu — official team page (KWC Clubs context; domestic use restricted to corroborated identities)",
          "official": true
        },
        {
          "id": "france-fcs-squad",
          "url": "https://kingsleague.pro/fr/equipes/172-fc-silmi",
          "title": "FC Silmi — official team page (2025/26 Split 2)",
          "official": true
        },
        {
          "id": "france-gs7-squad",
          "url": "https://kingsleague.pro/fr/equipes/173-generation-seven",
          "title": "Generation Seven — official team page (2025/26 Split 2)",
          "official": true
        },
        {
          "id": "france-wpf-squad",
          "url": "https://kingsleague.pro/fr/equipes/174-wolf-pack-fc",
          "title": "Wolf Pack FC — official team page (2025/26 Split 2)",
          "official": true
        },
        {
          "id": "france-pas-squad",
          "url": "https://kingsleague.pro/fr/equipes/175-panam-all-starz",
          "title": "Panam All Starz — official team page (2025/26 Split 2)",
          "official": true
        },
        {
          "id": "france-tsn-squad",
          "url": "https://kingsleague.pro/fr/equipes/176-360-nation",
          "title": "360 Nation — official team page (2025/26 Split 2)",
          "official": true
        },
        {
          "id": "france-adb-squad",
          "url": "https://kingsleague.pro/fr/equipes/232-athletic-dragon-blanc",
          "title": "Athletic Dragon Blanc — official team page (2025/26 Split 2)",
          "official": true
        },
        {
          "id": "france-draft-1",
          "url": "https://kingsleague.pro/fr/france/joueurs-draft?page=1",
          "title": "Joueurs draft — official Split 2 directory — page 1",
          "official": true
        },
        {
          "id": "france-draft-2",
          "url": "https://kingsleague.pro/fr/france/joueurs-draft?page=2",
          "title": "Joueurs draft — official Split 2 directory — page 2",
          "official": true
        },
        {
          "id": "france-draft-3",
          "url": "https://kingsleague.pro/fr/france/joueurs-draft?page=3",
          "title": "Joueurs draft — official Split 2 directory — page 3",
          "official": true
        },
        {
          "id": "france-draft-5",
          "url": "https://kingsleague.pro/fr/france/joueurs-draft?page=5",
          "title": "Joueurs draft — official Split 2 directory — page 5",
          "official": true
        },
        {
          "id": "france-draft-6",
          "url": "https://kingsleague.pro/fr/france/joueurs-draft?page=6",
          "title": "Joueurs draft — official Split 2 directory — page 6",
          "official": true
        },
        {
          "id": "france-draft-10",
          "url": "https://kingsleague.pro/fr/france/joueurs-draft?page=10",
          "title": "Joueurs draft — official Split 2 directory — page 10",
          "official": true
        },
        {
          "id": "france-wildcard-2",
          "url": "https://kingsleague.pro/fr/france/joueurs-wildcard?page=2",
          "title": "Joueurs wildcard — official Split 2 directory — page 2",
          "official": true
        },
        {
          "id": "france-wildcard-3",
          "url": "https://kingsleague.pro/fr/france/joueurs-wildcard?page=3",
          "title": "Joueurs wildcard — official Split 2 directory — page 3",
          "official": true
        },
        {
          "id": "france-wildcard-1",
          "url": "https://kingsleague.pro/fr/france/joueurs-wildcard",
          "title": "Joueurs wildcard — official Split 2 directory — page 1",
          "official": true
        }
      ],
      "uncertainties": [
        "Seven official team pages default to 2025/26 Split 2 and reproduce every baseline squad name (allowing case differences). Karasu defaults to 2025/26 KWC Clubs; its domestic roster is retained from baseline and corroborated through official Split 2 directories, statistics and individual profiles. Karasu rosterStatus remains partial because the complete domestic team-page selection could not be retrieved.",
        "Wildcard directory membership is recorded as registrationType=wildcard, but is not treated as proof of a one-match temporary signing. Full-split contributors such as Matisse Henry and Bakary Sako are wildcards too. They remain attached to their published domestic club unless a separately confirmed guest-only context exists.",
        "Official wildcard pagination is inconsistent in search cache: pages 1–3 show current Split 2; pages 4–5 return older Split 1 names and statistics. Older pages were excluded from current registration-type conclusions.",
        "Some official team-page entries publish no position: Mohamed Sangare, Anthony Adel, Aimen Belaid, Adama Doucouré, Sandy Mbala, Jimmy Briand, Noé Clerge, Souleymane Karamoko, Maxime Corain and Emmanuel Louisir. Their existing game position is retained and explicitly marked unverified; no new position was invented.",
        "Lyes Hocine official profile publishes the impossible birth date 25/07/2998. It was discarded; no correction was guessed.",
        "Current official KWC Karasu names Jean Loic, Geoffroy Arthaud and Junior Sele are not imported into the domestic roster without a domestic registration source. Sao and Lesec remain Wolf Pack players.",
        "No official post-May domestic transfer announcement affecting these eight squads was located in the checked sources. This does not establish that every historical season-page appearance is an active permanent contract."
      ],
      "withdrawnTeamIds": [],
      "observedOutsideAffiliations": []
    },
    "brazil": {
      "checkedAt": "2026-10-26",
      "season": "2026/27",
      "competition": "Kings Cup Brazil",
      "status": "complete",
      "completeTeams": 10,
      "partialTeams": 0,
      "retainedUnverifiedPlayers": 0,
      "sourceIds": [
        "brazil-g3x-squad",
        "brazil-fur-squad",
        "brazil-flx-squad",
        "brazil-den-squad",
        "brazil-lou-squad",
        "brazil-nyv-squad",
        "brazil-pod-squad",
        "brazil-cap-squad",
        "brazil-dpn-squad",
        "brazil-dib-squad",
        "brazil-draft-2026-10-05",
        "brazil-injury-kelvin",
        "brazil-teams-current"
      ],
      "sources": [
        {
          "id": "brazil-g3x-squad",
          "url": "https://www.kingsleague.pro/pt/times/49-g3x-fc",
          "title": "G3X FC — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "brazil-fur-squad",
          "url": "https://www.kingsleague.pro/pt/times/50-furia-fc",
          "title": "Furia FC — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "brazil-flx-squad",
          "url": "https://www.kingsleague.pro/pt/times/160-fluxo-fc",
          "title": "Fluxo FC — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "brazil-den-squad",
          "url": "https://www.kingsleague.pro/pt/times/161-dendele-fc",
          "title": "Dendele FC — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "brazil-lou-squad",
          "url": "https://www.kingsleague.pro/pt/times/162-loud-sc",
          "title": "LOUD SC — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "brazil-nyv-squad",
          "url": "https://www.kingsleague.pro/pt/times/163-nyvelados-fc",
          "title": "Nyvelados FC — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "brazil-pod-squad",
          "url": "https://www.kingsleague.pro/pt/times/164-podpah-funkbol-clube",
          "title": "Podpah Funkbol Clube — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "brazil-cap-squad",
          "url": "https://www.kingsleague.pro/pt/times/167-capim-fc",
          "title": "Capim FC — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "brazil-dpn-squad",
          "url": "https://www.kingsleague.pro/pt/times/168-desimpain",
          "title": "DesimpaiN — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "brazil-dib-squad",
          "url": "https://www.kingsleague.pro/pt/times/220-dibrados-fc",
          "title": "Dibrados FC — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "brazil-draft-2026-10-05",
          "url": "https://www.kingsleague.pro/pt/brazil/noticias/elencos-kings-cup-brazil-draft-gutinho-aleix-marti",
          "title": "Gutinho, Pick 1 do Draft, já tem time: veja os 10 elencos da Kings Cup Brazil",
          "publishedAt": "2026-10-05",
          "official": true
        },
        {
          "id": "brazil-injury-kelvin",
          "url": "https://www.kingsleague.pro/es/brazil/actualidad/que-le-ha-pasado-a-kelvin-oliveira-k9-operacion-kings-cup-brazil",
          "title": "Kelvin Oliveira se opera y se pierde la Kings Cup Brazil",
          "official": true
        },
        {
          "id": "brazil-teams-current",
          "url": "https://www.kingsleague.pro/pt/brazil/times",
          "title": "Kings Cup Brazil — official current teams",
          "official": true
        }
      ],
      "uncertainties": [
        "Current official team pages take precedence for displayed names and positions over the October 5 news roundup, which contains aliases and position inconsistencies: Daniel Ram DEF, Jader Vozinha MID, Cristhian Canhoto MID, GB Medeiros DEF, Erick Kaká ATT, João Choco ATT.",
        "Kelvin Oliveira remains on G3X official team page but the league explicitly confirms he will miss the entire Kings Cup after hip surgery. Preserve club identity and mark unavailable; do not treat his absence from the 12-player draft list as a transfer.",
        "Fluxo page lists 13 players, including unused Murillo Pulino; October 5 final draft roundup lists 12 and omits him. Registration remains uncertain for Murillo Pulino; no departure is asserted.",
        "Names differing between article and current official page include Guilherme Ramos/Guilherme Alves, Wellington Gomes/Welitim Gomes, Sidney Pages/Sidão Pages, Rodriguinho Rocha/Rodrigo Sheik, Lukinhas Santos/Lucas Lukinhas Henrique, Luis LF8/Luís Fernando, Romarinho/Andson Romarinho, Edipo Brito/Edipo Felipinho and Thiago Chupeta/Thiago Magalhães. Do not create duplicate identities from the article aliases without a profile identifier.",
        "The global /mercato table is the February 2026 window (kickoff February 5; windows February 9–12), superseded for Brazil by October draft and current Kings Cup registrations."
      ],
      "withdrawnTeamIds": [],
      "observedOutsideAffiliations": []
    },
    "spain": {
      "checkedAt": "2026-10-26",
      "season": "2025/26 (Spain publication); 2026/27 (confirmed destinations)",
      "competition": "Latest published domestic competition: Split 6; current October destinations checked against 2026/27 Italy/Brazil Cups",
      "status": "partial",
      "completeTeams": 0,
      "partialTeams": 12,
      "retainedUnverifiedPlayers": 185,
      "sourceIds": [
        "es-index",
        "es-team-1kf",
        "es-team-ebr",
        "es-team-jig",
        "es-team-lcc",
        "es-team-ltf",
        "es-team-pio",
        "es-team-por",
        "es-team-rdb",
        "es-team-say",
        "es-team-skl",
        "es-team-umo",
        "es-team-xby",
        "es-wildcards-1",
        "es-wildcards-2",
        "es-wildcards-3",
        "it-team-alp",
        "it-team-bbr",
        "it-team-boo",
        "it-team-cir",
        "it-team-dpw",
        "it-team-cae",
        "it-team-g7f",
        "it-team-stl",
        "it-team-trm",
        "it-team-und",
        "it-team-zeb",
        "it-team-zco",
        "br-oct-draft"
      ],
      "sources": [
        {
          "id": "es-index",
          "url": "https://kingsleague.pro/es/espana/equipos",
          "title": "Equipos — Kings League Spain, latest published season 2025/26",
          "official": true
        },
        {
          "id": "es-team-1kf",
          "url": "https://kingsleague.pro/es/equipos/12-1k-fc",
          "title": "1K FC — latest published squad, Split 6 2025/26",
          "official": true
        },
        {
          "id": "es-team-ebr",
          "url": "https://kingsleague.pro/es/equipos/9-el-barrio",
          "title": "El Barrio — latest published squad, Split 6 2025/26",
          "official": true
        },
        {
          "id": "es-team-jig",
          "url": "https://kingsleague.pro/es/equipos/4-jijantes-fc",
          "title": "Jijantes FC — latest published squad, Split 6 2025/26",
          "official": true
        },
        {
          "id": "es-team-lcc",
          "url": "https://kingsleague.pro/es/equipos/179-la-capital-cf",
          "title": "La Capital CF — latest published squad, KWC Clubs 2025/26",
          "official": true
        },
        {
          "id": "es-team-ltf",
          "url": "https://kingsleague.pro/es/equipos/6-los-troncos-fc",
          "title": "Los Troncos FC — latest published squad, KWC Clubs 2025/26",
          "official": true
        },
        {
          "id": "es-team-pio",
          "url": "https://kingsleague.pro/es/equipos/10-pio-fc",
          "title": "PIO FC — latest published squad, Split 6 2025/26",
          "official": true
        },
        {
          "id": "es-team-por",
          "url": "https://kingsleague.pro/es/equipos/2-porcinos-fc",
          "title": "Porcinos FC — latest published squad, KWC Clubs 2025/26",
          "official": true
        },
        {
          "id": "es-team-rdb",
          "url": "https://kingsleague.pro/es/equipos/5-rayo-de-barcelona",
          "title": "Rayo de Barcelona — latest published squad, Split 6 2025/26",
          "official": true
        },
        {
          "id": "es-team-say",
          "url": "https://kingsleague.pro/es/equipos/3-saiyans-fc",
          "title": "Saiyans FC — latest published squad, Split 6 2025/26",
          "official": true
        },
        {
          "id": "es-team-skl",
          "url": "https://kingsleague.pro/es/equipos/210-skull-fc",
          "title": "Skull FC — latest published squad, Split 6 2025/26",
          "official": true
        },
        {
          "id": "es-team-umo",
          "url": "https://kingsleague.pro/es/equipos/7-ultimate-mostoles",
          "title": "Ultimate Móstoles — latest published squad, KWC Clubs 2025/26",
          "official": true
        },
        {
          "id": "es-team-xby",
          "url": "https://kingsleague.pro/es/equipos/8-xbuyer-team",
          "title": "xBuyer Team — latest published squad, Split 6 2025/26",
          "official": true
        },
        {
          "id": "es-wildcards-1",
          "url": "https://kingsleague.pro/es/espana/jugadores-wildcard",
          "title": "Jugadores wildcard — Split 6, page 1",
          "official": true
        },
        {
          "id": "es-wildcards-2",
          "url": "https://kingsleague.pro/es/espana/jugadores-wildcard?page=2",
          "title": "Jugadores wildcard — Split 6, page 2",
          "official": true
        },
        {
          "id": "es-wildcards-3",
          "url": "https://kingsleague.pro/es/espana/jugadores-wildcard?page=3",
          "title": "Jugadores wildcard — Split 6, page 3",
          "official": true
        },
        {
          "id": "it-team-alp",
          "url": "https://kingsleague.pro/it/squadre/90-alpak-fc",
          "title": "Alpak FC — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-bbr",
          "url": "https://kingsleague.pro/it/squadre/201-bigbro",
          "title": "BIGBRO — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-boo",
          "url": "https://kingsleague.pro/it/squadre/85-boomers",
          "title": "Boomers — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-cir",
          "url": "https://kingsleague.pro/it/squadre/87-circus-fc",
          "title": "Circus FC — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-dpw",
          "url": "https://kingsleague.pro/it/squadre/200-d-power",
          "title": "D-POWER — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-cae",
          "url": "https://kingsleague.pro/it/squadre/89-fc-caesar",
          "title": "FC Caesar — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-g7f",
          "url": "https://kingsleague.pro/it/squadre/83-gear-7-fc",
          "title": "Gear 7 FC — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-stl",
          "url": "https://kingsleague.pro/it/squadre/59-stallions",
          "title": "Stallions — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-trm",
          "url": "https://kingsleague.pro/it/squadre/92-trm-fc",
          "title": "TRM FC — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-und",
          "url": "https://kingsleague.pro/it/squadre/93-underdogs-fc",
          "title": "Underdogs FC — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-zeb",
          "url": "https://kingsleague.pro/it/squadre/86-zebras-fc",
          "title": "Zebras FC — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-zco",
          "url": "https://kingsleague.pro/it/squadre/88-zeta-como",
          "title": "Zeta Como — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "br-oct-draft",
          "url": "https://www.kingsleague.pro/es/brazil/actualidad/plantillas-kings-cup-brazil-draft-gutinho-aleix-marti",
          "title": "Gutinho, Pick 1 del Draft, ya tiene equipo: así quedan las 10 plantillas de la Kings Cup Brazil",
          "publishedAt": "2026-10-05",
          "official": true
        }
      ],
      "uncertainties": [
        "All 12 Spain clubs were checked. The official Spain team season selector exposes 2023/24, 2024/25 and 2025/26 only; no complete 2026/27 domestic registration list was verified. Consequently every Spain roster is partial as of 2026-10-26 and players is intentionally empty: retain the supplied baseline except for independently confirmed moves and explicit guest-appearance evidence.",
        "lastPublishedRoster is historical evidence for review, not a claim of current October registration. Most club pages default to Split 6 (March–May 2026); La Capital CF, Los Troncos FC, Porcinos FC and Ultimate Móstoles default to KWC Clubs (July 2026). Tournament guest/loan squads must not overwrite domestic club registrations.",
        "KC Spain selector resolves to season=3, split=45 and is an earlier 2025/26 competition, not a newly published 2026/27 October roster. Observed source: https://kingsleague.pro/es/equipos/12-1k-fc?region=1&season=3&split=45.",
        "ConfirmedTransfers establishes later current team registrations from official Italy Cup pages or the Brazil October Draft announcement. No contract termination, transfer fee, exact signing date or permanent/loan status is inferred.",
        "Luis García appears in the supplied PIO and Ultimate Móstoles baseline; current Italy Gear 7 registration is the same named Spanish player. Roc Bancells appears in Rayo and La Capital baseline; current Italy Boomers registration supersedes those historical lists. Iván Torres similarly appears at Rayo and Ultimate. Avoid duplicate current player identities across leagues.",
        "Alias for confirmed Brazil move: Álex Guti in official club pages / Alex Guti in the October article / Álex Gutiérrez in the supplied Porcinos baseline. Current club Capim FC.",
        "Official Split 6 wildcard directory contains 28 names. observedWildcardPlayers identifies matching historical squad profiles; classification alone does not establish a one-match appearance, an expiry or a departure.",
        "Skull FC official historical page publishes two different Manu García profile rows (#77 and #70). They have not been collapsed into a purported current identity.",
        "All baseline team names match the current official Spain club index; no new club, dissolution or rename was verified. No ages, birth dates, ratings or attributes were invented."
      ],
      "withdrawnTeamIds": [],
      "observedOutsideAffiliations": []
    },
    "italy": {
      "checkedAt": "2026-10-26",
      "season": "2026/27",
      "competition": "Kings Cup Italy",
      "status": "complete",
      "completeTeams": 12,
      "partialTeams": 0,
      "retainedUnverifiedPlayers": 0,
      "sourceIds": [
        "it-index",
        "it-team-alp",
        "it-team-bbr",
        "it-team-boo",
        "it-team-cir",
        "it-team-dpw",
        "it-team-cae",
        "it-team-g7f",
        "it-team-stl",
        "it-team-trm",
        "it-team-und",
        "it-team-zeb",
        "it-team-zco",
        "it-wildcards"
      ],
      "sources": [
        {
          "id": "it-index",
          "url": "https://kingsleague.pro/it/italia/squadre",
          "title": "Squadre — Kings Cup Italy 2026/27",
          "official": true
        },
        {
          "id": "it-team-alp",
          "url": "https://kingsleague.pro/it/squadre/90-alpak-fc",
          "title": "Alpak FC — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-bbr",
          "url": "https://kingsleague.pro/it/squadre/201-bigbro",
          "title": "BIGBRO — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-boo",
          "url": "https://kingsleague.pro/it/squadre/85-boomers",
          "title": "Boomers — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-cir",
          "url": "https://kingsleague.pro/it/squadre/87-circus-fc",
          "title": "Circus FC — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-dpw",
          "url": "https://kingsleague.pro/it/squadre/200-d-power",
          "title": "D-POWER — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-cae",
          "url": "https://kingsleague.pro/it/squadre/89-fc-caesar",
          "title": "FC Caesar — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-g7f",
          "url": "https://kingsleague.pro/it/squadre/83-gear-7-fc",
          "title": "Gear 7 FC — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-stl",
          "url": "https://kingsleague.pro/it/squadre/59-stallions",
          "title": "Stallions — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-trm",
          "url": "https://kingsleague.pro/it/squadre/92-trm-fc",
          "title": "TRM FC — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-und",
          "url": "https://kingsleague.pro/it/squadre/93-underdogs-fc",
          "title": "Underdogs FC — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-zeb",
          "url": "https://kingsleague.pro/it/squadre/86-zebras-fc",
          "title": "Zebras FC — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-team-zco",
          "url": "https://kingsleague.pro/it/squadre/88-zeta-como",
          "title": "Zeta Como — Squadra, 2026/27 Kings Cup Italy",
          "official": true
        },
        {
          "id": "it-wildcards",
          "url": "https://kingsleague.pro/it/italia/giocatori-wildcard",
          "title": "Giocatori Wildcard — Kings Cup Italy",
          "official": true
        }
      ],
      "uncertainties": [
        "Latest verified competition is 2026/27 Kings Cup Italy, started 2026-10-19. These current competition squad pages supersede the older global Mercato 2026 registration table.",
        "ConfirmedTransfers here records players newly present at a club relative to the supplied game baseline and confirmed on the official current squad page. Dates, fees, and originating clubs are omitted where not independently verified; this is evidence of current registration, not a claimed transfer-contract chronology.",
        "No birth dates, ages, ratings or attributes were inferred. Official display names and positions were copied from current squad pages.",
        "All current official club-page profiles are retained, including the five directory-classified wildcards Roberto Ratti, David Grifell, Riccardo Ottaviani, Marco Longoni and Raoul Squitieri. Wildcard classification and 0-2 appearances at the start of the Cup do not establish a one-match-only contract or expiry."
      ],
      "withdrawnTeamIds": [],
      "observedOutsideAffiliations": []
    },
    "germany": {
      "checkedAt": "2026-10-26",
      "season": "Latest domestic official squad lists: 2025/26 Split 1; current player-profile affiliations checked through 2026/27 MENA Split 1",
      "competition": "Kings League Germany",
      "status": "partial",
      "completeTeams": 0,
      "partialTeams": 8,
      "retainedUnverifiedPlayers": 128,
      "sourceIds": [
        "de-teams",
        "mercato-2026",
        "de-mercato-announcement",
        "de-awards-2026",
        "de-draft-1",
        "de-draft-2",
        "de-wild-1",
        "de-wild-2",
        "mena-quarterfinals-2026",
        "de-team-erc",
        "de-team-g2f",
        "de-team-ist",
        "de-team-kak",
        "de-team-nrf",
        "de-team-ttf",
        "de-team-vvf",
        "de-team-you",
        "de-player-71129",
        "de-player-38499",
        "de-player-31",
        "de-player-79910",
        "de-player-67838",
        "de-player-34075",
        "de-player-69196",
        "de-player-68399",
        "de-player-84669",
        "de-player-80040",
        "de-player-87043",
        "de-player-79636",
        "de-player-84670",
        "de-player-87394",
        "de-player-87045",
        "de-player-87042",
        "de-player-84966",
        "de-player-85942",
        "de-player-79888",
        "de-player-79600",
        "de-player-84686",
        "de-player-79640",
        "de-player-79646",
        "de-player-84668",
        "de-player-79643",
        "de-player-79562",
        "de-player-87572",
        "de-player-84667",
        "de-player-84664",
        "de-player-87189",
        "de-player-87191",
        "de-player-87190",
        "de-player-87196",
        "de-player-87202",
        "de-player-87193",
        "de-player-87195",
        "de-player-87199",
        "de-player-87261",
        "de-player-87345",
        "de-player-87198",
        "de-player-71716",
        "de-player-87197",
        "de-player-84678",
        "de-player-85147",
        "de-player-86959",
        "de-player-86950",
        "de-player-80042",
        "de-player-85146",
        "de-player-87329",
        "de-player-87536",
        "de-player-87462",
        "de-player-86956",
        "de-player-71127",
        "de-player-79494",
        "de-player-178",
        "de-player-79485",
        "de-player-71132",
        "de-player-79739",
        "de-player-79484",
        "de-player-80036",
        "de-player-79545",
        "de-player-84676",
        "de-player-86967",
        "de-player-86969",
        "de-player-84973",
        "de-player-87263",
        "de-player-86966",
        "de-player-79553",
        "de-player-86965",
        "de-player-87264",
        "de-player-87396",
        "de-player-87041",
        "de-player-86963",
        "de-player-84675",
        "de-player-84687",
        "de-player-84691",
        "de-player-84976",
        "de-player-84689",
        "de-player-79759",
        "de-player-86957",
        "de-player-86961",
        "de-player-84692",
        "de-player-86962",
        "de-player-84688",
        "de-player-87271",
        "de-player-86958",
        "de-player-79803",
        "de-player-79827",
        "de-player-84694",
        "de-player-86948",
        "de-player-79602",
        "de-player-53024",
        "de-player-79644",
        "de-player-79625",
        "de-player-79891",
        "de-player-86954",
        "de-player-53028",
        "de-player-86949",
        "de-player-79653",
        "de-player-80486",
        "de-player-79622",
        "de-player-80492"
      ],
      "sources": [
        {
          "id": "de-teams",
          "url": "https://kingsleague.pro/en/germany/teams",
          "title": "Kings League Germany teams – 2025/26 Split 1",
          "official": true
        },
        {
          "id": "mercato-2026",
          "url": "https://www.kingsleague.pro/en/mercato",
          "title": "Kings League Mercato 2026 – official player market and completed transactions",
          "official": true
        },
        {
          "id": "de-mercato-announcement",
          "url": "https://kingsleague.pro/de/germany/aktuelles/mercato-2026-transfers-geruechte-und-bewegungen-hier",
          "title": "Mercato 2026: Transfers, Gerüchte und Bewegungen – hier",
          "publishedAt": "2026-02-05",
          "official": true
        },
        {
          "id": "de-awards-2026",
          "url": "https://kingsleague.pro/en/germany/news/kings-league-golden-crown-2026-nominees-kings-league-germany",
          "title": "Mehmet-Can Senocak and three No Rules FC players, Kings League Golden Crown 2026 nominees",
          "publishedAt": "2026-10-24",
          "official": true
        },
        {
          "id": "de-draft-1",
          "url": "https://kingsleague.pro/en/germany/draft-players",
          "title": "Germany official draft players – 2025/26 Split 1, page 1",
          "official": true
        },
        {
          "id": "de-draft-2",
          "url": "https://kingsleague.pro/en/germany/draft-players?page=2",
          "title": "Germany official draft players – 2025/26 Split 1, page 2",
          "official": true
        },
        {
          "id": "de-wild-1",
          "url": "https://kingsleague.pro/en/germany/wildcard-players",
          "title": "Germany official wildcard players – 2025/26 Split 1, page 1",
          "official": true
        },
        {
          "id": "de-wild-2",
          "url": "https://kingsleague.pro/en/germany/wildcard-players?page=2",
          "title": "Germany official wildcard players – 2025/26 Split 1, page 2",
          "official": true
        },
        {
          "id": "mena-quarterfinals-2026",
          "url": "https://www.kingsleague.pro/en/mena/news/kings-league-mena-quarter-finals-schedule-split-1",
          "title": "Red Zone and RA2 FC open the Kings League MENA Quarter-Finals with a rematch: Monday 26 October schedule",
          "publishedAt": "2026-10-24",
          "official": true
        },
        {
          "id": "de-team-erc",
          "url": "https://kingsleague.pro/en/teams/186-era-colonia",
          "title": "ERA Colonia official squad – 2025/26 Split 1",
          "official": true
        },
        {
          "id": "de-team-g2f",
          "url": "https://kingsleague.pro/en/teams/188-g2-fc",
          "title": "G2 FC official squad – 2025/26 Split 1",
          "official": true
        },
        {
          "id": "de-team-ist",
          "url": "https://kingsleague.pro/en/teams/229-istanbul-united",
          "title": "Istanbul United official squad – 2025/26 Split 1",
          "official": true
        },
        {
          "id": "de-team-kak",
          "url": "https://kingsleague.pro/en/teams/184-kaktus-kickers",
          "title": "Kaktus Kickers official squad – 2025/26 Split 1",
          "official": true
        },
        {
          "id": "de-team-nrf",
          "url": "https://kingsleague.pro/en/teams/187-no-rules-fc",
          "title": "No Rules FC official squad – 2025/26 KWC Clubs",
          "official": true
        },
        {
          "id": "de-team-ttf",
          "url": "https://kingsleague.pro/en/teams/183-tiki-tacker-ff",
          "title": "Tiki Tacker FF official squad – 2025/26 Split 1",
          "official": true
        },
        {
          "id": "de-team-vvf",
          "url": "https://kingsleague.pro/en/teams/185-vice-versa-fc",
          "title": "Vice Versa FC official squad – 2025/26 Split 1",
          "official": true
        },
        {
          "id": "de-team-you",
          "url": "https://kingsleague.pro/en/teams/51-youniors-fc",
          "title": "Youniors F.C. official squad – 2025/26 Split 1",
          "official": true
        },
        {
          "id": "de-player-71129",
          "url": "https://kingsleague.pro/en/players/71129-nick-salihamidzic",
          "title": "Nick Salihamidžić official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-38499",
          "url": "https://kingsleague.pro/en/players/38499-amar-cekic",
          "title": "Amar Cekic official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-31",
          "url": "https://kingsleague.pro/en/players/31-gilles-vidal",
          "title": "Gilles Vidal official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79910",
          "url": "https://kingsleague.pro/en/players/79910-zinedine-hukporti",
          "title": "Zinedine Hukporti official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-67838",
          "url": "https://kingsleague.pro/en/players/67838-jhon-palacios",
          "title": "Jhon Palacios official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-34075",
          "url": "https://kingsleague.pro/en/players/34075-maicon-silva",
          "title": "Maicon Silva official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-69196",
          "url": "https://kingsleague.pro/en/players/69196-david-brinquinho",
          "title": "David 'Brinquinho' official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-68399",
          "url": "https://kingsleague.pro/en/players/68399-luiz-pepinho-souza",
          "title": "Luiz 'Pepinho' Souza official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84669",
          "url": "https://kingsleague.pro/en/players/84669-dylan-bos",
          "title": "Dylan Bos official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-80040",
          "url": "https://kingsleague.pro/en/players/80040-nico-czichi",
          "title": "Nico Czichi official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87043",
          "url": "https://kingsleague.pro/en/players/87043-yoel-yilma",
          "title": "Yoel Yilma official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79636",
          "url": "https://kingsleague.pro/en/players/79636-abdelaziz-slimi",
          "title": "Abdelaziz Slimi official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84670",
          "url": "https://kingsleague.pro/en/players/84670-ahmed-azirar",
          "title": "Ahmed Azirar official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87394",
          "url": "https://kingsleague.pro/en/players/87394-dennis-de-sousa",
          "title": "Dennis de Sousa official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87045",
          "url": "https://kingsleague.pro/en/players/87045-elias-romers",
          "title": "Elias Römers official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87042",
          "url": "https://kingsleague.pro/en/players/87042-erkan-kurucam",
          "title": "Erkan Kurucam official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84966",
          "url": "https://kingsleague.pro/en/players/84966-etienne-reck",
          "title": "Etienne Reck official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-85942",
          "url": "https://kingsleague.pro/en/players/85942-mounir-bouziane",
          "title": "Mounir Bouziane official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79888",
          "url": "https://kingsleague.pro/en/players/79888-daniel-maus",
          "title": "Daniel Maus official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79600",
          "url": "https://kingsleague.pro/en/players/79600-moritz-leitner",
          "title": "Moritz Leitner official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84686",
          "url": "https://kingsleague.pro/en/players/84686-philipp-klement",
          "title": "Philipp Klement official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79640",
          "url": "https://kingsleague.pro/en/players/79640-ahmed-omairat",
          "title": "Ahmed Omairat official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79646",
          "url": "https://kingsleague.pro/en/players/79646-cihan-ucar",
          "title": "Cihan Ucar official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84668",
          "url": "https://kingsleague.pro/en/players/84668-mehmet-can-senocak",
          "title": "Mehmet-Can Senocak official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79643",
          "url": "https://kingsleague.pro/en/players/79643-tarik-hadziavdic",
          "title": "Tarik Hadziavdic official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79562",
          "url": "https://kingsleague.pro/en/players/79562-dennis-ozturk",
          "title": "Dennis Öztürk official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87572",
          "url": "https://kingsleague.pro/en/players/87572-smajo-jakupovic",
          "title": "Smajo Jakupovic official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84667",
          "url": "https://kingsleague.pro/en/players/84667-artin-zardoshtian",
          "title": "Artin Zardoshtian official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84664",
          "url": "https://kingsleague.pro/en/players/84664-mohammed-izal",
          "title": "Mohammed Izal official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87189",
          "url": "https://kingsleague.pro/en/players/87189-niklas-reichel",
          "title": "Niklas Reichel official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87191",
          "url": "https://kingsleague.pro/en/players/87191-burak-mus",
          "title": "Burak Mus official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87190",
          "url": "https://kingsleague.pro/en/players/87190-kerem-sengun",
          "title": "Kerem Sengün official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87196",
          "url": "https://kingsleague.pro/en/players/87196-mardochee-tchakoumi",
          "title": "Mardochee Tchakoumi official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87202",
          "url": "https://kingsleague.pro/en/players/87202-murat-saglam",
          "title": "Murat Saglam official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87193",
          "url": "https://kingsleague.pro/en/players/87193-oliver-lanwer",
          "title": "Oliver Lanwer official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87195",
          "url": "https://kingsleague.pro/en/players/87195-max-wilschrey",
          "title": "Max Wilschrey official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87199",
          "url": "https://kingsleague.pro/en/players/87199-burak-ozmen",
          "title": "Burak Özmen official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87261",
          "url": "https://kingsleague.pro/en/players/87261-ilias-arssi",
          "title": "Ilias Arssi official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87345",
          "url": "https://kingsleague.pro/en/players/87345-ali-hassan-hammoud",
          "title": "Ali Hassan Hammoud official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87198",
          "url": "https://kingsleague.pro/en/players/87198-amir-ahmadi",
          "title": "Amir Ahmadi official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-71716",
          "url": "https://kingsleague.pro/en/players/71716-jama-telli",
          "title": "Jama Telli official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87197",
          "url": "https://kingsleague.pro/en/players/87197-sangar-aziz",
          "title": "Sangar Aziz official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84678",
          "url": "https://kingsleague.pro/en/players/84678-taner-yalcin",
          "title": "Taner Yalcin official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-85147",
          "url": "https://kingsleague.pro/en/players/85147-bilal-abdallah",
          "title": "Bilal Abdallah official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-86959",
          "url": "https://kingsleague.pro/en/players/86959-gaspard-fehlinger",
          "title": "Gaspard Fehlinger official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-86950",
          "url": "https://kingsleague.pro/en/players/86950-mohamed-dahas",
          "title": "Mohamed Dahas official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-80042",
          "url": "https://kingsleague.pro/en/players/80042-noah-can",
          "title": "Noah Can official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-85146",
          "url": "https://kingsleague.pro/en/players/85146-yazid-tambo",
          "title": "Yazid Tambo official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87329",
          "url": "https://kingsleague.pro/en/players/87329-mohamed-rabia",
          "title": "Mohamed Rabia official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87536",
          "url": "https://kingsleague.pro/en/players/87536-bilal-akguvercin",
          "title": "Bilal Akgüvercin official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87462",
          "url": "https://kingsleague.pro/en/players/87462-jacob-goker",
          "title": "Jacob Göker official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-86956",
          "url": "https://kingsleague.pro/en/players/86956-elias-beck",
          "title": "Elias Beck official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-71127",
          "url": "https://kingsleague.pro/en/players/71127-fabio-rasic",
          "title": "Fabio Rasic official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79494",
          "url": "https://kingsleague.pro/en/players/79494-daniel-jelisic",
          "title": "Daniel Jelisic official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-178",
          "url": "https://kingsleague.pro/en/players/178-diego-de-la-mata",
          "title": "Diego de la Mata official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79485",
          "url": "https://kingsleague.pro/en/players/79485-ensar-skrijelj",
          "title": "Ensar Skrijelj official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-71132",
          "url": "https://kingsleague.pro/en/players/71132-anthony-manuba",
          "title": "Anthony Manuba official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79739",
          "url": "https://kingsleague.pro/en/players/79739-nam-nguyen",
          "title": "Nam Nguyen official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79484",
          "url": "https://kingsleague.pro/en/players/79484-serhat-imsak",
          "title": "Serhat Imsak official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-80036",
          "url": "https://kingsleague.pro/en/players/80036-aboubakar-fofana",
          "title": "Aboubakar Fofana official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79545",
          "url": "https://kingsleague.pro/en/players/79545-finn-hanke",
          "title": "Finn Hanke official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84676",
          "url": "https://kingsleague.pro/en/players/84676-nikola-stankovic",
          "title": "Nikola Stankovic official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-86967",
          "url": "https://kingsleague.pro/en/players/86967-noah-dahaba",
          "title": "Noah Dahaba official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-86969",
          "url": "https://kingsleague.pro/en/players/86969-philip-koch",
          "title": "Philip Koch official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84973",
          "url": "https://kingsleague.pro/en/players/84973-diego-larralde",
          "title": "Diego Larralde official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87263",
          "url": "https://kingsleague.pro/en/players/87263-fabio-lopes",
          "title": "Fabio Lopes official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-86966",
          "url": "https://kingsleague.pro/en/players/86966-marko-tadic",
          "title": "Marko Tadic official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79553",
          "url": "https://kingsleague.pro/en/players/79553-bennett-schauer",
          "title": "Bennett Schauer official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-86965",
          "url": "https://kingsleague.pro/en/players/86965-jean-atohoun",
          "title": "Jean Atohoun official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87264",
          "url": "https://kingsleague.pro/en/players/87264-ephrahim-asante",
          "title": "Ephrahim Asante official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87396",
          "url": "https://kingsleague.pro/en/players/87396-farukhan-bulut",
          "title": "Farukhan Bulut official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87041",
          "url": "https://kingsleague.pro/en/players/87041-lionel-lingani",
          "title": "Lionel Lingani official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-86963",
          "url": "https://kingsleague.pro/en/players/86963-luca-freese",
          "title": "Luca Freese official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84675",
          "url": "https://kingsleague.pro/en/players/84675-mustafa-zazai",
          "title": "Mustafa Zazai official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84687",
          "url": "https://kingsleague.pro/en/players/84687-marvin-gomoluch",
          "title": "Marvin Gomoluch official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84691",
          "url": "https://kingsleague.pro/en/players/84691-ali-alawie",
          "title": "Ali Alawie official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84976",
          "url": "https://kingsleague.pro/en/players/84976-constantin-pennartz",
          "title": "Constantin Pennartz official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84689",
          "url": "https://kingsleague.pro/en/players/84689-hagen-blohm",
          "title": "Hagen Blohm official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79759",
          "url": "https://kingsleague.pro/en/players/79759-jannis-becker",
          "title": "Jannis Becker official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-86957",
          "url": "https://kingsleague.pro/en/players/86957-saif-ayadi",
          "title": "Saif-Ayadi official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-86961",
          "url": "https://kingsleague.pro/en/players/86961-francisco-garcia",
          "title": "Francisco Garcia official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84692",
          "url": "https://kingsleague.pro/en/players/84692-hussain-alawie",
          "title": "Hussain Alawie official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-86962",
          "url": "https://kingsleague.pro/en/players/86962-yassine-gnondi",
          "title": "Yassine Gnondi official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84688",
          "url": "https://kingsleague.pro/en/players/84688-yannick-marko",
          "title": "Yannick Marko official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-87271",
          "url": "https://kingsleague.pro/en/players/87271-nils-schutte",
          "title": "Nils Schütte official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-86958",
          "url": "https://kingsleague.pro/en/players/86958-sven-wurm",
          "title": "Sven Wurm official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79803",
          "url": "https://kingsleague.pro/en/players/79803-david-putz",
          "title": "David Pütz official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79827",
          "url": "https://kingsleague.pro/en/players/79827-halil-dogan",
          "title": "Halil Doğan official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-84694",
          "url": "https://kingsleague.pro/en/players/84694-shpend-hasani",
          "title": "Shpend Hasani official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-86948",
          "url": "https://kingsleague.pro/en/players/86948-max-wismann",
          "title": "Max Wißmann official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79602",
          "url": "https://kingsleague.pro/en/players/79602-maximilian-krapf",
          "title": "Maximilian Krapf official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-53024",
          "url": "https://kingsleague.pro/en/players/53024-ahmed-azaouagh",
          "title": "Ahmed Azaouagh official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79644",
          "url": "https://kingsleague.pro/en/players/79644-emir-sejdovic",
          "title": "Emir Sejdovic official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79625",
          "url": "https://kingsleague.pro/en/players/79625-henoc-agbessi",
          "title": "Henoc Agbessi official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79891",
          "url": "https://kingsleague.pro/en/players/79891-sokratis-papastathopoulos",
          "title": "Sokratis Papastathopoulos official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-86954",
          "url": "https://kingsleague.pro/en/players/86954-christian-clemens",
          "title": "Christian Clemens official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-53028",
          "url": "https://kingsleague.pro/en/players/53028-julien-vercauteren",
          "title": "Julien Vercauteren official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-86949",
          "url": "https://kingsleague.pro/en/players/86949-naoufal-azzagari",
          "title": "Naoufal Azzagari official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79653",
          "url": "https://kingsleague.pro/en/players/79653-lordan-handanovic",
          "title": "Lordan Handanovic official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-80486",
          "url": "https://kingsleague.pro/en/players/80486-marco-terrazzino",
          "title": "Marco Terrazzino official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-79622",
          "url": "https://kingsleague.pro/en/players/79622-danny-blum",
          "title": "Danny Blum official profile and latest team",
          "official": true
        },
        {
          "id": "de-player-80492",
          "url": "https://kingsleague.pro/en/players/80492-kevin-moreira",
          "title": "Kevin Moreira official profile and latest team",
          "official": true
        }
      ],
      "uncertainties": [
        "All eight teams are partial for CURRENT registration. The domestic club pages show the complete 2025/26 Split 1 season squad history, including multiple wildcard replacements. They are not authoritative twelve-player registrations as of October 26.",
        "The official February 2026 Mercato page is a completed February market snapshot. Its complete current-club table could not be extracted; web search exposed its completed transaction log. No twelve-player roster was inferred or invented.",
        "Eight players in the old German season squads now have MENA clubs on their latest official player profiles. They are separated into observedOutsideAffiliations and omitted from the proposed current German list. These profile changes alone do not prove an exclusive permanent transfer, a contract termination, or a precise effective date. The official October 24 MENA preview independently confirms Gilles Vidal at Red Zone.",
        "The October 24 German Golden Crown article uses award-season affiliations (No Rules FC for Salihamidžić/Cekic/Vidal); these should not override later active MENA player profiles.",
        "Gabriel Costa appears for No Rules FC only in the KWC Clubs squad and his latest profile is Dibrados FC. He was not added as a permanent German player.",
        "Daniel Rampertshammer is recorded as a completed Window 4 acquisition for No Rules FC but no verified position, date of birth or current profile was retrieved; no player entry was invented.",
        "Noah Kurmali in the Mercato is likely an alias of existing Kaktus player Noah Can, but official identity equivalence was not established. Do not create a duplicate.",
        "Mercato transaction dates are mapped from the official numbered-window calendar, rather than separate per-transfer timestamps; 'New Acquisition' is retained as an origin label and is not treated as an identifiable former club.",
        "Player dates of birth come only from successfully fetched official English profiles; their format is MM/DD/YYYY and has been converted to ISO. Missing dates/ages/ratings were not guessed.",
        "28 linked player profiles returned cache misses/timeouts. Their official IDs and listed positions were still verified from the season club-page links, but their latest team and birth date remain unverified.",
        "German wildcard directory pages beyond page 2 could not be reliably retrieved in the current season. registrationType is omitted when the classification was not verified.",
        "Coaching information verified from current official season club pages: Istanbul United Ali Amir Mostowfi; Kaktus Kickers Dominic Reinold and David Strack."
      ],
      "withdrawnTeamIds": [],
      "observedOutsideAffiliations": [
        {
          "name": "Nick Salihamidžić",
          "pos": "MID",
          "officialPlayerId": "71129",
          "sourceIds": [
            "de-team-nrf",
            "de-player-71129",
            "de-draft-1"
          ],
          "birthDate": "2003-02-08",
          "registrationType": "registered",
          "fromTeamId": "nrf",
          "currentOfficialTeam": "Bakhira F.C.",
          "evidenceType": "latest official player profile; exclusivity/contract termination unconfirmed"
        },
        {
          "name": "Amar Cekic",
          "pos": "ATT",
          "officialPlayerId": "38499",
          "sourceIds": [
            "de-team-nrf",
            "de-player-38499",
            "de-wild-1"
          ],
          "birthDate": "1992-12-21",
          "registrationType": "wildcard",
          "fromTeamId": "nrf",
          "currentOfficialTeam": "Bakhira F.C.",
          "evidenceType": "latest official player profile; exclusivity/contract termination unconfirmed"
        },
        {
          "name": "Gilles Vidal",
          "pos": "ATT",
          "officialPlayerId": "31",
          "sourceIds": [
            "de-team-nrf",
            "de-player-31",
            "de-wild-1"
          ],
          "birthDate": "2002-10-26",
          "registrationType": "wildcard",
          "fromTeamId": "nrf",
          "currentOfficialTeam": "Red Zone",
          "evidenceType": "latest official player profile; exclusivity/contract termination unconfirmed"
        },
        {
          "name": "Zinedine Hukporti",
          "pos": "DEF",
          "officialPlayerId": "79910",
          "sourceIds": [
            "de-team-ttf",
            "de-player-79910"
          ],
          "birthDate": "2003-04-30",
          "fromTeamId": "ttf",
          "currentOfficialTeam": "Bakhira F.C.",
          "evidenceType": "latest official player profile; exclusivity/contract termination unconfirmed"
        },
        {
          "name": "Jhon Palacios",
          "pos": "ATT",
          "officialPlayerId": "67838",
          "sourceIds": [
            "de-team-you",
            "de-player-67838",
            "de-draft-1"
          ],
          "birthDate": "2001-07-03",
          "registrationType": "registered",
          "fromTeamId": "you",
          "currentOfficialTeam": "DR7",
          "evidenceType": "latest official player profile; exclusivity/contract termination unconfirmed"
        },
        {
          "name": "Maicon Silva",
          "pos": "DEF",
          "officialPlayerId": "34075",
          "sourceIds": [
            "de-team-you",
            "de-player-34075",
            "de-wild-1"
          ],
          "birthDate": "1998-04-02",
          "registrationType": "wildcard",
          "fromTeamId": "you",
          "currentOfficialTeam": "Bakhira F.C.",
          "evidenceType": "latest official player profile; exclusivity/contract termination unconfirmed"
        },
        {
          "name": "David 'Brinquinho'",
          "pos": "MID",
          "officialPlayerId": "69196",
          "sourceIds": [
            "de-team-you",
            "de-player-69196",
            "de-wild-1"
          ],
          "birthDate": "1995-02-24",
          "registrationType": "wildcard",
          "fromTeamId": "you",
          "currentOfficialTeam": "DR7",
          "evidenceType": "latest official player profile; exclusivity/contract termination unconfirmed"
        },
        {
          "name": "Luiz 'Pepinho' Souza",
          "pos": "ATT",
          "officialPlayerId": "68399",
          "sourceIds": [
            "de-team-you",
            "de-player-68399",
            "de-wild-1"
          ],
          "birthDate": "1996-04-14",
          "registrationType": "wildcard",
          "fromTeamId": "you",
          "currentOfficialTeam": "Bakhira F.C.",
          "evidenceType": "latest official player profile; exclusivity/contract termination unconfirmed"
        }
      ]
    },
    "mexico": {
      "checkedAt": "2026-10-26",
      "season": "2026/27",
      "competition": "Kings Cup Openbank Mexico",
      "status": "complete",
      "completeTeams": 10,
      "partialTeams": 0,
      "retainedUnverifiedPlayers": 0,
      "sourceIds": [
        "mexico-anq-squad",
        "mexico-atp-squad",
        "mexico-cdc-squad",
        "mexico-gdc-squad",
        "mexico-lch-squad",
        "mexico-pca-squad",
        "mexico-per-squad",
        "mexico-rnz-squad",
        "mexico-kru-squad",
        "mexico-guf-squad",
        "mexico-teams-current",
        "mexico-final-2026-10-25",
        "mexico-withdrawals-2026-08-20",
        "mexico-marco-legend-2026-09-13",
        "mexico-chaco-legend-official",
        "mexico-legend-card-rules-2026"
      ],
      "sources": [
        {
          "id": "mexico-anq-squad",
          "url": "https://www.kingsleague.pro/es/equipos/11-aniquiladores-fc",
          "title": "Aniquiladores FC — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "mexico-atp-squad",
          "url": "https://www.kingsleague.pro/es/equipos/37-atletico-parceros-fc",
          "title": "Atlético Parceros FC — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "mexico-cdc-squad",
          "url": "https://www.kingsleague.pro/es/equipos/38-club-de-cuervos",
          "title": "Club de Cuervos — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "mexico-gdc-squad",
          "url": "https://www.kingsleague.pro/es/equipos/39-galacticos-del-caribe",
          "title": "Galácticos del Caribe — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "mexico-lch-squad",
          "url": "https://www.kingsleague.pro/es/equipos/41-los-chamos-fc",
          "title": "Los Chamos FC — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "mexico-pca-squad",
          "url": "https://www.kingsleague.pro/es/equipos/44-peluche-caligari",
          "title": "Peluche Caligari — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "mexico-per-squad",
          "url": "https://www.kingsleague.pro/es/equipos/45-persas-fc",
          "title": "Persas FC — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "mexico-rnz-squad",
          "url": "https://www.kingsleague.pro/es/equipos/46-raniza-fc",
          "title": "Raniza FC — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "mexico-kru-squad",
          "url": "https://www.kingsleague.pro/es/equipos/198-kru-fc",
          "title": "KRÜ FC — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "mexico-guf-squad",
          "url": "https://www.kingsleague.pro/es/equipos/213-guerrilla-fc",
          "title": "Guerrilla FC — official 2026/27 season squad",
          "official": true
        },
        {
          "id": "mexico-teams-current",
          "url": "https://www.kingsleague.pro/es/americas/equipos",
          "title": "Kings Cup Mexico — official current teams (10 clubs)",
          "official": true
        },
        {
          "id": "mexico-final-2026-10-25",
          "url": "https://www.kingsleague.pro/es/americas/actualidad/atletico-parceros-campeon-kings-cup-mexico-2026",
          "title": "Atlético Parceros FC gana la Kings Cup Mexico con un 6-4",
          "publishedAt": "2026-10-25",
          "official": true
        },
        {
          "id": "mexico-withdrawals-2026-08-20",
          "url": "https://hola.mx/24980/%C2%A1Regreso%20con%20cambios%21%20Kings%20y%20Queens%20League%20M%C3%A9xico%20anuncian%20copa%20con%20menos%20equipos",
          "title": "¡Regreso con cambios! Kings y Queens League México anuncian copa con menos equipos",
          "publishedAt": "2026-08-20",
          "official": false
        },
        {
          "id": "mexico-marco-legend-2026-09-13",
          "url": "https://www.tvazteca.com/aztecadeportes/marco-fabian-anunciado-nuevo-fichaje-equipo-ciudad-de-mexico/?_amp=true",
          "title": "Marco Fabián anunciado como Jugador Leyenda de Peluche Caligari",
          "publishedAt": "2026-09-13",
          "official": false
        },
        {
          "id": "mexico-chaco-legend-official",
          "url": "https://www.kingsleague.pro/es/americas/actualidad/horarios-jornada-1-kings-league-openbank-mexico-split-4",
          "title": "Horarios Jornada 1 Split 4 — Christian Chaco Giménez como Jugador Leyenda",
          "official": true
        },
        {
          "id": "mexico-legend-card-rules-2026",
          "url": "https://cms-es.kingsleague.pro/wp-content/uploads/2025/02/reglamento-20260313-es.pdf.pdf",
          "title": "Reglamento 2026, apartado 3.2: Carta jugador leyenda para el partido de la jornada",
          "publishedAt": "2026-03-13",
          "official": true
        }
      ],
      "uncertainties": [
        "All ten active clubs have complete current official season-page squad listings. These pages include more than twelve players for some clubs, so their season appearance lists alone cannot prove permanent registration of every entry.",
        "Do not promote Peluche Caligari guest legends Christian Gimenez and Marco Fabian into permanent transfers. They are preserved separately as wildcard appearances with supporting sources.",
        "No primary Los Aliens/Simios departure announcement was found. Their departures are explicit in August 20 secondary reporting and corroborated by the official current ten-club list; preserve old rosters in archivedBaselineTeams for save compatibility rather than treating their players as current registrations.",
        "Exact transfer dates and contract lengths for most Mexico roster changes were not available. Current official club membership is verified; source baseline comparisons should be treated as game-data reconciliation, not independently dated transfer announcements.",
        "Ambiguous replacements/guests retained in official season-page lists include Cristian Hernández (Peluche), José Campa (Cuervos), Julio Torres and Daniel Ramos (Galácticos), Hatzel Roque, Román Ramírez and Gustavo Gutiérrez (Chamos), Hugo Rodríguez and Eddie Sánchez (Raniza), and Donovan Hernández/Valentín Viola (KRÜ). Do not infer permanence or release from number of appearances alone.",
        "Official page spelling can vary by crawl (Jovany/Jovany Santana). Normalize to verified player identity when importing; no invented birthdates or ratings included.",
        "The global /mercato table is February 2026 and should not overwrite these newer September/October Kings Cup squads."
      ],
      "withdrawnTeamIds": [
        "lal",
        "sim"
      ],
      "observedOutsideAffiliations": []
    }
  },
  "identityDecisions": [
    {
      "name": "Álex Guti",
      "retainedAt": "brazil/cap",
      "historicalReferenceRemoved": "spain/por",
      "basis": "newer-complete-official-squad"
    },
    {
      "name": "Cristian Lobato",
      "retainedAt": "spain/jig",
      "historicalReferenceRemoved": "spain/por",
      "basis": "domestic-profile-over-tournament-reference"
    },
    {
      "name": "Roc Bancells",
      "retainedAt": "spain/lcc",
      "historicalReferenceRemoved": "spain/rdb",
      "basis": "duplicate-legacy-reference-current-affiliation-unverified"
    },
    {
      "name": "Marcelo Vieira",
      "retainedAt": "spain/skl",
      "historicalReferenceRemoved": "spain/skl",
      "basis": "duplicate-legacy-reference-current-affiliation-unverified"
    },
    {
      "name": "I. Sugranyes",
      "retainedAt": "spain/rdb",
      "historicalReferenceRemoved": "spain/umo",
      "basis": "duplicate-legacy-reference-current-affiliation-unverified"
    },
    {
      "name": "Luis García",
      "retainedAt": "spain/pio",
      "historicalReferenceRemoved": "spain/umo",
      "basis": "duplicate-legacy-reference-current-affiliation-unverified"
    },
    {
      "name": "Aleix Martí",
      "retainedAt": "brazil/g3x",
      "historicalReferenceRemoved": "spain/umo",
      "basis": "newer-complete-official-squad"
    },
    {
      "name": "Roc Bancells",
      "retainedAt": "italy/boo",
      "historicalReferenceRemoved": "spain/lcc",
      "basis": "newer-complete-official-squad"
    },
    {
      "name": "Iván Torres",
      "retainedAt": "italy/cir",
      "historicalReferenceRemoved": "spain/rdb",
      "basis": "newer-complete-official-squad"
    },
    {
      "name": "David Grifell",
      "retainedAt": "italy/cir",
      "historicalReferenceRemoved": "spain/umo",
      "basis": "newer-complete-official-squad"
    },
    {
      "name": "Joan Oriol",
      "retainedAt": "italy/g7f",
      "historicalReferenceRemoved": "spain/ltf",
      "basis": "newer-complete-official-squad"
    },
    {
      "name": "Luis García",
      "retainedAt": "italy/g7f",
      "historicalReferenceRemoved": "spain/pio",
      "basis": "newer-complete-official-squad"
    },
    {
      "name": "Adri Espinar",
      "retainedAt": "italy/g7f",
      "historicalReferenceRemoved": "spain/pio",
      "basis": "newer-complete-official-squad"
    },
    {
      "name": "Carles Planas",
      "retainedAt": "italy/stl",
      "historicalReferenceRemoved": "spain/ltf",
      "basis": "newer-complete-official-squad"
    },
    {
      "name": "Nico Santos",
      "retainedAt": "italy/stl",
      "historicalReferenceRemoved": "spain/por",
      "basis": "newer-complete-official-squad"
    },
    {
      "name": "Pablo Beguer",
      "retainedAt": "italy/trm",
      "historicalReferenceRemoved": "spain/lcc",
      "basis": "newer-complete-official-squad"
    },
    {
      "name": "Nadir Louah",
      "retainedAt": "italy/und",
      "historicalReferenceRemoved": "spain/por",
      "basis": "newer-complete-official-squad"
    },
    {
      "name": "Diego de la Mata",
      "retainedAt": "italy/g7f",
      "historicalReferenceRemoved": "germany/nrf",
      "basis": "newer-complete-official-squad"
    },
    {
      "name": "David 'Brinquinho'",
      "retainedAt": "brazil/dpn",
      "historicalReferenceRemoved": "germany/you",
      "basis": "newer-complete-official-squad"
    }
  ]
};
const ROSTER_SOURCES = Object.assign({}, ...Object.values(ROSTER_REVISION.leagues).map(revision => Object.fromEntries(revision.sources.map(source => [source.id, source]))));
const LEAGUES = {
  france: { name: "France", teams: FRANCE_TEAMS, rosterRevision: ROSTER_REVISION.leagues.france },
  brazil: { name: "Brésil", teams: BRAZIL_TEAMS, rosterRevision: ROSTER_REVISION.leagues.brazil },
  spain: { name: "Espagne", teams: SPAIN_TEAMS, rosterRevision: ROSTER_REVISION.leagues.spain },
  italy: { name: "Italie", teams: ITALY_TEAMS, rosterRevision: ROSTER_REVISION.leagues.italy },
  germany: { name: "Allemagne", teams: GERMANY_TEAMS, rosterRevision: ROSTER_REVISION.leagues.germany },
  mexico: { name: "Mexique", teams: MEXICO_TEAMS, rosterRevision: ROSTER_REVISION.leagues.mexico },
};
// END GENERATED ROSTERS

// Plans tactiques offensifs et défensifs
const ATTACK_PLANS = {
  direct: { name: "Jeu direct", desc: "Longues balles, contre-attaque rapide", goalMod: 1.1, possMod: 0.9 },
  possession: { name: "Possession", desc: "Passes courtes, pressing haut", goalMod: 0.95, possMod: 1.25 },
  transition: { name: "Transition rapide", desc: "Vertical, exploitation des espaces", goalMod: 1.15, possMod: 1.0 }
};

const DEFENSE_PLANS = {
  low: { name: "Bloc bas", desc: "Défense profonde, compacte", concedeMod: 0.85, riskMod: 0.9 },
  high: { name: "Pressing haut", desc: "Récupération haute, risqué", concedeMod: 1.15, riskMod: 1.2 },
  zone: { name: "Défense en zone", desc: "Équilibrée", concedeMod: 1.0, riskMod: 1.0 }
};

const FORMATIONS = {
  "1-2-2-2": { name: "2-2-2", gk: 1, def: 2, mid: 2, att: 2 },
  "1-3-2-1": { name: "3-2-1", gk: 1, def: 3, mid: 2, att: 1 },
  "1-2-3-1": { name: "2-3-1", gk: 1, def: 2, mid: 3, att: 1 }
};

// Armes secrètes (cartes spéciales Kings League) — une par équipe et par match
const SECRET_CARDS = {
  doubleGoal: { key: "doubleGoal", name: "But Double", icon: "🟡", desc: "Pendant 4 minutes, chaque but marqué compte double au score.", risk: 2 },
  sanction: { key: "sanction", name: "Sanction", icon: "🔴", desc: "Un joueur adverse au choix est exclu 4 minutes : l'adversaire joue à 6 contre 7.", risk: 2 },
  penalty: { key: "penalty", name: "Penalty", icon: "⚽", desc: "Penalty immédiat pour votre équipe, tireur au choix.", risk: 1 },
  shootout: { key: "shootout", name: "Shootout", icon: "🥊", desc: "Un joueur au choix part seul face au gardien adverse.", risk: 2 },
  starPlayer: { key: "starPlayer", name: "Joueur Étoile", icon: "⭐", desc: "Le prochain but du joueur désigné (avant la 38e minute) compte double.", risk: 1 },
  reversePenalty: { key: "reversePenalty", name: "Penalty Inverse", icon: "🙃", desc: "L'équipe adverse tire un penalty : si elle marque, le but ne compte pas ; si elle rate, le but est pour vous !", risk: 2 },
  joker: { key: "joker", name: "Joker", icon: "🃏", desc: "Copie l'effet d'une autre carte, ou vole la carte adverse si elle n'a pas encore été jouée.", risk: 3 }
};
const SECRET_CARD_ORDER = ["doubleGoal", "sanction", "penalty", "shootout", "starPlayer", "reversePenalty", "joker"];

// Positions des joueurs sur le terrain pour chaque formation (x/y en %, 0,0 = en haut à gauche)
const FORMATION_SLOTS = {
  "1-2-2-2": [
    { pos: "GK", x: 50, y: 90 },
    { pos: "DEF", x: 25, y: 68 },
    { pos: "DEF", x: 75, y: 68 },
    { pos: "MID", x: 25, y: 42 },
    { pos: "MID", x: 75, y: 42 },
    { pos: "ATT", x: 30, y: 15 },
    { pos: "ATT", x: 70, y: 15 }
  ],
  "1-3-2-1": [
    { pos: "GK", x: 50, y: 90 },
    { pos: "DEF", x: 18, y: 68 },
    { pos: "DEF", x: 50, y: 72 },
    { pos: "DEF", x: 82, y: 68 },
    { pos: "MID", x: 30, y: 42 },
    { pos: "MID", x: 70, y: 42 },
    { pos: "ATT", x: 50, y: 15 }
  ],
  "1-2-3-1": [
    { pos: "GK", x: 50, y: 90 },
    { pos: "DEF", x: 25, y: 68 },
    { pos: "DEF", x: 75, y: 68 },
    { pos: "MID", x: 18, y: 42 },
    { pos: "MID", x: 50, y: 45 },
    { pos: "MID", x: 82, y: 42 },
    { pos: "ATT", x: 50, y: 15 }
  ]
};

// Rôles de jeu : ils orientent les choix et les courses, sans augmenter les notes.
const PLAYER_ROLES = {
  keeper: { key: "keeper", name: "Gardien", description: "Protège son but et relance vers un partenaire disponible.", positions: ["GK"], effort: 0.8 },
  stay_back: { key: "stay_back", name: "Défenseur fixe", description: "Reste en couverture et privilégie une relance simple.", positions: ["DEF"], effort: 0.9 },
  overlap: { key: "overlap", name: "Défenseur offensif", description: "Monte sur le côté pour offrir une solution, mais laisse de l'espace derrière lui.", positions: ["DEF"], effort: 1.15 },
  creator: { key: "creator", name: "Créateur", description: "Se rend disponible entre les lignes et cherche la passe qui fait avancer le jeu.", positions: ["MID"], effort: 1.0 },
  ball_winner: { key: "ball_winner", name: "Récupérateur", description: "Protège l'axe et se rapproche du porteur adverse pour contester le ballon.", positions: ["MID"], effort: 1.12 },
  box_to_box: { key: "box_to_box", name: "Relayeur", description: "Accompagne l'attaque et revient défendre ; ses courses consomment davantage d'énergie.", positions: ["MID"], effort: 1.15 },
  runner: { key: "runner", name: "Profondeur", description: "Appelle derrière la défense et cherche les espaces vers le but.", positions: ["ATT"], effort: 1.1 },
  target: { key: "target", name: "Point d'appui", description: "Décroche pour recevoir, conserver et remettre le ballon à un partenaire.", positions: ["ATT"], effort: 0.98 },
  poacher: { key: "poacher", name: "Finisseur", description: "Reste plus près du but et privilégie la frappe lorsqu'une occasion se présente.", positions: ["ATT"], effort: 0.95 }
};
const DEFAULT_PLAYER_ROLES = { GK: "keeper", DEF: "stay_back", MID: "box_to_box", ATT: "runner" };

function resolvePlayerRoleKey(setup, playerId, slotPos) {
  const position = DEFAULT_PLAYER_ROLES[slotPos] ? slotPos : "MID";
  const key = setup && setup.playerRoles && setup.playerRoles[playerId];
  return Object.prototype.hasOwnProperty.call(PLAYER_ROLES, key) && PLAYER_ROLES[key].positions.includes(position)
    ? key : DEFAULT_PLAYER_ROLES[position];
}

function getPlayerRole(setup, playerId, slotPos) {
  return PLAYER_ROLES[resolvePlayerRoleKey(setup, playerId, slotPos)];
}

function normalizePlayerRoles(team, setup) {
  const slots = FORMATION_SLOTS[setup && setup.formation] || [];
  const assignedPositions = new Map();
  (setup && Array.isArray(setup.assignments) ? setup.assignments : []).forEach((id, i) => {
    if (id && slots[i]) assignedPositions.set(id, slots[i].pos);
  });
  return Object.fromEntries((team && Array.isArray(team.players) ? team.players : []).map(player => [
    player.id, resolvePlayerRoleKey(setup, player.id, assignedPositions.get(player.id) || player.pos)
  ]));
}

// Profils générés pour la carrière : aucune prétention de décrire les clubs réels.
// Les valeurs modifient le placement, la pression et le rythme, jamais les attributs.
const TEAM_STYLES = {
  control: { key: "control", name: "Maîtrise", description: "Construit avec des solutions courtes et fait circuler le ballon.", strength: "Offre des appuis et conserve le ballon.", weakness: "Peut manquer de profondeur face à un bloc compact.", attackPlan: "possession", defensePlan: "zone", formation: "1-2-3-1", mentality: "balanced", width: 1.03, depth: 0.98, pressing: 1.0, tempo: 0.94 },
  pressing: { key: "pressing", name: "Pressing", description: "Cherche à récupérer haut et repart rapidement vers le but.", strength: "Conteste le ballon près du but adverse.", weakness: "Dépense plus d'énergie et expose l'espace dans son dos.", attackPlan: "transition", defensePlan: "high", formation: "1-2-2-2", mentality: "attacking", width: 0.97, depth: 1.06, pressing: 1.15, tempo: 1.1 },
  counter: { key: "counter", name: "Contre-attaque", description: "Attend son occasion, puis cherche rapidement la profondeur.", strength: "Attaque les espaces laissés à la récupération.", weakness: "Offre moins de solutions pour une longue construction.", attackPlan: "direct", defensePlan: "low", formation: "1-3-2-1", mentality: "balanced", width: 0.96, depth: 1.04, pressing: 0.9, tempo: 1.06 },
  compact: { key: "compact", name: "Bloc compact", description: "Protège l'axe avec un bloc resserré et des passes prudentes.", strength: "Réduit les espaces entre ses lignes.", weakness: "Laisse davantage de place sur les côtés et projette moins de joueurs.", attackPlan: "possession", defensePlan: "low", formation: "1-3-2-1", mentality: "cautious", width: 0.9, depth: 0.92, pressing: 0.88, tempo: 0.9 },
  wide: { key: "wide", name: "Jeu sur les côtés", description: "Écarte le jeu et cherche des relais et des centres depuis les ailes.", strength: "Étire le bloc adverse en largeur.", weakness: "Doit couvrir des distances plus importantes pour protéger l'axe.", attackPlan: "transition", defensePlan: "zone", formation: "1-2-2-2", mentality: "balanced", width: 1.16, depth: 1.0, pressing: 1.0, tempo: 1.02 }
};

function getTeamStyle(team) {
  if (team && Object.prototype.hasOwnProperty.call(TEAM_STYLES, team.playStyle)) return TEAM_STYLES[team.playStyle];
  const identity = String(team && (team.id || team.name) || "club");
  let hash = 2166136261;
  for (let i = 0; i < identity.length; i++) hash = Math.imul(hash ^ identity.charCodeAt(i), 16777619) >>> 0;
  const keys = Object.keys(TEAM_STYLES);
  return TEAM_STYLES[keys[hash % keys.length]];
}

function createAiPlayerRoles(team, setup) {
  const roles = normalizePlayerRoles(team, setup);
  const style = Object.prototype.hasOwnProperty.call(TEAM_STYLES, setup.teamStyle) ? setup.teamStyle : getTeamStyle(team).key;
  const slots = FORMATION_SLOTS[setup.formation] || [];
  let defenders = 0, midfielders = 0, attackers = 0;
  (setup.assignments || []).forEach((id, index) => {
    if (!id || !slots[index]) return;
    const pos = slots[index].pos;
    if (pos === "DEF") {
      const order = defenders++;
      roles[id] = style === "wide" && order === 0 ? "overlap" : "stay_back";
    } else if (pos === "MID") {
      const order = midfielders++;
      roles[id] = style === "control" ? (order === 0 ? "creator" : "box_to_box")
        : style === "compact" || style === "counter" ? (order === 0 ? "ball_winner" : "creator")
          : style === "pressing" ? "ball_winner" : "box_to_box";
    } else if (pos === "ATT") {
      const order = attackers++;
      roles[id] = style === "control" ? (order === 0 ? "target" : "poacher")
        : style === "compact" ? "target" : style === "wide" && order > 0 ? "poacher" : "runner";
    }
  });
  return roles;
}

