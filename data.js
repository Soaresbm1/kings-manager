// ===================== DONNÉES DU JEU =====================
// Ligues, équipes et joueurs réels de la Kings League (France & Brésil, saison 2025/26)

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
    overall, // note générale (0-99), basée sur les attributs et les stats réelles du joueur
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

// Applique les stats réelles (matchs, buts, passes, note moyenne) d'un joueur par-dessus ses attributs
function withStats(p, stats) {
  return Object.assign(p, stats);
}

// ---------------------- LIGUE FRANCE (Kings League Crédit Agricole France) ----------------------
const FRANCE_TEAMS = [
  {
    id: "tsn", name: "360 Nation", color: "#c0392b", budget: 300000,
    coach: "Mohamed Coulibaly",
    presidents: ["Tchouaméni", "Koundé", "Maignan", "Kone", "Mbeumo"],
    players: [
      withStats(player("Charly Dosso", "GK", 62, 69, 81, 84, 27), { matches: 4, ratingSum: 26 }),
      withStats(player("JMK", "GK", 70, 79, 90, 93, 25), { matches: 9, ratingSum: 76 }),
      withStats(player("Mamadou Kamissoko", "GK", 60, 65, 76, 75, 24), { matches: 3, ratingSum: 19.5 }),
      withStats(player("Chaïb Lahmer", "DEF", 74, 70, 80, 75, 25), { matches: 9, ratingSum: 58.5, goals: 2, assists: 2 }),
      withStats(player("Jordy Kalou", "DEF", 76, 71, 82, 76, 26), { matches: 10, ratingSum: 65 }),
      withStats(player("Mohamed Sangare", "DEF", 71, 67, 78, 72, 23), { matches: 2, ratingSum: 13 }),
      withStats(player("Abdallah Yaisien", "MID", 79, 78, 73, 76, 23), { matches: 9, ratingSum: 58.5 }),
      withStats(player("Bilal Marhdaoui", "MID", 88, 90, 83, 87, 24), { matches: 10, ratingSum: 72, goals: 9, assists: 4 }),
      withStats(player("Mahamadou Traore", "MID", 78, 79, 76, 76, 25), { matches: 10, ratingSum: 65, goals: 3 }),
      withStats(player("Marwan Chatar", "MID", 77, 76, 72, 75, 22), { matches: 5, ratingSum: 32.5 }),
      withStats(player("Mohamadou Diarra", "MID", 73, 69, 79, 74, 24), { matches: 3, ratingSum: 19.5 }),
      withStats(player("Hamed Karamoko", "MID", 80, 81, 75, 77, 24), { matches: 5, ratingSum: 40.5, assists: 1 }),
      withStats(player("James Lea Siliki", "MID", 75, 81, 79, 80, 30), { matches: 5, ratingSum: 35, goals: 3, assists: 2 }),
      withStats(player("Daudet Ndongala", "ATT", 91, 87, 84, 83, 26), { matches: 7, ratingSum: 45.5, goals: 3 }),
      withStats(player("Patrick Koffi", "ATT", 85, 79, 81, 76, 25), { matches: 3, ratingSum: 19.5 }),
      withStats(player("Ayoub Sefraoui", "ATT", 87, 78, 77, 75, 23), { matches: 7, ratingSum: 45.5, goals: 1, assists: 2 }),
      withStats(player("Bilel Boucheker", "ATT", 84, 80, 76, 75, 24), { matches: 3, ratingSum: 23.1, goals: 2, assists: 1 }),
      withStats(player("Gregory Ayem", "ATT", 86, 80, 77, 75, 23), { matches: 3, ratingSum: 21.9, goals: 3 }),
      withStats(player("Mustapha Rabou", "ATT", 79, 74, 73, 71, 22), { matches: 1, ratingSum: 6.5 }),
      withStats(player("Yacine Boucharoud", "ATT", 88, 85, 79, 80, 24), { matches: 10, ratingSum: 74, goals: 6, assists: 5 })
    ]
  },
  {
    id: "adb", name: "Athletic Dragon Blanc", color: "#c4c4c4", budget: 300000,
    coach: "Habib Boumezoued",
    presidents: ["SDM", "Guy2Bezbar"],
    players: [
      withStats(player("Ismaël Benallal", "GK", 69, 73, 87, 87, 26), { matches: 8, ratingSum: 52 }),
      withStats(player("Parfait Mandanda", "GK", 55, 70, 75, 88, 41), { matches: 7, ratingSum: 45.5 }),
      withStats(player("Karl Masua", "DEF", 75, 71, 82, 76, 26), { matches: 8, ratingSum: 52 }),
      withStats(player("Sega Keita", "DEF", 74, 70, 81, 75, 24), { matches: 8, ratingSum: 52, goals: 3 }),
      withStats(player("Adama Doucouré", "DEF", 72, 68, 76, 73, 23), { matches: 1, ratingSum: 6.5 }),
      withStats(player("Alex Monde", "MID", 79, 80, 75, 77, 25), { matches: 7, ratingSum: 45.5, goals: 1 }),
      withStats(player("Brad Onema", "MID", 81, 79, 74, 76, 24), { matches: 8, ratingSum: 52, goals: 1 }),
      withStats(player("Johan Dorilas", "MID", 80, 80, 75, 78, 23), { matches: 8, ratingSum: 56, goals: 6, assists: 3 }),
      withStats(player("Melvin Sitti", "MID", 77, 77, 72, 74, 22), { matches: 7, ratingSum: 49, goals: 4 }),
      withStats(player("Redha Ghaoui", "MID", 73, 69, 79, 74, 23), { matches: 8, ratingSum: 52 }),
      withStats(player("Rayan Belkacem", "MID", 76, 75, 73, 73, 23), { matches: 6, ratingSum: 39 }),
      player("Anthony Adel", "MID", 70, 68, 70, 70, 21),
      withStats(player("Tarek Baïch", "MID", 74, 73, 72, 72, 24), { matches: 2, ratingSum: 13 }),
      withStats(player("Sandy Mbala", "MID", 71, 70, 71, 70, 22), { matches: 1, ratingSum: 6.5 }),
      withStats(player("Alex Séné", "ATT", 85, 80, 80, 76, 24), { matches: 2, ratingSum: 13 }),
      withStats(player("Inza Koné", "ATT", 91, 90, 83, 88, 25), { matches: 8, ratingSum: 64, goals: 11, assists: 10 }),
      withStats(player("Aimen Belaid", "ATT", 86, 78, 77, 75, 22), { matches: 2, ratingSum: 13, goals: 1 })
    ]
  },
  {
    id: "fcs", name: "FC Silmi", color: "#b8973e", budget: 300000,
    coach: "Sabry Bezahaf",
    presidents: ["Domingo"],
    players: [
      withStats(player("Ali Ahamada", "GK", 62, 75, 88, 93, 35), { matches: 8, ratingSum: 52 }),
      withStats(player("Damien Mesplé", "GK", 63, 67, 78, 77, 27), { matches: 2, ratingSum: 13 }),
      withStats(player("Florian Forestier", "GK", 64, 73, 85, 86, 26), { matches: 5, ratingSum: 41.5 }),
      withStats(player("Axel Bamba", "DEF", 75, 71, 81, 76, 25), { matches: 1, ratingSum: 6.5 }),
      withStats(player("Hakim Bacar", "DEF", 73, 69, 80, 74, 24), { matches: 8, ratingSum: 52 }),
      withStats(player("Mohammed-Karim Berrabah", "DEF", 74, 70, 82, 76, 26), { matches: 5, ratingSum: 42, goals: 1, assists: 1 }),
      withStats(player("Aboubakar Toure", "MID", 78, 79, 74, 76, 24), { matches: 6, ratingSum: 39, assists: 1 }),
      withStats(player("Adel Berkane", "MID", 84, 86, 80, 84, 23), { matches: 7, ratingSum: 52.5, goals: 7, assists: 1 }),
      withStats(player("Chain Ghrissi", "MID", 77, 78, 74, 75, 24), { matches: 8, ratingSum: 52, goals: 1, assists: 1 }),
      withStats(player("Guilherme Carvalho", "MID", 84, 86, 80, 82, 25), { matches: 5, ratingSum: 36.5, goals: 6, assists: 2 }),
      withStats(player("Kevin Bru", "MID", 76, 80, 72, 78, 28), { matches: 3, ratingSum: 24.9, goals: 1 }),
      withStats(player("Mehdi Marin", "MID", 76, 77, 73, 74, 23), { matches: 8, ratingSum: 52, goals: 1, assists: 1 }),
      withStats(player("Youcef Kara", "MID", 75, 76, 73, 73, 22), { matches: 8, ratingSum: 52 }),
      withStats(player("Mohamed Sanou", "ATT", 86, 81, 78, 77, 25), { matches: 2, ratingSum: 13 }),
      withStats(player("Bakary Sako", "ATT", 86, 91, 84, 87, 37), { matches: 8, ratingSum: 64, goals: 16, assists: 2 }),
      withStats(player("Jimmy Briand", "ATT", 65, 80, 70, 85, 40), { matches: 2, ratingSum: 13 })
    ]
  },
  {
    id: "gs7", name: "Generation Seven", color: "#4a8c2a", budget: 300000,
    coach: "Jefferson Roch",
    presidents: ["Michou", "Camavinga"],
    players: [
      withStats(player("Christian Nsapu", "GK", 63, 67, 82, 82, 26), { matches: 7, ratingSum: 45.5 }),
      withStats(player("Ilhan Benbraham", "GK", 61, 64, 77, 76, 23), { matches: 1, ratingSum: 7.6 }),
      withStats(player("Yonni Bouguerra", "GK", 67, 75, 88, 89, 25), { matches: 6, ratingSum: 48 }),
      withStats(player("Bilal Hadraoui", "DEF", 74, 70, 81, 75, 25), { matches: 4, ratingSum: 28.4, assists: 1 }),
      withStats(player("Mehdi Tenniche", "DEF", 73, 69, 80, 74, 24), { matches: 6, ratingSum: 43.8 }),
      withStats(player("Carl Medjani", "DEF", 58, 74, 82, 86, 41), { matches: 4, ratingSum: 26 }),
      withStats(player("Walid Soudi", "DEF", 78, 74, 81, 80, 24), { matches: 7, ratingSum: 51.1, goals: 3, assists: 2 }),
      withStats(player("Clément Goguey", "MID", 83, 84, 79, 81, 24), { matches: 7, ratingSum: 57.4, goals: 4 }),
      withStats(player("Enzo Dron", "MID", 80, 78, 73, 75, 23), { matches: 6, ratingSum: 49.2, goals: 1 }),
      withStats(player("Ismaïl Haddou", "MID", 79, 80, 75, 77, 25), { matches: 2, ratingSum: 13, goals: 2 }),
      withStats(player("Nyls Gomez", "MID", 77, 77, 72, 74, 22), { matches: 4, ratingSum: 28.4 }),
      withStats(player("Boucif El Afghani", "MID", 77, 76, 73, 74, 22), { matches: 1, ratingSum: 6.8, goals: 1, assists: 1 }),
      withStats(player("Dalvin Fellice", "MID", 74, 73, 71, 71, 21), { matches: 2, ratingSum: 13 }),
      withStats(player("Youba Soumaré", "MID", 76, 77, 73, 74, 23), { matches: 7, ratingSum: 45.5, goals: 1, assists: 1 }),
      withStats(player("Haris El Mouttaqi", "ATT", 91, 87, 83, 83, 25), { matches: 1, ratingSum: 8.1, goals: 4 }),
      withStats(player("Oscar Le Guillou", "ATT", 85, 79, 80, 76, 24), { matches: 4, ratingSum: 30, goals: 1 }),
      withStats(player("Boutaleb Mohamed", "ATT", 85, 80, 77, 78, 24), { matches: 7, ratingSum: 50.4, goals: 4 }),
      withStats(player("Mamadou Kebe", "ATT", 87, 78, 77, 75, 22), { matches: 5, ratingSum: 32.5, goals: 2 })
    ]
  },
  {
    id: "kar", name: "Karasu", color: "#c8501e", budget: 300000,
    coach: "Benjamin Garault",
    presidents: ["Kameto", "Hamza"],
    players: [
      withStats(player("Sasha Bernard", "GK", 69, 76, 92, 94, 25), { matches: 9, ratingSum: 58.5 }),
      player("Simon Pontdeme", "GK", 61, 64, 77, 76, 24),
      withStats(player("Vivien Cedille", "GK", 60, 63, 76, 75, 23), { matches: 1, ratingSum: 6.5 }),
      withStats(player("Mehdi Gacem", "DEF", 80, 76, 87, 81, 26), { matches: 9, ratingSum: 68.4, goals: 3, assists: 1 }),
      withStats(player("Sahir Boumhand", "DEF", 78, 74, 85, 79, 24), { matches: 9, ratingSum: 74.7, goals: 1 }),
      player("Christopher Baptista", "MID", 79, 80, 74, 77, 25),
      withStats(player("Guillaume Yenoussi", "MID", 78, 78, 73, 75, 24), { matches: 2, ratingSum: 13 }),
      withStats(player("Ilyes Kallouche", "MID", 80, 79, 75, 76, 23), { matches: 8, ratingSum: 52, goals: 1 }),
      withStats(player("Joseph Evens", "MID", 77, 77, 72, 74, 22), { matches: 1, ratingSum: 6.5, assists: 1 }),
      withStats(player("Lucas Valeri", "MID", 83, 83, 79, 80, 24), { matches: 7, ratingSum: 45.5, goals: 2, assists: 1 }),
      withStats(player("Driss Khalid", "MID", 76, 73, 83, 79, 25), { matches: 9, ratingSum: 58.5, goals: 5, assists: 1 }),
      withStats(player("Lyes Hocine", "MID", 74, 73, 72, 72, 21), { matches: 2, ratingSum: 13 }),
      withStats(player("Youssef Hidasse", "MID", 73, 72, 71, 71, 21), { matches: 2, ratingSum: 13 }),
      withStats(player("Dramane Kone", "ATT", 83, 78, 76, 75, 22), { matches: 1, ratingSum: 7, goals: 1 }),
      withStats(player("Sita Diarra", "ATT", 87, 83, 79, 79, 25), { matches: 9, ratingSum: 58.5 }),
      player("Marvin Gakpa", "ATT", 86, 81, 78, 78, 26),
      withStats(player("Ali Ouarti", "ATT", 89, 86, 80, 82, 24), { matches: 9, ratingSum: 70.2, goals: 10, assists: 4 }),
      withStats(player("Matisse Henry", "ATT", 92, 91, 84, 87, 23), { matches: 9, ratingSum: 76.5, goals: 16, assists: 7 }),
      withStats(player("Samy Mahour", "ATT", 82, 78, 75, 74, 23), { matches: 4, ratingSum: 28.8, goals: 1 })
    ]
  },
  {
    id: "pas", name: "Panam All Starz", color: "#8c1c2b", budget: 300000,
    coach: "Yassine Mohammed",
    presidents: ["Pfut"],
    players: [
      withStats(player("Adama Wagui", "GK", 65, 77, 97, 98, 26), { matches: 9, ratingSum: 65.7 }),
      withStats(player("Hidris Buy-Kante", "GK", 61, 66, 76, 75, 24), { matches: 3, ratingSum: 19.5 }),
      withStats(player("Souleymane Ouattara", "GK", 60, 65, 77, 75, 24), { matches: 3, ratingSum: 19.5 }),
      withStats(player("Yaya Doucoure", "GK", 62, 66, 76, 74, 22), { matches: 1, ratingSum: 7.5 }),
      withStats(player("Jordy Gaspar", "DEF", 75, 71, 82, 76, 25), { matches: 5, ratingSum: 32.5, assists: 1 }),
      withStats(player("Nzaba Lungituka", "DEF", 81, 77, 88, 85, 25), { matches: 9, ratingSum: 70.2, assists: 2 }),
      withStats(player("Yazid Ali Abdallah", "DEF", 73, 69, 79, 74, 23), { matches: 8, ratingSum: 52 }),
      withStats(player("Alaixys Romao", "DEF", 60, 75, 80, 88, 41), { matches: 4, ratingSum: 26, goals: 1, assists: 1 }),
      withStats(player("Rachid Bouhenna", "DEF", 74, 70, 81, 75, 25), { matches: 4, ratingSum: 26 }),
      withStats(player("Andre De Oliveira", "MID", 79, 80, 75, 77, 24), { matches: 9, ratingSum: 58.5, goals: 3 }),
      withStats(player("Daniel Mendy", "MID", 83, 83, 78, 80, 23), { matches: 9, ratingSum: 58.5, goals: 4 }),
      withStats(player("Hamza Chaib", "MID", 85, 79, 77, 75, 23), { matches: 4, ratingSum: 26, goals: 1 }),
      withStats(player("Harrison Manzala", "MID", 85, 84, 79, 81, 24), { matches: 3, ratingSum: 19.5, goals: 1 }),
      withStats(player("Mohamed Sakkouh", "MID", 78, 78, 74, 76, 24), { matches: 9, ratingSum: 58.5, goals: 2, assists: 1 }),
      withStats(player("Sofiane Ahmed-Kadi", "MID", 77, 77, 72, 74, 22), { matches: 8, ratingSum: 52, goals: 2, assists: 1 }),
      withStats(player("Eric Mathieu", "MID", 74, 73, 72, 72, 22), { matches: 4, ratingSum: 26 }),
      withStats(player("Rayan Forsa", "MID", 73, 72, 71, 71, 21), { matches: 2, ratingSum: 13 }),
      withStats(player("Walid Betterki", "MID", 83, 81, 77, 79, 23), { matches: 8, ratingSum: 59.2, goals: 5, assists: 2 }),
      withStats(player("Emmanuel Louisir", "MID", 72, 70, 71, 70, 21), { matches: 1, ratingSum: 6.5 }),
      withStats(player("Elijah Boimbo", "ATT", 87, 82, 78, 78, 24), { matches: 5, ratingSum: 32.5 }),
      withStats(player("Florent Sinama-Pongolle", "ATT", 68, 85, 78, 88, 39), { matches: 1, ratingSum: 6.5 })
    ]
  },
  {
    id: "u3d", name: "Unit3d", color: "#2a6fb0", budget: 300000,
    coach: "Grégory Campi",
    presidents: ["Squeezie", "Djilsi", "Maxime Biaggi"],
    players: [
      withStats(player("Florian Verplanck", "GK", 62, 68, 82, 83, 28), { matches: 9, ratingSum: 58.5 }),
      withStats(player("Jessy Moulin", "GK", 65, 73, 85, 86, 33), { matches: 8, ratingSum: 52 }),
      withStats(player("Alseny Sano", "DEF", 80, 76, 87, 81, 25), { matches: 9, ratingSum: 67.5, goals: 1 }),
      withStats(player("Yannick Mbone", "DEF", 73, 69, 80, 74, 24), { matches: 9, ratingSum: 58.5 }),
      withStats(player("Youssef Khatiri", "DEF", 74, 70, 81, 75, 25), { matches: 9, ratingSum: 64.8, goals: 1 }),
      withStats(player("Bryan Goncalves", "DEF", 74, 72, 80, 76, 24), { matches: 1, ratingSum: 7.2, goals: 1, assists: 1 }),
      withStats(player("Amine Kheche", "MID", 82, 85, 78, 83, 24), { matches: 9, ratingSum: 70.2, goals: 10, assists: 2 }),
      withStats(player("José Pereira", "MID", 82, 83, 78, 80, 25), { matches: 8, ratingSum: 61.6 }),
      withStats(player("Nicolas Martins", "MID", 84, 85, 80, 82, 23), { matches: 1, ratingSum: 8.3 }),
      withStats(player("Yassine Skira", "MID", 76, 77, 72, 74, 22), { matches: 9, ratingSum: 64.8, assists: 1 }),
      withStats(player("Maxime Corain", "MID", 73, 71, 72, 71, 21), { matches: 2, ratingSum: 13 }),
      withStats(player("Valère Germain", "ATT", 70, 83, 78, 85, 38), { matches: 8, ratingSum: 60.8, goals: 6, assists: 4 }),
      withStats(player("Damani Toure", "ATT", 88, 83, 80, 80, 25), { matches: 6, ratingSum: 49.2, goals: 4 }),
      withStats(player("Marvin Emmanuel", "ATT", 91, 85, 82, 83, 23), { matches: 5, ratingSum: 41, goals: 5, assists: 5 }),
      withStats(player("Amara Fofana", "ATT", 88, 83, 81, 80, 22), { matches: 1, ratingSum: 7.6 }),
      withStats(player("Clément Dragon", "ATT", 82, 77, 75, 74, 23), { matches: 7, ratingSum: 45.5, goals: 1 }),
      withStats(player("Enzo Arbona", "ATT", 80, 76, 74, 73, 22), { matches: 4, ratingSum: 26, assists: 1 }),
      withStats(player("Nassim Labidi", "ATT", 79, 74, 73, 71, 21), { matches: 1, ratingSum: 6.5 })
    ]
  },
  {
    id: "wpf", name: "Wolf Pack FC", color: "#5a4d6b", budget: 300000,
    coach: "Richard Pascal",
    presidents: ["Adil Rami", "Naza"],
    players: [
      withStats(player("Guillaume Lesec", "GK", 68, 77, 92, 96, 27), { matches: 8, ratingSum: 63.2 }),
      withStats(player("Sebastien Renot", "GK", 60, 65, 77, 76, 24), { matches: 8, ratingSum: 52 }),
      withStats(player("Mohamed Bencherif", "DEF", 80, 76, 87, 81, 25), { matches: 6, ratingSum: 39, goals: 2, assists: 2 }),
      withStats(player("Franck Noel", "DEF", 73, 69, 80, 74, 24), { matches: 3, ratingSum: 19.5 }),
      withStats(player("Giannelli Imbula", "MID", 77, 89, 85, 83, 33), { matches: 6, ratingSum: 39, goals: 5 }),
      withStats(player("Idir Ahmin", "DEF", 83, 83, 78, 80, 23), { matches: 8, ratingSum: 61.6 }),
      withStats(player("Lucas De Ataïde", "MID", 79, 80, 75, 77, 24), { matches: 7, ratingSum: 45.5 }),
      withStats(player("Sofiane Bendaoud", "MID", 85, 84, 80, 82, 23), { matches: 8, ratingSum: 57.6, goals: 4, assists: 3 }),
      withStats(player("Théo Chendri", "MID", 79, 75, 86, 80, 25), { matches: 6, ratingSum: 49.8, assists: 2 }),
      withStats(player("Denis-Will Poha", "MID", 77, 77, 72, 74, 22), { matches: 3, ratingSum: 19.5 }),
      withStats(player("Noé Clerge", "MID", 72, 70, 71, 70, 21), { matches: 1, ratingSum: 6.5 }),
      withStats(player("Enzo Ferrara", "MID", 73, 72, 71, 71, 21), { matches: 1, ratingSum: 6.5 }),
      withStats(player("Souleymane Karamoko", "MID", 71, 69, 70, 70, 21), { matches: 1, ratingSum: 6.5 }),
      withStats(player("Jonathan Kodjia", "ATT", 78, 82, 80, 78, 35), { matches: 6, ratingSum: 39, goals: 2 }),
      withStats(player("Moussa Sao", "ATT", 90, 85, 82, 83, 25), { matches: 8, ratingSum: 62.4, goals: 12, assists: 3 }),
      withStats(player("Mehdi Chahiri", "ATT", 82, 78, 76, 75, 23), { matches: 5, ratingSum: 32.5, goals: 2 }),
      withStats(player("Sabry Tolgui", "ATT", 80, 76, 74, 73, 22), { matches: 3, ratingSum: 19.5, assists: 1 }),
      withStats(player("Wanis Aïssa", "ATT", 85, 78, 76, 75, 23), { matches: 1, ratingSum: 6.5 })
    ]
  }
];

