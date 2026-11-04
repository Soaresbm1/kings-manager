// Règlements épinglés à une compétition et une saison de jeu. Aucun tirage aléatoire.
// Le catalogue peut évoluer : le moteur lit la copie sauvegardée, jamais un profil « courant ».
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CompetitionRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const SCHEMA = 1;
  const LEGACY_ID = "legacy-v1.5";
  const GUIDE_ID = "guide-2026-11-04";
  const CHECKED_AT = "2026-11-04";
  const LEGACY_CONFIG = {
    totalMinutes: 40, halfTime: 20,
    escalierEndMinute: 5, doubleGoalStartMinute: 17,
    diceStartMinute: 21, diceEndMinute: 23, matchballStartMinute: 36,
    specialWindows: [[5, 17], [23, 36]], presidentDeadline: 35,
    cardDuration: 4, starDeadline: 38, yellowDuration: 2, redDuration: 5
  };
  const PROFILES = {
    [LEGACY_ID]: {
      profileId: LEGACY_ID, revision: 1, label: "Kings Manager historique",
      status: "game-format", sourceLabel: "Moteur Kings Manager 1.5",
      sourceUrl: "", checkedAt: "",
      description: "Préserve les règles et les résultats des carrières existantes.",
      notes: ["Format du jeu : 40 minutes nominales, pause à 20, Matchball à 36. Les anciennes fenêtres et durées sont conservées à l’identique."],
      config: LEGACY_CONFIG
    },
    [GUIDE_ID]: {
      profileId: GUIDE_ID, revision: 1, label: "Guide Kings League · novembre 2026",
      status: "adaptation", sourceLabel: "Guide général officiel Kings League",
      sourceUrl: "https://kingsleague.pro/fr/comment-jouer", checkedAt: CHECKED_AT,
      description: "Repères du guide officiel, adaptés à la simulation minute par minute.",
      notes: [
        "Le guide présente 20 + 16 minutes, le double but à 17, le Dé après la pause et le Matchball à 36.",
        "Dans le jeu : Dé aux minutes 21–23 ; cartes aux minutes 5–16 et 24–35 pour éviter les phases réservées.",
        "Les effets de cartes et les sanctions gardent le calcul du moteur historique, dont le joueur étoile jusqu’à la minute 38. Ce guide général ne certifie pas chaque ligue ou édition."
      ],
      config: { ...LEGACY_CONFIG, totalMinutes: 36, specialWindows: [[5, 16], [24, 35]] }
    }
  };
  function freeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  freeze(PROFILES);
  const CONFIG_KEYS = Object.keys(LEGACY_CONFIG);
  const INTEGER_KEYS = CONFIG_KEYS.filter(key => key !== "specialWindows");
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  function context(options, fallback) {
    options = options && typeof options === "object" ? options : {};
    fallback = fallback && typeof fallback === "object" ? fallback : {};
    const rawCompetition = options.competition === undefined ? fallback.competition : options.competition;
    const rawSeason = options.season === undefined ? fallback.season : options.season;
    return {
      competition: typeof rawCompetition === "string" && /^[a-z0-9][a-z0-9:_-]{0,63}$/i.test(rawCompetition)
        ? rawCompetition : "championship",
      season: Number.isSafeInteger(rawSeason) && rawSeason > 0 && rawSeason <= 10000 ? rawSeason : 1
    };
  }
  function validConfig(config) {
    if (!config || typeof config !== "object" || Array.isArray(config)) return false;
    if (!INTEGER_KEYS.every(key => own(config, key) && Number.isInteger(config[key]) && config[key] >= 1 && config[key] <= 120)) return false;
    if (!(config.escalierEndMinute < config.doubleGoalStartMinute && config.doubleGoalStartMinute < config.halfTime
      && config.halfTime < config.diceStartMinute && config.diceStartMinute <= config.diceEndMinute
      && config.diceEndMinute < config.matchballStartMinute && config.matchballStartMinute <= config.totalMinutes)) return false;
    if (config.presidentDeadline >= config.matchballStartMinute || config.starDeadline > config.totalMinutes + 8) return false;
    if (![config.cardDuration, config.yellowDuration, config.redDuration].every(value => value <= 10)) return false;
    if (!Array.isArray(config.specialWindows) || config.specialWindows.length !== 2) return false;
    if (!config.specialWindows.every(window => Array.isArray(window) && window.length === 2
      && window.every(value => Number.isInteger(value) && value >= 1 && value <= config.matchballStartMinute)
      && window[0] <= window[1])) return false;
    return config.specialWindows[0][1] < config.specialWindows[1][0];
  }
  function copyConfig(config) {
    return Object.fromEntries(CONFIG_KEYS.map(key => [key, key === "specialWindows" ? config[key].map(window => [...window]) : config[key]]));
  }
  function create(profileId, options) {
    const profile = typeof profileId === "string" && own(PROFILES, profileId) ? PROFILES[profileId] : PROFILES[LEGACY_ID];
    return freeze({ schema: SCHEMA, profileId: profile.profileId, revision: profile.revision,
      ...context(options), config: copyConfig(profile.config) });
  }
  function normalize(snapshot, options) {
    // A missing/invalid snapshot always migrates to the old format. Updating the catalogue
    // must never silently change the rules of a career already started.
    if (!snapshot || snapshot.schema !== SCHEMA || typeof snapshot.profileId !== "string" || !own(PROFILES, snapshot.profileId)
      || snapshot.revision !== 1 || !validConfig(snapshot.config)) return create(LEGACY_ID, context(options, snapshot));
    return freeze({ schema: SCHEMA, profileId: snapshot.profileId, revision: snapshot.revision,
      ...context(options, snapshot), config: copyConfig(snapshot.config) });
  }
  function summary(snapshot) {
    const saved = normalize(snapshot);
    const profile = PROFILES[saved.profileId];
    const matchesPublishedProfile = JSON.stringify(saved.config) === JSON.stringify(copyConfig(profile.config));
    // A well-formed imported snapshot is playable and remains pinned, but its modified
    // values must not inherit the official provenance of the catalogue entry.
    if (!matchesPublishedProfile) return freeze({ ...saved, label: "Règlement enregistré",
      status: "game-format", sourceLabel: "Copie de carrière", sourceUrl: "", checkedAt: "",
      description: "Valeurs sauvegardées pour cette compétition et cette saison.",
      notes: ["Cette copie diffère du profil publié. Ses valeurs sont conservées ; aucune conformité officielle n’est revendiquée."] });
    return freeze({ ...saved, label: profile.label, status: profile.status,
      sourceLabel: profile.sourceLabel, sourceUrl: profile.sourceUrl, checkedAt: profile.checkedAt,
      description: profile.description, notes: [...profile.notes] });
  }
  function engineConfig(snapshot) { return normalize(snapshot).config; }
  function list() { return Object.keys(PROFILES).map(id => summary(create(id))); }
  function isSpecialWindow(snapshot, minute, kind) {
    if (!Number.isFinite(minute)) return false;
    const config = engineConfig(snapshot);
    return config.specialWindows.some(([start, end]) => minute >= start
      && minute <= Math.min(end, kind === "president" ? config.presidentDeadline : end));
  }
  return freeze({ SCHEMA, LEGACY_ID, GUIDE_ID, CHECKED_AT,
    PROFILE_IDS: Object.keys(PROFILES), create, normalize, engineConfig, summary, list, validConfig, isSpecialWindow });
});
