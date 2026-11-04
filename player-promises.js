// Engagements bornés : aucune mutation de joueur, aucun tirage aléatoire.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PlayerPromises = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const MAX_CHARS = 12000, MAX_ACTIVE = 20, MAX_HISTORY = 30, MAX_MATCHES = 12;
  const DEFINITIONS = {
    time: { label: "Temps de jeu", target: 2, window: 3, requirement: "Jouer au moins 5 minutes dans 2 des 3 prochains matchs où le joueur est disponible." },
    rest: { label: "Repos", target: 1, window: 1, requirement: "Ne pas faire participer le joueur au prochain match où il est disponible." },
    group: { label: "Composition de départ", target: 1, window: 2, requirement: "Retenir le joueur dans les sept de départ au moins une fois sur les 2 prochains matchs où il est disponible." },
    attack: { label: "Rôle offensif", target: 1, window: 2, requirement: "Retenir le joueur au coup d’envoi avec un rôle offensif compatible et le faire jouer au moins 5 minutes, dans l’un des 2 prochains matchs où il est disponible." }
  };
  const KINDS = ["time", "rest", "group", "attack"];
  const OFFENSIVE_ROLES = { DEF: ["overlap"], MID: ["creator"], ATT: ["runner", "poacher"] };
  const REASONS = {
    met: "Objectif tenu sur les matchs observés.", deadline: "Échéance atteinte sans remplir l’engagement.",
    unavailable: "Échéance reportée : le joueur était indisponible au coup d’envoi.",
    injured_during: "Échéance reportée après une blessure survenue pendant le match.",
    unknown: "Échéance reportée : les preuves nécessaires ne sont pas disponibles.",
    left: "Classée sans sanction : le joueur a quitté le club.",
    review_limit: "Classée sans sanction après 12 rencontres, faute de résolution sur des matchs éligibles.",
    duplicate: "Engagement en double classé sans sanction.", capacity: "Engagement excédentaire classé sans sanction."
  };
  const own = (value, key) => value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key);
  const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const integer = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
  const id = value => typeof value === "string" && value.length > 0 && value.length <= 160 && JSON.stringify(value).length <= 162 ? value : null;
  const day = value => integer(value, 0, 1000000000) ? value : 0;
  const season = value => integer(value, 1, 1000000) ? value : 1;
  const text = (value, max = 64) => {
    if (typeof value !== "string" || !value.length) return "Sans nom";
    if (value.length <= max && JSON.stringify(value).length <= max + 2) return value;
    let cut = value.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, "");
    while (cut.length && JSON.stringify(cut + "…").length > max + 2) cut = cut.slice(0, -1).replace(/[\uD800-\uDBFF]$/, "");
    return cut + "…";
  };
  function hash(value) {
    let a = 2166136261, b = 2246822507;
    for (let index = 0; index < value.length; index++) {
      const unit = value.charCodeAt(index);
      a = Math.imul(a ^ unit, 16777619); b = Math.imul(b ^ unit, 3266489909);
    }
    return ((BigInt(a >>> 0) << 32n) | BigInt(b >>> 0)).toString(36).padStart(13, "0");
  }
  const validHash = value => typeof value === "string" && /^[0-9a-z]{13}$/.test(value);
  function close(entry, status, reason, clock) {
    entry.status = status; entry.last = reason; entry.seen = [];
    if (clock) entry.end = [season(clock.season), day(clock.day)];
  }
  function normalize(input) {
    const result = { version: 1, omitted: integer(input?.omitted, 0, 1000000000) ? input.omitted : 0, entries: [] };
    const map = new Map();
    const source = Array.isArray(input?.entries) ? input.entries : [];
    result.omitted = Math.min(1000000000, result.omitted + Math.max(0, source.length - 1000));
    for (const raw of source.slice(-1000)) {
      if (!record(raw) || !validHash(raw.id) || !id(raw.pid) || !own(DEFINITIONS, raw.kind)
        || !["active", "kept", "broken", "cancelled"].includes(raw.status)) continue;
      const definition = DEFINITIONS[raw.kind];
      const entry = { id: raw.id, pid: raw.pid, name: text(raw.name), kind: raw.kind, status: raw.status,
        s: season(raw.s), d: day(raw.d), n: integer(raw.n, 0, definition.window) ? raw.n : 0,
        ok: integer(raw.ok, 0, definition.target) ? raw.ok : 0,
        wait: integer(raw.wait, 0, MAX_MATCHES) ? raw.wait : 0,
        seen: [...new Set((Array.isArray(raw.seen) ? raw.seen : []).filter(validHash))].slice(0, MAX_MATCHES),
        last: own(REASONS, raw.last) ? raw.last : "" };
      if (Array.isArray(raw.end) && integer(raw.end[0], 1, 1000000) && integer(raw.end[1], 0, 1000000000)) entry.end = raw.end.slice(0, 2);
      if (entry.status !== "active") entry.seen = [];
      else if (entry.seen.length >= MAX_MATCHES) close(entry, "cancelled", "review_limit");
      const previous = map.get(entry.id);
      if (!previous || (previous.status === "active" && entry.status !== "active")) map.set(entry.id, entry);
    }
    const entries = [...map.values()].sort((a, b) => a.s - b.s || a.d - b.d || a.id.localeCompare(b.id, "fr"));
    const activePlayers = new Set(), active = [], history = [];
    for (const entry of entries) {
      if (entry.status === "active" && (activePlayers.has(entry.pid) || active.length >= MAX_ACTIVE))
        close(entry, "cancelled", activePlayers.has(entry.pid) ? "duplicate" : "capacity");
      if (entry.status === "active") { activePlayers.add(entry.pid); active.push(entry); }
      else history.push(entry);
    }
    history.sort((a, b) => (a.end?.[0] ?? a.s) - (b.end?.[0] ?? b.s) || (a.end?.[1] ?? a.d) - (b.end?.[1] ?? b.d) || a.id.localeCompare(b.id, "fr"));
    if (history.length > MAX_HISTORY) { result.omitted = Math.min(1000000000, result.omitted + history.length - MAX_HISTORY); history.splice(0, history.length - MAX_HISTORY); }
    result.entries = [...active, ...history];
    while (JSON.stringify(result).length > MAX_CHARS && history.length) {
      history.shift(); result.omitted = Math.min(1000000000, result.omitted + 1); result.entries = [...active, ...history];
    }
    // Les bornes des champs garantissent que 20 promesses actives tiennent seules.
    return result;
  }
  function messageIdentity(notification, player, kind, clock) {
    const explicit = typeof notification?.id === "string" && notification.id.length;
    if (!explicit && !clock) return null;
    const sourceId = explicit ? notification.id.slice(0, 300)
      : `legacy:${season(clock.season)}:${day(clock.day)}:${player.id}:${notification.templateIdx}`;
    return hash(sourceId + "\0" + player.id + "\0" + kind);
  }
  function preview(notification, player, input, clock) {
    const kind = notification?.type === "message" && Number.isInteger(notification.templateIdx) ? KINDS[notification.templateIdx] : null;
    const definition = kind && DEFINITIONS[kind];
    if (!definition) return { supported: false, canAccept: false, reason: "Ce message ne correspond pas à une promesse suivie." };
    let reason = "";
    const ledger = normalize(input);
    if (!id(player?.id) || notification.playerId !== player.id) reason = "Le joueur n’est plus disponible dans cet effectif.";
    else if (ledger.entries.some(entry => entry.id === messageIdentity(notification, player, kind, clock))) reason = "Ce message a déjà été traité.";
    else if (kind === "attack" && !own(OFFENSIVE_ROLES, player.pos)) reason = "Aucun rôle offensif compatible n’est proposé pour ce poste.";
    else if (ledger.entries.some(entry => entry.status === "active" && entry.pid === player.id)) reason = "Ce joueur a déjà une promesse en cours.";
    else if (ledger.entries.filter(entry => entry.status === "active").length >= MAX_ACTIVE) reason = "Le maximum de 20 promesses actives est atteint.";
    return { supported: true, canAccept: !reason, kind, label: definition.label, requirement: definition.requirement,
      detail: "Les indisponibilités et preuves manquantes reportent l’échéance. Après 12 rencontres sans résolution, la promesse est classée sans sanction. Réaction à l’échéance : +2 de forme si elle est tenue, −3 si elle est rompue, dans les bornes 40–99.", reason };
  }
  function accept(input, { notification, player, season: atSeason, day: atDay } = {}) {
    const ledger = normalize(input), proposal = preview(notification, player, ledger, { season: atSeason, day: atDay });
    if (!proposal.canAccept) return { ledger, accepted: false, reason: proposal.reason, supported: proposal.supported };
    const promiseId = messageIdentity(notification, player, proposal.kind, { season: atSeason, day: atDay });
    if (ledger.entries.some(entry => entry.id === promiseId)) return { ledger, accepted: false, reason: "Ce message a déjà été traité.", supported: true };
    ledger.entries.push({ id: promiseId, pid: player.id, name: text(player.name), kind: proposal.kind, status: "active",
      s: season(atSeason), d: day(atDay), n: 0, ok: 0, wait: 0, seen: [], last: "" });
    return { ledger: normalize(ledger), accepted: true, promiseId, reason: "", supported: true };
  }
  function reconcile(input, { players, season: atSeason, day: atDay } = {}) {
    const ledger = normalize(input);
    if (!Array.isArray(players)) return ledger;
    const ids = new Set(players.map(player => player?.id).filter(id));
    for (const entry of ledger.entries) if (entry.status === "active" && !ids.has(entry.pid)) close(entry, "cancelled", "left", { season: atSeason, day: atDay });
    return normalize(ledger);
  }
  function proof(kind, player, context) {
    const minutes = own(context.minutesPlayed, player.id) && typeof context.minutesPlayed[player.id] === "number"
      && Number.isFinite(context.minutesPlayed[player.id]) && context.minutesPlayed[player.id] >= 0 ? context.minutesPlayed[player.id] : null;
    const participants = Array.isArray(context.participants) ? new Set(context.participants) : null;
    const played = minutes > 0 || participants?.has(player.id) ? true : participants ? false : minutes === 0 ? false : null;
    if (kind === "rest") return played === null ? null : !played;
    if (kind === "time") return minutes !== null ? minutes >= 5 : played === false ? false : null;
    const lineup = Array.isArray(context.initialLineup) ? context.initialLineup.includes(player.id) : null;
    if (kind === "group") return lineup;
    if (lineup === false) return false;
    const roleKnown = own(context.initialRoles, player.id) && typeof context.initialRoles[player.id] === "string";
    const offensive = roleKnown ? (own(OFFENSIVE_ROLES, player.pos) ? OFFENSIVE_ROLES[player.pos] : []).includes(context.initialRoles[player.id]) : null;
    if (offensive === false) return false;
    if (lineup === null || offensive === null) return null;
    return minutes !== null ? minutes >= 5 : played === false ? false : null;
  }
  function evaluate(input, context = {}) {
    const ledger = normalize(input), effects = [];
    if (typeof context.fixtureKey !== "string" || !context.fixtureKey.length || context.fixtureKey.length > 500
      || !Array.isArray(context.teamPlayers)) return { ledger, effects };
    const fixture = hash(context.fixtureKey), clock = { season: season(context.season), day: day(context.day) };
    const players = new Map(context.teamPlayers.filter(record).map(player => [player.id, player]));
    const eligible = Array.isArray(context.eligibleIds) ? new Set(context.eligibleIds) : null;
    for (const entry of ledger.entries) {
      if (entry.status !== "active") continue;
      const player = players.get(entry.pid);
      if (!player) { close(entry, "cancelled", "left", clock); continue; }
      if (clock.season < entry.s || (clock.season === entry.s && clock.day < entry.d) || entry.seen.includes(fixture)) continue;
      entry.seen.push(fixture);
      let outcome = null;
      if (!eligible) entry.last = "unknown";
      else if (!eligible.has(entry.pid)) entry.last = "unavailable";
      else {
        outcome = proof(entry.kind, player, context);
        if (outcome === false && player.injured) { outcome = null; entry.last = "injured_during"; }
        else if (outcome === null) entry.last = "unknown";
      }
      if (outcome === null) entry.wait = Math.min(MAX_MATCHES, entry.wait + 1);
      else {
        entry.n++; if (outcome) entry.ok++;
        entry.last = "";
        const definition = DEFINITIONS[entry.kind];
        if (entry.ok >= definition.target || entry.n >= definition.window) {
          const kept = entry.ok >= definition.target;
          close(entry, kept ? "kept" : "broken", kept ? "met" : "deadline", clock);
          effects.push({ promiseId: entry.id, playerId: entry.pid, playerName: entry.name,
            delta: kept ? 2 : -3, status: entry.status, label: definition.label });
        }
      }
      if (entry.status === "active" && entry.seen.length >= MAX_MATCHES) close(entry, "cancelled", "review_limit", clock);
    }
    return { ledger: normalize(ledger), effects };
  }
  function render(container, { state, team, onPlayer } = {}) {
    if (!container) return;
    const ledger = normalize(state), active = ledger.entries.filter(entry => entry.status === "active"), history = ledger.entries.filter(entry => entry.status !== "active");
    const element = (tag, value, className) => { const node = document.createElement(tag); if (value != null) node.textContent = value; if (className) node.className = className; return node; };
    container.classList.add("player-promises"); container.replaceChildren();
    container.append(element("p", "Les engagements portent sur les matchs réellement disputés après ton accord. Une promesse tenue donne jusqu’à +2 de forme ; une promesse rompue retire jusqu’à 3 points, avec une forme limitée entre 40 et 99.", "promise-muted"));
    function card(entry) {
      const item = element("li", null, "promise-card promise-" + entry.status); item.dataset.promiseId = entry.id;
      const current = team?.players?.find(player => player.id === entry.pid);
      const heading = element("h4", current?.name || entry.name); item.append(heading);
      item.append(element("p", DEFINITIONS[entry.kind].requirement));
      const status = ({ active: "En cours", kept: "Tenue", broken: "Rompue", cancelled: "Classée sans sanction" })[entry.status];
      item.append(element("p", status, "promise-status"));
      if (entry.status === "active") {
        const definition = DEFINITIONS[entry.kind];
        item.append(element("p", `${entry.ok}/${definition.target} objectif${definition.target > 1 ? "s" : ""} rempli${definition.target > 1 ? "s" : ""} · ${entry.n}/${definition.window} match${definition.window > 1 ? "s" : ""} disponible${definition.window > 1 ? "s" : ""} évalué${definition.window > 1 ? "s" : ""}.`, "promise-muted"));
        if (entry.wait) item.append(element("p", `${entry.wait} rencontre${entry.wait > 1 ? "s" : ""} reportée${entry.wait > 1 ? "s" : ""} sans sanction.`, "promise-muted"));
      }
      if (entry.last) item.append(element("p", REASONS[entry.last], "promise-muted"));
      if (current && typeof onPlayer === "function") { const button = element("button", "Voir la fiche", "secondary"); button.type = "button"; button.onclick = () => onPlayer(current); item.append(button); }
      return item;
    }
    if (!active.length) container.append(element("p", "Aucune promesse en cours. Les demandes des joueurs précisent leur engagement avant l’accord."));
    else { const list = element("ul", null, "promise-active-list"); active.forEach(entry => list.append(card(entry))); container.append(list); }
    if (history.length) {
      const details = element("details", null, "promise-history"); details.append(element("summary", `Engagements terminés (${history.length})`));
      const list = element("ul", null, "promise-history-list"); history.slice().reverse().forEach(entry => list.append(card(entry))); details.append(list); container.append(details);
    }
    if (ledger.omitted) container.append(element("p", "Les engagements terminés les plus anciens peuvent être retirés pour limiter la taille de la sauvegarde.", "promise-muted"));
  }
  return { normalize, preview, accept, evaluate, reconcile, render, DEFINITIONS, MAX_CHARS, MAX_ACTIVE, MAX_HISTORY, MAX_MATCHES };
});