// ---------------------- LIGUE BRÉSIL (Kings League Brasil) ----------------------
const BRAZIL_TEAMS = [
  {
    id: "fur", name: "Furia FC", color: "#4a4a4a", budget: 300000,
    coach: "Dudu Oliveira",
    presidents: ["Neymar", "Cris Guedes"],
    players: [
      withStats(player('Vitor "Barba"', "GK", 63, 68, 82, 83, 26), { matches: 6, ratingSum: 39 }),
      withStats(player("Victor Hugo", "GK", 66, 70, 82, 81, 24), { matches: 3, ratingSum: 23.7 }),
      player('Jefferson "Gegeu" Silva', "DEF", 75, 71, 82, 76, 25),
      withStats(player("João Pelegrini", "DEF", 73, 69, 80, 74, 24), { matches: 8, ratingSum: 58.4 }),
      withStats(player('Matheus "Dedo"', "DEF", 79, 75, 86, 80, 25), { matches: 9, ratingSum: 65.7, goals: 6, assists: 2 }),
      withStats(player("Kenu Leandro", "MID", 79, 80, 75, 77, 24), { matches: 9, ratingSum: 68.4, goals: 1, assists: 1 }),
      withStats(player("Lucas Nascimento", "MID", 78, 78, 73, 75, 23), { matches: 6, ratingSum: 39 }),
      withStats(player('Thiago "Major"', "MID", 80, 79, 74, 76, 24), { matches: 6, ratingSum: 39 }),
      withStats(player("Jeffinho Honorato", "MID", 82, 82, 77, 79, 22), { matches: 9, ratingSum: 58.5, goals: 3, assists: 3 }),
      withStats(player('Rafael "Tambinha"', "MID", 76, 77, 73, 74, 24), { matches: 9, ratingSum: 58.5 }),
      withStats(player("Renan Pizzo", "MID", 74, 73, 71, 71, 21), { matches: 2, ratingSum: 13 }),
      withStats(player("Gabriel Felipe", "ATT", 87, 83, 79, 79, 25), { matches: 1, ratingSum: 6.5 }),
      withStats(player("Luiz Camilo", "ATT", 86, 81, 78, 78, 26), { matches: 4, ratingSum: 26 }),
      withStats(player("Juninho Manella", "ATT", 85, 78, 76, 75, 23), { matches: 1, ratingSum: 6.5 }),
      withStats(player('Jhow Love', "ATT", 78, 74, 73, 71, 22), { matches: 1, ratingSum: 6.5 }),
      withStats(player('Cleberson "C99"', "ATT", 81, 76, 75, 73, 23), { matches: 4, ratingSum: 26 }),
      withStats(player("Leleti Garcia", "ATT", 89, 84, 81, 81, 24), { matches: 6, ratingSum: 42, goals: 3, assists: 1 }),
      withStats(player("Lipão Pinheiro", "ATT", 90, 88, 81, 83, 25), { matches: 8, ratingSum: 65.6, goals: 17 })
    ]
  },
  {
    id: "flx", name: "Fluxo FC", color: "#1e7fd1", budget: 300000,
    coach: "Paulo Netto",
    presidents: ["Cerol", "Nobru", "Toguro"],
    players: [
      withStats(player("João Pedro", "GK", 67, 73, 87, 87, 26), { matches: 11, ratingSum: 93.5 }),
      withStats(player('Douglas "Doth"', "GK", 60, 65, 77, 76, 24), { matches: 4, ratingSum: 26 }),
      withStats(player("Murillo Pulino", "DEF", 75, 71, 82, 76, 25), { matches: 11, ratingSum: 81.4, goals: 2 }),
      withStats(player('Matheus "Chaveirinho"', "MID", 83, 84, 79, 81, 23), { matches: 11, ratingSum: 79.2, goals: 6, assists: 6 }),
      withStats(player('Marcos "MV"', "MID", 80, 78, 73, 75, 24), { matches: 10, ratingSum: 65 }),
      withStats(player('Paulo "Pinguinho"', "MID", 83, 84, 78, 80, 25), { matches: 9, ratingSum: 58.5 }),
      withStats(player('Jheferson Falcão', "MID", 82, 81, 76, 78, 22), { matches: 11, ratingSum: 71.5, assists: 1 }),
      withStats(player("Well Andrade", "MID", 90, 87, 90, 87, 24), { matches: 11, ratingSum: 88, goals: 17, assists: 4 }),
      withStats(player("Renan Augusto", "MID", 73, 69, 80, 74, 25), { matches: 9, ratingSum: 63, goals: 2 }),
      withStats(player("Bruno Ferreira", "MID", 73, 72, 71, 71, 21), { matches: 1, ratingSum: 6.5 }),
      withStats(player("Helber Júnior", "ATT", 88, 84, 80, 81, 25), { matches: 11, ratingSum: 81.4, goals: 11, assists: 1 }),
      withStats(player("Gustavinho Henrique", "ATT", 85, 80, 80, 76, 24), { matches: 11, ratingSum: 88, goals: 2, assists: 1 }),
      withStats(player("Tuco Magalhães", "ATT", 92, 83, 82, 80, 23), { matches: 11, ratingSum: 77, goals: 1, assists: 1 }),
      withStats(player("Patrick Habibi", "ATT", 82, 78, 76, 76, 23), { matches: 3, ratingSum: 21.9, goals: 1 })
    ]
  },
  {
    id: "g3x", name: "G3X FC", color: "#2f4f7a", budget: 300000,
    coach: "Velho Vamp",
    presidents: ["Gaules", "Kelvin"],
    players: [
      withStats(player("Gabriel Braga", "GK", 63, 67, 82, 82, 26), { matches: 6, ratingSum: 47.4 }),
      withStats(player("Josildo Barata", "GK", 75, 80, 85, 87, 24), { matches: 12, ratingSum: 78 }),
      withStats(player("Gabriel Medeiros", "DEF", 75, 71, 82, 76, 25), { matches: 4, ratingSum: 31.6, assists: 1 }),
      withStats(player("Gabriel Messias", "DEF", 73, 69, 80, 74, 24), { matches: 11, ratingSum: 71.5, assists: 1 }),
      withStats(player("Marinho Filho", "DEF", 74, 70, 81, 75, 26), { matches: 7, ratingSum: 45.5 }),
      withStats(player("Wembley Luiz", "DEF", 82, 82, 77, 79, 22), { matches: 12, ratingSum: 98.4 }),
      withStats(player('Thiago "TH" Brito', "MID", 79, 80, 74, 77, 25), { matches: 12, ratingSum: 78, goals: 2, assists: 2 }),
      withStats(player("Andreas Vaz", "MID", 88, 90, 81, 84, 23), { matches: 12, ratingSum: 98.4, goals: 10, assists: 3 }),
      withStats(player("Matheus Rufino", "MID", 80, 79, 75, 76, 24), { matches: 11, ratingSum: 71.5, goals: 1, assists: 2 }),
      withStats(player("João Guimarães", "ATT", 82, 78, 74, 74, 25), { matches: 9, ratingSum: 58.5 }),
      withStats(player("Ryan Lima", "ATT", 86, 81, 78, 78, 24), { matches: 11, ratingSum: 82.5 }),
      withStats(player('Kelvin Oliveira', "ATT", 94, 94, 87, 92, 23), { matches: 12, ratingSum: 105.6, goals: 33, assists: 6 }),
      withStats(player('Ton "Spider"', "ATT", 90, 87, 83, 84, 24), { matches: 11, ratingSum: 81.4, goals: 9, assists: 3 })
    ]
  },
  {
    id: "nyv", name: "Nyvelados FC", color: "#7a1fb5", budget: 300000,
    coach: "Dabá",
    presidents: ["Nyvi Estephan", "Falcão"],
    players: [
      withStats(player('Bruno "Gan"', "GK", 63, 67, 82, 82, 26), { matches: 2, ratingSum: 15.8 }),
      withStats(player('Igor "BB"', "GK", 61, 64, 77, 76, 24), { matches: 9, ratingSum: 58.5 }),
      withStats(player("Ailton José", "DEF", 75, 71, 82, 76, 25), { matches: 8, ratingSum: 66.4, goals: 4, assists: 2 }),
      withStats(player('Everton "Chiclete" Araújo', "DEF", 73, 69, 80, 74, 24), { matches: 2, ratingSum: 13 }),
      withStats(player("Maicon Macabeu", "DEF", 74, 70, 81, 75, 25), { matches: 8, ratingSum: 52, assists: 1 }),
      withStats(player('Lucas "Japa"', "MID", 79, 80, 74, 77, 24), { matches: 7, ratingSum: 56 }),
      withStats(player("Luisinho Barreiros", "MID", 78, 78, 73, 75, 23), { matches: 7, ratingSum: 46.9 }),
      withStats(player('Léo "Gol"', "MID", 80, 79, 75, 76, 24), { matches: 9, ratingSum: 67.5, goals: 9, assists: 5 }),
      withStats(player('Luandrio "Pé Fino"', "MID", 77, 77, 72, 74, 22), { matches: 4, ratingSum: 26, goals: 1 }),
      withStats(player('Vanderson "Neguiim Jr"', "MID", 80, 79, 75, 76, 24), { matches: 10, ratingSum: 70, goals: 6, assists: 2 }),
      withStats(player("Matheus Klynsmann", "ATT", 87, 83, 79, 79, 25), { matches: 9, ratingSum: 63.9, goals: 1, assists: 1 }),
      withStats(player('Carlos "Ferrão"', "ATT", 89, 87, 81, 82, 26), { matches: 7, ratingSum: 49, goals: 8 }),
      withStats(player("Daniel Coringa", "ATT", 85, 78, 76, 75, 23), { matches: 1, ratingSum: 6.5, assists: 1 }),
      withStats(player("Danilo Belém", "ATT", 83, 78, 76, 75, 23), { matches: 4, ratingSum: 26, goals: 1 }),
      withStats(player("Dieguinho Assis", "ATT", 80, 75, 74, 72, 21), { matches: 3, ratingSum: 19.5 })
    ]
  },
  {
    id: "dpn", name: "DesimpaiN", color: "#b34a1f", budget: 300000,
    coach: "Felipe Góes",
    presidents: ["Renato Vicente"],
    players: [
      withStats(player("Gui Nascimento", "GK", 63, 66, 79, 79, 25), { matches: 9, ratingSum: 58.5 }),
      withStats(player("Kaiky Souza", "GK", 65, 76, 97, 98, 22), { matches: 11, ratingSum: 71.5 }),
      withStats(player("Andrey Profeta", "DEF", 75, 71, 82, 76, 25), { matches: 7, ratingSum: 55.3 }),
      withStats(player('Victor "Bolt"', "DEF", 81, 75, 86, 80, 24), { matches: 11, ratingSum: 77, goals: 3, assists: 4 }),
      withStats(player('Wellinton "Gigante"', "DEF", 77, 74, 87, 80, 26), { matches: 11, ratingSum: 77, goals: 5, assists: 1 }),
      withStats(player("Juvenal Oliveira", "DEF", 75, 70, 82, 77, 25), { matches: 8, ratingSum: 56, goals: 2, assists: 1 }),
      withStats(player('Henry "Japa"', "MID", 79, 80, 74, 77, 24), { matches: 2, ratingSum: 15 }),
      withStats(player("William Costa", "MID", 78, 78, 73, 75, 23), { matches: 11, ratingSum: 71.5 }),
      withStats(player("Christian Santos", "MID", 80, 79, 75, 76, 24), { matches: 11, ratingSum: 80.3, goals: 8, assists: 3 }),
      withStats(player("Danilo Alemão", "MID", 77, 77, 73, 75, 25), { matches: 10, ratingSum: 70, goals: 4, assists: 2 }),
      withStats(player("Gabriel Lopes", "MID", 75, 74, 72, 72, 22), { matches: 3, ratingSum: 19.5 }),
      withStats(player("Davi Ilario", "ATT", 93, 93, 85, 93, 24), { matches: 11, ratingSum: 93.5, goals: 21, assists: 10 }),
      withStats(player('Victor "VB" Bueno', "ATT", 86, 81, 78, 78, 25), { matches: 5, ratingSum: 41 }),
      withStats(player("Douglinhas Melo", "ATT", 85, 78, 76, 75, 23), { matches: 4, ratingSum: 31.2, goals: 1 }),
      withStats(player("Luisinho Alves", "ATT", 87, 82, 78, 79, 24), { matches: 11, ratingSum: 82.5, goals: 10 })
    ]
  },
  {
    id: "cap", name: "Capim FC", color: "#5cb82e", budget: 300000,
    coach: "Charles Cruz",
    presidents: ["Jon Vlogs", "Luva de Pedreiro"],
    players: [
      withStats(player('Marcos "Bolivia"', "GK", 67, 73, 87, 87, 26), { matches: 10, ratingSum: 65 }),
      withStats(player("Thiago Santos", "GK", 60, 65, 77, 76, 24), { matches: 6, ratingSum: 39 }),
      withStats(player('Lucas "Caroço"', "DEF", 75, 71, 82, 76, 25), { matches: 10, ratingSum: 65 }),
      withStats(player("Álex Guti", "DEF", 78, 74, 85, 79, 24), { matches: 8, ratingSum: 67.2, goals: 3 }),
      withStats(player("Breno Arantes", "DEF", 74, 70, 81, 75, 26), { matches: 6, ratingSum: 47.4, goals: 1 }),
      withStats(player("Wallace Rafael", "DEF", 73, 68, 79, 74, 24), { matches: 4, ratingSum: 26 }),
      withStats(player('Gabriel "Dudu"', "MID", 79, 80, 74, 77, 24), { matches: 10, ratingSum: 65, goals: 2 }),
      withStats(player("Rafa Sousa", "MID", 78, 78, 73, 75, 23), { matches: 7, ratingSum: 45.5, assists: 2 }),
      withStats(player('Williams "Vassoura"', "MID", 80, 79, 75, 76, 24), { matches: 1, ratingSum: 6.5 }),
      withStats(player("Dani Liñares", "MID", 80, 84, 75, 79, 22), { matches: 10, ratingSum: 85, goals: 8, assists: 1 }),
      withStats(player("Jeferson Titon", "ATT", 89, 85, 80, 80, 25), { matches: 10, ratingSum: 65, goals: 2, assists: 1 }),
      withStats(player("Murillo Donato", "ATT", 86, 81, 78, 78, 24), { matches: 8, ratingSum: 64 }),
      withStats(player("Gerard Nolla", "ATT", 90, 83, 81, 80, 23), { matches: 10, ratingSum: 83, goals: 10, assists: 4 }),
      withStats(player('Erick "Kaká"', "ATT", 78, 76, 73, 72, 22), { matches: 1, ratingSum: 6.5 }),
      withStats(player("Igo Canindé", "ATT", 81, 77, 75, 74, 22), { matches: 3, ratingSum: 19.5, goals: 1 }),
      withStats(player("Lucas Hector", "ATT", 90, 85, 82, 82, 24), { matches: 10, ratingSum: 72, goals: 8, assists: 2 })
    ]
  },
  {
    id: "lou", name: "LOUD SC", color: "#2e8b3d", budget: 300000,
    coach: "Carlos Pimenta",
    presidents: ["Coringa", "Brabox"],
    players: [
      withStats(player("Esaú Nascimento", "GK", 80, 80, 87, 87, 26), { matches: 7, ratingSum: 50.4 }),
      withStats(player("Arthur Facas", "GK", 61, 64, 77, 76, 24), { matches: 1, ratingSum: 6.5 }),
      withStats(player('Davi "Major" Natã', "GK", 60, 63, 75, 74, 22), { matches: 1, ratingSum: 6 }),
      withStats(player("Thiago Oliveira", "GK", 62, 68, 78, 77, 25), { matches: 2, ratingSum: 14.6 }),
      withStats(player('Maicon "Barata"', "DEF", 75, 71, 82, 76, 25), { matches: 8, ratingSum: 52 }),
      withStats(player('Matheus "Biro"', "DEF", 73, 69, 80, 74, 24), { matches: 10, ratingSum: 65, goals: 1, assists: 2 }),
      withStats(player("Caio Felipe", "MID", 79, 80, 74, 77, 24), { matches: 10, ratingSum: 65 }),
      withStats(player("Felipe Cassiano", "MID", 78, 78, 73, 75, 23), { matches: 10, ratingSum: 77, goals: 1 }),
      withStats(player('Paulo "Pulão"', "MID", 80, 79, 75, 76, 24), { matches: 8, ratingSum: 56, goals: 1 }),
      withStats(player("Daniel Shiraishi", "MID", 80, 80, 75, 77, 22), { matches: 10, ratingSum: 70, goals: 4, assists: 1 }),
      withStats(player("Sam Silva", "MID", 74, 70, 81, 75, 25), { matches: 10, ratingSum: 70, goals: 4, assists: 1 }),
      withStats(player("Rômulo Kohagura", "MID", 74, 73, 71, 71, 21), { matches: 3, ratingSum: 19.5 }),
      withStats(player("Rafinha Cunha", "ATT", 87, 83, 79, 79, 25), { matches: 10, ratingSum: 72, goals: 3, assists: 5 }),
      withStats(player("Felipe Viana", "ATT", 93, 89, 85, 86, 26), { matches: 10, ratingSum: 75, goals: 12, assists: 2 }),
      withStats(player("Walid Jaadi", "ATT", 89, 84, 79, 79, 23), { matches: 5, ratingSum: 32.5, goals: 1 })
    ]
  },
  {
    id: "pod", name: "Podpah Funkbol Clube", color: "#8c1c2b", budget: 300000,
    coach: "Gustavo da Silva",
    presidents: ["Igão", "Michel Elias", "MC Hariel"],
    players: [
      withStats(player("Igor Campos", "GK", 68, 72, 87, 87, 26), { matches: 11, ratingSum: 71.5 }),
      withStats(player("Gustavo Silva", "GK", 61, 64, 77, 76, 24), { matches: 4, ratingSum: 26 }),
      withStats(player("William Jesus", "DEF", 75, 71, 82, 76, 25), { matches: 9, ratingSum: 63, goals: 2, assists: 1 }),
      withStats(player('Jhonatas "MlkJhoow" Goes', "DEF", 73, 69, 80, 74, 24), { matches: 1, ratingSum: 8.1 }),
      withStats(player("Ramon Goveia", "DEF", 74, 70, 81, 75, 25), { matches: 2, ratingSum: 13 }),
      withStats(player("Thiago Magalhães", "DEF", 77, 73, 83, 78, 23), { matches: 1, ratingSum: 6.5 }),
      withStats(player('Luan "Mestre"', "MID", 87, 88, 80, 85, 24), { matches: 11, ratingSum: 93.5, goals: 19, assists: 5 }),
      withStats(player("Caio Miranda", "MID", 78, 78, 73, 75, 23), { matches: 11, ratingSum: 71.5, goals: 1, assists: 1 }),
      withStats(player('Leléo Moura', "MID", 80, 79, 75, 76, 24), { matches: 11, ratingSum: 77, goals: 2 }),
      withStats(player("Vini Alexandre", "MID", 77, 77, 72, 74, 22), { matches: 11, ratingSum: 84.7, goals: 4 }),
      withStats(player("Martín Lara", "MID", 78, 80, 74, 77, 25), { matches: 3, ratingSum: 23.7 }),
      withStats(player('Rafão "Portuga"', "MID", 80, 79, 76, 77, 24), { matches: 6, ratingSum: 39, goals: 1 }),
      withStats(player("Willy dos Santos", "MID", 76, 75, 72, 73, 23), { matches: 4, ratingSum: 26, goals: 1 }),
      withStats(player("Ronaldinho Reis", "ATT", 87, 83, 79, 79, 25), { matches: 6, ratingSum: 39, goals: 2 }),
      withStats(player("Juninho Antunes", "ATT", 88, 84, 80, 81, 26), { matches: 11, ratingSum: 71.5, goals: 4, assists: 7 }),
      withStats(player('João "Choco"', "ATT", 85, 78, 76, 75, 23), { matches: 11, ratingSum: 71.5, goals: 3, assists: 1 }),
      withStats(player('Yan "Coringa"', "ATT", 90, 86, 82, 84, 24), { matches: 11, ratingSum: 81.4, goals: 7, assists: 3 }),
      withStats(player("Deives Moraes", "ATT", 78, 74, 73, 71, 21), { matches: 2, ratingSum: 13 })
    ]
  },
  {
    id: "den", name: "Dendele FC", color: "#d4a017", budget: 300000,
    coach: "Preto",
    presidents: ["Paulinho o Loko", "LuqEt4"],
    players: [
      withStats(player("Maikon Santos", "GK", 68, 75, 88, 87, 25), { matches: 2, ratingSum: 15.4 }),
      withStats(player("Gustavo Húngaro", "GK", 62, 64, 75, 70, 24), { matches: 10, ratingSum: 60 }),
      withStats(player("Gui Carvalho", "DEF", 75, 71, 82, 78, 25), { matches: 10, ratingSum: 77 }),
      withStats(player('Leonardo "Belletti"', "DEF", 73, 69, 80, 74, 24), { matches: 8, ratingSum: 52 }),
      withStats(player("Lyncoln Oliveira", "DEF", 85, 82, 80, 83, 25), { matches: 9, ratingSum: 72, goals: 12 }),
      withStats(player("Bruninho Mandarino", "MID", 71, 70, 68, 66, 23), { matches: 8, ratingSum: 52.8 }),
      withStats(player('Cristhian "Canhoto"', "MID", 80, 81, 75, 74, 24), { matches: 9, ratingSum: 64.8, goals: 4, assists: 3 }),
      withStats(player("Marquinhos Samora", "MID", 76, 77, 73, 73, 23), { matches: 10, ratingSum: 65, goals: 1 }),
      withStats(player("Gabriel Repulho", "ATT", 84, 79, 76, 76, 24), { matches: 8, ratingSum: 62.4 }),
      withStats(player('Luís Henrique "Boolt"', "ATT", 83, 78, 75, 74, 23), { matches: 3, ratingSum: 19.5, goals: 1 }),
      withStats(player("Nicollas Nascimento", "ATT", 80, 76, 74, 72, 22), { matches: 10, ratingSum: 65 }),
      withStats(player('Lucas "L7"', "ATT", 86, 82, 78, 79, 24), { matches: 10, ratingSum: 73, goals: 6, assists: 4 }),
      withStats(player("Ryan Soares", "ATT", 85, 81, 77, 77, 23), { matches: 10, ratingSum: 72, goals: 6, assists: 1 })
    ]
  },
  {
    id: "dib", name: "Dibrados FC", color: "#6a1b9a", budget: 300000,
    coach: "Silton Filho",
    presidents: ["Allan Stag", "Lucas Tylty"],
    players: [
      withStats(player("Bruno Mota", "GK", 62, 65, 77, 74, 24), { matches: 2, ratingSum: 13 }),
      withStats(player("Luan Teles", "GK", 69, 75, 88, 85, 26), { matches: 8, ratingSum: 54.4 }),
      withStats(player("Ivo Alves", "GK", 61, 67, 77, 77, 25), { matches: 3, ratingSum: 22.8 }),
      withStats(player("Sidney Pages", "DEF", 75, 71, 81, 76, 25), { matches: 9, ratingSum: 58.5, goals: 2 }),
      withStats(player("Daniel Ferreira", "DEF", 73, 69, 79, 74, 24), { matches: 9, ratingSum: 58.5 }),
      withStats(player("Edda Marcelino", "MID", 76, 76, 73, 73, 23), { matches: 8, ratingSum: 52 }),
      withStats(player("Fael Magalhães", "MID", 74, 73, 71, 71, 22), { matches: 4, ratingSum: 26 }),
      withStats(player("Henrique Wruck", "MID", 72, 70, 70, 70, 21), { matches: 1, ratingSum: 6.5 }),
      player('Matheus "Índio"', "MID", 73, 72, 71, 71, 22),
      player("Matheus Bueno", "MID", 77, 78, 73, 75, 24),
      withStats(player('Jonatas "Batman"', "MID", 75, 74, 72, 72, 23), { matches: 5, ratingSum: 32.5 }),
      withStats(player("Luiggi Longo", "MID", 81, 80, 76, 77, 24), { matches: 9, ratingSum: 63, goals: 5, assists: 1 }),
      withStats(player("Raphael Augusto", "MID", 73, 72, 71, 71, 21), { matches: 2, ratingSum: 13 }),
      withStats(player("Ricardinho Braga", "MID", 72, 71, 70, 70, 21), { matches: 2, ratingSum: 13 }),
      withStats(player("Ruan Major", "MID", 76, 75, 73, 73, 23), { matches: 9, ratingSum: 58.5, assists: 1 }),
      withStats(player('Lucas "Pulguinha"', "ATT", 82, 78, 75, 74, 23), { matches: 9, ratingSum: 58.5, goals: 1, assists: 1 }),
      withStats(player('Marcello "Marcelinho" Junior', "ATT", 80, 76, 74, 72, 22), { matches: 2, ratingSum: 14.6, goals: 1 }),
      withStats(player("Chay Medeiros", "ATT", 88, 85, 80, 82, 23), { matches: 6, ratingSum: 42, goals: 4 }),
      withStats(player("Etinho Lima", "ATT", 79, 75, 73, 72, 22), { matches: 3, ratingSum: 19.5 }),
      withStats(player("Gabriel Costa", "ATT",94, 94, 87, 92, 23), { matches: 9, ratingSum: 75.6, goals: 5, assists: 3 })
    ]
  }
];

// ---------------------- LIGUE ESPAGNE (Kings League Espagne) ----------------------
const SPAIN_TEAMS = [
  {
    id: "1kf", name: "1K FC", color: "#6a3fa0", budget: 300000,
    coach: "Manuel Fernández",
    presidents: ["Iker Casillas", "Baptistao"],
    players: [
      withStats(player("Pol Lechuga", "GK", 61, 66, 75, 75, 18), { matches: 10 }),
      player("M. Jiménez", "GK", 68, 66, 76, 79, 23),
      withStats(player("Iván Rivera", "GK", 83, 82, 92, 95, 29), { matches: 6 }),
      withStats(player("Michel Owono", "DEF", 69, 72, 82, 74, 22), { matches: 9, goals: 1, assists: 1 }),
      withStats(player("Cristian Faura", "DEF", 88, 85, 96, 92, 35), { matches: 6, goals: 1, assists: 2 }),
      withStats(player("Karim Moya", "DEF", 73, 70, 88, 83, 34), { matches: 11, goals: 1, assists: 4 }),
      withStats(player("Pau 'ZZ' Ruiz", "DEF", 76, 67, 76, 79, 26), { matches: 7, goals: 3, assists: 2 }),
      withStats(player("Achraf Laiti", "DEF", 83, 83, 92, 88, 18), { matches: 11, goals: 2 }),
      withStats(player("Guelmi Pons", "DEF", 80, 82, 87, 83, 23), { matches: 6 }),
      withStats(player("Erik Beattie", "MID", 79, 85, 75, 82, 26), { matches: 11, goals: 1, assists: 1 }),
      withStats(player("Joel Navas", "MID", 94, 97, 82, 92, 31), { matches: 10 }),
      player("Jordi Ros", "MID", 78, 80, 74, 77, 24),
      withStats(player("Eric Jiménez", "ATT", 81, 77, 69, 69, 28), { matches: 1 }),
      withStats(player("Isma Reguia", "ATT", 82, 87, 83, 73, 26), { matches: 11, goals: 5, assists: 1 }),
      withStats(player("Joel Paredes", "ATT", 93, 93, 81, 87, 33), { matches: 11, goals: 5, assists: 1 }),
      withStats(player("Gerard Verge", "ATT", 63, 74, 66, 69, 21), { matches: 10, goals: 19, assists: 10 }),
      withStats(player("Pol Requena", "ATT", 82, 88, 74, 73, 26), { matches: 2, goals: 2 })
    ]
  },
  {
    id: "ebr", name: "El Barrio", color: "#c0392b", budget: 300000,
    coach: "Xavi Corominas",
    presidents: ["Adri Contreras"],
    players: [
      withStats(player("Sergio Fernández Ortiz", "GK", 64, 64, 82, 76, 20), { matches: 10 }),
      withStats(player("Hugo Eyre", "GK", 74, 80, 89, 90, 28), { matches: 5 }),
      player("Marçal Ros", "GK", 74, 77, 88, 82, 29),
      withStats(player("Joel Bañuls", "DEF", 70, 75, 85, 75, 25), { matches: 13, goals: 10, assists: 2 }),
      withStats(player("Robert Vallribera", "ATT", 74, 82, 88, 79, 22), { matches: 0 }),
      withStats(player("Herrero", "DEF", 70, 69, 78, 80, 28), { matches: 13, goals: 2 }),
      withStats(player("Carlos Val", "DEF", 84, 90, 94, 87, 27), { matches: 12, goals: 1, assists: 4 }),
      player("Martín Mantovani", "DEF", 69, 79, 84, 85, 34),
      withStats(player("Pol Molés", "MID", 83, 82, 75, 79, 26), { matches: 13, goals: 7, assists: 4 }),
      withStats(player("Ñito Martín", "MID", 77, 84, 80, 80, 25), { matches: 12 }),
      withStats(player("Pablo Saborido", "MID", 79, 82, 70, 75, 21), { matches: 11, goals: 1, assists: 3 }),
      withStats(player("Raúl Inocencio", "MID", 77, 84, 70, 80, 29), { matches: 2, goals: 1 }),
      withStats(player("Gerard Puigvert", "MID", 82, 76, 90, 81, 27), { matches: 10, goals: 1, assists: 6 }),
      player("Valentín Merchán", "MID", 78, 81, 75, 78, 24),
      withStats(player("Marc Pérez", "ATT", 83, 76, 74, 74, 20), { matches: 1 }),
      withStats(player("Haitam Babia", "ATT", 79, 79, 68, 64, 23), { matches: 5, goals: 1 }),
      withStats(player("Cristian Ubón", "MID", 89, 91, 80, 82, 18), { matches: 13, goals: 15, assists: 1 }),
      withStats(player("Naoufal Talkam", "ATT", 70, 70, 68, 65, 21), { matches: 5, goals: 3, assists: 1 }),
      withStats(player("Pau Fernández", "ATT", 90, 93, 89, 76, 25), { matches: 13, goals: 9, assists: 2 })
    ]
  },
  {
    id: "jig", name: "Jijantes FC", color: "#6d1b3a", budget: 300000,
    coach: "David Biosca",
    presidents: ["Gerard Romero"],
    players: [
      withStats(player("Mario León", "GK", 73, 76, 88, 86, 21), { matches: 6 }),
      withStats(player("José Segovia", "GK", 87, 83, 97, 90, 29), { matches: 10 }),
      withStats(player("Víctor Pérez Bello", "DEF", 90, 87, 93, 89, 24), { matches: 9, goals: 3, assists: 2 }),
      withStats(player("Dani Martí", "DEF", 75, 75, 82, 82, 23), { matches: 11, goals: 1 }),
      withStats(player("Ion Vázquez", "DEF", 64, 67, 77, 72, 22), { matches: 5 }),
      withStats(player("Iker Hernández", "DEF", 87, 82, 97, 94, 27), { matches: 8, assists: 1 }),
      withStats(player("Michel Herrero", "MID", 87, 85, 81, 86, 20), { matches: 5, goals: 1 }),
      withStats(player("Pau Fernández", "MID", 88, 95, 90, 97, 33), { matches: 11, goals: 4, assists: 2 }),
      withStats(player("Cristian Gómez", "MID", 85, 86, 78, 85, 22), { matches: 2 }),
      withStats(player("Daniel Plaza", "MID", 76, 80, 68, 71, 20), { matches: 8, assists: 1 }),
      withStats(player("Cristian Lobato", "MID", 88, 89, 81, 78, 27), { matches: 11, goals: 8, assists: 2 }),
      withStats(player("Alex Cañero", "ATT", 84, 88, 81, 75, 29), { matches: 9, goals: 1, assists: 1 }),
      withStats(player("Marc Montejo", "ATT", 74, 80, 68, 65, 26), { matches: 6 }),
      withStats(player("David Toro", "ATT", 80, 71, 71, 65, 27), { matches: 6, goals: 1 }),
      withStats(player("Juanpe Nzo", "ATT", 85, 80, 73, 69, 18), { matches: 10, goals: 1, assists: 1 }),
      withStats(player("Sergi Torres", "ATT", 66, 75, 69, 73, 22), { matches: 10, goals: 13, assists: 4 }),
      player("Ton Alcover", "ATT", 84, 82, 77, 76, 25)
    ]
  },
  {
    id: "lcc", name: "La Capital CF", color: "#d6417e", budget: 300000,
    coach: "Arnau Jariod",
    presidents: ["Lamine Yamal", "La Cobra"],
    players: [
      withStats(player("Roger García", "GK", 73, 72, 83, 83, 28), { matches: 1 }),
      withStats(player("Manel Jiménez", "GK", 62, 64, 73, 75, 27), { matches: 1 }),
      withStats(player("Sergi Vives", "DEF", 86, 89, 90, 88, 18), { matches: 2 }),
      withStats(player("Mario Victorio", "DEF", 71, 70, 83, 76, 29), { matches: 1 }),
      withStats(player("Daniel Pérez", "DEF", 76, 79, 74, 72, 21), { matches: 2 }),
      withStats(player("Julen Álvarez", "MID", 72, 74, 61, 66, 19), { matches: 2, assists: 2 }),
      withStats(player("Sohaib Rektout", "MID", 84, 86, 86, 93, 27), { matches: 2, goals: 2, assists: 2 }),
      withStats(player("Iñaki Villalba", "MID", 67, 75, 72, 67, 19), { matches: 2 }),
      withStats(player("Daouda Bamma", "MID", 80, 79, 74, 78, 23), { matches: 2 }),
      withStats(player("Antoni Hernández", "ATT", 96, 94, 85, 90, 31), { matches: 2, goals: 2 }),
      withStats(player("Pablo Beguer", "ATT", 86, 90, 83, 72, 29), { matches: 2 }),
      withStats(player("Omar Dambelleh", "ATT", 94, 88, 86, 81, 25), { matches: 2, goals: 1 }),
      withStats(player("Roc Bancells", "ATT", 85, 82, 81, 76, 24), { matches: 2 })
    ]
  },
  {
    id: "ltf", name: "Los Troncos FC", color: "#2f8f3f", budget: 300000,
    coach: "Eric Bartra",
    presidents: ["Jaume Cremades"],
    players: [
      withStats(player("Eloy Amoedo", "GK", 67, 60, 71, 70, 20), { matches: 4 }),
      withStats(player("Yaroslav Toporkov", "GK", 70, 79, 85, 82, 32), { matches: 0 }),
      withStats(player("Joan Oriol", "DEF", 80, 88, 89, 90, 34), { matches: 4, goals: 5 }),
      withStats(player("Álex Cubedo", "DEF", 76, 66, 82, 80, 23), { matches: 3 }),
      withStats(player("Sagar Escoto", "DEF", 79, 77, 89, 80, 25), { matches: 4 }),
      player("Daniel Tamayo", "DEF", 63, 64, 76, 75, 21),
      withStats(player("Carles Planas", "DEF", 70, 79, 87, 86, 33), { matches: 4, goals: 2, assists: 1 }),
      withStats(player("Víctor Oribe", "MID", 80, 84, 79, 82, 33), { matches: 4 }),
      withStats(player("David Reyes", "MID", 78, 81, 72, 74, 25), { matches: 4, assists: 2 }),
      withStats(player("Álvaro Arché", "ATT", 68, 79, 72, 71, 23), { matches: 4, assists: 1 }),
      withStats(player("Carlos Contreras", "ATT", 97, 96, 87, 89, 27), { matches: 4 }),
      withStats(player("Mark Sorroche", "ATT", 80, 83, 78, 75, 32), { matches: 4, goals: 4, assists: 2 }),
      withStats(player("Masi Dabo", "ATT", 82, 87, 75, 78, 23), { matches: 4, goals: 1 })
    ]
  },
  {
    id: "pio", name: "PIO FC", color: "#d4711f", budget: 300000,
    coach: "Pol Font",
    presidents: ["Samantha Rivera"],
    players: [
      withStats(player("Víctor Montoya", "GK", 60, 67, 68, 74, 26), { matches: 3 }),
      withStats(player("Iker Bartolomé", "GK", 70, 77, 89, 89, 27), { matches: 10 }),
      withStats(player("Marc Briones", "GK", 78, 82, 89, 93, 26), { matches: 5 }),
      withStats(player("Manel Beneite", "DEF", 72, 65, 82, 70, 28), { matches: 4, goals: 1 }),
      withStats(player("Gabriel Cichero", "DEF", 89, 84, 93, 89, 23), { matches: 1 }),
      withStats(player("Adrián Frutos", "DEF", 76, 80, 82, 78, 29), { matches: 11, goals: 2, assists: 3 }),
      withStats(player("Joan Luque", "DEF", 85, 88, 82, 73, 23), { matches: 12, goals: 7, assists: 2 }),
      withStats(player("Marc Grifell", "DEF", 92, 92, 82, 87, 18), { matches: 5 }),
      withStats(player("Marcel García", "DEF", 80, 88, 78, 75, 21), { matches: 1 }),
      withStats(player("Luis García", "MID", 65, 68, 64, 65, 27), { matches: 11, goals: 16, assists: 8 }),
      withStats(player("Álex Sánchez", "MID", 91, 93, 90, 91, 18), { matches: 9 }),
      withStats(player("Fernando Velillas", "MID", 86, 86, 84, 75, 26), { matches: 6, goals: 1, assists: 2 }),
      withStats(player("Marcos Ibañez", "MID", 85, 89, 84, 83, 30), { matches: 6, goals: 3, assists: 2 }),
      withStats(player("Pol Benito", "MID", 80, 81, 68, 69, 35), { matches: 12, goals: 1, assists: 1 }),
      player("Aarón Ropero", "MID", 82, 85, 78, 80, 24),
      withStats(player("Sergio Mulero", "ATT", 86, 88, 81, 76, 35), { matches: 9, goals: 1 }),
      withStats(player("Yeray Muñoz", "ATT", 88, 90, 80, 86, 27), { matches: 12, goals: 6, assists: 3 }),
      withStats(player("Adri Espinar", "ATT", 68, 69, 64, 59, 23), { matches: 12, goals: 20, assists: 3 }),
      withStats(player("Izan Grande", "ATT", 67, 74, 61, 64, 29), { matches: 2, goals: 1 })
    ]
  },
  {
    id: "por", name: "Porcinos FC", color: "#c23b8a", budget: 300000,
    coach: "Narcís Barrera",
    presidents: ["Ibai Llanos", "Guanyar"],
    players: [
      withStats(player("Dani Pérez", "GK", 69, 61, 75, 74, 29), { matches: 2 }),
      withStats(player("Victor Rodríguez", "GK", 87, 84, 96, 95, 26), { matches: 0 }),
      withStats(player("Álex Gutiérrez", "DEF", 74, 71, 81, 72, 33), { matches: 2 }),
      withStats(player("David Soriano", "DEF", 75, 79, 87, 87, 21), { matches: 2 }),
      withStats(player("Nadir Louah", "DEF", 79, 78, 85, 82, 25), { matches: 2 }),
      player("Aitor Vives", "DEF", 78, 76, 84, 79, 22),
      withStats(player("Cristian Lobato", "MID", 82, 86, 71, 85, 25), { matches: 2, assists: 2 }),
      withStats(player("Fouad El Amrani", "MID", 93, 97, 85, 97, 22), { matches: 2, goals: 1 }),
      withStats(player("Franc Samaniego", "MID", 66, 72, 71, 72, 25), { matches: 1 }),
      withStats(player("Marc Pelaz", "MID", 74, 71, 65, 77, 24), { matches: 2, goals: 1 }),
      withStats(player("Óscar Coll", "MID", 70, 72, 64, 76, 25), { matches: 2 }),
      withStats(player("Edgar Álvaro", "ATT", 71, 74, 71, 68, 24), { matches: 2 }),
      withStats(player("Nico Santos", "ATT", 89, 91, 82, 80, 23), { matches: 2, goals: 1 }),
      withStats(player("Roger Carbó", "ATT", 93, 87, 90, 84, 26), { matches: 2, goals: 1 })
    ]
  },
  {
    id: "rdb", name: "Rayo de Barcelona", color: "#f0c419", budget: 300000,
    coach: "Robert Cornfield",
    presidents: ["Martí Miràs", "Jova"],
    players: [
      withStats(player("Jorge Ibáñez", "GK", 79, 78, 92, 92, 18), { matches: 10 }),
      withStats(player("David Moreno", "GK", 69, 69, 79, 80, 22), { matches: 14 }),
      withStats(player("Ismael González", "DEF", 74, 75, 79, 74, 28), { matches: 1 }),
      withStats(player("Adrià Escribano", "DEF", 78, 71, 83, 80, 30), { matches: 13, goals: 3 }),
      withStats(player("Nil Pradas", "DEF", 72, 69, 82, 74, 26), { matches: 12, goals: 2 }),
      player("I. Sugranyes", "DEF", 74, 71, 90, 78, 20),
      withStats(player("Abde Bakkali", "DEF", 81, 76, 89, 87, 21), { matches: 10, goals: 3, assists: 1 }),
      withStats(player("Aridai Carrera", "DEF", 80, 82, 86, 84, 24), { matches: 0 }),
      withStats(player("Iván Torres", "DEF", 82, 85, 84, 82, 25), { matches: 14, goals: 13, assists: 3 }),
      withStats(player("Jordi Gómez", "MID", 85, 88, 82, 82, 26), { matches: 13, goals: 17, assists: 16 }),
      withStats(player("Carlos Heredia", "MID", 82, 91, 83, 90, 28), { matches: 14, assists: 2 }),
      withStats(player("Carlos Omabegho", "MID", 74, 72, 67, 65, 28), { matches: 14, goals: 7, assists: 4 }),
      withStats(player("Adam Tahere", "MID", 75, 80, 74, 80, 28), { matches: 1 }),
      withStats(player("Gerard Oliva", "ATT", 91, 89, 86, 88, 20), { matches: 13, goals: 6, assists: 3 }),
      player("A. Sisay", "ATT", 88, 84, 81, 78, 26),
      withStats(player("Guillem 'ZZ' Ruiz", "DEF", 73, 67, 63, 66, 22), { matches: 11, goals: 2, assists: 2 }),
      withStats(player("Roc Bancells", "ATT", 97, 91, 86, 89, 25), { matches: 13, goals: 16, assists: 6 }),
      withStats(player("Mohamed Boullouh", "ATT", 90, 92, 81, 84, 28), { matches: 1 }),
      player("Alhagi Marie Touray", "ATT", 80, 78, 76, 72, 23)
    ]
  },
  {
    id: "say", name: "Saiyans FC", color: "#e08b2f", budget: 300000,
    coach: "Sebastián Marteles",
    presidents: ["David Cánovas"],
    players: [
      withStats(player("Iván Fajardo", "GK", 57, 65, 75, 74, 29), { matches: 0 }),
      withStats(player("Gerard Vacas", "GK", 68, 69, 77, 80, 22), { matches: 12 }),
      withStats(player("Alex Campu", "DEF", 67, 63, 81, 67, 21), { matches: 4 }),
      withStats(player("Dani Santiago", "DEF", 84, 82, 96, 90, 22), { matches: 10, goals: 4, assists: 1 }),
      withStats(player("Albert De Verdonces", "DEF", 79, 83, 90, 87, 20), { matches: 1 }),
      withStats(player("Borja Montejo", "DEF", 94, 95, 85, 87, 34), { matches: 12, goals: 1 }),
      withStats(player("Feliu Torrus", "MID", 92, 91, 85, 82, 28), { matches: 11, goals: 4, assists: 1 }),
      withStats(player("Juanan Gallego", "MID", 81, 85, 71, 71, 27), { matches: 11, goals: 10, assists: 5 }),
      withStats(player("Diego Jiménez", "ATT", 77, 81, 84, 84, 31), { matches: 11, goals: 5, assists: 4 }),
      withStats(player("Pablo Fernández", "ATT", 89, 90, 80, 85, 26), { matches: 12, goals: 5, assists: 3 }),
      withStats(player("Sergi Gestí", "ATT", 75, 76, 62, 59, 25), { matches: 12, goals: 18, assists: 1 }),
      withStats(player("Isaac Maldonado", "ATT", 96, 97, 89, 84, 18), { matches: 11 }),
      withStats(player("Gio Ferinu", "ATT", 80, 85, 72, 74, 25), { matches: 12 }),
      withStats(player("Albert García", "ATT", 86, 84, 80, 82, 26), { matches: 10 })
    ]
  },
  {
    id: "skl", name: "Skull FC", color: "#b0202a", budget: 300000,
    coach: "Marcelo",
    presidents: ["Marcelo", "Daniel Alonso"],
    players: [
      withStats(player("Alberto Arnalot", "GK", 80, 88, 85, 92, 19), { matches: 12 }),
      withStats(player("Kevin Zárate", "GK", 63, 66, 73, 81, 20), { matches: 11 }),
      player("Marcelo", "DEF", 72, 69, 76, 71, 34),
      withStats(player("Víctor Mongil", "DEF", 75, 70, 86, 77, 23), { matches: 9, goals: 1, assists: 2 }),
      withStats(player("Roberto Tobe", "DEF", 79, 76, 89, 91, 25), { matches: 3 }),
      withStats(player("Koke Navares", "DEF", 64, 69, 79, 77, 21), { matches: 8 }),
      withStats(player("David Asensio", "DEF", 74, 72, 80, 76, 24), { matches: 8, assists: 1 }),
      withStats(player("José Hermosa", "DEF", 70, 68, 76, 72, 25), { matches: 2 }),
      withStats(player("Marcelo Vieira", "DEF", 68, 86, 80, 88, 37), { matches: 1, assists: 2 }),
      player("Israel de la Riva", "MID", 78, 80, 79, 81, 26),
      withStats(player("Jorge Escobar", "MID", 84, 90, 84, 84, 22), { matches: 12, goals: 23, assists: 5 }),
      withStats(player("Álex Salas", "DEF", 77, 77, 70, 85, 19), { matches: 7 }),
      withStats(player("David 'Burrito' Ruiz", "MID", 72, 63, 74, 76, 18), { matches: 3, assists: 1 }),
      withStats(player("Pablo de Castro", "MID", 74, 69, 73, 64, 21), { matches: 12, goals: 3 }),
      withStats(player("Manu García", "MID", 74, 76, 72, 73, 23), { matches: 2 }),
      withStats(player("Sergio Sánchez", "MID", 73, 74, 72, 72, 24), { matches: 3, assists: 1 }),
      withStats(player("Dani Santos", "ATT", 93, 87, 84, 87, 23), { matches: 12, goals: 6, assists: 3 }),
      withStats(player("Nano Modrego", "ATT", 67, 69, 62, 59, 24), { matches: 10, goals: 2, assists: 1 }),
      withStats(player("Raúl Escobar", "ATT", 77, 74, 74, 66, 23), { matches: 11 }),
      withStats(player("Ayoub El Battioui", "ATT", 84, 80, 74, 72, 22), { matches: 1, goals: 2 }),
      withStats(player("Samuel Aparicio", "ATT", 88, 89, 80, 79, 24), { matches: 6, goals: 10, assists: 1 })
    ]
  },
  {
    id: "umo", name: "Ultimate Móstoles", color: "#2c5aa0", budget: 300000,
    coach: "Alex Martínez",
    presidents: ["Mario Alonso"],
    players: [
      withStats(player("Víctor Vidal", "GK", 83, 84, 96, 95, 26), { matches: 4 }),
      withStats(player("Juan Lorente", "GK", 76, 85, 92, 89, 21), { matches: 0 }),
      withStats(player("David Grifell", "DEF", 65, 62, 79, 74, 19), { matches: 4 }),
      player("I. Sugranyes", "DEF", 73, 70, 88, 82, 19),
      withStats(player("Marc Granero", "DEF", 84, 92, 92, 91, 22), { matches: 4 }),
      withStats(player("Eloy Pizarro", "DEF", 78, 74, 88, 80, 23), { matches: 4, assists: 1 }),
      player("Alberto de la Bella", "DEF", 68, 78, 82, 84, 35),
      withStats(player("Javi Espinosa", "MID", 76, 79, 80, 80, 33), { matches: 4, goals: 1 }),
      withStats(player("Luis García", "MID", 79, 82, 69, 80, 20), { matches: 4, goals: 2 }),
      withStats(player("Dani Liñares", "MID", 68, 74, 64, 75, 27), { matches: 4, goals: 1, assists: 2 }),
      withStats(player("Aleix Lage", "MID", 80, 87, 84, 86, 25), { matches: 4 }),
      withStats(player("Alex 'Capi' Domingo", "MID", 86, 90, 83, 78, 20), { matches: 4 }),
      withStats(player("Aleix Martí", "ATT", 76, 75, 87, 79, 28), { matches: 4, goals: 11 }),
      withStats(player("Mikhail Prokopev", "ATT", 74, 71, 67, 75, 32), { matches: 4, assists: 1 }),
      player("Ferrán Corominas", "ATT", 65, 88, 74, 86, 40)
    ]
  },
  {
    id: "xby", name: "xBuyer Team", color: "#2f5fa8", budget: 300000,
    coach: "Isaac Juárez",
    presidents: ["Javier xBuyer", "Eric Ruiz MiniBuyer"],
    players: [
      withStats(player("Aleix Ruiz", "GK", 87, 88, 97, 90, 21), { matches: 13 }),
      withStats(player("Álex Romero", "GK", 80, 86, 95, 96, 21), { matches: 5 }),
      withStats(player("Joel Espinosa", "DEF", 78, 82, 92, 86, 30), { matches: 11 }),
      withStats(player("Mario Reyes", "DEF", 87, 82, 97, 87, 18), { matches: 14, goals: 1, assists: 2 }),
      withStats(player("Sergio Campos", "DEF", 79, 90, 75, 79, 33), { matches: 2 }),
      withStats(player("Víctor Vargas", "DEF", 72, 70, 82, 75, 26), { matches: 14, assists: 1 }),
      withStats(player("Eric Pérez", "DEF", 71, 77, 82, 75, 28), { matches: 1 }),
      withStats(player("Zaid Saban", "DEF", 97, 89, 83, 84, 23), { matches: 4 }),
      withStats(player("Eric Sánchez", "MID", 77, 79, 68, 74, 26), { matches: 14, goals: 2 }),
      withStats(player("Xavier Cabezas", "MID", 67, 73, 68, 69, 26), { matches: 14, goals: 5, assists: 1 }),
      player("Héctor Rodríguez", "MID", 77, 79, 73, 76, 25),
      player("Pol Tolrà", "MID", 79, 83, 74, 79, 23),
      withStats(player("Antonio Domenech", "ATT", 74, 77, 85, 77, 30), { matches: 6 }),
      withStats(player("Galde Hugue", "ATT", 88, 96, 92, 91, 27), { matches: 14, goals: 22, assists: 12 }),
      withStats(player("Jacobo Liencres", "ATT", 85, 89, 78, 76, 25), { matches: 14, goals: 14, assists: 10 }),
      withStats(player("Javier Comas", "ATT", 75, 73, 75, 67, 24), { matches: 3, assists: 1 }),
      withStats(player("Juanma González", "ATT", 73, 68, 63, 69, 20), { matches: 14, goals: 5, assists: 2 }),
      withStats(player("Sergio 'Chechi' Costa", "ATT", 84, 88, 71, 86, 23), { matches: 10, goals: 8, assists: 1 }),
      withStats(player("Albert López", "ATT", 91, 86, 85, 78, 27), { matches: 2, goals: 3 }),
      withStats(player("Marc Gulias", "ATT", 92, 95, 90, 89, 24), { matches: 1 }),
      player("Stelios Orgianos", "ATT", 90, 92, 82, 82, 24)
    ]
  },
];

// ---------------------- LIGUE ITALIE (Kings League Italie) ----------------------
const ITALY_TEAMS = [
  {
    id: "alp", name: "Alpak FC", color: "#d63384", budget: 300000,
    coach: "Mauro Micheli",
    presidents: ["Frenezy"],
    players: [
      withStats(player("Luigi Castelli", "GK", 65, 61, 69, 75, 25), { matches: 0 }),
      withStats(player("Vittorio Gilli", "GK", 81, 90, 97, 97, 26), { matches: 6 }),
      withStats(player("Thomas Salvaterra", "DEF", 75, 67, 83, 76, 19), { matches: 6 }),
      withStats(player("Vlad Marin", "DEF", 76, 78, 87, 83, 29), { matches: 6, goals: 2 }),
      withStats(player("Alessandro Gelsi", "MID", 76, 83, 74, 81, 29), { matches: 6, goals: 4, assists: 1 }),
      withStats(player("Andrea Benedetti", "MID", 81, 79, 75, 86, 24), { matches: 6, goals: 1, assists: 1 }),
      withStats(player("Federico Lorenzani", "MID", 73, 81, 70, 77, 33), { matches: 6 }),
      withStats(player("Jero Martín", "MID", 76, 90, 78, 79, 32), { matches: 6, goals: 3, assists: 1 }),
      withStats(player("Nicola Cutrignelli", "MID", 74, 68, 61, 68, 22), { matches: 6, goals: 1 }),
      withStats(player("Christian Ronchi", "ATT", 77, 70, 67, 62, 22), { matches: 6, goals: 4, assists: 1 }),
      withStats(player("Gianmarco Massa", "ATT", 83, 81, 70, 76, 20), { matches: 6 }),
      withStats(player("Mauro Veneroso", "ATT", 82, 78, 76, 69, 23), { matches: 6, goals: 2, assists: 2 }),
      withStats(player("Paolo Scienza", "ATT", 73, 79, 71, 61, 20), { matches: 6, goals: 2, assists: 2 })
    ]
  },
  {
    id: "bbr", name: "BIGBRO", color: "#4a5568", budget: 300000,
    coach: "Emanuele Di Vittorio",
    presidents: ["Moonryde"],
    players: [
      withStats(player("Leandro Casapieri", "GK", 85, 89, 93, 96, 29), { matches: 12 }),
      withStats(player("Alessandro Garilli", "DEF", 73, 68, 81, 81, 27), { matches: 12, goals: 4 }),
      withStats(player("Alessandro Tuia", "DEF", 62, 64, 76, 73, 18), { matches: 8 }),
      withStats(player("Yasin Zougui", "DEF", 72, 71, 90, 77, 31), { matches: 9 }),
      withStats(player("Cheick Fofana", "DEF", 71, 65, 79, 79, 28), { matches: 1 }),
      withStats(player("Fabrizio Olivera", "DEF", 83, 74, 93, 87, 24), { matches: 1 }),
      withStats(player("Andrea Strada", "MID", 87, 87, 76, 85, 30), { matches: 12, goals: 2 }),
      withStats(player("Sebastiano Finardi", "MID", 82, 86, 72, 77, 22), { matches: 11, goals: 3, assists: 1 }),
      withStats(player("Spizzi", "MID", 88, 90, 84, 89, 28), { matches: 10, goals: 8, assists: 3 }),
      withStats(player("Tiziano Merlonghi", "MID", 72, 78, 67, 72, 25), { matches: 11, goals: 7, assists: 3 }),
      withStats(player("Alessandro Sigurtà", "ATT", 89, 88, 77, 77, 27), { matches: 12, goals: 6 }),
      withStats(player("Andrea Maggioni", "ATT", 69, 72, 71, 64, 26), { matches: 9, goals: 4, assists: 1 }),
      withStats(player("Davide Moscardelli", "ATT", 78, 82, 77, 80, 24), { matches: 10, goals: 4 }),
      withStats(player("Gianluca Piro", "ATT", 91, 86, 75, 79, 27), { matches: 12, goals: 2, assists: 3 }),
      withStats(player("Antonio Quartesan", "ATT", 89, 91, 87, 78, 26), { matches: 1 }),
      withStats(player("Ibrahim Ghouati", "ATT", 93, 96, 89, 87, 28), { matches: 1 })
    ]
  },
  {
    id: "boo", name: "Boomers", color: "#c9a227", budget: 300000,
    coach: "Mattia Mangone",
    presidents: ["Fedez"],
    players: [
      withStats(player("Antonio Iuliano", "GK", 74, 80, 88, 85, 29), { matches: 14 }),
      withStats(player("Edoardo Ciancio", "GK", 64, 60, 78, 77, 25), { matches: 6 }),
      withStats(player("Alessio De Petri", "DEF", 69, 67, 75, 73, 22), { matches: 14, goals: 3, assists: 4 }),
      withStats(player("Andrea Tarasco", "DEF", 64, 66, 79, 66, 30), { matches: 14, goals: 1 }),
      withStats(player("Pietro Pizzamiglio", "DEF", 86, 83, 96, 93, 20), { matches: 7, goals: 2, assists: 1 }),
      withStats(player("Stefano Sberna", "DEF", 69, 75, 83, 78, 29), { matches: 14, goals: 4, assists: 2 }),
      withStats(player("Bryan Mecca", "MID", 85, 88, 78, 88, 22), { matches: 9, goals: 8, assists: 2 }),
      withStats(player("Gabriele Pasello", "MID", 87, 96, 88, 91, 28), { matches: 2 }),
      withStats(player("Nicholas Martini", "MID", 83, 92, 86, 90, 27), { matches: 7, goals: 8, assists: 1 }),
      withStats(player("Manolo Mosciaro", "MID", 89, 90, 87, 91, 27), { matches: 10, goals: 2 }),
      withStats(player("Dexter", "MID", 84, 92, 80, 85, 20), { matches: 1 }),
      withStats(player("Fiodor Grimaldi", "MID", 78, 85, 71, 75, 24), { matches: 2, goals: 2 }),
      withStats(player("Faisal Abdul Amide Bangal", "MID", 72, 78, 75, 78, 20), { matches: 1 }),
      player("David Pizarro", "MID", 62, 90, 72, 92, 45),
      player("Diego Perotti", "ATT", 66, 88, 73, 84, 41),
      player("Daniele Cacia", "ATT", 68, 82, 78, 80, 43),
      withStats(player("Davide Bonolis", "ATT", 96, 93, 88, 86, 23), { matches: 13 }),
      withStats(player("Nicolas Kalaja", "ATT", 71, 72, 70, 65, 22), { matches: 13, goals: 4, assists: 1 }),
      withStats(player("Simone Lo Faso", "ATT", 82, 78, 68, 73, 20), { matches: 14, goals: 24, assists: 5 })
    ]
  },
  {
    id: "cir", name: "Circus FC", color: "#7b3fa0", budget: 300000,
    coach: "Alan Rigo",
    presidents: ["GrenBaud"],
    players: [
      withStats(player("Roberto Gherardi", "GK", 71, 64, 80, 74, 18), { matches: 11 }),
      withStats(player("Simone Martino", "GK", 84, 84, 93, 93, 24), { matches: 12 }),
      withStats(player("Giovanni Scotti", "GK", 72, 68, 80, 85, 22), { matches: 0 }),
      withStats(player("Giorgio Belotti", "DEF", 63, 62, 79, 67, 23), { matches: 3 }),
      withStats(player("Lorenzo Mantovani", "DEF", 65, 73, 79, 73, 22), { matches: 12, goals: 5 }),
      withStats(player("Matteo Rossi", "DEF", 73, 80, 84, 80, 27), { matches: 6 }),
      withStats(player("Tommaso Conte", "DEF", 76, 88, 88, 86, 22), { matches: 12, goals: 7, assists: 2 }),
      withStats(player("Giacomo Fabiani", "DEF", 90, 81, 92, 89, 25), { matches: 1 }),
      withStats(player("Giulio Uras", "MID", 66, 74, 66, 67, 28), { matches: 8 }),
      withStats(player("Nico Federici", "MID", 79, 86, 77, 87, 25), { matches: 11, goals: 2, assists: 3 }),
      withStats(player("Riccardo Ruggeri", "MID", 69, 74, 69, 74, 22), { matches: 12, goals: 2, assists: 1 }),
      withStats(player("Mattia Bergamaschi", "MID", 72, 80, 75, 77, 23), { matches: 0 }),
      player("Lorenzo Federici", "MID", 78, 81, 74, 79, 24),
      withStats(player("Christian Calì", "ATT", 89, 80, 74, 78, 34), { matches: 12, goals: 6, assists: 1 }),
      withStats(player("Davide Bertocchi", "ATT", 93, 93, 88, 84, 19), { matches: 9, goals: 9, assists: 2 }),
      withStats(player("Francesco Giangaspero", "ATT", 86, 85, 79, 78, 27), { matches: 3, assists: 1 }),
      withStats(player("Lorenzo Berra", "ATT", 90, 89, 76, 77, 22), { matches: 12, goals: 19, assists: 2 }),
      withStats(player("Matteo Rossoni", "ATT", 97, 90, 85, 89, 18), { matches: 10, goals: 2 }),
      withStats(player("Simone Pontiggia", "ATT", 81, 76, 67, 64, 30), { matches: 2, goals: 1, assists: 1 })
    ]
  },
  {
    id: "dpw", name: "D-POWER", color: "#b23a2e", budget: 300000,
    coach: "Umberto Chiaramonte",
    presidents: ["Diletta Leotta", "Christian Vieri"],
    players: [
      withStats(player("Filippo Manzoni", "GK", 70, 74, 81, 78, 18), { matches: 2 }),
      withStats(player("Valerio Vimercati", "GK", 79, 81, 87, 84, 35), { matches: 10 }),
      withStats(player("Andrea Vicini", "GK", 81, 89, 97, 90, 21), { matches: 1 }),
      withStats(player("Alessandro Marocco", "DEF", 59, 64, 75, 73, 28), { matches: 11, goals: 1, assists: 2 }),
      withStats(player("Angelo Carpani", "DEF", 82, 76, 91, 88, 28), { matches: 1 }),
      withStats(player("Antonio Mihaylov", "DEF", 73, 68, 81, 73, 20), { matches: 10, assists: 1 }),
      withStats(player("Riccardo Ammirati", "DEF", 77, 79, 89, 86, 18), { matches: 10 }),
      withStats(player("Andrea Montagna", "MID", 66, 75, 65, 71, 25), { matches: 11, goals: 1 }),
      withStats(player("Imad Tijani", "MID", 80, 81, 79, 80, 21), { matches: 11, goals: 2 }),
      withStats(player("Soufiane El Jadi", "MID", 95, 92, 89, 90, 28), { matches: 11, goals: 18, assists: 10 }),
      withStats(player("Alessandro Patacchini", "ATT", 96, 87, 87, 81, 25), { matches: 11, assists: 1 }),
      withStats(player("Daniel Santoro", "ATT", 88, 83, 78, 77, 28), { matches: 11, goals: 15, assists: 5 }),
      withStats(player("Filippo Falco", "ATT", 97, 96, 85, 86, 26), { matches: 3, goals: 2 }),
      withStats(player("Matteo Siano", "ATT", 82, 81, 79, 74, 31), { matches: 11, goals: 5 }),
      withStats(player("Emanuele Calaiò", "ATT", 74, 87, 78, 82, 41), { matches: 1 })
    ]
  },
  {
    id: "cae", name: "FC Caesar", color: "#8c2f5c", budget: 300000,
    coach: "Emiliano Viviano",
    presidents: ["Er Faina", "En3rix"],
    players: [
      withStats(player("Danilo Tunno", "GK", 64, 64, 79, 79, 21), { matches: 9 }),
      withStats(player("Mattia Valentini", "GK", 69, 69, 81, 84, 26), { matches: 4 }),
      withStats(player("Guido Davì", "DEF", 83, 86, 93, 92, 24), { matches: 13, goals: 2 }),
      withStats(player("Melvyn Remy", "DEF", 82, 81, 92, 82, 30), { matches: 12, goals: 3, assists: 1 }),
      withStats(player("Moad Moussaif", "DEF", 84, 81, 86, 87, 25), { matches: 1 }),
      withStats(player("Fran Hernández", "MID", 87, 95, 86, 88, 20), { matches: 13, goals: 10, assists: 6 }),
      withStats(player("Gabriel Nunes", "MID", 83, 87, 75, 85, 25), { matches: 4, goals: 1 }),
      withStats(player("Nicola Cutrignelli", "MID", 73, 78, 67, 74, 29), { matches: 12, goals: 4, assists: 1 }),
      withStats(player("Radja Nainggolan", "MID", 84, 87, 76, 88, 28), { matches: 1 }),
      withStats(player("Mattia Parretti", "MID", 75, 88, 76, 82, 21), { matches: 1 }),
      withStats(player("Antonio Picci", "ATT", 93, 96, 86, 82, 22), { matches: 13, goals: 3 }),
      withStats(player("Boubacar Coulibaly", "ATT", 97, 97, 88, 79, 30), { matches: 3, goals: 1 }),
      withStats(player("Enrico Brignola", "ATT", 82, 76, 69, 66, 25), { matches: 4, goals: 2 }),
      withStats(player("Matteo Zunino", "ATT", 81, 84, 74, 71, 29), { matches: 13, goals: 7, assists: 2 }),
      withStats(player("Nicola Loiodice", "ATT", 92, 92, 86, 90, 21), { matches: 11, goals: 11, assists: 4 }),
      withStats(player("Nigel Kyeremateng", "ATT", 92, 91, 89, 80, 31), { matches: 3 }),
      withStats(player("Alberto Panzani", "ATT", 97, 95, 87, 83, 31), { matches: 1 }),
      withStats(player("Juan Fernández", "ATT", 67, 71, 67, 57, 26), { matches: 1 }),
      withStats(player("Mohamed Rabbas", "ATT", 94, 96, 90, 87, 26), { matches: 1 })
    ]
  },
  {
    id: "g7f", name: "Gear 7 FC", color: "#5a6472", budget: 300000,
    coach: "Ivan Brocchieri",
    presidents: ["Manuuxo"],
    players: [
      withStats(player("Alessandro Feleppa", "GK", 71, 76, 85, 90, 29), { matches: 1 }),
      withStats(player("Valerio Anane", "GK", 68, 64, 77, 75, 26), { matches: 10 }),
      withStats(player("Angelo Panarello", "DEF", 81, 77, 86, 81, 23), { matches: 11, goals: 4 }),
      withStats(player("Riccardo Bozzuto", "DEF", 66, 67, 77, 68, 22), { matches: 10, goals: 1, assists: 2 }),
      withStats(player("Tiziano Prinari", "DEF", 87, 83, 96, 94, 19), { matches: 9 }),
      withStats(player("Niccolò Ciceri", "DEF", 70, 67, 81, 73, 23), { matches: 3 }),
      withStats(player("Christophe Renault", "MID", 87, 91, 90, 90, 22), { matches: 11, goals: 7, assists: 1 }),
      withStats(player("Alessandro Iacuaniello", "ATT", 92, 90, 83, 84, 26), { matches: 2 }),
      withStats(player("Alessandro Sala", "ATT", 88, 89, 80, 76, 23), { matches: 9, goals: 7, assists: 4 }),
      withStats(player("Andrea Bertazzoli", "ATT", 84, 82, 75, 74, 18), { matches: 7, goals: 6, assists: 4 }),
      withStats(player("Gabriele Folla", "ATT", 80, 81, 77, 74, 25), { matches: 10, goals: 2 }),
      withStats(player("Giovanni Kean", "ATT", 84, 80, 72, 68, 20), { matches: 8, goals: 5, assists: 1 }),
      withStats(player("Roberto Ratti", "ATT", 97, 86, 86, 83, 20), { matches: 11, goals: 4 }),
      withStats(player("Leandro Cosenza", "ATT", 85, 80, 73, 67, 26), { matches: 3, goals: 1, assists: 1 })
    ]
  },
  {
    id: "stl", name: "Stallions", color: "#1f5fa8", budget: 300000,
    coach: "Diego Franzè",
    presidents: ["Blur"],
    players: [
      withStats(player("Gianluca Bressan", "GK", 78, 84, 86, 91, 21), { matches: 0 }),
      withStats(player("Samuele Guddo", "GK", 75, 68, 77, 83, 26), { matches: 3 }),
      withStats(player("Andrea Becchi", "DEF", 85, 78, 94, 88, 24), { matches: 3 }),
      withStats(player("Filippo Adamo", "DEF", 79, 80, 93, 82, 22), { matches: 3 }),
      withStats(player("Marco Evangelisti", "DEF", 86, 86, 97, 90, 19), { matches: 3, assists: 1 }),
      withStats(player("Giacomo Pennetta", "MID", 65, 75, 68, 66, 27), { matches: 2 }),
      withStats(player("Niccolò Marino", "MID", 77, 72, 66, 71, 23), { matches: 3, goals: 1 }),
      withStats(player("Pietro Brusadelli", "MID", 71, 78, 69, 67, 25), { matches: 2 }),
      withStats(player("Alessandro Colombo", "ATT", 90, 92, 84, 85, 21), { matches: 3, goals: 7, assists: 4 }),
      withStats(player("Dennis Stojkovic", "ATT", 79, 84, 74, 76, 18), { matches: 3, goals: 2, assists: 3 }),
      withStats(player("Leandro Cosenza", "ATT", 84, 81, 79, 76, 22), { matches: 3 }),
      withStats(player("Simone Lo Faso", "ATT", 81, 80, 70, 67, 20), { matches: 3, goals: 2, assists: 1 }),
      player("Francesco Totti", "ATT", 55, 92, 68, 90, 49)
    ]
  },
  {
    id: "trm", name: "TRM FC", color: "#c0392b", budget: 300000,
    coach: "Marco Bertoni",
    presidents: ["TheRealMarzaa"],
    players: [
      withStats(player("Alessandro Vagge", "GK", 73, 67, 76, 85, 21), { matches: 12 }),
      withStats(player("Mateo Seitaj", "GK", 68, 63, 72, 78, 30), { matches: 4 }),
      withStats(player("Alberto Muscas", "DEF", 68, 67, 69, 67, 18), { matches: 12, assists: 1 }),
      withStats(player("Alessandro Di Dio", "DEF", 77, 77, 91, 83, 20), { matches: 12, goals: 1, assists: 1 }),
      withStats(player("Alessio Marcone", "DEF", 77, 74, 86, 82, 20), { matches: 11, goals: 1, assists: 1 }),
      withStats(player("Alessio Zefi", "DEF", 88, 84, 97, 87, 32), { matches: 11, goals: 2 }),
      withStats(player("Carlos Filippi", "DEF", 84, 87, 89, 90, 27), { matches: 10 }),
      withStats(player("Pietro Martirani", "MID", 73, 76, 78, 80, 28), { matches: 5 }),
      withStats(player("Riccardo Vono", "MID", 72, 77, 70, 80, 23), { matches: 11, goals: 12, assists: 6 }),
      withStats(player("Piero Concialdi", "MID", 73, 76, 76, 75, 24), { matches: 2 }),
      withStats(player("Paolo Scienza", "ATT", 85, 89, 75, 78, 33), { matches: 11, goals: 17, assists: 5 }),
      withStats(player("Walid Khribech", "ATT", 88, 91, 81, 86, 19), { matches: 10, assists: 1 }),
      withStats(player("Antonio Ferrara", "ATT", 84, 86, 78, 80, 25), { matches: 5, goals: 3 }),
      withStats(player("Vincenzo Corvino", "ATT", 84, 82, 76, 76, 22), { matches: 3, goals: 4, assists: 2 }),
      player("Ciccio Caputo", "ATT", 60, 87, 76, 88, 38)
    ]
  },
  {
    id: "und", name: "Underdogs FC", color: "#2f8f4f", budget: 300000,
    coach: "Dario Sibio",
    presidents: ["Mirko Cisco", "Il Rosso"],
    players: [
      withStats(player("Gianmarco Chironi", "GK", 81, 88, 91, 97, 25), { matches: 3 }),
      withStats(player("Roberto Taliento", "GK", 83, 81, 96, 97, 18), { matches: 1 }),
      withStats(player("Andrea Gorgoglione", "DEF", 70, 70, 76, 72, 21), { matches: 3 }),
      withStats(player("Riccardo Bertaglio", "DEF", 86, 84, 94, 81, 24), { matches: 3 }),
      withStats(player("Tommaso Caldera", "DEF", 73, 80, 87, 79, 27), { matches: 2, goals: 1 }),
      withStats(player("Alessandro Cannataro", "MID", 83, 88, 84, 90, 24), { matches: 3 }),
      withStats(player("Andrea D'errico", "MID", 71, 70, 67, 66, 27), { matches: 3, goals: 1 }),
      withStats(player("Domenico Rossi", "MID", 84, 86, 79, 82, 27), { matches: 3, goals: 2 }),
      withStats(player("Mario Prezioso", "MID", 69, 80, 71, 71, 28), { matches: 3 }),
      player("Giovanni Zito", "MID", 80, 82, 76, 79, 25),
      withStats(player("Jorginho Fernandes", "ATT", 88, 83, 79, 84, 26), { matches: 3, goals: 1 }),
      withStats(player("Matteo Perrotti", "ATT", 77, 78, 76, 70, 35), { matches: 3, goals: 4, assists: 4 })
    ]
  },
  {
    id: "zeb", name: "Zebras FC", color: "#454545", budget: 300000,
    coach: "Mareglen Mhillaj",
    presidents: ["Luca Campolunghi"],
    players: [
      withStats(player("Alberto Calabrò", "GK", 68, 69, 84, 80, 29), { matches: 11 }),
      withStats(player("Luca Mascherpa", "GK", 65, 69, 70, 70, 29), { matches: 4 }),
      withStats(player("Lorenzo Matera", "GK", 78, 74, 81, 83, 27), { matches: 0 }),
      withStats(player("Carlo Alletto", "DEF", 68, 65, 74, 73, 22), { matches: 11 }),
      withStats(player("Christian Negri", "DEF", 72, 78, 89, 80, 22), { matches: 8, goals: 1, assists: 1 }),
      withStats(player("Jacopo Tirapelle", "DEF", 75, 75, 87, 77, 26), { matches: 4, goals: 2, assists: 1 }),
      withStats(player("Lorenzo Pagani", "DEF", 65, 63, 74, 74, 32), { matches: 12 }),
      withStats(player("Luca Meregalli", "DEF", 83, 85, 95, 95, 28), { matches: 12 }),
      player("Riccardo Albanese", "DEF", 79, 81, 84, 82, 22),
      withStats(player("Andrea D'errico", "MID", 76, 75, 69, 75, 27), { matches: 5, goals: 2, assists: 1 }),
      withStats(player("Matia Iervolino", "MID", 81, 78, 80, 81, 31), { matches: 11, goals: 1 }),
      withStats(player("Vittorio Mehmetaj", "MID", 76, 73, 66, 78, 23), { matches: 13, goals: 3 }),
      withStats(player("Marco Gallizia", "MID", 70, 80, 73, 75, 32), { matches: 1 }),
      player("Riccardo Villa", "MID", 78, 80, 75, 78, 25),
      withStats(player("Andrea Vairani", "ATT", 91, 87, 81, 82, 21), { matches: 4, goals: 2, assists: 2 }),
      withStats(player("Andrea Zingari", "ATT", 81, 74, 77, 70, 23), { matches: 7, goals: 3, assists: 2 }),
      withStats(player("Elia Galligani", "ATT", 75, 78, 72, 67, 18), { matches: 9, goals: 2, assists: 1 }),
      withStats(player("Emanuele Bardelloni", "ATT", 93, 95, 87, 87, 24), { matches: 13, goals: 13, assists: 3 }),
      withStats(player("Salvatore Lillo", "ATT", 92, 97, 86, 81, 24), { matches: 11, goals: 9, assists: 3 }),
      withStats(player("Andrea Tremolada", "ATT", 85, 77, 74, 72, 29), { matches: 1 }),
      withStats(player("Roberto Maffioletti", "ATT", 81, 87, 78, 71, 31), { matches: 1 })
    ]
  },
  {
    id: "zco", name: "Zeta Como", color: "#1e3a5f", budget: 300000,
    coach: "Cristian Brocchi",
    presidents: ["ZW Jackson", "Luca Toni"],
    players: [
      withStats(player("Alessio Buono", "GK", 84, 85, 87, 92, 27), { matches: 12 }),
      player("Hachim Mastour", "ATT", 78, 90, 74, 78, 28),
      withStats(player("Francesco Ambrosio", "GK", 66, 73, 83, 87, 23), { matches: 0 }),
      withStats(player("Nelson Dida", "GK", 82, 82, 97, 97, 25), { matches: 1 }),
      withStats(player("Matteo Manzoni", "DEF", 68, 76, 77, 72, 25), { matches: 10, assists: 1 }),
      withStats(player("Mattia El Hilali", "DEF", 74, 69, 86, 72, 25), { matches: 12, assists: 1 }),
      withStats(player("Michael Kabamba", "DEF", 63, 61, 76, 71, 25), { matches: 10, goals: 1 }),
      withStats(player("Stefan Kladar", "DEF", 73, 71, 81, 74, 26), { matches: 11, goals: 5 }),
      withStats(player("Gabriele Geraci", "MID", 92, 89, 89, 94, 27), { matches: 12, goals: 4, assists: 1 }),
      withStats(player("Oussama M'Hamsi", "MID", 96, 91, 90, 91, 22), { matches: 12, goals: 7, assists: 2 }),
      withStats(player("Corrado Marrulli", "MID", 90, 97, 82, 87, 21), { matches: 2 }),
      withStats(player("Samuele Oltremarini", "MID", 82, 83, 73, 81, 19), { matches: 4 }),
      withStats(player("Cristian Brocchi", "MID", 75, 83, 71, 76, 26), { matches: 1 }),
      withStats(player("Andrea Filipi", "ATT", 79, 71, 71, 63, 19), { matches: 8, goals: 8, assists: 3 }),
      withStats(player("Gabriele Giacchino", "ATT", 87, 90, 82, 77, 23), { matches: 12, goals: 15, assists: 4 }),
      withStats(player("Kevin Girgenti", "ATT", 76, 79, 73, 63, 28), { matches: 12, goals: 8, assists: 2 }),
      withStats(player("Federico Nardi", "ATT", 92, 89, 78, 78, 22), { matches: 1 })
    ]
  },
];

// ---------------------- LIGUE ALLEMAGNE (Kings League Allemagne) ----------------------
const GERMANY_TEAMS = [
  {
    id: "erc", name: "ERA Colonia", color: "#7a3fa0", budget: 300000,
    coach: "Ilija Simunovic",
    presidents: ["Zarbex", "Filow"],
    players: [
      withStats(player("Dylan Bos", "GK", 88, 81, 97, 95, 34), { matches: 2 }),
      withStats(player("Daniel Maus", "GK", 63, 71, 84, 81, 27), { matches: 5 }),
      withStats(player("Jakov Suver", "DEF", 86, 75, 93, 84, 20), { matches: 2 }),
      withStats(player("Nico Czichi", "DEF", 88, 82, 95, 94, 28), { matches: 6 }),
      withStats(player("Joshua Holtby", "MID", 87, 90, 83, 83, 24), { matches: 3, goals: 1 }),
      withStats(player("Yoel Yilma", "MID", 86, 87, 85, 92, 28), { matches: 7 }),
      withStats(player("Moritz Leitner", "MID", 89, 90, 89, 90, 24), { matches: 5, goals: 5, assists: 4 }),
      withStats(player("Philipp Klement", "MID", 79, 77, 76, 79, 32), { matches: 7, goals: 18, assists: 3 }),
      withStats(player("Abdelaziz Slimi", "ATT", 86, 77, 81, 70, 29), { matches: 7, assists: 1 }),
      withStats(player("Ahmed Azirar", "ATT", 87, 86, 80, 76, 24), { matches: 7 }),
      withStats(player("Dennis de Sousa", "ATT", 97, 90, 94, 87, 22), { matches: 5, goals: 3, assists: 1 }),
      withStats(player("Elias Römers", "ATT", 74, 74, 68, 64, 25), { matches: 0 }),
      withStats(player("Erkan Kurucam", "ATT", 81, 74, 70, 61, 22), { matches: 2 }),
      withStats(player("Etienne Reck", "ATT", 78, 70, 69, 67, 23), { matches: 5, goals: 3, assists: 1 }),
      withStats(player("Mounir Bouziane", "ATT", 87, 80, 79, 73, 26), { matches: 6, goals: 1 }),
      withStats(player("Fatjon Celani", "ATT", 87, 85, 80, 73, 20), { matches: 1 })
    ]
  },
  {
    id: "g2f", name: "G2 FC", color: "#d9691e", budget: 300000,
    coach: "Malik Hadziavdic",
    presidents: ["MoAuba", "Konygebony"],
    players: [
      withStats(player("Ben Zöllner", "GK", 79, 81, 92, 96, 30), { matches: 4 }),
      withStats(player("Jack Krause", "GK", 73, 74, 93, 93, 22), { matches: 9 }),
      withStats(player("Ahmed Omairat", "DEF", 85, 80, 90, 88, 23), { matches: 9, goals: 1, assists: 1 }),
      withStats(player("Cihan Ucar", "DEF", 78, 74, 88, 87, 25), { matches: 9, goals: 4, assists: 3 }),
      withStats(player("Mehmet-Can Senocak", "MID", 80, 76, 69, 77, 27), { matches: 9, goals: 21, assists: 1 }),
      withStats(player("Staas Mitko", "MID", 84, 90, 87, 93, 34), { matches: 9 }),
      withStats(player("Tarik Hadziavdic", "MID", 64, 69, 70, 73, 29), { matches: 9, goals: 4, assists: 5 }),
      withStats(player("Smajo Jakupovic", "MID", 78, 81, 71, 81, 32), { matches: 1 }),
      withStats(player("Dennis Öztürk", "ATT", 90, 89, 91, 89, 26), { matches: 9, goals: 4, assists: 1 }),
      withStats(player("Halit Bacak", "ATT", 93, 92, 88, 82, 35), { matches: 9, goals: 1 }),
      withStats(player("Artin Zardoshtian", "ATT", 78, 80, 76, 77, 21), { matches: 4, goals: 4, assists: 4 }),
      withStats(player("Kenan Smajlovic", "ATT", 81, 82, 76, 67, 29), { matches: 9, goals: 4 }),
      withStats(player("Mohammed Izal", "ATT", 82, 83, 71, 74, 28), { matches: 9, goals: 5, assists: 2 })
    ]
  },
  {
    id: "ist", name: "Istanbul United", color: "#b8202a", budget: 300000,
    coach: "",
    presidents: ["Hasan Ali Kaldirim", "Mert"],
    players: [
      withStats(player("Niklas Reichel", "GK", 62, 72, 81, 84, 32), { matches: 7 }),
      withStats(player("Eric Ulrich", "GK", 73, 79, 85, 85, 23), { matches: 1 }),
      withStats(player("Burak Mus", "DEF", 90, 86, 92, 88, 24), { matches: 6, goals: 1 }),
      withStats(player("Kerem Sengün", "DEF", 83, 85, 95, 91, 35), { matches: 7, goals: 5, assists: 2 }),
      withStats(player("Mardochee Tchakoumi", "DEF", 75, 64, 76, 73, 35), { matches: 6, assists: 1 }),
      withStats(player("Burak Özmen", "DEF", 85, 84, 87, 88, 21), { matches: 1 }),
      withStats(player("Murat Saglam", "MID", 83, 92, 80, 91, 22), { matches: 8, goals: 5, assists: 3 }),
      withStats(player("Oliver Lanwer", "MID", 80, 76, 74, 72, 24), { matches: 8, goals: 1 }),
      withStats(player("Yousef Keshta", "MID", 84, 88, 77, 84, 20), { matches: 8, goals: 2, assists: 1 }),
      withStats(player("Ilias Arssi", "MID", 89, 93, 77, 89, 21), { matches: 4, assists: 1 }),
      withStats(player("Max Wilschrey", "ATT", 86, 84, 76, 74, 26), { matches: 6, goals: 1, assists: 1 }),
      withStats(player("Umut Yildiz", "ATT", 73, 72, 67, 59, 26), { matches: 8, goals: 3 }),
      withStats(player("Ali Hassan Hammoud", "ATT", 78, 78, 76, 74, 26), { matches: 3 }),
      withStats(player("Amir Ahmadi", "ATT", 69, 72, 63, 67, 22), { matches: 7, goals: 4, assists: 1 }),
      withStats(player("Jama Telli", "ATT", 88, 83, 78, 81, 25), { matches: 4, goals: 2, assists: 1 }),
      withStats(player("Sangar Aziz", "ATT", 69, 75, 68, 59, 21), { matches: 8, goals: 10, assists: 3 })
    ]
  },
  {
    id: "kak", name: "Kaktus Kickers", color: "#3a9d5c", budget: 300000,
    coach: "Dominic Reinold",
    presidents: ["Trymacs", "Nici"],
    players: [
      withStats(player("Kaan Gökcesin", "GK", 78, 85, 95, 97, 29), { matches: 7 }),
      withStats(player("Lennard Hövel", "GK", 77, 84, 91, 84, 24), { matches: 1 }),
      withStats(player("Daniel Bleja", "DEF", 74, 72, 80, 74, 26), { matches: 8, assists: 1 }),
      withStats(player("Dario Bezerra", "DEF", 63, 66, 73, 72, 25), { matches: 8, goals: 1, assists: 1 }),
      withStats(player("Taner Yalcin", "DEF", 71, 60, 74, 65, 25), { matches: 6, goals: 1, assists: 2 }),
      withStats(player("Fabian Djemail", "DEF", 79, 85, 96, 83, 20), { matches: 4 }),
      withStats(player("Mohamed Rabia", "DEF", 72, 79, 89, 75, 25), { matches: 4, goals: 1 }),
      withStats(player("Thomas Haas", "DEF", 68, 64, 80, 70, 32), { matches: 5, goals: 4, assists: 1 }),
      withStats(player("Jacob Göker", "MID", 70, 83, 76, 76, 28), { matches: 5 }),
      withStats(player("Nick Mwaura Hirschfeld", "MID", 71, 67, 62, 73, 23), { matches: 2 }),
      withStats(player("Bilal Akgüvercin", "MID", 70, 74, 70, 80, 29), { matches: 1 }),
      withStats(player("Bilal Abdallah", "ATT", 86, 89, 81, 80, 21), { matches: 4 }),
      withStats(player("Gaspard Fehlinger", "ATT", 91, 88, 87, 81, 22), { matches: 8, goals: 7, assists: 4 }),
      withStats(player("Mohamed Dahas", "ATT", 89, 91, 79, 72, 21), { matches: 6, goals: 3, assists: 4 }),
      withStats(player("Noah Can", "ATT", 93, 87, 80, 76, 33), { matches: 8, goals: 3, assists: 1 }),
      withStats(player("Yazid Tambo", "ATT", 88, 94, 88, 83, 20), { matches: 7, goals: 3, assists: 2 }),
      withStats(player("Bernad Gllogjani", "ATT", 94, 97, 86, 81, 34), { matches: 2, goals: 1 }),
      withStats(player("Elias Beck", "ATT", 80, 74, 72, 66, 26), { matches: 6, goals: 8, assists: 2 })
    ]
  },
  {
    id: "nrf", name: "No Rules FC", color: "#a52020", budget: 300000,
    coach: "Francisco Copado",
    presidents: ["Brazzos", "Bilal Kamarieh", "Jordan", "Semih"],
    players: [
      withStats(player("Fabio Rasic", "GK", 81, 79, 96, 97, 18), { matches: 3 }),
      withStats(player("Daniel Jelisic", "DEF", 68, 68, 73, 73, 25), { matches: 3, assists: 1 }),
      withStats(player("Diego de la Mata", "DEF", 89, 80, 92, 94, 31), { matches: 3, assists: 1 }),
      withStats(player("Diren Günay", "DEF", 85, 79, 93, 91, 23), { matches: 3, goals: 2 }),
      withStats(player("Ensar Skrijelj", "DEF", 78, 81, 88, 87, 26), { matches: 3 }),
      withStats(player("Albin Zekiri", "MID", 78, 83, 71, 74, 18), { matches: 3 }),
      withStats(player("Amar Cekic", "MID", 78, 79, 74, 82, 28), { matches: 3 }),
      withStats(player("Nick Salihamidžić", "MID", 93, 94, 81, 93, 22), { matches: 3 }),
      withStats(player("Anthony Manuba", "ATT", 76, 77, 72, 62, 21), { matches: 3 }),
      withStats(player("Gilles Vidal", "ATT", 82, 84, 72, 70, 27), { matches: 3, goals: 3 }),
      withStats(player("Nam Nguyen", "ATT", 77, 80, 68, 72, 21), { matches: 2 }),
      withStats(player("Serhat Imsak", "ATT", 83, 84, 80, 82, 24), { matches: 3, goals: 2, assists: 1 })
    ]
  },
  {
    id: "ttf", name: "Tiki Tacker FF", color: "#34495e", budget: 300000,
    coach: "Selçuk Turan",
    presidents: ["Papaplatte", "BastiGHG", "Jann-Fiete Arp"],
    players: [
      withStats(player("Aboubakar Fofana", "GK", 82, 84, 90, 96, 26), { matches: 8 }),
      withStats(player("Bennett Schauer", "GK", 79, 80, 89, 95, 25), { matches: 0 }),
      withStats(player("Jean Atohoun", "GK", 73, 75, 92, 86, 28), { matches: 2 }),
      withStats(player("Finn Hanke", "DEF", 75, 72, 85, 81, 24), { matches: 8, goals: 4, assists: 1 }),
      withStats(player("Nikola Stankovic", "DEF", 69, 73, 84, 79, 26), { matches: 4 }),
      withStats(player("Noah Dahaba", "DEF", 74, 73, 86, 79, 20), { matches: 8, goals: 2 }),
      withStats(player("Philip Koch", "DEF", 82, 86, 87, 88, 34), { matches: 6, goals: 2 }),
      withStats(player("Zinedine Hukporti", "DEF", 80, 81, 89, 77, 29), { matches: 8, goals: 9, assists: 9 }),
      withStats(player("Ephrahim Asante", "DEF", 71, 69, 82, 76, 19), { matches: 7 }),
      withStats(player("Farukhan Bulut", "DEF", 84, 90, 92, 92, 22), { matches: 6, goals: 3, assists: 3 }),
      withStats(player("Lionel Lingani", "DEF", 86, 76, 91, 86, 27), { matches: 2 }),
      withStats(player("Luca Freese", "DEF", 75, 74, 79, 79, 18), { matches: 3 }),
      withStats(player("Diego Larralde", "MID", 89, 92, 85, 87, 28), { matches: 8, goals: 2, assists: 1 }),
      withStats(player("Fabio Lopes", "MID", 90, 95, 89, 91, 35), { matches: 8, goals: 5 }),
      withStats(player("Marko Tadic", "ATT", 80, 72, 68, 64, 29), { matches: 8, goals: 3, assists: 1 }),
      withStats(player("Mustafa Zazai", "ATT", 91, 81, 80, 74, 26), { matches: 1 })
    ]
  },
  {
    id: "vvf", name: "Vice Versa FC", color: "#a68a3c", budget: 300000,
    coach: "Sebastian Sander",
    presidents: ["Mario Götze", "Ebru Önal", "Farooo", "Owomoyela"],
    players: [
      withStats(player("Marvin Gomoluch", "GK", 65, 72, 78, 74, 29), { matches: 4 }),
      withStats(player("Yannick Marko", "GK", 78, 86, 90, 88, 24), { matches: 4 }),
      withStats(player("Ali Alawie", "DEF", 73, 80, 84, 82, 21), { matches: 8, goals: 8, assists: 3 }),
      withStats(player("Constantin Pennartz", "DEF", 74, 66, 77, 71, 22), { matches: 8, goals: 1 }),
      withStats(player("Hagen Blohm", "DEF", 79, 74, 82, 78, 22), { matches: 8, goals: 10, assists: 2 }),
      withStats(player("Jannis Becker", "DEF", 85, 82, 88, 83, 29), { matches: 8, goals: 2 }),
      withStats(player("Maurice Pluntke", "DEF", 87, 80, 94, 85, 25), { matches: 7 }),
      withStats(player("Saif-Ayadi", "DEF", 65, 64, 76, 75, 33), { matches: 4, assists: 1 }),
      withStats(player("Bo Lasse Henrichs", "DEF", 80, 70, 80, 75, 24), { matches: 2, goals: 1, assists: 1 }),
      withStats(player("Nils Schütte", "DEF", 87, 81, 97, 91, 28), { matches: 2, goals: 2 }),
      withStats(player("Sven Wurm", "DEF", 87, 86, 96, 84, 23), { matches: 6, goals: 3, assists: 1 }),
      withStats(player("Phil Spillmann", "DEF", 86, 80, 86, 90, 18), { matches: 1, assists: 1 }),
      withStats(player("David Pütz", "MID", 95, 97, 85, 91, 21), { matches: 2, goals: 1, assists: 1 }),
      withStats(player("Halil Doğan", "MID", 75, 77, 71, 72, 23), { matches: 4, goals: 1 }),
      withStats(player("Thomas Idel", "MID", 82, 85, 78, 81, 24), { matches: 3, goals: 1 }),
      withStats(player("Hussain Alawie", "ATT", 90, 84, 83, 78, 27), { matches: 8, goals: 2 }),
      withStats(player("Yassine Gnondi", "ATT", 86, 86, 79, 79, 26), { matches: 8, goals: 2 }),
      withStats(player("Francisco Garcia", "ATT", 87, 90, 78, 80, 21), { matches: 0 }),
      withStats(player("Nuredin Ali Khan", "ATT", 83, 79, 72, 72, 33), { matches: 0 }),
      withStats(player("Cem Sabanci", "ATT", 81, 84, 72, 73, 26), { matches: 1 }),
      withStats(player("Marvin Iskra", "ATT", 94, 94, 89, 83, 33), { matches: 1 }),
      withStats(player("Shpend Hasani", "ATT", 70, 69, 61, 64, 21), { matches: 1 })
    ]
  },
  {
    id: "you", name: "Youniors F.C.", color: "#c2185b", budget: 300000,
    coach: "Mimoun Azaouagh",
    presidents: ["Younes Zarou", "LetsHugo"],
    players: [
      withStats(player("Max Wißmann", "GK", 66, 66, 79, 80, 23), { matches: 4 }),
      withStats(player("Maximilian Krapf", "GK", 82, 91, 95, 97, 28), { matches: 9 }),
      withStats(player("Ahmed Azaouagh", "DEF", 69, 72, 76, 71, 28), { matches: 8 }),
      withStats(player("Emir Sejdovic", "DEF", 65, 60, 77, 69, 23), { matches: 10, goals: 3, assists: 2 }),
      withStats(player("Henoc Agbessi", "DEF", 69, 68, 78, 69, 27), { matches: 2, goals: 1 }),
      withStats(player("Sokratis Papastathopoulos", "DEF", 78, 77, 93, 83, 25), { matches: 3 }),
      withStats(player("Danny Blum", "DEF", 85, 86, 88, 88, 25), { matches: 4, goals: 1, assists: 1 }),
      withStats(player("Christian Clemens", "MID", 69, 70, 67, 67, 19), { matches: 10, goals: 3, assists: 1 }),
      withStats(player("Julien Vercauteren", "MID", 82, 87, 80, 89, 18), { matches: 0 }),
      withStats(player("Naoufal Azzagari", "MID", 76, 83, 79, 76, 29), { matches: 7, goals: 5, assists: 2 }),
      withStats(player("David 'Brinquinho'", "MID", 72, 83, 74, 78, 21), { matches: 10, goals: 9, assists: 5 }),
      withStats(player("Luiz 'Pepinho' Souza", "MID", 69, 69, 69, 66, 26), { matches: 10, goals: 10, assists: 3 }),
      withStats(player("Jhon Palacios", "ATT", 79, 71, 72, 65, 20), { matches: 9, goals: 5, assists: 1 }),
      withStats(player("Lordan Handanovic", "ATT", 84, 87, 75, 73, 31), { matches: 4, goals: 1 }),
      withStats(player("Marco Terrazzino", "ATT", 93, 95, 90, 81, 32), { matches: 5, goals: 2 }),
      withStats(player("Kevin Moreira", "ATT", 83, 82, 74, 72, 26), { matches: 3, goals: 1 }),
      withStats(player("Maicon Silva", "ATT", 82, 80, 67, 72, 31), { matches: 6, goals: 1, assists: 1 })
    ]
  },
];

// ---------------------- LIGUE MEXIQUE (Kings League Mexique) ----------------------
const MEXICO_TEAMS = [
  {
    id: "anq", name: "Aniquiladores FC", color: "#c0392b", budget: 300000,
    coach: "Sergio Pibe Verdirame",
    presidents: ["Juan Guarnizo"],
    players: [
      withStats(player("Erik Fraire", "GK", 63, 73, 77, 79, 30), { matches: 2 }),
      withStats(player("Nelson Velandia", "GK", 65, 66, 70, 71, 27), { matches: 2 }),
      withStats(player("Denilson Lobón", "DEF", 87, 84, 95, 86, 22), { matches: 2 }),
      withStats(player("Martín Cani Rodríguez", "DEF", 85, 83, 95, 90, 33), { matches: 2 }),
      withStats(player("Patricio Pato Arias", "DEF", 74, 72, 83, 78, 23), { matches: 2 }),
      withStats(player("Brayan González", "MID", 84, 96, 90, 87, 20), { matches: 2 }),
      withStats(player("Brayan Hernández", "MID", 83, 87, 86, 93, 27), { matches: 2 }),
      withStats(player("Brihan Gutiérrez", "MID", 85, 89, 81, 84, 22), { matches: 2, goals: 1 }),
      withStats(player("Daviz Junco", "MID", 74, 78, 74, 78, 35), { matches: 2 }),
      withStats(player("Obed Martínez", "MID", 66, 73, 72, 68, 26), { matches: 2 }),
      withStats(player("Axur Quintero", "ATT", 89, 82, 84, 75, 21), { matches: 2, goals: 1, assists: 1 }),
      withStats(player("Diego Martínez", "ATT", 89, 96, 85, 87, 25), { matches: 2 }),
      withStats(player("Jacob Lobo Morales", "ATT", 90, 88, 86, 84, 21), { matches: 2 })
    ]
  },
  {
    id: "atp", name: "Atlético Parceros FC", color: "#b8302a", budget: 300000,
    coach: "Luis Alfonso Álvarez",
    presidents: ["James Rodríguez", "Angerson Pelicanger García"],
    players: [
      withStats(player("Felipe Urán", "GK", 74, 73, 87, 81, 27), { matches: 3 }),
      withStats(player("Simón Duque", "GK", 72, 75, 83, 84, 29), { matches: 4 }),
      withStats(player("Andrés Osorno", "DEF", 70, 62, 77, 68, 25), { matches: 4 }),
      withStats(player("Cristian Hernández", "DEF", 84, 84, 92, 90, 24), { matches: 4, goals: 3, assists: 2 }),
      withStats(player("David Loaiza", "DEF", 83, 85, 97, 90, 22), { matches: 4, goals: 3, assists: 1 }),
      withStats(player("Juan Tilano", "DEF", 78, 85, 90, 91, 33), { matches: 4, assists: 1 }),
      withStats(player("Kevin Mejía", "DEF", 67, 63, 68, 68, 24), { matches: 3 }),
      withStats(player("Marlon Ramírez", "DEF", 89, 89, 97, 91, 27), { matches: 4, goals: 1 }),
      withStats(player("Alexis Gómez", "ATT", 81, 82, 81, 72, 18), { matches: 4 }),
      withStats(player("Angellot Caro", "ATT", 90, 81, 76, 76, 21), { matches: 4, goals: 2, assists: 1 }),
      withStats(player("Jhon Palacios", "ATT", 89, 83, 85, 74, 30), { matches: 2 }),
      withStats(player("Julio Perea", "ATT", 78, 79, 69, 66, 26), { matches: 1 }),
      withStats(player("Maicol Hernández", "ATT", 85, 93, 88, 81, 27), { matches: 4, goals: 7, assists: 3 })
    ]
  },
  {
    id: "cdc", name: "Club de Cuervos", color: "#7a1f1f", budget: 300000,
    coach: "Jorge Cacho González",
    presidents: ["Natalia García", "Iván Navarrete"],
    players: [
      withStats(player("Armando Chávez", "GK", 74, 72, 89, 85, 35), { matches: 1 }),
      withStats(player("Bernaldino Valdovinos", "GK", 56, 65, 69, 68, 29), { matches: 7 }),
      withStats(player("Hugo Murga", "GK", 76, 81, 84, 92, 21), { matches: 9 }),
      withStats(player("César Romo", "DEF", 60, 66, 78, 67, 25), { matches: 16, goals: 6, assists: 3 }),
      withStats(player("Edson González", "DEF", 74, 76, 76, 77, 24), { matches: 9 }),
      withStats(player("Jorge Escamilla", "DEF", 71, 70, 81, 73, 24), { matches: 10, goals: 4 }),
      withStats(player("Marlon Castillo", "DEF", 63, 72, 72, 72, 21), { matches: 9 }),
      withStats(player("Mixtly Cruz", "DEF", 76, 70, 85, 82, 23), { matches: 2 }),
      withStats(player("Adriano Nunes", "MID", 76, 82, 71, 80, 26), { matches: 16, goals: 21, assists: 15 }),
      withStats(player("Ángel Ayala", "MID", 78, 89, 80, 84, 20), { matches: 13, goals: 5, assists: 2 }),
      withStats(player("Brandon Magaña", "MID", 76, 84, 72, 83, 26), { matches: 15, goals: 4 }),
      withStats(player("Edder Vargas", "MID", 75, 80, 72, 77, 29), { matches: 11, goals: 2 }),
      withStats(player("Fausto Alemán", "MID", 80, 76, 72, 80, 30), { matches: 4 }),
      withStats(player("José Askenazi", "MID", 88, 92, 92, 91, 26), { matches: 14, goals: 24, assists: 3 }),
      withStats(player("Roberto Uribe", "MID", 91, 87, 78, 85, 19), { matches: 12, goals: 1, assists: 3 }),
      withStats(player("Luis Valdés", "MID", 82, 91, 86, 92, 20), { matches: 2 }),
      withStats(player("Salvador Navarro", "MID", 72, 77, 70, 74, 31), { matches: 11, goals: 2 }),
      withStats(player("Baruc Ochoa", "ATT", 97, 95, 91, 82, 23), { matches: 3, goals: 3 }),
      withStats(player("Diego Velázquez", "ATT", 80, 78, 71, 71, 22), { matches: 4 }),
      withStats(player("Miguel Morales", "ATT", 90, 90, 81, 78, 28), { matches: 6, assists: 1 })
    ]
  },
  {
    id: "gdc", name: "Galácticos del Caribe", color: "#1e3f7a", budget: 300000,
    coach: "Lucas Ayala",
    presidents: ["Santiago Matías Alofoke", "Vincent Pérez", "Angelo Valdés"],
    players: [
      withStats(player("Baruc Mateos", "GK", 83, 81, 97, 97, 27), { matches: 4 }),
      withStats(player("Iván Muñoz", "GK", 60, 60, 68, 75, 21), { matches: 5 }),
      withStats(player("Jesús Carbajal", "GK", 69, 79, 81, 86, 25), { matches: 13 }),
      withStats(player("Daniel Mendoza", "DEF", 62, 60, 72, 70, 27), { matches: 13, goals: 1, assists: 1 }),
      withStats(player("Erick Madrigal", "DEF", 69, 68, 87, 80, 20), { matches: 13, goals: 1 }),
      withStats(player("Jairo Tapie", "DEF", 85, 83, 95, 84, 25), { matches: 13 }),
      withStats(player("Alejandro Maro Ortega", "MID", 80, 83, 75, 75, 26), { matches: 13, goals: 4 }),
      withStats(player("Diego Franco", "MID", 78, 81, 67, 79, 28), { matches: 12, goals: 2 }),
      withStats(player("Erick Guzmán", "MID", 74, 74, 75, 74, 33), { matches: 13, goals: 4, assists: 3 }),
      withStats(player("José Hernández", "MID", 66, 79, 66, 70, 32), { matches: 13, goals: 11, assists: 10 }),
      withStats(player("Pabel Montes", "MID", 75, 85, 73, 76, 26), { matches: 13 }),
      withStats(player("Pablo Gómez", "MID", 84, 95, 86, 96, 23), { matches: 13, goals: 17, assists: 4 }),
      withStats(player("Andres Valiente", "MID", 73, 75, 69, 77, 23), { matches: 1 }),
      withStats(player("Kevin Cardona", "ATT", 68, 76, 68, 62, 20), { matches: 12, goals: 11, assists: 4 }),
      withStats(player("Jhon Miranda", "ATT", 86, 83, 83, 73, 29), { matches: 2 })
    ]
  },
  {
    id: "guf", name: "Guerrilla FC", color: "#4a5c2f", budget: 300000,
    coach: "Rodrigo Ávila",
    presidents: ["Mr. Stiven"],
    players: [
      withStats(player("Jair Peláez", "GK", 76, 76, 88, 79, 18), { matches: 3 }),
      withStats(player("Omar Láscari", "GK", 62, 61, 76, 69, 29), { matches: 9 }),
      withStats(player("Said Zamora", "GK", 66, 60, 76, 74, 27), { matches: 7 }),
      withStats(player("Adrián Mora", "DEF", 60, 68, 73, 69, 18), { matches: 8 }),
      withStats(player("Alejandro Chimal", "DEF", 91, 88, 97, 88, 24), { matches: 4, goals: 1 }),
      withStats(player("Eduardo Velarde", "DEF", 65, 73, 78, 69, 25), { matches: 11, goals: 2, assists: 1 }),
      withStats(player("Juan Carlos Silva", "DEF", 67, 60, 70, 67, 24), { matches: 4 }),
      withStats(player("Miguel Lizardo", "DEF", 82, 76, 86, 82, 28), { matches: 0 }),
      withStats(player("Rafael Cid", "DEF", 78, 71, 83, 85, 23), { matches: 5 }),
      withStats(player("Albano Rodríguez", "DEF", 91, 92, 97, 91, 21), { matches: 7 }),
      withStats(player("Abraham Morales", "MID", 85, 92, 88, 91, 35), { matches: 10, goals: 11, assists: 6 }),
      withStats(player("Gerardo Ramírez", "MID", 84, 89, 81, 88, 22), { matches: 10, goals: 4 }),
      withStats(player("Gustavo Furby Guillén", "MID", 71, 76, 64, 65, 18), { matches: 11, goals: 10, assists: 4 }),
      withStats(player("Alain Villanueva", "MID", 81, 82, 70, 85, 18), { matches: 1 }),
      withStats(player("Carlos Mata", "MID", 67, 68, 61, 67, 21), { matches: 1, goals: 1 }),
      withStats(player("Abel Vega", "ATT", 87, 89, 88, 81, 24), { matches: 4, goals: 1 }),
      withStats(player("Isaac Zepeda", "ATT", 94, 85, 87, 80, 32), { matches: 7, goals: 2 }),
      withStats(player("Morrison Palma", "ATT", 94, 89, 84, 78, 25), { matches: 9, goals: 1, assists: 1 }),
      withStats(player("Patricio Zerecero", "ATT", 80, 79, 70, 72, 28), { matches: 4 }),
      withStats(player("Yudier Prado", "ATT", 80, 73, 65, 62, 29), { matches: 7 })
    ]
  },
  {
    id: "kru", name: "KRÜ FC", color: "#d63384", budget: 300000,
    coach: "Juan Manuel Miranda",
    presidents: ["Sergio Kun Agüero"],
    players: [
      withStats(player("Erik Lugo", "GK", 79, 88, 93, 89, 28), { matches: 9 }),
      withStats(player("Jeancob Ramírez", "GK", 66, 70, 75, 72, 22), { matches: 11 }),
      withStats(player("Donovan Hernández", "GK", 67, 67, 72, 72, 33), { matches: 1 }),
      withStats(player("Dago Campari", "DEF", 66, 75, 78, 72, 24), { matches: 12, goals: 1 }),
      withStats(player("Mauricio Reyna", "DEF", 84, 84, 95, 91, 26), { matches: 12, assists: 1 }),
      withStats(player("Alonso Ferreira", "DEF", 73, 70, 78, 73, 25), { matches: 1 }),
      withStats(player("Christopher Pedraza", "MID", 83, 84, 73, 76, 24), { matches: 11, goals: 5, assists: 2 }),
      withStats(player("Edson Trejo", "MID", 90, 90, 84, 88, 33), { matches: 12, goals: 1, assists: 1 }),
      withStats(player("Gonzalo Lescano", "MID", 69, 66, 69, 70, 27), { matches: 11, goals: 8, assists: 4 }),
      withStats(player("Santiago Rotemberg", "MID", 89, 96, 82, 88, 22), { matches: 10, goals: 1, assists: 1 }),
      withStats(player("Aaron Martínez", "ATT", 73, 77, 71, 68, 21), { matches: 12, goals: 14 }),
      withStats(player("Alberto García", "ATT", 74, 73, 72, 68, 24), { matches: 11, goals: 3, assists: 3 }),
      withStats(player("Facu Romero", "ATT", 92, 96, 87, 84, 29), { matches: 12, goals: 21, assists: 9 }),
      withStats(player("Tomás Sandoval", "ATT", 68, 71, 68, 61, 32), { matches: 11, goals: 4 })
    ]
  },
  {
    id: "lal", name: "Los Aliens FC", color: "#6b3fa0", budget: 300000,
    coach: "David Cabrera",
    presidents: ["Edwin Castro"],
    players: [
      withStats(player("James Hernández", "GK", 70, 70, 83, 81, 30), { matches: 1 }),
      withStats(player("Julio Torres", "GK", 81, 85, 85, 92, 22), { matches: 12 }),
      withStats(player("Alan Mendoza", "DEF", 73, 76, 87, 77, 30), { matches: 12, goals: 5 }),
      withStats(player("Daniel Ríos", "DEF", 84, 88, 92, 92, 20), { matches: 4 }),
      withStats(player("Erik Vera", "DEF", 75, 74, 87, 77, 22), { matches: 11, goals: 1 }),
      withStats(player("Brayam Nazarit", "MID", 82, 84, 82, 82, 34), { matches: 12, goals: 6, assists: 5 }),
      withStats(player("David Ortiz", "MID", 91, 95, 87, 92, 26), { matches: 11, goals: 5, assists: 2 }),
      withStats(player("Jesús Chuy Pérez", "MID", 78, 82, 77, 74, 22), { matches: 12, goals: 9, assists: 3 }),
      withStats(player("Jorge Meléndez", "MID", 65, 69, 67, 72, 28), { matches: 12, goals: 4, assists: 2 }),
      withStats(player("Juan Ramírez", "MID", 91, 88, 79, 86, 25), { matches: 11, goals: 8 }),
      withStats(player("Ricardo Valencia", "MID", 72, 75, 70, 72, 22), { matches: 11 }),
      withStats(player("Alejandro Sanchez", "MID", 84, 86, 73, 77, 24), { matches: 1 }),
      withStats(player("Devin Vega", "MID", 77, 75, 73, 78, 25), { matches: 2, goals: 1 }),
      withStats(player("Diego Abella", "ATT", 92, 84, 77, 79, 27), { matches: 11, goals: 3, assists: 2 })
    ]
  },
  {
    id: "lch", name: "Los Chamos FC", color: "#6d2333", budget: 300000,
    coach: "Jos Gartland",
    presidents: ["Donato Muñoz", "Flavio Broianigo", "RDjavi"],
    players: [
      withStats(player("Carlos Escalona", "GK", 74, 77, 87, 86, 26), { matches: 11 }),
      withStats(player("Cristian Hernández", "GK", 72, 78, 85, 90, 23), { matches: 12 }),
      withStats(player("Alexis López", "DEF", 69, 59, 69, 73, 27), { matches: 12, goals: 1 }),
      withStats(player("Tonatiuh Mejía", "DEF", 90, 92, 97, 97, 27), { matches: 11, goals: 8, assists: 3 }),
      withStats(player("Uriel Zuart", "DEF", 62, 68, 74, 74, 28), { matches: 9, goals: 4, assists: 1 }),
      withStats(player("Álvaro Bocanegra", "MID", 84, 90, 80, 86, 26), { matches: 12, goals: 3, assists: 2 }),
      withStats(player("Christian Lagunas", "MID", 76, 80, 72, 76, 31), { matches: 12, goals: 6, assists: 7 }),
      withStats(player("Irvin Mojica", "MID", 89, 94, 87, 91, 21), { matches: 6, goals: 1, assists: 1 }),
      withStats(player("Jesús López", "MID", 71, 69, 65, 67, 19), { matches: 12, goals: 3 }),
      withStats(player("Juan Cisneros", "MID", 66, 74, 69, 66, 30), { matches: 11, goals: 5, assists: 2 }),
      withStats(player("Román Ramírez", "MID", 92, 95, 86, 91, 27), { matches: 6, goals: 2 }),
      withStats(player("Alan Sanchez", "MID", 91, 92, 81, 93, 23), { matches: 1 }),
      withStats(player("Gustavo Miranda", "MID", 85, 83, 80, 81, 24), { matches: 1, goals: 2 }),
      withStats(player("Salvador Navarro", "MID", 83, 82, 80, 82, 30), { matches: 11, goals: 2 }),
      withStats(player("Donovan Alba", "ATT", 72, 71, 60, 60, 26), { matches: 2, goals: 1 }),
      withStats(player("Genaro Castillo", "ATT", 80, 81, 81, 79, 34), { matches: 12, goals: 15, assists: 4 }),
      withStats(player("Leo Makina Herrlein", "ATT", 88, 90, 83, 83, 18), { matches: 2, goals: 2 }),
      withStats(player("José Vizcarra", "ATT", 94, 91, 88, 83, 32), { matches: 1 })
    ]
  },
  {
    id: "pca", name: "Peluche Caligari", color: "#e08828", budget: 300000,
    coach: "Fernando Espinosa",
    presidents: ["Álex Montiel", "Gabriel Montiel"],
    players: [
      withStats(player("Moisés Dabbah", "GK", 68, 70, 83, 81, 25), { matches: 12 }),
      withStats(player("Daniel Quiroz", "GK", 74, 70, 84, 79, 29), { matches: 0 }),
      withStats(player("Josecarlos Van Rankin", "DEF", 75, 76, 87, 83, 22), { matches: 11, goals: 6 }),
      withStats(player("Carlos Camello Valdez", "DEF", 76, 72, 76, 73, 22), { matches: 10, goals: 1, assists: 1 }),
      withStats(player("Aldair Giorgana", "MID", 94, 95, 84, 88, 23), { matches: 10, goals: 8, assists: 3 }),
      withStats(player("Eder Giorgana", "MID", 72, 76, 68, 82, 25), { matches: 10, goals: 7, assists: 3 }),
      withStats(player("Christian Gimenez", "MID", 82, 90, 83, 87, 24), { matches: 8, goals: 2 }),
      withStats(player("Fernando Morales", "MID", 79, 74, 76, 78, 18), { matches: 12, goals: 4, assists: 2 }),
      withStats(player("Hugo Rodríguez", "MID", 92, 87, 81, 84, 28), { matches: 11, goals: 1, assists: 4 }),
      withStats(player("Ángel Curry Castro", "MID", 80, 83, 69, 77, 25), { matches: 6, goals: 2 }),
      withStats(player("Michelle Chucky Castro", "MID", 67, 77, 73, 70, 35), { matches: 9, goals: 2 }),
      withStats(player("Mauricio Huitrón", "MID", 84, 92, 88, 87, 18), { matches: 12, goals: 2, assists: 2 }),
      withStats(player("Pablo Barrera", "MID", 77, 81, 79, 82, 23), { matches: 2 }),
      withStats(player("Aarón Del Real", "MID", 72, 84, 79, 80, 23), { matches: 1 }),
      withStats(player("Santiago Lagarde", "ATT", 90, 90, 88, 81, 28), { matches: 11, goals: 8, assists: 2 }),
      withStats(player("Eddie Sánchez", "ATT", 82, 87, 79, 71, 25), { matches: 7 }),
      withStats(player("César Vallejo", "ATT", 90, 82, 79, 70, 33), { matches: 1 })
    ]
  },
  {
    id: "per", name: "Persas FC", color: "#4a4a4a", budget: 300000,
    coach: "Gabriela Batocletti",
    presidents: ["Andy Zeein Merino", "Nicola Porcella"],
    players: [
      withStats(player("Antonio Monterde", "GK", 80, 74, 91, 91, 24), { matches: 12 }),
      withStats(player("David Acuña", "DEF", 80, 72, 80, 77, 20), { matches: 3 }),
      withStats(player("Gustavo Ramos", "DEF", 76, 80, 88, 85, 21), { matches: 12, goals: 1, assists: 1 }),
      withStats(player("Iván Monroy", "DEF", 76, 76, 80, 79, 27), { matches: 1 }),
      withStats(player("Kevin Valdez", "DEF", 73, 72, 81, 77, 32), { matches: 5, goals: 6, assists: 2 }),
      withStats(player("Rodrigo González", "DEF", 83, 75, 92, 81, 27), { matches: 9 }),
      withStats(player("Irving Zurita", "MID", 68, 70, 65, 71, 28), { matches: 5, assists: 1 }),
      withStats(player("Luis Amador", "MID", 92, 90, 88, 89, 31), { matches: 9, goals: 3, assists: 1 }),
      withStats(player("Obed Martínez", "MID", 91, 95, 83, 89, 21), { matches: 12, goals: 9, assists: 6 }),
      withStats(player("Óscar Gómez", "MID", 71, 83, 75, 80, 23), { matches: 5, goals: 2, assists: 2 }),
      withStats(player("Yair Arias", "MID", 67, 75, 67, 72, 24), { matches: 12, goals: 5, assists: 2 }),
      withStats(player("Gerardo Chávez", "MID", 76, 84, 76, 88, 26), { matches: 1, goals: 1 }),
      withStats(player("Irving Rodríguez", "MID", 88, 93, 85, 84, 28), { matches: 2, goals: 2 }),
      withStats(player("José Juan Vázquez", "MID", 74, 76, 70, 81, 28), { matches: 1 }),
      withStats(player("Diego Rodríguez", "ATT", 85, 80, 71, 67, 25), { matches: 10 }),
      withStats(player("José Rochín", "ATT", 90, 83, 82, 72, 34), { matches: 10, goals: 6, assists: 1 }),
      withStats(player("Josenildo Santos", "ATT", 76, 71, 67, 61, 23), { matches: 10, goals: 14 }),
      withStats(player("Marco Granados", "ATT", 80, 73, 66, 69, 35), { matches: 4 }),
      withStats(player("Paulo Santos", "ATT", 86, 88, 84, 83, 24), { matches: 3, goals: 1, assists: 2 })
    ]
  },
  {
    id: "rnz", name: "Raniza FC", color: "#3a8f4f", budget: 300000,
    coach: "Manu Lanzarote",
    presidents: ["Alana Flores"],
    players: [
      withStats(player("Jonathan Sánchez", "GK", 73, 78, 92, 88, 30), { matches: 2 }),
      withStats(player("Matías Herrera", "GK", 65, 68, 74, 70, 22), { matches: 12 }),
      withStats(player("Obeth Rojas", "GK", 60, 64, 72, 81, 33), { matches: 1 }),
      withStats(player("Eder López", "DEF", 63, 63, 76, 77, 26), { matches: 12 }),
      withStats(player("Ezequiel Luna", "DEF", 90, 81, 97, 91, 20), { matches: 13, goals: 7, assists: 1 }),
      withStats(player("Héctor de la Fuente", "DEF", 72, 81, 89, 82, 28), { matches: 3, goals: 1 }),
      withStats(player("Juande Martínez", "DEF", 70, 67, 79, 70, 23), { matches: 12 }),
      withStats(player("Lautaro Martínez", "DEF", 84, 81, 90, 84, 35), { matches: 12, goals: 1 }),
      withStats(player("Matias Rojas", "DEF", 79, 80, 97, 88, 18), { matches: 2, goals: 2, assists: 2 }),
      withStats(player("Donovan Martínez", "MID", 83, 87, 84, 89, 19), { matches: 13, goals: 2, assists: 5 }),
      withStats(player("Juan Araya", "MID", 86, 94, 80, 86, 26), { matches: 13, goals: 9, assists: 6 }),
      withStats(player("Mathías Vidangossy", "MID", 91, 94, 82, 86, 28), { matches: 11, goals: 6, assists: 4 }),
      withStats(player("Manu Lanzarote", "MID", 77, 84, 79, 83, 24), { matches: 2 }),
      withStats(player("Alexis Silva", "ATT", 81, 86, 78, 71, 26), { matches: 13, goals: 17, assists: 8 }),
      withStats(player("Alfonso Nieto", "ATT", 87, 77, 73, 74, 22), { matches: 13, goals: 6, assists: 1 })
    ]
  },
  {
    id: "sim", name: "Simios FC", color: "#6b4226", budget: 300000,
    coach: "Omar Flores",
    presidents: ["Abraham Flores"],
    players: [
      withStats(player("Óscar Medina", "GK", 78, 78, 88, 95, 30), { matches: 10 }),
      withStats(player("Jorge Lima", "GK", 73, 75, 78, 85, 29), { matches: 3 }),
      withStats(player("Luis Huerta", "GK", 64, 63, 76, 68, 18), { matches: 0 }),
      withStats(player("Erick Sámano", "DEF", 70, 68, 71, 68, 25), { matches: 10, assists: 2 }),
      withStats(player("George Corral", "DEF", 76, 73, 85, 83, 25), { matches: 10, goals: 1, assists: 2 }),
      withStats(player("Sebastián Sáez", "DEF", 82, 80, 87, 77, 27), { matches: 4 }),
      withStats(player("Andrés Suárez", "MID", 88, 84, 81, 88, 27), { matches: 11, goals: 18, assists: 2 }),
      withStats(player("Gerson García", "MID", 93, 94, 83, 89, 23), { matches: 11, assists: 1 }),
      withStats(player("Hatzel Roque", "MID", 72, 76, 76, 82, 34), { matches: 7 }),
      withStats(player("José Shaggy Martínez", "MID", 70, 82, 72, 74, 27), { matches: 11, assists: 3 }),
      withStats(player("Luis Olascoaga", "MID", 66, 70, 68, 74, 26), { matches: 11, goals: 1 }),
      withStats(player("Cristian González", "ATT", 74, 72, 69, 68, 29), { matches: 10, goals: 10, assists: 1 }),
      withStats(player("Miguel Rebollo", "ATT", 80, 87, 81, 72, 27), { matches: 8, goals: 12, assists: 2 }),
      withStats(player("Roberto Pérez", "ATT", 79, 72, 67, 68, 22), { matches: 11, goals: 3 })
    ]
  },
];

const LEAGUES = {
  france: { name: "France", teams: FRANCE_TEAMS },
  brazil: { name: "Brésil", teams: BRAZIL_TEAMS },
  spain: { name: "Espagne", teams: SPAIN_TEAMS },
  italy: { name: "Italie", teams: ITALY_TEAMS },
  germany: { name: "Allemagne", teams: GERMANY_TEAMS },
  mexico: { name: "Mexique", teams: MEXICO_TEAMS }
};

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
